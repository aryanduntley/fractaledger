/**
 * API Tests
 * 
 * This file contains tests for the API endpoints.
 */

const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const express = require('express');
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

describe('API', () => {
  let server;
  let app;
  let token;
  let internalWallets = {};
  let primaryWalletBalance = 5.0;
  
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
  
  // Helper function for precise decimal arithmetic
  const preciseDecimal = (value, decimalPlaces = 8) => {
    return parseFloat(value.toFixed(decimalPlaces));
  };
  
  beforeAll(async () => {
    // Set up mock blockchain connectors
    mockBlockchainConnectors.bitcoin = {
      btc_wallet_1: {
        blockchain: 'bitcoin',
        name: 'btc_wallet_1',
        walletAddress: 'bc1q...',
        connectionType: 'spv',
        getBalance: sinon.stub().resolves(primaryWalletBalance),
        getTransactionHistory: sinon.stub().resolves([]),
        sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
        verifyAddress: sinon.stub().resolves(true),
        estimateFee: sinon.stub().resolves(0.0001),
        getBlockchainHeight: sinon.stub().resolves(700000),
        getTransaction: sinon.stub().resolves({}),
        verifyUtxoWallet: sinon.stub().resolves(true),
        config: {
          connectionType: 'spv'
        }
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
    
    mockWalletManager.createInternalWallet = sinon.stub().callsFake((blockchain, primaryWalletName, internalWalletId, metadata = {}) => {
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
    
    // Set up mock Fabric client
    mockFabricClient.blockchainState = {}; // Initialize blockchain state storage
    
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
      }
      
      return Buffer.from('{}');
    });
    
    mockFabricClient.submitTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
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
      }
      
      return Buffer.from('{}');
    });
    
    // Set up mock chaincode manager
    mockChaincodeManager.getAvailableTemplates = sinon.stub().returns([
      {
        id: 'default',
        name: 'fractaledger-chaincode',
        description: 'FractaLedger Chaincode for Hyperledger Fabric',
        readme: '# FractaLedger Default Chaincode Template'
      }
    ]);
    
    mockChaincodeManager.createCustomChaincode = sinon.stub().returns({
      id: 'my-custom-chaincode',
      templateId: 'default',
      path: '/path/to/my-custom-chaincode'
    });
    
    mockChaincodeManager.getCustomChaincodes = sinon.stub().returns([
      {
        id: 'my-custom-chaincode',
        name: 'fractaledger-custom-my-custom-chaincode',
        description: 'FractaLedger Chaincode for Hyperledger Fabric',
        path: '/path/to/my-custom-chaincode'
      }
    ]);
    
    mockChaincodeManager.getCustomChaincode = sinon.stub().returns({
      id: 'my-custom-chaincode',
      name: 'fractaledger-custom-my-custom-chaincode',
      description: 'FractaLedger Chaincode for Hyperledger Fabric',
      path: '/path/to/my-custom-chaincode'
    });
    
    mockChaincodeManager.updateCustomChaincode = sinon.stub().returns({
      id: 'my-custom-chaincode',
      path: '/path/to/my-custom-chaincode',
      updatedFile: 'index.js'
    });
    
    mockChaincodeManager.deleteCustomChaincode = sinon.stub().returns(true);
    
    mockChaincodeManager.deployCustomChaincode = sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'deployed',
      timestamp: new Date().toISOString()
    });
    
    mockChaincodeManager.updateDeployedChaincode = sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'updated',
      timestamp: new Date().toISOString()
    });
    
    mockChaincodeManager.installDependencies = sinon.stub().resolves({
      id: 'my-custom-chaincode',
      status: 'dependencies installed',
      stdout: '',
      stderr: ''
    });
    
    // Start the API server with mock dependencies
    const serverObj = await startApiServer(
      mockConfig,
      mockBlockchainConnectors,
      mockWalletManager,
      mockFabricClient,
      mockChaincodeManager
    );
    
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
    
    // Destroy all wallets after all tests
    await destroyAllWallets();
  });
  
  describe('Health Check', () => {
    it('should return status ok', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).to.deep.equal({ status: 'ok' });
    });
  });
  
  describe('Authentication', () => {
    it('should return a JWT token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password'
        })
        .expect(200);
      
      expect(response.body).to.have.property('token');
    });
    
    it('should return 401 for invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password'
        })
        .expect(401);
    });
  });
  
  describe('Wallet Management', () => {
    it('should get all wallets', async () => {
      const response = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('blockchain', 'bitcoin');
      expect(response.body[0]).to.have.property('name', 'btc_wallet_1');
      expect(mockWalletManager.getAllWallets.calledOnce).to.be.true;
    });
    
    it('should get wallets for a blockchain', async () => {
      const response = await request(app)
        .get('/api/wallets/bitcoin')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('blockchain', 'bitcoin');
      expect(response.body[0]).to.have.property('name', 'btc_wallet_1');
      expect(mockWalletManager.getWalletsForBlockchain.calledOnce).to.be.true;
      expect(mockWalletManager.getWalletsForBlockchain.firstCall.args[0]).to.equal('bitcoin');
    });
    
    it('should get wallet details', async () => {
      const response = await request(app)
        .get('/api/wallets/bitcoin/btc_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('name', 'btc_wallet_1');
      expect(response.body).to.have.property('balance', 5.0);
      expect(mockWalletManager.getWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.getWallet.firstCall.args[1]).to.equal('btc_wallet_1');
    });
  });
  
  describe('Internal Wallet Management', () => {
    beforeEach(async () => {
      // Create and fund an internal wallet for the test
      await mockWalletManager.createInternalWallet('bitcoin', 'btc_wallet_1', 'internal_wallet_1');
      
      // Update the wallet balance directly
      internalWallets['internal_wallet_1'].balance = 0.5;
    });
    
    afterEach(async () => {
      // Destroy all wallets after the test
      await destroyAllWallets();
    });
    
    it('should create an internal wallet', async () => {
      // Reset the wallet first to ensure clean state
      await destroyAllWallets();
      
      // Reset the stubs
      mockWalletManager.createInternalWallet.resetHistory();
      
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'test_wallet_1'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'test_wallet_1');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(mockWalletManager.createInternalWallet.calledOnce).to.be.true;
      expect(mockWalletManager.createInternalWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.createInternalWallet.firstCall.args[1]).to.equal('btc_wallet_1');
      expect(mockWalletManager.createInternalWallet.firstCall.args[2]).to.equal('test_wallet_1');
    });
    
    it('should get all internal wallets', async () => {
      const response = await request(app)
        .get('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('id', 'internal_wallet_1');
      expect(response.body[0]).to.have.property('blockchain', 'bitcoin');
      expect(response.body[0]).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(mockWalletManager.getAllInternalWallets.calledOnce).to.be.true;
    });
    
    it('should get internal wallet details', async () => {
      const response = await request(app)
        .get('/api/internal-wallets/internal_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('id', 'internal_wallet_1');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(mockWalletManager.getInternalWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getInternalWallet.firstCall.args[0]).to.equal('internal_wallet_1');
    });
    
    it('should get internal wallet balance', async () => {
      // Reset the stubs
      mockFabricClient.evaluateTransaction.resetHistory();
      
      const response = await request(app)
        .get('/api/internal-wallets/internal_wallet_1/balance')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('id', 'internal_wallet_1');
      expect(response.body).to.have.property('balance', 0.5);
      expect(mockFabricClient.evaluateTransaction.calledOnce).to.be.true;
      expect(mockFabricClient.evaluateTransaction.firstCall.args[0]).to.equal('getInternalWalletBalance');
      expect(mockFabricClient.evaluateTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
    });
  });
  
  describe('Transactions', () => {
    beforeEach(async () => {
      // Reset all wallets and state
      await destroyAllWallets();
      
      // Create and fund an internal wallet for the test
      await mockWalletManager.createInternalWallet('bitcoin', 'btc_wallet_1', 'internal_wallet_1');
      
      // Update the wallet balance directly
      internalWallets['internal_wallet_1'].balance = 0.5;
      
      // Reset the stubs
      mockWalletManager.getInternalWallet.resetHistory();
      mockWalletManager.getWallet.resetHistory();
      mockFabricClient.submitTransaction.resetHistory();
      
      // Mock the getInternalWalletsByPrimaryWallet method
      mockWalletManager.getInternalWalletsByPrimaryWallet = sinon.stub().callsFake((blockchain, primaryWalletName) => {
        return Promise.resolve(
          Object.values(internalWallets).filter(
            wallet => wallet.blockchain === blockchain && wallet.primaryWalletName === primaryWalletName
          )
        );
      });
      
      // Set up the mock Fabric client for this test
      mockFabricClient.submitTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
        if (fcn === 'withdrawFromInternalWallet') {
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
        }
        
        return Buffer.from('{}');
      });
      
      // Mock the primary wallet's sendTransaction method
      const mockPrimaryWallet = mockWalletManager.getWallet('bitcoin', 'btc_wallet_1');
      mockPrimaryWallet.sendTransaction = sinon.stub().resolves('0x1234567890abcdef');
    });
    
    afterEach(async () => {
      // Destroy all wallets after the test
      await destroyAllWallets();
    });
    
    it('should withdraw from an internal wallet', async () => {
      const response = await request(app)
        .post('/api/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalWalletId: 'internal_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.1
        })
        .expect(200);
      
      expect(response.body).to.have.property('txid', '0x1234567890abcdef');
      expect(response.body).to.have.property('id', 'withdrawal_1');
      expect(response.body).to.have.property('internalWalletId', 'internal_wallet_1');
      expect(response.body).to.have.property('toAddress', 'bc1q...');
      expect(response.body).to.have.property('amount', 0.1);
      expect(response.body).to.have.property('fee', 0.0001);
      expect(mockWalletManager.getInternalWallet.called).to.be.true;
      expect(mockFabricClient.submitTransaction.called).to.be.true;
      expect(mockFabricClient.submitTransaction.firstCall.args[0]).to.equal('withdrawFromInternalWallet');
      expect(mockFabricClient.submitTransaction.firstCall.args[1]).to.equal('internal_wallet_1');
      expect(mockFabricClient.submitTransaction.firstCall.args[2]).to.equal('bc1q...');
      expect(mockFabricClient.submitTransaction.firstCall.args[3]).to.equal('0.1');
    });
  });
  
  describe('Chaincode Management', () => {
    it('should get available templates', async () => {
      const response = await request(app)
        .get('/api/chaincode/templates')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('id', 'default');
      expect(response.body[0]).to.have.property('name', 'fractaledger-chaincode');
      expect(mockChaincodeManager.getAvailableTemplates.calledOnce).to.be.true;
    });
    
    it('should create a custom chaincode', async () => {
      const response = await request(app)
        .post('/api/chaincode/custom')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateId: 'default',
          customId: 'my-custom-chaincode'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'my-custom-chaincode');
      expect(response.body).to.have.property('templateId', 'default');
      expect(mockChaincodeManager.createCustomChaincode.calledOnce).to.be.true;
      expect(mockChaincodeManager.createCustomChaincode.firstCall.args[0]).to.equal('default');
      expect(mockChaincodeManager.createCustomChaincode.firstCall.args[1]).to.equal('my-custom-chaincode');
    });
  });
});
