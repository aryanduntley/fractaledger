#!/usr/bin/env node

/**
 * Initialize FractaLedger Project
 * 
 * This script initializes a new FractaLedger project by creating the necessary
 * directory structure and generating configuration files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
let projectDir = './fractaledger-project';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && i + 1 < args.length) {
    projectDir = args[i + 1];
    i++;
  }
}

// Create project directory if it doesn't exist
const projectPath = path.resolve(process.cwd(), projectDir);
if (!fs.existsSync(projectPath)) {
  try {
    fs.mkdirSync(projectPath, { recursive: true });
    console.log(`Created project directory: ${projectPath}`);
  } catch (error) {
    console.error(`Error creating project directory: ${error.message}`);
    process.exit(1);
  }
}

// Create directory structure
const directories = [
  'my-transceivers',
  'fractaledger/chaincode',
  'logs'
];

for (const dir of directories) {
  const dirPath = path.resolve(projectPath, dir);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error) {
      console.error(`Error creating directory ${dirPath}: ${error.message}`);
      process.exit(1);
    }
  }
}

// Generate configuration file
try {
  console.log('Generating configuration file...');
  const configPath = path.resolve(projectPath, 'fractaledger.json');
  
  // Check if configuration file already exists
  if (fs.existsSync(configPath)) {
    console.log(`Configuration file already exists at: ${configPath}`);
  } else {
    // Run the generate-config script
    execSync(`node ${path.resolve(__dirname, 'generate-config.js')} --output ${configPath}`, {
      stdio: 'inherit'
    });
  }
} catch (error) {
  console.error(`Error generating configuration file: ${error.message}`);
  process.exit(1);
}

// Generate example transceiver files
try {
  console.log('\nGenerating example transceiver files...');
  const transceiversDir = path.resolve(projectPath, 'my-transceivers');
  
  // Generate Bitcoin transceiver
  const bitcoinTransceiverPath = path.resolve(transceiversDir, 'bitcoin-transceiver.js');
  if (fs.existsSync(bitcoinTransceiverPath)) {
    console.log(`Bitcoin transceiver already exists at: ${bitcoinTransceiverPath}`);
  } else {
    execSync(`node ${path.resolve(__dirname, 'generate-transceiver.js')} --type bitcoin --output ${transceiversDir}`, {
      stdio: 'inherit'
    });
  }
  
  // Generate Litecoin transceiver
  const litecoinTransceiverPath = path.resolve(transceiversDir, 'litecoin-transceiver.js');
  if (fs.existsSync(litecoinTransceiverPath)) {
    console.log(`Litecoin transceiver already exists at: ${litecoinTransceiverPath}`);
  } else {
    execSync(`node ${path.resolve(__dirname, 'generate-transceiver.js')} --type litecoin --output ${transceiversDir}`, {
      stdio: 'inherit'
    });
  }
} catch (error) {
  console.error(`Error generating transceiver files: ${error.message}`);
  process.exit(1);
}

// Create .env file
try {
  console.log('\nCreating .env file...');
  const envPath = path.resolve(projectPath, '.env');
  
  // Check if .env file already exists
  if (fs.existsSync(envPath)) {
    console.log(`.env file already exists at: ${envPath}`);
  } else {
    // Create a sample .env file
    const envContent = `# FractaLedger Environment Variables
# This file contains sensitive information and should not be committed to version control

# Bitcoin Wallet Secrets
BTC_WALLET_1_SECRET=your_bitcoin_wallet_private_key_here

# Litecoin Wallet Secrets
LTC_WALLET_1_SECRET=your_litecoin_wallet_private_key_here

# API Keys
BLOCKCYPHER_API_KEY=your_blockcypher_api_key_here

# JWT Secret for API Authentication
JWT_SECRET=your_jwt_secret_here
`;
    fs.writeFileSync(envPath, envContent);
    console.log(`Created .env file at: ${envPath}`);
  }
} catch (error) {
  console.error(`Error creating .env file: ${error.message}`);
  process.exit(1);
}

// Create package.json if it doesn't exist
try {
  console.log('\nCreating package.json file...');
  const packageJsonPath = path.resolve(projectPath, 'package.json');
  
  // Check if package.json already exists
  if (fs.existsSync(packageJsonPath)) {
    console.log(`package.json already exists at: ${packageJsonPath}`);
  } else {
    // Create a sample package.json file
    const packageJsonContent = {
      name: path.basename(projectPath),
      version: '1.0.0',
      description: 'A FractaLedger project',
      main: 'index.js',
      scripts: {
        start: 'node node_modules/fractaledger/src/index.js'
      },
      dependencies: {
        fractaledger: '^1.0.0'
      }
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
    console.log(`Created package.json at: ${packageJsonPath}`);
  }
} catch (error) {
  console.error(`Error creating package.json file: ${error.message}`);
  process.exit(1);
}

// Create README.md if it doesn't exist
try {
  console.log('\nCreating README.md file...');
  const readmePath = path.resolve(projectPath, 'README.md');
  
  // Check if README.md already exists
  if (fs.existsSync(readmePath)) {
    console.log(`README.md already exists at: ${readmePath}`);
  } else {
    // Create a sample README.md file
    const readmeContent = `# ${path.basename(projectPath)}

A FractaLedger project for managing fractional ownership on multiple blockchains.

## Project Structure

- \`fractaledger.json\`: Configuration file for FractaLedger
- \`my-transceivers/\`: Custom transceiver implementations for blockchain interactions
- \`fractaledger/chaincode/\`: Custom smart contract implementations
- \`logs/\`: Log files

## Getting Started

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Update the \`.env\` file with your secrets

3. Update the \`fractaledger.json\` configuration file with your specific blockchain details

4. Start the application:
   \`\`\`
   npm start
   \`\`\`

## Custom Transceivers

This project includes custom transceiver implementations for:

- Bitcoin: \`my-transceivers/bitcoin-transceiver.js\`
- Litecoin: \`my-transceivers/litecoin-transceiver.js\`

You can customize these transceivers to fit your specific blockchain interaction needs.

## Configuration

The \`fractaledger.json\` file contains the configuration for the FractaLedger system. You can update this file to:

- Add or remove blockchain wallets
- Configure API settings
- Set up logging
- Configure smart contracts

## Environment Variables

The \`.env\` file contains sensitive information such as wallet secrets and API keys. Make sure to keep this file secure and never commit it to version control.
`;
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`Created README.md at: ${readmePath}`);
  }
} catch (error) {
  console.error(`Error creating README.md file: ${error.message}`);
  process.exit(1);
}

// Create .gitignore if it doesn't exist
try {
  console.log('\nCreating .gitignore file...');
  const gitignorePath = path.resolve(projectPath, '.gitignore');
  
  // Check if .gitignore already exists
  if (fs.existsSync(gitignorePath)) {
    console.log(`.gitignore already exists at: ${gitignorePath}`);
  } else {
    // Create a sample .gitignore file
    const gitignoreContent = `# Node.js
node_modules/
npm-debug.log
yarn-debug.log
yarn-error.log

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Build output
dist/
build/

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
`;
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log(`Created .gitignore at: ${gitignorePath}`);
  }
} catch (error) {
  console.error(`Error creating .gitignore file: ${error.message}`);
  process.exit(1);
}

console.log('\nFractaLedger project initialization complete!');
console.log(`Project directory: ${projectPath}`);
console.log('\nNext steps:');
console.log('1. cd into your project directory:');
console.log(`   cd ${projectDir}`);
console.log('2. Install dependencies:');
console.log('   npm install');
console.log('3. Update the .env file with your secrets');
console.log('4. Update the fractaledger.json configuration file with your specific blockchain details');
console.log('5. Start the application:');
console.log('   npm start');
