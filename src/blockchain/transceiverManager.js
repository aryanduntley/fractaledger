/**
 * Transceiver Manager
 * 
 * This module provides functionality for managing UTXO transceivers, which handle
 * both broadcasting transactions and monitoring wallet addresses. It completely
 * separates transaction creation/signing from the blockchain interaction mechanism,
 * allowing users to handle blockchain operations through their preferred method.
 */

const EventEmitter = require('events');
const winston = require('winston');
const path = require('path');
const { UTXOTransceiver } = require('./utxoTransceiver');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'transceiver-manager' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/transceiver-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/transceiver.log' })
  ]
});

/**
 * Transceiver Manager class
 */
class TransceiverManager {
  /**
   * Constructor
   * @param {Object} config The transceiver configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
    this.pendingTransactions = new Map();
    this.monitoredAddresses = new Map();
    this.transceiver = null;
    
    // Set default method if not provided
    this.config.method = this.config.method || 'return';
    
    // Load transceiver module if provided
    if (this.config.method === 'callback' && this.config.callbackModule) {
      try {
        // Try to load the transceiver module
        const modulePath = path.resolve(process.cwd(), this.config.callbackModule);
        const TransceiverClass = require(modulePath);
        
        if (typeof TransceiverClass === 'function') {
          // If the module exports a class constructor
          this.transceiver = new TransceiverClass(this.config);
        } else if (typeof TransceiverClass === 'object' && TransceiverClass.default && typeof TransceiverClass.default === 'function') {
          // If the module exports a default class constructor
          this.transceiver = new TransceiverClass.default(this.config);
        } else if (typeof TransceiverClass === 'object') {
          // If the module exports an object with methods
          this.transceiver = TransceiverClass;
        } else {
          throw new Error('Invalid transceiver module format');
        }
        
        // Verify that the transceiver implements the required methods
        if (!this._verifyTransceiverInterface(this.transceiver)) {
          throw new Error('Transceiver module does not implement the required interface');
        }
        
        logger.info(`Loaded transceiver module: ${this.config.callbackModule}`);
      } catch (error) {
        logger.error(`Failed to load transceiver module: ${error.message}`);
        throw new Error(`Failed to load transceiver module: ${error.message}`);
      }
    }
    
    // Initialize event forwarding
    this._initializeEventForwarding();
  }
  
  /**
   * Verify that a transceiver implements the required interface
   * @param {Object} transceiver The transceiver to verify
   * @returns {boolean} True if the transceiver implements the required interface
   * @private
   */
  _verifyTransceiverInterface(transceiver) {
    const requiredMethods = [
      'broadcastTransaction',
      'monitorWalletAddress',
      'stopMonitoringWalletAddress',
      'getWalletBalance',
      'getTransactionHistory',
      'getUTXOs'
    ];
    
    for (const method of requiredMethods) {
      if (typeof transceiver[method] !== 'function') {
        logger.error(`Transceiver does not implement required method: ${method}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Initialize event forwarding from the transceiver to the manager
   * @private
   */
  _initializeEventForwarding() {
    if (this.transceiver && typeof this.transceiver.on === 'function') {
      // Forward all events from the transceiver to the manager
      this.transceiver.on('transaction', (data) => {
        this.eventEmitter.emit('transaction', data);
      });
      
      this.transceiver.on('balance', (data) => {
        this.eventEmitter.emit('balance', data);
      });
      
      this.transceiver.on('error', (error) => {
        logger.error(`Transceiver error: ${error.message}`);
        this.eventEmitter.emit('error', error);
      });
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
      logger.debug(`Broadcasting transaction with method: ${this.config.method}`);
      
      // Generate a unique ID for the transaction
      const txid = metadata.txid || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Store the transaction in the pending transactions map
      this.pendingTransactions.set(txid, {
        txHex,
        metadata,
        timestamp: Date.now(),
        status: 'pending'
      });
      
      // Broadcast the transaction using the configured method
      switch (this.config.method) {
        case 'callback':
          return await this._broadcastWithCallback(txid, txHex, metadata);
        
        case 'event':
          return this._broadcastWithEvent(txid, txHex, metadata);
        
        case 'api':
          return this._broadcastWithApi(txid, txHex, metadata);
        
        case 'return':
        default:
          return this._broadcastWithReturn(txid, txHex, metadata);
      }
    } catch (error) {
      logger.error(`Failed to broadcast transaction: ${error.message}`);
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  /**
   * Broadcast a transaction using a callback function
   * @param {string} txid The transaction ID
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Promise<Object>} The result of the broadcast
   * @private
   */
  async _broadcastWithCallback(txid, txHex, metadata) {
    try {
      // Check if a transceiver is available
      if (!this.transceiver || !this.transceiver.broadcastTransaction) {
        throw new Error('Broadcast callback not available');
      }
      
      // Call the broadcast function from the transceiver
      const result = await this.transceiver.broadcastTransaction(txHex, metadata);
      
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'broadcasted',
        result
      });
      
      logger.info(`Transaction broadcasted with callback: ${txid}`);
      
      return {
        success: true,
        method: 'callback',
        txid,
        result
      };
    } catch (error) {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'failed',
        error: error.message
      });
      
      logger.error(`Failed to broadcast transaction with callback: ${error.message}`);
      
      throw new Error(`Failed to broadcast transaction with callback: ${error.message}`);
    }
  }
  
  /**
   * Broadcast a transaction using an event
   * @param {string} txid The transaction ID
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Object} The result of the broadcast
   * @private
   */
  _broadcastWithEvent(txid, txHex, metadata) {
    try {
      // Emit a transaction event
      this.eventEmitter.emit('transaction', {
        txid,
        txHex,
        metadata
      });
      
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'broadcasted'
      });
      
      logger.info(`Transaction broadcasted with event: ${txid}`);
      
      return {
        success: true,
        method: 'event',
        txid,
        message: 'Transaction broadcasted with event'
      };
    } catch (error) {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'failed',
        error: error.message
      });
      
      logger.error(`Failed to broadcast transaction with event: ${error.message}`);
      
      throw new Error(`Failed to broadcast transaction with event: ${error.message}`);
    }
  }
  
  /**
   * Broadcast a transaction using an API endpoint
   * @param {string} txid The transaction ID
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Object} The result of the broadcast
   * @private
   */
  _broadcastWithApi(txid, txHex, metadata) {
    try {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'ready'
      });
      
      logger.info(`Transaction ready for API broadcast: ${txid}`);
      
      // Return the transaction information for API access
      return {
        success: true,
        method: 'api',
        txid,
        endpoint: `/api/transactions/${txid}`,
        message: 'Transaction ready for API broadcast'
      };
    } catch (error) {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'failed',
        error: error.message
      });
      
      logger.error(`Failed to prepare transaction for API broadcast: ${error.message}`);
      
      throw new Error(`Failed to prepare transaction for API broadcast: ${error.message}`);
    }
  }
  
  /**
   * Broadcast a transaction by simply returning it
   * @param {string} txid The transaction ID
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Object} The result of the broadcast
   * @private
   */
  _broadcastWithReturn(txid, txHex, metadata) {
    try {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'ready'
      });
      
      logger.info(`Transaction ready for manual broadcast: ${txid}`);
      
      // Return the transaction information for manual broadcast
      return {
        success: true,
        method: 'return',
        txid,
        txHex,
        metadata,
        message: 'Transaction ready for manual broadcast'
      };
    } catch (error) {
      // Update the transaction status
      this.pendingTransactions.set(txid, {
        ...this.pendingTransactions.get(txid),
        status: 'failed',
        error: error.message
      });
      
      logger.error(`Failed to prepare transaction for manual broadcast: ${error.message}`);
      
      throw new Error(`Failed to prepare transaction for manual broadcast: ${error.message}`);
    }
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
      
      // Check if the address is already being monitored
      if (this.monitoredAddresses.has(address)) {
        logger.debug(`Address ${address} is already being monitored`);
        return this.monitoredAddresses.get(address);
      }
      
      // Check if a transceiver is available
      if (this.config.method === 'callback' && this.transceiver && this.transceiver.monitorWalletAddress) {
        // Use the transceiver to monitor the address
        const result = await this.transceiver.monitorWalletAddress(address, callback);
        
        // Store the monitoring details
        this.monitoredAddresses.set(address, {
          address,
          callback,
          timestamp: Date.now(),
          status: 'active',
          method: 'callback',
          result
        });
        
        logger.info(`Address ${address} is now being monitored with callback`);
        
        return {
          success: true,
          method: 'callback',
          address,
          message: 'Address is now being monitored with callback'
        };
      } else if (this.config.method === 'event') {
        // Store the monitoring details
        this.monitoredAddresses.set(address, {
          address,
          callback,
          timestamp: Date.now(),
          status: 'active',
          method: 'event'
        });
        
        // Emit an event to notify that we want to monitor this address
        this.eventEmitter.emit('monitor', {
          address,
          callback
        });
        
        logger.info(`Address ${address} is now being monitored with event`);
        
        return {
          success: true,
          method: 'event',
          address,
          message: 'Address is now being monitored with event'
        };
      } else if (this.config.method === 'api') {
        // Store the monitoring details
        this.monitoredAddresses.set(address, {
          address,
          callback,
          timestamp: Date.now(),
          status: 'active',
          method: 'api'
        });
        
        logger.info(`Address ${address} is now being monitored with API`);
        
        return {
          success: true,
          method: 'api',
          address,
          endpoint: `/api/monitor/${address}`,
          message: 'Address is now being monitored with API'
        };
      } else {
        // Default to polling
        const interval = this.config.monitoringInterval || 60000; // Default to 1 minute
        
        // Create a polling interval
        const intervalId = setInterval(async () => {
          try {
            // Get the transaction history
            const transactions = await this._getTransactionHistory(address);
            
            // Get the current monitoring details
            const monitoring = this.monitoredAddresses.get(address);
            
            // Check if there are new transactions
            if (monitoring && monitoring.lastChecked) {
              const newTransactions = transactions.filter(tx => tx.timestamp > monitoring.lastChecked);
              
              if (newTransactions.length > 0) {
                // Call the callback with the new transactions
                callback(newTransactions);
                
                // Emit an event with the new transactions
                this.eventEmitter.emit('transactions', {
                  address,
                  transactions: newTransactions
                });
              }
            }
            
            // Update the last checked timestamp
            this.monitoredAddresses.set(address, {
              ...this.monitoredAddresses.get(address),
              lastChecked: Date.now()
            });
          } catch (error) {
            logger.error(`Error polling address ${address}: ${error.message}`);
          }
        }, interval);
        
        // Store the monitoring details
        this.monitoredAddresses.set(address, {
          address,
          callback,
          timestamp: Date.now(),
          status: 'active',
          method: 'polling',
          interval,
          intervalId,
          lastChecked: Date.now()
        });
        
        logger.info(`Address ${address} is now being monitored with polling (interval: ${interval}ms)`);
        
        return {
          success: true,
          method: 'polling',
          address,
          interval,
          message: `Address is now being monitored with polling (interval: ${interval}ms)`
        };
      }
    } catch (error) {
      logger.error(`Failed to monitor address ${address}: ${error.message}`);
      throw new Error(`Failed to monitor address ${address}: ${error.message}`);
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
      
      // Check if the address is being monitored
      if (!this.monitoredAddresses.has(address)) {
        logger.debug(`Address ${address} is not being monitored`);
        return false;
      }
      
      // Get the monitoring details
      const monitoring = this.monitoredAddresses.get(address);
      
      // Stop monitoring based on the method
      if (monitoring.method === 'callback' && this.transceiver && this.transceiver.stopMonitoringWalletAddress) {
        // Use the transceiver to stop monitoring
        await this.transceiver.stopMonitoringWalletAddress(address);
      } else if (monitoring.method === 'event') {
        // Emit an event to notify that we want to stop monitoring this address
        this.eventEmitter.emit('stopMonitor', {
          address
        });
      } else if (monitoring.method === 'polling' && monitoring.intervalId) {
        // Clear the polling interval
        clearInterval(monitoring.intervalId);
      }
      
      // Remove the address from the monitored addresses
      this.monitoredAddresses.delete(address);
      
      logger.info(`Stopped monitoring address ${address}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to stop monitoring address ${address}: ${error.message}`);
      throw new Error(`Failed to stop monitoring address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Get the current balance of a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<number>} The wallet balance
   */
  async getWalletBalance(address) {
    try {
      logger.debug(`Getting balance for wallet address: ${address}`);
      
      // Check if a transceiver is available
      if (this.config.method === 'callback' && this.transceiver && this.transceiver.getWalletBalance) {
        // Use the transceiver to get the balance
        return await this.transceiver.getWalletBalance(address);
      } else {
        throw new Error('Balance retrieval not available');
      }
    } catch (error) {
      logger.error(`Failed to get balance for address ${address}: ${error.message}`);
      throw new Error(`Failed to get balance for address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Get transaction history for a wallet address
   * @param {string} address The wallet address
   * @param {number} limit Maximum number of transactions to return
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(address, limit = 10) {
    try {
      logger.debug(`Getting transaction history for wallet address: ${address}`);
      
      // Check if a transceiver is available
      if (this.config.method === 'callback' && this.transceiver && this.transceiver.getTransactionHistory) {
        // Use the transceiver to get the transaction history
        return await this.transceiver.getTransactionHistory(address, limit);
      } else {
        throw new Error('Transaction history retrieval not available');
      }
    } catch (error) {
      logger.error(`Failed to get transaction history for address ${address}: ${error.message}`);
      throw new Error(`Failed to get transaction history for address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Get unspent transaction outputs (UTXOs) for a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<Array>} Unspent transaction outputs
   */
  async getUTXOs(address) {
    try {
      logger.debug(`Getting UTXOs for wallet address: ${address}`);
      
      // Check if a transceiver is available
      if (this.config.method === 'callback' && this.transceiver && this.transceiver.getUTXOs) {
        // Use the transceiver to get the UTXOs
        return await this.transceiver.getUTXOs(address);
      } else {
        throw new Error('UTXO retrieval not available');
      }
    } catch (error) {
      logger.error(`Failed to get UTXOs for address ${address}: ${error.message}`);
      throw new Error(`Failed to get UTXOs for address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Get a pending transaction
   * @param {string} txid The transaction ID
   * @returns {Object} The transaction information
   */
  getPendingTransaction(txid) {
    return this.pendingTransactions.get(txid);
  }
  
  /**
   * Get all pending transactions
   * @returns {Array} The pending transactions
   */
  getAllPendingTransactions() {
    return Array.from(this.pendingTransactions.entries()).map(([txid, tx]) => ({
      txid,
      ...tx
    }));
  }
  
  /**
   * Get all monitored addresses
   * @returns {Array} The monitored addresses
   */
  getAllMonitoredAddresses() {
    return Array.from(this.monitoredAddresses.entries()).map(([address, monitoring]) => ({
      address,
      ...monitoring
    }));
  }
  
  /**
   * Register an event listener
   * @param {string} event The event to listen for
   * @param {Function} listener The event listener
   */
  on(event, listener) {
    this.eventEmitter.on(event, listener);
  }
  
  /**
   * Remove an event listener
   * @param {string} event The event to remove the listener from
   * @param {Function} listener The event listener to remove
   */
  off(event, listener) {
    this.eventEmitter.off(event, listener);
  }
  
  /**
   * Update the transceiver configuration
   * @param {Object} config The new transceiver configuration
   */
  updateConfig(config) {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Reload transceiver module if provided
    if (this.config.method === 'callback' && this.config.callbackModule) {
      try {
        // Try to load the transceiver module
        const modulePath = path.resolve(process.cwd(), this.config.callbackModule);
        const TransceiverClass = require(modulePath);
        
        if (typeof TransceiverClass === 'function') {
          // If the module exports a class constructor
          this.transceiver = new TransceiverClass(this.config);
        } else if (typeof TransceiverClass === 'object' && TransceiverClass.default && typeof TransceiverClass.default === 'function') {
          // If the module exports a default class constructor
          this.transceiver = new TransceiverClass.default(this.config);
        } else if (typeof TransceiverClass === 'object') {
          // If the module exports an object with methods
          this.transceiver = TransceiverClass;
        } else {
          throw new Error('Invalid transceiver module format');
        }
        
        // Verify that the transceiver implements the required methods
        if (!this._verifyTransceiverInterface(this.transceiver)) {
          throw new Error('Transceiver module does not implement the required interface');
        }
        
        // Initialize event forwarding
        this._initializeEventForwarding();
        
        logger.info(`Loaded transceiver module: ${this.config.callbackModule}`);
      } catch (error) {
        logger.error(`Failed to load transceiver module: ${error.message}`);
        throw new Error(`Failed to load transceiver module: ${error.message}`);
      }
    }
  }
  
  /**
   * Clean up resources used by the transceiver manager
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.debug('Cleaning up transceiver manager resources');
    
    // Stop monitoring all addresses
    for (const [address] of this.monitoredAddresses.entries()) {
      await this.stopMonitoringWalletAddress(address);
    }
    
    // Clean up the transceiver if available
    if (this.transceiver && typeof this.transceiver.cleanup === 'function') {
      await this.transceiver.cleanup();
    }
    
    // Clear all pending transactions
    this.pendingTransactions.clear();
  }
}

module.exports = {
  TransceiverManager
};
