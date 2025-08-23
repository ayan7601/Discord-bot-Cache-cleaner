#!/usr/bin/env node

/**
 * Discord Command Cleaner
 * A utility to list and delete Discord slash commands from the cache memory.

 */

// Importing required dependencies
require('dotenv').config();
const inquirer = require('inquirer');
const chalk = require('chalk');
const readline = require('readline');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

/**
 * Discord API utility for managing slash commands
 */
class DiscordAPI {
  /**
   * Initialize Discord API client
   * @param {string} token - Discord bot token
   */
  constructor(token) {
    this.token = token;
    this.rest = new REST({ version: '10' }).setToken(token);
    this.applicationId = null;
    this.rateLimitMetrics = {
      rateLimit: 0,
      rateLimitReset: 0,
      rateLimitRemaining: 0,
      lastRequested: new Date()
    };
  }

  /**
   * Handle rate limits with visual progress bar
   * @param {Error} error - Error from REST API
   * @returns {Promise<boolean>} True if rate limited and handled, false otherwise
   */
  async handleRateLimit(error) {
    if (!error?.rawError?.message?.includes('You are being rate limited')) {
      return false;
    }

    // Extract rate limit info
    const retryAfter = error.rawError.retry_after || 5;
    const currentTime = new Date();
    
    // Update metrics
    this.rateLimitMetrics.rateLimit++;
    this.rateLimitMetrics.rateLimitReset = retryAfter;
    this.rateLimitMetrics.lastRequested = currentTime;

    // Show visual indicator for rate limit
    console.log(chalk.yellow(`\n⚠️  Rate limited by Discord API. Waiting ${retryAfter} seconds...`));
    
    // Display progress bar
    const barWidth = 30;
    for (let i = 0; i < barWidth; i++) {
      const progress = i / barWidth;
      const waitTime = Math.floor(progress * retryAfter * 1000);
      
      // Create progress bar
      const filled = '█'.repeat(i);
      const empty = '░'.repeat(barWidth - i);
      const percent = Math.floor(progress * 100);
      
      // Update the progress bar in place
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `${chalk.blue('[' + filled + empty + ']')} ${chalk.green(percent + '%')} ${chalk.cyan(`(${i}/${barWidth})`)}`
      );
      
      await this.sleep(waitTime / barWidth);
    }
    
