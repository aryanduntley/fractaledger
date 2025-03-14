/**
 * FractaLedger - Main Entry Point
 * 
 * This file initializes and starts the FractaLedger system.
 */

const { loadConfig } = require('./config/configLoader');
const { initializeBlockchainConnectors, monitorConnectorHealth, stopHealthMonitoring } = require('./blockchain/connectorManager');
const { initializeWalletManager } = require('./wallet/walletManager');
const { initializeHyperledger } = require('./hyperledger/fabricManager');
const { initializeChaincodeManager } = require('./chaincode/chaincodeManager');
const { initializeBalanceReconciliation } = require('./reconciliation/balanceReconciliation');
const { startApiServer } = require('./api/server');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fractaledger' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

/**
 * Main function to initialize and start the FractaLedger system
 */
async function main() {
  try {
    logger.info('Starting FractaLedger...');
    
    // Create logs directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logger.info('Created logs directory');
    }
    
    // Load configuration
    logger.info('Loading configuration...');
    const config = await loadConfig();
    
    // Initialize Hyperledger Fabric first
    logger.info('Initializing Hyperledger Fabric...');
    const fabricClient = await initializeHyperledger(config);
    
    // Initialize blockchain connectors
    logger.info('Initializing blockchain connectors...');
    const blockchainConnectors = await initializeBlockchainConnectors(config);
    
    // Initialize wallet manager with Fabric client
    logger.info('Initializing wallet manager...');
    const walletManager = await initializeWalletManager(config, blockchainConnectors, fabricClient);
    
    // Initialize chaincode manager
    logger.info('Initializing chaincode manager...');
    const chaincodeManager = await initializeChaincodeManager(config, fabricClient);
    
    // Initialize balance reconciliation module
    logger.info('Initializing balance reconciliation module...');
    const balanceReconciliation = await initializeBalanceReconciliation(config, walletManager, fabricClient);
    
    // Start API server
    logger.info('Starting API server...');
    await startApiServer(config, blockchainConnectors, walletManager, fabricClient, chaincodeManager, balanceReconciliation);
    
    // Start health monitoring for blockchain connectors
    logger.info('Starting health monitoring for blockchain connectors...');
    const healthMonitoringInterval = config.monitoring?.interval || 60000; // Default to 1 minute
    const monitoringInterval = monitorConnectorHealth(blockchainConnectors, healthMonitoringInterval);
    
    logger.info('FractaLedger started successfully!');
    logger.info(`API server running at http://${config.api.host}:${config.api.port}`);
    logger.info(`Health monitoring running with interval: ${healthMonitoringInterval}ms`);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down FractaLedger...');
      
      // Stop health monitoring
      logger.info('Stopping health monitoring...');
      stopHealthMonitoring(monitoringInterval);
      
      // Disconnect from Hyperledger Fabric
      if (fabricClient) {
        logger.info('Disconnecting from Hyperledger Fabric...');
        await fabricClient.disconnect();
      }
      
      logger.info('FractaLedger shutdown complete');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start FractaLedger:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main };
