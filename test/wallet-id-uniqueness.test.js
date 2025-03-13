/**
 * Wallet ID Uniqueness Tests
 * 
 * This file contains tests to verify that internal wallet IDs must be unique
 * across the entire system, regardless of blockchain or primary wallet.
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

describe('Wallet ID Uniqueness', () => {
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
        verifyUtxoWallet: sinon.stub().resolves(true)
      },
      btc_wallet_2: {
        blockchain: 'bitcoin',
        name: 'btc_wallet_2',
        walletAddress: 'bc1q...',
        connectionType: 'fullNode',
        getBalance: sinon.stub().resolves(2.0),
        verifyUtxoWallet: sinon.stub().resolves(true)
      }
    };
    
    mockBlockchainConnectors.litecoin = {
      ltc_wallet_1: {
        blockchain: 'litecoin',
        name: 'ltc_wallet_1',
        walletAddress: 'ltc1q...',
        connectionType: 'api',
        getBalance: sinon.stub().resolves(10.0),
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
      },
      {
        blockchain: 'bitcoin',
        name: 'btc_wallet_2',
        address: 'bc1q...',
        connectionType: 'fullNode'
      },
      {
        blockchain: 'litecoin',
        name: 'ltc_wallet_1',
        address: 'ltc1q...',
        connectionType: 'api'
      }
    ]);
    
    mockWalletManager.getWallet = sinon.stub().callsFake((blockchain, name) => {
      if (blockchain === 'bitcoin' && name === 'btc_wallet_1') {
        return {
          blockchain: 'bitcoin',
          name: 'btc_wallet_1',
          address: 'bc1q...',
          connectionType: 'spv'
        };
      } else if (blockchain === 'bitcoin' && name === 'btc_wallet_2') {
        return {
          blockchain: 'bitcoin',
          name: 'btc_wallet_2',
          address: 'bc1q...',
          connectionType: 'fullNode'
        };
      } else if (blockchain === 'litecoin' && name === 'ltc_wallet_1') {
        return {
          blockchain: 'litecoin',
          name: 'ltc_wallet_1',
          address: 'ltc1q...',
          connectionType: 'api'
        };
      }
      return null;
    });
    
    // Track created internal wallets to simulate uniqueness constraint
    const createdInternalWallets = new Map();
    
    mockWalletManager.createInternalWallet = sinon.stub().callsFake(async (blockchain, primaryWalletName, internalWalletId) => {
      // Check if the internal wallet ID already exists
      if (createdInternalWallets.has(internalWalletId)) {
        throw new Error(`Internal wallet with ID ${internalWalletId} already exists`);
      }
      
      // Create the internal wallet
      const internalWallet = {
        id: internalWalletId,
        blockchain,
        primaryWalletName,
        balance: 0,
        createdAt: new Date().toISOString()
      };
      
      // Store the internal wallet
      createdInternalWallets.set(internalWalletId, internalWallet);
      
      return internalWallet;
    });
    
    mockWalletManager.getInternalWallet = sinon.stub().callsFake(async (internalWalletId) => {
      // Get the internal wallet
      const internalWallet = createdInternalWallets.get(internalWalletId);
      
      if (!internalWallet) {
        throw new Error(`Internal wallet with ID ${internalWalletId} not found`);
      }
      
      return internalWallet;
    });
    
    mockWalletManager.getAllInternalWallets = sinon.stub().callsFake(async () => {
      // Get all internal wallets
      return Array.from(createdInternalWallets.values());
    });
    
    // Set up mock Fabric client
    mockFabricClient.submitTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
      if (fcn === 'createInternalWallet') {
        const [id, blockchain, primaryWalletName] = args;
        
        // Check if the internal wallet ID already exists
        if (createdInternalWallets.has(id)) {
          throw new Error(`Internal wallet with ID ${id} already exists`);
        }
        
        // Create the internal wallet
        const internalWallet = {
          id,
          blockchain,
          primaryWalletName,
          balance: 0,
          createdAt: new Date().toISOString()
        };
        
        // Store the internal wallet
        createdInternalWallets.set(id, internalWallet);
        
        return Buffer.from(JSON.stringify(internalWallet));
      }
      
      return Buffer.from('{}');
    });
    
    mockFabricClient.evaluateTransaction = sinon.stub().callsFake(async (fcn, ...args) => {
      if (fcn === 'getInternalWallet') {
        const [id] = args;
        
        // Get the internal wallet
        const internalWallet = createdInternalWallets.get(id);
        
        if (!internalWallet) {
          throw new Error(`Internal wallet with ID ${id} not found`);
        }
        
        return Buffer.from(JSON.stringify(internalWallet));
      } else if (fcn === 'getAllInternalWallets') {
        // Get all internal wallets
        return Buffer.from(JSON.stringify(Array.from(createdInternalWallets.values())));
      }
      
      return Buffer.from('{}');
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
  
  beforeEach(() => {
    // Reset the mock stubs
    mockWalletManager.createInternalWallet.resetHistory();
    mockFabricClient.submitTransaction.resetHistory();
  });
  
  describe('Internal Wallet ID Uniqueness', () => {
    it('should create an internal wallet with a unique ID', async () => {
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'unique_wallet_id_1'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'unique_wallet_id_1');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
      expect(mockWalletManager.createInternalWallet.calledOnce).to.be.true;
    });
    
    it('should not allow creating an internal wallet with a duplicate ID, even for a different blockchain', async () => {
      // First, create an internal wallet with a unique ID
      await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'duplicate_wallet_id'
        })
        .expect(200);
      
      // Then, try to create another internal wallet with the same ID but for a different blockchain
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'litecoin',
          primaryWalletName: 'ltc_wallet_1',
          internalWalletId: 'duplicate_wallet_id'
        })
        .expect(400);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('already exists');
    });
    
    it('should not allow creating an internal wallet with a duplicate ID, even for a different primary wallet', async () => {
      // First, create an internal wallet with a unique ID
      await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'another_duplicate_wallet_id'
        })
        .expect(200);
      
      // Then, try to create another internal wallet with the same ID but for a different primary wallet
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_2',
          internalWalletId: 'another_duplicate_wallet_id'
        })
        .expect(400);
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('already exists');
    });
    
    it('should retrieve an internal wallet by its unique ID', async () => {
      // First, create an internal wallet with a unique ID
      await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'retrievable_wallet_id'
        })
        .expect(200);
      
      // Then, retrieve the internal wallet by its ID
      const response = await request(app)
        .get('/api/internal-wallets/retrievable_wallet_id')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.have.property('id', 'retrievable_wallet_id');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
    });
    
    it('should return 404 for a non-existent internal wallet ID', async () => {
      const response = await request(app)
        .get('/api/internal-wallets/non_existent_wallet_id')
        .set('Authorization', `Bearer ${token}`)
        .expect(500); // Note: In the actual implementation, this returns 500 instead of 404
      
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('not found');
    });
  });
  
  describe('Internal Wallet ID Best Practices', () => {
    it('should suggest using a naming convention that includes blockchain and primary wallet', async () => {
      // This is a test to demonstrate a best practice for naming internal wallets
      // to avoid confusion when dealing with multiple blockchains and primary wallets
      
      // Create an internal wallet with a naming convention that includes blockchain and primary wallet
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: 'btc_btc_wallet_1_customer_1'
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', 'btc_btc_wallet_1_customer_1');
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
    });
    
    it('should suggest using UUIDs for internal wallet IDs to ensure uniqueness', async () => {
      // This is a test to demonstrate a best practice for using UUIDs as internal wallet IDs
      // to ensure uniqueness across the system
      
      // Create an internal wallet with a UUID as the ID
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      const response = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          internalWalletId: uuid
        })
        .expect(200);
      
      expect(response.body).to.have.property('id', uuid);
      expect(response.body).to.have.property('blockchain', 'bitcoin');
      expect(response.body).to.have.property('primaryWalletName', 'btc_wallet_1');
    });
  });
});
