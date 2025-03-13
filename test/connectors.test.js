/**
 * Blockchain Connectors Tests
 * 
 * This file contains tests for all blockchain connector types.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BlockchainConnector } = require('../src/blockchain/blockchainConnector');
const { SpvConnector } = require('../src/blockchain/connectors/spvConnector');
const { FullNodeConnector } = require('../src/blockchain/connectors/fullNodeConnector');
const { ApiConnector } = require('../src/blockchain/connectors/apiConnector');

describe('Blockchain Connectors', () => {
  describe('BlockchainConnector', () => {
    it('should be an abstract class that cannot be instantiated directly', () => {
      expect(() => new BlockchainConnector('bitcoin', {})).to.throw(
        'BlockchainConnector is an abstract class and cannot be instantiated directly'
      );
    });
  });
  
  describe('SpvConnector', () => {
    let connector;
    let config;
    
    beforeEach(() => {
      config = {
        name: 'btc_wallet_1',
        connectionType: 'spv',
        connectionDetails: {
          server: 'localhost:50001',
          network: 'mainnet'
        },
        walletAddress: 'bc1q...',
        secret: 'private_key'
      };
      
      connector = new SpvConnector('bitcoin', config);
      
      // Mock the client
      connector.client = {
        connect: sinon.stub().resolves(true),
        getBalance: sinon.stub().resolves(1.5),
        getTransactionHistory: sinon.stub().resolves([]),
        sendTransaction: sinon.stub().resolves('0x1234567890abcdef'),
        verifyAddress: sinon.stub().resolves(true),
        estimateFee: sinon.stub().resolves(0.0001),
        getBlockchainHeight: sinon.stub().resolves(700000),
        getTransaction: sinon.stub().resolves({}),
        verifyUtxoWallet: sinon.stub().resolves(true)
      };
    });
    
    it('should initialize with the correct properties', () => {
      expect(connector.blockchain).to.equal('bitcoin');
      expect(connector.name).to.equal('btc_wallet_1');
      expect(connector.walletAddress).to.equal('bc1q...');
      expect(connector.secret).to.equal('private_key');
      expect(connector.server).to.equal('localhost:50001');
      expect(connector.network).to.equal('mainnet');
    });
    
    it('should test the connection successfully', async () => {
      const result = await connector.testConnection();
      expect(result).to.be.true;
      expect(connector.client.connect.calledOnce).to.be.true;
    });
    
    it('should get the balance successfully', async () => {
      const balance = await connector.getBalance();
      expect(balance).to.equal(1.5);
      expect(connector.client.getBalance.calledOnce).to.be.true;
    });
  });
  
  describe('FullNodeConnector', () => {
    let connector;
    let config;
    
    beforeEach(() => {
      config = {
        name: 'btc_wallet_3',
        connectionType: 'fullNode',
        connectionDetails: {
          host: 'localhost',
          port: 8332,
          username: 'bitcoinrpc',
          password: 'rpcpassword',
          protocol: 'http',
          network: 'mainnet'
        },
        walletAddress: 'bc1q...',
        secret: 'private_key'
      };
      
      connector = new FullNodeConnector('bitcoin', config);
      
      // Mock the client
      connector.client = {
        call: sinon.stub().callsFake(async (method, params) => {
          switch (method) {
            case 'getblockchaininfo':
              return { blocks: 700000 };
            case 'listunspent':
              return [
                { txid: 'tx1', vout: 0, amount: 1.0 },
                { txid: 'tx2', vout: 1, amount: 0.5 }
              ];
            case 'listtransactions':
              return [
                { txid: 'tx1', amount: 1.0, confirmations: 6, time: 1615000000, category: 'receive', address: 'bc1q...' },
                { txid: 'tx2', amount: -0.5, confirmations: 3, time: 1616000000, category: 'send', address: 'bc1q...' }
              ];
            case 'validateaddress':
              return { isvalid: true };
            case 'estimatesmartfee':
              return { feerate: 0.0001 };
            case 'createrawtransaction':
              return 'rawtx';
            case 'signrawtransactionwithkey':
              return { complete: true, hex: 'signedtx' };
            case 'sendrawtransaction':
              return '0x1234567890abcdef';
            case 'gettransaction':
              return { txid: 'tx1', amount: 1.0, confirmations: 6 };
            default:
              throw new Error(`Unexpected method: ${method}`);
          }
        })
      };
    });
    
    it('should initialize with the correct properties', () => {
      expect(connector.blockchain).to.equal('bitcoin');
      expect(connector.name).to.equal('btc_wallet_3');
      expect(connector.walletAddress).to.equal('bc1q...');
      expect(connector.secret).to.equal('private_key');
      expect(connector.host).to.equal('localhost');
      expect(connector.port).to.equal(8332);
      expect(connector.username).to.equal('bitcoinrpc');
      expect(connector.password).to.equal('rpcpassword');
      expect(connector.protocol).to.equal('http');
      expect(connector.network).to.equal('mainnet');
    });
    
    it('should test the connection successfully', async () => {
      const result = await connector.testConnection();
      expect(result).to.be.true;
      expect(connector.client.call.calledWith('getblockchaininfo')).to.be.true;
    });
    
    it('should get the balance successfully', async () => {
      const balance = await connector.getBalance();
      expect(balance).to.equal(1.5); // 1.0 + 0.5
      expect(connector.client.call.calledWith('listunspent')).to.be.true;
    });
    
    it('should get the transaction history successfully', async () => {
      const transactions = await connector.getTransactionHistory(2);
      expect(transactions).to.be.an('array');
      expect(transactions).to.have.lengthOf(2);
      expect(connector.client.call.calledWith('listtransactions')).to.be.true;
    });
    
    it('should verify an address successfully', async () => {
      const isValid = await connector.verifyAddress('bc1q...');
      expect(isValid).to.be.true;
      expect(connector.client.call.calledWith('validateaddress')).to.be.true;
    });
    
    it('should estimate the fee successfully', async () => {
      const fee = await connector.estimateFee('bc1q...', 0.1, {});
      expect(fee).to.be.a('number');
      expect(connector.client.call.calledWith('estimatesmartfee')).to.be.true;
    });
    
    it('should get the blockchain height successfully', async () => {
      const height = await connector.getBlockchainHeight();
      expect(height).to.equal(700000);
      expect(connector.client.call.calledWith('getblockchaininfo')).to.be.true;
    });
    
    it('should get a transaction successfully', async () => {
      const tx = await connector.getTransaction('tx1');
      expect(tx).to.be.an('object');
      expect(connector.client.call.calledWith('gettransaction')).to.be.true;
    });
    
    it('should verify if the wallet is UTXO-based successfully', async () => {
      const isUtxo = await connector.verifyUtxoWallet();
      expect(isUtxo).to.be.true;
    });
    
    it('should send a transaction successfully', async () => {
      const txid = await connector.sendTransaction('bc1q...', 0.1, { fee: 0.0001 });
      expect(txid).to.equal('0x1234567890abcdef');
      expect(connector.client.call.calledWith('listunspent')).to.be.true;
      expect(connector.client.call.calledWith('createrawtransaction')).to.be.true;
      expect(connector.client.call.calledWith('signrawtransactionwithkey')).to.be.true;
      expect(connector.client.call.calledWith('sendrawtransaction')).to.be.true;
    });
  });
  
  describe('ApiConnector', () => {
    let connector;
    let config;
    
    beforeEach(() => {
      config = {
        name: 'btc_wallet_2',
        connectionType: 'api',
        connectionDetails: {
          provider: 'blockCypher',
          endpoint: 'https://api.blockcypher.com/v1/btc/main',
          apiKey: 'test_api_key',
          network: 'mainnet'
        },
        walletAddress: 'bc1q...',
        secret: 'private_key'
      };
      
      connector = new ApiConnector('bitcoin', config);
      
      // Mock the client methods
      connector.client = {
        getAddress: sinon.stub().resolves({
          address: 'bc1q...',
          balance: 150000000, // 1.5 BTC in satoshis
          txrefs: [
            { tx_hash: 'tx1', value: 100000000, confirmations: 6, confirmed: '2021-03-01T00:00:00Z', spent: false },
            { tx_hash: 'tx2', value: 50000000, confirmations: 3, confirmed: '2021-03-02T00:00:00Z', spent: true }
          ]
        }),
        getTransaction: sinon.stub().resolves({
          hash: 'tx1',
          total: 100000000,
          confirmations: 6
        }),
        getBlockchainInfo: sinon.stub().resolves({
          height: 700000,
          high_fee_per_kb: 100000,
          medium_fee_per_kb: 50000,
          low_fee_per_kb: 10000
        }),
        createTransaction: sinon.stub().resolves({
          tx: { hash: 'newtx' },
          tosign: ['signature_data'],
          inputs: [{ addresses: ['bc1q...'] }],
          outputs: [{ addresses: ['recipient'], value: 10000000 }]
        }),
        sendTransaction: sinon.stub().resolves({
          tx: { hash: '0x1234567890abcdef' }
        }),
        getFeeEstimates: sinon.stub().resolves({
          low: 0.00001,
          medium: 0.00005,
          high: 0.0001
        }),
        verifyUtxoWallet: sinon.stub().resolves(true)
      };
    });
    
    it('should initialize with the correct properties', () => {
      expect(connector.blockchain).to.equal('bitcoin');
      expect(connector.name).to.equal('btc_wallet_2');
      expect(connector.walletAddress).to.equal('bc1q...');
      expect(connector.secret).to.equal('private_key');
      expect(connector.provider).to.equal('blockCypher');
      expect(connector.endpoint).to.equal('https://api.blockcypher.com/v1/btc/main');
      expect(connector.apiKey).to.equal('test_api_key');
      expect(connector.network).to.equal('mainnet');
    });
    
    it('should test the connection successfully', async () => {
      const result = await connector.testConnection();
      expect(result).to.be.true;
      expect(connector.client.getBlockchainInfo.calledOnce).to.be.true;
    });
    
    it('should get the balance successfully', async () => {
      const balance = await connector.getBalance();
      expect(balance).to.equal(1.5);
      expect(connector.client.getAddress.calledOnce).to.be.true;
    });
    
    it('should get the transaction history successfully', async () => {
      const transactions = await connector.getTransactionHistory(2);
      expect(transactions).to.be.an('array');
      expect(transactions).to.have.lengthOf(2);
      expect(connector.client.getAddress.calledOnce).to.be.true;
    });
    
    it('should estimate the fee successfully', async () => {
      const fee = await connector.estimateFee('bc1q...', 0.1, { feeLevel: 'medium' });
      expect(fee).to.equal(0.00005);
      expect(connector.client.getFeeEstimates.calledOnce).to.be.true;
    });
    
    it('should get the blockchain height successfully', async () => {
      const height = await connector.getBlockchainHeight();
      expect(height).to.equal(700000);
      expect(connector.client.getBlockchainInfo.calledOnce).to.be.true;
    });
    
    it('should get a transaction successfully', async () => {
      const tx = await connector.getTransaction('tx1');
      expect(tx).to.be.an('object');
      expect(connector.client.getTransaction.calledOnce).to.be.true;
      expect(connector.client.getTransaction.firstCall.args[0]).to.equal('tx1');
    });
    
    it('should verify if the wallet is UTXO-based successfully', async () => {
      const isUtxo = await connector.verifyUtxoWallet();
      expect(isUtxo).to.be.true;
      expect(connector.client.verifyUtxoWallet.calledOnce).to.be.true;
    });
  });
});
