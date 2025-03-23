/**
 * Transceivers Module
 * 
 * This module exports all transceiver implementations, including:
 * - SPVTransceiver: For interacting with UTXO-based blockchains using SPV (Simplified Payment Verification)
 * - MockTransceiver: For testing purposes
 * - UTXOTransceiverExample: Example implementation for reference
 * 
 * Transceivers handle both transaction broadcasting and wallet address monitoring.
 * They completely separate transaction creation/signing from the blockchain interaction
 * mechanism, allowing users to use their existing infrastructure for blockchain interactions.
 */

const SPVTransceiver = require('./spv-transceiver');
const MockTransceiver = require('./mock-transceiver');
const UTXOTransceiverExample = require('./utxo-transceiver-example');

module.exports = {
  SPVTransceiver,
  MockTransceiver,
  UTXOTransceiverExample
};
