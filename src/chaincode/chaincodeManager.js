/**
 * Chaincode Manager
 * 
 * This module manages the chaincode templates and provides functionality for users to customize and deploy them.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Initialize the chaincode manager
 * @param {Object} config The configuration object
 * @param {Object} fabricClient The Fabric client
 * @returns {Object} The chaincode manager
 */
async function initializeChaincodeManager(config, fabricClient) {
  try {
    console.log('Initializing chaincode manager...');
    
    // Create the chaincode manager
    const chaincodeManager = {
      /**
       * Get all available chaincode templates
       * @returns {Array} All available chaincode templates
       */
      getAvailableTemplates: () => {
        const templatesDir = path.resolve(process.cwd(), 'src/chaincode/templates');
        const templates = fs.readdirSync(templatesDir)
          .filter(file => fs.statSync(path.join(templatesDir, file)).isDirectory())
          .map(dir => {
            const packageJsonPath = path.join(templatesDir, dir, 'package.json');
            const readmePath = path.join(templatesDir, dir, 'README.md');
            
            let name = dir;
            let description = '';
            
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              name = packageJson.name || dir;
              description = packageJson.description || '';
            }
            
            let readme = '';
            if (fs.existsSync(readmePath)) {
              readme = fs.readFileSync(readmePath, 'utf8');
            }
            
            return {
              id: dir,
              name,
              description,
              readme
            };
          });
        
        return templates;
      },
      
      /**
       * Create a custom chaincode from a template
       * @param {string} templateId The template ID
       * @param {string} customId The custom chaincode ID
       * @returns {Object} The created custom chaincode
       */
      createCustomChaincode: (templateId, customId) => {
        const templatesDir = path.resolve(process.cwd(), 'src/chaincode/templates');
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        
        // Check if the template exists
        const templateDir = path.join(templatesDir, templateId);
        if (!fs.existsSync(templateDir)) {
          throw new Error(`Template ${templateId} does not exist`);
        }
        
        // Check if the custom chaincode already exists
        const customChaincodeDir = path.join(customDir, customId);
        if (fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} already exists`);
        }
        
        // Create the custom chaincode directory
        fs.mkdirSync(customChaincodeDir, { recursive: true });
        
        // Copy the template files to the custom chaincode directory
        const templateFiles = fs.readdirSync(templateDir);
        for (const file of templateFiles) {
          const templateFilePath = path.join(templateDir, file);
          const customFilePath = path.join(customChaincodeDir, file);
          
          if (fs.statSync(templateFilePath).isDirectory()) {
            // Copy directory recursively
            fs.mkdirSync(customFilePath, { recursive: true });
            const subFiles = fs.readdirSync(templateFilePath);
            for (const subFile of subFiles) {
              const templateSubFilePath = path.join(templateFilePath, subFile);
              const customSubFilePath = path.join(customFilePath, subFile);
              fs.copyFileSync(templateSubFilePath, customSubFilePath);
            }
          } else {
            // Copy file
            fs.copyFileSync(templateFilePath, customFilePath);
          }
        }
        
        // Update the package.json
        const packageJsonPath = path.join(customChaincodeDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          packageJson.name = `fractaledger-custom-${customId}`;
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        }
        
        return {
          id: customId,
          templateId,
          path: customChaincodeDir
        };
      },
      
      /**
       * Get all custom chaincodes
       * @returns {Array} All custom chaincodes
       */
      getCustomChaincodes: () => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        
        // Create the custom chaincode directory if it doesn't exist
        if (!fs.existsSync(customDir)) {
          fs.mkdirSync(customDir, { recursive: true });
          return [];
        }
        
        const customChaincodes = fs.readdirSync(customDir)
          .filter(file => fs.statSync(path.join(customDir, file)).isDirectory())
          .map(dir => {
            const packageJsonPath = path.join(customDir, dir, 'package.json');
            
            let name = dir;
            let description = '';
            
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              name = packageJson.name || dir;
              description = packageJson.description || '';
            }
            
            return {
              id: dir,
              name,
              description,
              path: path.join(customDir, dir)
            };
          });
        
        return customChaincodes;
      },
      
      /**
       * Get a custom chaincode
       * @param {string} customId The custom chaincode ID
       * @returns {Object} The custom chaincode
       */
      getCustomChaincode: (customId) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        const packageJsonPath = path.join(customChaincodeDir, 'package.json');
        
        let name = customId;
        let description = '';
        
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          name = packageJson.name || customId;
          description = packageJson.description || '';
        }
        
        return {
          id: customId,
          name,
          description,
          path: customChaincodeDir
        };
      },
      
      /**
       * Update a custom chaincode
       * @param {string} customId The custom chaincode ID
       * @param {string} filePath The file path to update
       * @param {string} content The new content
       * @returns {Object} The updated custom chaincode
       */
      updateCustomChaincode: (customId, filePath, content) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        // Check if the file exists
        const fullFilePath = path.join(customChaincodeDir, filePath);
        if (!fs.existsSync(fullFilePath)) {
          throw new Error(`File ${filePath} does not exist in custom chaincode ${customId}`);
        }
        
        // Update the file
        fs.writeFileSync(fullFilePath, content);
        
        return {
          id: customId,
          path: customChaincodeDir,
          updatedFile: filePath
        };
      },
      
      /**
       * Delete a custom chaincode
       * @param {string} customId The custom chaincode ID
       * @returns {boolean} True if the custom chaincode was deleted
       */
      deleteCustomChaincode: (customId) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        // Delete the custom chaincode directory
        fs.rmSync(customChaincodeDir, { recursive: true, force: true });
        
        return true;
      },
      
      /**
       * Deploy a custom chaincode
       * @param {string} customId The custom chaincode ID
       * @returns {Promise<Object>} The deployment result
       */
      deployCustomChaincode: async (customId) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        // Deploy the chaincode
        await fabricClient.deployChaincode(customChaincodeDir);
        
        return {
          id: customId,
          status: 'deployed',
          timestamp: new Date().toISOString()
        };
      },
      
      /**
       * Update a deployed chaincode
       * @param {string} customId The custom chaincode ID
       * @returns {Promise<Object>} The update result
       */
      updateDeployedChaincode: async (customId) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        // Update the chaincode
        await fabricClient.updateChaincode(customChaincodeDir);
        
        return {
          id: customId,
          status: 'updated',
          timestamp: new Date().toISOString()
        };
      },
      
      /**
       * Install dependencies for a custom chaincode
       * @param {string} customId The custom chaincode ID
       * @returns {Promise<Object>} The installation result
       */
      installDependencies: async (customId) => {
        const customDir = path.resolve(process.cwd(), config.smartContract.customizablePath);
        const customChaincodeDir = path.join(customDir, customId);
        
        // Check if the custom chaincode exists
        if (!fs.existsSync(customChaincodeDir)) {
          throw new Error(`Custom chaincode ${customId} does not exist`);
        }
        
        // Check if package.json exists
        const packageJsonPath = path.join(customChaincodeDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          throw new Error(`package.json does not exist in custom chaincode ${customId}`);
        }
        
        // Install dependencies
        const { stdout, stderr } = await execPromise('npm install', { cwd: customChaincodeDir });
        
        return {
          id: customId,
          status: 'dependencies installed',
          stdout,
          stderr
        };
      }
    };
    
    return chaincodeManager;
  } catch (error) {
    throw new Error(`Failed to initialize chaincode manager: ${error.message}`);
  }
}

module.exports = {
  initializeChaincodeManager
};
