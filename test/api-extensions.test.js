/**
 * API Extensions Tests
 * 
 * This file demonstrates how to use API extensions with the end-to-end tests.
 * It shows how to register and use the merchant-fee and employee-payroll extensions.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Import the API server module
const { startApiServer } = require('../src/api/server');

// Import the API extensions
const merchantFeeExtension = require('../api-extensions/merchant-fee-extension');
const employeePayrollExtension = require('../api-extensions/employee-payroll-extension');

// Mock dependencies
const mockBlockchainConnectors = {};
const mockWalletManager = {};
const mockFabricClient = {};
const mockChaincodeManager = {};
const mockBalanceReconciliation = {};

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
  },
  baseInternalWallet: {
    namePrefix: 'base_wallet_'
  }
};

describe('API Extensions Tests', () => {
  let server;
  let app;
  let token;
  
  beforeAll(async () => {
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
    
    mockWalletManager.getInternalWalletsByPrimaryWallet = sinon.stub().resolves([
      {
        id: 'internal_wallet_1',
        blockchain: 'bitcoin',
        primaryWalletName: 'btc_wallet_1',
        balance: 0.5,
        createdAt: new Date().toISOString()
      }
    ]);
    
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
      } else if (fcn === 'getFeeConfiguration') {
        return Buffer.from(JSON.stringify({
          defaultFeePercentage: 2.5,
          minimumFee: 0.0001,
          maximumFee: 0.1,
          merchantSpecificFees: {
            merchant_wallet_1: 2.0
          }
        }));
      } else if (fcn === 'getAllEmployees') {
        return Buffer.from(JSON.stringify([
          {
            id: 'emp123',
            name: 'John Doe',
            walletId: 'employee_wallet_1',
            salary: 1.0,
            department: 'Engineering',
            position: 'Software Engineer',
            paymentFrequency: 'monthly'
          }
        ]));
      } else if (fcn === 'getEmployee') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          name: 'John Doe',
          walletId: 'employee_wallet_1',
          salary: 1.0,
          department: 'Engineering',
          position: 'Software Engineer',
          paymentFrequency: 'monthly'
        }));
      } else if (fcn === 'getEmployeePaymentHistory') {
        return Buffer.from(JSON.stringify([
          {
            id: 'payment_1',
            employeeId: args[0],
            amount: 1.0,
            timestamp: new Date().toISOString()
          }
        ]));
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
      } else if (fcn === 'updateFeeConfiguration') {
        return Buffer.from(JSON.stringify({
          defaultFeePercentage: parseFloat(args[0]),
          minimumFee: parseFloat(args[1]),
          maximumFee: parseFloat(args[2]),
          merchantSpecificFees: JSON.parse(args[3]),
          updatedAt: new Date().toISOString()
        }));
      } else if (fcn === 'registerEmployee') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          name: args[1],
          walletId: args[2],
          salary: parseFloat(args[3]),
          department: args[4],
          position: args[5],
          startDate: args[6],
          paymentFrequency: args[7],
          metadata: JSON.parse(args[8]),
          createdAt: new Date().toISOString()
        }));
      } else if (fcn === 'updateEmployeeInfo') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          name: args[1],
          walletId: args[2],
          salary: parseFloat(args[3]),
          department: args[4],
          position: args[5],
          paymentFrequency: args[6],
          status: args[7],
          metadata: JSON.parse(args[8]),
          updatedAt: new Date().toISOString()
        }));
      } else if (fcn === 'deactivateEmployee') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          status: 'inactive',
          updatedAt: new Date().toISOString()
        }));
      } else if (fcn === 'processMonthlyPayroll') {
        return Buffer.from(JSON.stringify({
          id: 'payroll_1',
          employerId: args[0],
          totalAmount: 1.0,
          employeeCount: 1,
          timestamp: new Date().toISOString(),
          payments: [
            {
              employeeId: 'emp123',
              amount: 1.0,
              timestamp: new Date().toISOString()
            }
          ]
        }));
      } else if (fcn === 'processIndividualPayment') {
        return Buffer.from(JSON.stringify({
          id: 'payment_1',
          employerId: args[0],
          employeeId: args[1],
          amount: args[2] ? parseFloat(args[2]) : 1.0,
          paymentType: args[3] || 'regular',
          timestamp: new Date().toISOString()
        }));
      } else if (fcn === 'transferBetweenInternalWallets') {
        return Buffer.from(JSON.stringify({
          id: 'transfer_1',
          fromWalletId: args[0],
          toWalletId: args[1],
          amount: parseFloat(args[2]),
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
    
    // Set up mock balance reconciliation
    mockBalanceReconciliation.getConfig = sinon.stub().returns({
      strategy: 'afterTransaction',
      scheduledFrequency: 3600000,
      warningThreshold: 0.00001,
      strictMode: false
    });
    
    mockBalanceReconciliation.reconcileWallet = sinon.stub().resolves({
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      onChainBalance: 1.5,
      aggregateInternalBalance: 1.5,
      difference: 0,
      hasDiscrepancy: false,
      timestamp: new Date().toISOString()
    });
    
    mockBalanceReconciliation.performFullReconciliation = sinon.stub().resolves([
      {
        blockchain: 'bitcoin',
        primaryWalletName: 'btc_wallet_1',
        onChainBalance: 1.5,
        aggregateInternalBalance: 1.5,
        difference: 0,
        hasDiscrepancy: false,
        timestamp: new Date().toISOString()
      }
    ]);
    
    // Start the API server with mock dependencies
    const serverObj = await startApiServer(
      mockConfig,
      mockBlockchainConnectors,
      mockWalletManager,
      mockFabricClient,
      mockChaincodeManager,
      mockBalanceReconciliation
    );
    
    // Register the API extensions
    serverObj.registerExtension(merchantFeeExtension);
    serverObj.registerExtension(employeePayrollExtension);
    
    server = serverObj;
    app = serverObj.app;
    
    // Generate a JWT token for authentication
    token = jwt.sign({ username: 'admin' }, mockConfig.api.auth.jwtSecret, {
      expiresIn: mockConfig.api.auth.expiresIn
    });
  });
  
  afterAll(async () => {
    // Close the server after all tests are done
    if (server && server.close) {
      await server.close();
    }
  });
  
  describe('Merchant Fee Extension', () => {
    it('should create a fee configuration', async () => {
      const response = await request(app)
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
      
      expect(response.body).to.have.property('defaultFeePercentage', 2.5);
      expect(response.body).to.have.property('minimumFee', 0.0001);
      expect(response.body).to.have.property('maximumFee', 0.1);
      expect(response.body.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.0);
    });
    
    it('should get fee configuration', async () => {
      const response = await request(app)
        .get('/api/fee-config')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('defaultFeePercentage', 2.5);
      expect(response.body).to.have.property('minimumFee', 0.0001);
      expect(response.body).to.have.property('maximumFee', 0.1);
      expect(response.body.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.0);
    });
    
    it('should fund an internal wallet', async () => {
      const response = await request(app)
        .post('/api/internal-wallets/customer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1.0
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'internal_wallet_1');
      expect(response.body).to.have.property('balance', 1.5);
    });
    
    it('should process a merchant transaction', async () => {
      const response = await request(app)
        .post('/api/transactions/merchant')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fromWalletId: 'customer_wallet_1',
          toWalletId: 'merchant_wallet_1',
          feeWalletId: 'fee_wallet_1',
          amount: 0.1
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'tx_1');
      expect(response.body).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(response.body).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(response.body).to.have.property('feeWalletId', 'fee_wallet_1');
      expect(response.body).to.have.property('amount', 0.1);
      expect(response.body).to.have.property('feeAmount', 0.002);
      expect(response.body).to.have.property('netAmount', 0.098);
    });
  });
  
  describe('Employee Payroll Extension', () => {
    it('should register an employee', async () => {
      const response = await request(app)
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
      
      expect(response.body).to.have.property('id', 'emp123');
      expect(response.body).to.have.property('name', 'John Doe');
      expect(response.body).to.have.property('walletId', 'employee_wallet_1');
      expect(response.body).to.have.property('salary', 1.0);
    });
    
    it('should get all employees', async () => {
      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('id', 'emp123');
      expect(response.body[0]).to.have.property('name', 'John Doe');
      expect(response.body[0]).to.have.property('walletId', 'employee_wallet_1');
      expect(response.body[0]).to.have.property('salary', 1.0);
    });
    
    it('should get an employee', async () => {
      const response = await request(app)
        .get('/api/employees/emp123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('id', 'emp123');
      expect(response.body).to.have.property('name', 'John Doe');
      expect(response.body).to.have.property('walletId', 'employee_wallet_1');
      expect(response.body).to.have.property('salary', 1.0);
    });
    
    it('should update an employee', async () => {
      const response = await request(app)
        .put('/api/employees/emp123')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'John Doe',
          walletId: 'employee_wallet_1',
          salary: 1.5,
          department: 'Engineering',
          position: 'Senior Software Engineer',
          paymentFrequency: 'monthly'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'emp123');
      expect(response.body).to.have.property('name', 'John Doe');
      expect(response.body).to.have.property('walletId', 'employee_wallet_1');
      expect(response.body).to.have.property('salary', 1.5);
      expect(response.body).to.have.property('position', 'Senior Software Engineer');
    });
    
    it('should deactivate an employee', async () => {
      const response = await request(app)
        .post('/api/employees/emp123/deactivate')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('id', 'emp123');
      expect(response.body).to.have.property('status', 'inactive');
    });
    
    it('should fund an employer wallet', async () => {
      const response = await request(app)
        .post('/api/internal-wallets/employer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 10.0
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'internal_wallet_1');
      expect(response.body).to.have.property('balance', 10.5);
    });
    
    it('should process payroll', async () => {
      const response = await request(app)
        .post('/api/payroll/process')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1'
        })
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('employeeId', 'emp123');
      expect(response.body[0]).to.have.property('amount', 1.0);
    });
    
    it('should process individual payment', async () => {
      const response = await request(app)
        .post('/api/payroll/individual-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1',
          employeeId: 'emp123',
          amount: 0.5,
          paymentType: 'bonus'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'payment_1');
      expect(response.body).to.have.property('employerId', 'employer_wallet_1');
      expect(response.body).to.have.property('employeeId', 'emp123');
      expect(response.body).to.have.property('amount', 0.5);
      expect(response.body).to.have.property('paymentType', 'bonus');
    });
    
    it('should get employee payment history', async () => {
      const response = await request(app)
        .get('/api/employees/emp123/payment-history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('id', 'payment_1');
      expect(response.body[0]).to.have.property('employeeId', 'emp123');
      expect(response.body[0]).to.have.property('amount', 1.0);
    });
  });
});
