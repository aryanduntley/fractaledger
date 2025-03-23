/**
 * Blockchain Module Type Definitions
 * 
 * This file contains TypeScript type definitions for the blockchain module.
 */

/**
 * UTXO Input interface
 */
export interface UTXOInput {
  txid: string;
  vout: number;
  value: number;
  height?: number;
  confirmations?: number;
}

/**
 * UTXO Output interface
 */
export interface UTXOOutput {
  address: string;
  value: number;
}

/**
 * Transaction options interface
 */
export interface TransactionOptions {
  opReturn?: string;
  fee?: number;
  feeRate?: number;
  utxos: UTXOInput[];  // Required for sendTransaction
}

/**
 * Transaction creation options interface
 */
export interface CreateTransactionOptions {
  opReturn?: string;
  fee?: number;
  feeRate?: number;
  utxos?: UTXOInput[];
}

/**
 * Send transaction options interface
 */
export interface SendTransactionOptions {
  opReturn?: string;  // Optional OP_RETURN data
  fee: number;        // Required transaction fee
  feeRate: number;    // Required fee rate in satoshis per byte
  utxos: UTXOInput[]; // Required UTXOs to use for the transaction
}

/**
 * Transaction result interface
 */
export interface TransactionResult {
  txid: string;
  txHex: string;
  inputs: number;
  outputs: number;
  fee: number;
}

/**
 * Wallet configuration interface
 */
export interface WalletConfig {
  name: string;
  network?: string;
  walletAddress: string;
  secret?: string;
  secretEnvVar?: string;
  transceiver?: TransceiverConfig;
  broadcasting?: TransceiverConfig;
  connectionType?: string;
}

/**
 * Transceiver configuration interface
 */
export interface TransceiverConfig {
  method: 'callback' | 'event' | 'api' | 'return';
  callbackModule?: string;
  monitoringInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  [key: string]: any;
}

/**
 * Blockchain connector interface
 */
export interface BlockchainConnector {
  blockchain: string;
  config: WalletConfig;
  name: string;
  walletAddress: string;
  secret: string;
  transactionBuilder: any;
  transceiverManager: any;
  createTransaction(inputs: UTXOInput[], outputs: UTXOOutput[], options?: CreateTransactionOptions): Promise<TransactionResult>;
  broadcastTransaction(txHex: string, metadata?: any): Promise<any>;
  sendTransaction(toAddress: string, amount: number, options: SendTransactionOptions): Promise<any>;
  verifyAddress(address: string): boolean;
  estimateFee(inputCount: number, outputCount: number, feeRate?: number): number;
  monitorWalletAddress(address: string, callback: Function): Promise<any>;
  stopMonitoringWalletAddress(address: string): Promise<boolean>;
  getWalletBalance(address?: string): Promise<number>;
  getTransactionHistory(address?: string, limit?: number): Promise<any[]>;
  getUTXOs(address?: string): Promise<UTXOInput[]>;
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): void;
  updateTransceiverConfig(config: TransceiverConfig): void;
  getPendingTransaction(txid: string): any;
  getAllPendingTransactions(): any[];
  getAllMonitoredAddresses(): any[];
  cleanup(): Promise<void>;
}

/**
 * UTXO Transceiver interface
 */
export interface UTXOTransceiver {
  config: any;
  eventEmitter: any;
  monitoredAddresses: Map<string, any>;
  monitoringIntervals: Map<string, any>;
  broadcastTransaction(txHex: string, metadata?: any): Promise<string>;
  monitorWalletAddress(address: string, callback: Function): Promise<any>;
  stopMonitoringWalletAddress(address: string): Promise<boolean>;
  getWalletBalance(address: string): Promise<number>;
  getTransactionHistory(address: string, limit?: number): Promise<any[]>;
  getUTXOs(address: string): Promise<UTXOInput[]>;
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): void;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Transceiver Manager interface
 */
export interface TransceiverManager {
  config: TransceiverConfig;
  eventEmitter: any;
  pendingTransactions: Map<string, any>;
  monitoredAddresses: Map<string, any>;
  transceiver: any;
  broadcastTransaction(txHex: string, metadata?: any): Promise<any>;
  monitorWalletAddress(address: string, callback: Function): Promise<any>;
  stopMonitoringWalletAddress(address: string): Promise<boolean>;
  getWalletBalance(address: string): Promise<number>;
  getTransactionHistory(address: string, limit?: number): Promise<any[]>;
  getUTXOs(address: string): Promise<UTXOInput[]>;
  getPendingTransaction(txid: string): any;
  getAllPendingTransactions(): any[];
  getAllMonitoredAddresses(): any[];
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  updateConfig(config: TransceiverConfig): void;
  cleanup(): Promise<void>;
}

/**
 * Transaction Builder interface
 */
export interface TransactionBuilder {
  blockchain: string;
  network: string;
  networkParams: any;
  createAndSignTransaction(privateKey: string, inputs: UTXOInput[], outputs: UTXOOutput[], options?: CreateTransactionOptions): TransactionResult;
  verifyAddress(address: string): boolean;
  estimateTransactionSize(inputCount: number, outputCount: number): number;
  estimateFee(inputCount: number, outputCount: number, feeRate?: number): number;
}
