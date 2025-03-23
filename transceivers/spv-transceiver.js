/**
 * SPV Transceiver for UTXO-based Blockchains
 * 
 * This module provides a unified SPV (Simplified Payment Verification) transceiver
 * implementation for UTXO-based blockchains (Bitcoin, Litecoin, Dogecoin).
 * It uses the Electrum protocol to interact with the blockchain through SPV nodes.
 */

const { UTXOTransceiver } = require('../src/blockchain/utxoTransceiver');
const ElectrumClient = require('electrum-client');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'spv-transceiver' },
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

// Default Electrum servers for different blockchains
const DEFAULT_ELECTRUM_SERVERS = {
  bitcoin: {
    mainnet: {
      server: 'electrum.blockstream.info',
      port: 50002,
      protocol: 'ssl'
    },
    testnet: {
      server: 'testnet.aranguren.org',
      port: 51002,
      protocol: 'ssl'
    }
  },
  litecoin: {
    mainnet: {
      server: 'electrum-ltc.bysh.me',
      port: 50002,
      protocol: 'ssl'
    },
    testnet: {
      server: 'electrum.ltc.xurious.com',
      port: 51002,
      protocol: 'ssl'
    }
  },
  dogecoin: {
    mainnet: {
      server: 'electrum.dogecoin.com',
      port: 50002,
      protocol: 'ssl'
    },
    testnet: {
      server: 'electrum-testnet.dogecoin.com',
      port: 51002,
      protocol: 'ssl'
    }
  }
};

/**
 * SPV Transceiver class for UTXO-based blockchains
 */
class SPVTransceiver extends UTXOTransceiver {
  /**
   * Constructor
   * @param {Object} config The transceiver configuration
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize configuration with defaults
    this.config = {
      // Default to Bitcoin mainnet if not specified
      blockchain: 'bitcoin',
      network: 'mainnet',
      monitoringInterval: 60000, // 1 minute
      reconnectInterval: 10000, // 10 seconds
      maxReconnectAttempts: 5,
      
      // Override with user-provided configuration
      ...config
    };
    
    // Initialize client
    this.client = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    
    // Initialize monitoring state
    this.monitoredAddresses = new Map();
    this.monitoringIntervals = new Map();
    this.subscriptions = new Map();
    
    // Get server details based on blockchain and network
    const serverConfig = this._getServerConfig();
    this.serverConfig = serverConfig;
    
    logger.info(`SPV Transceiver initialized for ${this.config.blockchain} (${this.config.network})`);
    logger.debug(`Server config: ${JSON.stringify(serverConfig)}`);
  }
  
  /**
   * Get server configuration based on blockchain and network
   * @returns {Object} Server configuration
   * @private
   */
  _getServerConfig() {
    // Get default server config for the blockchain and network
    const defaultConfig = DEFAULT_ELECTRUM_SERVERS[this.config.blockchain]?.[this.config.network];
    
    // If no default config is found, throw an error
    if (!defaultConfig) {
      throw new Error(`No default server configuration found for ${this.config.blockchain} (${this.config.network})`);
    }
    
    // Override with user-provided server config
    return {
      ...defaultConfig,
      server: this.config.server || defaultConfig.server,
      port: this.config.port || defaultConfig.port,
      protocol: this.config.protocol || defaultConfig.protocol
    };
  }
  
  /**
   * Initialize the transceiver
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.debug('Initializing SPV transceiver');
    
    try {
      // Connect to the Electrum server
      await this._connect();
      
      logger.info('SPV transceiver initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize SPV transceiver: ${error.message}`);
      throw new Error(`Failed to initialize SPV transceiver: ${error.message}`);
    }
  }
  
  /**
   * Connect to the Electrum server
   * @returns {Promise<void>}
   * @private
   */
  async _connect() {
    try {
      logger.debug(`Connecting to Electrum server: ${this.serverConfig.server}:${this.serverConfig.port} (${this.serverConfig.protocol})`);
      
      // Create a new Electrum client
      this.client = new ElectrumClient(
        this.serverConfig.port,
        this.serverConfig.server,
        this.serverConfig.protocol
      );
      
      // Connect to the server
      await this.client.connect();
      
      // Get server version
      const [version, protocolVersion] = await this.client.server_version('SPV-Transceiver', '1.4');
      
      logger.info(`Connected to Electrum server: ${this.serverConfig.server}:${this.serverConfig.port}`);
      logger.debug(`Server version: ${version}, Protocol version: ${protocolVersion}`);
      
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Set up event handlers
      this._setupEventHandlers();
    } catch (error) {
      logger.error(`Failed to connect to Electrum server: ${error.message}`);
      
      // Attempt to reconnect
      await this._reconnect();
    }
  }
  
