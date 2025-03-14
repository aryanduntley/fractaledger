/**
 * Balance Reconciliation Module
 * 
 * This module provides functionality for verifying and reconciling balances
 * between on-chain wallets and internal wallets to ensure data integrity.
 */

const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'balance-reconciliation' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/reconciliation-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/reconciliation.log' })
  ]
});

/**
 * Initialize the balance reconciliation module
 * @param {Object} config The configuration object
 * @param {Object} walletManager The wallet manager
 * @param {Object} fabricClient The Fabric client
 * @returns {Object} The balance reconciliation module
 */
async function initializeBalanceReconciliation(config, walletManager, fabricClient) {
  try {
    logger.info('Initializing balance reconciliation module...');
    
    // Get reconciliation configuration
    const reconciliationConfig = config.balanceReconciliation || {
      strategy: 'afterTransaction',
      scheduledFrequency: 3600000, // 1 hour
      warningThreshold: 0.00001,
      strictMode: false
    };
    
    // Initialize scheduled reconciliation if enabled
    let scheduledReconciliationInterval = null;
    if (reconciliationConfig.strategy === 'scheduled' || reconciliationConfig.strategy === 'both') {
      logger.info(`Setting up scheduled reconciliation every ${reconciliationConfig.scheduledFrequency}ms`);
      scheduledReconciliationInterval = setInterval(async () => {
        try {
          await performFullReconciliation();
        } catch (error) {
          logger.error(`Scheduled reconciliation failed: ${error.message}`);
        }
      }, reconciliationConfig.scheduledFrequency);
    }
    
    /**
     * Perform reconciliation for a specific blockchain and primary wallet
     * @param {string} blockchain The blockchain type
     * @param {string} primaryWalletName The primary wallet name
     * @returns {Object} The reconciliation result
     */
    async function reconcileWallet(blockchain, primaryWalletName) {
      try {
        logger.info(`Reconciling wallet ${blockchain}/${primaryWalletName}`);
        
        // Get the primary wallet
        const primaryWallet = walletManager.getWallet(blockchain, primaryWalletName);
        
        // Get the on-chain balance
        const onChainBalance = await primaryWallet.getBalance();
        
        // Get all internal wallets for this primary wallet
        const internalWallets = await walletManager.getInternalWalletsByPrimaryWallet(blockchain, primaryWalletName);
        
        // Calculate aggregate internal balance
        const aggregateInternalBalance = internalWallets.reduce(
          (sum, wallet) => sum + wallet.balance, 
          0
        );
        
        // Calculate the difference
        const difference = Math.abs(onChainBalance - aggregateInternalBalance);
        
        // Check if the difference exceeds the warning threshold
        const hasDiscrepancy = difference > reconciliationConfig.warningThreshold;
        
        // Create the reconciliation result
        const result = {
          blockchain,
          primaryWalletName,
          onChainBalance,
          aggregateInternalBalance,
          difference,
          hasDiscrepancy,
          timestamp: new Date().toISOString()
        };
        
        // Log the result
        if (hasDiscrepancy) {
          logger.warn(`Balance discrepancy detected for ${blockchain}/${primaryWalletName}: ${difference}`);
          
          // Record the discrepancy in the ledger
          await fabricClient.submitTransaction(
            'recordBalanceDiscrepancy',
            blockchain,
            primaryWalletName,
            onChainBalance.toString(),
            aggregateInternalBalance.toString(),
            difference.toString()
          );
        } else {
          logger.info(`Balance reconciliation successful for ${blockchain}/${primaryWalletName}`);
        }
        
        return result;
      } catch (error) {
        logger.error(`Failed to reconcile wallet ${blockchain}/${primaryWalletName}: ${error.message}`);
        throw new Error(`Failed to reconcile wallet ${blockchain}/${primaryWalletName}: ${error.message}`);
      }
    }
    
    /**
     * Perform reconciliation for all wallets
     * @returns {Array} The reconciliation results
     */
    async function performFullReconciliation() {
      try {
        logger.info('Performing full reconciliation for all wallets');
        
        const allWallets = walletManager.getAllWallets();
        const reconciliationPromises = [];
        
        for (const wallet of allWallets) {
          reconciliationPromises.push(reconcileWallet(wallet.blockchain, wallet.name));
        }
        
        const results = await Promise.all(reconciliationPromises);
        
        // Check if any discrepancies were found
        const discrepancies = results.filter(result => result.hasDiscrepancy);
        
        if (discrepancies.length > 0) {
          logger.warn(`Found ${discrepancies.length} balance discrepancies during full reconciliation`);
        } else {
          logger.info('Full reconciliation completed successfully with no discrepancies');
        }
        
        return results;
      } catch (error) {
        logger.error(`Failed to perform full reconciliation: ${error.message}`);
        throw new Error(`Failed to perform full reconciliation: ${error.message}`);
      }
    }
    
    /**
     * Verify balance after a transaction
     * @param {string} blockchain The blockchain type
     * @param {string} primaryWalletName The primary wallet name
     * @param {string} transactionType The transaction type
     * @param {Object} transactionDetails The transaction details
     * @returns {Object} The verification result
     */
    async function verifyBalanceAfterTransaction(blockchain, primaryWalletName, transactionType, transactionDetails) {
      try {
        logger.info(`Verifying balance after ${transactionType} transaction for ${blockchain}/${primaryWalletName}`);
        
        // Only perform verification if the strategy is 'afterTransaction' or 'both'
        if (reconciliationConfig.strategy !== 'afterTransaction' && reconciliationConfig.strategy !== 'both') {
          logger.info('After-transaction verification is disabled by configuration');
          return { verified: true, skipped: true };
        }
        
        // Perform reconciliation
        const reconciliationResult = await reconcileWallet(blockchain, primaryWalletName);
        
        // If strict mode is enabled and there's a discrepancy, throw an error
        if (reconciliationConfig.strictMode && reconciliationResult.hasDiscrepancy) {
          throw new Error(`Balance verification failed after ${transactionType} transaction: Discrepancy of ${reconciliationResult.difference}`);
        }
        
        return {
          verified: !reconciliationResult.hasDiscrepancy,
          reconciliationResult,
          transactionType,
          transactionDetails
        };
      } catch (error) {
        logger.error(`Failed to verify balance after transaction: ${error.message}`);
        
        // If strict mode is enabled, rethrow the error
        if (reconciliationConfig.strictMode) {
          throw error;
        }
        
        // Otherwise, return a failed verification result
        return {
          verified: false,
          error: error.message,
          transactionType,
          transactionDetails
        };
      }
    }
    
    // Create the balance reconciliation module
    const balanceReconciliation = {
      /**
       * Reconcile a specific wallet
       * @param {string} blockchain The blockchain type
       * @param {string} primaryWalletName The primary wallet name
       * @returns {Object} The reconciliation result
       */
      reconcileWallet,
      
      /**
       * Perform reconciliation for all wallets
       * @returns {Array} The reconciliation results
       */
      performFullReconciliation,
      
      /**
       * Verify balance after a transaction
       * @param {string} blockchain The blockchain type
       * @param {string} primaryWalletName The primary wallet name
       * @param {string} transactionType The transaction type
       * @param {Object} transactionDetails The transaction details
       * @returns {Object} The verification result
       */
      verifyBalanceAfterTransaction,
      
      /**
       * Get the reconciliation configuration
       * @returns {Object} The reconciliation configuration
       */
      getConfig: () => ({ ...reconciliationConfig }),
      
      /**
       * Stop scheduled reconciliation
       */
      stopScheduledReconciliation: () => {
        if (scheduledReconciliationInterval) {
          clearInterval(scheduledReconciliationInterval);
          scheduledReconciliationInterval = null;
          logger.info('Scheduled reconciliation stopped');
        }
      }
    };
    
    return balanceReconciliation;
  } catch (error) {
    logger.error(`Failed to initialize balance reconciliation module: ${error.message}`);
    throw new Error(`Failed to initialize balance reconciliation module: ${error.message}`);
  }
}

module.exports = {
  initializeBalanceReconciliation
};
