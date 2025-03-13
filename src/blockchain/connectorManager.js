/**
 * Blockchain Connector Manager
 * 
 * This module initializes and manages blockchain connectors based on the configuration.
 * It includes connection pooling, health monitoring, and automatic failover.
 */

const { BlockchainConnector } = require('./blockchainConnector');
const { FullNodeConnector } = require('./connectors/fullNodeConnector');
const { SpvConnector } = require('./connectors/spvConnector');
const { ApiConnector } = require('./connectors/apiConnector');
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
async function initializeBlockchainConnectors(config) {
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
    
    // Test connections
    logger.info('Testing connections to all blockchain connectors');
    await testConnections(connectors);
    
    logger.info('All blockchain connectors initialized successfully');
    return connectors;
  } catch (error) {
    logger.error(`Failed to initialize blockchain connectors: ${error.message}`, { error });
    throw new Error(`Failed to initialize blockchain connectors: ${error.message}`);
  }
}

/**
 * Create a blockchain connector based on the wallet configuration
 * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
 * @param {Object} walletConfig The wallet configuration
 * @returns {BlockchainConnector} The created blockchain connector
 */
function createConnector(blockchain, walletConfig) {
  try {
    logger.debug(`Creating ${walletConfig.connectionType} connector for ${blockchain}/${walletConfig.name}`);
    
    let connector;
    switch (walletConfig.connectionType) {
      case 'fullNode':
        connector = new FullNodeConnector(blockchain, walletConfig);
        break;
      case 'spv':
        connector = new SpvConnector(blockchain, walletConfig);
        break;
      case 'api':
        connector = new ApiConnector(blockchain, walletConfig);
        break;
      default:
        logger.error(`Unsupported connection type: ${walletConfig.connectionType}`);
        throw new Error(`Unsupported connection type: ${walletConfig.connectionType}`);
    }
    
    logger.debug(`Successfully created ${walletConfig.connectionType} connector for ${blockchain}/${walletConfig.name}`);
    return connector;
  } catch (error) {
    logger.error(`Failed to create connector for ${blockchain}/${walletConfig.name}: ${error.message}`, { error });
    throw new Error(`Failed to create connector for ${blockchain}/${walletConfig.name}: ${error.message}`);
  }
}

/**
 * Test connections to all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 */
