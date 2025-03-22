/**
 * Test Utilities
 * 
 * This file contains common utilities for testing the FractaLedger system.
 * It provides mock objects and helper functions that can be reused across tests.
 */

const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const { startApiServer } = require('../src/api/server');

/**
 * Helper function for precise decimal arithmetic
 * @param {number} value - The value to format
 * @param {number} decimalPlaces - The number of decimal places to keep
 * @returns {number} - The formatted value
 */
const preciseDecimal = (value, decimalPlaces = 8) => {
  return parseFloat(value.toFixed(decimalPlaces));
};

/**
 * Creates mock blockchain connectors
 * @param {Object} options - Options for creating the mock connectors
 * @param {string} options.blockchain - The blockchain to create connectors for (default: 'bitcoin')
 * @param {string} options.walletName - The wallet name to use (default: 'test_wallet_1')
 * @param {number} options.balance - The wallet balance (default: 10.0)
 * @returns {Object} - The mock blockchain connectors
 */
const createMockBlockchainConnectors = (options = {}) => {
  const {
    blockchain = 'bitcoin',
    walletName = 'test_wallet_1',
    balance = 10.0
  } = options;

  const mockBlockchainConnectors = {};
  
  mockBlockchainConnectors[blockchain] = {
    [walletName]: {
      blockchain,
      name: walletName,
      walletAddress: 'bc1q...',
      connectionType: 'spv',
      getBalance: sinon.stub().resolves(balance),
      getTransactionHistory: sinon.stub().resolves([]),
      sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
      verifyAddress: sinon.stub().resolves(true),
      estimateFee: sinon.stub().resolves(0.0001),
      getBlockchainHeight: sinon.stub().resolves(700000),
      getTransaction: sinon.stub().resolves({ txid: '0x1234567890abcdef' }),
      verifyUtxoWallet: sinon.stub().resolves(true),
      config: {
        connectionType: 'spv'
      }
    }
  };
  
  return mockBlockchainConnectors;
};

/**
 * Creates a mock Fabric client
 * @param {Object} internalWallets - The internal wallets object to use for the mock
 * @returns {Object} - The mock Fabric client
 */
