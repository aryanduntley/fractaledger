/**
 * Blockchain Module
 * 
 * This module exports all blockchain-related functionality, including:
 * - BlockchainConnector: For interacting with UTXO-based blockchains
 * - TransactionBuilder: For creating and signing transactions
 * - TransceiverManager: For managing transaction broadcasting and wallet monitoring
 * - UTXOTransceiver: Interface for UTXO-based blockchain transceivers
 * - Connector management functions: For initializing and managing blockchain connectors
 */

const { BlockchainConnector } = require('./blockchainConnector');
const { TransactionBuilder, getNetworkParams } = require('./transactionBuilder');
const { TransceiverManager } = require('./transceiverManager');
const { UTXOTransceiver } = require('./utxoTransceiver');
const connectorManager = require('./connectorManager');

module.exports = {
  BlockchainConnector,
  TransactionBuilder,
  TransceiverManager,
  UTXOTransceiver,
  getNetworkParams,
  ...connectorManager
};
