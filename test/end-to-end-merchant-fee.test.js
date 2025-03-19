/**
 * End-to-End Merchant Fee Tests
 * 
 * This file contains end-to-end tests for the FractaLedger merchant fee scenario,
 * demonstrating how to test the complete workflow from wallet registration to
 * transaction processing with fee collection.
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
const merchantFeeExtension = require('../api-extensions/merchant-fee-extension');

describe('End-to-End Merchant Fee Tests', () => {
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
      // Base wallet for merchant fee scenario
      base_merchant_wallet: {
        blockchain: 'bitcoin',
        name: 'base_merchant_wallet',
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
        name: 'base_merchant_wallet',
        address: 'bc1q...',
        connectionType: 'spv'
      }
    ]);
    
    mockWalletManager.getWalletsForBlockchain = sinon.stub().returns([
      {
        blockchain: 'bitcoin',
        name: 'base_merchant_wallet',
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
      
      // Apply fee for customer_wallet_1 in the merchant fee test
      if (internalWalletId === 'customer_wallet_1') {
        // Apply 1% fee for customer wallet
        const feePercentage = 0.01;
        const feeAmount = amount * feePercentage;
        const netAmount = amount - feeAmount;
        
        // Update the wallet balance
        internalWallets[internalWalletId].balance += netAmount;
        
        // Add fee to base wallet
        const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}${internalWallets[internalWalletId].blockchain}_${internalWallets[internalWalletId].primaryWalletName}`;
        if (internalWallets[baseWalletId]) {
          internalWallets[baseWalletId].balance += feeAmount;
        }
      } else {
        // No fee for other wallets
        internalWallets[internalWalletId].balance += amount;
      }
      
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
      } else if (fcn === 'getFeeConfiguration') {
        return Buffer.from(JSON.stringify({
          defaultFeePercentage: 2.5,
          minFeeAmount: 0.0001,
          maxFeeAmount: 0.1,
          merchantSpecificFees: {
            merchant_wallet_1: 2.0
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
      } else if (fcn === 'processMerchantTransaction') {
        const fromWalletId = args[0];
        const toWalletId = args[1];
        const feeWalletId = args[2];
        const amount = parseFloat(args[3]);
        
        // Calculate fee (2% for merchant_wallet_1)
        const feeAmount = amount * 0.02;
        const netAmount = amount - feeAmount;
        
        // Update wallet balances
        if (internalWallets[fromWalletId]) {
          internalWallets[fromWalletId].balance -= amount;
        }
        
        if (internalWallets[toWalletId]) {
          internalWallets[toWalletId].balance += netAmount;
        }
        
        if (internalWallets[feeWalletId]) {
          internalWallets[feeWalletId].balance += feeAmount;
        }
        
        return Buffer.from(JSON.stringify({
          id: 'tx_1',
          fromWalletId,
          toWalletId,
          feeWalletId,
          amount,
          feeAmount,
          netAmount,
          timestamp: new Date().toISOString()
        }));
      } else if (fcn === 'updateFeeConfiguration') {
        return Buffer.from(JSON.stringify({
          defaultFeePercentage: parseFloat(args[0]),
          minFeeAmount: parseFloat(args[1]),
          maxFeeAmount: parseFloat(args[2]),
          merchantSpecificFees: JSON.parse(args[3]),
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
        id: 'merchant-fee',
        name: 'Merchant Fee Template',
        description: 'Chaincode template for merchant fee collection'
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
    const serverObj = await startApiServer(
      mockConfig,
      mockBlockchainConnectors,
      mockWalletManager,
      mockFabricClient,
      mockChaincodeManager
    );
    
    // Register the API extension
    serverObj.registerExtension(merchantFeeExtension);
    
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
  
  describe('Merchant Fee Collection Workflow', () => {
    beforeEach(async () => {
      // Create base wallet for merchant fee scenario
      await createBaseWallet('bitcoin', 'base_merchant_wallet');
    });
    
    afterEach(async () => {
      // Destroy all wallets after the test
      await destroyAllWallets();
    });
    
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
          primaryWalletName: 'base_merchant_wallet',
          internalWalletId: 'customer_wallet_1',
          type: 'customer'
        })
        .expect(200);
      
      expect(createCustomerWalletResponse.body).to.have.property('id', 'customer_wallet_1');
      expect(createCustomerWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createCustomerWalletResponse.body).to.have.property('primaryWalletName', 'base_merchant_wallet');
      
      // Step 4: Create a merchant internal wallet
      const createMerchantWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_merchant_wallet',
          internalWalletId: 'merchant_wallet_1',
          type: 'merchant'
        })
        .expect(200);
      
      expect(createMerchantWalletResponse.body).to.have.property('id', 'merchant_wallet_1');
      expect(createMerchantWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createMerchantWalletResponse.body).to.have.property('primaryWalletName', 'base_merchant_wallet');
      
      // Step 5: Create a fee internal wallet
      const createFeeWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_merchant_wallet',
          internalWalletId: 'fee_wallet_1',
          type: 'fee'
        })
        .expect(200);
      
      expect(createFeeWalletResponse.body).to.have.property('id', 'fee_wallet_1');
      expect(createFeeWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createFeeWalletResponse.body).to.have.property('primaryWalletName', 'base_merchant_wallet');
      
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
      
      // Step 7: Fund the customer wallet (simulate deposit with 1% fee)
      // When 1.0 is added, 0.01 (1%) goes to base wallet, 0.99 (99%) goes to customer wallet
      const fundCustomerWalletResponse = await request(app)
        .post('/api/internal-wallets/customer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1.0
        })
        .expect(200);
      
      expect(fundCustomerWalletResponse.body).to.have.property('id', 'customer_wallet_1');
      expect(fundCustomerWalletResponse.body).to.have.property('balance', 0.99); // 99% of 1.0 after fee
      
      // Verify the base wallet balance
      const baseWalletId = `${mockConfig.baseInternalWallet.namePrefix}bitcoin_base_merchant_wallet`;
      const getBaseWalletResponse = await request(app)
        .get(`/api/internal-wallets/${baseWalletId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getBaseWalletResponse.body).to.have.property('id', baseWalletId);
      expect(getBaseWalletResponse.body).to.have.property('balance', 0.01); // 1% fee
      
      // Step 8: Process a merchant transaction (customer pays merchant with 2% fee)
      const processMerchantTransactionResponse = await request(app)
        .post('/api/merchant-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fromWalletId: 'customer_wallet_1',
          toWalletId: 'merchant_wallet_1',
          feeWalletId: 'fee_wallet_1',
          amount: 0.5
        })
        .expect(200);
      
      expect(processMerchantTransactionResponse.body).to.have.property('id', 'tx_1');
      expect(processMerchantTransactionResponse.body).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('feeWalletId', 'fee_wallet_1');
      expect(processMerchantTransactionResponse.body).to.have.property('amount', 0.5);
      expect(processMerchantTransactionResponse.body).to.have.property('feeAmount', 0.01); // 2% of 0.5
      expect(processMerchantTransactionResponse.body).to.have.property('netAmount', 0.49); // 0.5 - 0.01
      
      // Step 9: Verify the wallet balances after the transaction
      const getCustomerWalletResponse = await request(app)
        .get('/api/internal-wallets/customer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getCustomerWalletResponse.body).to.have.property('id', 'customer_wallet_1');
      expect(getCustomerWalletResponse.body).to.have.property('balance', 0.49); // 0.99 - 0.5
      
      const getMerchantWalletResponse = await request(app)
        .get('/api/internal-wallets/merchant_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getMerchantWalletResponse.body).to.have.property('id', 'merchant_wallet_1');
      expect(getMerchantWalletResponse.body).to.have.property('balance', 0.49); // 0.5 - 0.01
      
      const getFeeWalletResponse = await request(app)
        .get('/api/internal-wallets/fee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getFeeWalletResponse.body).to.have.property('id', 'fee_wallet_1');
      expect(getFeeWalletResponse.body).to.have.property('balance', 0.01); // 2% fee
      
      // Step 10: Update the fee configuration
      const updateFeeConfigResponse = await request(app)
        .put('/api/fee-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          defaultFeePercentage: 3.0,
          minFeeAmount: 0.0002,
          maxFeeAmount: 0.2,
          merchantSpecificFees: {
            merchant_wallet_1: 2.5
          }
        })
        .expect(200);
      
      expect(updateFeeConfigResponse.body).to.have.property('defaultFeePercentage', 3.0);
      expect(updateFeeConfigResponse.body).to.have.property('minFeeAmount', 0.0002);
      expect(updateFeeConfigResponse.body).to.have.property('maxFeeAmount', 0.2);
      expect(updateFeeConfigResponse.body.merchantSpecificFees).to.have.property('merchant_wallet_1', 2.5);
      
      // Step 11: Process another merchant transaction with the updated fee
      const processMerchantTransaction2Response = await request(app)
        .post('/api/merchant-transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fromWalletId: 'customer_wallet_1',
          toWalletId: 'merchant_wallet_1',
          feeWalletId: 'fee_wallet_1',
          amount: 0.2
        })
        .expect(200);
      
      expect(processMerchantTransaction2Response.body).to.have.property('id', 'tx_1');
      expect(processMerchantTransaction2Response.body).to.have.property('fromWalletId', 'customer_wallet_1');
      expect(processMerchantTransaction2Response.body).to.have.property('toWalletId', 'merchant_wallet_1');
      expect(processMerchantTransaction2Response.body).to.have.property('feeWalletId', 'fee_wallet_1');
      expect(processMerchantTransaction2Response.body).to.have.property('amount', 0.2);
      expect(processMerchantTransaction2Response.body).to.have.property('feeAmount', 0.005); // 2.5% of 0.2
      expect(processMerchantTransaction2Response.body).to.have.property('netAmount', 0.195); // 0.2 - 0.005
      
      // Step 12: Verify the wallet balances after the second transaction
      const getCustomerWallet2Response = await request(app)
        .get('/api/internal-wallets/customer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getCustomerWallet2Response.body).to.have.property('id', 'customer_wallet_1');
      expect(getCustomerWallet2Response.body).to.have.property('balance', 0.29); // 0.49 - 0.2
      
      const getMerchantWallet2Response = await request(app)
        .get('/api/internal-wallets/merchant_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getMerchantWallet2Response.body).to.have.property('id', 'merchant_wallet_1');
      expect(getMerchantWallet2Response.body).to.have.property('balance', 0.685); // 0.49 + 0.195
      
      const getFeeWallet2Response = await request(app)
        .get('/api/internal-wallets/fee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getFeeWallet2Response.body).to.have.property('id', 'fee_wallet_1');
      expect(getFeeWallet2Response.body).to.have.property('balance', 0.015); // 0.01 + 0.005
      
      // Step 13: Withdraw from the merchant wallet to an external address
      const withdrawResponse = await request(app)
        .post('/api/internal-wallets/merchant_wallet_1/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          toAddress: 'bc1q...',
          amount: 0.5,
          fee: 0.0001
        })
        .expect(200);
      
      expect(withdrawResponse.body).to.have.property('id', 'withdrawal_1');
      expect(withdrawResponse.body).to.have.property('internalWalletId', 'merchant_wallet_1');
      expect(withdrawResponse.body).to.have.property('toAddress', 'bc1q...');
      expect(withdrawResponse.body).to.have.property('amount', 0.5);
      expect(withdrawResponse.body).to.have.property('fee', 0.0001);
      
      // Step 14: Verify the merchant wallet balance after withdrawal
      const getMerchantWallet3Response = await request(app)
        .get('/api/internal-wallets/merchant_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getMerchantWallet3Response.body).to.have.property('id', 'merchant_wallet_1');
      expect(getMerchantWallet3Response.body).to.have.property('balance', 0.1849); // 0.685 - 0.5 - 0.0001
    });
  });
});
