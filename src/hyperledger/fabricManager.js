/**
 * Hyperledger Fabric Manager
 * 
 * This module initializes and manages the Hyperledger Fabric network.
 * It provides a production-ready implementation for interacting with
 * Hyperledger Fabric, including wallet management, transaction submission,
 * and chaincode management.
 */

const { connect, Identity, Signer, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const grpc = require('@grpc/grpc-js');

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
      peerEndpoint,
      tlsCertPath,
      channelName, 
      chaincodeName, 
      mspId, 
      keyDirectoryPath,
      certPath,
      clientTlsCertPath,
      clientTlsKeyPath,
      asLocalhost
    } = config.hyperledger;
    
    // The gRPC client connection should be shared by all Gateway connections to this endpoint
    const client = await newGrpcConnection(
      peerEndpoint,
      tlsCertPath,
      clientTlsCertPath,
      clientTlsKeyPath
    );
    
    // Get identity and signer
    const identity = await newIdentity(certPath, mspId);
    const signer = await newSigner(keyDirectoryPath);
    
    // Create a new gateway for connecting to the peer node
    const gateway = connect({
      client,
      identity,
      signer,
      evaluateOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      endorseOptions: () => {
        return { deadline: Date.now() + 15000 }; // 15 seconds
      },
      submitOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      commitStatusOptions: () => {
        return { deadline: Date.now() + 60000 }; // 1 minute
      },
    });
    
    // Create the fabric client
    const fabricClient = {
      gateway,
      network: null,
      contract: null,
      
      /**
       * Connect to the Hyperledger Fabric network
       * @returns {Promise<void>}
       */
      connect: async () => {
        try {
          logger.info('Connecting to Hyperledger Fabric network...');
          
          // Get the network and contract
          const network = gateway.getNetwork(channelName);
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
          
          // Convert string arguments to Uint8Array
          const uint8Args = args.map(arg => Buffer.from(arg));
          
          // Submit transaction
          const result = await fabricClient.contract.submitTransaction(chaincodeFunction, ...uint8Args);
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
          
          // Convert string arguments to Uint8Array
          const uint8Args = args.map(arg => Buffer.from(arg));
          
          // Evaluate transaction
          const result = await fabricClient.contract.evaluateTransaction(chaincodeFunction, ...uint8Args);
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
          
          // In a production implementation, this would use the Fabric CLI tools to deploy
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
          
          // In a production implementation, this would use the Fabric CLI tools to update
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
            
            // Use the checkpointer to listen for transaction events
            const checkpointer = fabricClient.network.newCheckpointer();
            const blockEvents = fabricClient.network.getBlockEvents(checkpointer);
            
            (async () => {
              try {
                for await (const blockEvent of blockEvents) {
                  for (const transactionEvent of blockEvent.getTransactionEvents()) {
                    if (transactionEvent.getTransactionId() === transactionId) {
                      clearTimeout(timeout);
                      resolve({
                        transactionId,
                        blockNumber: blockEvent.getBlockNumber(),
                        timestamp: new Date()
                      });
                      return;
                    }
                  }
                }
              } catch (error) {
                reject(error);
              }
            })();
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
            gateway.close();
          }
          
          if (client) {
            client.close();
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
 * Create a new gRPC connection to the Fabric peer
 * @param {string} peerEndpoint The endpoint of the peer
 * @param {string} tlsCertPath The path to the TLS certificate
 * @param {string} clientTlsCertPath The path to the client TLS certificate
 * @param {string} clientTlsKeyPath The path to the client TLS key
 * @returns {grpc.Client} The gRPC client
 */
async function newGrpcConnection(peerEndpoint, tlsCertPath, clientTlsCertPath, clientTlsKeyPath) {
  try {
    logger.info(`Creating gRPC connection to ${peerEndpoint}`);
    
    const tlsRootCert = fs.readFileSync(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    
    // If client TLS certificate and key are provided, use mutual TLS
    let credentials = tlsCredentials;
    if (clientTlsCertPath && clientTlsKeyPath) {
      const clientTlsCert = fs.readFileSync(clientTlsCertPath);
      const clientTlsKey = fs.readFileSync(clientTlsKeyPath);
      credentials = grpc.credentials.createSsl(tlsRootCert, clientTlsKey, clientTlsCert);
    }
    
    const client = new grpc.Client(peerEndpoint, credentials);
    
    logger.info(`Created gRPC connection to ${peerEndpoint}`);
    return client;
  } catch (error) {
    logger.error(`Failed to create gRPC connection: ${error.message}`);
    throw new Error(`Failed to create gRPC connection: ${error.message}`);
  }
}

/**
 * Create a new identity for use with the Fabric Gateway
 * @param {string} certPath The path to the certificate
 * @param {string} mspId The MSP ID
 * @returns {Identity} The identity
 */
async function newIdentity(certPath, mspId) {
  try {
    logger.info(`Creating identity with MSP ID ${mspId}`);
    
    const credentials = fs.readFileSync(certPath);
    const identity = { mspId, credentials };
    
    logger.info(`Created identity with MSP ID ${mspId}`);
    return identity;
  } catch (error) {
    logger.error(`Failed to create identity: ${error.message}`);
    throw new Error(`Failed to create identity: ${error.message}`);
  }
}

/**
 * Create a new signer for use with the Fabric Gateway
 * @param {string} keyDirectoryPath The path to the key directory
 * @returns {Signer} The signer
 */
async function newSigner(keyDirectoryPath) {
  try {
    logger.info(`Creating signer from ${keyDirectoryPath}`);
    
    const files = fs.readdirSync(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = fs.readFileSync(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);
    
    logger.info(`Created signer from ${keyDirectoryPath}`);
    return signer;
  } catch (error) {
    logger.error(`Failed to create signer: ${error.message}`);
    throw new Error(`Failed to create signer: ${error.message}`);
  }
}

module.exports = {
  initializeHyperledger
};
