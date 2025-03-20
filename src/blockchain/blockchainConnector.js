/**
 * Blockchain Connector
 * 
 * This module provides a connector for interacting with UTXO-based blockchains.
 * It focuses on transaction creation and signing, delegating the blockchain interaction
 * responsibility to the user's environment through the TransceiverManager.
 */

const { TransactionBuilder } = require('./transactionBuilder');
const { TransceiverManager } = require('./transceiverManager');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'blockchain-connector' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/blockchain-connector-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/blockchain-connector.log' })
  ]
});

/**
 * Blockchain Connector class
 */
class BlockchainConnector {
  /**
   * Constructor
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin, etc.)
   * @param {Object} config The wallet configuration
   */
  constructor(blockchain, config) {
    this.blockchain = blockchain;
    this.config = config;
    this.name = config.name;
    this.walletAddress = config.walletAddress;
    this.secret = config.secret;
    
    // Create a transaction builder
    this.transactionBuilder = new TransactionBuilder(blockchain, config.network || 'mainnet');
    
    // Create a transceiver manager
    this.transceiverManager = new TransceiverManager(config.transceiver || {});
    
    // Initialize event handling
    this._initializeEventHandling();
    
    // Verify required methods are implemented
    const requiredMethods = [
      'broadcastTransaction',
      'sendTransaction',
      'verifyAddress',
      'estimateFee',
      'getWalletBalance',
      'getTransactionHistory',
      'getUTXOs',
      'cleanup'
    ];
    
    for (const method of requiredMethods) {
      if (this[method] === undefined || typeof this[method] !== 'function') {
        throw new Error(`BlockchainConnector must implement ${method} method`);
      }
    }
    
    logger.info(`Created blockchain connector for ${blockchain} wallet: ${this.name}`);
  }
  
  /**
   * Initialize event handling
   * @private
   */
  _initializeEventHandling() {
    // Listen for transaction events
    this.transceiverManager.on('transaction', (data) => {
      logger.debug(`Received transaction event: ${JSON.stringify(data)}`);
      // Forward the event
      this.emit('transaction', data);
    });
    
    // Listen for balance events
    this.transceiverManager.on('balance', (data) => {
      logger.debug(`Received balance event: ${JSON.stringify(data)}`);
      // Forward the event
      this.emit('balance', data);
    });
    
    // Listen for error events
    this.transceiverManager.on('error', (error) => {
      logger.error(`Received error event: ${error.message}`);
      // Forward the event
      this.emit('error', error);
    });
  }
  
