#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const Conf = require('conf');
const open = require('open');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// AWS SDK imports
const { EC2Client, DescribeInstancesCommand, DescribeVpcsCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const program = new Command();

// Configuration setup
const config = new Conf({
  projectName: 'platform-toolkit',
  defaults: {
    github: {
      token: null,
      username: null,
      email: null,
      defaultVisibility: 'public',
      defaultOrg: null
    },
    aws: {
      accessKeyId: null,
      secretAccessKey: null,
      region: 'us-east-1',
      accountId: null
    },
    preferences: {
      autoGitInit: true,
      autoNpmInstall: false
    }
  }
});

// Deployment state configuration
const deploymentsConfig = new Conf({
  projectName: 'platform-toolkit-deployments',
  defaults: {}
});

// Template metadata
const templates = {
  api: {
    name: 'Node.js API',
    description: 'Production-ready REST API with TypeScript',
    techStack: ['TypeScript 5.x', 'Express.js 4.x', 'PostgreSQL 15 + TypeORM', 'Redis 7', 'Docker + Docker Compose'],
    features: [
      'RESTful endpoints (Users, Tasks)',
      'Database migrations',
      'Redis caching',
      'Health checks',
      'Security (Helmet, CORS)',
      'Production Dockerfile'
    ],
    path: 'node-api-template',
    emoji: '📦'
  },
  microservices: {
    name: 'CloudBill Microservices',
    description: 'Multi-tenant SaaS platform architecture',
    techStack: ['TypeScript', '5 Services', 'API Gateway', 'Kubernetes', 'Prometheus', 'Grafana'],
    features: [
      '5 microservices (Auth, Billing, Invoicing, Notifications, Analytics)',
      'Multi-tenant architecture',
      'Kubernetes manifests (Kustomize)',
      '213 tests with 90%+ coverage',
      'Observability (Prometheus, Grafana)',
      'Production-ready Docker Compose'
    ],
    path: 'microservices-template',
    emoji: '🚀'
  }
};

// ============================================================================
// Validation Helpers
// ============================================================================

function validateServiceName(name) {
  if (!name || name.trim().length === 0) {
    return 'Service name is required';
  }

  if (name.length < 3) {
    return 'Service name must be at least 3 characters';
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Service name must contain only lowercase letters, numbers, and hyphens';
  }

  const targetPath = path.join(process.cwd(), name);
  if (fs.existsSync(targetPath)) {
    return `Directory "${name}" already exists`;
  }

  return true;
}

// ============================================================================
// AWS Helper Functions
// ============================================================================

function getAWSClients() {
  const accessKeyId = config.get('aws.accessKeyId');
  const secretAccessKey = config.get('aws.secretAccessKey');
  const region = config.get('aws.region');

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  const credentials = {
    accessKeyId,
    secretAccessKey
  };

  return {
    ec2: new EC2Client({ region, credentials }),
    rds: new RDSClient({ region, credentials }),
    sts: new STSClient({ region, credentials }),
    cloudwatch: new CloudWatchClient({ region, credentials }),
    logs: new CloudWatchLogsClient({ region, credentials })
  };
}

async function verifyAWSCredentials() {
  try {
    const clients = getAWSClients();
    if (!clients) {
      return { success: false, error: 'AWS credentials not configured' };
    }

    const command = new GetCallerIdentityCommand({});
    const response = await clients.sts.send(command);

    return {
      success: true,
      account: response.Account,
      arn: response.Arn,
      userId: response.UserId
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getEC2Instances(serviceName) {
  try {
    const clients = getAWSClients();
    if (!clients) return [];

    const command = new DescribeInstancesCommand({
      Filters: [
        {
          Name: 'tag:Project',
          Values: [serviceName]
        },
        {
          Name: 'instance-state-name',
          Values: ['running', 'pending', 'stopping', 'stopped']
        }
      ]
    });

    const response = await clients.ec2.send(command);
    const instances = [];

    for (const reservation of response.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        instances.push(instance);
      }
    }

    return instances;
  } catch (error) {
    console.error(chalk.gray(`Failed to fetch EC2 instances: ${error.message}`));
    return [];
  }
}

async function getRDSInstances(serviceName) {
  try {
    const clients = getAWSClients();
    if (!clients) return [];

    const command = new DescribeDBInstancesCommand({});
    const response = await clients.rds.send(command);

    // Filter by tags
    const instances = (response.DBInstances || []).filter(db => {
      return db.DBInstanceIdentifier && db.DBInstanceIdentifier.includes(serviceName);
    });

    return instances;
  } catch (error) {
    console.error(chalk.gray(`Failed to fetch RDS instances: ${error.message}`));
    return [];
  }
}

// ============================================================================
// Terraform Helper Functions
// ============================================================================

async function checkTerraformInstalled() {
  try {
    await execPromise('terraform version');
    return true;
  } catch (error) {
    return false;
  }
}

async function runTerraform(command, workingDir, options = {}) {
  return new Promise((resolve, reject) => {
    const args = command.split(' ');
    const terraformProcess = spawn('terraform', args, {
      cwd: workingDir,
      stdio: options.silent ? 'pipe' : 'inherit',
      env: {
        ...process.env,
        TF_IN_AUTOMATION: 'true',
        TF_INPUT: 'false'
      }
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      terraformProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      terraformProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    terraformProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject(new Error(`Terraform command failed with code ${code}\n${stderr}`));
      }
    });

    terraformProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function getTerraformOutputs(workingDir) {
  try {
    const { stdout } = await execPromise('terraform output -json', { cwd: workingDir });
    return JSON.parse(stdout);
  } catch (error) {
    return {};
  }
}

function generateTerraformVars(serviceName, environment, customVars = {}) {
  const region = config.get('aws.region');

  return {
    project_name: serviceName,
    environment: environment,
    aws_region: region,
    ...customVars
  };
}

async function writeTerraformVarsFile(workingDir, vars) {
  const varFileContent = Object.entries(vars)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key} = "${value}"`;
      } else if (typeof value === 'boolean') {
        return `${key} = ${value}`;
      } else if (typeof value === 'number') {
        return `${key} = ${value}`;
      }
      return `${key} = "${value}"`;
    })
    .join('\n');

  const varFilePath = path.join(workingDir, 'terraform.tfvars');
  await fs.writeFile(varFilePath, varFileContent);
  return varFilePath;
}

// ============================================================================
// Cost Estimation Functions
// ============================================================================

function estimateMonthlyCost(instanceType, dbInstanceClass, environment) {
  // Free tier limits (first 12 months)
  const freeTier = {
    ec2Hours: 750, // t2.micro hours per month
    rdsHours: 750, // db.t3.micro hours per month
    storage: 30, // GB (20 RDS + 30 EBS, combined limit)
    dataTransfer: 15 // GB per month
  };

  // Pricing (us-east-1, approximate)
  const pricing = {
    ec2: {
      't2.micro': 0.0116,
      't2.small': 0.023,
      't2.medium': 0.0464,
      't3.micro': 0.0104,
      't3.small': 0.0208
    },
    rds: {
      'db.t3.micro': 0.017,
      'db.t3.small': 0.034,
      'db.t4g.micro': 0.016,
      'db.t4g.small': 0.032
    },
    storage: 0.10, // per GB per month (EBS gp3)
    rdsStorage: 0.115, // per GB per month (RDS)
    dataTransfer: 0.09 // per GB after 1GB free
  };

  const hoursPerMonth = 730;
  const storageGB = 20;
  const rdsStorageGB = 20;
  const dataTransferGB = 1;

  // Calculate EC2 cost
  const ec2HourlyCost = pricing.ec2[instanceType] || pricing.ec2['t2.micro'];
  const ec2Cost = ec2HourlyCost * hoursPerMonth;

  // Calculate RDS cost
  const rdsHourlyCost = pricing.rds[dbInstanceClass] || pricing.rds['db.t3.micro'];
  const rdsComputeCost = rdsHourlyCost * hoursPerMonth;
  const rdsStorageCost = pricing.rdsStorage * rdsStorageGB;

  // Calculate storage cost
  const ebsStorageCost = pricing.storage * storageGB;

  // Calculate data transfer
  const dataTransferCost = Math.max(0, dataTransferGB - 1) * pricing.dataTransfer;

  // CloudWatch (basic metrics are free, but include estimate for custom)
  const cloudwatchCost = 3.00;

  const totalWithoutFreeTier = ec2Cost + rdsComputeCost + rdsStorageCost + ebsStorageCost + dataTransferCost + cloudwatchCost;

  // With free tier (assuming eligible)
  const withFreeTier = 0; // Free tier covers t2.micro + db.t3.micro + 30GB storage

  return {
    breakdown: {
      ec2: { hourly: ec2HourlyCost, monthly: ec2Cost },
      rds: { hourly: rdsHourlyCost, compute: rdsComputeCost, storage: rdsStorageCost },
      storage: ebsStorageCost,
      dataTransfer: dataTransferCost,
      cloudwatch: cloudwatchCost
    },
    withFreeTier: withFreeTier,
    withoutFreeTier: totalWithoutFreeTier
  };
}

// ============================================================================
// GitHub Helper Functions
// ============================================================================

function getOctokit() {
  const token = config.get('github.token');
  if (!token) {
    return null;
  }
  return new Octokit({ auth: token });
}

async function verifyGitHubToken(token) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { success: true, user: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createGitHubRepository(serviceName, options = {}) {
  const spinner = ora('Creating GitHub repository...').start();

  try {
    const octokit = getOctokit();
    if (!octokit) {
      spinner.fail(chalk.red('Not authenticated with GitHub'));
      console.log(chalk.yellow('\nRun: platform github login'));
      return null;
    }

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: serviceName,
      description: options.description || `Generated by platform-toolkit`,
      private: options.visibility === 'private',
      auto_init: false
    });

    spinner.succeed(chalk.green('Repository created on GitHub'));
    return data;
  } catch (error) {
    if (error.status === 422) {
      spinner.fail(chalk.red(`Repository "${serviceName}" already exists on GitHub`));

      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExisting',
          message: 'Use existing repository?',
          default: true
        }
      ]);

      if (answers.useExisting) {
        try {
          const username = config.get('github.username');
          const { data } = await octokit.repos.get({
            owner: username,
            repo: serviceName
          });
          return data;
        } catch (err) {
          console.error(chalk.red(`Error: ${err.message}`));
          return null;
        }
      }
      return null;
    } else if (error.status === 401) {
      spinner.fail(chalk.red('GitHub authentication failed'));
      console.log(chalk.yellow('\nYour token may have expired.'));
      console.log(chalk.cyan('To fix:'));
      console.log('  1. Create new token: https://github.com/settings/tokens');
      console.log('  2. Run: platform github login');
      return null;
    } else {
      spinner.fail(chalk.red('Failed to create repository'));
      console.error(chalk.red(`Error: ${error.message}`));
      return null;
    }
  }
}

async function pushToGitHub(targetPath, repoUrl, serviceName) {
  const spinner = ora('Pushing to GitHub...').start();

  try {
    const git = simpleGit(targetPath);

    // Check if git is initialized
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      spinner.text = 'Initializing git repository...';
      await git.init();
      await git.add('.');
      await git.commit(`Initial commit: ${serviceName}`);
    }

    // Add remote
    spinner.text = 'Adding remote origin...';
    try {
      await git.addRemote('origin', repoUrl);
    } catch (error) {
      // Remote might already exist
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // Rename to main branch
    spinner.text = 'Renaming branch to main...';
    try {
      await git.branch(['-M', 'main']);
    } catch (error) {
      // Branch might already be main
    }

    // Push to GitHub
    spinner.text = 'Pushing to GitHub...';
    await git.push(['-u', 'origin', 'main']);

    spinner.succeed(chalk.green('Code pushed to GitHub'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to push to GitHub'));
    console.error(chalk.red(`Error: ${error.message}`));
    return false;
  }
}

// ============================================================================
// Git Helper Functions
// ============================================================================

async function initGit(targetPath, serviceName) {
  try {
    const git = simpleGit(targetPath);
    await git.init();
    await git.add('.');
    await git.commit(`Initial commit: ${serviceName}`);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Interactive Create Flow
// ============================================================================

async function interactiveCreate() {
  console.log(chalk.cyan.bold('\n🛠️  Platform Engineering Toolkit\n'));

  const questions = [
    {
      type: 'list',
      name: 'type',
      message: 'Select template:',
      choices: [
        {
          name: `${templates.api.emoji} api           - ${templates.api.description}`,
          value: 'api'
        },
        {
          name: `${templates.microservices.emoji} microservices - ${templates.microservices.description}`,
          value: 'microservices'
        }
      ]
    },
    {
      type: 'input',
      name: 'name',
      message: 'Service name:',
      validate: validateServiceName
    }
  ];

  // Check if GitHub is configured
  const hasGitHubToken = config.get('github.token');

  if (hasGitHubToken) {
    questions.push({
      type: 'confirm',
      name: 'createGitHub',
      message: 'Create GitHub repository?',
      default: false
    });
  } else {
    questions.push({
      type: 'confirm',
      name: 'initGit',
      message: 'Initialize git repository?',
      default: true
    });
  }

  const answers = await inquirer.prompt(questions);

  // Additional GitHub questions if creating repository
  if (answers.createGitHub) {
    const githubQuestions = await inquirer.prompt([
      {
        type: 'list',
        name: 'visibility',
        message: 'Repository visibility:',
        choices: [
          { name: 'Public', value: 'public' },
          { name: 'Private', value: 'private' }
        ],
        default: config.get('github.defaultVisibility')
      },
      {
        type: 'input',
        name: 'description',
        message: 'Repository description:',
        default: templates[answers.type].description
      }
    ]);

    return { ...answers, ...githubQuestions };
  }

  return answers;
}

// ============================================================================
// Create Service Function
// ============================================================================

async function createService(type, name, options = {}) {
  const spinner = ora('Creating service...').start();

  try {
    const template = templates[type];
    if (!template) {
      spinner.fail(chalk.red(`Invalid type. Use: ${Object.keys(templates).join(', ')}`));
      process.exit(1);
    }

    const templatePath = path.join(__dirname, '../templates', template.path);
    const targetPath = path.join(process.cwd(), name);

    // Validate target path
    if (fs.existsSync(targetPath)) {
      spinner.fail(chalk.red(`Directory "${name}" already exists!`));
      process.exit(1);
    }

    // Copy template
    spinner.text = 'Copying template files...';
    await fs.copy(templatePath, targetPath);

    spinner.succeed(chalk.green('Service files created'));

    let repoUrl = null;
    let gitInitialized = false;

    // GitHub integration
    if (options.github || options.createGitHub) {
      // Initialize git first
      spinner.start('Initializing git repository...');
      const gitSuccess = await initGit(targetPath, name);
      if (!gitSuccess) {
        spinner.warn(chalk.yellow('Git initialization failed'));
        return;
      }
      spinner.succeed(chalk.green('Git repository initialized'));
      gitInitialized = true;

      // Create GitHub repository
      const repo = await createGitHubRepository(name, {
        description: options.description,
        visibility: options.visibility || 'public'
      });

      if (repo) {
        repoUrl = repo.html_url;

        // Push to GitHub
        const pushSuccess = await pushToGitHub(targetPath, repo.clone_url, name);

        if (!pushSuccess) {
          console.log(chalk.yellow('\nRepository created but push failed.'));
          console.log(chalk.cyan('To push manually:'));
          console.log(chalk.gray(`  cd ${name}`));
          console.log(chalk.gray(`  git remote add origin ${repo.clone_url}`));
          console.log(chalk.gray(`  git push -u origin main`));
        }
      }
    } else if (options.initGit) {
      // Just initialize git without GitHub
      spinner.start('Initializing git repository...');
      const gitSuccess = await initGit(targetPath, name);
      if (gitSuccess) {
        spinner.succeed(chalk.green('Git repository initialized'));
        gitInitialized = true;
      } else {
        spinner.warn(chalk.yellow('Git initialization failed (continuing anyway)'));
      }
    }

    // Success output
    console.log(chalk.green.bold('\n✅ Success!\n'));

    console.log(chalk.cyan('📦 Local: ') + chalk.gray(targetPath));
    if (repoUrl) {
      console.log(chalk.cyan('🔗 GitHub:') + chalk.gray(` ${repoUrl}`));
    }

    if (gitInitialized || repoUrl) {
      console.log(chalk.cyan('\nGit:'));
      if (gitInitialized) {
        console.log(chalk.gray('  ✔ Repository initialized'));
        console.log(chalk.gray('  ✔ Initial commit created'));
      }
      if (repoUrl) {
        console.log(chalk.gray('  ✔ Pushed to main branch'));
      }
    }

    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray(`  cd ${name}`));
    console.log(chalk.gray(`  npm install`));
    console.log(chalk.gray(`  npm run dev`));

    if (repoUrl) {
      console.log(chalk.cyan('\nView on GitHub:'));
      console.log(chalk.gray(`  platform github open`));
    }
    console.log();

  } catch (error) {
    spinner.fail(chalk.red('Failed to create service'));
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ============================================================================
// CLI Commands
// ============================================================================

program
  .name('platform')
  .description('Platform Engineering Toolkit CLI')
  .version('1.0.0');

// Create command
program
  .command('create [type] [name]')
  .description('Create service from template (api or microservices)')
  .option('-g, --github', 'Create GitHub repository')
  .option('-p, --private', 'Make repository private (requires --github)')
  .option('-d, --description <desc>', 'Repository description')
  .action(async (type, name, cmdOptions) => {
    // Interactive mode if no arguments provided
    if (!type || !name) {
      const answers = await interactiveCreate();
      await createService(answers.type, answers.name, answers);
    } else {
      // Validate service name
      const validation = validateServiceName(name);
      if (validation !== true) {
        console.error(chalk.red(`Error: ${validation}`));
        process.exit(1);
      }

      // Build options
      const options = {
        initGit: true,
        github: cmdOptions.github,
        visibility: cmdOptions.private ? 'private' : 'public',
        description: cmdOptions.description
      };

      await createService(type, name, options);
    }
  });

// List command
program
  .command('list')
  .description('List available templates')
  .action(() => {
    console.log(chalk.cyan.bold('\nAvailable Templates:\n'));

    Object.entries(templates).forEach(([key, template]) => {
      console.log(chalk.green.bold(`${template.emoji} ${key}`));
      console.log(chalk.white(`   ${template.description}`));
      console.log(chalk.gray(`   Features: ${template.features.slice(0, 2).join(', ')}`));
      console.log(chalk.gray(`   Deployment: Docker Compose, Kubernetes ready`));
      console.log();
    });

    console.log(chalk.cyan('Use: platform create <template> <name>'));
    console.log(chalk.cyan('  Or: platform create (interactive)\n'));
  });

// Info command
program
  .command('info <type>')
  .description('Show detailed information about a template')
  .action((type) => {
    const template = templates[type];

    if (!template) {
      console.error(chalk.red(`\nError: Template "${type}" not found.`));
      console.log(chalk.cyan(`Available templates: ${Object.keys(templates).join(', ')}\n`));
      process.exit(1);
    }

    console.log(chalk.cyan.bold(`\n${template.emoji} ${template.name}`));
    console.log(chalk.white(`Description: ${template.description}\n`));

    console.log(chalk.green.bold('Tech Stack:'));
    template.techStack.forEach(tech => {
      console.log(chalk.gray(`  • ${tech}`));
    });

    console.log(chalk.green.bold('\nFeatures:'));
    template.features.forEach(feature => {
      console.log(chalk.gray(`  • ${feature}`));
    });

    console.log(chalk.green.bold('\nQuick Start:'));
    console.log(chalk.gray(`  platform create ${type} my-service`));
    console.log(chalk.gray(`  cd my-service`));
    console.log(chalk.gray(`  npm install`));
    console.log(chalk.gray(`  npm run dev\n`));
  });

// ============================================================================
// GitHub Commands
// ============================================================================

const github = program
  .command('github')
  .description('GitHub integration commands');

// GitHub login
github
  .command('login')
  .description('Authenticate with GitHub')
  .action(async () => {
    console.log(chalk.cyan.bold('\n🔐 GitHub Authentication\n'));
    console.log(chalk.gray('Create a token at: https://github.com/settings/tokens'));
    console.log(chalk.gray('Required scopes: repo (all)\n'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter GitHub Personal Access Token:',
        mask: '*',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Token is required';
          }
          return true;
        }
      }
    ]);

    const spinner = ora('Verifying token...').start();
    const result = await verifyGitHubToken(answers.token);

    if (result.success) {
      config.set('github.token', answers.token);
      config.set('github.username', result.user.login);
      config.set('github.email', result.user.email);

      spinner.succeed(chalk.green(`Successfully authenticated as ${result.user.login}`));
      console.log(chalk.gray(`Token saved to: ${config.path}\n`));
    } else {
      spinner.fail(chalk.red('Authentication failed'));
      console.error(chalk.red(`Error: ${result.error}\n`));
      process.exit(1);
    }
  });

// GitHub logout
github
  .command('logout')
  .description('Remove GitHub authentication')
  .action(() => {
    const username = config.get('github.username');
    config.delete('github.token');
    config.delete('github.username');
    config.delete('github.email');

    console.log(chalk.green(`\n✔ Logged out${username ? ` (${username})` : ''}\n`));
  });

// GitHub status
github
  .command('status')
  .description('Show GitHub authentication status')
  .action(async () => {
    const token = config.get('github.token');
    const username = config.get('github.username');

    if (!token) {
      console.log(chalk.yellow('\n⚠️  Not authenticated with GitHub'));
      console.log(chalk.cyan('\nTo authenticate:'));
      console.log(chalk.gray('  platform github login\n'));
      return;
    }

    const spinner = ora('Verifying token...').start();
    const result = await verifyGitHubToken(token);

    if (result.success) {
      spinner.succeed(chalk.green('Authenticated with GitHub\n'));
      console.log(chalk.cyan('User:     ') + chalk.white(result.user.login));
      console.log(chalk.cyan('Email:    ') + chalk.white(result.user.email || 'Not public'));
      console.log(chalk.cyan('Profile:  ') + chalk.white(result.user.html_url));
      console.log(chalk.cyan('Config:   ') + chalk.gray(config.path));
      console.log();
    } else {
      spinner.fail(chalk.red('Token is invalid or expired'));
      console.log(chalk.yellow('\nYour token may have expired.'));
      console.log(chalk.cyan('To fix:'));
      console.log('  1. Create new token: https://github.com/settings/tokens');
      console.log('  2. Run: platform github login\n');
    }
  });

// GitHub open
github
  .command('open')
  .description('Open repository in browser')
  .action(async () => {
    try {
      const git = simpleGit(process.cwd());
      const isRepo = await git.checkIsRepo();

      if (!isRepo) {
        console.error(chalk.red('\nNot a git repository\n'));
        process.exit(1);
      }

      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');

      if (!origin) {
        console.error(chalk.red('\nNo remote origin found\n'));
        process.exit(1);
      }

      // Extract GitHub URL
      let url = origin.refs.fetch;
      if (url.startsWith('git@github.com:')) {
        url = url.replace('git@github.com:', 'https://github.com/');
      }
      url = url.replace(/\.git$/, '');

      console.log(chalk.cyan(`\nOpening: ${url}\n`));
      await open(url);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// GitHub create (for existing service)
github
  .command('create')
  .description('Create GitHub repository for current directory')
  .option('-p, --private', 'Make repository private')
  .option('-d, --description <desc>', 'Repository description')
  .action(async (cmdOptions) => {
    try {
      const serviceName = path.basename(process.cwd());
      const git = simpleGit(process.cwd());
      const isRepo = await git.checkIsRepo();

      if (!isRepo) {
        console.log(chalk.yellow('\nInitializing git repository...\n'));
        await git.init();
        await git.add('.');
        await git.commit('Initial commit');
      }

      const repo = await createGitHubRepository(serviceName, {
        description: cmdOptions.description,
        visibility: cmdOptions.private ? 'private' : 'public'
      });

      if (repo) {
        const pushSuccess = await pushToGitHub(process.cwd(), repo.clone_url, serviceName);

        if (pushSuccess) {
          console.log(chalk.green.bold('\n✅ Success!\n'));
          console.log(chalk.cyan('🔗 GitHub: ') + chalk.gray(repo.html_url));
          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// GitHub push
github
  .command('push')
  .description('Push current changes to GitHub')
  .action(async () => {
    try {
      const git = simpleGit(process.cwd());
      const isRepo = await git.checkIsRepo();

      if (!isRepo) {
        console.error(chalk.red('\nNot a git repository\n'));
        process.exit(1);
      }

      const spinner = ora('Pushing to GitHub...').start();

      await git.add('.');
      await git.commit('Update from platform-toolkit');
      await git.push('origin', 'main');

      spinner.succeed(chalk.green('Pushed to GitHub\n'));
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// ============================================================================
// AWS Commands
// ============================================================================

const aws = program
  .command('aws')
  .description('AWS integration commands');

// AWS configure
aws
  .command('configure')
  .description('Configure AWS credentials')
  .action(async () => {
    console.log(chalk.cyan.bold('\n☁️  AWS Configuration\n'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'accessKeyId',
        message: 'AWS Access Key ID:',
        mask: '*',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Access Key ID is required';
          }
          if (!input.startsWith('AKIA')) {
            return 'Access Key ID should start with AKIA';
          }
          return true;
        }
      },
      {
        type: 'password',
        name: 'secretAccessKey',
        message: 'AWS Secret Access Key:',
        mask: '*',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Secret Access Key is required';
          }
          if (input.length < 20) {
            return 'Secret Access Key seems too short';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'region',
        message: 'Default Region:',
        default: 'us-east-1',
        validate: (input) => {
          if (!/^[a-z]{2}-[a-z]+-[0-9]{1}$/.test(input)) {
            return 'Invalid region format (e.g., us-east-1)';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm configuration?',
        default: true
      }
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('\nConfiguration cancelled\n'));
      return;
    }

    // Save credentials temporarily
    config.set('aws.accessKeyId', answers.accessKeyId);
    config.set('aws.secretAccessKey', answers.secretAccessKey);
    config.set('aws.region', answers.region);

    // Verify credentials
    const spinner = ora('Verifying credentials...').start();
    const result = await verifyAWSCredentials();

    if (result.success) {
      config.set('aws.accountId', result.account);
      spinner.succeed(chalk.green('AWS credentials saved'));

      console.log(chalk.cyan('\nConnection verified:'));
      console.log(chalk.gray(`  Account ID: ${result.account}`));
      console.log(chalk.gray(`  Region: ${answers.region}`));
      console.log(chalk.gray(`  Config: ${config.path}\n`));
    } else {
      // Remove invalid credentials
      config.delete('aws.accessKeyId');
      config.delete('aws.secretAccessKey');
      config.delete('aws.accountId');

      spinner.fail(chalk.red('Credential verification failed'));
      console.error(chalk.red(`Error: ${result.error}`));
      console.log(chalk.yellow('\nPlease check your credentials and try again.'));
      console.log(chalk.cyan('Create credentials at: https://console.aws.amazon.com/iam/\n'));
      process.exit(1);
    }
  });

// AWS status
aws
  .command('status')
  .description('Check AWS connection and account info')
  .action(async () => {
    const accessKeyId = config.get('aws.accessKeyId');
    const region = config.get('aws.region');

    if (!accessKeyId) {
      console.log(chalk.yellow('\n⚠️  AWS credentials not configured'));
      console.log(chalk.cyan('\nTo configure:'));
      console.log(chalk.gray('  platform aws configure\n'));
      return;
    }

    const spinner = ora('Checking AWS connection...').start();
    const result = await verifyAWSCredentials();

    if (result.success) {
      spinner.succeed(chalk.green('Connected to AWS\n'));

      console.log(chalk.cyan('Account:  ') + chalk.white(result.account));
      console.log(chalk.cyan('Region:   ') + chalk.white(region));
      console.log(chalk.cyan('User ARN: ') + chalk.gray(result.arn));
      console.log(chalk.cyan('Config:   ') + chalk.gray(config.path));
      console.log();
    } else {
      spinner.fail(chalk.red('Connection failed'));
      console.error(chalk.red(`Error: ${result.error}`));
      console.log(chalk.yellow('\nYour credentials may be invalid or expired.'));
      console.log(chalk.cyan('To reconfigure:'));
      console.log(chalk.gray('  platform aws configure\n'));
    }
  });

// AWS costs
aws
  .command('costs')
  .description('View estimated AWS costs')
  .action(async () => {
    const accessKeyId = config.get('aws.accessKeyId');

    if (!accessKeyId) {
      console.log(chalk.yellow('\n⚠️  AWS credentials not configured'));
      console.log(chalk.cyan('Run: platform aws configure\n'));
      return;
    }

    console.log(chalk.cyan.bold('\n💰 AWS Cost Estimation\n'));

    // Get all deployments
    const deployments = deploymentsConfig.store;
    const deploymentKeys = Object.keys(deployments);

    if (deploymentKeys.length === 0) {
      console.log(chalk.yellow('No active deployments found.'));
      console.log(chalk.cyan('\nDeploy a service first:'));
      console.log(chalk.gray('  platform deploy aws my-service\n'));
      return;
    }

    let totalWithFreeTier = 0;
    let totalWithoutFreeTier = 0;

    console.log(chalk.white('Active Deployments:\n'));

    for (const serviceName of deploymentKeys) {
      const deployment = deployments[serviceName];
      const estimate = estimateMonthlyCost(
        deployment.instanceType || 't2.micro',
        deployment.dbInstanceClass || 'db.t3.micro',
        deployment.environment
      );

      console.log(chalk.green.bold(`${serviceName} (${deployment.environment})`));
      console.log(chalk.gray(`  EC2: ${deployment.instanceType || 't2.micro'} - $${estimate.breakdown.ec2.monthly.toFixed(2)}/mo`));
      console.log(chalk.gray(`  RDS: ${deployment.dbInstanceClass || 'db.t3.micro'} - $${estimate.breakdown.rds.compute.toFixed(2)}/mo`));
      console.log(chalk.gray(`  Storage: $${(estimate.breakdown.storage + estimate.breakdown.rds.storage).toFixed(2)}/mo`));
      console.log();

      totalWithFreeTier += estimate.withFreeTier;
      totalWithoutFreeTier += estimate.withoutFreeTier;
    }

    console.log(chalk.cyan('Total Monthly Cost:'));
    console.log(chalk.green(`  With Free Tier:    $${totalWithFreeTier.toFixed(2)}/mo`));
    console.log(chalk.white(`  Without Free Tier: $${totalWithoutFreeTier.toFixed(2)}/mo`));
    console.log();

    console.log(chalk.gray('Note: Costs are estimates. Check AWS Console for actual usage.'));
    console.log(chalk.gray('Free tier expires 12 months after AWS account creation.\n'));
  });

// ============================================================================
// Deploy Commands
// ============================================================================

const deploy = program
  .command('deploy')
  .description('Deployment management commands');

// Deploy to AWS
deploy
  .command('aws <service>')
  .description('Deploy service to AWS')
  .option('-e, --env <environment>', 'Environment (development, staging, production)', 'development')
  .option('-y, --yes', 'Skip confirmations')
  .option('--db-password <password>', 'Database password (min 8 characters)')
  .action(async (service, cmdOptions) => {
    // Check AWS credentials
    const accessKeyId = config.get('aws.accessKeyId');
    if (!accessKeyId) {
      console.log(chalk.red('\n❌ AWS credentials not configured'));
      console.log(chalk.cyan('Run: platform aws configure\n'));
      process.exit(1);
    }

    // Check Terraform
    const hasTerraform = await checkTerraformInstalled();
    if (!hasTerraform) {
      console.log(chalk.red('\n❌ Terraform not found'));
      console.log(chalk.cyan('\nInstall Terraform:'));
      console.log(chalk.gray('  macOS:  brew install terraform'));
      console.log(chalk.gray('  Linux:  https://terraform.io/downloads'));
      console.log(chalk.gray('  Windows: choco install terraform\n'));
      process.exit(1);
    }

    // Find service directory
    const servicePath = path.join(process.cwd(), service);
    const terraformDir = path.join(servicePath, 'infrastructure', 'terraform');

    if (!fs.existsSync(terraformDir)) {
      console.log(chalk.red(`\n❌ Terraform configuration not found`));
      console.log(chalk.gray(`Expected: ${terraformDir}\n`));
      process.exit(1);
    }

    console.log(chalk.cyan.bold(`\n☁️  Deploying ${service} to AWS\n`));

    const environment = cmdOptions.env;

    // Get DB password
    let dbPassword = cmdOptions.dbPassword;
    if (!dbPassword) {
      const { password } = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'Database password (min 8 characters):',
          mask: '*',
          validate: (input) => {
            if (input.length < 8) {
              return 'Password must be at least 8 characters';
            }
            return true;
          }
        }
      ]);
      dbPassword = password;
    }

    // Instance sizing based on environment
    const instanceConfig = {
      development: { ec2: 't2.micro', rds: 'db.t3.micro' },
      staging: { ec2: 't2.small', rds: 'db.t3.small' },
      production: { ec2: 't3.medium', rds: 'db.t3.small' }
    };

    const config_env = instanceConfig[environment] || instanceConfig.development;

    // Show cost estimate
    const estimate = estimateMonthlyCost(config_env.ec2, config_env.rds, environment);

    console.log(chalk.cyan('Configuration:'));
    console.log(chalk.gray(`  Environment: ${environment}`));
    console.log(chalk.gray(`  EC2: ${config_env.ec2}`));
    console.log(chalk.gray(`  RDS: ${config_env.rds}`));
    console.log(chalk.gray(`  Region: ${config.get('aws.region')}\n`));

    console.log(chalk.cyan('Estimated Monthly Cost:'));
    console.log(chalk.green(`  With Free Tier:    $${estimate.withFreeTier.toFixed(2)}/mo`));
    console.log(chalk.white(`  Without Free Tier: $${estimate.withoutFreeTier.toFixed(2)}/mo\n`));

    // Confirm deployment
    if (!cmdOptions.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Proceed with deployment?',
          default: true
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\nDeployment cancelled\n'));
        return;
      }
    }

    try {
      // Generate terraform vars
      const tfVars = generateTerraformVars(service, environment, {
        ec2_instance_type: config_env.ec2,
        rds_instance_class: config_env.rds,
        db_password: dbPassword
      });

      await writeTerraformVarsFile(terraformDir, tfVars);

      // Terraform init
      let spinner = ora('Initializing Terraform...').start();
      await runTerraform('init', terraformDir);
      spinner.succeed(chalk.green('Terraform initialized'));

      // Terraform plan
      spinner = ora('Planning infrastructure...').start();
      await runTerraform('plan', terraformDir);
      spinner.succeed(chalk.green('Infrastructure plan complete'));

      // Terraform apply
      spinner = ora('Deploying infrastructure (this may take 10-15 minutes)...').start();
      await runTerraform('apply -auto-approve', terraformDir);
      spinner.succeed(chalk.green('Infrastructure deployed'));

      // Get outputs
      spinner = ora('Retrieving deployment information...').start();
      const outputs = await getTerraformOutputs(terraformDir);
      spinner.succeed(chalk.green('Deployment complete!'));

      // Save deployment state
      deploymentsConfig.set(service, {
        service,
        environment,
        region: config.get('aws.region'),
        deployedAt: new Date().toISOString(),
        deployedBy: config.get('github.username') || 'local',
        status: 'running',
        instanceType: config_env.ec2,
        dbInstanceClass: config_env.rds,
        outputs: outputs
      });

      // Display results
      console.log(chalk.green.bold('\n✅ Deployment Complete!\n'));

      if (outputs.ec2_public_ip && outputs.ec2_public_ip.value) {
        console.log(chalk.cyan('Application URL:'));
        console.log(chalk.white(`  http://${outputs.ec2_public_ip.value}:3000\n`));
      }

      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray(`  platform deploy status ${service}`));
      console.log(chalk.gray(`  platform deploy logs ${service}`));
      console.log(chalk.gray(`  platform deploy destroy ${service} (when done)\n`));

    } catch (error) {
      console.error(chalk.red(`\n❌ Deployment failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Deployment status
deploy
  .command('status <service>')
  .description('Check deployment status')
  .action(async (service) => {
    const deployment = deploymentsConfig.get(service);

    if (!deployment) {
      console.log(chalk.yellow(`\n⚠️  No deployment found for "${service}"\n`));
      return;
    }

    console.log(chalk.cyan.bold(`\n📊 Deployment Status: ${service}\n`));

    const spinner = ora('Fetching resource status...').start();

    try {
      // Get EC2 instances
      const ec2Instances = await getEC2Instances(service);
      const rdsInstances = await getRDSInstances(service);

      spinner.stop();

      console.log(chalk.cyan('Deployment Info:'));
      console.log(chalk.gray(`  Environment: ${deployment.environment}`));
      console.log(chalk.gray(`  Region: ${deployment.region}`));
      console.log(chalk.gray(`  Deployed: ${new Date(deployment.deployedAt).toLocaleString()}`));
      console.log(chalk.gray(`  Deployed By: ${deployment.deployedBy}\n`));

      console.log(chalk.cyan('Infrastructure:'));

      if (ec2Instances.length > 0) {
        const instance = ec2Instances[0];
        const state = instance.State.Name;
        const stateIcon = state === 'running' ? '✅' : '⚠️';
        console.log(chalk.gray(`  ${stateIcon} EC2: ${instance.InstanceId} (${instance.InstanceType}, ${state})`));
        if (instance.PublicIpAddress) {
          console.log(chalk.gray(`     URL: http://${instance.PublicIpAddress}:3000`));
        }
      }

      if (rdsInstances.length > 0) {
        const db = rdsInstances[0];
        const statusIcon = db.DBInstanceStatus === 'available' ? '✅' : '⚠️';
        console.log(chalk.gray(`  ${statusIcon} RDS: ${db.DBInstanceIdentifier} (${db.DBInstanceClass}, ${db.DBInstanceStatus})`));
      }

      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch status'));
      console.error(chalk.gray(error.message + '\n'));
    }
  });

