/**
 * SPV Connector
 * 
 * This class implements the blockchain connector interface for SPV nodes.
 * It provides a production-ready implementation for connecting to SPV servers
 * and performing wallet operations.
 */

const { BlockchainConnector } = require('../blockchainConnector');
const winston = require('winston');
const ElectrumClient = require('electrum-client');
const bitcoinjs = require('bitcoinjs-lib');
const bs58check = require('bs58check');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'spv-connector' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/spv-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/spv.log' })
  ]
});

/**
 * SPV Connector class
 * @extends BlockchainConnector
 */
class SpvConnector extends BlockchainConnector {
  /**
   * Constructor
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {Object} config The wallet configuration
   */
  constructor(blockchain, config) {
    super(blockchain, config);
    
    this.server = config.connectionDetails.server;
    this.network = config.connectionDetails.network || 'mainnet';
    this.client = null;
    this.connected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.reconnectDelay = 1000; // 1 second initial delay
    this.maxReconnectDelay = 30000; // 30 seconds max delay
    
    // Connection pool for multiple servers
    this.serverPool = config.connectionDetails.serverPool || [this.server];
    this.currentServerIndex = 0;
    
    // Transaction cache
    this.transactionCache = new Map();
    this.balanceCache = null;
    this.balanceCacheTime = 0;
    this.balanceCacheExpiry = 60000; // 1 minute
    
    // Network parameters
    this.networkParams = this.getNetworkParams();
    
    logger.info(`Created SPV connector for ${blockchain}/${this.name} using ${this.server}`);
  }
  
  /**
   * Get network parameters for the blockchain
   * @returns {Object} The network parameters
   */
  getNetworkParams() {
    switch (this.blockchain) {
      case 'bitcoin':
        return this.network === 'mainnet' ? bitcoinjs.networks.bitcoin : bitcoinjs.networks.testnet;
      case 'litecoin':
        // Litecoin network parameters
        return {
          messagePrefix: '\x19Litecoin Signed Message:\n',
          bech32: 'ltc',
          bip32: {
            public: 0x019da462,
            private: 0x019d9cfe
          },
          pubKeyHash: 0x30,
          scriptHash: 0x32,
          wif: 0xb0
        };
      case 'dogecoin':
        // Dogecoin network parameters
        return {
          messagePrefix: '\x19Dogecoin Signed Message:\n',
          bech32: 'doge',
          bip32: {
            public: 0x02facafd,
            private: 0x02fac398
          },
          pubKeyHash: 0x1e,
          scriptHash: 0x16,
          wif: 0x9e
        };
      default:
        throw new Error(`Unsupported blockchain: ${this.blockchain}`);
    }
  }
  
