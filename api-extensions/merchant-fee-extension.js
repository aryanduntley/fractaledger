/**
 * Merchant Fee API Extension
 * 
 * This extension adds endpoints for managing merchant fees and processing merchant transactions.
 * It is designed to work with the merchant-fee chaincode template.
 */

/**
 * Register the merchant fee extension with the API server
 * @param {Object} app The Express app instance
 * @param {Function} authenticateJWT The authentication middleware
 * @param {Object} dependencies Additional dependencies (walletManager, fabricClient, etc.)
 */
function registerMerchantFeeExtension(app, authenticateJWT, dependencies) {
  const { walletManager, fabricClient } = dependencies;
  
  /**
   * Create or update fee configuration
   * POST /api/fee-config
   */
  app.post('/api/fee-config', authenticateJWT, async (req, res) => {
    try {
      const { defaultFeePercentage, minFeeAmount, maxFeeAmount, merchantSpecificFees } = req.body;
      
      if (defaultFeePercentage === undefined) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Submit the fee configuration to the Fabric network
      const result = await fabricClient.submitTransaction(
        'updateFeeConfiguration',
        defaultFeePercentage.toString(),
        (minFeeAmount || 0).toString(),
        (maxFeeAmount || 1).toString(),
        JSON.stringify(merchantSpecificFees || {})
      );
      
      const feeConfig = JSON.parse(result.toString());
      
      res.json(feeConfig);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get fee configuration
   * GET /api/fee-config
   */
  app.get('/api/fee-config', authenticateJWT, async (req, res) => {
    try {
      // Get the fee configuration from the Fabric network
      const result = await fabricClient.evaluateTransaction('getFeeConfiguration');
      const feeConfig = JSON.parse(result.toString());
      
      res.json(feeConfig);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Fund an internal wallet (simulate deposit)
   * POST /api/internal-wallets/:id/fund
   */
  app.post('/api/internal-wallets/:id/fund', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      
      if (!amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get the internal wallet
      const internalWallet = await walletManager.getInternalWallet(id);
      
      if (!internalWallet) {
        return res.status(404).json({ error: 'Internal wallet not found' });
      }
      
      // Check if this is a base internal wallet
      if (internalWallet.metadata && internalWallet.metadata.isBaseWallet) {
        return res.status(400).json({
          error: 'Cannot directly fund a base internal wallet. Base internal wallet balances are automatically calculated during reconciliation.',
          messages: [
            {
              type: 'error',
              code: 'ERROR_005',
              message: 'Cannot directly fund a base internal wallet',
              data: {
                walletId: id,
                isBaseWallet: true
              },
              timestamp: new Date().toISOString()
            }
          ]
        });
      }
      
      // Update the internal wallet balance
      try {
        const updatedWallet = await walletManager.updateInternalWalletBalance(id, parseFloat(amount));
        
        // Trigger reconciliation to update the base wallet balance
        try {
          await walletManager.reconcileBaseInternalWallet(internalWallet.blockchain, internalWallet.primaryWalletName);
        } catch (reconciliationError) {
          console.warn(`Failed to reconcile base internal wallet after funding: ${reconciliationError.message}`);
          // Continue with the operation even if reconciliation fails
        }
        
        res.json(updatedWallet);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Process a merchant transaction
   * POST /api/transactions/merchant
   */
  app.post('/api/transactions/merchant', authenticateJWT, async (req, res) => {
    try {
      const { fromWalletId, toWalletId, feeWalletId, amount } = req.body;
      
      if (!fromWalletId || !toWalletId || !feeWalletId || !amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get the wallets
      const fromWallet = await walletManager.getInternalWallet(fromWalletId);
      const toWallet = await walletManager.getInternalWallet(toWalletId);
      const feeWallet = await walletManager.getInternalWallet(feeWalletId);
      
      if (!fromWallet) {
        return res.status(404).json({ error: 'Source wallet not found' });
      }
      
      if (!toWallet) {
        return res.status(404).json({ error: 'Destination wallet not found' });
      }
      
      if (!feeWallet) {
        return res.status(404).json({ error: 'Fee wallet not found' });
      }
      
      // Check if the source wallet has enough balance
      if (fromWallet.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      // Process the merchant transaction
      const result = await fabricClient.submitTransaction(
        'processMerchantTransaction',
        fromWalletId,
        toWalletId,
        feeWalletId,
        amount.toString()
      );
      
      const transaction = JSON.parse(result.toString());
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerMerchantFeeExtension;