// Deployment logs
deploy
  .command('logs <service>')
  .description('View deployment logs')
  .option('-f, --follow', 'Follow log output (streams live logs)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (service, cmdOptions) => {
    const deployment = deploymentsConfig.get(service);

    if (!deployment) {
      console.log(chalk.yellow(`\n⚠️  No deployment found for "${service}"\n`));
      return;
    }

    const logGroupName = `/aws/ec2/${service}`;

    console.log(chalk.cyan(`\n📋 Logs for ${service}\n`));

    try {
      const clients = getAWSClients();
      if (!clients) {
        console.log(chalk.red('AWS credentials not configured\n'));
        return;
      }

      // Get log streams
      const streamsCommand = new DescribeLogStreamsCommand({
        logGroupName: logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 1
      });

      const streams = await clients.logs.send(streamsCommand);

      if (!streams.logStreams || streams.logStreams.length === 0) {
        console.log(chalk.yellow('No logs available yet.'));
        console.log(chalk.gray('Logs may take a few minutes to appear after deployment.\n'));
        return;
      }

      const logStreamName = streams.logStreams[0].logStreamName;

      // Get log events
      const eventsCommand = new FilterLogEventsCommand({
        logGroupName: logGroupName,
        logStreamNames: [logStreamName],
        limit: parseInt(cmdOptions.lines)
      });

      const events = await clients.logs.send(eventsCommand);

      if (events.events && events.events.length > 0) {
        events.events.forEach(event => {
          const timestamp = new Date(event.timestamp).toLocaleTimeString();
          console.log(chalk.gray(`[${timestamp}] `) + event.message);
        });
      } else {
        console.log(chalk.yellow('No log events found\n'));
      }

      console.log();

      if (cmdOptions.follow) {
        console.log(chalk.cyan('Following logs... (Ctrl+C to stop)\n'));
        // In a real implementation, you'd set up a loop to poll for new logs
        console.log(chalk.yellow('Note: Live log streaming requires additional implementation\n'));
      }

    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(chalk.yellow('Log group not found.'));
        console.log(chalk.gray('CloudWatch logs may not be configured for this service.\n'));
      } else {
        console.error(chalk.red(`Error: ${error.message}\n`));
      }
    }
  });

