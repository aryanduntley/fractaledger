/**
 * API Connector
 * 
 * This module provides a production-ready connector for interacting with blockchain API services.
 * It includes connection pooling, retry mechanisms, caching, and comprehensive error handling.
 */

const { BlockchainConnector } = require('../blockchainConnector');
const axios = require('axios');
const bitcoinjs = require('bitcoinjs-lib');
const bs58check = require('bs58check');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-connector' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/api-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/api.log' })
  ]
});

/**
 * API Connector class
 * @extends BlockchainConnector
 */
class ApiConnector extends BlockchainConnector {
  /**
   * Create a new API connector
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {Object} config The connector configuration
   */
  constructor(blockchain, config) {
    super(blockchain, config);
    
    this.name = config.name;
    this.walletAddress = config.walletAddress;
    this.secret = config.secret;
    
    // Extract connection details
    this.provider = config.connectionDetails.provider || 'blockCypher';
    this.endpoint = config.connectionDetails.endpoint || this.getDefaultEndpoint(blockchain);
    this.apiKey = config.connectionDetails.apiKey || '';
    this.network = config.connectionDetails.network || 'mainnet';
    
    // Connection pool configuration
    this.providerPool = config.connectionDetails.providerPool || [this.provider];
    this.endpointPool = config.connectionDetails.endpointPool || [this.endpoint];
    this.apiKeyPool = config.connectionDetails.apiKeyPool || [this.apiKey];
    this.currentProviderIndex = 0;
    
    // Retry configuration
    this.maxRetries = config.connectionDetails.maxRetries || 3;
    this.retryDelay = config.connectionDetails.retryDelay || 1000; // 1 second
    this.maxRetryDelay = config.connectionDetails.maxRetryDelay || 30000; // 30 seconds
    
    // Rate limiting configuration
    this.rateLimitPerMinute = config.connectionDetails.rateLimitPerMinute || 60;
    this.requestCount = 0;
    this.requestResetTime = Date.now() + 60000; // 1 minute
    
    // Caching configuration
    this.cacheEnabled = config.connectionDetails.cacheEnabled !== false;
    this.cacheExpiry = config.connectionDetails.cacheExpiry || 60000; // 1 minute
    this.balanceCache = null;
    this.balanceCacheTime = 0;
    this.transactionCache = new Map();
    this.blockchainInfoCache = null;
    this.blockchainInfoCacheTime = 0;
    this.feeEstimatesCache = null;
    this.feeEstimatesCacheTime = 0;
    
    // Circuit breaker configuration
    this.circuitBreakerEnabled = config.connectionDetails.circuitBreakerEnabled !== false;
    this.failureThreshold = config.connectionDetails.failureThreshold || 5;
    this.resetTimeout = config.connectionDetails.resetTimeout || 60000; // 1 minute
    this.failureCount = 0;
    this.circuitOpen = false;
    this.circuitOpenTime = 0;
    
    logger.info(`Created API connector for ${blockchain}/${this.name} using ${this.provider}`);
    
    // Initialize the client
    this.client = null;
    this.initializeClient();
  }
  
  /**
   * Get the default endpoint for a blockchain
   * @param {string} blockchain The blockchain type
   * @returns {string} The default endpoint
   */
  getDefaultEndpoint(blockchain) {
    switch (this.provider) {
      case 'blockCypher':
        switch (blockchain) {
          case 'bitcoin':
            return 'https://api.blockcypher.com/v1/btc/main';
          case 'litecoin':
            return 'https://api.blockcypher.com/v1/ltc/main';
          case 'dogecoin':
            return 'https://api.blockcypher.com/v1/doge/main';
          default:
            throw new Error(`Unsupported blockchain for BlockCypher: ${blockchain}`);
        }
      case 'blockstream':
        return 'https://blockstream.info/api';
      case 'blockchair':
        return 'https://api.blockchair.com';
      default:
        throw new Error(`Unsupported API provider: ${this.provider}`);
    }
  }
  
  /**
   * Initialize the API client
   */
  initializeClient() {
    // Create a client based on the provider
    switch (this.provider) {
      case 'blockCypher':
        this.initializeBlockCypherClient();
        break;
      case 'blockstream':
        this.initializeBlockstreamClient();
        break;
      case 'blockchair':
        this.initializeBlockchairClient();
        break;
      default:
        throw new Error(`Unsupported API provider: ${this.provider}`);
    }
  }
  