  /**
   * Create and sign a transaction
   * @param {Array} inputs The transaction inputs (UTXOs)
   * @param {Array} outputs The transaction outputs
   * @param {Object} options Additional options
   * @returns {Promise<Object>} The signed transaction
   */
  async createTransaction(inputs, outputs, options = {}) {
    try {
      logger.debug(`Creating transaction with ${inputs.length} inputs and ${outputs.length} outputs`);
      
      // Create and sign the transaction
      const transaction = this.transactionBuilder.createAndSignTransaction(
        this.secret,
        inputs,
        outputs,
        options
      );
      
      logger.info(`Transaction created successfully: ${transaction.txid}`);
      
      return transaction;
    } catch (error) {
      logger.error(`Failed to create transaction: ${error.message}`);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }
  
  /**
   * Broadcast a transaction
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Promise<Object>} The result of the broadcast
   */
  async broadcastTransaction(txHex, metadata = {}) {
    try {
      logger.debug('Broadcasting transaction');
      
      // Broadcast the transaction
      const result = await this.transceiverManager.broadcastTransaction(txHex, metadata);
      
      logger.info(`Transaction broadcasted: ${result.txid}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to broadcast transaction: ${error.message}`);
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  /**
   * Send a transaction
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @param {number} options.fee Optional transaction fee
   * @param {number} options.feeRate Optional fee rate in satoshis per byte
   * @param {Array} options.utxos Optional UTXOs to use for the transaction
   * @param {string} options.opReturn Optional OP_RETURN data to include in the transaction (max 80 bytes)
   * @returns {Promise<Object>} The transaction result
   */
  async sendTransaction(toAddress, amount, options = {}) {
    try {
      logger.debug(`Sending ${amount} to ${toAddress}`);
      
      // Verify the address
      if (!this.transactionBuilder.verifyAddress(toAddress)) {
        throw new Error(`Invalid address: ${toAddress}`);
      }
      
      // Get the UTXOs for the wallet
      const utxos = options.utxos || [];
      
      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs provided');
      }
      
      // Calculate the fee
      const fee = options.fee || this.transactionBuilder.estimateFee(utxos.length, 2, options.feeRate || 1);
      
      // Create the outputs
      const outputs = [
        {
          address: toAddress,
          value: amount
        }
      ];
      
      // Add change output if needed
      const totalInput = utxos.reduce((total, utxo) => total + utxo.value, 0);
      const change = totalInput - amount - fee;
      
      if (change > 0) {
        outputs.push({
          address: this.walletAddress,
          value: change
        });
      }
      
      // Create transaction options
      const txOptions = { ...options };
      
      // Create and sign the transaction
      const transaction = await this.createTransaction(utxos, outputs, txOptions);
      
      // Broadcast the transaction
      const result = await this.broadcastTransaction(transaction.txHex, {
        txid: transaction.txid,
        inputs: transaction.inputs,
        outputs: transaction.outputs,
        fee: transaction.fee
      });
      
      logger.info(`Transaction sent: ${result.txid}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to send transaction: ${error.message}`);
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
  }
  
  /**
   * Verify if an address is valid
   * @param {string} address The address to verify
   * @returns {boolean} True if the address is valid
   */
  verifyAddress(address) {
    return this.transactionBuilder.verifyAddress(address);
  }
  
  /**
   * Estimate the transaction fee
   * @param {number} inputCount The number of inputs
   * @param {number} outputCount The number of outputs
   * @param {number} feeRate The fee rate in satoshis per byte
   * @returns {number} The estimated fee in satoshis
   */
  estimateFee(inputCount, outputCount, feeRate = 1) {
    return this.transactionBuilder.estimateFee(inputCount, outputCount, feeRate);
  }
  
  /**
   * Start monitoring a wallet address
   * @param {string} address The wallet address to monitor
   * @param {Function} callback Function to call when new transactions are detected
   * @returns {Promise<Object>} Monitoring subscription details
   */
  async monitorWalletAddress(address, callback) {
    try {
      logger.debug(`Starting to monitor wallet address: ${address}`);
      
      // Monitor the wallet address
      const result = await this.transceiverManager.monitorWalletAddress(address, callback);
      
      logger.info(`Wallet address monitored: ${address}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to monitor wallet address: ${error.message}`);
      throw new Error(`Failed to monitor wallet address: ${error.message}`);
    }
  }
  
  /**
   * Stop monitoring a wallet address
   * @param {string} address The wallet address to stop monitoring
   * @returns {Promise<boolean>} True if successful
   */
  async stopMonitoringWalletAddress(address) {
    try {
      logger.debug(`Stopping monitoring for wallet address: ${address}`);
      
      // Stop monitoring the wallet address
      const result = await this.transceiverManager.stopMonitoringWalletAddress(address);
      
      logger.info(`Wallet address monitoring stopped: ${address}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to stop monitoring wallet address: ${error.message}`);
      throw new Error(`Failed to stop monitoring wallet address: ${error.message}`);
    }
  }
  
  /**
   * Get the current balance of a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<number>} The wallet balance
   */
  async getWalletBalance(address = this.walletAddress) {
    try {
      logger.debug(`Getting balance for wallet address: ${address}`);
      
      // Get the wallet balance
      const balance = await this.transceiverManager.getWalletBalance(address);
      
      logger.info(`Wallet balance retrieved: ${address} = ${balance}`);
      
      return balance;
    } catch (error) {
      logger.error(`Failed to get wallet balance: ${error.message}`);
      throw new Error(`Failed to get wallet balance: ${error.message}`);
    }
  }
  
  /**
   * Get transaction history for a wallet address
   * @param {string} address The wallet address
   * @param {number} limit Maximum number of transactions to return
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(address = this.walletAddress, limit = 10) {
    try {
      logger.debug(`Getting transaction history for wallet address: ${address}`);
      
      // Get the transaction history
      const history = await this.transceiverManager.getTransactionHistory(address, limit);
      
      logger.info(`Transaction history retrieved: ${address} (${history.length} transactions)`);
      
      return history;
    } catch (error) {
      logger.error(`Failed to get transaction history: ${error.message}`);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }
  
  /**
   * Get unspent transaction outputs (UTXOs) for a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<Array>} Unspent transaction outputs
   */
  async getUTXOs(address = this.walletAddress) {
    try {
      logger.debug(`Getting UTXOs for wallet address: ${address}`);
      
      // Get the UTXOs
      const utxos = await this.transceiverManager.getUTXOs(address);
      
      logger.info(`UTXOs retrieved: ${address} (${utxos.length} UTXOs)`);
      
      return utxos;
    } catch (error) {
      logger.error(`Failed to get UTXOs: ${error.message}`);
      throw new Error(`Failed to get UTXOs: ${error.message}`);
    }
  }
  
  /**
   * Register an event listener
   * @param {string} event The event to listen for
   * @param {Function} listener The event listener
   */
  on(event, listener) {
    this.transceiverManager.on(event, listener);
  }
  
  /**
   * Remove an event listener
   * @param {string} event The event to remove the listener from
   * @param {Function} listener The event listener to remove
   */
  off(event, listener) {
    this.transceiverManager.off(event, listener);
  }
  
  /**
   * Emit an event
   * @param {string} event The event to emit
   * @param {*} args The event arguments
   */
  emit(event, ...args) {
    this.transceiverManager.eventEmitter.emit(event, ...args);
  }
  
  /**
   * Update the transceiver configuration
   * @param {Object} config The new transceiver configuration
   */
  updateTransceiverConfig(config) {
    this.transceiverManager.updateConfig(config);
  }
  
  /**
   * Get a pending transaction
   * @param {string} txid The transaction ID
   * @returns {Object} The transaction information
   */
  getPendingTransaction(txid) {
    return this.transceiverManager.getPendingTransaction(txid);
  }
  
  /**
   * Get all pending transactions
   * @returns {Array} The pending transactions
   */
  getAllPendingTransactions() {
    return this.transceiverManager.getAllPendingTransactions();
  }
  
  /**
   * Get all monitored addresses
   * @returns {Array} The monitored addresses
   */
  getAllMonitoredAddresses() {
    return this.transceiverManager.getAllMonitoredAddresses();
  }
  
  /**
   * Clean up resources used by the connector
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.debug('Cleaning up blockchain connector resources');
    
    // Clean up the transceiver manager
    await this.transceiverManager.cleanup();
  }
}

module.exports = {
  BlockchainConnector
};