// Destroy deployment
deploy
  .command('destroy <service>')
  .description('Destroy AWS resources for a service')
  .action(async (service) => {
    const deployment = deploymentsConfig.get(service);

    if (!deployment) {
      console.log(chalk.yellow(`\n⚠️  No deployment found for "${service}"\n`));
      return;
    }

    const servicePath = path.join(process.cwd(), service);
    const terraformDir = path.join(servicePath, 'infrastructure', 'terraform');

    if (!fs.existsSync(terraformDir)) {
      console.log(chalk.red(`\n❌ Terraform configuration not found at ${terraformDir}\n`));
      return;
    }

    console.log(chalk.red.bold('\n⚠️  WARNING: Resource Destruction\n'));
    console.log(chalk.yellow(`This will permanently delete all AWS resources for "${service}":`));
    console.log(chalk.gray(`  • EC2 instances`));
    console.log(chalk.gray(`  • RDS database (DATA WILL BE LOST)`));
    console.log(chalk.gray(`  • VPC and networking`));
    console.log(chalk.gray(`  • Security groups\n`));

    // Confirm with service name
    const { confirmName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmName',
        message: 'Type service name to confirm:',
        validate: (input) => {
          if (input !== service) {
            return `Please type "${service}" to confirm`;
          }
          return true;
        }
      }
    ]);

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'finalConfirm',
        message: 'Are you absolutely sure?',
        default: false
      }
    ]);

    if (!finalConfirm) {
      console.log(chalk.yellow('\nDestruction cancelled\n'));
      return;
    }

    try {
      const spinner = ora('Destroying resources...').start();

      await runTerraform('destroy -auto-approve', terraformDir);

      spinner.succeed(chalk.green('All resources destroyed'));

      // Remove from deployment state
      deploymentsConfig.delete(service);

      console.log(chalk.green.bold('\n✅ Cleanup Complete\n'));

      const estimate = estimateMonthlyCost(
        deployment.instanceType || 't2.micro',
        deployment.dbInstanceClass || 'db.t3.micro',
        deployment.environment
      );

      console.log(chalk.cyan('Estimated monthly savings:'));
      console.log(chalk.gray(`  $${estimate.withoutFreeTier.toFixed(2)}/mo\n`));

    } catch (error) {
      console.error(chalk.red(`\n❌ Destruction failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Cost estimate
deploy
  .command('estimate <service>')
  .description('Estimate deployment costs')
  .option('-e, --env <environment>', 'Environment', 'development')
  .action(async (service, cmdOptions) => {
    const environment = cmdOptions.env;

    const instanceConfig = {
      development: { ec2: 't2.micro', rds: 'db.t3.micro' },
      staging: { ec2: 't2.small', rds: 'db.t3.small' },
      production: { ec2: 't3.medium', rds: 'db.t3.small' }
    };

    const config_env = instanceConfig[environment] || instanceConfig.development;
    const estimate = estimateMonthlyCost(config_env.ec2, config_env.rds, environment);

    console.log(chalk.cyan.bold(`\n📊 Cost Estimate for ${service} (${environment})\n`));

    console.log(chalk.white('Monthly Costs:'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.gray('Service         Type           Free Tier    After'));
    console.log(chalk.gray('━'.repeat(60)));

    console.log(chalk.gray(`EC2             ${config_env.ec2.padEnd(15)} $0/mo        $${estimate.breakdown.ec2.monthly.toFixed(2)}/mo`));
    console.log(chalk.gray(`RDS             ${config_env.rds.padEnd(15)} $0/mo        $${estimate.breakdown.rds.compute.toFixed(2)}/mo`));
    console.log(chalk.gray(`Storage         40GB EBS       $0/mo        $${(estimate.breakdown.storage + estimate.breakdown.rds.storage).toFixed(2)}/mo`));
    console.log(chalk.gray(`CloudWatch      Basic          $0/mo        $${estimate.breakdown.cloudwatch.toFixed(2)}/mo`));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.green.bold(`Total                          $${estimate.withFreeTier.toFixed(2)}/mo        $${estimate.withoutFreeTier.toFixed(2)}/mo`));
    console.log(chalk.gray('━'.repeat(60)));

    console.log(chalk.cyan('\nFree Tier Notes:'));
    console.log(chalk.gray('  • 750 hours/month EC2 t2.micro (first 12 months)'));
    console.log(chalk.gray('  • 750 hours/month RDS db.t3.micro (first 12 months)'));
    console.log(chalk.gray('  • 30 GB storage (combined EBS + RDS)'));
    console.log(chalk.gray('  • Expires 12 months after AWS account creation\n'));
  });

program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
