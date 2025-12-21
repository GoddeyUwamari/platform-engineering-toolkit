#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const program = new Command();

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

// Validation helpers
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

// Initialize git repository
async function initGit(targetPath, serviceName) {
  try {
    execSync('git init', { cwd: targetPath, stdio: 'ignore' });
    execSync('git add .', { cwd: targetPath, stdio: 'ignore' });
    execSync(`git commit -m "Initial commit: ${serviceName}"`, { cwd: targetPath, stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Interactive create flow
async function interactiveCreate() {
  console.log(chalk.cyan.bold('\n🛠️  Platform Engineering Toolkit\n'));

  const answers = await inquirer.prompt([
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
    },
    {
      type: 'confirm',
      name: 'initGit',
      message: 'Initialize git repository?',
      default: true
    }
  ]);

  return answers;
}

// Create service
async function createService(type, name, initGitRepo = false) {
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

    // Initialize git if requested
    if (initGitRepo) {
      spinner.text = 'Initializing git repository...';
      const gitSuccess = await initGit(targetPath, name);
      if (!gitSuccess) {
        spinner.warn(chalk.yellow('Git initialization failed (continuing anyway)'));
      }
    }

    spinner.succeed(chalk.green(`✅ Created ${name}!`));

    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray(`  cd ${name}`));
    console.log(chalk.gray(`  npm install`));
    console.log(chalk.gray(`  npm run dev\n`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create service'));
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// CLI Commands
program
  .name('platform')
  .description('Platform Engineering Toolkit CLI')
  .version('1.0.0');

program
  .command('create [type] [name]')
  .description('Create service from template (api or microservices)')
  .action(async (type, name) => {
    // Interactive mode if no arguments provided
    if (!type || !name) {
      const answers = await interactiveCreate();
      await createService(answers.type, answers.name, answers.initGit);
    } else {
      // Validate service name
      const validation = validateServiceName(name);
      if (validation !== true) {
        console.error(chalk.red(`Error: ${validation}`));
        process.exit(1);
      }

      await createService(type, name);
    }
  });

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

program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
