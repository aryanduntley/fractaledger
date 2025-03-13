/**
 * Full Node Connector
 * 
 * This module provides a production-ready connector for interacting with a full node via RPC.
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
  defaultMeta: { service: 'fullnode-connector' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/fullnode-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/fullnode.log' })
  ]
});

/**
 * Full Node Connector class
 * @extends BlockchainConnector
 */
class FullNodeConnector extends BlockchainConnector {
  /**
   * Create a new full node connector
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {Object} config The connector configuration
   */
  constructor(blockchain, config) {
    super(blockchain, config);
    
    this.name = config.name;
    this.walletAddress = config.walletAddress;
    this.secret = config.secret;
    
    // Extract connection details
    this.host = config.connectionDetails.host || 'localhost';
    this.port = config.connectionDetails.port || this.getDefaultPort(blockchain);
    this.username = config.connectionDetails.username || '';
    this.password = config.connectionDetails.password || '';
    this.protocol = config.connectionDetails.protocol || 'http';
    this.network = config.connectionDetails.network || 'mainnet';
    
    // Connection pool configuration
    this.nodePool = config.connectionDetails.nodePool || [{
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      protocol: this.protocol
    }];
    this.currentNodeIndex = 0;
    
    // Retry configuration
    this.maxRetries = config.connectionDetails.maxRetries || 3;
    this.retryDelay = config.connectionDetails.retryDelay || 1000; // 1 second
    this.maxRetryDelay = config.connectionDetails.maxRetryDelay || 30000; // 30 seconds
    
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
    
    logger.info(`Created full node connector for ${blockchain}/${this.name} using ${this.protocol}://${this.host}:${this.port}`);
    
    // Initialize the client
    this.client = null;
    this.initializeClient();
  }
  
