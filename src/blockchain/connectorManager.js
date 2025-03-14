/**
 * Blockchain Connector Manager
 * 
 * This module initializes and manages blockchain connectors based on the configuration.
 * It focuses on transaction creation and signing, delegating the blockchain interaction
 * responsibility to the user's environment through the TransceiverManager.
 */

const { BlockchainConnector } = require('./blockchainConnector');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'connector-manager' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/connector-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/connector.log' })
  ]
});

/**
 * Initialize blockchain connectors based on the configuration
 * @param {Object} config The configuration object
 * @returns {Object} An object containing initialized blockchain connectors
 */
function initializeBlockchainConnectors(config) {
  logger.info('Initializing blockchain connectors');
  
  try {
    const connectors = {
      bitcoin: {},
      litecoin: {},
      dogecoin: {}
    };
    
    // Initialize Bitcoin connectors
    if (config.bitcoin) {
      logger.info(`Initializing ${config.bitcoin.length} Bitcoin connectors`);
      for (const walletConfig of config.bitcoin) {
        logger.debug(`Creating Bitcoin connector: ${walletConfig.name}`);
        connectors.bitcoin[walletConfig.name] = createConnector('bitcoin', walletConfig);
      }
    }
    
    // Initialize Litecoin connectors
    if (config.litecoin) {
      logger.info(`Initializing ${config.litecoin.length} Litecoin connectors`);
      for (const walletConfig of config.litecoin) {
        logger.debug(`Creating Litecoin connector: ${walletConfig.name}`);
        connectors.litecoin[walletConfig.name] = createConnector('litecoin', walletConfig);
      }
    }
    
    // Initialize Dogecoin connectors
    if (config.dogecoin) {
      logger.info(`Initializing ${config.dogecoin.length} Dogecoin connectors`);
      for (const walletConfig of config.dogecoin) {
        logger.debug(`Creating Dogecoin connector: ${walletConfig.name}`);
        connectors.dogecoin[walletConfig.name] = createConnector('dogecoin', walletConfig);
      }
    }
    
    // Initialize any other UTXO-based blockchain connectors
    const otherBlockchains = Object.keys(config).filter(key => 
      key !== 'bitcoin' && 
      key !== 'litecoin' && 
      key !== 'dogecoin' && 
      key !== 'hyperledger' && 
      key !== 'api' && 
      key !== 'logging' && 
      key !== 'monitoring' && 
      key !== 'smartContract' && 
      key !== 'baseInternalWallet' && 
      key !== 'balanceReconciliation' && 
      key !== 'environment' && 
      key !== 'broadcasting'
    );
    
    for (const blockchain of otherBlockchains) {
      if (Array.isArray(config[blockchain])) {
        logger.info(`Initializing ${config[blockchain].length} ${blockchain} connectors`);
        connectors[blockchain] = {};
        for (const walletConfig of config[blockchain]) {
          logger.debug(`Creating ${blockchain} connector: ${walletConfig.name}`);
          connectors[blockchain][walletConfig.name] = createConnector(blockchain, walletConfig);
        }
      }
    }
    
    logger.info('All blockchain connectors initialized successfully');
    return connectors;
  } catch (error) {
    logger.error(`Failed to initialize blockchain connectors: ${error.message}`, { error });
    throw new Error(`Failed to initialize blockchain connectors: ${error.message}`);
  }
}

/**
 * Create a blockchain connector based on the wallet configuration
 * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin, etc.)
 * @param {Object} walletConfig The wallet configuration
 * @returns {BlockchainConnector} The created blockchain connector
 */
function createConnector(blockchain, walletConfig) {
  try {
    logger.debug(`Creating connector for ${blockchain}/${walletConfig.name}`);
    
    // Get the secret from environment variables if specified
    if (walletConfig.secretEnvVar) {
      walletConfig.secret = process.env[walletConfig.secretEnvVar];
      if (!walletConfig.secret) {
        throw new Error(`Environment variable ${walletConfig.secretEnvVar} not found`);
      }
    }
    
    // Convert broadcasting config to transceiver config if needed
    if (walletConfig.broadcasting && !walletConfig.transceiver) {
      walletConfig.transceiver = walletConfig.broadcasting;
    }
    
    // Create a new blockchain connector
    const connector = new BlockchainConnector(blockchain, walletConfig);
    
    logger.debug(`Successfully created connector for ${blockchain}/${walletConfig.name}`);
    return connector;
  } catch (error) {
    logger.error(`Failed to create connector for ${blockchain}/${walletConfig.name}: ${error.message}`, { error });
    throw new Error(`Failed to create connector for ${blockchain}/${walletConfig.name}: ${error.message}`);
  }
}

/**
 * Register event listeners for all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @param {Object} eventHandlers The event handlers
 */
