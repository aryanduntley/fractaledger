/**
 * API Server
 * 
 * This module provides RESTful endpoints for interacting with the FractaLedger system.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { MessageType, MessageCode, createMessageManager } = require('./messaging');

/**
 * Start the API server
 * @param {Object} config The configuration object
 * @param {Object} blockchainConnectors The blockchain connectors
 * @param {Object} walletManager The wallet manager
 * @param {Object} fabricClient The Fabric client
 * @param {Object} chaincodeManager The chaincode manager
 * @param {Object} balanceReconciliation The balance reconciliation module
 * @returns {Object} An object containing the Express app and a close function to shut down the server
 */
async function startApiServer(config, blockchainConnectors, walletManager, fabricClient, chaincodeManager, balanceReconciliation) {
  try {
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use(cors(config.api.cors));
    app.use(morgan('combined'));
    
    // Authentication middleware
    const authenticateJWT = (req, res, next) => {
      const authHeader = req.headers.authorization;
      
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        
        jwt.verify(token, config.api.auth.jwtSecret, (err, user) => {
          if (err) {
            return res.sendStatus(403);
          }
          
          req.user = user;
          next();
        });
      } else {
        res.sendStatus(401);
      }
    };
    
    // Routes
    
    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    // Authentication
    app.post('/api/auth/login', (req, res) => {
      // In a real implementation, this would authenticate the user
      // For now, we'll just return a mock token
      const { username, password } = req.body;
      
      if (username === 'admin' && password === 'password') {
        const token = jwt.sign({ username }, config.api.auth.jwtSecret, {
          expiresIn: config.api.auth.expiresIn
        });
        
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
    
    // Wallet management
    app.get('/api/wallets', authenticateJWT, (req, res) => {
      const wallets = walletManager.getAllWallets();
      res.json(wallets);
    });
    
    app.get('/api/wallets/:blockchain', authenticateJWT, (req, res) => {
      const { blockchain } = req.params;
      const wallets = walletManager.getWalletsForBlockchain(blockchain);
      res.json(wallets);
    });
    
    app.get('/api/wallets/:blockchain/:name', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const wallet = walletManager.getWallet(blockchain, name);
        const balance = await wallet.getBalance();
        
        res.json({
          ...wallet,
          balance
        });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    app.get('/api/wallets/:blockchain/:name/read-only', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const wallet = walletManager.getWallet(blockchain, name);
        const balance = await wallet.getBalance();
        
        // Get all internal wallets for this primary wallet
        const internalWallets = await walletManager.getAllInternalWallets();
        const relatedWallets = internalWallets.filter(
          w => w.blockchain === blockchain && w.primaryWalletName === name
        );
        
        // Calculate aggregate internal balance
        const aggregateInternalBalance = relatedWallets.reduce(
          (sum, wallet) => sum + wallet.balance, 
          0
        );
        
        // Calculate excess balance
        const excessBalance = Math.max(0, balance - aggregateInternalBalance);
        
        // Find the base internal wallet for this primary wallet
        const baseWalletPrefix = config.baseInternalWallet.namePrefix;
        const baseInternalWallet = relatedWallets.find(
          w => w.id.startsWith(baseWalletPrefix + blockchain + '_' + name)
        );
        
        res.json({
          blockchain,
          name,
          address: wallet.walletAddress,
          connectionType: wallet.connectionType,
          balance,
          aggregateInternalBalance,
          excessBalance,
          baseInternalWalletId: baseInternalWallet ? baseInternalWallet.id : null
        });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    app.get('/api/wallets/:blockchain/:name/transactions', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const { limit, page, startDate, endDate } = req.query;
        const wallet = walletManager.getWallet(blockchain, name);
        
        // Get transaction history
        const transactions = await wallet.getTransactionHistory(limit ? parseInt(limit) : 10);
        
        // Apply filters if provided
        let filteredTransactions = [...transactions];
        
        // Filter by date range if provided
        if (startDate || endDate) {
          const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
          const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
          
          filteredTransactions = filteredTransactions.filter(tx => 
            tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp
          );
        }
        
        // Apply pagination
        const pageNum = page ? parseInt(page) : 1;
        const pageSize = limit ? parseInt(limit) : 10;
        const startIndex = (pageNum - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
        
        // Return with pagination info
        res.json({
          transactions: paginatedTransactions,
          pagination: {
            page: pageNum,
            limit: pageSize,
            totalItems: filteredTransactions.length,
            totalPages: Math.ceil(filteredTransactions.length / pageSize)
          }
        });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    // Wallet monitoring endpoints
    app.post('/api/wallets/:blockchain/:name/monitor', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const messageManager = createMessageManager();
        
        // Get the wallet
        const wallet = walletManager.getWallet(blockchain, name);
        
        // Start monitoring the wallet
        await wallet.monitorWalletAddress(wallet.walletAddress, (transactions) => {
          // This callback will be called when new transactions are detected
          logger.info(`New transactions detected for wallet ${blockchain}/${name}`, { transactions });
        });
        
        // Add success message
        messageManager.addInfo(
          MessageCode.INFO_007 || 'INFO_007',
          'Wallet monitoring started',
          {
            blockchain,
            walletName: name
          }
        );
        
        res.json(messageManager.createResponse({
          success: true,
          monitoring: {
            blockchain,
            walletName: name,
            walletAddress: wallet.walletAddress,
            status: 'monitoring',
            startedAt: new Date().toISOString()
          }
        }));
      } catch (error) {
        res.status(500).json({ 
          success: false,
          error: error.message,
          messages: [{
            type: 'error',
            code: 'ERROR_001',
            message: `Failed to start monitoring: ${error.message}`,
            timestamp: new Date().toISOString()
          }]
        });
      }
    });
    
    app.delete('/api/wallets/:blockchain/:name/monitor', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const messageManager = createMessageManager();
        
        // Get the wallet
        const wallet = walletManager.getWallet(blockchain, name);
        
        // Stop monitoring the wallet
        await wallet.stopMonitoringWalletAddress(wallet.walletAddress);
        
        // Add success message
        messageManager.addInfo(
          MessageCode.INFO_008 || 'INFO_008',
          'Wallet monitoring stopped',
          {
            blockchain,
            walletName: name
          }
        );
        
        res.json(messageManager.createResponse({
          success: true,
          monitoring: {
            blockchain,
            walletName: name,
            walletAddress: wallet.walletAddress,
            status: 'stopped',
            stoppedAt: new Date().toISOString()
          }
        }));
      } catch (error) {
        res.status(500).json({ 
          success: false,
          error: error.message,
          messages: [{
            type: 'error',
            code: 'ERROR_002',
            message: `Failed to stop monitoring: ${error.message}`,
            timestamp: new Date().toISOString()
          }]
        });
      }
    });
    
    app.get('/api/wallets/monitoring', authenticateJWT, async (req, res) => {
      try {
        // Get all monitored addresses from all blockchain connectors
        const monitoredAddresses = {};
        
        for (const blockchain of Object.keys(blockchainConnectors)) {
          monitoredAddresses[blockchain] = {};
          
          for (const [name, connector] of Object.entries(blockchainConnectors[blockchain])) {
            if (connector.transceiverManager) {
              const addresses = connector.transceiverManager.getAllMonitoredAddresses();
              
              if (addresses.length > 0) {
                monitoredAddresses[blockchain][name] = addresses;
              }
            }
          }
        }
        
        res.json({ wallets: monitoredAddresses });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Internal wallet management
    app.post('/api/internal-wallets', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, primaryWalletName, internalWalletId, metadata } = req.body;
        
        if (!blockchain || !primaryWalletName || !internalWalletId) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const internalWallet = await walletManager.createInternalWallet(blockchain, primaryWalletName, internalWalletId, metadata || {});
        res.json(internalWallet);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    app.get('/api/internal-wallets', authenticateJWT, async (req, res) => {
      try {
        const internalWallets = await walletManager.getAllInternalWallets();
        res.json(internalWallets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/internal-wallets/:id', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const internalWallet = await walletManager.getInternalWallet(id);
        
        if (!internalWallet) {
          return res.status(404).json({ error: 'Internal wallet not found' });
        }
        
        res.json(internalWallet);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/internal-wallets/:id/balance', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await fabricClient.evaluateTransaction('getInternalWalletBalance', id);
        const balance = JSON.parse(result.toString());
        
        res.json(balance);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.put('/api/internal-wallets/:id/metadata', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const { metadata } = req.body;
        
        if (!metadata) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Check if the internal wallet exists
        const internalWallet = await walletManager.getInternalWallet(id);
        
        if (!internalWallet) {
          return res.status(404).json({ error: 'Internal wallet not found' });
        }
        
        // Update the metadata
        const result = await fabricClient.submitTransaction('updateInternalWalletMetadata', id, JSON.stringify(metadata));
        const updatedWallet = JSON.parse(result.toString());
        
        res.json(updatedWallet);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Transactions
    app.post('/api/transactions/internal-transfer', authenticateJWT, async (req, res) => {
      try {
        const messageManager = createMessageManager();
        const { fromInternalWalletId, toInternalWalletId, amount, memo } = req.body;
        
        if (!fromInternalWalletId || !toInternalWalletId || !amount) {
          messageManager.addError(
            MessageCode.ERROR_INVALID_PARAMETERS,
            'Missing required parameters'
          );
          return res.status(400).json(messageManager.createResponse({ success: false }));
        }
        
        // Get the internal wallets
        const fromInternalWallet = await walletManager.getInternalWallet(fromInternalWalletId);
        const toInternalWallet = await walletManager.getInternalWallet(toInternalWalletId);
        
        if (!fromInternalWallet) {
          messageManager.addError(
            MessageCode.ERROR_WALLET_NOT_FOUND,
            'Source internal wallet not found',
            { walletId: fromInternalWalletId }
          );
          return res.status(404).json(messageManager.createResponse({ success: false }));
        }
        
        if (!toInternalWallet) {
          messageManager.addError(
            MessageCode.ERROR_WALLET_NOT_FOUND,
            'Destination internal wallet not found',
            { walletId: toInternalWalletId }
          );
          return res.status(404).json(messageManager.createResponse({ success: false }));
        }
        
        // Ensure both wallets are on the same network (mapped to the same primary wallet)
        if (fromInternalWallet.blockchain !== toInternalWallet.blockchain || 
            fromInternalWallet.primaryWalletName !== toInternalWallet.primaryWalletName) {
          messageManager.addError(
            MessageCode.ERROR_INVALID_PARAMETERS,
            'Internal transfers are only allowed between wallets on the same network and primary wallet',
            {
              fromWalletBlockchain: fromInternalWallet.blockchain,
              fromWalletPrimaryName: fromInternalWallet.primaryWalletName,
              toWalletBlockchain: toInternalWallet.blockchain,
              toWalletPrimaryName: toInternalWallet.primaryWalletName
            }
          );
          return res.status(400).json(messageManager.createResponse({ success: false }));
        }
        
        // Check if the source wallet has enough balance
        if (fromInternalWallet.balance < amount) {
          messageManager.addError(
            MessageCode.ERROR_INSUFFICIENT_BALANCE,
            'Insufficient balance in source wallet',
            {
              walletId: fromInternalWalletId,
              balance: fromInternalWallet.balance,
              requiredAmount: amount
            }
          );
          return res.status(400).json(messageManager.createResponse({ success: false }));
        }
        
        // Submit the transfer transaction to the Fabric network
        const result = await fabricClient.submitTransaction(
          'transferBetweenInternalWallets', 
          fromInternalWalletId, 
          toInternalWalletId, 
          amount.toString()
        );
        
        const transfer = JSON.parse(result.toString());
        
        // Add memo if provided
        if (memo) {
          transfer.memo = memo;
        }
        
        // Add success message
        messageManager.addInfo(
          MessageCode.INFO_TRANSACTION_PROCESSED,
          'Internal transfer processed successfully',
          {
            fromWalletId: fromInternalWalletId,
            toWalletId: toInternalWalletId,
            amount
          }
        );
        
        // Check if the primary wallet balance is low
        const primaryWallet = walletManager.getWallet(fromInternalWallet.blockchain, fromInternalWallet.primaryWalletName);
        const primaryWalletBalance = await primaryWallet.getBalance();
        
        // Get all internal wallets for this primary wallet
        const internalWallets = await walletManager.getInternalWalletsByPrimaryWallet(
          fromInternalWallet.blockchain, 
          fromInternalWallet.primaryWalletName
        );
        
        // Calculate aggregate internal balance
        const aggregateInternalBalance = internalWallets.reduce(
          (sum, wallet) => sum + wallet.balance, 
          0
        );
        
        // If the primary wallet balance is less than 110% of the aggregate internal balance, add a warning
        if (primaryWalletBalance < aggregateInternalBalance * 1.1) {
          messageManager.addWarning(
            MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW,
            'Primary wallet balance is low',
            {
              blockchain: fromInternalWallet.blockchain,
              primaryWalletName: fromInternalWallet.primaryWalletName,
              primaryWalletBalance,
              aggregateInternalBalance
            }
          );
        }
        
        res.json(messageManager.createResponse({ success: true, transfer }));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/transactions/withdraw', authenticateJWT, async (req, res) => {
      try {
        const { internalWalletId, toAddress, amount, opReturn } = req.body;
        
        if (!internalWalletId || !toAddress || !amount) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Validate opReturn if provided
        if (opReturn && Buffer.from(opReturn).length > 80) {
          return res.status(400).json({ 
            error: 'OP_RETURN data exceeds maximum size',
            message: 'OP_RETURN data must be 80 bytes or less'
          });
        }
        
        // Get the internal wallet
        const internalWallet = await walletManager.getInternalWallet(internalWalletId);
        
        if (!internalWallet) {
          return res.status(404).json({ error: 'Internal wallet not found' });
        }
        
        // Get the primary wallet
        const primaryWallet = walletManager.getWallet(internalWallet.blockchain, internalWallet.primaryWalletName);
        
        // Estimate the fee
        const fee = await primaryWallet.estimateFee(toAddress, amount);
        
        // Check if the internal wallet has enough balance
        if (internalWallet.balance < amount + fee) {
          return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Check if the withdrawal is from a base internal wallet
        const isBaseWallet = internalWallet.metadata && internalWallet.metadata.isBaseWallet;
        
        if (!isBaseWallet) {
          // For regular internal wallets, check if the primary wallet has enough balance
          const primaryWalletBalance = await primaryWallet.getBalance();
          
          // Get all internal wallets for this primary wallet
          const internalWallets = await walletManager.getInternalWalletsByPrimaryWallet(
            internalWallet.blockchain, 
            internalWallet.primaryWalletName
          );
          
          // Calculate aggregate internal balance
          const aggregateInternalBalance = internalWallets.reduce(
            (sum, wallet) => sum + wallet.balance, 
            0
          );
          
          // Check if the primary wallet has enough balance to cover all internal wallets
          if (primaryWalletBalance < aggregateInternalBalance) {
            return res.status(400).json({ 
              error: 'Primary wallet balance is less than aggregate internal wallet balances',
              primaryWalletBalance,
              aggregateInternalBalance
            });
          }
        }
        
        // Submit the withdrawal transaction to the Fabric network
        const result = await fabricClient.submitTransaction('withdrawFromInternalWallet', internalWalletId, toAddress, amount.toString(), fee.toString());
        const withdrawal = JSON.parse(result.toString());
        
        // Send the transaction to the blockchain
        const txOptions = { fee };
        
        // Add OP_RETURN data if provided
        if (opReturn) {
          txOptions.opReturn = opReturn;
        }
        
        const txid = await primaryWallet.sendTransaction(toAddress, amount, txOptions);
        
        res.json({
          ...withdrawal,
          txid,
          opReturn: opReturn || undefined
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Transaction Broadcasting Flow
    
    /**
     * Get pending transactions that need to be broadcast
     * GET /api/transactions/pending
     */
    app.get('/api/transactions/pending', authenticateJWT, async (req, res) => {
      try {
        const pendingTransactions = [];
        
        // Get pending transactions from all blockchain connectors
        for (const blockchain of Object.keys(blockchainConnectors)) {
          for (const walletName of Object.keys(blockchainConnectors[blockchain])) {
            const connector = blockchainConnectors[blockchain][walletName];
            
            if (connector.transceiverManager) {
              const walletPendingTxs = connector.transceiverManager.getAllPendingTransactions()
                .filter(tx => tx.status === 'ready')
                .map(tx => ({
                  ...tx,
                  blockchain,
                  primaryWalletName: walletName
                }));
              
              pendingTransactions.push(...walletPendingTxs);
            }
          }
        }
        
        res.json({ pendingTransactions });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    /**
     * Submit transaction broadcast results
     * POST /api/transactions/results
     */
    app.post('/api/transactions/results', authenticateJWT, async (req, res) => {
      try {
        const messageManager = createMessageManager();
        const { txid, success, blockHeight, confirmations, error } = req.body;
        
        if (!txid) {
          messageManager.addError(
            MessageCode.ERROR_INVALID_PARAMETERS,
            'Missing required parameters'
          );
          return res.status(400).json(messageManager.createResponse({ success: false }));
        }
        
        // Find the transaction in the pending transactions
        let transaction = null;
        let connector = null;
        
        // Search for the transaction in all blockchain connectors
        for (const blockchain of Object.keys(blockchainConnectors)) {
          for (const walletName of Object.keys(blockchainConnectors[blockchain])) {
            const conn = blockchainConnectors[blockchain][walletName];
            
            if (conn.transceiverManager) {
              const tx = conn.transceiverManager.getPendingTransaction(txid);
              
              if (tx) {
                transaction = tx;
                connector = conn;
                break;
              }
            }
          }
          
          if (transaction) break;
        }
        
        if (!transaction) {
          messageManager.addError(
            MessageCode.ERROR_TRANSACTION_NOT_FOUND,
            'Transaction not found',
            { txid }
          );
          return res.status(404).json(messageManager.createResponse({ success: false }));
        }
        
        // Update the transaction status
        if (success) {
          transaction.status = 'confirmed';
          transaction.blockHeight = blockHeight;
          transaction.confirmations = confirmations;
          
          messageManager.addInfo(
            MessageCode.INFO_TRANSACTION_PROCESSED,
            'Transaction results recorded successfully',
            {
              txid,
              status: 'confirmed'
            }
          );
        } else {
          transaction.status = 'failed';
          transaction.error = error;
          
          messageManager.addWarning(
            MessageCode.WARN_TRANSACTION_FAILED,
            'Transaction failed to broadcast',
            {
              txid,
              error
            }
          );
        }
        
        // Update the transaction in the transceiver manager
        connector.transceiverManager.pendingTransactions.set(txid, transaction);
        
        res.json(messageManager.createResponse({
          success: true,
          transaction: {
            txid,
            status: transaction.status,
            blockHeight: transaction.blockHeight,
            confirmations: transaction.confirmations,
            timestamp: transaction.timestamp
          }
        }));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/transactions', authenticateJWT, async (req, res) => {
      try {
        const { internalWalletId, limit } = req.query;
        
        if (!internalWalletId) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const result = await fabricClient.evaluateTransaction('getTransactionHistory', internalWalletId, limit || '10');
        const transactions = JSON.parse(result.toString());
        
        res.json(transactions);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Chaincode management
    app.get('/api/chaincode/templates', authenticateJWT, (req, res) => {
      try {
        const templates = chaincodeManager.getAvailableTemplates();
        res.json(templates);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/chaincode/custom', authenticateJWT, (req, res) => {
      try {
        const { templateId, customId } = req.body;
        
        if (!templateId || !customId) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const customChaincode = chaincodeManager.createCustomChaincode(templateId, customId);
        res.json(customChaincode);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    app.get('/api/chaincode/custom', authenticateJWT, (req, res) => {
      try {
        const customChaincodes = chaincodeManager.getCustomChaincodes();
        res.json(customChaincodes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/chaincode/custom/:id', authenticateJWT, (req, res) => {
      try {
        const { id } = req.params;
        const customChaincode = chaincodeManager.getCustomChaincode(id);
        res.json(customChaincode);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    app.put('/api/chaincode/custom/:id', authenticateJWT, (req, res) => {
      try {
        const { id } = req.params;
        const { filePath, content } = req.body;
        
        if (!filePath || !content) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const updatedChaincode = chaincodeManager.updateCustomChaincode(id, filePath, content);
        res.json(updatedChaincode);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    app.delete('/api/chaincode/custom/:id', authenticateJWT, (req, res) => {
      try {
        const { id } = req.params;
        const result = chaincodeManager.deleteCustomChaincode(id);
        res.json({ success: result });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    app.post('/api/chaincode/custom/:id/deploy', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await chaincodeManager.deployCustomChaincode(id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/chaincode/custom/:id/update', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await chaincodeManager.updateDeployedChaincode(id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/chaincode/custom/:id/install-dependencies', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await chaincodeManager.installDependencies(id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Balance reconciliation
    app.get('/api/reconciliation/config', authenticateJWT, (req, res) => {
      try {
        const config = balanceReconciliation.getConfig();
        res.json(config);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/reconciliation/wallet/:blockchain/:name', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        
        // Reconcile the wallet
        const result = await balanceReconciliation.reconcileWallet(blockchain, name);
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/reconciliation/all', authenticateJWT, async (req, res) => {
      try {
        // Perform full reconciliation
        const results = await balanceReconciliation.performFullReconciliation();
        
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/reconciliation/discrepancies', authenticateJWT, async (req, res) => {
      try {
        const { resolved } = req.query;
        
        // Get all discrepancies
        const result = await fabricClient.evaluateTransaction('getBalanceDiscrepancies', resolved || null);
        const discrepancies = JSON.parse(result.toString());
        
        res.json(discrepancies);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/api/reconciliation/discrepancies/:id/resolve', authenticateJWT, async (req, res) => {
      try {
        const { id } = req.params;
        const { resolution } = req.body;
        
        if (!resolution) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Resolve the discrepancy
        const result = await fabricClient.submitTransaction('resolveBalanceDiscrepancy', id, resolution);
        const resolvedDiscrepancy = JSON.parse(result.toString());
        
        res.json(resolvedDiscrepancy);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Wallet destruction
    app.delete('/api/wallets/:blockchain/:name', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const { confirmation } = req.body;
        
        // Require explicit confirmation to prevent accidental deletion
        if (confirmation !== `destroy-${blockchain}-${name}`) {
          return res.status(400).json({ 
            error: 'Explicit confirmation required',
            message: `To confirm deletion, please provide confirmation: "destroy-${blockchain}-${name}"`
          });
        }
        
        // Destroy the wallet
        const result = await walletManager.destroyWallet(blockchain, name);
        
        res.json({
          success: true,
          message: `Wallet ${blockchain}/${name} and all associated data have been destroyed`,
          details: result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start the server
    const port = config.api.port || 3000;
    const host = config.api.host || 'localhost';
    
    const server = app.listen(port, host, () => {
      console.log(`API server listening at http://${host}:${port}`);
    });
    
    // Return the app, authenticateJWT middleware, and a function to close the server
    return {
      app,
      authenticateJWT,
      dependencies: {
        walletManager,
        fabricClient,
        chaincodeManager,
        balanceReconciliation,
        config
      },
      close: () => {
        return new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      },
      // Helper function to register API extensions
      registerExtension: (extension) => {
        if (typeof extension === 'function') {
          extension(app, authenticateJWT, {
            walletManager,
            fabricClient,
            chaincodeManager,
            balanceReconciliation,
            config
          });
          console.log(`API extension registered: ${extension.name || 'Anonymous extension'}`);
        } else {
          throw new Error('Extension must be a function');
        }
      }
    };
  } catch (error) {
    throw new Error(`Failed to start API server: ${error.message}`);
  }
}

module.exports = {
  startApiServer
};
