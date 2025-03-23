/**
 * Transceivers Module Type Definitions
 * 
 * This file contains TypeScript type definitions for the transceivers module.
 */

import { UTXOInput } from '../src/blockchain/types';

/**
 * Transceiver configuration interface
 */
export interface TransceiverConfig {
  method: 'callback' | 'event' | 'api' | 'return';
  callbackModule?: string;
  monitoringInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  apiUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  [key: string]: any;
}

/**
 * Transaction metadata interface
 */
export interface TransactionMetadata {
  blockchain: string;
  walletName: string;
  internalWalletId?: string;
  toAddress?: string;
  amount?: number;
  fee?: number;
  timestamp: string;
  [key: string]: any;
}

/**
 * Wallet monitoring callback interface
 */
export interface WalletMonitoringCallback {
  (event: string, data: any): void;
}

/**
 * UTXO Transceiver interface
 */
export interface UTXOTransceiver {
  config: TransceiverConfig;
  broadcastTransaction(txHex: string, metadata?: TransactionMetadata): Promise<string>;
  monitorWalletAddress(address: string, callback: WalletMonitoringCallback): Promise<any>;
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
 * SPV Transceiver interface
 */
export interface SPVTransceiver extends UTXOTransceiver {
  blockchain: string;
  network: string;
  apiUrl: string;
  monitoringInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

/**
 * Mock Transceiver interface
 */
export interface MockTransceiver extends UTXOTransceiver {
  mockBalances: Map<string, number>;
  mockTransactions: Map<string, any[]>;
  mockUTXOs: Map<string, UTXOInput[]>;
  setMockBalance(address: string, balance: number): void;
  setMockTransactions(address: string, transactions: any[]): void;
  setMockUTXOs(address: string, utxos: UTXOInput[]): void;
  simulateTransaction(fromAddress: string, toAddress: string, amount: number): Promise<string>;
}
