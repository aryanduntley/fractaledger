/**
 * Configuration Loader
 * 
 * This module loads and validates the configuration from config.json and environment variables.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

/**
 * Load configuration from fractaledger.json or config.json and environment variables
 * @returns {Object} The loaded and validated configuration
 */
async function loadConfig() {
  try {
    // Try to load configuration from fractaledger.json first
    let configPath = path.resolve(process.cwd(), 'fractaledger.json');
    
    // If fractaledger.json doesn't exist, fall back to config.json for backward compatibility
    if (!fs.existsSync(configPath)) {
      configPath = path.resolve(process.cwd(), 'config.json');
      
      // If neither file exists, throw an error
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found. Please create either fractaledger.json or config.json in your project root.`);
      }
      
      console.log('Using config.json for configuration (deprecated). Consider migrating to fractaledger.json.');
    }
    
    const configJson = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configJson);
    
    // Validate configuration
    validateConfig(config);
    
    // Load environment variables from .env file
    // Check if the environment section exists and has an envFilePath property
    if (config.environment && config.environment.envFilePath) {
      const envPath = path.resolve(process.cwd(), config.environment.envFilePath);
      dotenv.config({ path: envPath });
      console.log(`Loaded environment variables from ${envPath}`);
    } else {
      // Default to .env in the current working directory
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
      console.log('Loaded environment variables from default .env file');
    }
    
    // Process environment variables
    processEnvironmentVariables(config);
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Validate the configuration using Joi
 * @param {Object} config The configuration to validate
 */
function validateConfig(config) {
  // Define validation schema
  const schema = Joi.object({
    bitcoin: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        connectionType: Joi.string().valid('fullNode', 'spv', 'api').required(),
        connectionDetails: Joi.object().required(),
        walletAddress: Joi.string().required(),
        secretEnvVar: Joi.string().required()
      })
    ),
    litecoin: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        connectionType: Joi.string().valid('fullNode', 'spv', 'api').required(),
        connectionDetails: Joi.object().required(),
        walletAddress: Joi.string().required(),
        secretEnvVar: Joi.string().required()
      })
    ),
    dogecoin: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        connectionType: Joi.string().valid('fullNode', 'spv', 'api').required(),
        connectionDetails: Joi.object().required(),
        walletAddress: Joi.string().required(),
        secretEnvVar: Joi.string().required()
      })
    ),
    hyperledger: Joi.object({
      connectionProfilePath: Joi.string().required(),
      channelName: Joi.string().required(),
      chaincodeName: Joi.string().required(),
      mspId: Joi.string().required(),
      walletPath: Joi.string().required(),
      caUrl: Joi.string().required(),
      caName: Joi.string().required(),
      adminUserId: Joi.string().required(),
      adminUserSecret: Joi.string().required(),
      userId: Joi.string().required(),
      tlsEnabled: Joi.boolean().default(true),
      tlsCertPath: Joi.string().when('tlsEnabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      peerEndpoint: Joi.string().required(),
      peerHostname: Joi.string().required(),
      ordererEndpoint: Joi.string().required(),
      ordererHostname: Joi.string().required(),
      ordererTlsCertPath: Joi.string().when('tlsEnabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      discovery: Joi.object({
        enabled: Joi.boolean().default(true),
        asLocalhost: Joi.boolean().default(true)
      }).default({
        enabled: true,
        asLocalhost: true
      }),
      eventHandling: Joi.object({
        commitTimeout: Joi.number().default(300),
        endorsementTimeout: Joi.number().default(30),
        blockEventListenerEnabled: Joi.boolean().default(true)
      }).default({
        commitTimeout: 300,
        endorsementTimeout: 30,
        blockEventListenerEnabled: true
      })
    }).required(),
    api: Joi.object({
      port: Joi.number().default(3000),
      host: Joi.string().default('localhost'),
      cors: Joi.object(),
      auth: Joi.object(),
      rateLimiting: Joi.object()
    }).required(),
    logging: Joi.object({
      level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
      file: Joi.string(),
      maxSize: Joi.string(),
      maxFiles: Joi.string()
    }),
    smartContract: Joi.object({
      customizablePath: Joi.string().required(),
      templates: Joi.object().required()
    }).required(),
    environment: Joi.object({
      envFilePath: Joi.string()
    })
  });
  
  const { error } = schema.validate(config);
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}

/**
 * Process environment variables in the configuration
 * @param {Object} config The configuration to process
 */
function processEnvironmentVariables(config) {
  // Process Bitcoin wallet secrets
  if (config.bitcoin) {
    for (const wallet of config.bitcoin) {
      const secret = process.env[wallet.secretEnvVar];
      if (!secret) {
        throw new Error(`Environment variable ${wallet.secretEnvVar} not found`);
      }
      wallet.secret = secret;
      
      // Process API keys if needed
      if (wallet.connectionType === 'api' && wallet.connectionDetails.apiKeyEnvVar) {
        const apiKey = process.env[wallet.connectionDetails.apiKeyEnvVar];
        if (!apiKey) {
          throw new Error(`Environment variable ${wallet.connectionDetails.apiKeyEnvVar} not found`);
        }
        wallet.connectionDetails.apiKey = apiKey;
        delete wallet.connectionDetails.apiKeyEnvVar;
      }
    }
  }
  
  // Process Litecoin wallet secrets
  if (config.litecoin) {
    for (const wallet of config.litecoin) {
      const secret = process.env[wallet.secretEnvVar];
      if (!secret) {
        throw new Error(`Environment variable ${wallet.secretEnvVar} not found`);
      }
      wallet.secret = secret;
      
      // Process API keys if needed
      if (wallet.connectionType === 'api' && wallet.connectionDetails.apiKeyEnvVar) {
        const apiKey = process.env[wallet.connectionDetails.apiKeyEnvVar];
        if (!apiKey) {
          throw new Error(`Environment variable ${wallet.connectionDetails.apiKeyEnvVar} not found`);
        }
        wallet.connectionDetails.apiKey = apiKey;
        delete wallet.connectionDetails.apiKeyEnvVar;
      }
    }
  }
  
  // Process Dogecoin wallet secrets
  if (config.dogecoin) {
    for (const wallet of config.dogecoin) {
      const secret = process.env[wallet.secretEnvVar];
      if (!secret) {
        throw new Error(`Environment variable ${wallet.secretEnvVar} not found`);
      }
      wallet.secret = secret;
      
      // Process API keys if needed
      if (wallet.connectionType === 'api' && wallet.connectionDetails.apiKeyEnvVar) {
        const apiKey = process.env[wallet.connectionDetails.apiKeyEnvVar];
        if (!apiKey) {
          throw new Error(`Environment variable ${wallet.connectionDetails.apiKeyEnvVar} not found`);
        }
        wallet.connectionDetails.apiKey = apiKey;
        delete wallet.connectionDetails.apiKeyEnvVar;
      }
    }
  }
  
  // Process JWT secret for API authentication
  if (config.api && config.api.auth && config.api.auth.jwtSecret) {
    const jwtSecret = process.env[config.api.auth.jwtSecret];
    if (jwtSecret) {
      config.api.auth.jwtSecret = jwtSecret;
    }
  }
  
  // Process Hyperledger Fabric environment variables
  if (config.hyperledger) {
    // Connection profile path
    if (process.env.HYPERLEDGER_CONNECTION_PROFILE_PATH) {
      config.hyperledger.connectionProfilePath = process.env.HYPERLEDGER_CONNECTION_PROFILE_PATH;
    }
    
    // Channel and chaincode
    if (process.env.HYPERLEDGER_CHANNEL_NAME) {
      config.hyperledger.channelName = process.env.HYPERLEDGER_CHANNEL_NAME;
    }
    if (process.env.HYPERLEDGER_CHAINCODE_NAME) {
      config.hyperledger.chaincodeName = process.env.HYPERLEDGER_CHAINCODE_NAME;
    }
    
    // MSP ID
    if (process.env.HYPERLEDGER_MSP_ID) {
      config.hyperledger.mspId = process.env.HYPERLEDGER_MSP_ID;
    }
    
    // Wallet path
    if (process.env.HYPERLEDGER_WALLET_PATH) {
      config.hyperledger.walletPath = process.env.HYPERLEDGER_WALLET_PATH;
    }
    
    // CA configuration
    if (process.env.HYPERLEDGER_CA_URL) {
      config.hyperledger.caUrl = process.env.HYPERLEDGER_CA_URL;
    }
    if (process.env.HYPERLEDGER_CA_NAME) {
      config.hyperledger.caName = process.env.HYPERLEDGER_CA_NAME;
    }
    
    // Admin credentials
    if (process.env.HYPERLEDGER_ADMIN_USER_ID) {
      config.hyperledger.adminUserId = process.env.HYPERLEDGER_ADMIN_USER_ID;
    }
    if (process.env.HYPERLEDGER_ADMIN_USER_SECRET) {
      config.hyperledger.adminUserSecret = process.env.HYPERLEDGER_ADMIN_USER_SECRET;
    }
    
    // User credentials
    if (process.env.HYPERLEDGER_USER_ID) {
      config.hyperledger.userId = process.env.HYPERLEDGER_USER_ID;
    }
    
    // TLS configuration
    if (process.env.HYPERLEDGER_TLS_ENABLED) {
      config.hyperledger.tlsEnabled = process.env.HYPERLEDGER_TLS_ENABLED === 'true';
    }
    if (process.env.HYPERLEDGER_TLS_CERT_PATH) {
      config.hyperledger.tlsCertPath = process.env.HYPERLEDGER_TLS_CERT_PATH;
    }
    
    // Peer and orderer endpoints
    if (process.env.HYPERLEDGER_PEER_ENDPOINT) {
      config.hyperledger.peerEndpoint = process.env.HYPERLEDGER_PEER_ENDPOINT;
    }
    if (process.env.HYPERLEDGER_PEER_HOSTNAME) {
      config.hyperledger.peerHostname = process.env.HYPERLEDGER_PEER_HOSTNAME;
    }
    if (process.env.HYPERLEDGER_ORDERER_ENDPOINT) {
      config.hyperledger.ordererEndpoint = process.env.HYPERLEDGER_ORDERER_ENDPOINT;
    }
    if (process.env.HYPERLEDGER_ORDERER_HOSTNAME) {
      config.hyperledger.ordererHostname = process.env.HYPERLEDGER_ORDERER_HOSTNAME;
    }
    if (process.env.HYPERLEDGER_ORDERER_TLS_CERT_PATH) {
      config.hyperledger.ordererTlsCertPath = process.env.HYPERLEDGER_ORDERER_TLS_CERT_PATH;
    }
    
    // Discovery configuration
    if (!config.hyperledger.discovery) {
      config.hyperledger.discovery = {};
    }
    if (process.env.HYPERLEDGER_DISCOVERY_ENABLED) {
      config.hyperledger.discovery.enabled = process.env.HYPERLEDGER_DISCOVERY_ENABLED === 'true';
    }
    if (process.env.HYPERLEDGER_DISCOVERY_AS_LOCALHOST) {
      config.hyperledger.discovery.asLocalhost = process.env.HYPERLEDGER_DISCOVERY_AS_LOCALHOST === 'true';
    }
    
    // Event handling
    if (!config.hyperledger.eventHandling) {
      config.hyperledger.eventHandling = {};
    }
    if (process.env.HYPERLEDGER_COMMIT_TIMEOUT) {
      config.hyperledger.eventHandling.commitTimeout = parseInt(process.env.HYPERLEDGER_COMMIT_TIMEOUT, 10);
    }
    if (process.env.HYPERLEDGER_ENDORSEMENT_TIMEOUT) {
      config.hyperledger.eventHandling.endorsementTimeout = parseInt(process.env.HYPERLEDGER_ENDORSEMENT_TIMEOUT, 10);
    }
    if (process.env.HYPERLEDGER_BLOCK_EVENT_LISTENER_ENABLED) {
      config.hyperledger.eventHandling.blockEventListenerEnabled = process.env.HYPERLEDGER_BLOCK_EVENT_LISTENER_ENABLED === 'true';
    }
  }
}

module.exports = {
  loadConfig
};
