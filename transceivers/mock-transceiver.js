/**
 * Mock UTXO Transceiver
 * 
 * This module provides a mock implementation of a UTXO transceiver for testing purposes.
 * It simulates the behavior of a real transceiver without actually interacting with
 * any blockchain network.
 */

const { UTXOTransceiver } = require('../src/blockchain/utxoTransceiver');

/**
 * Mock UTXO Transceiver class
 */
class MockTransceiver extends UTXOTransceiver {
  /**
   * Constructor
   * @param {Object} config The transceiver configuration
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize mock data
    this.mockTransactions = new Map();
    this.mockBalances = new Map();
    this.mockUTXOs = new Map();
    
    console.log('[MOCK] UTXO Transceiver initialized');
  }
  
  /**
   * Broadcast a transaction to the blockchain network
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Promise<string>} The transaction ID
   */
  async broadcastTransaction(txHex, metadata = {}) {
    console.log(`[MOCK] Broadcasting transaction: ${metadata.txid || 'unknown'}`);
    
    // Generate a mock transaction ID if not provided
    const txid = metadata.txid || `mock-txid-${Date.now()}`;
    
    // Store the transaction
    this.mockTransactions.set(txid, {
      txHex,
      metadata,
      timestamp: Date.now()
    });
    
    // Emit a transaction event
    this.emit('transaction', {
      txid,
      txHex,
      metadata,
      timestamp: Date.now()
    });
    
    return txid;
  }
  
  /**
   * Start monitoring a wallet address for new transactions
   * @param {string} address The wallet address to monitor
   * @param {Function} callback Function to call when new transactions are detected
   * @returns {Promise<Object>} Monitoring subscription details
   */
  async monitorWalletAddress(address, callback) {
    console.log(`[MOCK] Starting to monitor wallet address: ${address}`);
    
    // Check if the address is already being monitored
    if (this.monitoredAddresses.has(address)) {
      console.log(`[MOCK] Address ${address} is already being monitored`);
      return this.monitoredAddresses.get(address);
    }
    
    // Create a mock monitoring interval
    const interval = this.config.monitoringInterval || 60000; // Default to 1 minute
    
    // Create a polling interval
    const intervalId = setInterval(() => {
      // Generate a mock transaction
      const mockTransaction = {
        txid: `mock-txid-${Date.now()}`,
        amount: Math.random() * 10,
        timestamp: Date.now(),
        confirmations: Math.floor(Math.random() * 100)
      };
      
      // Call the callback with the mock transaction
      callback([mockTransaction]);
      
      // Emit a transactions event
      this.emit('transactions', {
        address,
        transactions: [mockTransaction]
      });
    }, interval);
    
    // Store the monitoring details
    this.monitoredAddresses.set(address, {
      address,
      callback,
      timestamp: Date.now(),
      status: 'active',
      interval,
      intervalId
    });
    
    // Store the interval ID
    this.monitoringIntervals.set(address, intervalId);
    
    console.log(`[MOCK] Address ${address} is now being monitored (interval: ${interval}ms)`);
    
    return {
      address,
      status: 'active',
      interval
    };
  }
  
  /**
   * Stop monitoring a wallet address
   * @param {string} address The wallet address to stop monitoring
   * @returns {Promise<boolean>} True if successful
   */
  async stopMonitoringWalletAddress(address) {
    console.log(`[MOCK] Stopping monitoring for wallet address: ${address}`);
    
    // Check if the address is being monitored
    if (!this.monitoredAddresses.has(address)) {
      console.log(`[MOCK] Address ${address} is not being monitored`);
      return false;
    }
    
    // Get the interval ID
    const intervalId = this.monitoringIntervals.get(address);
    
    // Clear the interval
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(address);
    }
    
    // Remove the address from the monitored addresses
    this.monitoredAddresses.delete(address);
    
    console.log(`[MOCK] Stopped monitoring address ${address}`);
    
    return true;
  }
  
  /**
   * Get the current balance of a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<number>} The wallet balance
   */
  async getWalletBalance(address) {
    console.log(`[MOCK] Getting balance for wallet address: ${address}`);
    
    // Check if we have a mock balance for this address
    if (!this.mockBalances.has(address)) {
      // Generate a mock balance
      this.mockBalances.set(address, Math.random() * 10);
    }
    
    // Get the mock balance
    const balance = this.mockBalances.get(address);
    
    // Emit a balance event
    this.emit('balance', {
      address,
      balance,
      timestamp: Date.now()
    });
    
    return balance;
  }
  
  /**
   * Get transaction history for a wallet address
   * @param {string} address The wallet address
   * @param {number} limit Maximum number of transactions to return
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(address, limit = 10) {
    console.log(`[MOCK] Getting transaction history for wallet address: ${address}`);
    
    // Generate mock transactions
    const transactions = [];
    
    for (let i = 0; i < limit; i++) {
      transactions.push({
        txid: `mock-txid-${i}`,
        amount: Math.random() * 10,
        timestamp: Date.now() - (i * 3600000), // 1 hour ago per transaction
        confirmations: Math.floor(Math.random() * 100)
      });
    }
    
    return transactions;
  }
  
  /**
   * Get unspent transaction outputs (UTXOs) for a wallet address
   * @param {string} address The wallet address
   * @returns {Promise<Array>} Unspent transaction outputs
   */
  async getUTXOs(address) {
    console.log(`[MOCK] Getting UTXOs for wallet address: ${address}`);
    
    // Check if we have mock UTXOs for this address
    if (!this.mockUTXOs.has(address)) {
      // Generate mock UTXOs
      const utxos = [];
      
      for (let i = 0; i < 5; i++) {
        utxos.push({
          txid: `mock-txid-${i}`,
          vout: i,
          value: Math.random() * 10,
          confirmations: Math.floor(Math.random() * 100)
        });
      }
      
      this.mockUTXOs.set(address, utxos);
    }
    
    // Get the mock UTXOs
    return this.mockUTXOs.get(address);
  }
  
  /**
   * Set a mock balance for a wallet address
   * @param {string} address The wallet address
   * @param {number} balance The balance to set
   */
  setMockBalance(address, balance) {
    this.mockBalances.set(address, balance);
  }
  
  /**
   * Set mock UTXOs for a wallet address
   * @param {string} address The wallet address
   * @param {Array} utxos The UTXOs to set
   */
  setMockUTXOs(address, utxos) {
    this.mockUTXOs.set(address, utxos);
  }
  
  /**
   * Add a mock transaction for a wallet address
   * @param {string} address The wallet address
   * @param {Object} transaction The transaction to add
   */
  addMockTransaction(address, transaction) {
    // Generate a transaction ID if not provided
    const txid = transaction.txid || `mock-txid-${Date.now()}`;
    
    // Store the transaction
    this.mockTransactions.set(txid, {
      ...transaction,
      timestamp: transaction.timestamp || Date.now()
    });
    
    // Emit a transaction event
    this.emit('transaction', {
      txid,
      ...transaction,
      timestamp: transaction.timestamp || Date.now()
    });
  }
  
  /**
   * Clean up resources used by the transceiver
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log('[MOCK] Cleaning up UTXO transceiver resources');
    
    // Stop all monitoring intervals
    for (const [address, intervalId] of this.monitoringIntervals.entries()) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(address);
    }
    
    // Clear all monitored addresses
    this.monitoredAddresses.clear();
    
    // Clear all mock data
    this.mockTransactions.clear();
    this.mockBalances.clear();
    this.mockUTXOs.clear();
    
    console.log('[MOCK] UTXO transceiver resources cleaned up successfully');
  }
}

module.exports = MockTransceiver;
