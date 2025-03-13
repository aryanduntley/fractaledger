/**
 * Merchant Fee Chaincode Tests
 * 
 * This file contains tests for the merchant fee chaincode template, which is responsible for
 * handling merchant transactions and fee collection.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');

// Load the chaincode
const chaincodePath = path.resolve(__dirname, '../src/chaincode/templates/merchant-fee/index.js');
let chaincode;

describe('Merchant Fee Chaincode', () => {
  let mockStub;
  let mockContext;
  
  beforeEach(() => {
    // Clear the require cache to ensure a fresh chaincode instance for each test
    delete require.cache[chaincodePath];
    chaincode = require(chaincodePath);
    
    // Create a mock stub for the chaincode
    mockStub = {
      putState: sinon.stub().resolves(),
      getState: sinon.stub().callsFake((key) => {
        if (key === 'customer_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'customer_wallet_1',
            type: 'customer',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 1.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'merchant_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'merchant_wallet_1',
            type: 'merchant',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 2.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'fee_wallet_1',
            type: 'fee',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_config') {
          return Buffer.from(JSON.stringify({
            defaultFeePercentage: 2.5,
            minFeeAmount: 0.0001,
            maxFeeAmount: 0.1,
            merchantSpecificFees: {
              merchant_wallet_1: 2.0
            }
          }));
        }
        return Buffer.from('');
      }),
      getQueryResult: sinon.stub().resolves({
        iterator: {
          next: sinon.stub().callsFake(async () => {
            if (!mockStub.getQueryResult.nextCalled) {
              mockStub.getQueryResult.nextCalled = true;
              return {
                value: {
                  key: 'customer_wallet_1',
                  value: Buffer.from(JSON.stringify({
                    id: 'customer_wallet_1',
                    type: 'customer',
                    blockchain: 'bitcoin',
                    primaryWalletName: 'btc_wallet_1',
                    balance: 1.0,
                    createdAt: new Date().toISOString()
                  }))
                },
                done: false
              };
            } else {
              mockStub.getQueryResult.nextCalled = false;
              return {
                done: true
              };
            }
          }),
          close: sinon.stub().resolves()
        }
      })
    };
    
    // Create a mock context with the stub
    mockContext = {
      stub: mockStub
    };
  });
  
  describe('Wallet Management', () => {
    it('should create a customer wallet', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.createCustomerWallet(
        mockContext,
        'customer_wallet_2',
        'bitcoin',
        'btc_wallet_1'
      );
      
      const wallet = JSON.parse(result.toString());
      expect(wallet).to.have.property('id', 'customer_wallet_2');
      expect(wallet).to.have.property('type', 'customer');
      expect(wallet).to.have.property('blockchain', 'bitcoin');
      expect(wallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(wallet).to.have.property('balance', 0);
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('customer_wallet_2');
    });
    
    it('should create a merchant wallet', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.createMerchantWallet(
        mockContext,
        'merchant_wallet_2',
        'bitcoin',
        'btc_wallet_1'
      );
      
      const wallet = JSON.parse(result.toString());
      expect(wallet).to.have.property('id', 'merchant_wallet_2');
      expect(wallet).to.have.property('type', 'merchant');
      expect(wallet).to.have.property('blockchain', 'bitcoin');
      expect(wallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(wallet).to.have.property('balance', 0);
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('merchant_wallet_2');
    });
    
    it('should create a fee wallet', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.createFeeWallet(
        mockContext,
        'fee_wallet_2',
        'bitcoin',
        'btc_wallet_1'
      );
      
      const wallet = JSON.parse(result.toString());
      expect(wallet).to.have.property('id', 'fee_wallet_2');
      expect(wallet).to.have.property('type', 'fee');
      expect(wallet).to.have.property('blockchain', 'bitcoin');
      expect(wallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(wallet).to.have.property('balance', 0);
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('fee_wallet_2');
    });
    
    it('should get a wallet', async () => {
      const result = await chaincode.getWallet(
        mockContext,
        'customer_wallet_1'
      );
      
      const wallet = JSON.parse(result.toString());
      expect(wallet).to.have.property('id', 'customer_wallet_1');
      expect(wallet).to.have.property('type', 'customer');
      expect(wallet).to.have.property('blockchain', 'bitcoin');
      expect(wallet).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(wallet).to.have.property('balance', 1.0);
      expect(mockStub.getState.calledOnce).to.be.true;
      expect(mockStub.getState.firstCall.args[0]).to.equal('customer_wallet_1');
    });
    
    it('should update wallet balance', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.updateWalletBalance(
        mockContext,
        'customer_wallet_1',
        0.5
      );
      
      const wallet = JSON.parse(result.toString());
      expect(wallet).to.have.property('id', 'customer_wallet_1');
      expect(wallet).to.have.property('balance', 1.5); // 1.0 + 0.5
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('customer_wallet_1');
    });
    
    it('should get all wallets by type', async () => {
      // Reset the stub
      mockStub.getQueryResult.resetHistory();
      
      const result = await chaincode.getWalletsByType(
        mockContext,
        'customer'
      );
      
      const wallets = JSON.parse(result.toString());
      expect(wallets).to.be.an('array');
      expect(wallets).to.have.lengthOf(1);
      expect(wallets[0]).to.have.property('id', 'customer_wallet_1');
      expect(wallets[0]).to.have.property('type', 'customer');
      expect(mockStub.getQueryResult.calledOnce).to.be.true;
    });
  });
  
  describe('Fee Configuration', () => {
    it('should create a fee configuration', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.createFeeConfiguration(
        mockContext,
        3.0,
        0.0002,
        0.2,
        { merchant_wallet_1: 2.5 }
      );
      
      const feeConfig = JSON.parse(result.toString());
      expect(feeConfig).to.have.property('defaultFeePercentage', 3.0);
      expect(feeConfig).to.have.property('minFeeAmount', 0.0002);
      expect(feeConfig).to.have.property('maxFeeAmount', 0.2);
      expect(feeConfig.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.5);
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('fee_config');
    });
    
    it('should update fee configuration', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.updateFeeConfiguration(
        mockContext,
        3.5,
        0.0003,
        0.3,
        { merchant_wallet_1: 3.0, merchant_wallet_2: 2.5 }
      );
      
      const feeConfig = JSON.parse(result.toString());
      expect(feeConfig).to.have.property('defaultFeePercentage', 3.5);
      expect(feeConfig).to.have.property('minFeeAmount', 0.0003);
      expect(feeConfig).to.have.property('maxFeeAmount', 0.3);
      expect(feeConfig.merchantSpecificFees).to.have.property('merchant_wallet_1', 3.0);
      expect(feeConfig.merchantSpecificFees).to.have.property('merchant_wallet_2', 2.5);
      expect(mockStub.putState.calledOnce).to.be.true;
      expect(mockStub.putState.firstCall.args[0]).to.equal('fee_config');
    });
    
    it('should get fee configuration', async () => {
      const result = await chaincode.getFeeConfiguration(
        mockContext
      );
      
      const feeConfig = JSON.parse(result.toString());
      expect(feeConfig).to.have.property('defaultFeePercentage', 2.5);
      expect(feeConfig).to.have.property('minFeeAmount', 0.0001);
      expect(feeConfig).to.have.property('maxFeeAmount', 0.1);
      expect(feeConfig.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.0);
      expect(mockStub.getState.calledOnce).to.be.true;
      expect(mockStub.getState.firstCall.args[0]).to.equal('fee_config');
    });
  });
  
  describe('Transaction Processing', () => {
    it('should process a merchant transaction with fee', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.processMerchantTransaction(
        mockContext,
        'customer_wallet_1',
        'merchant_wallet_1',
        'fee_wallet_1',
        0.1
      );
      
      const transaction = JSON.parse(result.toString());
      expect(transaction).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(transaction).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(transaction).to.have.property('feeWalletId', 'fee_wallet_1');
      expect(transaction).to.have.property('amount', 0.1);
      expect(transaction).to.have.property('feeAmount', 0.002); // 2% of 0.1
      expect(transaction).to.have.property('netAmount', 0.098); // 0.1 - 0.002
      
      // Should update customer wallet (deduct amount)
      expect(mockStub.putState.calledWith('customer_wallet_1')).to.be.true;
      
      // Should update merchant wallet (add net amount)
      expect(mockStub.putState.calledWith('merchant_wallet_1')).to.be.true;
      
      // Should update fee wallet (add fee amount)
      expect(mockStub.putState.calledWith('fee_wallet_1')).to.be.true;
      
      // Should store transaction record
      expect(mockStub.putState.callCount).to.equal(4); // 3 wallet updates + 1 transaction record
    });
    
    it('should throw an error when customer has insufficient balance', async () => {
      // Override the getState stub for customer_wallet_1 to return a low balance
      mockStub.getState = sinon.stub().callsFake((key) => {
        if (key === 'customer_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'customer_wallet_1',
            type: 'customer',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.05, // Not enough for a 0.1 transaction
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'merchant_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'merchant_wallet_1',
            type: 'merchant',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 2.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'fee_wallet_1',
            type: 'fee',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_config') {
          return Buffer.from(JSON.stringify({
            defaultFeePercentage: 2.5,
            minFeeAmount: 0.0001,
            maxFeeAmount: 0.1,
            merchantSpecificFees: {
              merchant_wallet_1: 2.0
            }
          }));
        }
        return Buffer.from('');
      });
      
      try {
        await chaincode.processMerchantTransaction(
          mockContext,
          'customer_wallet_1',
          'merchant_wallet_1',
          'fee_wallet_1',
          0.1
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Insufficient balance');
      }
    });
    
    it('should apply merchant-specific fee rate', async () => {
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.processMerchantTransaction(
        mockContext,
        'customer_wallet_1',
        'merchant_wallet_1',
        'fee_wallet_1',
        0.1
      );
      
      const transaction = JSON.parse(result.toString());
      expect(transaction).to.have.property('feeAmount', 0.002); // 2% of 0.1 (merchant-specific rate)
      expect(transaction).to.have.property('netAmount', 0.098); // 0.1 - 0.002
    });
    
    it('should apply minimum fee amount', async () => {
      // Override the getState stub for fee_config to return a high min fee
      mockStub.getState = sinon.stub().callsFake((key) => {
        if (key === 'customer_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'customer_wallet_1',
            type: 'customer',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 1.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'merchant_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'merchant_wallet_1',
            type: 'merchant',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 2.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'fee_wallet_1',
            type: 'fee',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_config') {
          return Buffer.from(JSON.stringify({
            defaultFeePercentage: 2.0,
            minFeeAmount: 0.005, // Higher than 2% of 0.1 (0.002)
            maxFeeAmount: 0.1,
            merchantSpecificFees: {
              merchant_wallet_1: 2.0
            }
          }));
        }
        return Buffer.from('');
      });
      
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.processMerchantTransaction(
        mockContext,
        'customer_wallet_1',
        'merchant_wallet_1',
        'fee_wallet_1',
        0.1
      );
      
      const transaction = JSON.parse(result.toString());
      expect(transaction).to.have.property('feeAmount', 0.005); // Min fee amount
      expect(transaction).to.have.property('netAmount', 0.095); // 0.1 - 0.005
    });
    
    it('should apply maximum fee amount', async () => {
      // Override the getState stub for fee_config to return a low max fee
      mockStub.getState = sinon.stub().callsFake((key) => {
        if (key === 'customer_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'customer_wallet_1',
            type: 'customer',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 1.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'merchant_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'merchant_wallet_1',
            type: 'merchant',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 2.0,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_wallet_1') {
          return Buffer.from(JSON.stringify({
            id: 'fee_wallet_1',
            type: 'fee',
            blockchain: 'bitcoin',
            primaryWalletName: 'btc_wallet_1',
            balance: 0.5,
            createdAt: new Date().toISOString()
          }));
        } else if (key === 'fee_config') {
          return Buffer.from(JSON.stringify({
            defaultFeePercentage: 20.0, // High percentage
            minFeeAmount: 0.0001,
            maxFeeAmount: 0.01, // Lower than 20% of 0.1 (0.02)
            merchantSpecificFees: {
              merchant_wallet_1: 20.0 // High percentage
            }
          }));
        }
        return Buffer.from('');
      });
      
      // Reset the stub
      mockStub.putState.resetHistory();
      
      const result = await chaincode.processMerchantTransaction(
        mockContext,
        'customer_wallet_1',
        'merchant_wallet_1',
        'fee_wallet_1',
        0.1
      );
      
      const transaction = JSON.parse(result.toString());
      expect(transaction).to.have.property('feeAmount', 0.01); // Max fee amount
      expect(transaction).to.have.property('netAmount', 0.09); // 0.1 - 0.01
    });
  });
  
  describe('Transaction History', () => {
    it('should get merchant transaction history', async () => {
      // Mock the getQueryResult to return transaction history
      mockStub.getQueryResult = sinon.stub().resolves({
        iterator: {
          next: sinon.stub().callsFake(async () => {
            if (!mockStub.getQueryResult.nextCalled) {
              mockStub.getQueryResult.nextCalled = true;
              return {
                value: {
                  key: 'tx_1',
                  value: Buffer.from(JSON.stringify({
                    id: 'tx_1',
                    fromWalletId: 'customer_wallet_1',
                    toWalletId: 'merchant_wallet_1',
                    feeWalletId: 'fee_wallet_1',
                    amount: 0.1,
                    feeAmount: 0.002,
                    netAmount: 0.098,
                    timestamp: new Date().toISOString()
                  }))
                },
                done: false
              };
            } else {
              mockStub.getQueryResult.nextCalled = false;
              return {
                done: true
              };
            }
          }),
          close: sinon.stub().resolves()
        }
      });
      
      const result = await chaincode.getMerchantTransactionHistory(
        mockContext,
        'merchant_wallet_1',
        '10'
      );
      
      const transactions = JSON.parse(result.toString());
      expect(transactions).to.be.an('array');
      expect(transactions).to.have.lengthOf(1);
      expect(transactions[0]).to.have.property('id', 'tx_1');
      expect(transactions[0]).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(mockStub.getQueryResult.calledOnce).to.be.true;
    });
    
    it('should get customer transaction history', async () => {
      // Mock the getQueryResult to return transaction history
      mockStub.getQueryResult = sinon.stub().resolves({
        iterator: {
          next: sinon.stub().callsFake(async () => {
            if (!mockStub.getQueryResult.nextCalled) {
              mockStub.getQueryResult.nextCalled = true;
              return {
                value: {
                  key: 'tx_1',
                  value: Buffer.from(JSON.stringify({
                    id: 'tx_1',
                    fromWalletId: 'customer_wallet_1',
                    toWalletId: 'merchant_wallet_1',
                    feeWalletId: 'fee_wallet_1',
                    amount: 0.1,
                    feeAmount: 0.002,
                    netAmount: 0.098,
                    timestamp: new Date().toISOString()
                  }))
                },
                done: false
              };
            } else {
              mockStub.getQueryResult.nextCalled = false;
              return {
                done: true
              };
            }
          }),
          close: sinon.stub().resolves()
        }
      });
      
      const result = await chaincode.getCustomerTransactionHistory(
        mockContext,
        'customer_wallet_1',
        '10'
      );
      
      const transactions = JSON.parse(result.toString());
      expect(transactions).to.be.an('array');
      expect(transactions).to.have.lengthOf(1);
      expect(transactions[0]).to.have.property('id', 'tx_1');
      expect(transactions[0]).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(mockStub.getQueryResult.calledOnce).to.be.true;
    });
  });
});