  /**
   * Reconnect to the Electrum server
   * @returns {Promise<void>}
   * @private
   */
  async _reconnect() {
    // Increment reconnect attempts
    this.reconnectAttempts++;
    
    // Check if max reconnect attempts reached
    if (this.reconnectAttempts > this.config.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`);
      throw new Error(`Failed to connect to Electrum server after ${this.config.maxReconnectAttempts} attempts`);
    }
    
    logger.debug(`Reconnecting to Electrum server (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
    
    // Wait for reconnect interval
    await new Promise(resolve => setTimeout(resolve, this.config.reconnectInterval));
    
    // Try to connect again
    await this._connect();
  }
  
  /**
   * Set up event handlers for the Electrum client
   * @private
   */
  _setupEventHandlers() {
    if (!this.client) return;
    
    // Handle disconnection
    this.client.on('error', async (error) => {
      logger.error(`Electrum client error: ${error.message}`);
      
      if (this.connected) {
        this.connected = false;
        
        // Try to reconnect
        await this._reconnect();
      }
    });
    
    this.client.on('close', async () => {
      logger.warn('Electrum client disconnected');
      
      if (this.connected) {
        this.connected = false;
        
        // Try to reconnect
        await this._reconnect();
      }
    });
  }
  
  /**
   * Broadcast a transaction to the blockchain network
   * @param {string} txHex The transaction in hexadecimal format
   * @param {Object} metadata Additional metadata about the transaction
   * @returns {Promise<string>} The transaction ID
   */
  async broadcastTransaction(txHex, metadata = {}) {
    logger.debug(`Broadcasting transaction: ${metadata.txid || 'unknown'}`);
    
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this._connect();
      }
      
      // Broadcast the transaction
      const txid = await this.client.blockchain_transaction_broadcast(txHex);
      
      logger.info(`Transaction broadcasted: ${txid}`);
      
      // Emit a transaction event
      this.emit('transaction', {
        txid,
        txHex,
        metadata,
        timestamp: Date.now()
      });
      
      return txid;
    } catch (error) {
      logger.error(`Failed to broadcast transaction: ${error.message}`);
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  /**
   * Start monitoring a wallet address for new transactions
   * @param {string} address The wallet address to monitor
   * @param {Function} callback Function to call when new transactions are detected
   * @returns {Promise<Object>} Monitoring subscription details
   */
  async monitorWalletAddress(address, callback) {
    logger.debug(`Starting to monitor wallet address: ${address}`);
    
    try {
      // Check if the address is already being monitored
      if (this.monitoredAddresses.has(address)) {
        logger.debug(`Address ${address} is already being monitored`);
        return this.monitoredAddresses.get(address);
      }
      
      // Ensure we're connected
      if (!this.connected) {
        await this._connect();
      }
      
      // Store the monitoring details
      this.monitoredAddresses.set(address, {
        address,
        callback,
        timestamp: Date.now(),
        status: 'active',
        method: 'electrum',
        lastChecked: Date.now()
      });
      
      // Set up address monitoring using Electrum's scripthash_subscribe
      const scripthash = this._addressToScripthash(address);
      
      // Subscribe to address changes
      const status = await this.client.blockchain_scripthash_subscribe(scripthash);
      
      // Store the subscription
      this.subscriptions.set(address, {
        scripthash,
        status
      });
      
      // Set up a handler for scripthash notifications
      this.client.on('blockchain.scripthash.subscribe', async (scripthash, status) => {
        // Find the address for this scripthash
        const monitoredAddress = Array.from(this.subscriptions.entries())
          .find(([_, sub]) => sub.scripthash === scripthash)?.[0];
        
        if (monitoredAddress && this.monitoredAddresses.has(monitoredAddress)) {
          // Get the monitoring details
          const monitoring = this.monitoredAddresses.get(monitoredAddress);
          
          // Get the new transactions
          const transactions = await this.getTransactionHistory(monitoredAddress);
          
          // Filter for new transactions
          const newTransactions = transactions.filter(tx => tx.timestamp > monitoring.lastChecked);
          
          if (newTransactions.length > 0) {
            // Call the callback with the new transactions
            monitoring.callback(newTransactions);
            
            // Emit a transactions event
            this.emit('transactions', {
              address: monitoredAddress,
              transactions: newTransactions
            });
            
            // Update the last checked timestamp
            this.monitoredAddresses.set(monitoredAddress, {
              ...monitoring,
              lastChecked: Date.now()
            });
          }
        }
      });
      
      // As a fallback, also set up polling
      const interval = this.config.monitoringInterval || 60000; // Default to 1 minute
      
      // Create a polling interval
      const intervalId = setInterval(async () => {
        try {
          // Ensure we're connected
          if (!this.connected) {
            await this._connect();
          }
          
          // Get the transaction history
          const transactions = await this.getTransactionHistory(address);
          
          // Get the current monitoring details
          const monitoring = this.monitoredAddresses.get(address);
          
          // Check if there are new transactions
          if (monitoring && monitoring.lastChecked) {
            const newTransactions = transactions.filter(tx => tx.timestamp > monitoring.lastChecked);
            
            if (newTransactions.length > 0) {
              // Call the callback with the new transactions
              callback(newTransactions);
              
              // Emit a transactions event
              this.emit('transactions', {
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
      
      // Store the interval ID
      this.monitoringIntervals.set(address, intervalId);
      
      logger.info(`Address ${address} is now being monitored (interval: ${interval}ms)`);
      
      return {
        address,
        status: 'active',
        method: 'electrum',
        interval
      };
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
    logger.debug(`Stopping monitoring for wallet address: ${address}`);
    
    try {
      // Check if the address is being monitored
      if (!this.monitoredAddresses.has(address)) {
        logger.debug(`Address ${address} is not being monitored`);
        return false;
      }
      
      // Get the interval ID
      const intervalId = this.monitoringIntervals.get(address);
      
      // Clear the interval
      if (intervalId) {
        clearInterval(intervalId);
        this.monitoringIntervals.delete(address);
      }
      
      // Unsubscribe from address changes
      if (this.subscriptions.has(address) && this.connected) {
        const { scripthash } = this.subscriptions.get(address);
        
        try {
          await this.client.blockchain_scripthash_unsubscribe(scripthash);
        } catch (error) {
          logger.warn(`Failed to unsubscribe from scripthash ${scripthash}: ${error.message}`);
        }
        
        this.subscriptions.delete(address);
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
    logger.debug(`Getting balance for wallet address: ${address}`);
    
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this._connect();
      }
      
      // Get the scripthash for the address
      const scripthash = this._addressToScripthash(address);
      
      // Get the balance
      const { confirmed, unconfirmed } = await this.client.blockchain_scripthash_getBalance(scripthash);
      
      // Convert from satoshis to whole coins
      const balance = (confirmed + unconfirmed) / 100000000;
      
      logger.debug(`Balance for address ${address}: ${balance}`);
      
      // Emit a balance event
      this.emit('balance', {
        address,
        balance,
        confirmed: confirmed / 100000000,
        unconfirmed: unconfirmed / 100000000,
        timestamp: Date.now()
      });
      
      return balance;
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
    logger.debug(`Getting transaction history for wallet address: ${address}`);
    
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this._connect();
      }
      
      // Get the scripthash for the address
      const scripthash = this._addressToScripthash(address);
      
      // Get the transaction history
      const history = await this.client.blockchain_scripthash_getHistory(scripthash);
      
      // Sort by height (descending) and limit
      const sortedHistory = history
        .sort((a, b) => (b.height || Infinity) - (a.height || Infinity))
        .slice(0, limit);
      
      // Get transaction details for each transaction
      const transactions = await Promise.all(
        sortedHistory.map(async (tx) => {
          try {
            // Get transaction details
            const txDetails = await this.client.blockchain_transaction_get(tx.tx_hash, true);
            
            // Get block height and time
            let timestamp = Date.now(); // Default to current time for unconfirmed transactions
            let confirmations = 0;
            
            if (tx.height > 0) {
              // Get block header
              const header = await this.client.blockchain_block_header(tx.height);
              const blockTime = this._parseBlockTime(header);
              timestamp = blockTime * 1000; // Convert to milliseconds
              
              // Get current height
              const currentHeight = await this.client.blockchain_headers_subscribe();
              confirmations = currentHeight.height - tx.height + 1;
            }
            
            // Calculate amount
            let amount = 0;
            let type = 'unknown';
            
            // Check inputs to determine if this is an outgoing transaction
            const isOutgoing = txDetails.vin.some(input => {
              if (!input.prevout) return false;
              return this._isAddressInOutput(address, input.prevout);
            });
            
            if (isOutgoing) {
              // For outgoing transactions, sum the outputs that are not change
              amount = txDetails.vout
                .filter(output => !this._isAddressInOutput(address, output))
                .reduce((sum, output) => sum + output.value, 0);
              
              // Make the amount negative for outgoing transactions
              amount = -amount;
              type = 'outgoing';
            } else {
              // For incoming transactions, sum the outputs to this address
              amount = txDetails.vout
                .filter(output => this._isAddressInOutput(address, output))
                .reduce((sum, output) => sum + output.value, 0);
              
              type = 'incoming';
            }
            
            // Convert from satoshis to whole coins
            amount = amount / 100000000;
            
            return {
              txid: tx.tx_hash,
              blockHeight: tx.height > 0 ? tx.height : null,
              timestamp,
              amount,
              fee: txDetails.fee ? txDetails.fee / 100000000 : null,
              confirmations,
              type
            };
          } catch (error) {
            logger.warn(`Failed to get details for transaction ${tx.tx_hash}: ${error.message}`);
            
            // Return a minimal transaction object
            return {
              txid: tx.tx_hash,
              blockHeight: tx.height > 0 ? tx.height : null,
              timestamp: Date.now(),
              amount: 0,
              confirmations: tx.height > 0 ? 1 : 0,
              type: 'unknown'
            };
          }
        })
      );
      
      logger.debug(`Got ${transactions.length} transactions for address ${address}`);
      
      return transactions;
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
    logger.debug(`Getting UTXOs for wallet address: ${address}`);
    
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this._connect();
      }
      
      // Get the scripthash for the address
      const scripthash = this._addressToScripthash(address);
      
      // Get the UTXOs
      const utxos = await this.client.blockchain_scripthash_listunspent(scripthash);
      
      // Transform the UTXOs
      const transformedUtxos = utxos.map(utxo => ({
        txid: utxo.tx_hash,
        vout: utxo.tx_pos,
        value: utxo.value / 100000000, // Convert from satoshis to whole coins
        height: utxo.height,
        confirmations: utxo.height > 0 ? 1 : 0 // We don't have confirmation count from listunspent
      }));
      
      logger.debug(`Got ${transformedUtxos.length} UTXOs for address ${address}`);
      
      return transformedUtxos;
    } catch (error) {
      logger.error(`Failed to get UTXOs for address ${address}: ${error.message}`);
      throw new Error(`Failed to get UTXOs for address ${address}: ${error.message}`);
    }
  }
  
  /**
   * Clean up resources used by the transceiver
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.debug('Cleaning up SPV transceiver resources');
    
    try {
      // Stop all monitoring intervals
      for (const [address, intervalId] of this.monitoringIntervals.entries()) {
        clearInterval(intervalId);
        this.monitoringIntervals.delete(address);
      }
      
      // Clear all monitored addresses
      this.monitoredAddresses.clear();
      
      // Clear all subscriptions
      this.subscriptions.clear();
      
      // Close the Electrum client connection
      if (this.client && this.connected) {
        await this.client.close();
        this.client = null;
        this.connected = false;
      }
      
      logger.info('SPV transceiver resources cleaned up successfully');
    } catch (error) {
      logger.error(`Failed to clean up SPV transceiver resources: ${error.message}`);
      throw new Error(`Failed to clean up SPV transceiver resources: ${error.message}`);
    }
  }
  
  /**
   * Convert an address to a scripthash
   * @param {string} address The address to convert
   * @returns {string} The scripthash
   * @private
   */
  _addressToScripthash(address) {
    // This is a simplified implementation
    // In a real implementation, you would need to:
    // 1. Convert the address to a script
    // 2. Hash the script with SHA256
    // 3. Reverse the hash
    // 4. Convert to hex
    
    // For now, we'll just return a mock scripthash
    // This should be replaced with a proper implementation
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(address).digest('hex');
    
    // Reverse the hash (Electrum uses little-endian)
    return hash.match(/.{2}/g).reverse().join('');
  }
  
  /**
   * Parse block time from a block header
   * @param {string} header The block header
   * @returns {number} The block time
   * @private
   */
  _parseBlockTime(header) {
    // Block header format: https://en.bitcoin.it/wiki/Block_hashing_algorithm
    // Time is a 4-byte timestamp at bytes 68-72
    
    // Convert header from hex to buffer
    const headerBuffer = Buffer.from(header, 'hex');
    
    // Extract timestamp (little-endian)
    const timestamp = headerBuffer.readUInt32LE(68);
    
    return timestamp;
  }
  
  /**
   * Check if an address is in a transaction output
   * @param {string} address The address to check
   * @param {Object} output The transaction output
   * @returns {boolean} True if the address is in the output
   * @private
   */
  _isAddressInOutput(address, output) {
    // Check if the output has a scriptPubKey
    if (!output.scriptpubkey_address) return false;
    
    // Check if the address matches
    return output.scriptpubkey_address === address;
  }
}

module.exports = SPVTransceiver;
