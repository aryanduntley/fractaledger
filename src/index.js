/**
 * FractaLedger - Main Entry Point
 * 
 * This file initializes and starts the FractaLedger system.
 */

const { loadConfig } = require('./config/configLoader');
const { initializeBlockchainConnectors } = require('./blockchain/connectorManager');
const { initializeWalletManager } = require('./wallet/walletManager');
const { initializeHyperledger } = require('./hyperledger/fabricManager');
const { initializeChaincodeManager } = require('./chaincode/chaincodeManager');
const { startApiServer } = require('./api/server');

/**
 * Main function to initialize and start the FractaLedger system
 */
async function main() {
  try {
    console.log('Starting FractaLedger...');
    
    // Load configuration
    console.log('Loading configuration...');
    const config = await loadConfig();
    
    // Initialize blockchain connectors
    console.log('Initializing blockchain connectors...');
    const blockchainConnectors = await initializeBlockchainConnectors(config);
    
    // Initialize wallet manager
    console.log('Initializing wallet manager...');
    const walletManager = await initializeWalletManager(config, blockchainConnectors);
    
    // Initialize Hyperledger Fabric
    console.log('Initializing Hyperledger Fabric...');
    const fabricClient = await initializeHyperledger(config);
    
    // Initialize chaincode manager
    console.log('Initializing chaincode manager...');
    const chaincodeManager = await initializeChaincodeManager(config, fabricClient);
    
    // Start API server
    console.log('Starting API server...');
    await startApiServer(config, blockchainConnectors, walletManager, fabricClient, chaincodeManager);
    
    console.log('FractaLedger started successfully!');
    console.log(`API server running at http://${config.api.host}:${config.api.port}`);
  } catch (error) {
    console.error('Failed to start FractaLedger:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main };
