#!/usr/bin/env node

/**
 * Generate Configuration Script
 * 
 * This script generates a configuration file based on the template.
 * It copies the template configuration to the specified output path
 * and customizes it based on the user's input.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
let output = './fractaledger.json';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && i + 1 < args.length) {
    output = args[i + 1];
    i++;
  }
}

// Create the readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Determine source and destination paths
const sourceFile = path.resolve(__dirname, '../fractaledger-template.json');
const destinationFile = path.resolve(process.cwd(), output);

// Check if source file exists
if (!fs.existsSync(sourceFile)) {
  console.error(`Error: Template file not found: ${sourceFile}`);
  process.exit(1);
}

// Check if destination file already exists
if (fs.existsSync(destinationFile)) {
  console.error(`Error: Destination file already exists: ${destinationFile}`);
  console.error('Please specify a different output path or remove the existing file.');
  process.exit(1);
}

// Read the source file
let content;
try {
  content = fs.readFileSync(sourceFile, 'utf8');
} catch (error) {
  console.error(`Error reading template file: ${error.message}`);
  process.exit(1);
}

// Parse the template
let config;
try {
  config = JSON.parse(content);
} catch (error) {
  console.error(`Error parsing template file: ${error.message}`);
  process.exit(1);
}

// Function to prompt for configuration values
async function promptForConfig() {
  return new Promise((resolve) => {
    console.log('\nFractaLedger Configuration Generator');
    console.log('==================================');
    console.log('This tool will help you create a configuration file for FractaLedger.');
    console.log('Press Enter to accept the default values or provide your own.\n');

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(destinationFile);
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
      } catch (error) {
        console.error(`Error creating output directory: ${error.message}`);
        process.exit(1);
      }
    }

    // Prompt for API configuration
    rl.question('API Port [3000]: ', (port) => {
      if (port) {
        config.api.port = parseInt(port, 10);
      }

      rl.question('API Host [localhost]: ', (host) => {
        if (host) {
          config.api.host = host;
        }

        // Prompt for logging configuration
        rl.question('Logging Level [info]: ', (level) => {
          if (level && ['error', 'warn', 'info', 'debug'].includes(level)) {
            config.logging.level = level;
          }

          rl.question('Logs Directory [./logs]: ', (logsDir) => {
            if (logsDir) {
              config.logging.file = `${logsDir}/fractaledger.log`;
            }

            // Prompt for smart contract configuration
            rl.question('Smart Contract Directory [./fractaledger/chaincode]: ', (chaincodeDir) => {
              if (chaincodeDir) {
                config.smartContract.customizablePath = chaincodeDir;
              }

              // Prompt for environment configuration
              rl.question('Environment File Path [./.env]: ', (envPath) => {
                if (envPath) {
                  config.environment.envFilePath = envPath;
                }

                // Write the configuration file
                try {
                  fs.writeFileSync(destinationFile, JSON.stringify(config, null, 2));
                  console.log(`\nSuccessfully created configuration file at: ${destinationFile}`);
                  
                  // Print usage instructions
                  console.log('\nUsage Instructions:');
                  console.log('1. Update the configuration with your specific blockchain details');
                  console.log('2. Create your custom transceiver implementations using:');
                  console.log('   npx fractaledger-generate-transceiver --type bitcoin --output ./my-transceivers');
                  console.log('3. Update the configuration to point to your custom transceiver implementations');
                  console.log('4. Create a .env file with your secrets');
                  console.log('5. Start using FractaLedger!');
                  
                  rl.close();
                  resolve();
                } catch (error) {
                  console.error(`Error writing configuration file: ${error.message}`);
                  rl.close();
                  process.exit(1);
                }
              });
            });
          });
        });
      });
    });
  });
}

// Run the configuration prompt
promptForConfig().then(() => {
  process.exit(0);
});