function registerEventListeners(connectors, eventHandlers) {
  logger.info('Registering event listeners for blockchain connectors');
  
  try {
    // Register event listeners for all blockchain connectors
    for (const blockchain of Object.keys(connectors)) {
      for (const [name, connector] of Object.entries(connectors[blockchain])) {
        logger.debug(`Registering event listeners for ${blockchain} connector ${name}`);
        for (const [event, handler] of Object.entries(eventHandlers)) {
          connector.on(event, handler);
        }
      }
    }
    
    logger.info('Event listeners registered successfully');
  } catch (error) {
    logger.error(`Failed to register event listeners: ${error.message}`, { error });
    throw new Error(`Failed to register event listeners: ${error.message}`);
  }
}

/**
 * Update the transceiver configuration for all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @param {Object} transceiverConfig The transceiver configuration
 */
function updateTransceiverConfig(connectors, transceiverConfig) {
  logger.info('Updating transceiver configuration for blockchain connectors');
  
  try {
    // Update transceiver configuration for all blockchain connectors
    for (const blockchain of Object.keys(connectors)) {
      for (const [name, connector] of Object.entries(connectors[blockchain])) {
        logger.debug(`Updating transceiver configuration for ${blockchain} connector ${name}`);
        connector.updateTransceiverConfig(transceiverConfig);
      }
    }
    
    logger.info('Transceiver configuration updated successfully');
  } catch (error) {
    logger.error(`Failed to update transceiver configuration: ${error.message}`, { error });
    throw new Error(`Failed to update transceiver configuration: ${error.message}`);
  }
}

/**
 * Get all pending transactions from all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @returns {Object} An object containing pending transactions for each blockchain
 */
function getAllPendingTransactions(connectors) {
  logger.debug('Getting all pending transactions from blockchain connectors');
  
  try {
    const pendingTransactions = {};
    
    // Get pending transactions from all blockchain connectors
    for (const blockchain of Object.keys(connectors)) {
      pendingTransactions[blockchain] = {};
      for (const [name, connector] of Object.entries(connectors[blockchain])) {
        pendingTransactions[blockchain][name] = connector.getAllPendingTransactions();
      }
    }
    
    return pendingTransactions;
  } catch (error) {
    logger.error(`Failed to get pending transactions: ${error.message}`, { error });
    throw new Error(`Failed to get pending transactions: ${error.message}`);
  }
}

/**
 * Get all monitored addresses from all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @returns {Object} An object containing monitored addresses for each blockchain
 */
function getAllMonitoredAddresses(connectors) {
  logger.debug('Getting all monitored addresses from blockchain connectors');
  
  try {
    const monitoredAddresses = {};
    
    // Get monitored addresses from all blockchain connectors
    for (const blockchain of Object.keys(connectors)) {
      monitoredAddresses[blockchain] = {};
      for (const [name, connector] of Object.entries(connectors[blockchain])) {
        monitoredAddresses[blockchain][name] = connector.getAllMonitoredAddresses();
      }
    }
    
    return monitoredAddresses;
  } catch (error) {
    logger.error(`Failed to get monitored addresses: ${error.message}`, { error });
    throw new Error(`Failed to get monitored addresses: ${error.message}`);
  }
}

/**
 * Get a connector for a specific blockchain and wallet
 * @param {Object} connectors The blockchain connectors
 * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin, etc.)
 * @param {string} walletName The wallet name
 * @returns {BlockchainConnector} The connector or null if not found
 */
function getConnector(connectors, blockchain, walletName) {
  logger.debug(`Getting connector for ${blockchain}/${walletName}`);
  
  if (!connectors[blockchain] || !connectors[blockchain][walletName]) {
    logger.warn(`Connector not found for ${blockchain}/${walletName}`);
    return null;
  }
  
  return connectors[blockchain][walletName];
}

/**
 * Clean up resources used by all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @returns {Promise<void>}
 */
async function cleanupConnectors(connectors) {
  logger.info('Cleaning up blockchain connectors');
  
  try {
    // Clean up all blockchain connectors
    for (const blockchain of Object.keys(connectors)) {
      for (const [name, connector] of Object.entries(connectors[blockchain])) {
        logger.debug(`Cleaning up ${blockchain} connector ${name}`);
        await connector.cleanup();
      }
    }
    
    logger.info('Blockchain connectors cleaned up successfully');
  } catch (error) {
    logger.error(`Failed to clean up blockchain connectors: ${error.message}`, { error });
    throw new Error(`Failed to clean up blockchain connectors: ${error.message}`);
  }
}

module.exports = {
  initializeBlockchainConnectors,
  registerEventListeners,
  updateTransceiverConfig,
  getAllPendingTransactions,
  getAllMonitoredAddresses,
  getConnector,
  cleanupConnectors
};
