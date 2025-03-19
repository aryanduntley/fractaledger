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
const mockBlockchainConnectors = {
  bitcoin: {
    btc_wallet_1: {
      getBalance: sinon.stub().resolves(1.5),
      getTransactionHistory: sinon.stub().resolves([]),
      sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
      verifyAddress: sinon.stub().resolves(true),
      estimateFee: sinon.stub().resolves(0.0001),
      getBlockchainHeight: sinon.stub().resolves(700000),
      getTransaction: sinon.stub().resolves({}),
      verifyUtxoWallet: sinon.stub().resolves(true),
      walletAddress: 'bc1q...',
      config: {
        connectionType: 'spv'
      }
    }
  }
};

const mockWalletManager = {
  getAllWallets: sinon.stub().returns([
    {
      blockchain: 'bitcoin',
      name: 'btc_wallet_1',
      address: 'bc1q...',
      connectionType: 'spv'
    }
  ]),
  getWalletsForBlockchain: sinon.stub().returns([
    {
      blockchain: 'bitcoin',
      name: 'btc_wallet_1',
      address: 'bc1q...',
      connectionType: 'spv'
    }
  ]),
  getWallet: sinon.stub().returns({
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
  }),
  createInternalWallet: sinon.stub().resolves({
    id: 'internal_wallet_1',
    blockchain: 'bitcoin',
    primaryWalletName: 'btc_wallet_1',
    balance: 0,
    createdAt: new Date().toISOString()
  }),
  getAllInternalWallets: sinon.stub().resolves([
    {
      id: 'internal_wallet_1',
      blockchain: 'bitcoin',
      primaryWalletName: 'btc_wallet_1',
      balance: 0.5,
      createdAt: new Date().toISOString()
    }
  ]),
  getInternalWallet: sinon.stub().resolves({
    id: 'internal_wallet_1',
    blockchain: 'bitcoin',
    primaryWalletName: 'btc_wallet_1',
    balance: 0.5,
    createdAt: new Date().toISOString()
  })
};

const mockFabricClient = {
  evaluateTransaction: sinon.stub().resolves(Buffer.from(JSON.stringify({
    id: 'internal_wallet_1',
    balance: 0.5
  }))),
  submitTransaction: sinon.stub().resolves(Buffer.from(JSON.stringify({
    id: 'withdrawal_1',
    internalWalletId: 'internal_wallet_1',
    toAddress: 'bc1q...',
    amount: 0.1,
    fee: 0.0001,
    timestamp: new Date().toISOString()
  })))
};

const mockChaincodeManager = {
  getAvailableTemplates: sinon.stub().returns([
    {
      id: 'default',
      name: 'fractaledger-chaincode',
      description: 'FractaLedger Chaincode for Hyperledger Fabric',
      readme: '# FractaLedger Default Chaincode Template'
    }
  ]),
  createCustomChaincode: sinon.stub().returns({
    id: 'my-custom-chaincode',
    templateId: 'default',
    path: '/path/to/my-custom-chaincode'
  }),
  getCustomChaincodes: sinon.stub().returns([
    {
      id: 'my-custom-chaincode',
      name: 'fractaledger-custom-my-custom-chaincode',
      description: 'FractaLedger Chaincode for Hyperledger Fabric',
      path: '/path/to/my-custom-chaincode'
    }
  ]),
  getCustomChaincode: sinon.stub().returns({
    id: 'my-custom-chaincode',
    name: 'fractaledger-custom-my-custom-chaincode',
    description: 'FractaLedger Chaincode for Hyperledger Fabric',
    path: '/path/to/my-custom-chaincode'
  }),
  updateCustomChaincode: sinon.stub().returns({
    id: 'my-custom-chaincode',
    path: '/path/to/my-custom-chaincode',
    updatedFile: 'index.js'
  }),
  deleteCustomChaincode: sinon.stub().returns(true),
  deployCustomChaincode: sinon.stub().resolves({
    id: 'my-custom-chaincode',
    status: 'deployed',
    timestamp: new Date().toISOString()
  }),
  updateDeployedChaincode: sinon.stub().resolves({
    id: 'my-custom-chaincode',
    status: 'updated',
    timestamp: new Date().toISOString()
  }),
  installDependencies: sinon.stub().resolves({
    id: 'my-custom-chaincode',
    status: 'dependencies installed',
    stdout: '',
    stderr: ''
  })
};

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

describe('API', () => {
  let server;
  let app;
  let token;
  
  beforeAll(async () => {
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
      expect(response.body).to.have.property('balance', 1.5);
      expect(mockWalletManager.getWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.getWallet.firstCall.args[1]).to.equal('btc_wallet_1');
    });
  });
  
  describe('Internal Wallet Management', () => {
    it('should create an internal wallet', async () => {
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'internal_wallet_1'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'internal_wallet_1');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(mockWalletManager.createInternalWallet.calledOnce).to.be.true;
      expect(mockWalletManager.createInternalWallet.firstCall.args[0]).to.equal('bitcoin');
      expect(mockWalletManager.createInternalWallet.firstCall.args[1]).to.equal('btc_wallet_1');
      expect(mockWalletManager.createInternalWallet.firstCall.args[2]).to.equal('internal_wallet_1');
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
    it('should withdraw from an internal wallet', async () => {
      // Reset the stubs
      mockWalletManager.getInternalWallet.resetHistory();
      mockWalletManager.getWallet.resetHistory();
      mockFabricClient.submitTransaction.resetHistory();
      
      const response = await request(app)
        .post('/api/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          internalWalletId: 'internal_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.1
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'withdrawal_1');
      expect(response.body).to.have.property('internalWalletId', 'internal_wallet_1');
      expect(response.body).to.have.property('toAddress', 'bc1q...');
      expect(response.body).to.have.property('amount', 0.1);
      expect(response.body).to.have.property('fee', 0.0001);
      expect(mockWalletManager.getInternalWallet.calledOnce).to.be.true;
      expect(mockWalletManager.getInternalWallet.firstCall.args[0]).to.equal('internal_wallet_1');
      expect(mockWalletManager.getWallet.calledOnce).to.be.true;
      expect(mockFabricClient.submitTransaction.calledOnce).to.be.true;
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