    // Complete progress bar
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${chalk.blue('[' + '█'.repeat(barWidth) + ']')} ${chalk.green('100%')} ${chalk.cyan(`Completed!`)}\n`
    );
    
    return true;
  }

  /**
   * Sleep helper function
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the application ID (bot user ID)
   * @returns {Promise<string>} The application ID
   */
  async getApplicationId() {
    if (this.applicationId) return this.applicationId;

    try {
      const response = await this.rest.get(Routes.user('@me'));
      this.applicationId = response.id;
      return this.applicationId;
    } catch (error) {
      // Check if this is a rate limit error
      if (await this.handleRateLimit(error)) {
        // Retry after rate limit
        return this.getApplicationId();
      }
      
      // Visual error display with details
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to get application ID`));
      console.error(chalk.yellow('  └─ Status: ') + chalk.red(error.status || 'Unknown'));
      console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
      
      throw new Error(`Failed to get application ID: ${error.message}`);
    }
  }

  /**
   * Get all global commands for the bot
   * @returns {Promise<Array>} List of command objects
   */
  async getGlobalCommands() {
    try {
      const applicationId = await this.getApplicationId();
      const commands = await this.rest.get(
        Routes.applicationCommands(applicationId)
      );
      // Success visualization
      console.log(chalk.green(`✓ Successfully retrieved ${commands.length} global commands`));
      return commands;
    } catch (error) {
      // Check if this is a rate limit error
      if (await this.handleRateLimit(error)) {
        // Retry after rate limit
        return this.getGlobalCommands();
      }
      
      // Visual error display with details
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to get global commands`));
      console.error(chalk.yellow('  └─ Status: ') + chalk.red(error.status || 'Unknown'));
      console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
      console.error(chalk.yellow('  └─ Action: ') + chalk.cyan('GET global commands'));
      
      throw new Error(`Failed to get global commands: ${error.message}`);
    }
  }

  /**
   * Delete a global command by its ID
   * @param {string} commandId - The ID of the command to delete
   * @returns {Promise<boolean>} True if successful, False otherwise
   */
  async deleteGlobalCommand(commandId) {
    try {
      const applicationId = await this.getApplicationId();
      await this.rest.delete(
        Routes.applicationCommand(applicationId, commandId)
      );
      
      // Success visualization
      console.log(chalk.green(`✓ Successfully deleted global command with ID ${commandId}`));
      return true;
    } catch (error) {
      // Check if this is a rate limit error
      if (await this.handleRateLimit(error)) {
        // Retry after rate limit
        return this.deleteGlobalCommand(commandId);
      }
      
      // Visual error display with details
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to delete global command`));
      console.error(chalk.yellow('  └─ Command ID: ') + chalk.cyan(commandId));
      console.error(chalk.yellow('  └─ Status: ') + chalk.red(error.status || 'Unknown'));
      console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
      
      return false;
    }
  }

  /**
   * Get all guild commands for a specific guild
   * @param {string} guildId - The ID of the guild
   * @returns {Promise<Array>} List of command objects
   */
  async getGuildCommands(guildId) {
    try {
      const applicationId = await this.getApplicationId();
      const commands = await this.rest.get(
        Routes.applicationGuildCommands(applicationId, guildId)
      );
      
      // Success visualization
      console.log(chalk.green(`✓ Successfully retrieved ${commands.length} commands for Guild ID ${guildId}`));
      return commands;
    } catch (error) {
      // Check if this is a rate limit error
      if (await this.handleRateLimit(error)) {
        // Retry after rate limit
        return this.getGuildCommands(guildId);
      }
      
      // Visual error display with details
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to get guild commands`));
      console.error(chalk.yellow('  └─ Guild ID: ') + chalk.cyan(guildId));
      console.error(chalk.yellow('  └─ Status: ') + chalk.red(error.status || 'Unknown'));
      console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
      console.error(chalk.yellow('  └─ Action: ') + chalk.cyan(`GET guild commands for guild ${guildId}`));
      
      throw new Error(`Failed to get guild commands: ${error.message}`);
    }
  }

  /**
   * Delete a guild command by its ID
   * @param {string} guildId - The ID of the guild
   * @param {string} commandId - The ID of the command to delete
   * @returns {Promise<boolean>} True if successful, False otherwise
   */
  async deleteGuildCommand(guildId, commandId) {
    try {
      const applicationId = await this.getApplicationId();
      await this.rest.delete(
        Routes.applicationGuildCommand(applicationId, guildId, commandId)
      );
      
      // Success visualization
      console.log(chalk.green(`✓ Successfully deleted guild command with ID ${commandId}`));
      return true;
    } catch (error) {
      // Check if this is a rate limit error
      if (await this.handleRateLimit(error)) {
        // Retry after rate limit
        return this.deleteGuildCommand(guildId, commandId);
      }
      
      // Visual error display with details
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to delete guild command`));
      console.error(chalk.yellow('  └─ Guild ID: ') + chalk.cyan(guildId));
      console.error(chalk.yellow('  └─ Command ID: ') + chalk.cyan(commandId));
      console.error(chalk.yellow('  └─ Status: ') + chalk.red(error.status || 'Unknown'));
      console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
      
      return false;
    }
  }
}

/**
 * Clear the terminal screen based on the operating system
 */
function clearScreen() {
  process.stdout.write('\x1Bc');
}

/**
 * Print the application banner
 */
