/*
 * FractaLedger Default Chaincode
 *
 * This is the default chaincode template for the FractaLedger system.
 * It provides basic functionality for managing internal wallets and transactions.
 * Users can customize this template to fit their specific needs.
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class FractaLedgerContract extends Contract {
  /**
   * Initialize the ledger
   * @param {Context} ctx The transaction context
   */
  async initLedger(ctx) {
    console.info('============= START : Initialize Ledger ===========');
    
    // Initialize any required data structures
    
    console.info('============= END : Initialize Ledger ===========');
  }
  
  /**
   * Create a new internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {string} primaryWalletName The primary wallet name
   * @returns {Object} The created internal wallet
   */
  async createInternalWallet(ctx, id, blockchain, primaryWalletName) {
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
        internalWallets.push(internalWallet);
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
  
  // Add your custom chaincode functions here
  
  /**
   * Example: Distribute funds to internal wallets based on a percentage
   * @param {Context} ctx The transaction context
   * @param {string} primaryWalletName The primary wallet name
   * @param {number} amount The amount to distribute
   * @param {Object} percentages The distribution percentages
   * @returns {Object} The distribution result
   */
  async distributeFunds(ctx, primaryWalletName, amount, percentages) {
    console.info('============= START : Distribute Funds ===========');
    
    // Parse the amount and percentages
    const totalAmount = parseFloat(amount);
    const distributionPercentages = JSON.parse(percentages);
    
    // Get all internal wallets for the primary wallet
    const allWallets = await this.getAllInternalWallets(ctx);
    const wallets = allWallets.filter(wallet => wallet.primaryWalletName === primaryWalletName);
    
    // Distribute funds based on percentages
    const distributions = [];
    
    for (const wallet of wallets) {
      if (distributionPercentages[wallet.id]) {
        const percentage = distributionPercentages[wallet.id];
        const distributionAmount = totalAmount * (percentage / 100);
        
        // Update the wallet balance
        wallet.balance += distributionAmount;
        wallet.updatedAt = new Date().toISOString();
        
        // Store the updated wallet on the ledger
        await ctx.stub.putState(wallet.id, Buffer.from(JSON.stringify(wallet)));
        
        // Add to distributions
        distributions.push({
          walletId: wallet.id,
          percentage,
          amount: distributionAmount
        });
      }
    }
    
    // Create a distribution record
    const distributionId = ctx.stub.getTxID();
    const distribution = {
      id: distributionId,
      primaryWalletName,
      totalAmount,
      distributions,
      timestamp: new Date().toISOString()
    };
    
    // Store the distribution record on the ledger
    await ctx.stub.putState(`DISTRIBUTION_${distributionId}`, Buffer.from(JSON.stringify(distribution)));
    
    console.info('============= END : Distribute Funds ===========');
    
    return distribution;
  }
}

module.exports = FractaLedgerContract;
