/**
 * Full Node Connector
 * 
 * This module provides a connector for interacting with a full node via RPC.
 */

const { BlockchainConnector } = require('../blockchainConnector');
const axios = require('axios');
const bitcoinjs = require('bitcoinjs-lib');
const bs58check = require('bs58check');

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
    const url = `${this.protocol}://${this.host}:${this.port}`;
    const auth = {
      username: this.username,
      password: this.password
    };
    
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
   * Test the connection to the full node
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    try {
      // Call the getblockchaininfo method to test the connection
      await this.client.call('getblockchaininfo');
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${this.blockchain} full node: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the balance of the wallet
   * @returns {Promise<number>} The wallet balance
   */
  async getBalance() {
    try {
      // For UTXO-based blockchains, we need to get the unspent transaction outputs
      const utxos = await this.client.call('listunspent', [0, 9999999, [this.walletAddress]]);
      
      // Calculate the total balance
      const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);
      
      return balance;
    } catch (error) {
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
      const transactions = await this.client.call('listtransactions', ['*', limit, 0, true]);
      
      // Filter transactions for the wallet address
      const filteredTransactions = transactions.filter(tx => 
        tx.address === this.walletAddress || 
        (tx.vout && tx.vout.some(output => output.scriptPubKey.addresses.includes(this.walletAddress)))
      );
      
      // Format the transactions
      return filteredTransactions.map(tx => ({
        txid: tx.txid,
        amount: tx.amount,
        confirmations: tx.confirmations,
        timestamp: new Date(tx.time * 1000).toISOString(),
        type: tx.category
      }));
    } catch (error) {
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
      // Validate the address
      const isValid = await this.verifyAddress(toAddress);
      if (!isValid) {
        throw new Error(`Invalid address: ${toAddress}`);
      }
      
      // Create a raw transaction
      const utxos = await this.client.call('listunspent', [0, 9999999, [this.walletAddress]]);
      
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
      const rawTx = await this.client.call('createrawtransaction', [inputs, outputs]);
      
      // Sign the transaction
      const signedTx = await this.client.call('signrawtransactionwithkey', [rawTx, [this.secret]]);
      
      if (!signedTx.complete) {
        throw new Error('Failed to sign transaction');
      }
      
      // Send the transaction
      const txid = await this.client.call('sendrawtransaction', [signedTx.hex]);
      
      return txid;
    } catch (error) {
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
      const result = await this.client.call('validateaddress', [address]);
      return result.isvalid;
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
      // Get the fee estimate from the full node
      const feeRate = await this.client.call('estimatesmartfee', [6]); // 6 blocks target
      
      // Calculate the fee based on the transaction size
      // A typical transaction is around 250 bytes
      const txSize = 250;
      const fee = (feeRate.feerate * txSize) / 1000; // Convert from BTC/kB to BTC
      
      return fee;
    } catch (error) {
      // If fee estimation fails, return a default fee
      console.warn(`Failed to estimate fee: ${error.message}. Using default fee.`);
      return 0.0001; // Default fee
    }
  }
  
  /**
   * Get the current blockchain height
   * @returns {Promise<number>} The blockchain height
   */
  async getBlockchainHeight() {
    try {
      const info = await this.client.call('getblockchaininfo');
      return info.blocks;
    } catch (error) {
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
      const tx = await this.client.call('gettransaction', [txid]);
      return tx;
    } catch (error) {
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
      return true;
    } catch (error) {
      throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
    }
  }
}

module.exports = {
  FullNodeConnector
};