function printBanner() {
  const banner = [
    chalk.blue('  ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗ '),
    chalk.blue('  ██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗'),
    chalk.blue('  ██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║'),
    chalk.blue('  ██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║'),
    chalk.blue('  ██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝'),
    chalk.blue('  ╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ '),
    chalk.green('   ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ '),
    chalk.green('  ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗'),
    chalk.green('  ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║'),
    chalk.green('  ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║'),
    chalk.green('  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝'),
    chalk.green('   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ '),
    chalk.red('   ██████╗██╗     ███████╗ █████╗ ███╗   ██╗███████╗██████╗ '),
    chalk.red('  ██╔════╝██║     ██╔════╝██╔══██╗████╗  ██║██╔════╝██╔══██╗'),
    chalk.red('  ██║     ██║     █████╗  ███████║██╔██╗ ██║█████╗  ██████╔╝'),
    chalk.red('  ██║     ██║     ██╔══╝  ██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗'),
    chalk.red('  ╚██████╗███████╗███████╗██║  ██║██║ ╚████║███████╗██║  ██║'),
    chalk.red('   ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝'),
    chalk.white('  A tool to manage Discord slash commands')
  ];

  console.log(banner.join('\n'));
}

/**
 * List all global commands for the bot
 * @param {DiscordAPI} discordClient - The Discord API client
 */
async function listGlobalCommands(discordClient) {
  clearScreen();
  console.log(chalk.bgCyan.black(' GLOBAL COMMANDS ') + '\n');

  try {
    // Start loading spinner
    const loadingMsg = 'Fetching global commands... ';
    process.stdout.write(chalk.yellow(loadingMsg) + chalk.cyan('⟳'));
    
    const commands = await discordClient.getGlobalCommands();
    
    // Clear loading spinner
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    
    if (commands.length === 0) {
      console.log(chalk.yellow('⚠️  No global commands found.'));
      console.log(chalk.gray('└─ Your bot has no global slash commands registered.'));
    } else {
      console.log(chalk.green(`✅ Found ${commands.length} global commands:`));
      
      // Create a formatted table
      console.log();
      console.log(chalk.cyan('  # │ ') + chalk.cyan('NAME') + ' '.repeat(15) + chalk.cyan('│ COMMAND ID'));
      console.log(chalk.cyan('────┼──────────────────────┼─────────────────────'));
      
      commands.forEach((cmd, i) => {
        const index = chalk.white(`${i + 1}`.padStart(3));
        const name = chalk.green(cmd.name.padEnd(20));
        const id = chalk.blue(cmd.id);
        console.log(`  ${index} │ ${name} │ ${id}`);
        
        // If command has a description, show it indented
        if (cmd.description) {
          console.log(`     │ ${chalk.gray('└─ ' + cmd.description.slice(0, 50) + (cmd.description.length > 50 ? '...' : ''))} │`);
        }
      });
      console.log();
    }
  } catch (error) {
    console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to list global commands:`));
    console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
  }

  await promptContinue();
}

/**
 * Delete all global commands for the bot
 * @param {DiscordAPI} discordClient - The Discord API client
 */
async function deleteGlobalCommands(discordClient) {
  clearScreen();
  console.log(chalk.bgRed.white(' DELETE GLOBAL COMMANDS ') + '\n');

  try {
    // Start loading spinner
    process.stdout.write(chalk.yellow('Fetching global commands... ') + chalk.cyan('⟳'));
    
    const commands = await discordClient.getGlobalCommands();
    
    // Clear loading spinner
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    
    if (commands.length === 0) {
      console.log(chalk.yellow('⚠️  No global commands found to delete.'));
      console.log(chalk.gray('└─ Your bot has no global slash commands registered.'));
      await promptContinue();
      return;
    }
    
    console.log(chalk.green(`✅ Found ${commands.length} global commands:`));
    
    // Create a formatted table
    console.log();
    console.log(chalk.cyan('  # │ ') + chalk.cyan('NAME') + ' '.repeat(15) + chalk.cyan('│ COMMAND ID'));
    console.log(chalk.cyan('────┼──────────────────────┼─────────────────────'));
    
    commands.forEach((cmd, i) => {
      const index = chalk.white(`${i + 1}`.padStart(3));
      const name = chalk.green(cmd.name.padEnd(20));
      const id = chalk.blue(cmd.id);
      console.log(`  ${index} │ ${name} │ ${id}`);
      
      // If command has a description, show it indented
      if (cmd.description) {
        console.log(`     │ ${chalk.gray('└─ ' + cmd.description.slice(0, 50) + (cmd.description.length > 50 ? '...' : ''))} │`);
      }
    });
    console.log();
    
    // Warning visualization
    console.log(chalk.bgYellow.black(' WARNING ') + ' ' + chalk.yellow('Deleting commands is irreversible'));
    console.log(chalk.gray('└─ All slash commands will be removed from your bot'));
    console.log(chalk.gray('└─ This will affect all users and servers immediately'));
    console.log();
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('⚠️  Are you sure you want to delete ALL global commands?'),
        default: false
      }
    ]);
    
    if (confirm) {
      console.log();
      console.log(chalk.yellow('Starting command deletion...'));
      
      let deletedCount = 0;
      const totalCommands = commands.length;
      
      for (const [index, cmd] of commands.entries()) {
        // Show progress
        const progress = Math.round(((index) / totalCommands) * 100);
        process.stdout.write(chalk.yellow(`Deleting command ${index + 1}/${totalCommands} (${progress}%)... `));
        
        const success = await discordClient.deleteGlobalCommand(cmd.id);
        
        // Clear the line
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        
        if (success) {
          deletedCount++;
          console.log(chalk.green(`✓ Successfully deleted command: ${chalk.white(cmd.name)} (${deletedCount}/${totalCommands})`));
        } else {
          console.log(chalk.red(`✗ Failed to delete command: ${chalk.white(cmd.name)} (${index + 1}/${totalCommands})`));
        }
      }
      
      // Final summary with visual indicator
      console.log();
      if (deletedCount === totalCommands) {
        console.log(chalk.bgGreen.black(' SUCCESS ') + ' ' + chalk.green(`Deleted all ${deletedCount} global commands.`));
      } else if (deletedCount > 0) {
        console.log(chalk.bgYellow.black(' PARTIAL ') + ' ' + chalk.yellow(`Deleted ${deletedCount}/${totalCommands} global commands.`));
        console.log(chalk.gray(`└─ ${totalCommands - deletedCount} commands failed to delete.`));
      } else {
        console.log(chalk.bgRed.white(' FAILED ') + ' ' + chalk.red(`Failed to delete any global commands.`));
      }
    } else {
      console.log(chalk.yellow('⚠️  Operation cancelled.'));
    }
  } catch (error) {
    console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to delete global commands:`));
    console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
  }
  
  await promptContinue();
}

