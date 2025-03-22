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
const {
  createMockBlockchainConnectors,
  createMockFabricClient,
  createMockConfig,
  createMockWalletManager,
  preciseDecimal
} = require('./test-utils');

describe('Base Wallet Protection', () => {
  let walletManager;
  let mockBlockchainConnectors;
  let mockFabricClient;
  let mockConfig;
  let internalWallets = {};
  
  beforeEach(async () => {
    // Clear internal wallets first
    internalWallets = {};
    
    // Create mock objects
    mockConfig = createMockConfig();
    mockConfig.bitcoin[0].name = 'btc_wallet_1'; // Set specific wallet name for tests
    mockConfig.baseInternalWallet = {
      namePrefix: 'base_wallet_',
      description: 'Represents excess funds in the primary on-chain wallet'
    };
    
    mockBlockchainConnectors = createMockBlockchainConnectors({
      blockchain: 'bitcoin',
      walletName: 'btc_wallet_1',
      balance: 1.5
    });
    
    mockFabricClient = createMockFabricClient(internalWallets);
    
    // Create wallet manager with the required methods
    walletManager = createMockWalletManager({
      mockBlockchainConnectors,
      internalWallets,
      mockFabricClient,
      mockConfig
    });
    
    // Set up test data - Create internal wallets for testing
    internalWallets['internal_wallet_1'] = {
      id: 'internal_wallet_1',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0.5,
      createdAt: new Date().toISOString()
    };
    
    internalWallets['internal_wallet_2'] = {
      id: 'internal_wallet_2',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0.3,
      createdAt: new Date().toISOString()
    };
    
    internalWallets['base_wallet_bitcoin_btc_wallet_1'] = {
      id: 'base_wallet_bitcoin_btc_wallet_1',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0.7,
      metadata: { isBaseWallet: true },
      createdAt: new Date().toISOString()
    };
  });
  
  afterEach(() => {
    // Clear internal wallets
    internalWallets = {};
  });
  
  describe('Base Internal Wallet Creation', () => {
    it('should create a base internal wallet with the correct naming convention', async () => {
      // Delete the existing base wallet to force creation of a new one
      delete internalWallets['base_wallet_bitcoin_btc_wallet_1'];
      
      // Reset the mock
      mockFabricClient.submitTransaction.resetHistory();
      
      const baseWallet = await walletManager.createBaseInternalWallet('bitcoin', 'btc_wallet_1');
      
      expect(baseWallet).to.be.an('object');
      expect(baseWallet).to.have.property('id', 'base_wallet_bitcoin_btc_wallet_1');
      expect(baseWallet).to.have.property('blockchain', 'bitcoin');
      expect(baseWallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Verify the stub was called correctly
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
      // The walletAddress property is already set in the mock
      
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
      
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.called).to.be.true;
      expect(mockFabricClient.evaluateTransaction.called).to.be.true;
    });
    
    it('should throw an error when primary wallet not found', async () => {
      try {
        await walletManager.getWalletReadOnly('bitcoin', 'non_existent_wallet');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });
  });
  
  describe('Withdrawal from Base Internal Wallet', () => {
    it('should withdraw from base internal wallet', async () => {
      // Mock the getTransaction method to return a valid transaction
      mockBlockchainConnectors.bitcoin.btc_wallet_1.getTransaction = sinon.stub().resolves({
        txid: '0x1234567890abcdef',
        confirmations: 1,
        amount: 0.1
      });
      
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
      
      expect(mockFabricClient.evaluateTransaction.called).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.called).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.called).to.be.true;
    });
    
    it('should throw an error when base wallet not found', async () => {
      // Override the evaluateTransaction method for this specific test
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
      // Override the evaluateTransaction method for this specific test
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet' && args[0] === 'base_wallet_bitcoin_btc_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'base_wallet_bitcoin_btc_wallet_1',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.05, // Less than the withdrawal amount
            metadata: { isBaseWallet: true },
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
      // Override the evaluateTransaction method for this specific test
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet' && args[0] === 'base_wallet_bitcoin_btc_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'base_wallet_bitcoin_btc_wallet_1',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.1, // Equal to the withdrawal amount but not enough for fee
            metadata: { isBaseWallet: true },
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
    let supertest;
    let token;
    
    beforeEach(() => {
      // Set up a simple express app for API testing
      const express = require('express');
      supertest = require('supertest');
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
      const response = await supertest(app)
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
      const response = await supertest(app)
        .get('/api/wallets/bitcoin/non_existent_wallet/read-only')
        .expect(404);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('not found');
    });
  });
  
  describe('Withdrawal Protection', () => {
    beforeEach(() => {
      // Reset the mocks
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
          } else if (walletId === 'base_wallet_bitcoin_btc_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'base_wallet_bitcoin_btc_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.7,
              metadata: { isBaseWallet: true },
              createdAt: new Date().toISOString()
            }));
          }
        } else if (fcn === 'getInternalWalletsByPrimaryWallet') {
          return Buffer.from(JSON.stringify([
            {
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.5,
              createdAt: new Date().toISOString()
            },
            {
              id: 'base_wallet_bitcoin_btc_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.7,
              metadata: { isBaseWallet: true },
              createdAt: new Date().toISOString()
            }
          ]));
        }
        return Buffer.from('[]');
      });
    });
    
    it('should prevent withdrawals that would exceed the aggregate internal balance', async () => {
      // Mock the getBalance to return a high value
      mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.resolves(10.0);
      
      // Mock the estimateFee to return a fee
      mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.resolves(0.0001);
      
      // Mock the internal wallet balance to be too low
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          const walletId = args[0];
          if (walletId === 'internal_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.1, // Too low for the withdrawal amount
              createdAt: new Date().toISOString()
            }));
          }
        }
        return Buffer.from('[]');
      });
      
      try {
        await walletManager.withdrawFromInternalWallet(
          'internal_wallet_1',
          'bc1q...',
          0.6, // More than the internal wallet balance
          0.0001
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in internal wallet including fee');
      }
    });
    
    it('should prevent withdrawals when primary wallet has insufficient balance', async () => {
      // Mock the getBalance to return a low value
      mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.resolves(0.05);
      
      // Mock the estimateFee to return a fee
      mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.resolves(0.0001);
      
      // Mock the internal wallet balance to be sufficient
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          const walletId = args[0];
          if (walletId === 'internal_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.5, // Sufficient for the withdrawal amount
              createdAt: new Date().toISOString()
            }));
          }
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
      
      try {
        await walletManager.withdrawFromInternalWallet(
          'internal_wallet_1',
          'bc1q...',
          0.1,
          0.0001
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in primary wallet');
      }
    });
  });
});
