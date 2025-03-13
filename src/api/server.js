/**
 * API Server
 * 
 * This module provides RESTful endpoints for interacting with the FractaLedger system.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

/**
 * Start the API server
 * @param {Object} config The configuration object
 * @param {Object} blockchainConnectors The blockchain connectors
 * @param {Object} walletManager The wallet manager
 * @param {Object} fabricClient The Fabric client
 * @param {Object} chaincodeManager The chaincode manager
 * @returns {Object} The Express app
 */
async function startApiServer(config, blockchainConnectors, walletManager, fabricClient, chaincodeManager) {
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
    
    app.get('/api/wallets/:blockchain/:name/transactions', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, name } = req.params;
        const { limit } = req.query;
        const wallet = walletManager.getWallet(blockchain, name);
        const transactions = await wallet.getTransactionHistory(limit ? parseInt(limit) : 10);
        
        res.json(transactions);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });
    
    // Internal wallet management
    app.post('/api/internal-wallets', authenticateJWT, async (req, res) => {
      try {
        const { blockchain, primaryWalletName, internalWalletId } = req.body;
        
        if (!blockchain || !primaryWalletName || !internalWalletId) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const internalWallet = await walletManager.createInternalWallet(blockchain, primaryWalletName, internalWalletId);
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
    
    // Transactions
    app.post('/api/transactions/withdraw', authenticateJWT, async (req, res) => {
      try {
        const { internalWalletId, toAddress, amount } = req.body;
        
        if (!internalWalletId || !toAddress || !amount) {
          return res.status(400).json({ error: 'Missing required parameters' });
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
        
        // Submit the withdrawal transaction to the Fabric network
        const result = await fabricClient.submitTransaction('withdrawFromInternalWallet', internalWalletId, toAddress, amount.toString(), fee.toString());
        const withdrawal = JSON.parse(result.toString());
        
        // Send the transaction to the blockchain
        const txid = await primaryWallet.sendTransaction(toAddress, amount, { fee });
        
        res.json({
          ...withdrawal,
          txid
        });
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
    
    // Start the server
    const port = config.api.port || 3000;
    const host = config.api.host || 'localhost';
    
    app.listen(port, host, () => {
      console.log(`API server listening at http://${host}:${port}`);
    });
    
    return app;
  } catch (error) {
    throw new Error(`Failed to start API server: ${error.message}`);
  }
}

module.exports = {
  startApiServer
};
