/**
 * Package Exports Test
 * 
 * This file tests the package exports to ensure they are working correctly.
 * It verifies that all exported modules can be imported and used as expected.
 */

const assert = require('assert');

describe('Package Exports', () => {
  describe('Main Module', () => {
    it('should export the main function and initialization functions', () => {
      const fractaledger = require('../dist/src/index.js');
      
      assert.strictEqual(typeof fractaledger.main, 'function', 'main should be a function');
      assert.strictEqual(typeof fractaledger.loadConfig, 'function', 'loadConfig should be a function');
      assert.strictEqual(typeof fractaledger.initializeBlockchainConnectors, 'function', 'initializeBlockchainConnectors should be a function');
      assert.strictEqual(typeof fractaledger.initializeWalletManager, 'function', 'initializeWalletManager should be a function');
      assert.strictEqual(typeof fractaledger.initializeHyperledger, 'function', 'initializeHyperledger should be a function');
      assert.strictEqual(typeof fractaledger.initializeChaincodeManager, 'function', 'initializeChaincodeManager should be a function');
      assert.strictEqual(typeof fractaledger.initializeBalanceReconciliation, 'function', 'initializeBalanceReconciliation should be a function');
      assert.strictEqual(typeof fractaledger.startApiServer, 'function', 'startApiServer should be a function');
    });
  });

  describe('Blockchain Module', () => {
    it('should export blockchain-related classes and functions', () => {
      const blockchain = require('../dist/src/blockchain/index.js');
      
      assert.strictEqual(typeof blockchain.BlockchainConnector, 'function', 'BlockchainConnector should be a function');
      assert.strictEqual(typeof blockchain.TransactionBuilder, 'function', 'TransactionBuilder should be a function');
      assert.strictEqual(typeof blockchain.TransceiverManager, 'function', 'TransceiverManager should be a function');
      assert.strictEqual(typeof blockchain.UTXOTransceiver, 'function', 'UTXOTransceiver should be a function');
      assert.strictEqual(typeof blockchain.getNetworkParams, 'function', 'getNetworkParams should be a function');
      assert.strictEqual(typeof blockchain.initializeBlockchainConnectors, 'function', 'initializeBlockchainConnectors should be a function');
      assert.strictEqual(typeof blockchain.registerEventListeners, 'function', 'registerEventListeners should be a function');
      assert.strictEqual(typeof blockchain.updateTransceiverConfig, 'function', 'updateTransceiverConfig should be a function');
      assert.strictEqual(typeof blockchain.getAllPendingTransactions, 'function', 'getAllPendingTransactions should be a function');
      assert.strictEqual(typeof blockchain.getAllMonitoredAddresses, 'function', 'getAllMonitoredAddresses should be a function');
      assert.strictEqual(typeof blockchain.getConnector, 'function', 'getConnector should be a function');
      assert.strictEqual(typeof blockchain.cleanupConnectors, 'function', 'cleanupConnectors should be a function');
    });
  });

  describe('Wallet Module', () => {
    it('should export wallet-related functions', () => {
      const wallet = require('../dist/src/wallet/walletManager.js');
      
      assert.strictEqual(typeof wallet.initializeWalletManager, 'function', 'initializeWalletManager should be a function');
    });
  });

  describe('Transceivers Module', () => {
    it('should export transceiver implementations', () => {
      // Use try-catch to handle the case where electrum-client is not installed
      try {
        const transceivers = require('../dist/transceivers/index.js');
        
        // Check if the transceivers are exported
        // Note: SPVTransceiver might not be available if electrum-client is not installed
        if (transceivers.SPVTransceiver) {
          assert.strictEqual(typeof transceivers.SPVTransceiver, 'function', 'SPVTransceiver should be a function');
        } else {
          console.warn('SPVTransceiver not available - electrum-client may not be installed');
        }
        
        // These should always be available
        assert.strictEqual(typeof transceivers.MockTransceiver, 'function', 'MockTransceiver should be a function');
        assert.strictEqual(typeof transceivers.UTXOTransceiverExample, 'function', 'UTXOTransceiverExample should be a function');
      } catch (error) {
        // If there's an error loading the module, check if it's related to electrum-client
        if (error.message.includes('electrum-client')) {
          console.warn('Skipping SPVTransceiver test - electrum-client not installed');
          // Test passes even if electrum-client is not installed
          assert.ok(true);
        } else {
          // For other errors, fail the test
          throw error;
        }
      }
    });
  });

  describe('API Module', () => {
    it('should export API-related functions', () => {
      const api = require('../dist/src/api/index.js');
      
      assert.strictEqual(typeof api.startApiServer, 'function', 'startApiServer should be a function');
      assert.strictEqual(typeof api.MessageType, 'object', 'MessageType should be an object');
      assert.strictEqual(typeof api.MessageCode, 'object', 'MessageCode should be an object');
      assert.strictEqual(typeof api.createMessageManager, 'function', 'createMessageManager should be a function');
    });
  });
});
