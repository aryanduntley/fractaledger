/**
 * End-to-End Employer/Employee Payroll Tests
 * 
 * This file contains end-to-end tests for the FractaLedger employer/employee payroll scenario,
 * demonstrating how to test the complete workflow from wallet registration to
 * payroll distribution.
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
  },
  baseInternalWallet: {
    namePrefix: 'base_wallet_'
  }
};

// Import the API server module
const { startApiServer } = require('../src/api/server');

// Import the API extensions
const employeePayrollExtension = require('../api-extensions/employee-payroll-extension');

describe('End-to-End Employer/Employee Payroll Tests', () => {
  let server;
  let app;
  let token;
  
  let internalWallets = {};
  let primaryWalletBalance = 15.0; // Higher balance to accommodate all tests

  // Track created wallets to ensure uniqueness
  const createdWalletAddresses = new Set();
  const createdWalletNames = new Set();
  
  // Helper function to create a base wallet
  const createBaseWallet = async (blockchain, primaryWalletName) => {
    const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
    
    // Create the base wallet
    internalWallets[baseWalletId] = {
      id: baseWalletId,
      blockchain,
      primaryWalletName,
      balance: 0.0,
      isBaseWallet: true,
      createdAt: new Date().toISOString()
    };
    
    return internalWallets[baseWalletId];
  };
  
  // Helper function to destroy all wallets for a test
  const destroyAllWallets = async () => {
    // Destroy all internal wallets
    internalWallets = {};
    
    // Reset tracking of created wallets
    createdWalletAddresses.clear();
    createdWalletNames.clear();
    
    return true;
  };
  
  beforeEach(async () => {
    // Completely destroy all wallets before each test to prevent persistence
    await destroyAllWallets();
    
    // Add mock methods to check for wallet uniqueness
    mockWalletManager.checkWalletUniqueness = sinon.stub().callsFake((blockchain, name, address) => {
      const nameKey = `${blockchain}:${name}`;
      const addressKey = `${blockchain}:${address}`;
      
      if (createdWalletNames.has(nameKey)) {
        throw new Error(`Wallet with name ${name} already exists for blockchain ${blockchain}`);
      }
      
      if (createdWalletAddresses.has(addressKey)) {
        throw new Error(`Wallet with address ${address} already exists for blockchain ${blockchain}`);
      }
      
      createdWalletNames.add(nameKey);
      createdWalletAddresses.add(addressKey);
      
      return true;
    });
    
    // Add method to destroy wallets
    mockWalletManager.destroyWallet = sinon.stub().callsFake((blockchain, name) => {
      const nameKey = `${blockchain}:${name}`;
      createdWalletNames.delete(nameKey);
      
      // Also remove any internal wallets associated with this primary wallet
      Object.keys(internalWallets).forEach(walletId => {
        if (internalWallets[walletId].blockchain === blockchain && 
            internalWallets[walletId].primaryWalletName === name) {
          delete internalWallets[walletId];
        }
      });
      
      return Promise.resolve(true);
    });
    
    // Add method to destroy internal wallets
    mockWalletManager.destroyInternalWallet = sinon.stub().callsFake((walletId) => {
      if (internalWallets[walletId]) {
        delete internalWallets[walletId];
        return Promise.resolve(true);
      }
      return Promise.reject(new Error(`Internal wallet not found: ${walletId}`));
    });
    
    // Add method to destroy all internal wallets for a blockchain
    mockWalletManager.destroyAllInternalWallets = sinon.stub().callsFake((blockchain) => {
      Object.keys(internalWallets).forEach(walletId => {
        if (internalWallets[walletId].blockchain === blockchain) {
          delete internalWallets[walletId];
        }
      });
      return Promise.resolve(true);
    });
  });

  beforeAll(async () => {
    // Set up mock blockchain connectors
    mockBlockchainConnectors.bitcoin = {
      // Base wallet for employer/employee payroll scenario
      base_employer_wallet: {
        blockchain: 'bitcoin',
        name: 'base_employer_wallet',
        walletAddress: 'bc1q...',
        connectionType: 'spv',
        getBalance: sinon.stub().resolves(primaryWalletBalance),
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
        name: 'base_employer_wallet',
        address: 'bc1q...',
        connectionType: 'spv'
      }
    ]);
    
    mockWalletManager.getWalletsForBlockchain = sinon.stub().returns([
      {
        blockchain: 'bitcoin',
        name: 'base_employer_wallet',
        address: 'bc1q...',
        connectionType: 'spv'
      }
    ]);
    
    mockWalletManager.getWallet = sinon.stub().callsFake((blockchain, name) => {
      return {
        blockchain: 'bitcoin',
        name: name,
        address: 'bc1q...',
        connectionType: 'spv',
        getBalance: sinon.stub().resolves(primaryWalletBalance),
        getTransactionHistory: sinon.stub().resolves([]),
        sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
        verifyAddress: sinon.stub().resolves(true),
        estimateFee: sinon.stub().resolves(0.0001),
        getBlockchainHeight: sinon.stub().resolves(700000),
        getTransaction: sinon.stub().resolves({})
      };
    });
    
    mockWalletManager.createInternalWallet = sinon.stub().callsFake((blockchain, primaryWalletName, internalWalletId) => {
      // Create the internal wallet
      internalWallets[internalWalletId] = {
        id: internalWalletId,
        blockchain,
        primaryWalletName,
        balance: 0,
        createdAt: new Date().toISOString()
      };
      
      return Promise.resolve(internalWallets[internalWalletId]);
    });
    
    // Add method to fund internal wallets
    mockWalletManager.fundInternalWallet = sinon.stub().callsFake((internalWalletId, amount) => {
      if (!internalWallets[internalWalletId]) {
        return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
      }
      
      // No fee for employer wallet
      internalWallets[internalWalletId].balance += amount;
      
      return Promise.resolve({
        id: internalWalletId,
        balance: internalWallets[internalWalletId].balance
      });
    });
    
    mockWalletManager.getAllInternalWallets = sinon.stub().callsFake(() => {
      return Promise.resolve(Object.values(internalWallets));
    });
    
    mockWalletManager.getInternalWallet = sinon.stub().callsFake((id) => {
      if (internalWallets[id]) {
        return Promise.resolve(internalWallets[id]);
      }
      return Promise.reject(new Error(`Internal wallet not found: ${id}`));
    });
    
    mockWalletManager.getInternalWalletBalance = sinon.stub().callsFake((id) => {
      if (internalWallets[id]) {
        return Promise.resolve(internalWallets[id].balance);
      }
      return Promise.reject(new Error(`Internal wallet not found: ${id}`));
    });
    
    mockWalletManager.withdrawFromInternalWallet = sinon.stub().callsFake((internalWalletId, toAddress, amount, fee = 0.0001) => {
      if (!internalWallets[internalWalletId]) {
        return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
      }
      
      if (internalWallets[internalWalletId].balance < amount + fee) {
        return Promise.reject(new Error(`Insufficient balance: ${internalWallets[internalWalletId].balance} < ${amount + fee}`));
      }
      
      // Update the wallet balance
      internalWallets[internalWalletId].balance -= (amount + fee);
      
      return Promise.resolve({
        id: 'withdrawal_1',
        internalWalletId,
        toAddress,
        amount,
        fee,
        timestamp: new Date().toISOString()
      });
    });
    
    mockWalletManager.getInternalWalletsByPrimaryWallet = sinon.stub().callsFake((blockchain, primaryWalletName) => {
      return Promise.resolve(
        Object.values(internalWallets).filter(
          wallet => wallet.blockchain === blockchain && wallet.primaryWalletName === primaryWalletName
        )
      );
    });
    
    // Set up mock Fabric client
    mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
      if (fcn === 'getInternalWallet') {
        const walletId = args[0];
        if (internalWallets[walletId]) {
          return Buffer.from(JSON.stringify(internalWallets[walletId]));
        }
        throw new Error(`Internal wallet not found: ${walletId}`);
      } else if (fcn === 'getAllInternalWallets') {
        return Buffer.from(JSON.stringify(Object.values(internalWallets)));
      } else if (fcn === 'getInternalWalletBalance') {
        const walletId = args[0];
        if (internalWallets[walletId]) {
          return Buffer.from(JSON.stringify({
            id: walletId,
            balance: internalWallets[walletId].balance
          }));
        }
        throw new Error(`Internal wallet not found: ${walletId}`);
      } else if (fcn === 'getInternalWalletsByPrimaryWallet') {
        const blockchain = args[0];
        const primaryWalletName = args[1];
        const filteredWallets = Object.values(internalWallets).filter(
          wallet => wallet.blockchain === blockchain && wallet.primaryWalletName === primaryWalletName
        );
        return Buffer.from(JSON.stringify(filteredWallets));
      } else if (fcn === 'getPayrollConfiguration') {
        return Buffer.from(JSON.stringify({
          payrollCycle: 'monthly',
          payrollDay: 15,
          employeePayments: {
            employee_wallet_1: 0.5,
            employee_wallet_2: 0.3,
            employee_wallet_3: 0.2
          }
        }));
      }
      
      return Buffer.from('{}');
    });
    
    mockFabricClient.submitTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
      if (fcn === 'createInternalWallet') {
        const walletId = args[0];
        const blockchain = args[1];
        const primaryWalletName = args[2];
        
        // Create the internal wallet
        internalWallets[walletId] = {
          id: walletId,
          blockchain,
          primaryWalletName,
          balance: 0,
          createdAt: new Date().toISOString()
        };
        
        return Buffer.from(JSON.stringify(internalWallets[walletId]));
      } else if (fcn === 'withdrawFromInternalWallet') {
        const walletId = args[0];
        const toAddress = args[1];
        const amount = parseFloat(args[2]);
        const fee = parseFloat(args[3] || 0.0001);
        
        if (!internalWallets[walletId]) {
          throw new Error(`Internal wallet not found: ${walletId}`);
        }
        
        if (internalWallets[walletId].balance < amount + fee) {
          throw new Error(`Insufficient balance: ${internalWallets[walletId].balance} < ${amount + fee}`);
        }
        
        // Update the wallet balance
        internalWallets[walletId].balance -= (amount + fee);
        
        return Buffer.from(JSON.stringify({
          id: 'withdrawal_1',
          internalWalletId: walletId,
          toAddress,
          amount,
          fee,
          timestamp: new Date().toISOString()
        }));
      } else if (fcn === 'updateInternalWalletBalance') {
        const walletId = args[0];
        const newBalance = parseFloat(args[1]);
        
        if (!internalWallets[walletId]) {
          throw new Error(`Internal wallet not found: ${walletId}`);
        }
        
        // Update the wallet balance
        internalWallets[walletId].balance = newBalance;
        internalWallets[walletId].updatedAt = new Date().toISOString();
        
        return Buffer.from(JSON.stringify(internalWallets[walletId]));
      } else if (fcn === 'processPayroll') {
        const employerWalletId = args[0];
        const payrollDate = args[1];
        
        // Get the employer wallet
        if (!internalWallets[employerWalletId]) {
          throw new Error(`Employer wallet not found: ${employerWalletId}`);
        }
        
        // Get the payroll configuration
        const payrollConfig = {
          payrollCycle: 'monthly',
          payrollDay: 15,
          employeePayments: {
            employee_wallet_1: 0.5,
            employee_wallet_2: 0.3,
            employee_wallet_3: 0.2
          }
        };
        
        // Calculate the total payroll amount
        const totalPayrollAmount = Object.values(payrollConfig.employeePayments).reduce((sum, amount) => sum + amount, 0);
        
        // Check if the employer wallet has enough balance
        if (internalWallets[employerWalletId].balance < totalPayrollAmount) {
          throw new Error(`Insufficient balance: ${internalWallets[employerWalletId].balance} < ${totalPayrollAmount}`);
        }
        
        // Process the payroll
        const payrollTransactions = [];
        
        for (const [employeeWalletId, amount] of Object.entries(payrollConfig.employeePayments)) {
          // Check if the employee wallet exists
          if (!internalWallets[employeeWalletId]) {
            throw new Error(`Employee wallet not found: ${employeeWalletId}`);
          }
          
          // Update the employer wallet balance
          internalWallets[employerWalletId].balance -= amount;
          
          // Update the employee wallet balance
          internalWallets[employeeWalletId].balance += amount;
          
          // Add the transaction to the payroll
          payrollTransactions.push({
            id: `payroll_tx_${employeeWalletId}`,
            fromWalletId: employerWalletId,
            toWalletId: employeeWalletId,
            amount,
            timestamp: new Date().toISOString()
          });
        }
        
        return Buffer.from(JSON.stringify({
          id: `payroll_${payrollDate}`,
          employerWalletId,
          payrollDate,
          totalAmount: totalPayrollAmount,
          transactions: payrollTransactions,
          timestamp: new Date().toISOString()
        }));
      } else if (fcn === 'updatePayrollConfiguration') {
        return Buffer.from(JSON.stringify({
          payrollCycle: args[0],
          payrollDay: parseInt(args[1]),
          employeePayments: JSON.parse(args[2]),
          updatedAt: new Date().toISOString()
        }));
      } else if (fcn === 'transferBetweenInternalWallets') {
        const fromWalletId = args[0];
        const toWalletId = args[1];
        const amount = parseFloat(args[2]);
        
        // Update wallet balances
        if (internalWallets[fromWalletId]) {
          internalWallets[fromWalletId].balance -= amount;
        }
        
        if (internalWallets[toWalletId]) {
          internalWallets[toWalletId].balance += amount;
        }
        
        return Buffer.from(JSON.stringify({
          id: 'transfer_1',
          fromWalletId,
          toWalletId,
          amount,
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
        id: 'employee-payroll',
        name: 'Employee Payroll Template',
        description: 'Chaincode template for employee payroll distribution'
      }
    ]);
    
    mockChaincodeManager.createCustomChaincode = sinon.stub().returns({
      id: 'my-custom-chaincode',
      templateId: 'employee-payroll',
      path: '/path/to/my-custom-chaincode'
    });
    
    mockChaincodeManager.deployCustomChaincode = sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'deployed',
      timestamp: new Date().toISOString()
    });
    
    // Start the API server with mock dependencies
    const serverObj = await startApiServer(
      mockConfig,
      mockBlockchainConnectors,
      mockWalletManager,
      mockFabricClient,
      mockChaincodeManager
    );
    
    // Register the API extension
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
  
  describe('Employee Payroll Workflow', () => {
    beforeEach(async () => {
      // Create base wallet for employer/employee payroll scenario
      await createBaseWallet('bitcoin', 'base_employer_wallet');
    });
    
    afterEach(async () => {
      // Destroy all wallets after the test
      await destroyAllWallets();
    });
    
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
      expect(createChaincodeResponse.body).to.have.property('templateId', 'employee-payroll');
      
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
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employer_wallet_1',
          type: 'employer'
        })
        .expect(200);
      
      expect(createEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(createEmployerWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployerWalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      // Step 4: Create employee internal wallets
      const createEmployee1WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_1',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee1WalletResponse.body).to.have.property('id', 'employee_wallet_1');
      expect(createEmployee1WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee1WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      const createEmployee2WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_2',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee2WalletResponse.body).to.have.property('id', 'employee_wallet_2');
      expect(createEmployee2WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee2WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      const createEmployee3WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_3',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee3WalletResponse.body).to.have.property('id', 'employee_wallet_3');
      expect(createEmployee3WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee3WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      // Step 5: Create a payroll configuration
      const createPayrollConfigResponse = await request(app)
        .post('/api/payroll-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payrollCycle: 'monthly',
          payrollDay: 15,
          employeePayments: {
            employee_wallet_1: 0.5,
            employee_wallet_2: 0.3,
            employee_wallet_3: 0.2
          }
        })
        .expect(200);
      
      expect(createPayrollConfigResponse.body).to.have.property('payrollCycle', 'monthly');
      expect(createPayrollConfigResponse.body).to.have.property('payrollDay', 15);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_1', 0.5);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_2', 0.3);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_3', 0.2);
      
      // Step 6: Fund the employer wallet
      const fundEmployerWalletResponse = await request(app)
        .post('/api/internal-wallets/employer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 2.0
        })
        .expect(200);
      
      expect(fundEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(fundEmployerWalletResponse.body).to.have.property('balance', 2.0);
      
      // Step 7: Process the payroll
      const processPayrollResponse = await request(app)
        .post('/api/process-payroll')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1',
          payrollDate: '2025-03-15'
        })
        .expect(200);
      
      expect(processPayrollResponse.body).to.have.property('id', 'payroll_2025-03-15');
      expect(processPayrollResponse.body).to.have.property('employerWalletId', 'employer_wallet_1');
      expect(processPayrollResponse.body).to.have.property('payrollDate', '2025-03-15');
      expect(processPayrollResponse.body).to.have.property('totalAmount', 1.0); // 0.5 + 0.3 + 0.2
      expect(processPayrollResponse.body.transactions).to.be.an('array');
      expect(processPayrollResponse.body.transactions).to.have.lengthOf(3);
      
      // Step 8: Verify the wallet balances after the payroll
      const getEmployerWalletResponse = await request(app)
        .get('/api/internal-wallets/employer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(getEmployerWalletResponse.body).to.have.property('balance', 1.0); // 2.0 - 1.0
      
      const getEmployee1WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1WalletResponse.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1WalletResponse.body).to.have.property('balance', 0.5);
      
      const getEmployee2WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee2WalletResponse.body).to.have.property('id', 'employee_wallet_2');
      expect(getEmployee2WalletResponse.body).to.have.property('balance', 0.3);
      
      const getEmployee3WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee3WalletResponse.body).to.have.property('id', 'employee_wallet_3');
      expect(getEmployee3WalletResponse.body).to.have.property('balance', 0.2);
      
      // Step 9: Update the payroll configuration
      const updatePayrollConfigResponse = await request(app)
        .put('/api/payroll-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payrollCycle: 'biweekly',
          payrollDay: 1,
          employeePayments: {
            employee_wallet_1: 0.25,
            employee_wallet_2: 0.15,
            employee_wallet_3: 0.1
          }
        })
        .expect(200);
      
      expect(updatePayrollConfigResponse.body).to.have.property('payrollCycle', 'biweekly');
      expect(updatePayrollConfigResponse.body).to.have.property('payrollDay', 1);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_1', 0.25);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_2', 0.15);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_3', 0.1);
      
      // Step 10: Process another payroll with the updated configuration
      const processPayroll2Response = await request(app)
        .post('/api/process-payroll')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1',
          payrollDate: '2025-04-01'
        })
        .expect(200);
      
      expect(processPayroll2Response.body).to.have.property('id', 'payroll_2025-04-01');
      expect(processPayroll2Response.body).to.have.property('employerWalletId', 'employer_wallet_1');
      expect(processPayroll2Response.body).to.have.property('payrollDate', '2025-04-01');
      expect(processPayroll2Response.body).to.have.property('totalAmount', 0.5); // 0.25 + 0.15 + 0.1
      expect(processPayroll2Response.body.transactions).to.be.an('array');
      expect(processPayroll2Response.body.transactions).to.have.lengthOf(3);
      
      // Step 11: Verify the wallet balances after the second payroll
      const getEmployerWallet2Response = await request(app)
        .get('/api/internal-wallets/employer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployerWallet2Response.body).to.have.property('id', 'employer_wallet_1');
      expect(getEmployerWallet2Response.body).to.have.property('balance', 0.5); // 1.0 - 0.5
      
      const getEmployee1Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1Wallet2Response.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1Wallet2Response.body).to.have.property('balance', 0.75); // 0.5 + 0.25
      
      const getEmployee2Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee2Wallet2Response.body).to.have.property('id', 'employee_wallet_2');
      expect(getEmployee2Wallet2Response.body).to.have.property('balance', 0.45); // 0.3 + 0.15
      
      const getEmployee3Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee3Wallet2Response.body).to.have.property('id', 'employee_wallet_3');
      expect(getEmployee3Wallet2Response.body).to.have.property('balance', 0.3); // 0.2 + 0.1
      
      // Step 12: Employee withdraws funds to an external address
      const withdrawResponse = await request(app)
        .post('/api/internal-wallets/employee_wallet_1/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          toAddress: 'bc1q...',
          amount: 0.5,
          fee: 0.0001
        })
        .expect(200);
      
      expect(withdrawResponse.body).to.have.property('id', 'withdrawal_1');
      expect(withdrawResponse.body).to.have.property('internalWalletId', 'employee_wallet_1');
      expect(withdrawResponse.body).to.have.property('toAddress', 'bc1q...');
      expect(withdrawResponse.body).to.have.property('amount', 0.5);
      expect(withdrawResponse.body).to.have.property('fee', 0.0001);
      
      // Step 13: Verify the employee wallet balance after withdrawal
      const getEmployee1Wallet3Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1Wallet3Response.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1Wallet3Response.body).to.have.property('balance', 0.2499); // 0.75 - 0.5 - 0.0001
    });
  });
});