/**
 * List all guild commands for the bot
 * @param {DiscordAPI} discordClient - The Discord API client
 */
async function listGuildCommands(discordClient) {
  clearScreen();
  console.log(chalk.bgCyan.black(' GUILD COMMANDS ') + '\n');

  try {
    console.log(chalk.yellow('To list guild commands, you need to provide the Guild ID of your Discord server.'));
    console.log(chalk.gray('└─ You can find the Guild ID by enabling Developer Mode in Discord, then right-clicking on your server.'));
    console.log();
    
    const { guildId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'guildId',
        message: 'Enter Guild ID:',
        validate: input => /^\d+$/.test(input) || 'Please enter a valid Guild ID (numbers only)'
      }
    ]);

    // Start loading spinner
    process.stdout.write('\n' + chalk.yellow(`Fetching commands for Guild ID ${guildId}... `) + chalk.cyan('⟳'));
    
    const commands = await discordClient.getGuildCommands(guildId);
    
    // Clear loading spinner
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    
    if (commands.length === 0) {
      console.log(chalk.yellow(`⚠️  No commands found for Guild ID ${guildId}.`));
      console.log(chalk.gray('└─ This guild has no slash commands registered for your bot.'));
    } else {
      console.log(chalk.green(`✅ Found ${commands.length} commands for Guild ID ${guildId}:`));
      
      // Create a formatted table
      console.log();
      console.log(chalk.cyan('  # │ ') + chalk.cyan('NAME') + ' '.repeat(15) + chalk.cyan('│ COMMAND ID'));
      console.log(chalk.cyan('────┼──────────────────────┼─────────────────────'));
      
      commands.forEach((cmd, i) => {
        const index = chalk.white(`${i + 1}`.padStart(3));
        const name = chalk.green(cmd.name.padEnd(20));
        const id = chalk.blue(cmd.id);
        console.log(`  ${index} │ ${name} │ ${id}`);
        
        // If command has a description, show it indented
        if (cmd.description) {
          console.log(`     │ ${chalk.gray('└─ ' + cmd.description.slice(0, 50) + (cmd.description.length > 50 ? '...' : ''))} │`);
        }
      });
      console.log();
      
      // Show guild info
      console.log(chalk.bgBlue.white(' GUILD INFO ') + ` Commands belong to Guild ID: ${chalk.cyan(guildId)}`);
    }
  } catch (error) {
    console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to list guild commands:`));
    console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
    if (error.message.includes('Unknown Guild')) {
      console.error(chalk.yellow('  └─ Cause: ') + chalk.red('The Guild ID you provided does not exist or the bot does not have access to it.'));
      console.error(chalk.yellow('  └─ Fix: ') + chalk.white('Make sure the Guild ID is correct and the bot is a member of the guild.'));
    }
  }

  await promptContinue();
}

/**
 * Delete all guild commands for the bot
 * @param {DiscordAPI} discordClient - The Discord API client
 */
async function deleteGuildCommands(discordClient) {
  clearScreen();
  console.log(chalk.bgRed.white(' DELETE GUILD COMMANDS ') + '\n');

  try {
    console.log(chalk.yellow('To delete guild commands, you need to provide the Guild ID of your Discord server.'));
    console.log(chalk.gray('└─ You can find the Guild ID by enabling Developer Mode in Discord, then right-clicking on your server.'));
    console.log();
    
    const { guildId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'guildId',
        message: 'Enter Guild ID:',
        validate: input => /^\d+$/.test(input) || 'Please enter a valid Guild ID (numbers only)'
      }
    ]);

    // Start loading spinner
    process.stdout.write('\n' + chalk.yellow(`Fetching commands for Guild ID ${guildId}... `) + chalk.cyan('⟳'));
    
    const commands = await discordClient.getGuildCommands(guildId);
    
    // Clear loading spinner
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    
    if (commands.length === 0) {
      console.log(chalk.yellow(`⚠️  No commands found for Guild ID ${guildId}.`));
      console.log(chalk.gray('└─ This guild has no slash commands registered for your bot.'));
      await promptContinue();
      return;
    }
    
    console.log(chalk.green(`✅ Found ${commands.length} commands for Guild ID ${guildId}:`));
    
    // Create a formatted table
    console.log();
    console.log(chalk.cyan('  # │ ') + chalk.cyan('NAME') + ' '.repeat(15) + chalk.cyan('│ COMMAND ID'));
    console.log(chalk.cyan('────┼──────────────────────┼─────────────────────'));
    
    commands.forEach((cmd, i) => {
      const index = chalk.white(`${i + 1}`.padStart(3));
      const name = chalk.green(cmd.name.padEnd(20));
      const id = chalk.blue(cmd.id);
      console.log(`  ${index} │ ${name} │ ${id}`);
      
      // If command has a description, show it indented
      if (cmd.description) {
        console.log(`     │ ${chalk.gray('└─ ' + cmd.description.slice(0, 50) + (cmd.description.length > 50 ? '...' : ''))} │`);
      }
    });
    console.log();
    
    // Warning visualization
    console.log(chalk.bgYellow.black(' WARNING ') + ' ' + chalk.yellow('Deleting commands is irreversible'));
    console.log(chalk.gray('└─ Guild commands will be removed from this specific server'));
    console.log(chalk.gray('└─ This will affect all users in this server immediately'));
    console.log();
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`⚠️  Are you sure you want to delete ALL commands for Guild ID ${guildId}?`),
        default: false
      }
    ]);
    
    if (confirm) {
      console.log();
      console.log(chalk.yellow('Starting command deletion...'));
      
      let deletedCount = 0;
      const totalCommands = commands.length;
      
      for (const [index, cmd] of commands.entries()) {
        // Show progress
        const progress = Math.round(((index) / totalCommands) * 100);
        process.stdout.write(chalk.yellow(`Deleting command ${index + 1}/${totalCommands} (${progress}%)... `));
        
        const success = await discordClient.deleteGuildCommand(guildId, cmd.id);
        
        // Clear the line
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        
        if (success) {
          deletedCount++;
          console.log(chalk.green(`✓ Successfully deleted command: ${chalk.white(cmd.name)} (${deletedCount}/${totalCommands})`));
        } else {
          console.log(chalk.red(`✗ Failed to delete command: ${chalk.white(cmd.name)} (${index + 1}/${totalCommands})`));
        }
      }
      
      // Final summary with visual indicator
      console.log();
      if (deletedCount === totalCommands) {
        console.log(chalk.bgGreen.black(' SUCCESS ') + ' ' + chalk.green(`Deleted all ${deletedCount} guild commands.`));
      } else if (deletedCount > 0) {
        console.log(chalk.bgYellow.black(' PARTIAL ') + ' ' + chalk.yellow(`Deleted ${deletedCount}/${totalCommands} guild commands.`));
        console.log(chalk.gray(`└─ ${totalCommands - deletedCount} commands failed to delete.`));
      } else {
        console.log(chalk.bgRed.white(' FAILED ') + ' ' + chalk.red(`Failed to delete any guild commands.`));
      }
    } else {
      console.log(chalk.yellow('⚠️  Operation cancelled.'));
    }
  } catch (error) {
    console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`Failed to delete guild commands:`));
    console.error(chalk.yellow('  └─ Message: ') + chalk.red(error.message));
    if (error.message.includes('Unknown Guild')) {
      console.error(chalk.yellow('  └─ Cause: ') + chalk.red('The Guild ID you provided does not exist or the bot does not have access to it.'));
      console.error(chalk.yellow('  └─ Fix: ') + chalk.white('Make sure the Guild ID is correct and the bot is a member of the guild.'));
    }
  }

  await promptContinue();
}

/**
 * Prompt user to continue
 */
async function promptContinue() {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: chalk.yellow('Press Enter to return to the main menu...'),
    }
  ]);
}

/**
 * Main entry point for the application
 */
async function main() {
  // Check for bot token
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error(chalk.red('Error: DISCORD_BOT_TOKEN not found in environment variables.'));
    console.log(chalk.yellow('Please create a .env file with your bot token or set it as an environment variable.'));
    console.log(chalk.gray('Example .env file:'));
    console.log(chalk.gray('DISCORD_BOT_TOKEN=your_bot_token_here'));
    process.exit(1);
  }

  // Initialize Discord API client
  const discordClient = new DiscordAPI(botToken);

  // Main application loop
  while (true) {
    try {
      clearScreen();
      printBanner();

      // Display menu and get user choice
      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Select an option:',
          choices: [
            { name: '1. List Global Commands', value: '1' },
            { name: '2. Delete All Global Commands', value: '2' },
            { name: '3. List Guild Commands', value: '3' },
            { name: '4. Delete All Guild Commands', value: '4' },
            { name: '5. Exit', value: '5' }
          ]
        }
      ]);

      switch (choice) {
        case '1':
          await listGlobalCommands(discordClient);
          break;
        case '2':
          await deleteGlobalCommands(discordClient);
          break;
        case '3':
          await listGuildCommands(discordClient);
          break;
        case '4':
          await deleteGuildCommands(discordClient);
          break;
        case '5':
          console.log(chalk.yellow('Exiting Discord Command Cleaner. Goodbye!'));
          process.exit(0);
          break;
      }
    } catch (error) {
      console.error('\n' + chalk.bgRed.white(' ERROR ') + ' ' + chalk.red(`An unexpected error occurred: ${error.message}`));
      if (error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
      await promptContinue();
    }
  }
}

// Start the application
main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
