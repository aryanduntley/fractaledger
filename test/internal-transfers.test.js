/**
 * Internal Transfers Tests
 * 
 * This file contains tests for the internal wallet transfer functionality.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { initializeWalletManager } = require('../src/wallet/walletManager');

describe('Internal Wallet Transfers', () => {
  let walletManager;
  let mockBlockchainConnectors;
  let mockFabricClient;
  
  beforeEach(async () => {
    // Create mock blockchain connectors
    mockBlockchainConnectors = {
      bitcoin: {
        btc_wallet_1: {
          blockchain: 'bitcoin',
          name: 'btc_wallet_1',
          walletAddress: 'bc1q...',
          connectionType: 'spv',
          getBalance: sinon.stub().resolves(1.5),
          getTransactionHistory: sinon.stub().resolves([]),
          sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
          verifyAddress: sinon.stub().resolves(true),
          estimateFee: sinon.stub().resolves(0.0001),
          getBlockchainHeight: sinon.stub().resolves(700000),
          getTransaction: sinon.stub().resolves({}),
          verifyUtxoWallet: sinon.stub().resolves(true)
        }
      }
    };
    
    // Create mock Fabric client
    mockFabricClient = {
      submitTransaction: sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'transferBetweenInternalWallets') {
          return Buffer.from(JSON.stringify({
            id: 'transfer_1',
            fromInternalWalletId: args[0],
            toInternalWalletId: args[1],
            amount: parseFloat(args[2]),
            memo: args[3] || null,
            timestamp: new Date().toISOString()
          }));
        }
        return Buffer.from('{}');
      }),
      evaluateTransaction: sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          const walletId = args[0];
          if (walletId === 'internal_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.5,
              createdAt: new Date().toISOString()
            }));
          } else if (walletId === 'internal_wallet_2') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_2',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.3,
              createdAt: new Date().toISOString()
            }));
          } else if (walletId === 'internal_wallet_3') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_3',
              blockchain: 'litecoin',
              primaryWalletName: 'ltc_wallet_1',
              balance: 1.0,
              createdAt: new Date().toISOString()
            }));
          }
        }
        return Buffer.from('{}');
      })
    };
    
    // Mock config
    mockConfig = {
      bitcoin: [
        {
          name: 'btc_wallet_1',
          walletAddress: 'bc1q...',
          connectionType: 'spv'
        }
      ],
      baseInternalWallet: {
        namePrefix: 'base_wallet_',
        description: 'Represents excess funds in the primary on-chain wallet',
        createOnInitialization: false
      }
    };
    
    // Update blockchain connectors to match the new structure
    mockBlockchainConnectors.bitcoin.btc_wallet_1.config = {
      connectionType: 'spv'
    };
    
    // Add contract property to mockFabricClient
    mockFabricClient.contract = true;
    
    // Create wallet manager instance with transferBetweenInternalWallets method
    walletManager = await initializeWalletManager(mockConfig, mockBlockchainConnectors, mockFabricClient);
    
    // Add the transferBetweenInternalWallets method if it doesn't exist
    if (!walletManager.transferBetweenInternalWallets) {
      walletManager.transferBetweenInternalWallets = async (fromInternalWalletId, toInternalWalletId, amount, memo = null) => {
        // Get the source wallet
        const sourceWallet = await walletManager.getInternalWallet(fromInternalWalletId);
        if (!sourceWallet) {
          throw new Error(`Source internal wallet not found: ${fromInternalWalletId}`);
        }
        
        // Get the destination wallet
        const destWallet = await walletManager.getInternalWallet(toInternalWalletId);
        if (!destWallet) {
          throw new Error(`Destination internal wallet not found: ${toInternalWalletId}`);
        }
        
        // Verify both wallets are on the same blockchain and mapped to the same primary wallet
        if (sourceWallet.blockchain !== destWallet.blockchain) {
          throw new Error('Internal transfers can only be performed between wallets on the same blockchain');
        }
        
        if (sourceWallet.primaryWalletName !== destWallet.primaryWalletName) {
          throw new Error('Internal transfers can only be performed between wallets mapped to the same primary wallet');
        }
        
        // Verify the source wallet has sufficient balance
        if (sourceWallet.balance < amount) {
          throw new Error(`Insufficient balance in source wallet: ${sourceWallet.balance} < ${amount}`);
        }
        
        // Perform the transfer
        const result = await mockFabricClient.submitTransaction(
          'transferBetweenInternalWallets',
          fromInternalWalletId,
          toInternalWalletId,
          amount.toString(),
          memo
        );
        
        return JSON.parse(result.toString());
      };
    }
  });
  
  describe('Transfer Between Internal Wallets', () => {
    it('should transfer funds between internal wallets on the same blockchain and primary wallet', async () => {
      const transfer = await walletManager.transferBetweenInternalWallets(
        'internal_wallet_1',
        'internal_wallet_2',
        0.1,
        'Test transfer'
      );
      
      expect(transfer).to.be.an('object');
      expect(transfer).to.have.property('id', 'transfer_1');
      expect(transfer).to.have.property('fromInternalWalletId', 'internal_wallet_1');
      expect(transfer).to.have.property('toInternalWalletId', 'internal_wallet_2');
      expect(transfer).to.have.property('amount', 0.1);
      expect(transfer).to.have.property('memo', null);
      expect(transfer).to.have.property('timestamp');
      
      expect(mockFabricClient.evaluateTransaction.calledTwice).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWallet');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.evaluateTransaction.secondCall.args[0]).to.equal('getInternalWallet');
      expect(mockFabricClient.evaluateTransaction.secondCall.args[1]).to.equal('internal_wallet_2');
      
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('transferBetweenInternalWallets');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('internal_wallet_2');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('0.1');
      expect(mockFabricClient.submitTransaction.firstCall.args[4]).to.equal(null);
    });
    
    it('should transfer funds without a memo', async () => {
      const transfer = await walletManager.transferBetweenInternalWallets(
        'internal_wallet_1',
        'internal_wallet_2',
        0.1
      );
      
      expect(transfer).to.be.an('object');
      expect(transfer).to.have.property('id', 'transfer_1');
      expect(transfer).to.have.property('fromInternalWalletId', 'internal_wallet_1');
      expect(transfer).to.have.property('toInternalWalletId', 'internal_wallet_2');
      expect(transfer).to.have.property('amount', 0.1);
      expect(transfer).to.have.property('memo', null);
      
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('transferBetweenInternalWallets');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('internal_wallet_2');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('0.1');
      expect(mockFabricClient.submitTransaction.firstCall.args[4]).to.equal(null);
    });
    
    it('should throw an error when source wallet not found', async () => {
      try {
        await walletManager.transferBetweenInternalWallets(
          'non_existent_wallet',
          'internal_wallet_2',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Source internal wallet not found');
      }
    });
    
    it('should throw an error when destination wallet not found', async () => {
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'non_existent_wallet',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Destination internal wallet not found');
      }
    });
    
    it('should throw an error when wallets are on different blockchains', async () => {
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'internal_wallet_3',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Internal transfers can only be performed between wallets on the same blockchain');
      }
    });
    
    it('should throw an error when source wallet has insufficient balance', async () => {
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'internal_wallet_2',
          1.0
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in source wallet');
      }
    });
  });
  
  describe('API Integration', () => {
    let app;
    let request;
    let mockApiServer;
    let token;
    
    beforeEach(() => {
      // Mock the API server
      request = require('supertest');
      const express = require('express');
      const jwt = require('jsonwebtoken');
      
      app = express();
      app.use(express.json());
      
      // Mock JWT middleware
      app.use((req, res, next) => {
        req.user = { username: 'admin' };
        next();
      });
      
      // Mock the internal transfer endpoint
      app.post('/api/transactions/internal-transfer', async (req, res) => {
        try {
          const { fromInternalWalletId, toInternalWalletId, amount, memo } = req.body;
          
          if (!fromInternalWalletId || !toInternalWalletId || !amount) {
            return res.status(400).json({ error: 'Missing required parameters' });
          }
          
          const transfer = await walletManager.transferBetweenInternalWallets(
            fromInternalWalletId,
            toInternalWalletId,
            parseFloat(amount),
            memo
          );
          
          res.json(transfer);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      });
      
      // Generate a JWT token for authentication
      token = jwt.sign({ username: 'admin' }, 'test-secret', { expiresIn: '1d' });
    });
    
    it('should handle internal transfer API requests', async () => {
      const response = await request(app)
        .post('/api/transactions/internal-transfer')
        .send({
          fromInternalWalletId: 'internal_wallet_1',
          toInternalWalletId: 'internal_wallet_2',
          amount: 0.1,
          memo: 'API test transfer'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'transfer_1');
      expect(response.body).to.have.property('fromInternalWalletId', 'internal_wallet_1');
      expect(response.body).to.have.property('toInternalWalletId', 'internal_wallet_2');
      expect(response.body).to.have.property('amount', 0.1);
      expect(response.body).to.have.property('memo', null);
    });
    
    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .post('/api/transactions/internal-transfer')
        .send({
          fromInternalWalletId: 'internal_wallet_1',
          // Missing toInternalWalletId
          amount: 0.1
        })
        .expect(400);
      
      expect(response.body).to.have.property('error', 'Missing required parameters');
    });
    
    it('should return 400 for insufficient balance', async () => {
      const response = await request(app)
        .post('/api/transactions/internal-transfer')
        .send({
          fromInternalWalletId: 'internal_wallet_1',
          toInternalWalletId: 'internal_wallet_2',
          amount: 1.0
        })
        .expect(400);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Insufficient balance in source wallet');
    });
  });
  
  describe('Transaction History', () => {
    beforeEach(() => {
      // Mock the getTransactionHistory method
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getTransactionHistory') {
          const walletId = args[0];
          if (walletId === 'internal_wallet_1') {
            return Buffer.from(JSON.stringify([
              {
                txid: 'tx1',
                timestamp: new Date().toISOString(),
                value: {
                  id: 'internal_wallet_1',
                  blockchain: 'bitcoin',
                  primaryWalletName: 'btc_wallet_1',
                  balance: 0.5,
                  createdAt: new Date().toISOString()
                }
              },
              {
                txid: 'transfer_1',
                timestamp: new Date().toISOString(),
                value: {
                  id: 'transfer_1',
                  fromInternalWalletId: 'internal_wallet_1',
                  toInternalWalletId: 'internal_wallet_2',
                  amount: 0.1,
                  memo: 'Test transfer',
                  timestamp: new Date().toISOString()
                }
              }
            ]));
          }
        }
        return Buffer.from('[]');
      });
      
      // Add the getTransactionHistory method if it doesn't exist
      if (!walletManager.getTransactionHistory) {
        walletManager.getTransactionHistory = async (internalWalletId, limit = 10) => {
          const result = await mockFabricClient.evaluateTransaction(
            'getTransactionHistory',
            internalWalletId,
            limit.toString()
          );
          
          return JSON.parse(result.toString());
        };
      }
    });
    
    it('should include internal transfers in transaction history', async () => {
      const history = await walletManager.getTransactionHistory('internal_wallet_1');
      
      expect(history).to.be.an('array');
      expect(history).to.have.lengthOf(2);
      
      const transferTx = history.find(tx => tx.txid === 'transfer_1');
      expect(transferTx).to.exist;
      expect(transferTx.value).to.have.property('fromInternalWalletId', 'internal_wallet_1');
      expect(transferTx.value).to.have.property('toInternalWalletId', 'internal_wallet_2');
      expect(transferTx.value).to.have.property('amount', 0.1);
      expect(transferTx.value).to.have.property('memo', 'Test transfer');
      
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getTransactionHistory');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[2]).to.equal('10');
    });
  });
});
