#!/usr/bin/env node

/**
 * Generate Transceiver Script
 * 
 * This script generates a transceiver file based on the example transceiver.
 * It copies the example transceiver to the specified output directory and
 * customizes it for the specified blockchain.
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let type = 'utxo';
let output = './my-transceivers';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && i + 1 < args.length) {
    type = args[i + 1];
    i++;
  } else if (args[i] === '--output' && i + 1 < args.length) {
    output = args[i + 1];
    i++;
  }
}

// Validate type
const validTypes = ['utxo', 'bitcoin', 'litecoin', 'dogecoin', 'spv'];
if (!validTypes.includes(type)) {
  console.error(`Error: Invalid type '${type}'. Valid types are: ${validTypes.join(', ')}`);
  process.exit(1);
}

// Create output directory if it doesn't exist
const outputDir = path.resolve(process.cwd(), output);
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    process.exit(1);
  }
}

// Determine source and destination paths
let sourceFile;
if (type === 'spv') {
  sourceFile = path.resolve(__dirname, '../transceivers/spv-transceiver.js');
} else {
  sourceFile = path.resolve(__dirname, '../transceivers/utxo-transceiver-example.js');
}
const destinationFile = path.resolve(outputDir, `${type}-transceiver.js`);

// Check if source file exists
if (!fs.existsSync(sourceFile)) {
  console.error(`Error: Source file not found: ${sourceFile}`);
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
  console.error(`Error reading source file: ${error.message}`);
  process.exit(1);
}

// Customize the content based on the type
let customizedContent = content;

// If it's not the SPV transceiver, customize the class name and module export
if (type !== 'spv') {
  // Replace the class name
  customizedContent = customizedContent.replace(
    'class GenericUTXOTransceiver extends UTXOTransceiver',
    `class ${type.charAt(0).toUpperCase() + type.slice(1)}Transceiver extends UTXOTransceiver`
  );

  // Replace the module export
  customizedContent = customizedContent.replace(
    'module.exports = GenericUTXOTransceiver;',
    `module.exports = ${type.charAt(0).toUpperCase() + type.slice(1)}Transceiver;`
  );
}

// Add blockchain-specific customizations for non-SPV transceivers
if (type !== 'spv') {
  if (type === 'bitcoin') {
    customizedContent = customizedContent.replace(
      '// Default configuration',
      '// Bitcoin-specific configuration'
    );
    customizedContent = customizedContent.replace(
      'network: \'mainnet\',',
      'network: \'mainnet\',\n      apiUrl: \'https://blockstream.info/api\','
    );
    customizedContent = customizedContent.replace(
      'Generic UTXO Transceiver initialized',
      'Bitcoin Transceiver initialized'
    );
  } else if (type === 'litecoin') {
    customizedContent = customizedContent.replace(
      '// Default configuration',
      '// Litecoin-specific configuration'
    );
    customizedContent = customizedContent.replace(
      'network: \'mainnet\',',
      'network: \'mainnet\',\n      apiUrl: \'https://ltc.bitaps.com/api/v1/blockchain\','
    );
    customizedContent = customizedContent.replace(
      'Generic UTXO Transceiver initialized',
      'Litecoin Transceiver initialized'
    );
  } else if (type === 'dogecoin') {
    customizedContent = customizedContent.replace(
      '// Default configuration',
      '// Dogecoin-specific configuration'
    );
    customizedContent = customizedContent.replace(
      'network: \'mainnet\',',
      'network: \'mainnet\',\n      apiUrl: \'https://dogechain.info/api/v1\','
    );
    customizedContent = customizedContent.replace(
      'Generic UTXO Transceiver initialized',
      'Dogecoin Transceiver initialized'
    );
  }
}

// Write the customized content to the destination file
try {
  fs.writeFileSync(destinationFile, customizedContent);
  console.log(`Successfully created ${type} transceiver at: ${destinationFile}`);
} catch (error) {
  console.error(`Error writing destination file: ${error.message}`);
  process.exit(1);
}

// Make the file executable
try {
  fs.chmodSync(destinationFile, '755');
} catch (error) {
  console.error(`Warning: Could not make file executable: ${error.message}`);
}

// Print usage instructions
console.log('\nUsage Instructions:');
console.log('1. Customize the transceiver implementation to fit your needs');
console.log('2. Update your fractaledger.json configuration to use this transceiver:');

if (type === 'spv') {
  console.log(`
{
  "bitcoin": [
    {
      "name": "btc_wallet_1",
      "network": "mainnet",
      "walletAddress": "your-wallet-address",
      "secretEnvVar": "YOUR_WALLET_SECRET_ENV_VAR",
      "transceiver": {
        "method": "callback",
        "callbackModule": "./${path.relative(process.cwd(), destinationFile)}",
        "config": {
          "blockchain": "bitcoin",
          "network": "mainnet",
          "server": "electrum.blockstream.info",
          "port": 50002,
          "protocol": "ssl",
          "monitoringInterval": 60000,
          "autoMonitor": true
        }
      }
    }
  ]
}
`);
} else {
  console.log(`
{
  "${type}": [
    {
      "name": "${type}_wallet_1",
      "walletAddress": "your-wallet-address",
      "secretEnvVar": "YOUR_WALLET_SECRET_ENV_VAR",
      "transceiver": {
        "method": "callback",
        "callbackModule": "./${path.relative(process.cwd(), destinationFile)}",
        "config": {
          "apiUrl": "https://api.example.com",
          "monitoringInterval": 60000
        }
      }
    }
  ]
}
`);
}
