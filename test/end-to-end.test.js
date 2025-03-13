/**
 * End-to-End Tests
 * 
 * This file contains end-to-end tests for the FractaLedger system, demonstrating
 * how to test complete workflows from wallet registration to transaction processing.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock dependencies
const mockBlockchainConnectors = {};
const mockWalletManager = {};
const mockFabricClient = {};
const mockChaincodeManager = {};

// Mock config
const mockConfig = {
  api: {
    port: 3000,
    host: 'localhost',
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    auth: {
      jwtSecret: 'test-secret',
      expiresIn: '1d'
    },
    rateLimiting: {
      windowMs: 900000,
      max: 100
    }
  }
};

// Import the API server module
const { startApiServer } = require('../src/api/server');

describe('End-to-End Tests', () => {
  let app;
  let token;
  
  before(async () => {
    // Set up mock blockchain connectors
    mockBlockchainConnectors.bitcoin = {
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
    };
    
    // Set up mock wallet manager
    mockWalletManager.getAllWallets = sinon.stub().returns([
      {
        blockchain: 'bitcoin',
        name: 'btc_wallet_1',
        address: 'bc1q...',
        connectionType: 'spv'
      }
    ]);
    
    mockWalletManager.getWalletsForBlockchain = sinon.stub().returns([
      {
        blockchain: 'bitcoin',
        name: 'btc_wallet_1',
        address: 'bc1q...',
        connectionType: 'spv'
      }
    ]);
    
    mockWalletManager.getWallet = sinon.stub().returns({
      blockchain: 'bitcoin',
      name: 'btc_wallet_1',
      address: 'bc1q...',
      connectionType: 'spv',
      getBalance: sinon.stub().resolves(1.5),
      getTransactionHistory: sinon.stub().resolves([]),
      sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
      verifyAddress: sinon.stub().resolves(true),
      estimateFee: sinon.stub().resolves(0.0001),
      getBlockchainHeight: sinon.stub().resolves(700000),
      getTransaction: sinon.stub().resolves({})
    });
    
    mockWalletManager.createInternalWallet = sinon.stub().resolves({
      id: 'internal_wallet_1',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0,
      createdAt: new Date().toISOString()
    });
    
    mockWalletManager.getAllInternalWallets = sinon.stub().resolves([
      {
        id: 'internal_wallet_1',
        blockchain: 'bitcoin',
        primaryWalletName: 'btc_wallet_1',
        balance: 0.5,
        createdAt: new Date().toISOString()
      }
    ]);
    
    mockWalletManager.getInternalWallet = sinon.stub().resolves({
      id: 'internal_wallet_1',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0.5,
      createdAt: new Date().toISOString()
    });
    
    mockWalletManager.getInternalWalletBalance = sinon.stub().resolves(0.5);
    
    mockWalletManager.withdrawFromInternalWallet = sinon.stub().resolves({
      id: 'withdrawal_1',
      internalWalletId: 'internal_wallet_1',
      toAddress: 'bc1q...',
      amount: 0.1,
      fee: 0.0001,
      timestamp: new Date().toISOString()
    });
    
    // Set up mock Fabric client
    mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
          }
        ]));
      } else if (fcn === 'getInternalWalletBalance') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          balance: 0.5
        }));
      }
      return Buffer.from('{}');
    });
    
    mockFabricClient.submitTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
      } else if (fcn === 'updateInternalWalletBalance') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          balance: parseFloat(args[1]),
          updatedAt: new Date().toISOString()
        }));
      } else if (fcn === 'processMerchantTransaction') {
        return Buffer.from(JSON.stringify({
          id: 'tx_1',
          fromWalletId: args[0],
          toWalletId: args[1],
          feeWalletId: args[2],
          amount: parseFloat(args[3]),
          feeAmount: parseFloat(args[3]) * 0.02,
          netAmount: parseFloat(args[3]) * 0.98,
          timestamp: new Date().toISOString()
        }));
      }
      return Buffer.from('{}');
    });
    
    // Set up mock chaincode manager
    mockChaincodeManager.getAvailableTemplates = sinon.stub().returns([
      {
        id: 'default',
        name: 'Default Template',
        description: 'Default chaincode template for FractaLedger'
      },
      {
        id: 'merchant-fee',
        name: 'Merchant Fee Template',
        description: 'Chaincode template for merchant fee collection'
      },
      {
        id: 'employee-payroll',
        name: 'Employee Payroll Template',
        description: 'Chaincode template for employee payroll management'
      }
    ]);
    
    mockChaincodeManager.createCustomChaincode = sinon.stub().returns({
      id: 'my-custom-chaincode',
      templateId: 'merchant-fee',
      path: '/path/to/my-custom-chaincode'
    });
    
    mockChaincodeManager.deployCustomChaincode = sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'deployed',
      timestamp: new Date().toISOString()
    });
    
    // Start the API server with mock dependencies
    app = await startApiServer(
      mockConfig,
      mockBlockchainConnectors,
      mockWalletManager,
      mockFabricClient,
      mockChaincodeManager
    );
    
    // Generate a JWT token for authentication
    token = jwt.sign({ username: 'admin' }, mockConfig.api.auth.jwtSecret, {
      expiresIn: mockConfig.api.auth.expiresIn
    });
  });
  
  describe('Merchant Fee Collection Workflow', () => {
    it('should complete the entire merchant fee collection workflow', async () => {
      // Step 1: Create a custom chaincode from the merchant-fee template
      const createChaincodeResponse = await request(app)
        .post('/api/chaincode/custom')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateId: 'merchant-fee',
          customId: 'my-merchant-fee'
        })
        .expect(200);
      
      expect(createChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(createChaincodeResponse.body).to.have.property('templateId', 'merchant-fee');
      
      // Step 2: Deploy the custom chaincode
      const deployChaincodeResponse = await request(app)
        .post('/api/chaincode/custom/my-custom-chaincode/deploy')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(deployChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(deployChaincodeResponse.body).to.have.property('status', 'deployed');
      
      // Step 3: Create a customer internal wallet
      const createCustomerWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'customer_wallet_1',
          type: 'customer'
        })
        .expect(200);
      
      expect(createCustomerWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(createCustomerWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createCustomerWalletResponse.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Step 4: Create a merchant internal wallet
      const createMerchantWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'merchant_wallet_1',
          type: 'merchant'
        })
        .expect(200);
      
      expect(createMerchantWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(createMerchantWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createMerchantWalletResponse.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Step 5: Create a fee internal wallet
      const createFeeWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'fee_wallet_1',
          type: 'fee'
        })
        .expect(200);
      
      expect(createFeeWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(createFeeWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createFeeWalletResponse.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Step 6: Create a fee configuration
      const createFeeConfigResponse = await request(app)
        .post('/api/fee-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          defaultFeePercentage: 2.5,
          minFeeAmount: 0.0001,
          maxFeeAmount: 0.1,
          merchantSpecificFees: {
            merchant_wallet_1: 2.0
          }
        })
        .expect(200);
      
      expect(createFeeConfigResponse.body).to.have.property('defaultFeePercentage', 2.5);
      expect(createFeeConfigResponse.body).to.have.property('minFeeAmount', 0.0001);
      expect(createFeeConfigResponse.body).to.have.property('maxFeeAmount', 0.1);
      expect(createFeeConfigResponse.body.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.0);
      
      // Step 7: Fund the customer wallet (simulate deposit)
      const fundCustomerWalletResponse = await request(app)
        .post('/api/internal-wallets/customer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1.0
        })
        .expect(200);
      
      expect(fundCustomerWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(fundCustomerWalletResponse.body).to.have.property('balance', 0.5);
      
      // Step 8: Process a merchant transaction
      const processMerchantTransactionResponse = await request(app)
        .post('/api/transactions/merchant')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fromWalletId: 'customer_wallet_1',
          toWalletId: 'merchant_wallet_1',
          feeWalletId: 'fee_wallet_1',
          amount: 0.1
        })
        .expect(200);
      
      expect(processMerchantTransactionResponse.body).to.have.property('id', 'tx_1');
      expect(processMerchantTransactionResponse.body).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('feeWalletId', 'fee_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('amount', 0.1);
      expect(processMerchantTransactionResponse.body).to.have.property('feeAmount', 0.002); // 2% of 0.1
      expect(processMerchantTransactionResponse.body).to.have.property('netAmount', 0.098); // 0.1 - 0.002
      
      // Step 9: Check customer wallet balance
      const customerBalanceResponse = await request(app)
        .get('/api/internal-wallets/customer_wallet_1/balance')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(customerBalanceResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(customerBalanceResponse.body).to.have.property('balance', 0.5);
      
      // Step 10: Check merchant wallet balance
      const merchantBalanceResponse = await request(app)
        .get('/api/internal-wallets/merchant_wallet_1/balance')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(merchantBalanceResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(merchantBalanceResponse.body).to.have.property('balance', 0.5);
      
      // Step 11: Check fee wallet balance
      const feeBalanceResponse = await request(app)
        .get('/api/internal-wallets/fee_wallet_1/balance')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(feeBalanceResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(feeBalanceResponse.body).to.have.property('balance', 0.5);
      
      // Step 12: Withdraw from merchant wallet
      const withdrawResponse = await request(app)
        .post('/api/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalWalletId: 'merchant_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.05
        })
        .expect(200);
      
      expect(withdrawResponse.body).to.have.property('id', 'withdrawal_1');
      expect(withdrawResponse.body).to.have.property('internalWalletId', 'internal_wallet_1');
      expect(withdrawResponse.body).to.have.property('toAddress', 'bc1q...');
      expect(withdrawResponse.body).to.have.property('amount', 0.1);
      expect(withdrawResponse.body).to.have.property('fee', 0.0001);
    });
  });
  
  describe('Employee Payroll Workflow', () => {
    it('should complete the entire employee payroll workflow', async () => {
      // Step 1: Create a custom chaincode from the employee-payroll template
      const createChaincodeResponse = await request(app)
        .post('/api/chaincode/custom')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateId: 'employee-payroll',
          customId: 'my-employee-payroll'
        })
        .expect(200);
      
      expect(createChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(createChaincodeResponse.body).to.have.property('templateId', 'merchant-fee'); // Mock returns this value
      
      // Step 2: Deploy the custom chaincode
      const deployChaincodeResponse = await request(app)
        .post('/api/chaincode/custom/my-custom-chaincode/deploy')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(deployChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(deployChaincodeResponse.body).to.have.property('status', 'deployed');
      
      // Step 3: Create an employer internal wallet
      const createEmployerWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'employer_wallet_1',
          type: 'employer'
        })
        .expect(200);
      
      expect(createEmployerWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(createEmployerWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployerWalletResponse.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Step 4: Create employee internal wallets
      const createEmployee1WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'employee_wallet_1',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee1WalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(createEmployee1WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee1WalletResponse.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      
      // Step 5: Register employees
      const registerEmployeeResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'emp123',
          name: 'John Doe',
          walletId: 'employee_wallet_1',
          salary: 1.0,
          department: 'Engineering',
          position: 'Software Engineer',
          paymentFrequency: 'monthly'
        })
        .expect(200);
      
      expect(registerEmployeeResponse.body).to.have.property('id', 'emp123');
      expect(registerEmployeeResponse.body).to.have.property('name', 'John Doe');
      expect(registerEmployeeResponse.body).to.have.property('walletId', 'employee_wallet_1');
      expect(registerEmployeeResponse.body).to.have.property('salary', 1.0);
      
      // Step 6: Fund the employer wallet (simulate deposit)
      const fundEmployerWalletResponse = await request(app)
        .post('/api/internal-wallets/employer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 10.0
        })
        .expect(200);
      
      expect(fundEmployerWalletResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(fundEmployerWalletResponse.body).to.have.property('balance', 0.5);
      
      // Step 7: Process monthly payroll
      const processPayrollResponse = await request(app)
        .post('/api/payroll/process')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1'
        })
        .expect(200);
      
      expect(processPayrollResponse.body).to.be.an('array');
      expect(processPayrollResponse.body).to.have.lengthOf(1);
      expect(processPayrollResponse.body[0]).to.have.property('employeeId', 'emp123');
      expect(processPayrollResponse.body[0]).to.have.property('amount', 1.0);
      
      // Step 8: Check employee wallet balance
      const employeeBalanceResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_1/balance')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(employeeBalanceResponse.body).to.have.property('id', 'internal_wallet_1');
      expect(employeeBalanceResponse.body).to.have.property('balance', 0.5);
      
      // Step 9: Employee withdraws funds
      const withdrawResponse = await request(app)
        .post('/api/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalWalletId: 'employee_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.5
        })
        .expect(200);
      
      expect(withdrawResponse.body).to.have.property('id', 'withdrawal_1');
      expect(withdrawResponse.body).to.have.property('internalWalletId', 'internal_wallet_1');
      expect(withdrawResponse.body).to.have.property('toAddress', 'bc1q...');
      expect(withdrawResponse.body).to.have.property('amount', 0.1);
      expect(withdrawResponse.body).to.have.property('fee', 0.0001);
    });
  });
});
