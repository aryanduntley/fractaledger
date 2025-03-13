/**
 * Blockchain Connector Tests
 * 
 * This file contains tests for the blockchain connector module.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BlockchainConnector } = require('../src/blockchain/blockchainConnector');
const { SpvConnector } = require('../src/blockchain/connectors/spvConnector');

describe('Blockchain Connector', () => {
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
    
    it('should get the transaction history successfully', async () => {
      const transactions = await connector.getTransactionHistory(5);
      expect(transactions).to.be.an('array');
      expect(connector.client.getTransactionHistory.calledOnce).to.be.true;
      expect(connector.client.getTransactionHistory.firstCall.args[0]).to.equal(5);
    });
    
    it('should send a transaction successfully', async () => {
      const txid = await connector.sendTransaction('bc1q...', 0.1, { fee: 0.0001 });
      expect(txid).to.equal('0x1234567890abcdef');
      expect(connector.client.sendTransaction.calledOnce).to.be.true;
      expect(connector.client.sendTransaction.firstCall.args[0]).to.equal('bc1q...');
      expect(connector.client.sendTransaction.firstCall.args[1]).to.equal(0.1);
      expect(connector.client.sendTransaction.firstCall.args[2]).to.deep.equal({ fee: 0.0001 });
    });
    
    it('should verify an address successfully', async () => {
      const isValid = await connector.verifyAddress('bc1q...');
      expect(isValid).to.be.true;
      expect(connector.client.verifyAddress.calledOnce).to.be.true;
      expect(connector.client.verifyAddress.firstCall.args[0]).to.equal('bc1q...');
    });
    
    it('should estimate the fee successfully', async () => {
      const fee = await connector.estimateFee('bc1q...', 0.1, {});
      expect(fee).to.equal(0.0001);
      expect(connector.client.estimateFee.calledOnce).to.be.true;
      expect(connector.client.estimateFee.firstCall.args[0]).to.equal('bc1q...');
      expect(connector.client.estimateFee.firstCall.args[1]).to.equal(0.1);
      expect(connector.client.estimateFee.firstCall.args[2]).to.deep.equal({});
    });
    
    it('should get the blockchain height successfully', async () => {
      const height = await connector.getBlockchainHeight();
      expect(height).to.equal(700000);
      expect(connector.client.getBlockchainHeight.calledOnce).to.be.true;
    });
    
    it('should get a transaction successfully', async () => {
      const tx = await connector.getTransaction('0x1234567890abcdef');
      expect(tx).to.be.an('object');
      expect(connector.client.getTransaction.calledOnce).to.be.true;
      expect(connector.client.getTransaction.firstCall.args[0]).to.equal('0x1234567890abcdef');
    });
    
    it('should verify if the wallet is UTXO-based successfully', async () => {
      const isUtxo = await connector.verifyUtxoWallet();
      expect(isUtxo).to.be.true;
      expect(connector.client.verifyUtxoWallet.calledOnce).to.be.true;
    });
  });
});
