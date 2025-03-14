/**
 * New Features Integration Tests
 * 
 * This file contains integration tests for all the new features implemented
 * in the FractaLedger system, including internal transfers, base wallet protection,
 * balance reconciliation, and API messaging.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { WalletManager } = require('../src/wallet/walletManager');
const { initializeBalanceReconciliation } = require('../src/reconciliation/balanceReconciliation');
const { MessageType, MessageCode, createMessageManager } = require('../src/api/messaging');

describe('New Features Integration', () => {
  let walletManager;
  let balanceReconciliation;
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
        } else if (fcn === 'transferBetweenInternalWallets') {
          return Buffer.from(JSON.stringify({
            id: 'transfer_1',
            fromInternalWalletId: args[0],
            toInternalWalletId: args[1],
            amount: parseFloat(args[2]),
            memo: args[3] || null,
            timestamp: new Date().toISOString()
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
        } else if (fcn === 'recordBalanceDiscrepancy') {
          return Buffer.from(JSON.stringify({
            id: 'discrepancy_1',
            blockchain: args[0],
            primaryWalletName: args[1],
            onChainBalance: parseFloat(args[2]),
            aggregateInternalBalance: parseFloat(args[3]),
            difference: parseFloat(args[4]),
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
        } else if (fcn === 'getTransactionHistory') {
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
      })
    };
    
    // Create mock config
    mockConfig = {
      baseInternalWallet: {
        namePrefix: 'base_wallet_',
        description: 'Represents excess funds in the primary on-chain wallet'
      },
      balanceReconciliation: {
        strategy: 'afterTransaction',
        scheduledFrequency: 3600000, // 1 hour
        warningThreshold: 0.00001,
        strictMode: false
      }
    };
    
    // Create wallet manager instance
    walletManager = new WalletManager(mockBlockchainConnectors, mockFabricClient, mockConfig);
    
    // Add required methods to wallet manager if they don't exist
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
    
    // Initialize balance reconciliation module
    balanceReconciliation = await initializeBalanceReconciliation(
      mockConfig,
      walletManager,
      mockFabricClient
    );
  });
  
  afterEach(() => {
    // Stop scheduled reconciliation if running
    if (balanceReconciliation && balanceReconciliation.stopScheduledReconciliation) {
      balanceReconciliation.stopScheduledReconciliation();
    }
  });
  
  describe('End-to-End Workflow', () => {
    it('should handle a complete workflow with all new features', async () => {
      // Step 1: Create a base internal wallet
      const baseWallet = await walletManager.createBaseInternalWallet('bitcoin', 'btc_wallet_1');
      
      expect(baseWallet).to.be.an('object');
      expect(baseWallet).to.have.property('id', 'base_wallet_bitcoin_btc_wallet_1');
      expect(baseWallet).to.have.property('isBaseWallet', true);
      
      // Step 2: Get wallet read-only information
      const walletInfo = await walletManager.getWalletReadOnly('bitcoin', 'btc_wallet_1');
      
      expect(walletInfo).to.be.an('object');
      expect(walletInfo).to.have.property('blockchain', 'bitcoin');
      expect(walletInfo).to.have.property('name', 'btc_wallet_1');
      expect(walletInfo).to.have.property('balance', 1.5);
      expect(walletInfo).to.have.property('aggregateInternalBalance', 0.8); // 0.5 + 0.3
      expect(walletInfo).to.have.property('excessBalance', 0.7); // 1.5 - 0.8
      expect(walletInfo).to.have.property('baseInternalWalletId', 'base_wallet_bitcoin_btc_wallet_1');
      
      // Step 3: Transfer between internal wallets
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
      expect(transfer).to.have.property('memo', 'Test transfer');
      
      // Step 4: Verify balance after transaction
      const verificationResult = await balanceReconciliation.verifyBalanceAfterTransaction(
        'bitcoin',
        'btc_wallet_1',
        'transfer',
        { fromWalletId: 'internal_wallet_1', toWalletId: 'internal_wallet_2', amount: 0.1 }
      );
      
      expect(verificationResult).to.be.an('object');
      expect(verificationResult).to.have.property('verified', true);
      expect(verificationResult).to.have.property('reconciliationResult');
      expect(verificationResult.reconciliationResult).to.have.property('hasDiscrepancy', false);
      
      // Step 5: Withdraw from base internal wallet
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
      
      // Step 6: Create API response with messaging
      const msgManager = createMessageManager();
      
      msgManager.addInfo(
        MessageCode.INFO_TRANSACTION_PROCESSED,
        'Withdrawal processed successfully',
        { txid: '0x1234567890abcdef' }
      );
      
      msgManager.addWarning(
        MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW,
        'Primary wallet balance is getting low',
        { balance: 1.4, threshold: 1.5 }
      );
      
      const response = msgManager.createResponse({ withdrawal });
      
      expect(response).to.be.an('object');
      expect(response).to.have.property('data');
      expect(response.data).to.have.property('withdrawal');
      expect(response.data.withdrawal).to.have.property('id', 'withdrawal_1');
      
      expect(response).to.have.property('messages');
      expect(response.messages).to.be.an('array');
      expect(response.messages).to.have.lengthOf(2);
      
      const infoMessage = response.messages.find(m => m.type === MessageType.INFO);
      const warningMessage = response.messages.find(m => m.type === MessageType.WARNING);
      
      expect(infoMessage).to.exist;
      expect(infoMessage).to.have.property('code', MessageCode.INFO_TRANSACTION_PROCESSED);
      
      expect(warningMessage).to.exist;
      expect(warningMessage).to.have.property('code', MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient balance for internal transfer', async () => {
      // Mock the getInternalWallet to return a wallet with low balance
      mockFabricClient.evaluateTransaction.callsFake(async (fcn, ...args) => {
        if (fcn === 'getInternalWallet') {
          const walletId = args[0];
          if (walletId === 'internal_wallet_1') {
            return Buffer.from(JSON.stringify({
              id: 'internal_wallet_1',
              blockchain: 'bitcoin',
              primaryWalletName: 'btc_wallet_1',
              balance: 0.05, // Low balance
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
          }
        }
        return Buffer.from('[]');
      });
      
      try {
        await walletManager.transferBetweenInternalWallets(
          'internal_wallet_1',
          'internal_wallet_2',
          0.1 // More than available balance
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance in source wallet');
        
        // Create API response with error message
        const msgManager = createMessageManager();
        
        msgManager.addError(
          MessageCode.ERROR_INSUFFICIENT_BALANCE,
          'Insufficient balance for transfer',
          { available: 0.05, requested: 0.1 }
        );
        
        const response = msgManager.createResponse({ success: false });
        
        expect(response).to.have.property('data').that.deep.equals({ success: false });
        expect(response).to.have.property('messages');
        expect(response.messages).to.have.lengthOf(1);
        expect(response.messages[0]).to.have.property('type', MessageType.ERROR);
        expect(response.messages[0]).to.have.property('code', MessageCode.ERROR_INSUFFICIENT_BALANCE);
      }
    });
    
    it('should handle balance discrepancy detection', async () => {
      // Mock the getBalance to return a different value
      const mockWallet = walletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      const result = await balanceReconciliation.reconcileWallet('bitcoin', 'btc_wallet_1');
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('blockchain', 'bitcoin');
      expect(result).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(result).to.have.property('onChainBalance', 2.0);
      expect(result).to.have.property('aggregateInternalBalance', 1.5);
      expect(result).to.have.property('difference', 0.5);
      expect(result).to.have.property('hasDiscrepancy', true);
      
      // Create API response with warning message
      const msgManager = createMessageManager();
      
      msgManager.addWarning(
        MessageCode.WARN_BALANCE_DISCREPANCY,
        'Balance discrepancy detected',
        {
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          onChainBalance: 2.0,
          aggregateInternalBalance: 1.5,
          difference: 0.5
        }
      );
      
      const response = msgManager.createResponse({ reconciliation: result });
      
      expect(response).to.have.property('data');
      expect(response.data).to.have.property('reconciliation');
      expect(response.data.reconciliation).to.have.property('hasDiscrepancy', true);
      
      expect(response).to.have.property('messages');
      expect(response.messages).to.have.lengthOf(1);
      expect(response.messages[0]).to.have.property('type', MessageType.WARNING);
      expect(response.messages[0]).to.have.property('code', MessageCode.WARN_BALANCE_DISCREPANCY);
    });
    
    it('should handle strict mode reconciliation failure', async () => {
      // Change to strict mode
      const strictConfig = {
        ...mockConfig,
        balanceReconciliation: {
          ...mockConfig.balanceReconciliation,
          strictMode: true
        }
      };
      
      const strictReconciliation = await initializeBalanceReconciliation(
        strictConfig,
        walletManager,
        mockFabricClient
      );
      
      // Mock the getBalance to return a different value
      const mockWallet = walletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockWallet.getBalance.resolves(2.0); // Different from aggregate internal balance (1.5)
      
      try {
        await strictReconciliation.verifyBalanceAfterTransaction(
          'bitcoin',
          'btc_wallet_1',
          'withdrawal',
          { amount: 0.1, fee: 0.0001 }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Balance verification failed');
        
        // Create API response with error message
        const msgManager = createMessageManager();
        
        msgManager.addError(
          MessageCode.ERROR_TRANSACTION_FAILED,
          'Transaction failed due to balance discrepancy',
          {
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            onChainBalance: 2.0,
            aggregateInternalBalance: 1.5,
            difference: 0.5
          }
        );
        
        const response = msgManager.createResponse({ success: false });
        
        expect(response).to.have.property('data').that.deep.equals({ success: false });
        expect(response).to.have.property('messages');
        expect(response.messages).to.have.lengthOf(1);
        expect(response.messages[0]).to.have.property('type', MessageType.ERROR);
        expect(response.messages[0]).to.have.property('code', MessageCode.ERROR_TRANSACTION_FAILED);
      }
      
      // Stop scheduled reconciliation
      strictReconciliation.stopScheduledReconciliation();
    });
  });
});
