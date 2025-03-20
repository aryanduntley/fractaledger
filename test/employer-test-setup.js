/**
 * Employer Test Setup
 * 
 * This file contains the setup code for the employer/employee payroll tests.
 * It exports the necessary objects and functions to be used in the actual test file.
 */

const sinon = require('sinon');
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

// Setup function to initialize the test environment
async function setupEmployerTest() {
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
  
  // Helper function to destroy all wallets and reset blockchain state for a test
  const destroyAllWallets = async () => {
    // Destroy all internal wallets
    internalWallets = {};
    
    // Reset tracking of created wallets
    createdWalletAddresses.clear();
    createdWalletNames.clear();
    
    // Reset the Fabric client's state by clearing all blockchain data
    // This ensures that no data persists between tests
    mockFabricClient.resetBlockchainState = sinon.stub().callsFake(() => {
      // Clear any stored state in the mock Fabric client
      mockFabricClient.blockchainState = {};
      return Promise.resolve(true);
    });
    
    // Call the reset function
    await mockFabricClient.resetBlockchainState();
    
    return true;
  };
  
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
  
  // Add method to fund internal wallets - no fees for employer/employee scenario
  mockWalletManager.fundInternalWallet = sinon.stub().callsFake((internalWalletId, amount) => {
    if (!internalWallets[internalWalletId]) {
      return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
    }
    
    // No fees in employer/employee scenario for internal transfers
    // Use precise decimal arithmetic
    internalWallets[internalWalletId].balance = preciseDecimal(internalWallets[internalWalletId].balance + amount);
    
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
  
  // Helper function for precise decimal arithmetic
  const preciseDecimal = (value, decimalPlaces = 8) => {
    return parseFloat(value.toFixed(decimalPlaces));
  };
  
  mockWalletManager.withdrawFromInternalWallet = sinon.stub().callsFake((internalWalletId, toAddress, amount, fee = 0.0001) => {
    if (!internalWallets[internalWalletId]) {
      return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
    }
    
    const totalDeduction = preciseDecimal(amount + fee);
    
    if (internalWallets[internalWalletId].balance < totalDeduction) {
      return Promise.reject(new Error(`Insufficient balance: ${internalWallets[internalWalletId].balance} < ${totalDeduction}`));
    }
    
    // Update the wallet balance with precise decimal arithmetic
    internalWallets[internalWalletId].balance = preciseDecimal(internalWallets[internalWalletId].balance - amount - fee);
    
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
  
  // Add reconcileBaseInternalWallet method to mock wallet manager
  mockWalletManager.reconcileBaseInternalWallet = sinon.stub().callsFake((blockchain, primaryWalletName) => {
    return Promise.resolve(true);
  });
  
  // Set up mock Fabric client
  mockFabricClient.blockchainState = {}; // Initialize blockchain state storage
  
  mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
    // Track query in blockchain state for debugging
    if (!mockFabricClient.blockchainState[`query_${fcn}`]) {
      mockFabricClient.blockchainState[`query_${fcn}`] = [];
    }
    mockFabricClient.blockchainState[`query_${fcn}`].push(args);
    
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
    // Store transaction in blockchain state for persistence tracking
    if (!mockFabricClient.blockchainState[fcn]) {
      mockFabricClient.blockchainState[fcn] = [];
    }
    mockFabricClient.blockchainState[fcn].push(args);
    
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
      
      const totalDeduction = preciseDecimal(amount + fee);
      
      if (internalWallets[walletId].balance < totalDeduction) {
        throw new Error(`Insufficient balance: ${internalWallets[walletId].balance} < ${totalDeduction}`);
      }
      
      // Update the wallet balance with precise decimal arithmetic
      internalWallets[walletId].balance = preciseDecimal(internalWallets[walletId].balance - amount - fee);
      
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
      
      // Update the wallet balance with precise decimal arithmetic
      internalWallets[walletId].balance = preciseDecimal(newBalance);
      internalWallets[walletId].updatedAt = new Date().toISOString();
      
      return Buffer.from(JSON.stringify(internalWallets[walletId]));
    } else if (fcn === 'processPayroll') {
      const employerWalletId = args[0];
      const payrollDate = args[1];
      
      // Get the employer wallet
      if (!internalWallets[employerWalletId]) {
        throw new Error(`Employer wallet not found: ${employerWalletId}`);
      }
      
      // Get the payroll configuration - check if we have an updated configuration
      let payrollConfig;
      
      if (mockFabricClient.blockchainState['updatePayrollConfiguration'] && 
          mockFabricClient.blockchainState['updatePayrollConfiguration'].length > 0) {
        // Use the most recent payroll configuration
        const latestPayrollConfig = mockFabricClient.blockchainState['updatePayrollConfiguration'][
          mockFabricClient.blockchainState['updatePayrollConfiguration'].length - 1
        ];
        
        payrollConfig = {
          payrollCycle: latestPayrollConfig[0],
          payrollDay: parseInt(latestPayrollConfig[1]),
          employeePayments: JSON.parse(latestPayrollConfig[2])
        };
      } else {
        // Use the default payroll configuration
        payrollConfig = {
          payrollCycle: 'monthly',
          payrollDay: 15,
          employeePayments: {
            employee_wallet_1: 0.5,
            employee_wallet_2: 0.3,
            employee_wallet_3: 0.2
          }
        };
      }
      
      // Calculate the total payroll amount with precise decimal arithmetic
      const totalPayrollAmount = preciseDecimal(
        Object.values(payrollConfig.employeePayments).reduce((sum, amount) => preciseDecimal(sum + amount), 0)
      );
      
      // Check if the employer wallet has enough balance
      if (internalWallets[employerWalletId].balance < totalPayrollAmount) {
        throw new Error(`Insufficient balance: ${internalWallets[employerWalletId].balance} < ${totalPayrollAmount}`);
      }
      
      // Process the payroll - no fees for employer to employee transfers
      const payrollTransactions = [];
      
      for (const [employeeWalletId, amount] of Object.entries(payrollConfig.employeePayments)) {
        // Check if the employee wallet exists
        if (!internalWallets[employeeWalletId]) {
          throw new Error(`Employee wallet not found: ${employeeWalletId}`);
        }
        
        // Update the employer wallet balance - full amount deducted with precise decimal arithmetic
        internalWallets[employerWalletId].balance = preciseDecimal(internalWallets[employerWalletId].balance - amount);
        
        // Update the employee wallet balance - full amount received with precise decimal arithmetic (no fees)
        internalWallets[employeeWalletId].balance = preciseDecimal(internalWallets[employeeWalletId].balance + amount);
        
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
      
      // Update wallet balances with precise decimal arithmetic
      if (internalWallets[fromWalletId]) {
        internalWallets[fromWalletId].balance = preciseDecimal(internalWallets[fromWalletId].balance - amount);
      }
      
      if (internalWallets[toWalletId]) {
        internalWallets[toWalletId].balance = preciseDecimal(internalWallets[toWalletId].balance + amount);
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
  
  // Add method to check for wallet uniqueness
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

  // Return all the necessary objects and functions
  return {
    server,
    app,
    token,
    internalWallets,
    mockConfig,
    createBaseWallet,
    destroyAllWallets,
    mockWalletManager
  };
}

module.exports = {
  setupEmployerTest
};
