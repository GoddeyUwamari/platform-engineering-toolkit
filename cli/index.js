#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .name('platform')
  .description('Platform Engineering Toolkit CLI')
  .version('1.0.0');

program
  .command('create <type> <name>')
  .description('Create service from template (api or microservices)')
  .action(async (type, name) => {
    const spinner = ora('Creating service...').start();

    try {
      const templateMap = {
        'api': 'node-api-template',
        'microservices': 'microservices-template'
      };

      if (!templateMap[type]) {
        spinner.fail(chalk.red(`Invalid type. Use: api or microservices`));
        process.exit(1);
      }

      const templatePath = path.join(__dirname, '../templates', templateMap[type]);
      const targetPath = path.join(process.cwd(), name);

      if (fs.existsSync(targetPath)) {
        spinner.fail(chalk.red(`Directory ${name} already exists!`));
        process.exit(1);
      }

      await fs.copy(templatePath, targetPath);

      spinner.succeed(chalk.green(`✅ Created ${name}!`));
      console.log(chalk.cyan('\nNext steps:'));
      console.log(`  cd ${name}`);
      console.log(`  npm install`);
      console.log(`  npm run dev\n`);
    } catch (error) {
      spinner.fail(chalk.red('Failed'));
      console.error(error);
    }
  });

program
  .command('list')
  .description('List templates')
  .action(() => {
    console.log(chalk.cyan('\nTemplates:'));
    console.log('  api          - Node.js/TypeScript API');
    console.log('  microservices - CloudBill architecture\n');
  });

program.parse(process.argv);
