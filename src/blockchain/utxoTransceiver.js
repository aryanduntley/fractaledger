/**
 * UTXO Transceiver Interface
 * 
 * This module defines the interface for UTXO-based blockchain transceivers.
 * A transceiver is responsible for both broadcasting transactions to the blockchain
 * and receiving updates about wallet activity. This two-way communication ensures
 * that wallet data stays up-to-date with on-chain transactions.
 * 
 * This interface is blockchain-agnostic and works with any UTXO-based blockchain.
 * Users can implement this interface to connect to their preferred blockchain
 * infrastructure (full node, SPV client, API service, etc.).
 */

const EventEmitter = require('events');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'utxo-transceiver' },
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
 * UTXO Transceiver Interface
 * 
 * This class defines the interface for UTXO-based blockchain transceivers.
 * Implementations should extend this class and implement all required methods.
 */
class UTXOTransceiver {
  /**
   * Constructor
   * @param {Object} config The transceiver configuration
   */
  constructor(config = {}) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
    this.monitoredAddresses = new Map();
    this.monitoringIntervals = new Map();
    
    logger.info('UTXO Transceiver initialized');
  }
  
  /**
   * Broadcast a transaction to the blockchain network
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Promise<string>} The transaction ID
   */
  async broadcastTransaction(txHex, metadata = {}) {
    logger.debug('Broadcasting transaction');
    throw new Error('Method not implemented: broadcastTransaction');
  }
  
  /**
   * Start monitoring a wallet address for new transactions
   * @param {string} address The wallet address to monitor
   * @param {Function} callback Function to call when new transactions are detected
   * @returns {Promise<Object>} Monitoring subscription details
   */
  async monitorWalletAddress(address, callback) {
    logger.debug(`Starting to monitor wallet address: ${address}`);
    throw new Error('Method not implemented: monitorWalletAddress');
  }
  
  /**
   * Stop monitoring a wallet address
   * @param {string} address The wallet address to stop monitoring
   * @returns {Promise<boolean>} True if successful
   */
  async stopMonitoringWalletAddress(address) {
    logger.debug(`Stopping monitoring for wallet address: ${address}`);
    throw new Error('Method not implemented: stopMonitoringWalletAddress');
  }
  
  /**
   * Get the current balance of a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<number>} The wallet balance
   */
  async getWalletBalance(address) {
    logger.debug(`Getting balance for wallet address: ${address}`);
    throw new Error('Method not implemented: getWalletBalance');
  }
  
  /**
   * Get transaction history for a wallet address
   * @param {string} address The wallet address
   * @param {number} limit Maximum number of transactions to return
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(address, limit = 10) {
    logger.debug(`Getting transaction history for wallet address: ${address}`);
    throw new Error('Method not implemented: getTransactionHistory');
  }
  
  /**
   * Get unspent transaction outputs (UTXOs) for a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<Array>} Unspent transaction outputs
   */
  async getUTXOs(address) {
    logger.debug(`Getting UTXOs for wallet address: ${address}`);
    throw new Error('Method not implemented: getUTXOs');
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
   * Emit an event
   * @param {string} event The event to emit
   * @param {*} args The event arguments
   */
  emit(event, ...args) {
    this.eventEmitter.emit(event, ...args);
  }
  
  /**
   * Initialize the transceiver
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.debug('Initializing transceiver');
    // Default implementation does nothing
  }
  
  /**
   * Clean up resources used by the transceiver
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.debug('Cleaning up transceiver resources');
    
    // Stop all monitoring intervals
    for (const [address, intervalId] of this.monitoringIntervals.entries()) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(address);
    }
    
    // Clear all monitored addresses
    this.monitoredAddresses.clear();
  }
}

module.exports = {
  UTXOTransceiver
};
