#!/usr/bin/env node

/**
 * Update Paths Script
 * 
 * This script updates paths in the built files to ensure they work correctly
 * when installed from npm. It replaces relative paths with paths that use
 * __dirname to resolve paths relative to the script location.
 */

const fs = require('fs');
const path = require('path');

// Paths to update
const filesToUpdate = [
  'dist/bin/generate-transceiver.js',
  'dist/bin/generate-config.js',
  'dist/bin/init.js'
];

// Function to update paths in a file
function updatePaths(filePath) {
  console.log(`Updating paths in ${filePath}...`);
  
  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update paths
    // Replace '../transceivers/utxo-transceiver-example.js' with path.resolve(__dirname, '../transceivers/utxo-transceiver-example.js')
    content = content.replace(
      /path\.resolve\(__dirname, ['"]\.\.\/transceivers\/utxo-transceiver-example\.js['"]\)/g,
      "path.resolve(__dirname, '../transceivers/utxo-transceiver-example.js')"
    );
    
    // Replace '../fractaledger-template.json' with path.resolve(__dirname, '../fractaledger-template.json')
    content = content.replace(
      /path\.resolve\(__dirname, ['"]\.\.\/fractaledger-template\.json['"]\)/g,
      "path.resolve(__dirname, '../fractaledger-template.json')"
    );
    
    // Replace direct path references
    content = content.replace(
      /['"]\.\.\/transceivers\/utxo-transceiver-example\.js['"]/g,
      "path.resolve(__dirname, '../transceivers/utxo-transceiver-example.js')"
    );
    
    content = content.replace(
      /['"]\.\.\/fractaledger-template\.json['"]/g,
      "path.resolve(__dirname, '../fractaledger-template.json')"
    );
    
    // Update references to other bin scripts
    content = content.replace(
      /['"]\.\.\/bin\/generate-config\.js['"]/g,
      "path.resolve(__dirname, './generate-config.js')"
    );
    
    content = content.replace(
      /['"]\.\.\/bin\/generate-transceiver\.js['"]/g,
      "path.resolve(__dirname, './generate-transceiver.js')"
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated paths in ${filePath}`);
  } catch (error) {
    console.error(`Error updating paths in ${filePath}: ${error.message}`);
    process.exit(1);
  }
}

// Update paths in all files
for (const file of filesToUpdate) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    updatePaths(filePath);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
}

// Create a package.json in the dist directory
const packageJson = require('../package.json');
const distPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: 'src/index.js',
  bin: {
    'fractaledger-init': './bin/init.js',
    'fractaledger-generate-transceiver': './bin/generate-transceiver.js',
    'fractaledger-generate-config': './bin/generate-config.js'
  },
  dependencies: packageJson.dependencies,
  license: packageJson.license
};

fs.writeFileSync(
  path.resolve(process.cwd(), 'dist/package.json'),
  JSON.stringify(distPackageJson, null, 2)
);
console.log('Created package.json in dist directory');

console.log('Path updates completed successfully');