  /**
   * Initialize the BlockCypher client
   */
  initializeBlockCypherClient() {
    const apiKey = this.apiKey ? `?token=${this.apiKey}` : '';
    
    this.client = {
      /**
       * Get address information
       * @param {string} address The address to get information for
       * @returns {Promise<Object>} The address information
       */
      getAddress: async (address) => {
        try {
          const response = await axios.get(`${this.endpoint}/addrs/${address}${apiKey}`);
          return response.data;
        } catch (error) {
          throw new Error(`Failed to get address information: ${error.message}`);
        }
      },
      
      /**
       * Get transaction information
       * @param {string} txid The transaction ID
       * @returns {Promise<Object>} The transaction information
       */
      getTransaction: async (txid) => {
        try {
          const response = await axios.get(`${this.endpoint}/txs/${txid}${apiKey}`);
          return response.data;
        } catch (error) {
          throw new Error(`Failed to get transaction information: ${error.message}`);
        }
      },
      
      /**
       * Get blockchain information
       * @returns {Promise<Object>} The blockchain information
       */
      getBlockchainInfo: async () => {
        try {
          const response = await axios.get(`${this.endpoint}${apiKey}`);
          return response.data;
        } catch (error) {
          throw new Error(`Failed to get blockchain information: ${error.message}`);
        }
      },
      
      /**
       * Create and send a transaction
       * @param {Object} tx The transaction to send
       * @returns {Promise<Object>} The transaction result
       */
      sendTransaction: async (tx) => {
        try {
          const response = await axios.post(`${this.endpoint}/txs/push${apiKey}`, {
            tx: tx
          });
          return response.data;
        } catch (error) {
          throw new Error(`Failed to send transaction: ${error.message}`);
        }
      },
      
      /**
       * Create a new transaction
       * @param {Array} inputs The transaction inputs
       * @param {Array} outputs The transaction outputs
       * @returns {Promise<Object>} The created transaction
       */
      createTransaction: async (inputs, outputs) => {
        try {
          const response = await axios.post(`${this.endpoint}/txs/new${apiKey}`, {
            inputs,
            outputs
          });
          return response.data;
        } catch (error) {
          throw new Error(`Failed to create transaction: ${error.message}`);
        }
      },
      
      /**
       * Get fee estimates
       * @returns {Promise<Object>} The fee estimates
       */
      getFeeEstimates: async () => {
        try {
          const response = await axios.get(`${this.endpoint}${apiKey}`);
          return {
            low: response.data.low_fee_per_kb / 1000,
            medium: response.data.medium_fee_per_kb / 1000,
            high: response.data.high_fee_per_kb / 1000
          };
        } catch (error) {
          throw new Error(`Failed to get fee estimates: ${error.message}`);
        }
      },
      
      /**
       * Verify if the wallet is UTXO-based
       * @returns {Promise<boolean>} True if the wallet is UTXO-based
       */
      verifyUtxoWallet: async () => {
        try {
          // All supported blockchains in BlockCypher are UTXO-based
          return true;
        } catch (error) {
          throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
        }
      }
    };
  }
  
