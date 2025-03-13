/**
 * Hyperledger Fabric Manager
 * 
 * This module initializes and manages the Hyperledger Fabric network.
 * It provides a production-ready implementation for interacting with
 * Hyperledger Fabric, including wallet management, transaction submission,
 * and chaincode management.
 */

const { Wallets, Gateway } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fabric-manager' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/fabric-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/fabric.log' })
  ]
});

/**
 * Initialize Hyperledger Fabric
 * @param {Object} config The configuration object
 * @returns {Object} The Fabric client
 */
async function initializeHyperledger(config) {
  try {
    logger.info('Initializing Hyperledger Fabric...');
    
    if (!config.hyperledger) {
      throw new Error('Hyperledger configuration is missing');
    }
    
    const { 
      connectionProfilePath, 
      channelName, 
      chaincodeName, 
      mspId, 
      walletPath,
      caUrl,
      caName,
      adminUserId,
      adminUserSecret,
      userId
    } = config.hyperledger;
    
    // Create or get the wallet path
    const walletDirectory = walletPath || path.join(process.cwd(), 'wallet');
    if (!fs.existsSync(walletDirectory)) {
      fs.mkdirSync(walletDirectory, { recursive: true });
    }
    
    // Create a new wallet for identity management
    const wallet = await Wallets.newFileSystemWallet(walletDirectory);
    logger.info(`Wallet path: ${walletDirectory}`);
    
    // Check if admin identity exists in the wallet
    const adminIdentity = await wallet.get(adminUserId || 'admin');
    if (!adminIdentity) {
      logger.info('Admin identity not found in wallet, enrolling admin...');
      
      // Create a CA client for interacting with the CA
      const caClient = buildCAClient(caUrl, caName);
      
      // Enroll the admin user
      await enrollAdmin(
        caClient, 
        wallet, 
        mspId, 
        adminUserId || 'admin', 
        adminUserSecret || 'adminpw'
      );
      
      logger.info('Admin enrolled successfully');
    }
    
    // Check if user identity exists in the wallet
    const userIdentity = await wallet.get(userId || 'appUser');
    if (!userIdentity) {
      logger.info('User identity not found in wallet, registering and enrolling user...');
      
      // Create a CA client for interacting with the CA
      const caClient = buildCAClient(caUrl, caName);
      
      // Register and enroll the user
      await registerAndEnrollUser(
        caClient, 
        wallet, 
        mspId, 
        adminUserId || 'admin', 
        userId || 'appUser'
      );
      
      logger.info('User enrolled successfully');
    }
    
    // Load the connection profile
    let connectionProfile;
    try {
      const connectionProfileJson = fs.readFileSync(connectionProfilePath, 'utf8');
      connectionProfile = JSON.parse(connectionProfileJson);
    } catch (error) {
      throw new Error(`Failed to load connection profile: ${error.message}`);
    }
    
    // Create a new gateway for connecting to the peer node
    const gateway = new Gateway();
    
    // Create the fabric client
    const fabricClient = {
      gateway,
      wallet,
      network: null,
      contract: null,
      
      /**
       * Connect to the Hyperledger Fabric network
       * @returns {Promise<void>}
       */
      connect: async () => {
        try {
          logger.info('Connecting to Hyperledger Fabric network...');
          
          // Connect to the gateway using the identity in the wallet
          await gateway.connect(connectionProfile, {
            wallet,
            identity: userId || 'appUser',
            discovery: { enabled: true, asLocalhost: true }
          });
          
          // Get the network and contract
          const network = await gateway.getNetwork(channelName);
          const contract = network.getContract(chaincodeName);
          
          fabricClient.network = network;
          fabricClient.contract = contract;
          
          logger.info(`Connected to channel: ${channelName}, chaincode: ${chaincodeName}`);
        } catch (error) {
          logger.error(`Failed to connect to Fabric network: ${error.message}`);
          throw new Error(`Failed to connect to Fabric network: ${error.message}`);
        }
      },
      
      /**
       * Submit a transaction to the Hyperledger Fabric network
       * @param {string} chaincodeFunction The chaincode function to call
       * @param {Array} args The arguments to pass to the chaincode function
       * @returns {Promise<Buffer>} The transaction result
       */
      submitTransaction: async (chaincodeFunction, ...args) => {
        try {
          logger.info(`Submitting transaction: ${chaincodeFunction}(${args.join(', ')})`);
          
          if (!fabricClient.contract) {
            await fabricClient.connect();
          }
          
          const result = await fabricClient.contract.submitTransaction(chaincodeFunction, ...args);
          logger.info(`Transaction ${chaincodeFunction} has been submitted`);
          
          return result;
        } catch (error) {
          logger.error(`Failed to submit transaction: ${error.message}`);
          throw new Error(`Failed to submit transaction: ${error.message}`);
        }
      },
      
      /**
       * Evaluate a transaction on the Hyperledger Fabric network
       * @param {string} chaincodeFunction The chaincode function to call
       * @param {Array} args The arguments to pass to the chaincode function
       * @returns {Promise<Buffer>} The transaction result
       */
      evaluateTransaction: async (chaincodeFunction, ...args) => {
        try {
          logger.info(`Evaluating transaction: ${chaincodeFunction}(${args.join(', ')})`);
          
          if (!fabricClient.contract) {
            await fabricClient.connect();
          }
          
          const result = await fabricClient.contract.evaluateTransaction(chaincodeFunction, ...args);
          logger.info(`Transaction ${chaincodeFunction} has been evaluated`);
          
          return result;
        } catch (error) {
          logger.error(`Failed to evaluate transaction: ${error.message}`);
          throw new Error(`Failed to evaluate transaction: ${error.message}`);
        }
      },
      
      /**
       * Deploy chaincode to the Hyperledger Fabric network
       * @param {string} chaincodePath The path to the chaincode
       * @param {string} chaincodeLabel The label for the chaincode
       * @param {string} chaincodeVersion The version of the chaincode
       * @returns {Promise<void>}
       */
      deployChaincode: async (chaincodePath, chaincodeLabel, chaincodeVersion) => {
        try {
          logger.info(`Deploying chaincode from ${chaincodePath}`);
          
          // In a production implementation, this would use the Fabric SDK to deploy
          // the chaincode to the Fabric network. This requires administrative access
          // to the Fabric network and is typically done using the Fabric CLI tools.
          
          // For now, we'll log a message and throw an error
          logger.error('Chaincode deployment is not implemented in this version');
          throw new Error('Chaincode deployment is not implemented in this version. Please use the Fabric CLI tools to deploy chaincode.');
        } catch (error) {
          logger.error(`Failed to deploy chaincode: ${error.message}`);
          throw new Error(`Failed to deploy chaincode: ${error.message}`);
        }
      },
      
      /**
       * Update chaincode on the Hyperledger Fabric network
       * @param {string} chaincodePath The path to the chaincode
       * @param {string} chaincodeLabel The label for the chaincode
       * @param {string} chaincodeVersion The version of the chaincode
       * @returns {Promise<void>}
       */
      updateChaincode: async (chaincodePath, chaincodeLabel, chaincodeVersion) => {
        try {
          logger.info(`Updating chaincode from ${chaincodePath}`);
          
          // In a production implementation, this would use the Fabric SDK to update
          // the chaincode on the Fabric network. This requires administrative access
          // to the Fabric network and is typically done using the Fabric CLI tools.
          
          // For now, we'll log a message and throw an error
          logger.error('Chaincode update is not implemented in this version');
          throw new Error('Chaincode update is not implemented in this version. Please use the Fabric CLI tools to update chaincode.');
        } catch (error) {
          logger.error(`Failed to update chaincode: ${error.message}`);
          throw new Error(`Failed to update chaincode: ${error.message}`);
        }
      },
      
      /**
       * Register a transaction event listener
       * @param {string} transactionId The transaction ID to listen for
       * @returns {Promise<Object>} The transaction event
       */
      registerTransactionEventListener: async (transactionId) => {
        try {
          logger.info(`Registering transaction event listener for ${transactionId}`);
          
          if (!fabricClient.network) {
            await fabricClient.connect();
          }
          
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Transaction event listener for ${transactionId} timed out`));
            }, 60000); // 60 seconds timeout
            
            fabricClient.network.addBlockListener(async (event) => {
              const block = event.blockData;
              
              // Check if the block contains the transaction
              for (const tx of block.data.data) {
                const txId = tx.payload.header.channel_header.tx_id;
                
                if (txId === transactionId) {
                  clearTimeout(timeout);
                  resolve({
                    transactionId,
                    blockNumber: block.header.number,
                    timestamp: new Date(tx.payload.header.channel_header.timestamp)
                  });
                  return;
                }
              }
            });
          });
        } catch (error) {
          logger.error(`Failed to register transaction event listener: ${error.message}`);
          throw new Error(`Failed to register transaction event listener: ${error.message}`);
        }
      },
      
      /**
       * Close the connection to the Hyperledger Fabric network
       * @returns {Promise<void>}
       */
      disconnect: async () => {
        try {
          logger.info('Disconnecting from Hyperledger Fabric');
          
          if (gateway) {
            gateway.disconnect();
          }
          
          fabricClient.network = null;
          fabricClient.contract = null;
          
          logger.info('Disconnected from Hyperledger Fabric');
        } catch (error) {
          logger.error(`Failed to disconnect from Fabric network: ${error.message}`);
          throw new Error(`Failed to disconnect from Fabric network: ${error.message}`);
        }
      }
    };
    
    return fabricClient;
  } catch (error) {
    logger.error(`Failed to initialize Hyperledger Fabric: ${error.message}`);
    throw new Error(`Failed to initialize Hyperledger Fabric: ${error.message}`);
  }
}

/**
 * Build a CA client for interacting with the CA
 * @param {string} caUrl The URL of the CA
 * @param {string} caName The name of the CA
 * @returns {Object} The CA client
 */
function buildCAClient(caUrl, caName) {
  try {
    // Create a new CA client for interacting with the CA
    const caClient = new FabricCAServices(caUrl, { trustedRoots: [], verify: false }, caName);
    logger.info(`Built a CA client named ${caName}`);
    return caClient;
  } catch (error) {
    logger.error(`Failed to build CA client: ${error.message}`);
    throw new Error(`Failed to build CA client: ${error.message}`);
  }
}

/**
 * Enroll an admin user
 * @param {Object} caClient The Fabric CA client
 * @param {Object} wallet The wallet to store the admin credentials
 * @param {string} orgMspId The MSP ID of the organization
 * @param {string} adminUserId The ID of the admin user
 * @param {string} adminUserSecret The secret of the admin user
 * @returns {Promise<void>}
 */
async function enrollAdmin(caClient, wallet, orgMspId, adminUserId, adminUserSecret) {
  try {
    // Check if admin is already enrolled
    const identity = await wallet.get(adminUserId);
    if (identity) {
      logger.info(`Admin ${adminUserId} is already enrolled`);
      return;
    }
    
    // Enroll the admin user
    const enrollment = await caClient.enroll({
      enrollmentID: adminUserId,
      enrollmentSecret: adminUserSecret
    });
    
    // Create the identity for the admin user
    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: orgMspId,
      type: 'X.509'
    };
    
    // Import the identity into the wallet
    await wallet.put(adminUserId, x509Identity);
    logger.info(`Admin ${adminUserId} enrolled successfully`);
  } catch (error) {
    logger.error(`Failed to enroll admin: ${error.message}`);
    throw new Error(`Failed to enroll admin: ${error.message}`);
  }
}

/**
 * Register and enroll a user
 * @param {Object} caClient The Fabric CA client
 * @param {Object} wallet The wallet to store the user credentials
 * @param {string} orgMspId The MSP ID of the organization
 * @param {string} adminUserId The ID of the admin user
 * @param {string} userId The ID of the user to register
 * @returns {Promise<void>}
 */
async function registerAndEnrollUser(caClient, wallet, orgMspId, adminUserId, userId) {
  try {
    // Check if user is already enrolled
    const userIdentity = await wallet.get(userId);
    if (userIdentity) {
      logger.info(`User ${userId} is already enrolled`);
      return;
    }
    
    // Get the admin identity
    const adminIdentity = await wallet.get(adminUserId);
    if (!adminIdentity) {
      throw new Error(`Admin ${adminUserId} must be enrolled before registering users`);
    }
    
    // Create a provider for the admin identity
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, adminUserId);
    
    // Register the user
    const secret = await caClient.register({
      affiliation: 'org1.department1',
      enrollmentID: userId,
      role: 'client',
      attrs: [{ name: 'role', value: 'user', ecert: true }]
    }, adminUser);
    
    // Enroll the user
    const enrollment = await caClient.enroll({
      enrollmentID: userId,
      enrollmentSecret: secret
    });
    
    // Create the identity for the user
    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: orgMspId,
      type: 'X.509'
    };
    
    // Import the identity into the wallet
    await wallet.put(userId, x509Identity);
    logger.info(`User ${userId} enrolled successfully`);
  } catch (error) {
    logger.error(`Failed to register and enroll user: ${error.message}`);
    throw new Error(`Failed to register and enroll user: ${error.message}`);
  }
}

module.exports = {
  initializeHyperledger
};
