#!/usr/bin/env node

/**
 * Generate API Extension
 * 
 * This script generates a custom API extension based on a template.
 * It is used to create new API extensions for the FractaLedger system.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Templates
const templates = {
  'basic': {
    name: 'Basic API Extension',
    description: 'A basic API extension template with a single endpoint',
    file: 'basic-extension-template.js'
  },
  'merchant-fee': {
    name: 'Merchant Fee API Extension',
    description: 'API extension for merchant fee collection',
    file: 'merchant-fee-extension.js'
  },
  'employee-payroll': {
    name: 'Employee Payroll API Extension',
    description: 'API extension for employee payroll management',
    file: 'employee-payroll-extension.js'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  type: null,
  output: null,
  name: null,
  help: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg === '--type' || arg === '-t') {
    options.type = args[++i];
  } else if (arg === '--output' || arg === '-o') {
    options.output = args[++i];
  } else if (arg === '--name' || arg === '-n') {
    options.name = args[++i];
  }
}

// Show help
if (options.help) {
  console.log('Usage: generate-api-extension [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show help');
  console.log('  --type, -t     Extension type (basic, merchant-fee, employee-payroll)');
  console.log('  --output, -o   Output directory');
  console.log('  --name, -n     Extension name (e.g., my-custom-extension)');
  console.log('');
  console.log('Available extension types:');
  
  for (const [type, info] of Object.entries(templates)) {
    console.log(`  ${type}: ${info.name} - ${info.description}`);
  }
  
  process.exit(0);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for extension type
function askType() {
  return new Promise((resolve) => {
    if (options.type) {
      if (!templates[options.type]) {
        console.error(`Error: Invalid extension type '${options.type}'`);
        console.log('Available types:');
        
        for (const [type, info] of Object.entries(templates)) {
          console.log(`  ${type}: ${info.name} - ${info.description}`);
        }
        
        process.exit(1);
      }
      
      resolve(options.type);
      return;
    }
    
    console.log('Available extension types:');
    
    for (const [type, info] of Object.entries(templates)) {
      console.log(`  ${type}: ${info.name} - ${info.description}`);
    }
    
    rl.question('Enter extension type: ', (answer) => {
      if (!templates[answer]) {
        console.error(`Error: Invalid extension type '${answer}'`);
        process.exit(1);
      }
      
      resolve(answer);
    });
  });
}

// Ask for output directory
function askOutput() {
  return new Promise((resolve) => {
    if (options.output) {
      resolve(options.output);
      return;
    }
    
    rl.question('Enter output directory (default: ./): ', (answer) => {
      resolve(answer || './');
    });
  });
}

// Ask for extension name
function askName() {
  return new Promise((resolve) => {
    if (options.name) {
      resolve(options.name);
      return;
    }
    
    rl.question('Enter extension name (e.g., my-custom-extension): ', (answer) => {
      if (!answer) {
        console.error('Error: Extension name is required');
        process.exit(1);
      }
      
      resolve(answer);
    });
  });
}

// Generate the extension
async function generateExtension() {
  try {
    // Get extension type, output directory, and name
    const type = await askType();
    const output = await askOutput();
    const name = await askName();
    
    // Close readline interface
    rl.close();
    
    // Get template file path
    const templateFile = path.join(__dirname, '..', 'api-extensions', templates[type].file);
    
    // Check if template file exists
    if (!fs.existsSync(templateFile)) {
      console.error(`Error: Template file '${templateFile}' not found`);
      process.exit(1);
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true });
    }
    
    // Generate output file path
    const outputFile = path.join(output, `${name}.js`);
    
    // Check if output file already exists
    if (fs.existsSync(outputFile)) {
      console.error(`Error: Output file '${outputFile}' already exists`);
      process.exit(1);
    }
    
    // Read template file
    const template = fs.readFileSync(templateFile, 'utf8');
    
    // Generate extension content
    const extensionName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    const extensionContent = template
      .replace(/Merchant Fee/g, extensionName)
      .replace(/merchant fee/g, name.replace(/-/g, ' '))
      .replace(/registerMerchantFeeExtension/g, `register${extensionName}Extension`)
      .replace(/merchant-fee/g, name);
    
    // Write extension file
    fs.writeFileSync(outputFile, extensionContent);
    
    console.log(`API extension generated successfully: ${outputFile}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
generateExtension();