  /**
   * Initialize the Blockstream client
   */
  initializeBlockstreamClient() {
    this.client = {
      /**
       * Get address information
       * @param {string} address The address to get information for
       * @returns {Promise<Object>} The address information
       */
      getAddress: async (address) => {
        try {
          const response = await axios.get(`${this.endpoint}/address/${address}`);
          const utxos = await axios.get(`${this.endpoint}/address/${address}/utxo`);
          
          return {
            address,
            balance: utxos.data.reduce((total, utxo) => total + utxo.value, 0) / 100000000,
            utxos: utxos.data
          };
        } catch (error) {
          throw new Error(`Failed to get address information: ${error.message}`);
        }
      },
      
      /**
       * Get transaction information
       * @param {string} txid The transaction ID
       * @returns {Promise<Object>} The transaction information
       */
      getTransaction: async (txid) => {
        try {
          const response = await axios.get(`${this.endpoint}/tx/${txid}`);
          return response.data;
        } catch (error) {
          throw new Error(`Failed to get transaction information: ${error.message}`);
        }
      },
      
      /**
       * Get blockchain information
       * @returns {Promise<Object>} The blockchain information
       */
      getBlockchainInfo: async () => {
        try {
          const response = await axios.get(`${this.endpoint}/blocks/tip/height`);
          return {
            height: parseInt(response.data)
          };
        } catch (error) {
          throw new Error(`Failed to get blockchain information: ${error.message}`);
        }
      },
      
      /**
       * Send a transaction
       * @param {string} txHex The transaction hex
       * @returns {Promise<string>} The transaction ID
       */
      sendTransaction: async (txHex) => {
        try {
          const response = await axios.post(`${this.endpoint}/tx`, txHex);
          return response.data;
        } catch (error) {
          throw new Error(`Failed to send transaction: ${error.message}`);
        }
      },
      
      /**
       * Get fee estimates
       * @returns {Promise<Object>} The fee estimates
       */
      getFeeEstimates: async () => {
        try {
          const response = await axios.get(`${this.endpoint}/fee-estimates`);
          return {
            low: response.data['1'] / 100000000,
            medium: response.data['6'] / 100000000,
            high: response.data['144'] / 100000000
          };
        } catch (error) {
          throw new Error(`Failed to get fee estimates: ${error.message}`);
        }
      },
      
      /**
       * Verify if the wallet is UTXO-based
       * @returns {Promise<boolean>} True if the wallet is UTXO-based
       */
      verifyUtxoWallet: async () => {
        try {
          // Blockstream only supports Bitcoin, which is UTXO-based
          return true;
        } catch (error) {
          throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
        }
      }
    };
  }
  
  /**
   * Initialize the Blockchair client
   */
  initializeBlockchairClient() {
    const apiKey = this.apiKey ? `?key=${this.apiKey}` : '';
    const blockchainPath = this.getBlockchainPath();
    
    this.client = {
      /**
       * Get address information
       * @param {string} address The address to get information for
       * @returns {Promise<Object>} The address information
       */
      getAddress: async (address) => {
        try {
          const response = await axios.get(`${this.endpoint}/${blockchainPath}/dashboards/address/${address}${apiKey}`);
          return response.data.data[address];
        } catch (error) {
          throw new Error(`Failed to get address information: ${error.message}`);
        }
      },
      
      /**
       * Get transaction information
       * @param {string} txid The transaction ID
       * @returns {Promise<Object>} The transaction information
       */
      getTransaction: async (txid) => {
        try {
          const response = await axios.get(`${this.endpoint}/${blockchainPath}/dashboards/transaction/${txid}${apiKey}`);
          return response.data.data[txid];
        } catch (error) {
          throw new Error(`Failed to get transaction information: ${error.message}`);
        }
      },
      
      /**
       * Get blockchain information
       * @returns {Promise<Object>} The blockchain information
       */
      getBlockchainInfo: async () => {
        try {
          const response = await axios.get(`${this.endpoint}/${blockchainPath}/stats${apiKey}`);
          return response.data.data;
        } catch (error) {
          throw new Error(`Failed to get blockchain information: ${error.message}`);
        }
      },
      
      /**
       * Send a transaction
       * @param {string} txHex The transaction hex
       * @returns {Promise<string>} The transaction ID
       */
      sendTransaction: async (txHex) => {
        try {
          const response = await axios.post(`${this.endpoint}/${blockchainPath}/push/transaction${apiKey}`, {
            data: txHex
          });
          
          if (response.data.context.code !== 200) {
            throw new Error(response.data.context.error);
          }
          
          return response.data.data.transaction_hash;
        } catch (error) {
          throw new Error(`Failed to send transaction: ${error.message}`);
        }
      },
      
      /**
       * Get fee estimates
       * @returns {Promise<Object>} The fee estimates
       */
      getFeeEstimates: async () => {
        try {
          const response = await axios.get(`${this.endpoint}/${blockchainPath}/stats${apiKey}`);
          return {
            low: response.data.data.suggested_transaction_fee_per_byte_sat / 100000000,
            medium: (response.data.data.suggested_transaction_fee_per_byte_sat * 2) / 100000000,
            high: (response.data.data.suggested_transaction_fee_per_byte_sat * 5) / 100000000
          };
        } catch (error) {
          throw new Error(`Failed to get fee estimates: ${error.message}`);
        }
      },
      
      /**
       * Verify if the wallet is UTXO-based
       * @returns {Promise<boolean>} True if the wallet is UTXO-based
       */
      verifyUtxoWallet: async () => {
        try {
          // Check if the blockchain is UTXO-based
          return ['bitcoin', 'litecoin', 'dogecoin', 'dash', 'bitcoin-cash', 'bitcoin-sv', 'groestlcoin', 'zcash'].includes(blockchainPath);
        } catch (error) {
          throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
        }
      }
    };
  }
  