  /**
   * Get the default port for a blockchain
   * @param {string} blockchain The blockchain type
   * @returns {number} The default port
   */
  getDefaultPort(blockchain) {
    switch (blockchain) {
      case 'bitcoin':
        return 8332; // Bitcoin RPC port
      case 'litecoin':
        return 9332; // Litecoin RPC port
      case 'dogecoin':
        return 22555; // Dogecoin RPC port
      default:
        throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
  }
  
  /**
   * Initialize the RPC client
   */
  initializeClient() {
    const node = this.nodePool[this.currentNodeIndex];
    this.host = node.host;
    this.port = node.port;
    this.username = node.username;
    this.password = node.password;
    this.protocol = node.protocol;
    
    const url = `${this.protocol}://${this.host}:${this.port}`;
    const auth = {
      username: this.username,
      password: this.password
    };
    
    logger.info(`Initializing RPC client for ${this.blockchain}/${this.name} at ${url}`);
    
    this.client = {
      /**
       * Make an RPC call to the full node
       * @param {string} method The RPC method to call
       * @param {Array} params The parameters to pass to the method
       * @returns {Promise<any>} The response from the RPC call
       */
      call: async (method, params = []) => {
        try {
          const response = await axios.post(url, {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
          }, {
            auth,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data.error) {
            throw new Error(`RPC error: ${response.data.error.message}`);
          }
          
          return response.data.result;
        } catch (error) {
          throw new Error(`Failed to make RPC call: ${error.message}`);
        }
      }
    };
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
   * Switch to the next node in the pool
   * @private
   */
  _switchNode() {
    // Increment the node index
    this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodePool.length;
    
    // Reinitialize the client with the new node
    this.initializeClient();
    
    logger.info(`Switched to node ${this.currentNodeIndex} for ${this.blockchain}/${this.name}`);
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
          // If we have multiple nodes, try switching to the next one
          if (this.nodePool.length > 1) {
            logger.warn(`Switching node after ${retries} failed retries`);
            this._switchNode();
            
            // Reset retries and try again with the new node
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
   * Test the connection to the full node
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    try {
      // Call the getblockchaininfo method to test the connection
      await this._executeWithRetry(async () => {
        return await this.client.call('getblockchaininfo');
      });
      
      logger.info(`Successfully connected to ${this.blockchain} full node at ${this.protocol}://${this.host}:${this.port}`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to ${this.blockchain} full node: ${error.message}`);
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
      
      // For UTXO-based blockchains, we need to get the unspent transaction outputs
      const utxos = await this._executeWithRetry(async () => {
        return await this.client.call('listunspent', [0, 9999999, [this.walletAddress]]);
      });
      
      // Calculate the total balance
      const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);
      
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
      // Get the list of transactions for the wallet
      const transactions = await this._executeWithRetry(async () => {
        return await this.client.call('listtransactions', ['*', limit, 0, true]);
      });
      
      // Filter transactions for the wallet address
      const filteredTransactions = transactions.filter(tx => 
        tx.address === this.walletAddress || 
        (tx.vout && tx.vout.some(output => output.scriptPubKey.addresses.includes(this.walletAddress)))
      );
      
      // Format the transactions and cache them
      const formattedTransactions = filteredTransactions.map(tx => {
        const transaction = {
          txid: tx.txid,
          amount: tx.amount,
          confirmations: tx.confirmations,
          timestamp: new Date(tx.time * 1000).toISOString(),
          type: tx.category
        };
        
        // Cache the transaction
        if (this.cacheEnabled) {
          this.transactionCache.set(tx.txid, transaction);
        }
        
        return transaction;
      });
      
      logger.info(`Retrieved ${formattedTransactions.length} transactions for ${this.blockchain}/${this.name}`);
      
      return formattedTransactions;
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
      
      // Create a raw transaction
      const utxos = await this._executeWithRetry(async () => {
        return await this.client.call('listunspent', [0, 9999999, [this.walletAddress]]);
      });
      
      // Calculate the total available balance
      const totalAvailable = utxos.reduce((total, utxo) => total + utxo.amount, 0);
      
      // Check if there's enough balance
      if (totalAvailable < amount + (options.fee || 0)) {
        throw new Error(`Insufficient balance: ${totalAvailable} < ${amount + (options.fee || 0)}`);
      }
      
      // Create the transaction inputs
      const inputs = utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout
      }));
      
      // Create the transaction outputs
      const outputs = {};
      outputs[toAddress] = amount;
      
      // Add change output if necessary
      const fee = options.fee || 0.0001; // Default fee
      const change = totalAvailable - amount - fee;
      if (change > 0) {
        outputs[this.walletAddress] = change;
      }
      
      // Create the raw transaction
      const rawTx = await this._executeWithRetry(async () => {
        return await this.client.call('createrawtransaction', [inputs, outputs]);
      });
      
      // Sign the transaction
      const signedTx = await this._executeWithRetry(async () => {
        return await this.client.call('signrawtransactionwithkey', [rawTx, [this.secret]]);
      });
      
      if (!signedTx.complete) {
        throw new Error('Failed to sign transaction');
      }
      
      // Send the transaction
      const txid = await this._executeWithRetry(async () => {
        return await this.client.call('sendrawtransaction', [signedTx.hex]);
      });
      
      logger.info(`Transaction sent: ${txid}`);
      
      // Invalidate the balance cache
      this.balanceCache = null;
      
      return txid;
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
      const result = await this._executeWithRetry(async () => {
        return await this.client.call('validateaddress', [address]);
      });
      
      return result.isvalid;
    } catch (error) {
      logger.error(`Failed to verify address: ${error.message}`);
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
        return this.feeEstimatesCache;
      }
      
      // Get the fee estimate from the full node
      const feeRate = await this._executeWithRetry(async () => {
        return await this.client.call('estimatesmartfee', [6]); // 6 blocks target
      });
      
      // Calculate the fee based on the transaction size
      // A typical transaction is around 250 bytes
      const txSize = 250;
      const fee = (feeRate.feerate * txSize) / 1000; // Convert from BTC/kB to BTC
      
      // Cache the fee estimate
      if (this.cacheEnabled) {
        this.feeEstimatesCache = fee;
        this.feeEstimatesCacheTime = now;
      }
      
      logger.info(`Fee estimate for ${this.blockchain}/${this.name}: ${fee}`);
      
      return fee;
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
        logger.debug(`Using cached blockchain height for ${this.blockchain}/${this.name}`);
        return this.blockchainInfoCache;
      }
      
      // Get blockchain info from the full node
      const info = await this._executeWithRetry(async () => {
        return await this.client.call('getblockchaininfo');
      });
      
      const height = info.blocks;
      
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
      
      // Get the transaction from the full node
      const tx = await this._executeWithRetry(async () => {
        return await this.client.call('gettransaction', [txid]);
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
      // All full node connectors are for UTXO-based blockchains
      logger.info(`UTXO wallet verification for ${this.blockchain}/${this.name}: true`);
      return true;
    } catch (error) {
      logger.error(`Failed to verify UTXO wallet: ${error.message}`);
      throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
    }
  }
}

module.exports = {
  FullNodeConnector
};
