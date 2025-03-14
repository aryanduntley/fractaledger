/**
 * Transaction Builder
 * 
 * This module provides functionality for creating and signing UTXO-based transactions
 * without any direct blockchain interaction. It focuses solely on transaction creation
 * and signing, delegating the broadcasting responsibility to the user's environment.
 */

const bitcoin = require('bitcoinjs-lib');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'transaction-builder' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/transaction-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/transaction.log' })
  ]
});

/**
 * Get network parameters for a specific blockchain and network
 * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
 * @param {string} network The network type (mainnet, testnet)
 * @returns {Object} The network parameters
 */
function getNetworkParams(blockchain, network) {
  switch (blockchain) {
    case 'bitcoin':
      return network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
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
      throw new Error(`Unsupported blockchain: ${blockchain}`);
  }
}

/**
 * Transaction Builder class
 */
class TransactionBuilder {
  /**
   * Constructor
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {string} network The network type (mainnet, testnet)
   */
  constructor(blockchain, network = 'mainnet') {
    this.blockchain = blockchain;
    this.network = network;
    this.networkParams = getNetworkParams(blockchain, network);
  }
  
/**
 * Create and sign a transaction
 * @param {string} privateKey The private key in WIF format
 * @param {Array} inputs The transaction inputs (UTXOs)
 * @param {Array} outputs The transaction outputs
 * @param {Object} options Additional options
 * @returns {string} The signed transaction in hexadecimal format
 */
createAndSignTransaction(privateKey, inputs, outputs, options = {}) {
  try {
    logger.debug(`Creating transaction with ${inputs.length} inputs and ${outputs.length} outputs`);
    
    // In bitcoinjs-lib v6, TransactionBuilder is deprecated
    // We need to use the new Transaction class directly
    const psbt = new bitcoin.Psbt({ network: this.networkParams });
    
    // Add inputs
    inputs.forEach(input => {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        // Add any other required fields for the input
        witnessUtxo: {
          script: Buffer.from('', 'hex'), // This is a placeholder, real implementation would need the actual script
          value: input.value,
        },
      });
    });
    
    // Add outputs
    outputs.forEach(output => {
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    });
    
    // Sign inputs
    const keyPair = bitcoin.ECPair.fromWIF(privateKey, this.networkParams);
    inputs.forEach((_, index) => {
      psbt.signInput(index, keyPair);
    });
    
    // Finalize and build the transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    
    // Get the transaction in hexadecimal format
    const txHex = tx.toHex();
    
    const txid = tx.getId();
    logger.info(`Transaction created successfully: ${txid}`);
    
    return {
      txid,
      txHex,
      inputs: inputs.length,
      outputs: outputs.length,
      fee: this._calculateFee(inputs, outputs)
    };
  } catch (error) {
    logger.error(`Failed to create transaction: ${error.message}`);
    throw new Error(`Failed to create transaction: ${error.message}`);
  }
}
  
  /**
   * Calculate the fee for a transaction
   * @param {Array} inputs The transaction inputs
   * @param {Array} outputs The transaction outputs
   * @returns {number} The transaction fee
   * @private
   */
  _calculateFee(inputs, outputs) {
    // Calculate the total input value
    const inputValue = inputs.reduce((total, input) => total + input.value, 0);
    
    // Calculate the total output value
    const outputValue = outputs.reduce((total, output) => total + output.value, 0);
    
    // Calculate the fee
    return inputValue - outputValue;
  }
  
  /**
   * Verify if an address is valid
   * @param {string} address The address to verify
   * @returns {boolean} True if the address is valid
   */
  verifyAddress(address) {
    try {
      bitcoin.address.toOutputScript(address, this.networkParams);
      return true;
    } catch (error) {
      logger.debug(`Invalid address: ${address} - ${error.message}`);
      return false;
    }
  }
  
  /**
   * Estimate the size of a transaction
   * @param {number} inputCount The number of inputs
   * @param {number} outputCount The number of outputs
   * @returns {number} The estimated transaction size in bytes
   */
  estimateTransactionSize(inputCount, outputCount) {
    // A rough estimate of transaction size
    // Input size: ~148 bytes
    // Output size: ~34 bytes
    // Transaction overhead: ~10 bytes
    return 10 + (inputCount * 148) + (outputCount * 34);
  }
  
  /**
   * Estimate the fee for a transaction
   * @param {number} inputCount The number of inputs
   * @param {number} outputCount The number of outputs
   * @param {number} feeRate The fee rate in satoshis per byte
   * @returns {number} The estimated fee in satoshis
   */
  estimateFee(inputCount, outputCount, feeRate = 1) {
    const size = this.estimateTransactionSize(inputCount, outputCount);
    return size * feeRate;
  }
}

module.exports = {
  TransactionBuilder,
  getNetworkParams
};
