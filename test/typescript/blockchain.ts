/**
 * TypeScript Test for Blockchain Module
 * 
 * This file tests the TypeScript definitions for the blockchain module.
 * It verifies that the types are correctly defined and can be used as expected.
 */

import { 
  BlockchainConnector, 
  TransactionBuilder, 
  getNetworkParams
} from '../../src/blockchain/index';

import type {
  WalletConfig,
  TransactionOptions,
  CreateTransactionOptions,
  SendTransactionOptions,
  UTXOInput,
  UTXOOutput,
  TransactionResult
} from '../../src/blockchain/types';

// Test WalletConfig interface
const walletConfig: WalletConfig = {
  name: 'test_wallet',
  network: 'testnet',
  walletAddress: 'bc1q...',
  secretEnvVar: 'TEST_SECRET',
  transceiver: {
    method: 'callback',
    callbackModule: './transceivers/utxo-transceiver.js',
    monitoringInterval: 60000,
    reconnectInterval: 30000,
    maxReconnectAttempts: 5,
    apiUrl: 'https://blockstream.info/api'
  }
};

// Test creating a blockchain connector
const connector = new BlockchainConnector('bitcoin', walletConfig);

// Test UTXOInput interface
const inputs: UTXOInput[] = [
  {
    txid: '0x1234567890abcdef',
    vout: 0,
    value: 100000000,
    height: 700000,
    confirmations: 6
  }
];

// Test UTXOOutput interface
const outputs: UTXOOutput[] = [
  {
    address: 'bc1q...',
    value: 50000000
  },
  {
    address: 'bc1q...',
    value: 49990000
  }
];

// Test TransactionOptions interface
const options: TransactionOptions = {
  opReturn: 'Hello, world!',
  fee: 10000,
  feeRate: 2,
  utxos: inputs
} as TransactionOptions;

// Test TransactionBuilder
const networkParams = getNetworkParams('bitcoin', 'testnet');
const transactionBuilder = new TransactionBuilder('bitcoin', 'testnet');

// Test creating a transaction
async function testCreateTransaction(): Promise<TransactionResult> {
  // Create a new options object with required properties for createTransaction
  const createOptions: CreateTransactionOptions = {
    opReturn: 'Hello, world!'
  };
  return await connector.createTransaction(inputs, outputs, createOptions);
}

// Test broadcasting a transaction
async function testBroadcastTransaction(txHex: string): Promise<string> {
  return await connector.broadcastTransaction(txHex, { internalWalletId: 'test_wallet' });
}

// Test sending a transaction
async function testSendTransaction(): Promise<any> {
  // Create a new options object with required properties for sendTransaction
  // Using a type assertion to tell TypeScript that we know what we're doing
  const sendOptions = {
    fee: 10000,
    feeRate: 2,
    utxos: inputs,
    opReturn: 'Hello, world!' // Required for this test
  };
  return await connector.sendTransaction('bc1q...', 0.1, sendOptions as any);
}

// Test monitoring a wallet address
async function testMonitorWalletAddress(): Promise<any> {
  return await connector.monitorWalletAddress('bc1q...', (event: string, data: any) => {
    console.log(`Event: ${event}`, data);
  });
}

// Test getting wallet balance
async function testGetWalletBalance(): Promise<number> {
  return await connector.getWalletBalance();
}

// Test getting transaction history
async function testGetTransactionHistory(): Promise<any[]> {
  return await connector.getTransactionHistory(undefined, 10);
}

// Test getting UTXOs
async function testGetUTXOs(): Promise<UTXOInput[]> {
  return await connector.getUTXOs();
}

// Test event handling
function testEventHandling(): void {
  connector.on('transaction', (txid: string, data: any) => {
    console.log(`Transaction: ${txid}`, data);
  });
  
  connector.off('transaction', () => {});
}

// Test cleanup
async function testCleanup(): Promise<void> {
  await connector.cleanup();
}

// Export functions for testing
export {
  testCreateTransaction,
  testBroadcastTransaction,
  testSendTransaction,
  testMonitorWalletAddress,
  testGetWalletBalance,
  testGetTransactionHistory,
  testGetUTXOs,
  testEventHandling,
  testCleanup
};
