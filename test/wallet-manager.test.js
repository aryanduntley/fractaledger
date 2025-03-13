/**
 * Wallet Manager Tests
 * 
 * This file contains tests for the wallet manager module, which is responsible for
 * wallet verification, creation, and management.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { WalletManager } = require('../src/wallet/walletManager');
const { SpvConnector } = require('../src/blockchain/connectors/spvConnector');
const { FullNodeConnector } = require('../src/blockchain/connectors/fullNodeConnector');
const { ApiConnector } = require('../src/blockchain/connectors/apiConnector');

describe('Wallet Manager', () => {
  let walletManager;
  let mockBlockchainConnectors;
  let mockFabricClient;
  
  beforeEach(() => {
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
        },
        btc_wallet_2: {
          blockchain: 'bitcoin',
          name: 'btc_wallet_2',
          walletAddress: 'bc1q...',
          connectionType: 'fullNode',
          getBalance: sinon.stub().resolves(2.0),
          getTransactionHistory: sinon.stub().resolves([]),
          sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
          verifyAddress: sinon.stub().resolves(true),
          estimateFee: sinon.stub().resolves(0.0001),
          getBlockchainHeight: sinon.stub().resolves(700000),
          getTransaction: sinon.stub().resolves({}),
          verifyUtxoWallet: sinon.stub().resolves(true)
        }
      },
      litecoin: {
        ltc_wallet_1: {
          blockchain: 'litecoin',
          name: 'ltc_wallet_1',
          walletAddress: 'ltc1q...',
          connectionType: 'api',
          getBalance: sinon.stub().resolves(10.0),
          getTransactionHistory: sinon.stub().resolves([]),
          sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
          verifyAddress: sinon.stub().resolves(true),
          estimateFee: sinon.stub().resolves(0.0001),
          getBlockchainHeight: sinon.stub().resolves(2000000),
          getTransaction: sinon.stub().resolves({}),
          verifyUtxoWallet: sinon.stub().resolves(true)
        }
      }
    };
    
    // Create mock Fabric client
    mockFabricClient = {
      submitTransaction: sinon.stub().resolves(Buffer.from(JSON.stringify({
        id: 'internal_wallet_1',
        blockchain: 'bitcoin',
        primaryWalletName: 'btc_wallet_1',
        balance: 0,
        createdAt: new Date().toISOString()
      }))),
      evaluateTransaction: sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: args[0],
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
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
              primaryWalletName: 'btc_wallet_2',
              balance: 1.0,
              createdAt: new Date().toISOString()
            },
            {
              id: 'internal_wallet_3',
              blockchain: 'litecoin',
              primaryWalletName: 'ltc_wallet_1',
              balance: 5.0,
              createdAt: new Date().toISOString()
            }
          ]));
        } else if (fcn === 'getInternalWalletBalance') {
          return Buffer.from(JSON.stringify({
            id: args[0],
            balance: 0.5
          }));
        }
        return Buffer.from('{}');
      })
    };
    
    // Create wallet manager instance
    walletManager = new WalletManager(mockBlockchainConnectors, mockFabricClient);
  });
  
  describe('Wallet Management', () => {
    it('should get all wallets', () => {
      const wallets = walletManager.getAllWallets();
      
      expect(wallets).to.be.an('array');
      expect(wallets).to.have.lengthOf(3);
      
      const bitcoinWallets = wallets.filter(w => w.blockchain === 'bitcoin');
      const litecoinWallets = wallets.filter(w => w.blockchain === 'litecoin');
      
      expect(bitcoinWallets).to.have.lengthOf(2);
      expect(litecoinWallets).to.have.lengthOf(1);
      
      expect(bitcoinWallets[0]).to.have.property('name', 'btc_wallet_1');
      expect(bitcoinWallets[1]).to.have.property('name', 'btc_wallet_2');
      expect(litecoinWallets[0]).to.have.property('name', 'ltc_wallet_1');
    });
    
    it('should get wallets for a specific blockchain', () => {
      const bitcoinWallets = walletManager.getWalletsForBlockchain('bitcoin');
      const litecoinWallets = walletManager.getWalletsForBlockchain('litecoin');
      
      expect(bitcoinWallets).to.be.an('array');
      expect(bitcoinWallets).to.have.lengthOf(2);
      expect(bitcoinWallets[0]).to.have.property('name', 'btc_wallet_1');
      expect(bitcoinWallets[1]).to.have.property('name', 'btc_wallet_2');
      
      expect(litecoinWallets).to.be.an('array');
      expect(litecoinWallets).to.have.lengthOf(1);
      expect(litecoinWallets[0]).to.have.property('name', 'ltc_wallet_1');
    });
    
    it('should get a specific wallet', () => {
      const wallet = walletManager.getWallet('bitcoin', 'btc_wallet_1');
      
      expect(wallet).to.be.an('object');
      expect(wallet).to.have.property('blockchain', 'bitcoin');
      expect(wallet).to.have.property('name', 'btc_wallet_1');
      expect(wallet).to.have.property('walletAddress', 'bc1q...');
      expect(wallet).to.have.property('connectionType', 'spv');
    });
    
    it('should return null for a non-existent wallet', () => {
      const wallet = walletManager.getWallet('bitcoin', 'non_existent_wallet');
      
      expect(wallet).to.be.null;
    });
    
    it('should get wallet balance', async () => {
      const balance = await walletManager.getWalletBalance('bitcoin', 'btc_wallet_1');
      
      expect(balance).to.equal(1.5);
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.getBalance.calledOnce).to.be.true;
    });
    
    it('should throw an error for a non-existent wallet when getting balance', async () => {
      try {
        await walletManager.getWalletBalance('bitcoin', 'non_existent_wallet');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Wallet not found');
      }
    });
    
    it('should get wallet transaction history', async () => {
      await walletManager.getWalletTransactionHistory('bitcoin', 'btc_wallet_1', 10);
      
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.getTransactionHistory.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.getTransactionHistory.firstCall.args[0]).to.equal(10);
    });
    
    it('should verify a wallet address', async () => {
      const isValid = await walletManager.verifyWalletAddress('bitcoin', 'btc_wallet_1', 'bc1q...');
      
      expect(isValid).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.verifyAddress.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.verifyAddress.firstCall.args[0]).to.equal('bc1q...');
    });
    
    it('should estimate transaction fee', async () => {
      const fee = await walletManager.estimateTransactionFee('bitcoin', 'btc_wallet_1', 'bc1q...', 0.1, {});
      
      expect(fee).to.equal(0.0001);
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[0]).to.equal('bc1q...');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[1]).to.equal(0.1);
    });
    
    it('should send a transaction', async () => {
      const txid = await walletManager.sendTransaction('bitcoin', 'btc_wallet_1', 'bc1q...', 0.1, { fee: 0.0001 });
      
      expect(txid).to.equal('0x1234567890abcdef');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[0]).to.equal('bc1q...');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[1]).to.equal(0.1);
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[2]).to.deep.equal({ fee: 0.0001 });
    });
    
    it('should verify if a wallet is UTXO-based', async () => {
      const isUtxo = await walletManager.verifyUtxoWallet('bitcoin', 'btc_wallet_1');
      
      expect(isUtxo).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.verifyUtxoWallet.calledOnce).to.be.true;
    });
  });
  
  describe('Internal Wallet Management', () => {
    it('should create an internal wallet', async () => {
      const internalWallet = await walletManager.createInternalWallet('bitcoin', 'btc_wallet_1', 'internal_wallet_1');
      
      expect(internalWallet).to.be.an('object');
      expect(internalWallet).to.have.property('id', 'internal_wallet_1');
      expect(internalWallet).to.have.property('blockchain', 'bitcoin');
      expect(internalWallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(internalWallet).to.have.property('balance', 0);
      
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('createInternalWallet');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('bitcoin');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('btc_wallet_1');
    });
    
    it('should throw an error when creating an internal wallet with a non-existent primary wallet', async () => {
      try {
        await walletManager.createInternalWallet('bitcoin', 'non_existent_wallet', 'internal_wallet_1');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Primary wallet not found');
      }
    });
    
    it('should get all internal wallets', async () => {
      const internalWallets = await walletManager.getAllInternalWallets();
      
      expect(internalWallets).to.be.an('array');
      expect(internalWallets).to.have.lengthOf(3);
      
      const bitcoinWallets = internalWallets.filter(w => w.blockchain === 'bitcoin');
      const litecoinWallets = internalWallets.filter(w => w.blockchain === 'litecoin');
      
      expect(bitcoinWallets).to.have.lengthOf(2);
      expect(litecoinWallets).to.have.lengthOf(1);
      
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getAllInternalWallets');
    });
    
    it('should get an internal wallet', async () => {
      const internalWallet = await walletManager.getInternalWallet('internal_wallet_1');
      
      expect(internalWallet).to.be.an('object');
      expect(internalWallet).to.have.property('id', 'internal_wallet_1');
      expect(internalWallet).to.have.property('blockchain', 'bitcoin');
      expect(internalWallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(internalWallet).to.have.property('balance', 0.5);
      
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWallet');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
    });
    
    it('should get internal wallet balance', async () => {
      const balance = await walletManager.getInternalWalletBalance('internal_wallet_1');
      
      expect(balance).to.equal(0.5);
      
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWalletBalance');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
    });
    
    it('should withdraw from an internal wallet', async () => {
      // Reset the stubs
      mockFabricClient.submitTransaction.resetHistory();
      mockFabricClient.evaluateTransaction.resetHistory();
      
      // Mock the getInternalWallet call
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: args[0],
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        }
        return Buffer.from('{}');
      });
      
      // Mock the withdrawFromInternalWallet call
      mockFabricClient.submitTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'withdrawFromInternalWallet') {
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
      });
      
      // Mock the estimateFee call
      mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.resolves(0.0001);
      
      // Mock the sendTransaction call
      mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.resolves('0x1234567890abcdef');
      
      const withdrawal = await walletManager.withdrawFromInternalWallet('internal_wallet_1', 'bc1q...', 0.1);
      
      expect(withdrawal).to.be.an('object');
      expect(withdrawal).to.have.property('id', 'withdrawal_1');
      expect(withdrawal).to.have.property('internalWalletId', 'internal_wallet_1');
      expect(withdrawal).to.have.property('toAddress', 'bc1q...');
      expect(withdrawal).to.have.property('amount', 0.1);
      expect(withdrawal).to.have.property('fee', 0.0001);
      
      // Verify the getInternalWallet call
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWallet');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      
      // Verify the estimateFee call
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[0]).to.equal('bc1q...');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.firstCall.args[1]).to.equal(0.1);
      
      // Verify the withdrawFromInternalWallet call
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('withdrawFromInternalWallet');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('bc1q...');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('0.1');
      expect(mockFabricClient.submitTransaction.firstCall.args[4]).to.equal('0.0001');
      
      // Verify the sendTransaction call
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.calledOnce).to.be.true;
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[0]).to.equal('bc1q...');
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[1]).to.equal(0.1);
      expect(mockBlockchainConnectors.bitcoin.btc_wallet_1.sendTransaction.firstCall.args[2]).to.deep.equal({ fee: 0.0001 });
    });
    
    it('should throw an error when withdrawing more than the available balance', async () => {
      // Reset the stubs
      mockFabricClient.evaluateTransaction.resetHistory();
      
      // Mock the getInternalWallet call
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          return Buffer.from(JSON.stringify({
            id: args[0],
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        }
        return Buffer.from('{}');
      });
      
      // Mock the estimateFee call
      mockBlockchainConnectors.bitcoin.btc_wallet_1.estimateFee.resolves(0.0001);
      
      try {
        await walletManager.withdrawFromInternalWallet('internal_wallet_1', 'bc1q...', 1.0);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance');
      }
    });
  });
});