async function testConnections(connectors) {
  const connectionPromises = [];
  const results = { success: 0, failed: 0 };
  
  // Test Bitcoin connectors
  for (const [name, connector] of Object.entries(connectors.bitcoin)) {
    logger.debug(`Testing connection to Bitcoin connector ${name}`);
    connectionPromises.push(
      connector.testConnection()
        .then(() => {
          logger.info(`Successfully connected to Bitcoin connector ${name}`);
          results.success++;
        })
        .catch(error => {
          logger.error(`Failed to connect to Bitcoin connector ${name}: ${error.message}`, { error });
          results.failed++;
          throw new Error(`Failed to connect to Bitcoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  // Test Litecoin connectors
  for (const [name, connector] of Object.entries(connectors.litecoin)) {
    logger.debug(`Testing connection to Litecoin connector ${name}`);
    connectionPromises.push(
      connector.testConnection()
        .then(() => {
          logger.info(`Successfully connected to Litecoin connector ${name}`);
          results.success++;
        })
        .catch(error => {
          logger.error(`Failed to connect to Litecoin connector ${name}: ${error.message}`, { error });
          results.failed++;
          throw new Error(`Failed to connect to Litecoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  // Test Dogecoin connectors
  for (const [name, connector] of Object.entries(connectors.dogecoin)) {
    logger.debug(`Testing connection to Dogecoin connector ${name}`);
    connectionPromises.push(
      connector.testConnection()
        .then(() => {
          logger.info(`Successfully connected to Dogecoin connector ${name}`);
          results.success++;
        })
        .catch(error => {
          logger.error(`Failed to connect to Dogecoin connector ${name}: ${error.message}`, { error });
          results.failed++;
          throw new Error(`Failed to connect to Dogecoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  try {
    await Promise.all(connectionPromises);
    logger.info(`All connections tested successfully: ${results.success} succeeded, ${results.failed} failed`);
  } catch (error) {
    logger.error(`Some connections failed: ${results.success} succeeded, ${results.failed} failed`);
    throw error;
  }
}

/**
 * Monitor the health of all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 * @param {number} interval The monitoring interval in milliseconds
 * @returns {Object} The monitoring interval ID
 */
function monitorConnectorHealth(connectors, interval = 60000) {
  logger.info(`Starting health monitoring for blockchain connectors with interval ${interval}ms`);
  
  const monitoringInterval = setInterval(async () => {
    logger.debug('Running health check for all blockchain connectors');
    
    try {
      // Check Bitcoin connectors
      for (const [name, connector] of Object.entries(connectors.bitcoin)) {
        try {
          const isHealthy = await connector.testConnection();
          if (isHealthy) {
            logger.debug(`Bitcoin connector ${name} is healthy`);
          } else {
            logger.warn(`Bitcoin connector ${name} is unhealthy`);
          }
        } catch (error) {
          logger.error(`Health check failed for Bitcoin connector ${name}: ${error.message}`, { error });
        }
      }
      
      // Check Litecoin connectors
      for (const [name, connector] of Object.entries(connectors.litecoin)) {
        try {
          const isHealthy = await connector.testConnection();
          if (isHealthy) {
            logger.debug(`Litecoin connector ${name} is healthy`);
          } else {
            logger.warn(`Litecoin connector ${name} is unhealthy`);
          }
        } catch (error) {
          logger.error(`Health check failed for Litecoin connector ${name}: ${error.message}`, { error });
        }
      }
      
      // Check Dogecoin connectors
      for (const [name, connector] of Object.entries(connectors.dogecoin)) {
        try {
          const isHealthy = await connector.testConnection();
          if (isHealthy) {
            logger.debug(`Dogecoin connector ${name} is healthy`);
          } else {
            logger.warn(`Dogecoin connector ${name} is unhealthy`);
          }
        } catch (error) {
          logger.error(`Health check failed for Dogecoin connector ${name}: ${error.message}`, { error });
        }
      }
      
      logger.debug('Health check completed for all blockchain connectors');
    } catch (error) {
      logger.error(`Error during health monitoring: ${error.message}`, { error });
    }
  }, interval);
  
  return monitoringInterval;
}

/**
 * Stop monitoring the health of blockchain connectors
 * @param {Object} monitoringInterval The monitoring interval ID
 */
function stopHealthMonitoring(monitoringInterval) {
  if (monitoringInterval) {
    logger.info('Stopping health monitoring for blockchain connectors');
    clearInterval(monitoringInterval);
  }
}

/**
 * Get a healthy connector for a specific blockchain
 * @param {Object} connectors The blockchain connectors
 * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
 * @returns {BlockchainConnector} A healthy connector or null if none are available
 */
async function getHealthyConnector(connectors, blockchain) {
  logger.debug(`Finding healthy connector for ${blockchain}`);
  
  if (!connectors[blockchain] || Object.keys(connectors[blockchain]).length === 0) {
    logger.warn(`No connectors available for ${blockchain}`);
    return null;
  }
  
  // Try to find a healthy connector
  for (const [name, connector] of Object.entries(connectors[blockchain])) {
    try {
      const isHealthy = await connector.testConnection();
      if (isHealthy) {
        logger.debug(`Found healthy ${blockchain} connector: ${name}`);
        return connector;
      }
    } catch (error) {
      logger.warn(`Connector ${name} for ${blockchain} is unhealthy: ${error.message}`);
    }
  }
  
  logger.error(`No healthy connectors available for ${blockchain}`);
  return null;
}

module.exports = {
  initializeBlockchainConnectors,
  monitorConnectorHealth,
  stopHealthMonitoring,
  getHealthyConnector
};
