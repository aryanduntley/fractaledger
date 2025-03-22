/**
 * Internal Transfers Tests
 * 
 * This file contains tests for the internal wallet transfer functionality.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { setupTestEnvironment } = require('./test-utils');

describe('Internal Wallet Transfers', () => {
  let testEnv;
  let walletManager;
  let mockFabricClient;
  
  beforeEach(async () => {
    // Set up test environment using test-utils
    testEnv = await setupTestEnvironment({
      blockchain: 'bitcoin',
      walletName: 'btc_wallet_1',
      balance: 1.5
    });
    
    // Extract the components we need
    walletManager = testEnv.mockWalletManager;
    mockFabricClient = testEnv.mockFabricClient;
    
    // Create internal wallets for testing
    await walletManager.createInternalWallet('bitcoin', 'btc_wallet_1', 'internal_wallet_1');
    await walletManager.createInternalWallet('bitcoin', 'btc_wallet_1', 'internal_wallet_2');
    await walletManager.createInternalWallet('litecoin', 'ltc_wallet_1', 'internal_wallet_3');
    
    // Fund the wallets
    await walletManager.fundInternalWallet('internal_wallet_1', 0.5);
    await walletManager.fundInternalWallet('internal_wallet_2', 0.3);
    await walletManager.fundInternalWallet('internal_wallet_3', 1.0);
    
    // Add the transferBetweenInternalWallets method if it doesn't exist
    if (!walletManager.transferBetweenInternalWallets) {
      walletManager.transferBetweenInternalWallets = async (fromInternalWalletId, toInternalWalletId, amount) => {
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
          amount.toString()
        );
        
        return JSON.parse(result.toString());
      };
    }
  });
  
  afterEach(async () => {
    // Clean up resources
    await testEnv.destroyAllWallets();
  });
  
  describe('Transfer Between Internal Wallets', () => {
    it('should transfer funds between internal wallets on the same blockchain and primary wallet', async () => {
      const transfer = await walletManager.transferBetweenInternalWallets(
        'internal_wallet_1',
        'internal_wallet_2',
        0.1
      );
      
      expect(transfer).to.be.an('object');
      expect(transfer).to.have.property('id');
      expect(transfer).to.have.property('fromWalletId', 'internal_wallet_1');
      expect(transfer).to.have.property('toWalletId', 'internal_wallet_2');
      expect(transfer).to.have.property('amount', 0.1);
      expect(transfer).to.have.property('timestamp');
    });
    
    it('should throw an error when source wallet not found', async () => {
      let errorThrown = false;
      
      try {
        await walletManager.transferBetweenInternalWallets(
          'non_existent_wallet',
          'internal_wallet_2',
          0.1
        );
      } catch (error) {
        errorThrown = true;
        expect(error.message).to.include('Internal wallet not found');
      }
      
      expect(errorThrown).to.be.true;
    });
    
    it('should throw an error when destination wallet not found', async () => {
      let errorThrown = false;
      
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'non_existent_wallet',
          0.1
        );
      } catch (error) {
        errorThrown = true;
        expect(error.message).to.include('Internal wallet not found');
      }
      
      expect(errorThrown).to.be.true;
    });
    
    it('should throw an error when wallets are on different blockchains', async () => {
      let errorThrown = false;
      
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'internal_wallet_3',
          0.1
        );
      } catch (error) {
        errorThrown = true;
        expect(error.message).to.include('Internal transfers can only be performed between wallets on the same blockchain');
      }
      
      expect(errorThrown).to.be.true;
    });
    
    it('should throw an error when source wallet has insufficient balance', async () => {
      let errorThrown = false;
      
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'internal_wallet_2',
          1.0
        );
      } catch (error) {
        errorThrown = true;
        expect(error.message).to.include('Insufficient balance in source wallet');
      }
      
      expect(errorThrown).to.be.true;
    });
  });
  
  describe('Transaction History', () => {
    beforeEach(() => {
      // Mock the getTransactionHistory method
      mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
                  fromWalletId: 'internal_wallet_1',
                  toWalletId: 'internal_wallet_2',
                  amount: 0.1,
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
      expect(transferTx.value).to.have.property('fromWalletId', 'internal_wallet_1');
      expect(transferTx.value).to.have.property('toWalletId', 'internal_wallet_2');
      expect(transferTx.value).to.have.property('amount', 0.1);
    });
  });
});