  /**
   * Get the blockchain path for Blockchair API
   * @returns {string} The blockchain path
   */
  getBlockchainPath() {
    switch (this.blockchain) {
      case 'bitcoin':
        return 'bitcoin';
      case 'litecoin':
        return 'litecoin';
      case 'dogecoin':
        return 'dogecoin';
      default:
        throw new Error(`Unsupported blockchain for Blockchair: ${this.blockchain}`);
    }
  }
  
  /**
   * Check if the circuit breaker is open
   * @returns {boolean} True if the circuit breaker is open
   * @private
   */
  _isCircuitOpen() {
    if (!this.circuitBreakerEnabled) {
      return false;
    }
    
    // If the circuit is open, check if the reset timeout has elapsed
    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.circuitOpenTime > this.resetTimeout) {
        // Reset the circuit breaker
        logger.info(`Resetting circuit breaker for ${this.blockchain}/${this.name}`);
        this.circuitOpen = false;
        this.failureCount = 0;
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle a request failure
   * @private
   */
  _handleFailure() {
    if (!this.circuitBreakerEnabled) {
      return;
    }
    
    this.failureCount++;
    
    // If we've reached the failure threshold, open the circuit
    if (this.failureCount >= this.failureThreshold) {
      logger.warn(`Circuit breaker tripped for ${this.blockchain}/${this.name} after ${this.failureCount} failures`);
      this.circuitOpen = true;
      this.circuitOpenTime = Date.now();
    }
  }
  
  /**
   * Handle a request success
   * @private
   */
  _handleSuccess() {
    if (!this.circuitBreakerEnabled) {
      return;
    }
    
    // Reset the failure count on success
    this.failureCount = 0;
  }
  
  /**
   * Check if we've exceeded the rate limit
   * @returns {boolean} True if we've exceeded the rate limit
   * @private
   */
  _isRateLimited() {
    const now = Date.now();
    
    // Reset the request count if the reset time has elapsed
    if (now > this.requestResetTime) {
      this.requestCount = 0;
      this.requestResetTime = now + 60000; // 1 minute
    }
    
    // Check if we've exceeded the rate limit
    return this.requestCount >= this.rateLimitPerMinute;
  }
  
  /**
   * Increment the request count
   * @private
   */
  _incrementRequestCount() {
    this.requestCount++;
  }
  
  /**
   * Switch to the next provider in the pool
   * @private
   */
  _switchProvider() {
    // Increment the provider index
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerPool.length;
    
    // Update the provider, endpoint, and API key
    this.provider = this.providerPool[this.currentProviderIndex];
    this.endpoint = this.endpointPool[this.currentProviderIndex % this.endpointPool.length];
    this.apiKey = this.apiKeyPool[this.currentProviderIndex % this.apiKeyPool.length];
    
    logger.info(`Switching to provider ${this.provider} with endpoint ${this.endpoint}`);
    
    // Reinitialize the client
    this.initializeClient();
  }
  
  /**
   * Execute a method with retry logic and circuit breaker
   * @param {Function} method The method to execute
   * @param {Array} args The arguments to pass to the method
   * @returns {Promise<any>} The result of the method
   * @private
   */
  async _executeWithRetry(method, args = []) {
    // Check if the circuit breaker is open
    if (this._isCircuitOpen()) {
      logger.warn(`Circuit breaker open for ${this.blockchain}/${this.name}, rejecting request`);
      throw new Error('Service unavailable due to circuit breaker');
    }
    
    // Check if we've exceeded the rate limit
    if (this._isRateLimited()) {
      logger.warn(`Rate limit exceeded for ${this.blockchain}/${this.name}, rejecting request`);
      throw new Error('Rate limit exceeded');
    }
    
    // Increment the request count
    this._incrementRequestCount();
    
    let retries = 0;
    let delay = this.retryDelay;
    
    while (true) {
      try {
        // Execute the method
        const result = await method(...args);
        
        // Handle success
        this._handleSuccess();
        
        return result;
      } catch (error) {
        // Handle failure
        this._handleFailure();
        
        // If we've exhausted all retries, throw the error
        if (retries >= this.maxRetries) {
          // If we have multiple providers, try switching to the next one
          if (this.providerPool.length > 1) {
            logger.warn(`Switching provider after ${retries} failed retries`);
            this._switchProvider();
            
            // Reset retries and try again with the new provider
            retries = 0;
            delay = this.retryDelay;
            continue;
          }
          
          logger.error(`Failed after ${retries} retries: ${error.message}`);
          throw error;
        }
        
        // Wait before retrying
        logger.warn(`Retrying after error: ${error.message} (${retries + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase the delay for the next retry (exponential backoff)
        delay = Math.min(delay * 2, this.maxRetryDelay);
        
        // Increment the retry count
        retries++;
      }
    }
  }
  
  /**
   * Test the connection to the API
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    try {
      // Test the connection by getting blockchain information
      await this._executeWithRetry(async () => {
        return await this.client.getBlockchainInfo();
      });
      
      logger.info(`Successfully connected to ${this.blockchain} API using ${this.provider}`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to ${this.blockchain} API: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the balance of the wallet
   * @returns {Promise<number>} The wallet balance
   */
  async getBalance() {
    try {
      // Check if we have a cached balance that's still valid
      const now = Date.now();
      if (this.cacheEnabled && this.balanceCache !== null && now - this.balanceCacheTime < this.cacheExpiry) {
        logger.debug(`Using cached balance for ${this.blockchain}/${this.name}`);
        return this.balanceCache;
      }
      
      // Get the balance from the API
      const addressInfo = await this._executeWithRetry(async () => {
        return await this.client.getAddress(this.walletAddress);
      });
      
      // Different APIs return balance in different formats
      let balance;
      if (this.provider === 'blockCypher') {
        balance = addressInfo.balance / 100000000; // Convert from satoshis to BTC
      } else if (this.provider === 'blockstream') {
        balance = addressInfo.balance; // Already converted in getAddress
      } else if (this.provider === 'blockchair') {
        balance = addressInfo.address.balance / 100000000; // Convert from satoshis to BTC
      } else {
        throw new Error(`Unsupported API provider: ${this.provider}`);
      }
      
      // Cache the balance
      if (this.cacheEnabled) {
        this.balanceCache = balance;
        this.balanceCacheTime = now;
      }
      
      logger.info(`Balance for ${this.blockchain}/${this.name}: ${balance}`);
      
      return balance;
    } catch (error) {
      logger.error(`Failed to get balance: ${error.message}`);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }
  
  /**
   * Get the transaction history of the wallet
   * @param {number} limit The maximum number of transactions to return
   * @returns {Promise<Array>} The transaction history
   */
  async getTransactionHistory(limit = 10) {
    try {
      // Get the address information from the API
      const addressInfo = await this._executeWithRetry(async () => {
        return await this.client.getAddress(this.walletAddress);
      });
      
      // Different APIs return transaction history in different formats
      if (this.provider === 'blockCypher') {
        const transactions = addressInfo.txrefs
          .slice(0, limit)
          .map(tx => {
            // Check if we have the transaction in the cache
            const txid = tx.tx_hash;
            if (this.cacheEnabled && this.transactionCache.has(txid)) {
              logger.debug(`Using cached transaction ${txid} for ${this.blockchain}/${this.name}`);
              return this.transactionCache.get(txid);
            }
            
            // Create the transaction object
            const transaction = {
              txid,
              amount: tx.value / 100000000, // Convert from satoshis to BTC
              confirmations: tx.confirmations,
              timestamp: new Date(tx.confirmed).toISOString(),
              type: tx.spent ? 'sent' : 'received'
            };
            
            // Cache the transaction
            if (this.cacheEnabled) {
              this.transactionCache.set(txid, transaction);
            }
            
            return transaction;
          });
        
        logger.info(`Retrieved ${transactions.length} transactions for ${this.blockchain}/${this.name}`);
        return transactions;
      } else if (this.provider === 'blockstream') {
        const txids = addressInfo.utxos.map(utxo => utxo.txid);
        const transactions = [];
        
        for (let i = 0; i < Math.min(txids.length, limit); i++) {
          const txid = txids[i];
          
          // Check if we have the transaction in the cache
          if (this.cacheEnabled && this.transactionCache.has(txid)) {
            logger.debug(`Using cached transaction ${txid} for ${this.blockchain}/${this.name}`);
            transactions.push(this.transactionCache.get(txid));
            continue;
          }
          
          // Get the transaction details
          const tx = await this._executeWithRetry(async () => {
            return await this.client.getTransaction(txid);
          });
          
          // Create the transaction object
          const transaction = {
            txid: tx.txid,
            amount: tx.vout.reduce((total, output) => {
              if (output.scriptpubkey_address === this.walletAddress) {
                return total + output.value / 100000000; // Convert from satoshis to BTC
              }
              return total;
            }, 0),
            confirmations: tx.status.confirmed ? tx.status.block_height : 0,
            timestamp: tx.status.confirmed ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString(),
            type: 'unknown' // Need to analyze inputs and outputs to determine type
          };
          
          // Cache the transaction
          if (this.cacheEnabled) {
            this.transactionCache.set(txid, transaction);
          }
          
          transactions.push(transaction);
        }
        
        logger.info(`Retrieved ${transactions.length} transactions for ${this.blockchain}/${this.name}`);
        return transactions;
      } else if (this.provider === 'blockchair') {
        const transactions = [];
        const txids = addressInfo.transactions.slice(0, limit);
        
        for (const txid of txids) {
          // Check if we have the transaction in the cache
          if (this.cacheEnabled && this.transactionCache.has(txid)) {
            logger.debug(`Using cached transaction ${txid} for ${this.blockchain}/${this.name}`);
            transactions.push(this.transactionCache.get(txid));
            continue;
          }
          
          // Get the transaction details
          const tx = await this._executeWithRetry(async () => {
            return await this.client.getTransaction(txid);
          });
          
          // Create the transaction object
          const transaction = {
            txid,
            amount: tx.transaction.output_total / 100000000, // Convert from satoshis to BTC
            confirmations: tx.transaction.confirmations,
            timestamp: new Date(tx.transaction.time * 1000).toISOString(),
            type: 'unknown' // Need to analyze inputs and outputs to determine type
          };
          
          // Cache the transaction
          if (this.cacheEnabled) {
            this.transactionCache.set(txid, transaction);
          }
          
          transactions.push(transaction);
        }
        
        logger.info(`Retrieved ${transactions.length} transactions for ${this.blockchain}/${this.name}`);
        return transactions;
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
    } catch (error) {
      logger.error(`Failed to get transaction history: ${error.message}`);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }
  
  /**
   * Send a transaction from the wallet
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<string>} The transaction ID
   */
  async sendTransaction(toAddress, amount, options = {}) {
    try {
      logger.info(`Sending ${amount} ${this.blockchain} to ${toAddress}`);
      
      // Validate the address
      const isValid = await this._executeWithRetry(async () => {
        return await this.verifyAddress(toAddress);
      });
      
      if (!isValid) {
        throw new Error(`Invalid address: ${toAddress}`);
      }
      
      // Different APIs handle transaction creation and sending differently
      if (this.provider === 'blockCypher') {
        // Create a new transaction
        const newtx = {
          inputs: [{ addresses: [this.walletAddress] }],
          outputs: [{ addresses: [toAddress], value: Math.round(amount * 100000000) }] // Convert from BTC to satoshis
        };
        
        const txSkeleton = await this._executeWithRetry(async () => {
          return await this.client.createTransaction(newtx.inputs, newtx.outputs);
        });
        
        // Sign the transaction inputs
        const network = this.network === 'mainnet' ? bitcoinjs.networks.bitcoin : bitcoinjs.networks.testnet;
        const keyPair = bitcoinjs.ECPair.fromWIF(this.secret, network);
        
        txSkeleton.pubkeys = [];
        txSkeleton.signatures = txSkeleton.tosign.map((tosign, i) => {
          txSkeleton.pubkeys.push(keyPair.publicKey.toString('hex'));
          return bitcoinjs.script.signature.encode(
            keyPair.sign(Buffer.from(tosign, 'hex')),
            0x01 // SIGHASH_ALL
          ).toString('hex').slice(0, -2); // Remove the SIGHASH_ALL byte
        });
        
        // Send the signed transaction
        const finalTx = await this._executeWithRetry(async () => {
          return await this.client.sendTransaction(txSkeleton);
        });
        
        logger.info(`Transaction sent: ${finalTx.tx.hash}`);
        
        // Invalidate the balance cache
        this.balanceCache = null;
        
        return finalTx.tx.hash;
      } else if (this.provider === 'blockstream' || this.provider === 'blockchair') {
        // For Blockstream and Blockchair, we need to create and sign the transaction manually
        
        // Get the UTXOs for the wallet
        const addressInfo = await this._executeWithRetry(async () => {
          return await this.client.getAddress(this.walletAddress);
        });
        
        const utxos = this.provider === 'blockstream' ? addressInfo.utxos : addressInfo.utxo;
        
        // Calculate the total available balance
        const totalAvailable = utxos.reduce((total, utxo) => total + utxo.value, 0) / 100000000; // Convert from satoshis to BTC
        
        // Check if there's enough balance
        if (totalAvailable < amount + (options.fee || 0)) {
          throw new Error(`Insufficient balance: ${totalAvailable} < ${amount + (options.fee || 0)}`);
        }
        
        // Create a transaction builder
        const network = this.network === 'mainnet' ? bitcoinjs.networks.bitcoin : bitcoinjs.networks.testnet;
        const txb = new bitcoinjs.TransactionBuilder(network);
        
        // Add the inputs
        let inputAmount = 0;
        for (const utxo of utxos) {
          txb.addInput(utxo.txid, utxo.vout);
          inputAmount += utxo.value / 100000000; // Convert from satoshis to BTC
          
          // If we have enough inputs, stop adding more
          if (inputAmount >= amount + (options.fee || 0)) {
            break;
          }
        }
        
        // Add the output
        txb.addOutput(toAddress, Math.round(amount * 100000000)); // Convert from BTC to satoshis
        
        // Add change output if necessary
        const fee = options.fee || 0.0001; // Default fee
        const change = inputAmount - amount - fee;
        if (change > 0) {
          txb.addOutput(this.walletAddress, Math.round(change * 100000000)); // Convert from BTC to satoshis
        }
        
        // Sign the inputs
        const keyPair = bitcoinjs.ECPair.fromWIF(this.secret, network);
        for (let i = 0; i < txb.inputs.length; i++) {
          txb.sign(i, keyPair);
        }
        
        // Build the transaction
        const tx = txb.build();
        const txHex = tx.toHex();
        
        // Send the transaction
        const txid = await this._executeWithRetry(async () => {
          return await this.client.sendTransaction(txHex);
        });
        
        logger.info(`Transaction sent: ${txid}`);
        
        // Invalidate the balance cache
        this.balanceCache = null;
        
        return txid;
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
    } catch (error) {
      logger.error(`Failed to send transaction: ${error.message}`);
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
  }
  
  /**
   * Verify if an address is valid
   * @param {string} address The address to verify
   * @returns {Promise<boolean>} True if the address is valid
   */
  async verifyAddress(address) {
    try {
      // Use bitcoinjs-lib to validate the address
      const network = this.network === 'mainnet' ? bitcoinjs.networks.bitcoin : bitcoinjs.networks.testnet;
      
      try {
        bitcoinjs.address.toOutputScript(address, network);
        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      throw new Error(`Failed to verify address: ${error.message}`);
    }
  }
  
  /**
   * Estimate the fee for a transaction
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<number>} The estimated fee
   */
  async estimateFee(toAddress, amount, options = {}) {
    try {
      // Check if we have cached fee estimates that are still valid
      const now = Date.now();
      if (this.cacheEnabled && this.feeEstimatesCache !== null && now - this.feeEstimatesCacheTime < this.cacheExpiry) {
        logger.debug(`Using cached fee estimates for ${this.blockchain}/${this.name}`);
        const feeLevel = options.feeLevel || 'medium';
        return this.feeEstimatesCache[feeLevel];
      }
      
      // Get fee estimates from the API
      const feeEstimates = await this._executeWithRetry(async () => {
        return await this.client.getFeeEstimates();
      });
      
      // Cache the fee estimates
      if (this.cacheEnabled) {
        this.feeEstimatesCache = feeEstimates;
        this.feeEstimatesCacheTime = now;
      }
      
      // Use the specified fee level or default to medium
      const feeLevel = options.feeLevel || 'medium';
      
      logger.info(`Fee estimate for ${this.blockchain}/${this.name} (${feeLevel}): ${feeEstimates[feeLevel]}`);
      
      return feeEstimates[feeLevel];
    } catch (error) {
      // If fee estimation fails, return a default fee
      logger.warn(`Failed to estimate fee: ${error.message}. Using default fee.`);
      return 0.0001; // Default fee
    }
  }
  
  /**
   * Get the current blockchain height
   * @returns {Promise<number>} The blockchain height
   */
  async getBlockchainHeight() {
    try {
      // Check if we have cached blockchain info that's still valid
      const now = Date.now();
      if (this.cacheEnabled && this.blockchainInfoCache !== null && now - this.blockchainInfoCacheTime < this.cacheExpiry) {
        logger.debug(`Using cached blockchain info for ${this.blockchain}/${this.name}`);
        return this.blockchainInfoCache;
      }
      
      // Get blockchain info from the API
      const info = await this._executeWithRetry(async () => {
        return await this.client.getBlockchainInfo();
      });
      
      // Different APIs return blockchain height in different formats
      let height;
      if (this.provider === 'blockCypher') {
        height = info.height;
      } else if (this.provider === 'blockstream') {
        height = info.height;
      } else if (this.provider === 'blockchair') {
        height = info.blocks;
      } else {
        throw new Error(`Unsupported API provider: ${this.provider}`);
      }
      
      // Cache the blockchain height
      if (this.cacheEnabled) {
        this.blockchainInfoCache = height;
        this.blockchainInfoCacheTime = now;
      }
      
      logger.info(`Blockchain height for ${this.blockchain}/${this.name}: ${height}`);
      
      return height;
    } catch (error) {
      logger.error(`Failed to get blockchain height: ${error.message}`);
      throw new Error(`Failed to get blockchain height: ${error.message}`);
    }
  }
  
  /**
   * Get a transaction by ID
   * @param {string} txid The transaction ID
   * @returns {Promise<Object>} The transaction details
   */
  async getTransaction(txid) {
    try {
      // Check if we have the transaction in the cache
      if (this.cacheEnabled && this.transactionCache.has(txid)) {
        logger.debug(`Using cached transaction ${txid} for ${this.blockchain}/${this.name}`);
        return this.transactionCache.get(txid);
      }
      
      // Get the transaction from the API
      const tx = await this._executeWithRetry(async () => {
        return await this.client.getTransaction(txid);
      });
      
      // Cache the transaction
      if (this.cacheEnabled) {
        this.transactionCache.set(txid, tx);
      }
      
      logger.info(`Retrieved transaction ${txid} for ${this.blockchain}/${this.name}`);
      
      return tx;
    } catch (error) {
      logger.error(`Failed to get transaction: ${error.message}`);
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }
  
  /**
   * Verify if the wallet is UTXO-based
   * @returns {Promise<boolean>} True if the wallet is UTXO-based
   */
  async verifyUtxoWallet() {
    try {
      const result = await this._executeWithRetry(async () => {
        return await this.client.verifyUtxoWallet();
      });
      
      logger.info(`UTXO wallet verification for ${this.blockchain}/${this.name}: ${result}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to verify UTXO wallet: ${error.message}`);
      throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
    }
  }
}

module.exports = {
  ApiConnector
};
