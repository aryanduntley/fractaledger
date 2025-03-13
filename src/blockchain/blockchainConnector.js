/**
 * Abstract Blockchain Connector
 * 
 * This class defines the interface that all blockchain connectors must implement.
 */

class BlockchainConnector {
  /**
   * Constructor
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {Object} config The wallet configuration
   */
  constructor(blockchain, config) {
    if (new.target === BlockchainConnector) {
      throw new Error('BlockchainConnector is an abstract class and cannot be instantiated directly');
    }
    
    this.blockchain = blockchain;
    this.config = config;
    this.name = config.name;
    this.walletAddress = config.walletAddress;
    this.secret = config.secret;
  }
  
  /**
   * Test the connection to the blockchain
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get the balance of the wallet
   * @returns {Promise<number>} The wallet balance
   */
  async getBalance() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get the transaction history of the wallet
   * @param {number} limit The maximum number of transactions to return
   * @returns {Promise<Array>} The transaction history
   */
  async getTransactionHistory(limit = 10) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Send a transaction
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<string>} The transaction ID
   */
  async sendTransaction(toAddress, amount, options = {}) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Verify if an address is valid
   * @param {string} address The address to verify
   * @returns {Promise<boolean>} True if the address is valid
   */
  async verifyAddress(address) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Estimate the transaction fee
   * @param {string} toAddress The recipient address
   * @param {number} amount The amount to send
   * @param {Object} options Additional options
   * @returns {Promise<number>} The estimated fee
   */
  async estimateFee(toAddress, amount, options = {}) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get the current blockchain height
   * @returns {Promise<number>} The current blockchain height
   */
  async getBlockchainHeight() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get information about a transaction
   * @param {string} txid The transaction ID
   * @returns {Promise<Object>} The transaction information
   */
  async getTransaction(txid) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Verify if the wallet is UTXO-based
   * @returns {Promise<boolean>} True if the wallet is UTXO-based
   */
  async verifyUtxoWallet() {
    throw new Error('Method not implemented');
  }
}

module.exports = {
  BlockchainConnector
};
