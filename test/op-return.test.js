/**
 * OP_RETURN Tests
 * 
 * This file contains tests for the OP_RETURN functionality in the transaction builder.
 */

const { expect } = require('chai');
const sinon = require('sinon');

// Create a mock for the bitcoinjs-lib module
const mockBitcoin = {
  networks: {
    bitcoin: {},
    testnet: {}
  },
  ECPair: {
    fromWIF: sinon.stub().returns({
      publicKey: Buffer.from('mock-public-key'),
      sign: sinon.stub().returns(Buffer.from('mock-signature'))
    })
  },
  opcodes: {
    OP_RETURN: 0x6a
  },
  script: {
    compile: sinon.stub().returns(Buffer.from('mock-script'))
  },
  Psbt: sinon.stub().returns({
    addInput: sinon.stub(),
    addOutput: sinon.stub(),
    signInput: sinon.stub(),
    finalizeAllInputs: sinon.stub(),
    extractTransaction: sinon.stub().returns({
      getId: sinon.stub().returns('mock-txid'),
      toHex: sinon.stub().returns('mock-tx-hex')
    })
  })
};

// Mock the bitcoinjs-lib module
jest.mock('bitcoinjs-lib', () => mockBitcoin);

// Import the TransactionBuilder after mocking bitcoinjs-lib
const { TransactionBuilder } = require('../src/blockchain/transactionBuilder');

describe('OP_RETURN Functionality', () => {
  let transactionBuilder;
  
  beforeEach(() => {
    // Reset the stubs
    sinon.resetHistory();
    
    // Create a transaction builder for Bitcoin
    transactionBuilder = new TransactionBuilder('bitcoin', 'testnet');
  });
  
  it('should create a transaction without OP_RETURN data', () => {
    // Create inputs and outputs
    const inputs = [
      { txid: 'mock-txid-1', vout: 0, value: 100000 }
    ];
    
    const outputs = [
      { address: 'mock-address-1', value: 50000 }
    ];
    
    // Create and sign the transaction
    const transaction = transactionBuilder.createAndSignTransaction(
      'mock-private-key',
      inputs,
      outputs
    );
    
    // Get the mock Psbt instance
    const mockPsbt = mockBitcoin.Psbt();
    
    // Verify that addOutput was called once for the regular output
    expect(mockPsbt.addOutput.calledOnce).to.be.true;
    expect(mockPsbt.addOutput.firstCall.args[0]).to.deep.equal({
      address: 'mock-address-1',
      value: 50000
    });
    
    // Verify that the transaction was created successfully
    expect(transaction).to.have.property('txid', 'mock-txid');
    expect(transaction).to.have.property('txHex', 'mock-tx-hex');
  });
  
  it('should create a transaction with OP_RETURN data', () => {
    // Create inputs and outputs
    const inputs = [
      { txid: 'mock-txid-1', vout: 0, value: 100000 }
    ];
    
    const outputs = [
      { address: 'mock-address-1', value: 50000 }
    ];
    
    // Create and sign the transaction with OP_RETURN data
    const transaction = transactionBuilder.createAndSignTransaction(
      'mock-private-key',
      inputs,
      outputs,
      { opReturn: 'Test OP_RETURN data' }
    );
    
    // Get the mock Psbt instance
    const mockPsbt = mockBitcoin.Psbt();
    
    // Verify that addOutput was called twice (once for the regular output, once for OP_RETURN)
    expect(mockPsbt.addOutput.calledTwice).to.be.true;
    
    // Verify the first call was for the regular output
    expect(mockPsbt.addOutput.firstCall.args[0]).to.deep.equal({
      address: 'mock-address-1',
      value: 50000
    });
    
    // Verify the second call was for the OP_RETURN output
    const secondCallArgs = mockPsbt.addOutput.secondCall.args[0];
    expect(secondCallArgs).to.have.property('value', 0); // OP_RETURN outputs have zero value
    expect(secondCallArgs).to.have.property('script');
    
    // Verify that the transaction was created successfully
    expect(transaction).to.have.property('txid', 'mock-txid');
    expect(transaction).to.have.property('txHex', 'mock-tx-hex');
    
    // Verify that script.compile was called with OP_RETURN and the data
    expect(mockBitcoin.script.compile.calledOnce).to.be.true;
    expect(mockBitcoin.script.compile.firstCall.args[0][0]).to.equal(mockBitcoin.opcodes.OP_RETURN);
  });
  
  it('should throw an error if OP_RETURN data exceeds 80 bytes', () => {
    // Create inputs and outputs
    const inputs = [
      { txid: 'mock-txid-1', vout: 0, value: 100000 }
    ];
    
    const outputs = [
      { address: 'mock-address-1', value: 50000 }
    ];
    
    // Create a string that exceeds 80 bytes
    const longString = 'a'.repeat(81);
    
    // Attempt to create a transaction with OP_RETURN data that exceeds 80 bytes
    expect(() => {
      transactionBuilder.createAndSignTransaction(
        'mock-private-key',
        inputs,
        outputs,
        { opReturn: longString }
      );
    }).to.throw('OP_RETURN data exceeds the maximum size of 80 bytes');
  });
  
  it('should create a transaction with OP_RETURN data of exactly 80 bytes', () => {
    // Create inputs and outputs
    const inputs = [
      { txid: 'mock-txid-1', vout: 0, value: 100000 }
    ];
    
    const outputs = [
      { address: 'mock-address-1', value: 50000 }
    ];
    
    // Create a string of exactly 80 bytes
    const exactString = 'a'.repeat(80);
    
    // Create and sign the transaction with OP_RETURN data
    const transaction = transactionBuilder.createAndSignTransaction(
      'mock-private-key',
      inputs,
      outputs,
      { opReturn: exactString }
    );
    
    // Get the mock Psbt instance
    const mockPsbt = mockBitcoin.Psbt();
    
    // Verify that addOutput was called twice (once for the regular output, once for OP_RETURN)
    expect(mockPsbt.addOutput.calledTwice).to.be.true;
    
    // Verify the second call was for the OP_RETURN output
    const secondCallArgs = mockPsbt.addOutput.secondCall.args[0];
    expect(secondCallArgs).to.have.property('value', 0); // OP_RETURN outputs have zero value
    expect(secondCallArgs).to.have.property('script');
    
    // Verify that the transaction was created successfully
    expect(transaction).to.have.property('txid', 'mock-txid');
    expect(transaction).to.have.property('txHex', 'mock-tx-hex');
  });
});
