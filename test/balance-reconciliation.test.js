/**
 * Balance Reconciliation Tests
 * 
 * This file contains tests for the balance reconciliation system,
 * which ensures balances are correctly maintained between on-chain
 * wallets and internal wallets.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { initializeBalanceReconciliation } = require('../src/reconciliation/balanceReconciliation');

describe('Balance Reconciliation', () => {
  let balanceReconciliation;
  let mockWalletManager;
  let mockFabricClient;
  let mockConfig;
  let mockLogger;
  
  beforeEach(async () => {
    // Create mock wallet manager
    mockWalletManager = {
      getWallet: sinon.stub().callsFake((blockchain, name) => {
        if (blockchain === 'bitcoin' && name === 'btc_wallet_1') {
          return {
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
          };
        } else if (blockchain === 'litecoin' && name === 'ltc_wallet_1') {
          return {
            blockchain: 'litecoin',
            name: 'ltc_wallet_1',
            walletAddress: 'ltc1q...',
            connectionType: 'spv',
            getBalance: sinon.stub().resolves(10.0),
            getTransactionHistory: sinon.stub().resolves([]),
            sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
            verifyAddress: sinon.stub().resolves(true),
            estimateFee: sinon.stub().resolves(0.0001),
            getBlockchainHeight: sinon.stub().resolves(2000000),
            getTransaction: sinon.stub().resolves({}),
            verifyUtxoWallet: sinon.stub().resolves(true)
          };
        }
        return null;
      }),
      getAllWallets: sinon.stub().returns([
        {
          blockchain: 'bitcoin',
          name: 'btc_wallet_1',
          walletAddress: 'bc1q...',
          connectionType: 'spv'
        },
        {
          blockchain: 'litecoin',
          name: 'ltc_wallet_1',
          walletAddress: 'ltc1q...',
          connectionType: 'spv'
        }
      ]),
      getInternalWalletsByPrimaryWallet: sinon.stub().callsFake(async (blockchain, primaryWalletName) => {
        if (blockchain === 'bitcoin' && primaryWalletName === 'btc_wallet_1') {
          return [
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
          ];
        } else if (blockchain === 'litecoin' && primaryWalletName === 'ltc_wallet_1') {
          return [
            {
              id: 'internal_wallet_3',
              blockchain: 'litecoin',
              primaryWalletName: 'ltc_wallet_1',
              balance: 5.0,
              createdAt: new Date().toISOString()
            },
            {
              id: 'internal_wallet_4',
              blockchain: 'litecoin',
              primaryWalletName: 'ltc_wallet_1',
              balance: 5.0,
              createdAt: new Date().toISOString()
            }
          ];
        }
        return [];
      })
    };
    
    // Create mock Fabric client
    mockFabricClient = {
      submitTransaction: sinon.stub().resolves(Buffer.from('{}')),
      evaluateTransaction: sinon.stub().resolves(Buffer.from('[]'))
    };
    
    // Create mock config
    mockConfig = {
      balanceReconciliation: {
        strategy: 'afterTransaction',
        scheduledFrequency: 3600000, // 1 hour
        warningThreshold: 0.00001,
        strictMode: false
      }
    };
    
    // Mock winston logger
    mockLogger = {
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    
    // Override winston with mock logger
    const winston = require('winston');
    sinon.stub(winston, 'createLogger').returns(mockLogger);
    
    // Initialize balance reconciliation module
    balanceReconciliation = await initializeBalanceReconciliation(
      mockConfig,
      mockWalletManager,
      mockFabricClient
    );
  });
  
  afterEach(() => {
    // Restore winston
    const winston = require('winston');
    if (winston.createLogger.restore) {
      winston.createLogger.restore();
    }
    
    // Stop scheduled reconciliation if running
    if (balanceReconciliation && balanceReconciliation.stopScheduledReconciliation) {
      balanceReconciliation.stopScheduledReconciliation();
    }
  });
  
  describe('Configuration', () => {
    it('should initialize with default configuration if not provided', async () => {
      const defaultConfig = {};
      
      const reconciliation = await initializeBalanceReconciliation(
        defaultConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      const config = reconciliation.getConfig();
      expect(config).to.have.property('strategy', 'afterTransaction');
      expect(config).to.have.property('scheduledFrequency', 3600000);
      expect(config).to.have.property('warningThreshold', 0.00001);
      expect(config).to.have.property('strictMode', false);
      
      // Stop scheduled reconciliation
      reconciliation.stopScheduledReconciliation();
    });
    
    it('should initialize with provided configuration', async () => {
      const customConfig = {
        balanceReconciliation: {
          strategy: 'scheduled',
          scheduledFrequency: 1800000, // 30 minutes
          warningThreshold: 0.0001,
          strictMode: true
        }
      };
      
      const reconciliation = await initializeBalanceReconciliation(
        customConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      const config = reconciliation.getConfig();
      expect(config).to.have.property('strategy', 'scheduled');
      expect(config).to.have.property('scheduledFrequency', 1800000);
      expect(config).to.have.property('warningThreshold', 0.0001);
      expect(config).to.have.property('strictMode', true);
      
      // Stop scheduled reconciliation
      reconciliation.stopScheduledReconciliation();
    });
  });
  
  describe('Wallet Reconciliation', () => {
    it('should reconcile a specific wallet successfully', async () => {
      const result = await balanceReconciliation.reconcileWallet('bitcoin', 'btc_wallet_1');
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('blockchain', 'bitcoin');
      expect(result).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(result).to.have.property('onChainBalance', 1.5);
      expect(result).to.have.property('aggregateInternalBalance', 1.5); // 0.5 + 0.3 + 0.7
      expect(result).to.have.property('difference', 0);
      expect(result).to.have.property('hasDiscrepancy', false);
      expect(result).to.have.property('timestamp');
      
      expect(mockWalletManager.getWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.getWallet.firstCall.args[1]).to.equal('btc_wallet_1');
      
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.firstCall.args[1]).to.equal('btc_wallet_1');
      
      // Should not record discrepancy
      expect(mockFabricClient.submitTransaction.called).to.be.false;
    });
    
    it('should detect and record a discrepancy when balances do not match', async () => {
      // Mock the getBalance to return a different value
      const mockWallet = mockWalletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      const result = await balanceReconciliation.reconcileWallet('bitcoin', 'btc_wallet_1');
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('blockchain', 'bitcoin');
      expect(result).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(result).to.have.property('onChainBalance', 2.0);
      expect(result).to.have.property('aggregateInternalBalance', 1.5);
      expect(result).to.have.property('difference', 0.5);
      expect(result).to.have.property('hasDiscrepancy', true);
      
      // Should record discrepancy
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('recordBalanceDiscrepancy');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('bitcoin');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('btc_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('2');
      expect(mockFabricClient.submitTransaction.firstCall.args[4]).to.equal('1.5');
      expect(mockFabricClient.submitTransaction.firstCall.args[5]).to.equal('0.5');
    });
    
    it('should throw an error when wallet not found', async () => {
      try {
        await balanceReconciliation.reconcileWallet('bitcoin', 'non_existent_wallet');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to reconcile wallet');
      }
    });
  });
  
  describe('Full Reconciliation', () => {
    it('should reconcile all wallets successfully', async () => {
      const results = await balanceReconciliation.performFullReconciliation();
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(2);
      
      const bitcoinResult = results.find(r => r.blockchain === 'bitcoin');
      const litecoinResult = results.find(r => r.blockchain === 'litecoin');
      
      expect(bitcoinResult).to.exist;
      expect(bitcoinResult).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(bitcoinResult).to.have.property('onChainBalance', 1.5);
      expect(bitcoinResult).to.have.property('aggregateInternalBalance', 1.5);
      expect(bitcoinResult).to.have.property('hasDiscrepancy', false);
      
      expect(litecoinResult).to.exist;
      expect(litecoinResult).to.have.property('primaryWalletName', 'ltc_wallet_1');
      expect(litecoinResult).to.have.property('onChainBalance', 10.0);
      expect(litecoinResult).to.have.property('aggregateInternalBalance', 10.0);
      expect(litecoinResult).to.have.property('hasDiscrepancy', false);
      
      expect(mockWalletManager.getAllWallets.calledOnce).to.be.true;
      expect(mockWalletManager.getWallet.calledTwice).to.be.true;
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.calledTwice).to.be.true;
    });
    
    it('should detect and record discrepancies across multiple wallets', async () => {
      // Mock the getBalance to return different values
      const mockBitcoinWallet = mockWalletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockBitcoinWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      const mockLitecoinWallet = mockWalletManager.getWallet('litecoin', 'ltc_wallet_1');
      mockLitecoinWallet.getBalance.resolves(9.0); // Different from aggregate internal balance (10.0)
      
      const results = await balanceReconciliation.performFullReconciliation();
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(2);
      
      const bitcoinResult = results.find(r => r.blockchain === 'bitcoin');
      const litecoinResult = results.find(r => r.blockchain === 'litecoin');
      
      expect(bitcoinResult).to.have.property('hasDiscrepancy', true);
      expect(bitcoinResult).to.have.property('difference', 0.5);
      
      expect(litecoinResult).to.have.property('hasDiscrepancy', true);
      expect(litecoinResult).to.have.property('difference', 1.0);
      
      // Should record discrepancies for both wallets
      expect(mockFabricClient.submitTransaction.calledTwice).to.be.true;
    });
  });
  
  describe('After-Transaction Verification', () => {
    it('should verify balance after a transaction when strategy is afterTransaction', async () => {
      const result = await balanceReconciliation.verifyBalanceAfterTransaction(
        'bitcoin',
        'btc_wallet_1',
        'withdrawal',
        { amount: 0.1, fee: 0.0001 }
      );
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('verified', true);
      expect(result).to.have.property('reconciliationResult');
      expect(result.reconciliationResult).to.have.property('hasDiscrepancy', false);
      expect(result).to.have.property('transactionType', 'withdrawal');
      expect(result).to.have.property('transactionDetails');
      expect(result.transactionDetails).to.have.property('amount', 0.1);
      
      expect(mockWalletManager.getWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.calledOnce).to.be.true;
    });
    
    it('should skip verification when strategy is not afterTransaction', async () => {
      // Change the strategy
      const customConfig = {
        balanceReconciliation: {
          strategy: 'scheduled',
          scheduledFrequency: 3600000,
          warningThreshold: 0.00001,
          strictMode: false
        }
      };
      
      const reconciliation = await initializeBalanceReconciliation(
        customConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      const result = await reconciliation.verifyBalanceAfterTransaction(
        'bitcoin',
        'btc_wallet_1',
        'withdrawal',
        { amount: 0.1, fee: 0.0001 }
      );
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('verified', true);
      expect(result).to.have.property('skipped', true);
      
      // Should not call wallet manager methods
      expect(mockWalletManager.getWallet.called).to.be.false;
      expect(mockWalletManager.getInternalWalletsByPrimaryWallet.called).to.be.false;
      
      // Stop scheduled reconciliation
      reconciliation.stopScheduledReconciliation();
    });
    
    it('should throw an error in strict mode when discrepancy is detected', async () => {
      // Change to strict mode
      const customConfig = {
        balanceReconciliation: {
          strategy: 'afterTransaction',
          scheduledFrequency: 3600000,
          warningThreshold: 0.00001,
          strictMode: true
        }
      };
      
      const reconciliation = await initializeBalanceReconciliation(
        customConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      // Mock the getBalance to return a different value
      const mockWallet = mockWalletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      try {
        await reconciliation.verifyBalanceAfterTransaction(
          'bitcoin',
          'btc_wallet_1',
          'withdrawal',
          { amount: 0.1, fee: 0.0001 }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Balance verification failed');
        expect(error.message).to.include('Discrepancy of 0.5');
      }
      
      // Stop scheduled reconciliation
      reconciliation.stopScheduledReconciliation();
    });
    
    it('should return verification failed but not throw in non-strict mode', async () => {
      // Mock the getBalance to return a different value
      const mockWallet = mockWalletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      const result = await balanceReconciliation.verifyBalanceAfterTransaction(
        'bitcoin',
        'btc_wallet_1',
        'withdrawal',
        { amount: 0.1, fee: 0.0001 }
      );
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('verified', false);
      expect(result).to.have.property('reconciliationResult');
      expect(result.reconciliationResult).to.have.property('hasDiscrepancy', true);
      expect(result.reconciliationResult).to.have.property('difference', 0.5);
    });
  });
  
  describe('Scheduled Reconciliation', () => {
    it('should set up scheduled reconciliation when strategy is scheduled', async () => {
      const clock = sinon.useFakeTimers();
      
      // Change the strategy
      const customConfig = {
        balanceReconciliation: {
          strategy: 'scheduled',
          scheduledFrequency: 1000, // 1 second for testing
          warningThreshold: 0.00001,
          strictMode: false
        }
      };
      
      const reconciliation = await initializeBalanceReconciliation(
        customConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      // Reset the mock
      mockWalletManager.getAllWallets.resetHistory();
      
      // Advance the clock
      clock.tick(1100);
      
      // Should have called getAllWallets
      expect(mockWalletManager.getAllWallets.calledOnce).to.be.true;
      
      // Clean up
      reconciliation.stopScheduledReconciliation();
      clock.restore();
    });
    
    it('should set up scheduled reconciliation when strategy is both', async () => {
      const clock = sinon.useFakeTimers();
      
      // Change the strategy
      const customConfig = {
        balanceReconciliation: {
          strategy: 'both',
          scheduledFrequency: 1000, // 1 second for testing
          warningThreshold: 0.00001,
          strictMode: false
        }
      };
      
      const reconciliation = await initializeBalanceReconciliation(
        customConfig,
        mockWalletManager,
        mockFabricClient
      );
      
      // Reset the mock
      mockWalletManager.getAllWallets.resetHistory();
      
      // Advance the clock
      clock.tick(1100);
      
      // Should have called getAllWallets
      expect(mockWalletManager.getAllWallets.calledOnce).to.be.true;
      
      // Clean up
      reconciliation.stopScheduledReconciliation();
      clock.restore();
    });
    
    it('should not set up scheduled reconciliation when strategy is afterTransaction', async () => {
      const clock = sinon.useFakeTimers();
      
      // Reset the mock
      mockWalletManager.getAllWallets.resetHistory();
      
      // Advance the clock
      clock.tick(3700000); // More than the default frequency
      
      // Should not have called getAllWallets
      expect(mockWalletManager.getAllWallets.called).to.be.false;
      
      // Clean up
      clock.restore();
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
      
      // Mock the reconciliation config endpoint
      app.get('/api/reconciliation/config', (req, res) => {
        res.json(balanceReconciliation.getConfig());
      });
      
      // Mock the reconcile wallet endpoint
      app.post('/api/reconciliation/wallet/:blockchain/:name', async (req, res) => {
        try {
          const { blockchain, name } = req.params;
          
          const result = await balanceReconciliation.reconcileWallet(blockchain, name);
          
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // Mock the reconcile all endpoint
      app.post('/api/reconciliation/all', async (req, res) => {
        try {
          const results = await balanceReconciliation.performFullReconciliation();
          
          res.json(results);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // Generate a JWT token for authentication
      token = jwt.sign({ username: 'admin' }, 'test-secret', { expiresIn: '1d' });
    });
    
    it('should handle reconciliation config API requests', async () => {
      const response = await request(app)
        .get('/api/reconciliation/config')
        .expect(200);
      
      expect(response.body).to.have.property('strategy', 'afterTransaction');
      expect(response.body).to.have.property('scheduledFrequency', 3600000);
      expect(response.body).to.have.property('warningThreshold', 0.00001);
      expect(response.body).to.have.property('strictMode', false);
    });
    
    it('should handle reconcile wallet API requests', async () => {
      const response = await request(app)
        .post('/api/reconciliation/wallet/bitcoin/btc_wallet_1')
        .expect(200);
      
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(response.body).to.have.property('onChainBalance', 1.5);
      expect(response.body).to.have.property('aggregateInternalBalance', 1.5);
      expect(response.body).to.have.property('hasDiscrepancy', false);
    });
    
    it('should handle reconcile all API requests', async () => {
      const response = await request(app)
        .post('/api/reconciliation/all')
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(2);
      
      const bitcoinResult = response.body.find(r => r.blockchain === 'bitcoin');
      const litecoinResult = response.body.find(r => r.blockchain === 'litecoin');
      
      expect(bitcoinResult).to.exist;
      expect(bitcoinResult).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(bitcoinResult).to.have.property('hasDiscrepancy', false);
      
      expect(litecoinResult).to.exist;
      expect(litecoinResult).to.have.property('primaryWalletName', 'ltc_wallet_1');
      expect(litecoinResult).to.have.property('hasDiscrepancy', false);
    });
    
    it('should return 500 for non-existent wallet', async () => {
      const response = await request(app)
        .post('/api/reconciliation/wallet/bitcoin/non_existent_wallet')
        .expect(500);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Failed to reconcile wallet');
    });
  });
});
