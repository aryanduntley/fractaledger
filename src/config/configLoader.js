/**
 * Configuration Loader
 * 
 * This module loads and validates the configuration from config.json and environment variables.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

// Load environment variables from .env file
dotenv.config();

/**
 * Load configuration from config.json and environment variables
 * @returns {Object} The loaded and validated configuration
 */
async function loadConfig() {
  try {
    // Load configuration from config.json
    const configPath = path.resolve(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configJson = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configJson);
    
    // Validate configuration
    validateConfig(config);
    
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
      networkConfig: Joi.object({
        ordererUrl: Joi.string().required(),
        peerUrl: Joi.string().required(),
        channelName: Joi.string().required(),
        chaincodeName: Joi.string().required(),
        mspId: Joi.string().required(),
        walletPath: Joi.string().required(),
        connectionProfilePath: Joi.string().required()
      }).required(),
      adminUser: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
      }).required()
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
    }).required()
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
}

module.exports = {
  loadConfig
};
