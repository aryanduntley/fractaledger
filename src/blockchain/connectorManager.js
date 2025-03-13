/**
 * Blockchain Connector Manager
 * 
 * This module initializes and manages blockchain connectors based on the configuration.
 */

const { BlockchainConnector } = require('./blockchainConnector');
const { FullNodeConnector } = require('./connectors/fullNodeConnector');
const { SpvConnector } = require('./connectors/spvConnector');
const { ApiConnector } = require('./connectors/apiConnector');

/**
 * Initialize blockchain connectors based on the configuration
 * @param {Object} config The configuration object
 * @returns {Object} An object containing initialized blockchain connectors
 */
async function initializeBlockchainConnectors(config) {
  try {
    const connectors = {
      bitcoin: {},
      litecoin: {},
      dogecoin: {}
    };
    
    // Initialize Bitcoin connectors
    if (config.bitcoin) {
      for (const walletConfig of config.bitcoin) {
        connectors.bitcoin[walletConfig.name] = createConnector('bitcoin', walletConfig);
      }
    }
    
    // Initialize Litecoin connectors
    if (config.litecoin) {
      for (const walletConfig of config.litecoin) {
        connectors.litecoin[walletConfig.name] = createConnector('litecoin', walletConfig);
      }
    }
    
    // Initialize Dogecoin connectors
    if (config.dogecoin) {
      for (const walletConfig of config.dogecoin) {
        connectors.dogecoin[walletConfig.name] = createConnector('dogecoin', walletConfig);
      }
    }
    
    // Test connections
    await testConnections(connectors);
    
    return connectors;
  } catch (error) {
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
  switch (walletConfig.connectionType) {
    case 'fullNode':
      return new FullNodeConnector(blockchain, walletConfig);
    case 'spv':
      return new SpvConnector(blockchain, walletConfig);
    case 'api':
      return new ApiConnector(blockchain, walletConfig);
    default:
      throw new Error(`Unsupported connection type: ${walletConfig.connectionType}`);
  }
}

/**
 * Test connections to all blockchain connectors
 * @param {Object} connectors The blockchain connectors
 */
async function testConnections(connectors) {
  const connectionPromises = [];
  
  // Test Bitcoin connectors
  for (const [name, connector] of Object.entries(connectors.bitcoin)) {
    connectionPromises.push(
      connector.testConnection()
        .catch(error => {
          throw new Error(`Failed to connect to Bitcoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  // Test Litecoin connectors
  for (const [name, connector] of Object.entries(connectors.litecoin)) {
    connectionPromises.push(
      connector.testConnection()
        .catch(error => {
          throw new Error(`Failed to connect to Litecoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  // Test Dogecoin connectors
  for (const [name, connector] of Object.entries(connectors.dogecoin)) {
    connectionPromises.push(
      connector.testConnection()
        .catch(error => {
          throw new Error(`Failed to connect to Dogecoin connector ${name}: ${error.message}`);
        })
    );
  }
  
  await Promise.all(connectionPromises);
}

module.exports = {
  initializeBlockchainConnectors
};
