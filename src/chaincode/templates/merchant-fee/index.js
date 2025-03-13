/*
 * FractaLedger Merchant Fee Chaincode
 *
 * This is a customized chaincode template for the FractaLedger system,
 * specifically designed for merchant fee collection use cases.
 * It extends the default template with additional functionality for
 * handling merchant transactions and fee collection.
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class MerchantFeeContract extends Contract {
  /**
   * Initialize the ledger
   * @param {Context} ctx The transaction context
   */
  async initLedger(ctx) {
    console.info('============= START : Initialize Ledger ===========');
    
    // Initialize any required data structures
    
    // Initialize fee configuration
    const feeConfig = {
      defaultFeePercentage: 1.0, // 1% default fee
      minimumFee: 0.0001, // Minimum fee amount
      maximumFee: 10.0, // Maximum fee amount
      merchantSpecificFees: {}, // Merchant-specific fee percentages
      updatedAt: new Date().toISOString()
    };
    
    // Store the fee configuration on the ledger
    await ctx.stub.putState('FEE_CONFIG', Buffer.from(JSON.stringify(feeConfig)));
    
    console.info('============= END : Initialize Ledger ===========');
  }
  
  /**
   * Create a new internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {string} primaryWalletName The primary wallet name
   * @param {string} type The wallet type (merchant, customer, fee)
   * @returns {Object} The created internal wallet
   */
  async createInternalWallet(ctx, id, blockchain, primaryWalletName, type = 'customer') {
    console.info('============= START : Create Internal Wallet ===========');
    
    // Check if the internal wallet already exists
    const walletAsBytes = await ctx.stub.getState(id);
    if (walletAsBytes && walletAsBytes.length > 0) {
      throw new Error(`Internal wallet ${id} already exists`);
    }
    
    // Create the internal wallet
    const internalWallet = {
      id,
      blockchain,
      primaryWalletName,
      type, // Added wallet type
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store the internal wallet on the ledger
    await ctx.stub.putState(id, Buffer.from(JSON.stringify(internalWallet)));
    
    console.info('============= END : Create Internal Wallet ===========');
    
    return internalWallet;
  }
  
  /**
   * Get an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @returns {Object} The internal wallet
   */
  async getInternalWallet(ctx, id) {
    console.info('============= START : Get Internal Wallet ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    console.info('============= END : Get Internal Wallet ===========');
    
    return internalWallet;
  }
  
  /**
   * Get all internal wallets
   * @param {Context} ctx The transaction context
   * @returns {Array} All internal wallets
   */
  async getAllInternalWallets(ctx) {
    console.info('============= START : Get All Internal Wallets ===========');
    
    // Get all internal wallets from the ledger
    const startKey = '';
    const endKey = '';
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    
    const internalWallets = [];
    
    let result = await iterator.next();
    while (!result.done) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const internalWallet = JSON.parse(value);
        // Only include actual wallet objects (not configuration or other data)
        if (internalWallet.id && internalWallet.blockchain) {
          internalWallets.push(internalWallet);
        }
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get All Internal Wallets ===========');
    
    return internalWallets;
  }
  
  /**
   * Update the balance of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @param {number} balance The new balance
   * @returns {Object} The updated internal wallet
   */
  async updateInternalWalletBalance(ctx, id, balance) {
    console.info('============= START : Update Internal Wallet Balance ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    // Update the balance
    internalWallet.balance = parseFloat(balance);
    internalWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallet on the ledger
    await ctx.stub.putState(id, Buffer.from(JSON.stringify(internalWallet)));
    
    console.info('============= END : Update Internal Wallet Balance ===========');
    
    return internalWallet;
  }
  
  /**
   * Get the balance of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @returns {Object} The internal wallet balance
   */
  async getInternalWalletBalance(ctx, id) {
    console.info('============= START : Get Internal Wallet Balance ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    console.info('============= END : Get Internal Wallet Balance ===========');
    
    return {
      id,
      balance: internalWallet.balance
    };
  }
  
  /**
   * Transfer funds between internal wallets
   * @param {Context} ctx The transaction context
   * @param {string} fromWalletId The source internal wallet ID
   * @param {string} toWalletId The destination internal wallet ID
   * @param {number} amount The amount to transfer
   * @returns {Object} The transfer result
   */
  async transferBetweenInternalWallets(ctx, fromWalletId, toWalletId, amount) {
    console.info('============= START : Transfer Between Internal Wallets ===========');
    
    // Parse the amount
    const transferAmount = parseFloat(amount);
    
    // Get the source internal wallet
    const fromWalletAsBytes = await ctx.stub.getState(fromWalletId);
    if (!fromWalletAsBytes || fromWalletAsBytes.length === 0) {
      throw new Error(`Source internal wallet ${fromWalletId} does not exist`);
    }
    
    const fromWallet = JSON.parse(fromWalletAsBytes.toString());
    
    // Get the destination internal wallet
    const toWalletAsBytes = await ctx.stub.getState(toWalletId);
    if (!toWalletAsBytes || toWalletAsBytes.length === 0) {
      throw new Error(`Destination internal wallet ${toWalletId} does not exist`);
    }
    
    const toWallet = JSON.parse(toWalletAsBytes.toString());
    
    // Check if the source wallet has enough balance
    if (fromWallet.balance < transferAmount) {
      throw new Error(`Insufficient balance in source internal wallet ${fromWalletId}`);
    }
    
    // Update the balances
    fromWallet.balance -= transferAmount;
    fromWallet.updatedAt = new Date().toISOString();
    
    toWallet.balance += transferAmount;
    toWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallets on the ledger
    await ctx.stub.putState(fromWalletId, Buffer.from(JSON.stringify(fromWallet)));
    await ctx.stub.putState(toWalletId, Buffer.from(JSON.stringify(toWallet)));
    
    // Create a transfer record
    const transferId = ctx.stub.getTxID();
    const transfer = {
      id: transferId,
      fromWalletId,
      toWalletId,
      amount: transferAmount,
      timestamp: new Date().toISOString()
    };
    
    // Store the transfer record on the ledger
    await ctx.stub.putState(`TRANSFER_${transferId}`, Buffer.from(JSON.stringify(transfer)));
    
    console.info('============= END : Transfer Between Internal Wallets ===========');
    
    return transfer;
  }
  
  /**
   * Withdraw funds from an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} internalWalletId The internal wallet ID
   * @param {string} toAddress The destination address
   * @param {number} amount The amount to withdraw
   * @param {number} fee The transaction fee
   * @returns {Object} The withdrawal result
   */
  async withdrawFromInternalWallet(ctx, internalWalletId, toAddress, amount, fee) {
    console.info('============= START : Withdraw From Internal Wallet ===========');
    
    // Parse the amount and fee
    const withdrawalAmount = parseFloat(amount);
    const transactionFee = parseFloat(fee);
    const totalAmount = withdrawalAmount + transactionFee;
    
    // Get the internal wallet
    const walletAsBytes = await ctx.stub.getState(internalWalletId);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${internalWalletId} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    // Check if the internal wallet has enough balance
    if (internalWallet.balance < totalAmount) {
      throw new Error(`Insufficient balance in internal wallet ${internalWalletId}`);
    }
    
    // Update the balance
    internalWallet.balance -= totalAmount;
    internalWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallet on the ledger
    await ctx.stub.putState(internalWalletId, Buffer.from(JSON.stringify(internalWallet)));
    
    // Create a withdrawal record
    const withdrawalId = ctx.stub.getTxID();
    const withdrawal = {
      id: withdrawalId,
      internalWalletId,
      toAddress,
      amount: withdrawalAmount,
      fee: transactionFee,
      timestamp: new Date().toISOString()
    };
    
    // Store the withdrawal record on the ledger
    await ctx.stub.putState(`WITHDRAWAL_${withdrawalId}`, Buffer.from(JSON.stringify(withdrawal)));
    
    console.info('============= END : Withdraw From Internal Wallet ===========');
    
    return withdrawal;
  }
  
  /**
   * Get the transaction history of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} internalWalletId The internal wallet ID
   * @param {number} limit The maximum number of transactions to return
   * @returns {Array} The transaction history
   */
  async getTransactionHistory(ctx, internalWalletId, limit = '10') {
    console.info('============= START : Get Transaction History ===========');
    
    // Get the transaction history from the ledger
    const iterator = await ctx.stub.getHistoryForKey(internalWalletId);
    
    const transactions = [];
    let count = 0;
    const maxLimit = parseInt(limit);
    
    let result = await iterator.next();
    while (!result.done && count < maxLimit) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const transaction = {
          txid: result.value.txId,
          timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
          value: JSON.parse(value)
        };
        transactions.push(transaction);
        count++;
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get Transaction History ===========');
    
    return transactions;
  }
  
  // Merchant Fee Specific Functions
  
  /**
   * Update the fee configuration
   * @param {Context} ctx The transaction context
   * @param {number} defaultFeePercentage The default fee percentage
   * @param {number} minimumFee The minimum fee amount
   * @param {number} maximumFee The maximum fee amount
   * @param {Object} merchantSpecificFees Merchant-specific fee percentages
   * @returns {Object} The updated fee configuration
   */
  async updateFeeConfiguration(ctx, defaultFeePercentage, minimumFee, maximumFee, merchantSpecificFees) {
    console.info('============= START : Update Fee Configuration ===========');
    
    // Parse the parameters
    const feePercentage = parseFloat(defaultFeePercentage);
    const minFee = parseFloat(minimumFee);
    const maxFee = parseFloat(maximumFee);
    const merchantFees = JSON.parse(merchantSpecificFees);
    
    // Get the current fee configuration
    const feeConfigAsBytes = await ctx.stub.getState('FEE_CONFIG');
    let feeConfig = {};
    
    if (feeConfigAsBytes && feeConfigAsBytes.length > 0) {
      feeConfig = JSON.parse(feeConfigAsBytes.toString());
    }
    
    // Update the fee configuration
    feeConfig.defaultFeePercentage = feePercentage;
    feeConfig.minimumFee = minFee;
    feeConfig.maximumFee = maxFee;
    feeConfig.merchantSpecificFees = merchantFees;
    feeConfig.updatedAt = new Date().toISOString();
    
    // Store the updated fee configuration on the ledger
    await ctx.stub.putState('FEE_CONFIG', Buffer.from(JSON.stringify(feeConfig)));
    
    console.info('============= END : Update Fee Configuration ===========');
    
    return feeConfig;
  }
  
  /**
   * Get the fee configuration
   * @param {Context} ctx The transaction context
   * @returns {Object} The fee configuration
   */
  async getFeeConfiguration(ctx) {
    console.info('============= START : Get Fee Configuration ===========');
    
    // Get the fee configuration from the ledger
    const feeConfigAsBytes = await ctx.stub.getState('FEE_CONFIG');
    if (!feeConfigAsBytes || feeConfigAsBytes.length === 0) {
      throw new Error('Fee configuration does not exist');
    }
    
    const feeConfig = JSON.parse(feeConfigAsBytes.toString());
    
    console.info('============= END : Get Fee Configuration ===========');
    
    return feeConfig;
  }
  
  /**
   * Process a merchant transaction with fee collection
   * @param {Context} ctx The transaction context
   * @param {string} customerWalletId The customer's internal wallet ID
   * @param {string} merchantWalletId The merchant's internal wallet ID
   * @param {string} feeWalletId The fee collection internal wallet ID
   * @param {number} amount The transaction amount
   * @returns {Object} The transaction result
   */
  async processMerchantTransaction(ctx, customerWalletId, merchantWalletId, feeWalletId, amount) {
    console.info('============= START : Process Merchant Transaction ===========');
    
    // Parse the amount
    const transactionAmount = parseFloat(amount);
    
    // Get the customer wallet
    const customerWalletAsBytes = await ctx.stub.getState(customerWalletId);
    if (!customerWalletAsBytes || customerWalletAsBytes.length === 0) {
      throw new Error(`Customer wallet ${customerWalletId} does not exist`);
    }
    
    const customerWallet = JSON.parse(customerWalletAsBytes.toString());
    
    // Get the merchant wallet
    const merchantWalletAsBytes = await ctx.stub.getState(merchantWalletId);
    if (!merchantWalletAsBytes || merchantWalletAsBytes.length === 0) {
      throw new Error(`Merchant wallet ${merchantWalletId} does not exist`);
    }
    
    const merchantWallet = JSON.parse(merchantWalletAsBytes.toString());
    
    // Get the fee wallet
    const feeWalletAsBytes = await ctx.stub.getState(feeWalletId);
    if (!feeWalletAsBytes || feeWalletAsBytes.length === 0) {
      throw new Error(`Fee wallet ${feeWalletId} does not exist`);
    }
    
    const feeWallet = JSON.parse(feeWalletAsBytes.toString());
    
    // Check if the customer wallet has enough balance
    if (customerWallet.balance < transactionAmount) {
      throw new Error(`Insufficient balance in customer wallet ${customerWalletId}`);
    }
    
    // Get the fee configuration
    const feeConfigAsBytes = await ctx.stub.getState('FEE_CONFIG');
    if (!feeConfigAsBytes || feeConfigAsBytes.length === 0) {
      throw new Error('Fee configuration does not exist');
    }
    
    const feeConfig = JSON.parse(feeConfigAsBytes.toString());
    
    // Calculate the fee
    let feePercentage = feeConfig.defaultFeePercentage;
    
    // Check if there's a merchant-specific fee
    if (feeConfig.merchantSpecificFees[merchantWalletId]) {
      feePercentage = feeConfig.merchantSpecificFees[merchantWalletId];
    }
    
    let feeAmount = transactionAmount * (feePercentage / 100);
    
    // Apply minimum and maximum fee constraints
    if (feeAmount < feeConfig.minimumFee) {
      feeAmount = feeConfig.minimumFee;
    } else if (feeAmount > feeConfig.maximumFee) {
      feeAmount = feeConfig.maximumFee;
    }
    
    // Calculate the merchant amount
    const merchantAmount = transactionAmount - feeAmount;
    
    // Update the balances
    customerWallet.balance -= transactionAmount;
    customerWallet.updatedAt = new Date().toISOString();
    
    merchantWallet.balance += merchantAmount;
    merchantWallet.updatedAt = new Date().toISOString();
    
    feeWallet.balance += feeAmount;
    feeWallet.updatedAt = new Date().toISOString();
    
    // Store the updated wallets on the ledger
    await ctx.stub.putState(customerWalletId, Buffer.from(JSON.stringify(customerWallet)));
    await ctx.stub.putState(merchantWalletId, Buffer.from(JSON.stringify(merchantWallet)));
    await ctx.stub.putState(feeWalletId, Buffer.from(JSON.stringify(feeWallet)));
    
    // Create a transaction record
    const transactionId = ctx.stub.getTxID();
    const transaction = {
      id: transactionId,
      customerWalletId,
      merchantWalletId,
      feeWalletId,
      amount: transactionAmount,
      merchantAmount,
      feeAmount,
      feePercentage,
      timestamp: new Date().toISOString()
    };
    
    // Store the transaction record on the ledger
    await ctx.stub.putState(`MERCHANT_TX_${transactionId}`, Buffer.from(JSON.stringify(transaction)));
    
    console.info('============= END : Process Merchant Transaction ===========');
    
    return transaction;
  }
  
  /**
   * Get merchant transactions
   * @param {Context} ctx The transaction context
   * @param {string} merchantWalletId The merchant's internal wallet ID
   * @param {number} limit The maximum number of transactions to return
   * @returns {Array} The merchant transactions
   */
  async getMerchantTransactions(ctx, merchantWalletId, limit = '10') {
    console.info('============= START : Get Merchant Transactions ===========');
    
    // Get all transactions from the ledger
    const startKey = 'MERCHANT_TX_';
    const endKey = 'MERCHANT_TX_\uffff';
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    
    const transactions = [];
    let count = 0;
    const maxLimit = parseInt(limit);
    
    let result = await iterator.next();
    while (!result.done && count < maxLimit) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const transaction = JSON.parse(value);
        if (transaction.merchantWalletId === merchantWalletId) {
          transactions.push(transaction);
          count++;
        }
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get Merchant Transactions ===========');
    
    return transactions;
  }
}

module.exports = MerchantFeeContract;
