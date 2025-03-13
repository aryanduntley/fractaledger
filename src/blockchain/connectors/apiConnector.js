/**
 * API Connector
 * 
 * This module provides a connector for interacting with blockchain API services.
 */

const { BlockchainConnector } = require('../blockchainConnector');
const axios = require('axios');
const bitcoinjs = require('bitcoinjs-lib');
const bs58check = require('bs58check');

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
   * Test the connection to the API
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    try {
      // Test the connection by getting blockchain information
      await this.client.getBlockchainInfo();
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${this.blockchain} API: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the balance of the wallet
   * @returns {Promise<number>} The wallet balance
   */
  async getBalance() {
    try {
      const addressInfo = await this.client.getAddress(this.walletAddress);
      
      // Different APIs return balance in different formats
      if (this.provider === 'blockCypher') {
        return addressInfo.balance / 100000000; // Convert from satoshis to BTC
      } else if (this.provider === 'blockstream') {
        return addressInfo.balance; // Already converted in getAddress
      } else if (this.provider === 'blockchair') {
        return addressInfo.address.balance / 100000000; // Convert from satoshis to BTC
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
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
      const addressInfo = await this.client.getAddress(this.walletAddress);
      
      // Different APIs return transaction history in different formats
      if (this.provider === 'blockCypher') {
        return addressInfo.txrefs
          .slice(0, limit)
          .map(tx => ({
            txid: tx.tx_hash,
            amount: tx.value / 100000000, // Convert from satoshis to BTC
            confirmations: tx.confirmations,
            timestamp: new Date(tx.confirmed).toISOString(),
            type: tx.spent ? 'sent' : 'received'
          }));
      } else if (this.provider === 'blockstream') {
        const txids = addressInfo.utxos.map(utxo => utxo.txid);
        const transactions = [];
        
        for (let i = 0; i < Math.min(txids.length, limit); i++) {
          const tx = await this.client.getTransaction(txids[i]);
          transactions.push({
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
          });
        }
        
        return transactions;
      } else if (this.provider === 'blockchair') {
        return addressInfo.transactions
          .slice(0, limit)
          .map(async txid => {
            const tx = await this.client.getTransaction(txid);
            return {
              txid,
              amount: tx.transaction.output_total / 100000000, // Convert from satoshis to BTC
              confirmations: tx.transaction.confirmations,
              timestamp: new Date(tx.transaction.time * 1000).toISOString(),
              type: 'unknown' // Need to analyze inputs and outputs to determine type
            };
          });
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
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
      
      // Different APIs handle transaction creation and sending differently
      if (this.provider === 'blockCypher') {
        // Create a new transaction
        const newtx = {
          inputs: [{ addresses: [this.walletAddress] }],
          outputs: [{ addresses: [toAddress], value: Math.round(amount * 100000000) }] // Convert from BTC to satoshis
        };
        
        const txSkeleton = await this.client.createTransaction(newtx.inputs, newtx.outputs);
        
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
        const finalTx = await this.client.sendTransaction(txSkeleton);
        
        return finalTx.tx.hash;
      } else if (this.provider === 'blockstream' || this.provider === 'blockchair') {
        // For Blockstream and Blockchair, we need to create and sign the transaction manually
        
        // Get the UTXOs for the wallet
        const addressInfo = await this.client.getAddress(this.walletAddress);
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
        const txid = await this.client.sendTransaction(txHex);
        
        return txid;
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
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
      const feeEstimates = await this.client.getFeeEstimates();
      
      // Use the specified fee level or default to medium
      const feeLevel = options.feeLevel || 'medium';
      
      return feeEstimates[feeLevel];
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
      const info = await this.client.getBlockchainInfo();
      
      // Different APIs return blockchain height in different formats
      if (this.provider === 'blockCypher') {
        return info.height;
      } else if (this.provider === 'blockstream') {
        return info.height;
      } else if (this.provider === 'blockchair') {
        return info.blocks;
      }
      
      throw new Error(`Unsupported API provider: ${this.provider}`);
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
      return await this.client.getTransaction(txid);
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
      return await this.client.verifyUtxoWallet();
    } catch (error) {
      throw new Error(`Failed to verify UTXO wallet: ${error.message}`);
    }
  }
}

module.exports = {
  ApiConnector
};
