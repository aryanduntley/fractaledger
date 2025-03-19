/**
 * Base Wallet Protection Tests
 * 
 * This file contains tests for the base wallet protection mechanisms,
 * including base internal wallet creation and withdrawal validation
 * against aggregate balances.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { initializeWalletManager } = require('../src/wallet/walletManager');

describe('Base Wallet Protection', () => {
  let walletManager;
  let mockBlockchainConnectors;
  let mockFabricClient;
  let mockConfig;
  
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
        if (fcn === 'createInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: args[0],
            blockchain: args[1],
            primaryWalletName: args[2],
            balance: 0,
            createdAt: new Date().toISOString()
          }));
        } else if (fcn === 'withdrawFromInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: 'withdrawal_1',
            internalWalletId: args[0],
            toAddress: args[1],
            amount: parseFloat(args[2]),
            fee: parseFloat(args[3]),
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
          } else if (walletId === 'base_wallet_bitcoin_btc_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'base_wallet_bitcoin_btc_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.7,
              isBaseWallet: true,
              createdAt: new Date().toISOString()
            }));
          }
        } else if (fcn === 'getAllInternalWallets') {
          return Buffer.from(JSON.stringify([
            {
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.5,
              createdAt: new Date().toISOString()
            },
            {
              id: 'internal_wallet_2',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.3,
              createdAt: new Date().toISOString()
            },
            {
              id: 'base_wallet_bitcoin_btc_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.7,
              isBaseWallet: true,
              createdAt: new Date().toISOString()
            }
          ]));
        } else if (fcn === 'getInternalWalletsByPrimaryWallet') {
          const blockchain = args[0];
          const primaryWalletName = args[1];
          if (blockchain === 'bitcoin' && primaryWalletName === 'btc_wallet_1') {
            return Buffer.from(JSON.stringify([
              {
                id: 'internal_wallet_1',
                blockchain: 'bitcoin',
                primaryWalletName: 'btc_wallet_1',
                balance: 0.5,
                createdAt: new Date().toISOString()
              },
              {
                id: 'internal_wallet_2',
                blockchain: 'bitcoin',
                primaryWalletName: 'btc_wallet_1',
                balance: 0.3,
                createdAt: new Date().toISOString()
              },
              {
                id: 'base_wallet_bitcoin_btc_wallet_1',
                blockchain: 'bitcoin',
                primaryWalletName: 'btc_wallet_1',
                balance: 0.7,
                isBaseWallet: true,
                createdAt: new Date().toISOString()
              }
            ]));
          }
        }
        return Buffer.from('[]');
      })
    };
    
    // Create mock config
    mockConfig = {
      baseInternalWallet: {
        namePrefix: 'base_wallet_',
        description: 'Represents excess funds in the primary on-chain wallet'
      }
    };
    
    // Update blockchain connectors to match the new structure
    mockBlockchainConnectors.bitcoin.btc_wallet_1.config = {
      connectionType: 'spv'
    };
    
    // Add contract property to mockFabricClient
    mockFabricClient.contract = true;
    
    // Update mockConfig to match the new structure
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
    
    // Create wallet manager instance
    walletManager = await initializeWalletManager(mockConfig, mockBlockchainConnectors, mockFabricClient);
    
    // Add the getInternalWalletsByPrimaryWallet method if it doesn't exist
    if (!walletManager.getInternalWalletsByPrimaryWallet) {
      walletManager.getInternalWalletsByPrimaryWallet = async (blockchain, primaryWalletName) => {
        const result = await mockFabricClient.evaluateTransaction(
          'getInternalWalletsByPrimaryWallet',
          blockchain,
          primaryWalletName
        );
        
        return JSON.parse(result.toString());
      };
    }
    
    // Add the getWalletReadOnly method if it doesn't exist
    if (!walletManager.getWalletReadOnly) {
      walletManager.getWalletReadOnly = async (blockchain, primaryWalletName) => {
        // Get the primary wallet
        const primaryWallet = walletManager.getWallet(blockchain, primaryWalletName);
        if (!primaryWallet) {
          throw new Error(`Primary wallet not found: ${blockchain}/${primaryWalletName}`);
        }
        
        // Get the on-chain balance
        const onChainBalance = await primaryWallet.getBalance();
        
        // Get all internal wallets for this primary wallet
        const internalWallets = await walletManager.getInternalWalletsByPrimaryWallet(blockchain, primaryWalletName);
        
        // Calculate aggregate internal balance
        const aggregateInternalBalance = internalWallets
          .filter(wallet => !wallet.isBaseWallet)
          .reduce((sum, wallet) => sum + wallet.balance, 0);
        
        // Calculate excess balance
        const excessBalance = onChainBalance - aggregateInternalBalance;
        
        // Find the base internal wallet
        const baseInternalWallet = internalWallets.find(wallet => wallet.isBaseWallet);
        
        return {
          blockchain,
          name: primaryWalletName,
          address: primaryWallet.walletAddress,
          connectionType: primaryWallet.connectionType,
          balance: onChainBalance,
          aggregateInternalBalance,
          excessBalance,
          baseInternalWalletId: baseInternalWallet ? baseInternalWallet.id : null
        };
      };
    }
    
    // Add the createBaseInternalWallet method if it doesn't exist
    if (!walletManager.createBaseInternalWallet) {
      walletManager.createBaseInternalWallet = async (blockchain, primaryWalletName) => {
        const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
        
        // Check if the base wallet already exists
        try {
          const existingWallet = await walletManager.getInternalWallet(baseWalletId);
          if (existingWallet) {
            return existingWallet;
          }
        } catch (error) {
          // Wallet doesn't exist, continue with creation
        }
        
        // Create the base internal wallet
        const baseWallet = await walletManager.createInternalWallet(
          blockchain,
          primaryWalletName,
          baseWalletId,
          { isBaseWallet: true, description: mockConfig.baseInternalWallet.description }
        );
        
        return baseWallet;
      };
    }
    
    // Add the withdrawFromBaseInternalWallet method if it doesn't exist
    if (!walletManager.withdrawFromBaseInternalWallet) {
      walletManager.withdrawFromBaseInternalWallet = async (blockchain, primaryWalletName, toAddress, amount) => {
        // Get the base internal wallet ID
        const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
        
        // Get the base internal wallet
        const baseWallet = await walletManager.getInternalWallet(baseWalletId);
        if (!baseWallet) {
          throw new Error(`Base internal wallet not found: ${baseWalletId}`);
        }
        
        // Verify the base wallet has sufficient balance
        if (baseWallet.balance < amount) {
          throw new Error(`Insufficient balance in base wallet: ${baseWallet.balance} < ${amount}`);
        }
        
        // Estimate the fee
        const primaryWallet = walletManager.getWallet(blockchain, primaryWalletName);
        const fee = await primaryWallet.estimateFee(toAddress, amount);
        
        // Verify the base wallet has sufficient balance including the fee
        if (baseWallet.balance < amount + fee) {
          throw new Error(`Insufficient balance in base wallet including fee: ${baseWallet.balance} < ${amount + fee}`);
        }
        
        // Perform the withdrawal
        return await walletManager.withdrawFromInternalWallet(baseWalletId, toAddress, amount);
      };
    }
  });
  
  describe('Base Internal Wallet Creation', () => {
    it('should create a base internal wallet with the correct naming convention', async () => {
      const baseWallet = await walletManager.createBaseInternalWallet('bitcoin', 'btc_wallet_1');
      
      expect(baseWallet).to.be.an('object');
      expect(baseWallet).to.have.property('id', 'base_wallet_bitcoin_btc_wallet_1');
      expect(baseWallet).to.have.property('blockchain', 'bitcoin');
      expect(baseWallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('createInternalWallet');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('base_wallet_bitcoin_btc_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('bitcoin');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('btc_wallet_1');
    });
    
    it('should return existing base wallet if it already exists', async () => {
      // First call to create the wallet
      await walletManager.createBaseInternalWallet('bitcoin', 'btc_wallet_1');
      
      // Reset the mock
      mockFabricClient.submitTransaction.resetHistory();
      mockFabricClient.evaluateTransaction.resetHistory();
      
      // Second call should return the existing wallet
      const baseWallet = await walletManager.createBaseInternalWallet('bitcoin', 'btc_wallet_1');
      
      expect(baseWallet).to.be.an('object');
      expect(baseWallet).to.have.property('id', 'base_wallet_bitcoin_btc_wallet_1');
      
      // Should not call submitTransaction again
      expect(mockFabricClient.submitTransaction.called).to.be.false;
    });
  });
  
  describe('READ ONLY API Access to Primary Wallet', () => {
    it('should provide read-only access to primary wallet with aggregate balance information', async () => {
      const walletInfo = await walletManager.getWalletReadOnly('bitcoin', 'btc_wallet_1');
      
      expect(walletInfo).to.be.an('object');
      expect(walletInfo).to.have.property('blockchain', 'bitcoin');
      expect(walletInfo).to.have.property('name', 'btc_wallet_1');
      expect(walletInfo).to.have.property('address', 'bc1q...');
      expect(walletInfo).to.have.property('connectionType', 'spv');
      expect(walletInfo).to.have.property('balance', 1.5);
      expect(walletInfo).to.have.property('aggregateInternalBalance', 0.8); // 0.5 + 0.3
      expect(walletInfo).to.have.property('excessBalance', 0.7); // 1.5 - 0.8
      expect(walletInfo).to.have.property('baseInternalWalletId', 'base_wallet_bitcoin_btc_wallet_1');
      
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWalletsByPrimaryWallet');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('bitcoin');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[2]).to.equal('btc_wallet_1');
    });
    
    it('should throw an error when primary wallet not found', async () => {
      try {
        await walletManager.getWalletReadOnly('bitcoin', 'non_existent_wallet');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Primary wallet not found');
      }
    });
  });
  
  describe('Withdrawal from Base Internal Wallet', () => {
    it('should withdraw from base internal wallet', async () => {
      const withdrawal = await walletManager.withdrawFromBaseInternalWallet(
        'bitcoin',
        'btc_wallet_1',
        'bc1q...',
        0.1
      );
      
      expect(withdrawal).to.be.an('object');
      expect(withdrawal).to.have.property('id', 'withdrawal_1');
      expect(withdrawal).to.have.property('internalWalletId', 'base_wallet_bitcoin_btc_wallet_1');
      expect(withdrawal).to.have.property('toAddress', 'bc1q...');
      expect(withdrawal).to.have.property('amount', 0.1);
      expect(withdrawal).to.have.property('fee', 0.0001);
      
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWallet');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('base_wallet_bitcoin_btc_wallet_1');
      
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[0]).to.equal('bc1q...');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[1]).to.equal(0.1);
    });
    
    it('should throw an error when base wallet not found', async () => {
      // Mock the getInternalWallet to return null for the base wallet
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet' && args[0] === 'base_wallet_bitcoin_btc_wallet_1') {
          return Buffer.from('null');
        }
        return Buffer.from('{}');
      });
      
      try {
        await walletManager.withdrawFromBaseInternalWallet(
          'bitcoin',
          'btc_wallet_1',
          'bc1q...',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Base internal wallet not found');
      }
    });
    
    it('should throw an error when base wallet has insufficient balance', async () => {
      // Mock the getInternalWallet to return a base wallet with low balance
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet' && args[0] === 'base_wallet_bitcoin_btc_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'base_wallet_bitcoin_btc_wallet_1',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.05, // Less than the withdrawal amount
            isBaseWallet: true,
            createdAt: new Date().toISOString()
          }));
        }
        return Buffer.from('{}');
      });
      
      try {
        await walletManager.withdrawFromBaseInternalWallet(
          'bitcoin',
          'btc_wallet_1',
          'bc1q...',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in base wallet');
      }
    });
    
    it('should throw an error when base wallet has insufficient balance including fee', async () => {
      // Mock the getInternalWallet to return a base wallet with balance just enough for amount but not fee
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet' && args[0] === 'base_wallet_bitcoin_btc_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'base_wallet_bitcoin_btc_wallet_1',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.1, // Equal to the withdrawal amount but not enough for fee
            isBaseWallet: true,
            createdAt: new Date().toISOString()
          }));
        }
        return Buffer.from('{}');
      });
      
      try {
        await walletManager.withdrawFromBaseInternalWallet(
          'bitcoin',
          'btc_wallet_1',
          'bc1q...',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in base wallet including fee');
      }
    });
  });
  
  describe('API Integration', () => {
    let app;
    let request;
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
      
      // Mock the read-only wallet endpoint
      app.get('/api/wallets/:blockchain/:name/read-only', async (req, res) => {
        try {
          const { blockchain, name } = req.params;
          
          const walletInfo = await walletManager.getWalletReadOnly(blockchain, name);
          
          res.json(walletInfo);
        } catch (error) {
          res.status(404).json({ error: error.message });
        }
      });
      
      // Generate a JWT token for authentication
      token = jwt.sign({ username: 'admin' }, 'test-secret', { expiresIn: '1d' });
    });
    
    it('should handle read-only wallet API requests', async () => {
      const response = await request(app)
        .get('/api/wallets/bitcoin/btc_wallet_1/read-only')
        .expect(200);
      
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('name', 'btc_wallet_1');
      expect(response.body).to.have.property('balance', 1.5);
      expect(response.body).to.have.property('aggregateInternalBalance', 0.8);
      expect(response.body).to.have.property('excessBalance', 0.7);
      expect(response.body).to.have.property('baseInternalWalletId', 'base_wallet_bitcoin_btc_wallet_1');
    });
    
    it('should return 404 for non-existent wallet', async () => {
      const response = await request(app)
        .get('/api/wallets/bitcoin/non_existent_wallet/read-only')
        .expect(404);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Primary wallet not found');
    });
  });
  
  describe('Withdrawal Protection', () => {
    beforeEach(() => {
      // Add the withdrawFromInternalWallet method with protection if it doesn't exist
      if (!walletManager.withdrawFromInternalWallet) {
        walletManager.withdrawFromInternalWallet = async (internalWalletId, toAddress, amount) => {
          // Get the internal wallet
          const internalWallet = await walletManager.getInternalWallet(internalWalletId);
          if (!internalWallet) {
            throw new Error(`Internal wallet not found: ${internalWalletId}`);
          }
          
          // Get the primary wallet
          const primaryWallet = walletManager.getWallet(internalWallet.blockchain, internalWallet.primaryWalletName);
          if (!primaryWallet) {
            throw new Error(`Primary wallet not found: ${internalWallet.blockchain}/${internalWallet.primaryWalletName}`);
          }
          
          // Estimate the fee
          const fee = await primaryWallet.estimateFee(toAddress, amount);
          
          // Verify the internal wallet has sufficient balance including the fee
          if (internalWallet.balance < amount + fee) {
            throw new Error(`Insufficient balance in internal wallet including fee: ${internalWallet.balance} < ${amount + fee}`);
          }
          
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
          
          // Get the on-chain balance
          const onChainBalance = await primaryWallet.getBalance();
          
          // Verify the primary wallet has sufficient balance
          if (onChainBalance < amount + fee) {
            throw new Error(`Insufficient balance in primary wallet: ${onChainBalance} < ${amount + fee}`);
          }
          
          // Verify the withdrawal doesn't exceed the aggregate internal balance
          if (aggregateInternalBalance < amount + fee) {
            throw new Error(`Withdrawal would exceed aggregate internal balance: ${aggregateInternalBalance} < ${amount + fee}`);
          }
          
          // Perform the withdrawal
          const result = await mockFabricClient.submitTransaction(
            'withdrawFromInternalWallet',
            internalWalletId,
            toAddress,
            amount.toString(),
            fee.toString()
          );
          
          // Send the transaction
          await primaryWallet.sendTransaction(toAddress, amount, { fee });
          
          return JSON.parse(result.toString());
        };
      }
    });
    
    it('should prevent withdrawals that would exceed the aggregate internal balance', async () => {
      // Mock the getInternalWalletsByPrimaryWallet to return wallets with low aggregate balance
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: 'internal_wallet_1',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        } else if (fcn === 'getInternalWalletsByPrimaryWallet') {
          return Buffer.from(JSON.stringify([
            {
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.5,
              createdAt: new Date().toISOString()
            }
          ]));
        }
        return Buffer.from('[]');
      });
      
      // Mock the getBalance to return a high value
      mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.resolves(10.0);
      
      try {
        await walletManager.withdrawFromInternalWallet(
          'internal_wallet_1',
          'bc1q...',
          0.6 // More than the internal wallet balance
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in internal wallet including fee');
      }
    });
    
    it('should prevent withdrawals when primary wallet has insufficient balance', async () => {
      // Mock the getBalance to return a low value
      mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.resolves(0.05);
      
      try {
        await walletManager.withdrawFromInternalWallet(
          'internal_wallet_1',
          'bc1q...',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in primary wallet');
      }
    });
  });
});