const createMockFabricClient = (internalWallets = {}) => {
  const mockFabricClient = {
    blockchainState: {}, // Initialize blockchain state storage
    
    submitTransaction: sinon.stub().callsFake(async (fcn, ...args) => {
      if (fcn === 'createInternalWallet') {
        const walletId = args[0];
        const blockchain = args[1];
        const primaryWalletName = args[2];
        const metadata = args[3] ? JSON.parse(args[3]) : {};
        
        // Create the internal wallet
        internalWallets[walletId] = {
          id: walletId,
          blockchain,
          primaryWalletName,
          balance: 0,
          metadata,
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
      } else if (fcn === 'updateWithdrawalTransaction') {
        return Buffer.from(JSON.stringify({
          id: args[0],
          txid: args[1],
          status: 'confirmed'
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
    }),
    
    evaluateTransaction: sinon.stub().callsFake(async (fcn, ...args) => {
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
      }
      
      return Buffer.from('[]');
    }),
    
    resetBlockchainState: sinon.stub().callsFake(() => {
      // Clear any stored state in the mock Fabric client
      mockFabricClient.blockchainState = {};
      return Promise.resolve(true);
    }),
    
    contract: true
  };
  
  return mockFabricClient;
};

/**
 * Creates a mock wallet manager
 * @param {Object} options - Options for creating the mock wallet manager
 * @param {Object} options.mockBlockchainConnectors - The mock blockchain connectors
 * @param {Object} options.internalWallets - The internal wallets object
 * @param {Object} options.mockFabricClient - The mock Fabric client
 * @param {Object} options.mockConfig - The mock config
 * @returns {Object} - The mock wallet manager
 */
const createMockWalletManager = (options = {}) => {
  const {
    mockBlockchainConnectors,
    internalWallets = {},
    mockFabricClient,
    mockConfig
  } = options;
  
  // Track created wallets to ensure uniqueness
  const createdWalletAddresses = new Set();
  const createdWalletNames = new Set();
  
  const mockWalletManager = {
    getAllWallets: sinon.stub().returns(
      Object.entries(mockBlockchainConnectors).flatMap(([blockchain, wallets]) => 
        Object.entries(wallets).map(([name, wallet]) => ({
          blockchain,
          name,
          address: wallet.walletAddress,
          connectionType: wallet.connectionType
        }))
      )
    ),
    
    getWalletsForBlockchain: sinon.stub().callsFake((blockchain) => {
      if (!mockBlockchainConnectors[blockchain]) {
        return [];
      }
      
      return Object.entries(mockBlockchainConnectors[blockchain]).map(([name, wallet]) => ({
        blockchain,
        name,
        address: wallet.walletAddress,
        connectionType: wallet.connectionType
      }));
    }),
    
    getWallet: sinon.stub().callsFake((blockchain, name) => {
      if (!mockBlockchainConnectors[blockchain] || !mockBlockchainConnectors[blockchain][name]) {
        return null;
      }
      
      return mockBlockchainConnectors[blockchain][name];
    }),
    
    createInternalWallet: sinon.stub().callsFake((blockchain, primaryWalletName, internalWalletId, metadata = {}) => {
      // Create the internal wallet
      internalWallets[internalWalletId] = {
        id: internalWalletId,
        blockchain,
        primaryWalletName,
        balance: 0,
        metadata: metadata || {},
        createdAt: new Date().toISOString()
      };
      
      return Promise.resolve(internalWallets[internalWalletId]);
    }),
    
    fundInternalWallet: sinon.stub().callsFake((internalWalletId, amount) => {
      if (!internalWallets[internalWalletId]) {
        return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
      }
      
      // Update the wallet balance with precise decimal arithmetic
      internalWallets[internalWalletId].balance = preciseDecimal(internalWallets[internalWalletId].balance + amount);
      
      return Promise.resolve({
        id: internalWalletId,
        balance: internalWallets[internalWalletId].balance
      });
    }),
    
    getAllInternalWallets: sinon.stub().callsFake(() => {
      return Promise.resolve(Object.values(internalWallets));
    }),
    
    getInternalWallet: sinon.stub().callsFake((id) => {
      if (internalWallets[id]) {
        return Promise.resolve(internalWallets[id]);
      }
      return Promise.reject(new Error(`Internal wallet not found: ${id}`));
    }),
    
    getInternalWalletBalance: sinon.stub().callsFake((id) => {
      if (internalWallets[id]) {
        return Promise.resolve(internalWallets[id].balance);
      }
      return Promise.reject(new Error(`Internal wallet not found: ${id}`));
    }),
    
    withdrawFromInternalWallet: sinon.stub().callsFake(async (internalWalletId, toAddress, amount, fee = 0.0001) => {
      if (!internalWallets[internalWalletId]) {
        return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
      }
      
      const totalDeduction = preciseDecimal(amount + fee);
      
      // Check if this is an internal wallet withdrawal
      if (internalWallets[internalWalletId].balance < totalDeduction) {
        return Promise.reject(new Error(`Insufficient balance in internal wallet including fee: ${internalWallets[internalWalletId].balance} < ${totalDeduction}`));
      }
      
      // Get the primary wallet info
      const blockchain = internalWallets[internalWalletId].blockchain;
      const primaryWalletName = internalWallets[internalWalletId].primaryWalletName;
      const primaryWallet = mockBlockchainConnectors[blockchain][primaryWalletName];
      
      // Check if the primary wallet has sufficient balance
      const primaryWalletBalance = await primaryWallet.getBalance();
      if (primaryWalletBalance < amount) {
        return Promise.reject(new Error(`Insufficient balance in primary wallet: ${primaryWalletBalance} < ${amount}`));
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
    }),
    
    getInternalWalletsByPrimaryWallet: sinon.stub().callsFake((blockchain, primaryWalletName) => {
      return Promise.resolve(
        Object.values(internalWallets).filter(
          wallet => wallet.blockchain === blockchain && wallet.primaryWalletName === primaryWalletName
        )
      );
    }),
    
    updateInternalWalletBalance: sinon.stub().callsFake((internalWalletId, amount) => {
      if (!internalWallets[internalWalletId]) {
        return Promise.reject(new Error(`Internal wallet not found: ${internalWalletId}`));
      }
      
      // Check if this is a base internal wallet
      if (internalWallets[internalWalletId].metadata && internalWallets[internalWalletId].metadata.isBaseWallet) {
        return Promise.reject(new Error(`Cannot directly update the balance of a base internal wallet: ${internalWalletId}`));
      }
      
      // Update the wallet balance with precise decimal arithmetic
      internalWallets[internalWalletId].balance = preciseDecimal(amount);
      internalWallets[internalWalletId].updatedAt = new Date().toISOString();
      
      return Promise.resolve({
        id: internalWalletId,
        balance: internalWallets[internalWalletId].balance,
        updatedAt: internalWallets[internalWalletId].updatedAt
      });
    }),
    
    reconcileBaseInternalWallet: sinon.stub().callsFake((blockchain, primaryWalletName) => {
      return Promise.resolve(true);
    }),
    
    checkWalletUniqueness: sinon.stub().callsFake((blockchain, name, address) => {
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
    }),
    
    // Base wallet methods
    createBaseInternalWallet: sinon.stub().callsFake(async (blockchain, primaryWalletName) => {
      const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
      
      // Check if the base wallet already exists
      if (internalWallets[baseWalletId]) {
        return internalWallets[baseWalletId];
      }
      
      // Create the base internal wallet
      await mockFabricClient.submitTransaction(
        'createInternalWallet',
        baseWalletId,
        blockchain,
        primaryWalletName,
        JSON.stringify({ isBaseWallet: true, description: mockConfig.baseInternalWallet.description })
      );
      
      return internalWallets[baseWalletId];
    }),
    
    getWalletReadOnly: sinon.stub().callsFake(async (blockchain, primaryWalletName) => {
      // Get the primary wallet
      const primaryWallet = mockWalletManager.getWallet(blockchain, primaryWalletName);
      if (!primaryWallet) {
        throw new Error(`Primary wallet not found: ${blockchain}/${primaryWalletName}`);
      }
      
      // Get the on-chain balance
      const onChainBalance = await primaryWallet.getBalance();
      
      // Get all internal wallets for this primary wallet
      const wallets = await mockFabricClient.evaluateTransaction(
        'getInternalWalletsByPrimaryWallet',
        blockchain,
        primaryWalletName
      ).then(buffer => JSON.parse(buffer.toString()));
      
      // Calculate aggregate internal balance - exclude base wallet
      const aggregateInternalBalance = wallets
        .filter(wallet => !(wallet.metadata && wallet.metadata.isBaseWallet))
        .reduce((sum, wallet) => sum + wallet.balance, 0);
      
      // Calculate excess balance
      const excessBalance = onChainBalance - aggregateInternalBalance;
      
      // Find the base internal wallet
      const baseInternalWallet = wallets.find(wallet => wallet.metadata && wallet.metadata.isBaseWallet);
      
      return {
        blockchain,
        name: primaryWalletName,
        address: primaryWallet.walletAddress,
        connectionType: primaryWallet.config.connectionType,
        balance: onChainBalance,
        aggregateInternalBalance,
        excessBalance,
        baseInternalWalletId: baseInternalWallet ? baseInternalWallet.id : null
      };
    }),
    
    withdrawFromBaseInternalWallet: sinon.stub().callsFake(async (blockchain, primaryWalletName, toAddress, amount) => {
      // Get the base internal wallet ID
      const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
      
      // Get the base internal wallet
      const baseWalletBuffer = await mockFabricClient.evaluateTransaction('getInternalWallet', baseWalletId);
      const baseWallet = JSON.parse(baseWalletBuffer.toString());
      
      if (!baseWallet || baseWallet === 'null') {
        throw new Error(`Base internal wallet not found: ${baseWalletId}`);
      }
      
      // Verify the base wallet has sufficient balance
      if (baseWallet.balance < amount) {
        throw new Error(`Insufficient balance in base wallet: ${baseWallet.balance} < ${amount}`);
      }
      
      // Estimate the fee
      const primaryWallet = mockWalletManager.getWallet(blockchain, primaryWalletName);
      const fee = await primaryWallet.estimateFee(toAddress, amount);
      
      // Verify the base wallet has sufficient balance including the fee
      if (baseWallet.balance < amount + fee) {
        throw new Error(`Insufficient balance in base wallet including fee: ${baseWallet.balance} < ${amount + fee}`);
      }
      
      // Perform the withdrawal
      const result = await mockFabricClient.submitTransaction(
        'withdrawFromInternalWallet',
        baseWalletId,
        toAddress,
        amount.toString(),
        fee.toString()
      );
      
      // Mock the transaction being sent
      await primaryWallet.sendTransaction(toAddress, amount);
      
      return JSON.parse(result.toString());
    })
  };
  
  return mockWalletManager;
};

/**
 * Creates a mock chaincode manager
 * @returns {Object} - The mock chaincode manager
 */
const createMockChaincodeManager = () => {
  return {
    getAvailableTemplates: sinon.stub().returns([
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
        description: 'Chaincode template for employee payroll distribution'
      }
    ]),
    
    createCustomChaincode: sinon.stub().returns({
      id: 'my-custom-chaincode',
      templateId: 'default',
      path: '/path/to/my-custom-chaincode'
    }),
    
    deployCustomChaincode: sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'deployed',
      timestamp: new Date().toISOString()
    })
  };
};

/**
 * Creates a default mock config
 * @returns {Object} - The mock config
 */
const createMockConfig = () => {
  return {
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
      namePrefix: 'base_wallet_',
      description: 'Represents excess funds in the primary on-chain wallet',
      createOnInitialization: false
    },
    bitcoin: [
      {
        name: 'test_wallet_1',
        walletAddress: 'bc1q...',
        connectionType: 'spv'
      }
    ]
  };
};

/**
 * Helper function to destroy all wallets and reset blockchain state
 * @param {Object} internalWallets - The internal wallets object
 * @param {Object} mockFabricClient - The mock Fabric client
 * @returns {Promise<boolean>} - True if successful
 */
const destroyAllWallets = async (internalWallets, mockFabricClient) => {
  // Clear the internal wallets object
  for (const key in internalWallets) {
    delete internalWallets[key];
  }
  
  // Reset the Fabric client's state
  await mockFabricClient.resetBlockchainState();
  
  return true;
};

/**
 * Helper function to create a base wallet
 * @param {Object} options - Options for creating the base wallet
 * @param {string} options.blockchain - The blockchain to create the wallet for
 * @param {string} options.primaryWalletName - The primary wallet name
 * @param {Object} options.internalWallets - The internal wallets object
 * @param {Object} options.mockConfig - The mock config
 * @returns {Promise<Object>} - The created base wallet
 */
const createBaseWallet = async (options) => {
  const {
    blockchain,
    primaryWalletName,
    internalWallets,
    mockConfig
  } = options;
  
  const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${blockchain}_${primaryWalletName}`;
  
  // Create the base wallet
  internalWallets[baseWalletId] = {
    id: baseWalletId,
    blockchain,
    primaryWalletName,
    balance: 0.0,
    metadata: { isBaseWallet: true },
    createdAt: new Date().toISOString()
  };
  
  return internalWallets[baseWalletId];
};

/**
 * Sets up a test environment with mock objects
 * @param {Object} options - Options for setting up the test environment
 * @param {string} options.blockchain - The blockchain to use (default: 'bitcoin')
 * @param {string} options.walletName - The wallet name to use (default: 'test_wallet_1')
 * @param {number} options.balance - The wallet balance (default: 10.0)
 * @param {Array} options.extensions - API extensions to register
 * @returns {Promise<Object>} - The test environment
 */
const setupTestEnvironment = async (options = {}) => {
  const {
    blockchain = 'bitcoin',
    walletName = 'test_wallet_1',
    balance = 10.0,
    extensions = []
  } = options;
  
  // Create internal wallets object
  const internalWallets = {};
  
  // Create mock objects
  const mockConfig = createMockConfig();
  const mockBlockchainConnectors = createMockBlockchainConnectors({
    blockchain,
    walletName,
    balance
  });
  const mockFabricClient = createMockFabricClient(internalWallets);
  const mockChaincodeManager = createMockChaincodeManager();
  
  // Create mock wallet manager
  const mockWalletManager = createMockWalletManager({
    mockBlockchainConnectors,
    internalWallets,
    mockFabricClient,
    mockConfig
  });
  
  // Start the API server with mock dependencies
  const server = await startApiServer(
    mockConfig,
    mockBlockchainConnectors,
    mockWalletManager,
    mockFabricClient,
    mockChaincodeManager
  );
  
  // Register API extensions
  for (const extension of extensions) {
    server.registerExtension(extension);
  }
  
  // Generate a JWT token for authentication
  const token = jwt.sign({ username: 'admin' }, mockConfig.api.auth.jwtSecret, {
    expiresIn: mockConfig.api.auth.expiresIn
  });
  
  // Return the test environment
  return {
    server,
    app: server.app,
    token,
    internalWallets,
    mockConfig,
    mockBlockchainConnectors,
    mockFabricClient,
    mockChaincodeManager,
    mockWalletManager,
    createBaseWallet: (blockchain, primaryWalletName) => createBaseWallet({
      blockchain,
      primaryWalletName,
      internalWallets,
      mockConfig
    }),
    destroyAllWallets: () => destroyAllWallets(internalWallets, mockFabricClient)
  };
};

module.exports = {
  preciseDecimal,
  createMockBlockchainConnectors,
  createMockFabricClient,
  createMockWalletManager,
  createMockChaincodeManager,
  createMockConfig,
  destroyAllWallets,
  createBaseWallet,
  setupTestEnvironment
};