  /**
   * Initialize the SPV client
   * @private
   */
  async _initializeClient() {
    if (this.client && this.connected) {
      return;
    }
    
    try {
      // If we've tried all servers in the pool, reset to the first one
      if (this.currentServerIndex >= this.serverPool.length) {
        this.currentServerIndex = 0;
        
        // Increase reconnect delay with exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        
        // Wait before trying again
        logger.info(`Waiting ${this.reconnectDelay}ms before reconnecting...`);
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      }
      
      // Get the current server from the pool
      const currentServer = this.serverPool[this.currentServerIndex];
      logger.info(`Connecting to SPV server ${currentServer} for ${this.blockchain}/${this.name}`);
      
      // Parse server string (host:port)
      const [host, portStr] = currentServer.split(':');
      const port = parseInt(portStr, 10);
      
      // Create a new Electrum client
      this.client = new ElectrumClient(port, host, this.network === 'mainnet' ? 'tcp' : 'tcp');
      
      // Connect to the server
      await this.client.connect();
      
      // Get server version to verify connection
      const [serverName, serverVersion] = await this.client.server_version('FractaLedger', '1.4');
      logger.info(`Connected to ${serverName} v${serverVersion}`);
      
      // Subscribe to address notifications
      await this.client.blockchain_scripthash_subscribe(this.getScriptHash(this.walletAddress));
      
      // Set up event handlers
      this.client.on('error', this._handleConnectionError.bind(this));
      this.client.on('close', this._handleConnectionClose.bind(this));
      
      // Reset connection attempts on successful connection
      this.connectionAttempts = 0;
      this.reconnectDelay = 1000;
      this.connected = true;
      
      logger.info(`Successfully connected to SPV server for ${this.blockchain}/${this.name}`);
    } catch (error) {
      logger.error(`Failed to initialize SPV client: ${error.message}`);
      
      // Close the client if it exists
      if (this.client) {
        try {
          await this.client.close();
        } catch (closeError) {
          logger.error(`Error closing client: ${closeError.message}`);
        }
        this.client = null;
      }
      
      // Try the next server in the pool
      this.currentServerIndex++;
      this.connectionAttempts++;
      
      // If we've exceeded the maximum number of connection attempts, throw an error
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        throw new Error(`Failed to connect to any SPV server after ${this.maxConnectionAttempts} attempts`);
      }
      
      // Try to initialize again with the next server
      return this._initializeClient();
    }
  }
  
  /**
   * Handle connection errors
   * @param {Error} error The error that occurred
   * @private
   */
  _handleConnectionError(error) {
    logger.error(`SPV connection error for ${this.blockchain}/${this.name}: ${error.message}`);
    this.connected = false;
    
    // Try to reconnect
    this._reconnect();
  }
  
  /**
   * Handle connection close
   * @private
   */
  _handleConnectionClose() {
    logger.warn(`SPV connection closed for ${this.blockchain}/${this.name}`);
    this.connected = false;
    
    // Try to reconnect
    this._reconnect();
  }
  
  /**
   * Reconnect to the SPV server
   * @private
   */
  async _reconnect() {
    try {
      // Reset the client
      this.client = null;
      
      // Try to initialize again
      await this._initializeClient();
    } catch (error) {
      logger.error(`Failed to reconnect to SPV server: ${error.message}`);
    }
  }
  
  /**
   * Get the script hash for an address
   * @param {string} address The address
   * @returns {string} The script hash
   * @private
   */
  getScriptHash(address) {
    try {
      const script = bitcoinjs.address.toOutputScript(address, this.networkParams);
      const hash = bitcoinjs.crypto.sha256(script);
      const reversedHash = Buffer.from(hash.reverse());
      return reversedHash.toString('hex');
    } catch (error) {
      throw new Error(`Failed to get script hash for address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Execute a method with retry logic
   * @param {Function} method The method to execute
   * @param {Array} args The arguments to pass to the method
   * @param {number} retries The number of retries
   * @param {number} delay The delay between retries in milliseconds
   * @returns {Promise<any>} The result of the method
   * @private
   */
  async _executeWithRetry(method, args = [], retries = 3, delay = 1000) {
    try {
      // Make sure the client is initialized
      await this._initializeClient();
      
      // Execute the method
      return await method(...args);
    } catch (error) {
      // If we have retries left, try again
      if (retries > 0) {
        logger.warn(`Retrying operation after error: ${error.message} (${retries} retries left)`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try to reconnect if the connection was lost
        if (!this.connected) {
          await this._reconnect();
        }
        
        // Retry with one less retry
        return this._executeWithRetry(method, args, retries - 1, delay * 2);
      }
      
      // No retries left, throw the error
      throw error;
    }
  }
  
  /**
   * Test the connection to the blockchain
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    try {
      // Try to initialize the client
      await this._initializeClient();
      
      // Get the blockchain height to verify the connection
      const height = await this._executeWithRetry(async () => {
        return await this.client.blockchain_headers_subscribe();
      });
      
      logger.info(`Connected to ${this.blockchain} SPV server, height: ${height.height}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to connect to SPV server: ${error.message}`);
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
      if (this.balanceCache !== null && now - this.balanceCacheTime < this.balanceCacheExpiry) {
        logger.debug(`Using cached balance for ${this.blockchain}/${this.name}`);
        return this.balanceCache;
      }
      
      // Get the script hash for the address
      const scriptHash = this.getScriptHash(this.walletAddress);
      
      // Get the balance from the server
      const balance = await this._executeWithRetry(async () => {
        return await this.client.blockchain_scripthash_getBalance(scriptHash);
      });
      
      // Convert from satoshis to whole coins
      const confirmedBalance = balance.confirmed / 100000000;
      const unconfirmedBalance = balance.unconfirmed / 100000000;
      
      // Cache the balance
      this.balanceCache = confirmedBalance;
      this.balanceCacheTime = now;
      
      logger.info(`Balance for ${this.blockchain}/${this.name}: ${confirmedBalance} (confirmed), ${unconfirmedBalance} (unconfirmed)`);
      
      return confirmedBalance;
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
      // Get the script hash for the address
      const scriptHash = this.getScriptHash(this.walletAddress);
      
      // Get the transaction history from the server
      const history = await this._executeWithRetry(async () => {
        return await this.client.blockchain_scripthash_getHistory(scriptHash);
      });
      
      // Sort by height (most recent first)
      history.sort((a, b) => (b.height || Infinity) - (a.height || Infinity));
      
      // Limit the number of transactions
      const limitedHistory = history.slice(0, limit);
      
      // Get transaction details for each transaction
      const transactions = [];
      for (const item of limitedHistory) {
        // Check if we have the transaction in the cache
        if (this.transactionCache.has(item.tx_hash)) {
          transactions.push(this.transactionCache.get(item.tx_hash));
          continue;
        }
        
        // Get the transaction details
        const tx = await this._executeWithRetry(async () => {
          return await this.client.blockchain_transaction_get(item.tx_hash, true);
        });
        
        // Calculate the amount for this address
        let amount = 0;
        
        // Check inputs
        let isSent = false;
        for (const input of tx.vin) {
          if (input.prevout && input.prevout.scriptpubkey_address === this.walletAddress) {
            amount -= input.prevout.value / 100000000;
            isSent = true;
          }
        }
        
        // Check outputs
        let isReceived = false;
        for (const output of tx.vout) {
          if (output.scriptpubkey_address === this.walletAddress) {
            amount += output.value / 100000000;
            isReceived = true;
          }
        }
        
        // Determine transaction type
        let type = 'unknown';
        if (isSent && isReceived) {
          type = 'self';
        } else if (isSent) {
          type = 'sent';
        } else if (isReceived) {
          type = 'received';
        }
        
        // Create the transaction object
        const transaction = {
          txid: item.tx_hash,
          amount,
          confirmations: item.height ? tx.confirmations : 0,
          timestamp: tx.time ? new Date(tx.time * 1000).toISOString() : new Date().toISOString(),
          type
        };
        
        // Add to the cache
        this.transactionCache.set(item.tx_hash, transaction);
        
        // Add to the result
        transactions.push(transaction);
      }
      
      logger.info(`Retrieved ${transactions.length} transactions for ${this.blockchain}/${this.name}`);
      
      return transactions;
    } catch (error) {
      logger.error(`Failed to get transaction history: ${error.message}`);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }
  
  /**
   * Send a transaction
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<string>} The transaction ID
   */
  async sendTransaction(toAddress, amount, options = {}) {
    try {
      // Validate the address
      const isValid = await this.verifyAddress(toAddress);
      if (!isValid) {
        throw new Error(`Invalid address: ${toAddress}`);
      }
      
      // Get the script hash for the address
      const scriptHash = this.getScriptHash(this.walletAddress);
      
      // Get the UTXOs for the address
      const utxos = await this._executeWithRetry(async () => {
        return await this.client.blockchain_scripthash_listunspent(scriptHash);
      });
      
      // Sort UTXOs by value (ascending)
      utxos.sort((a, b) => a.value - b.value);
      
      // Calculate the total available balance
      const totalAvailable = utxos.reduce((total, utxo) => total + utxo.value, 0) / 100000000;
      
      // Estimate the fee
      const fee = options.fee || await this.estimateFee(toAddress, amount, options);
      
      // Check if there's enough balance
      if (totalAvailable < amount + fee) {
        throw new Error(`Insufficient balance: ${totalAvailable} < ${amount + fee}`);
      }
      
      // Create a transaction builder
      const txb = new bitcoinjs.TransactionBuilder(this.networkParams);
      
      // Add inputs
      let inputAmount = 0;
      const inputs = [];
      for (const utxo of utxos) {
        // Get the transaction details
        const tx = await this._executeWithRetry(async () => {
          return await this.client.blockchain_transaction_get(utxo.tx_hash, true);
        });
        
        // Add the input
        txb.addInput(utxo.tx_hash, utxo.tx_pos);
        inputs.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          scriptPubKey: tx.vout[utxo.tx_pos].scriptpubkey,
          value: utxo.value
        });
        
        // Update the input amount
        inputAmount += utxo.value / 100000000;
        
        // If we have enough inputs, stop adding more
        if (inputAmount >= amount + fee) {
          break;
        }
      }
      
      // Add the output
      txb.addOutput(toAddress, Math.round(amount * 100000000)); // Convert from BTC to satoshis
      
      // Add change output if necessary
      const change = inputAmount - amount - fee;
      if (change > 0.00001) { // Only add change if it's more than dust
        txb.addOutput(this.walletAddress, Math.round(change * 100000000)); // Convert from BTC to satoshis
      }
      
      // Sign the inputs
      const keyPair = bitcoinjs.ECPair.fromWIF(this.secret, this.networkParams);
      for (let i = 0; i < inputs.length; i++) {
        txb.sign(i, keyPair);
      }
      
      // Build the transaction
      const tx = txb.build();
      const txHex = tx.toHex();
      
      // Broadcast the transaction
      const txid = await this._executeWithRetry(async () => {
        return await this.client.blockchain_transaction_broadcast(txHex);
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
      // Use bitcoinjs-lib to validate the address
      try {
        bitcoinjs.address.toOutputScript(address, this.networkParams);
        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      logger.error(`Failed to verify address: ${error.message}`);
      throw new Error(`Failed to verify address: ${error.message}`);
    }
  }
  
  /**
   * Estimate the transaction fee
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<number>} The estimated fee
   */
  async estimateFee(toAddress, amount, options = {}) {
    try {
      // Get the fee estimate from the server
      const feeEstimate = await this._executeWithRetry(async () => {
        return await this.client.blockchain_estimatefee(options.blocks || 6);
      });
      
      // If the fee estimate is -1, use a default fee
      if (feeEstimate === -1) {
        logger.warn('Fee estimation returned -1, using default fee');
        return 0.0001; // Default fee
      }
      
      // Calculate the fee based on the transaction size
      // A typical transaction is around 250 bytes
      const txSize = 250;
      const fee = feeEstimate * txSize / 1000; // Convert from BTC/kB to BTC
      
      logger.info(`Estimated fee: ${fee} ${this.blockchain}`);
      
      return fee;
    } catch (error) {
      logger.error(`Failed to estimate fee: ${error.message}`);
      
      // If fee estimation fails, return a default fee
      logger.warn('Using default fee');
      return 0.0001; // Default fee
    }
  }
  
  /**
   * Get the current blockchain height
   * @returns {Promise<number>} The current blockchain height
   */
  async getBlockchainHeight() {
    try {
      // Get the blockchain height from the server
      const headers = await this._executeWithRetry(async () => {
        return await this.client.blockchain_headers_subscribe();
      });
      
      logger.info(`Blockchain height: ${headers.height}`);
      
      return headers.height;
    } catch (error) {
      logger.error(`Failed to get blockchain height: ${error.message}`);
      throw new Error(`Failed to get blockchain height: ${error.message}`);
    }
  }
  
  /**
   * Get information about a transaction
   * @param {string} txid The transaction ID
   * @returns {Promise<Object>} The transaction information
   */
  async getTransaction(txid) {
    try {
      // Check if we have the transaction in the cache
      if (this.transactionCache.has(txid)) {
        return this.transactionCache.get(txid);
      }
      
      // Get the transaction details from the server
      const tx = await this._executeWithRetry(async () => {
        return await this.client.blockchain_transaction_get(txid, true);
      });
      
      // Calculate the amount for this address
      let amount = 0;
      
      // Check inputs
      let isSent = false;
      for (const input of tx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === this.walletAddress) {
          amount -= input.prevout.value / 100000000;
          isSent = true;
        }
      }
      
      // Check outputs
      let isReceived = false;
      for (const output of tx.vout) {
        if (output.scriptpubkey_address === this.walletAddress) {
          amount += output.value / 100000000;
          isReceived = true;
        }
      }
      
      // Determine transaction type
      let type = 'unknown';
      if (isSent && isReceived) {
        type = 'self';
      } else if (isSent) {
        type = 'sent';
      } else if (isReceived) {
        type = 'received';
      }
      
      // Create the transaction object
      const transaction = {
        txid,
        amount,
        confirmations: tx.confirmations || 0,
        timestamp: tx.time ? new Date(tx.time * 1000).toISOString() : new Date().toISOString(),
        type,
        details: tx
      };
      
      // Add to the cache
      this.transactionCache.set(txid, transaction);
      
      return transaction;
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
      // All supported blockchains (Bitcoin, Litecoin, Dogecoin) are UTXO-based
      logger.info(`Verified ${this.blockchain} wallet is UTXO-based`);
      return true;
    } catch (error) {
      logger.error(`Failed to verify UTXO wallet: ${error.message}`);
      throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
    }
  }
}

module.exports = {
  SpvConnector
};
