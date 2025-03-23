/**
 * FractaLedger Type Definitions
 * 
 * This file contains TypeScript type definitions for the main module.
 */

/**
 * Main function to initialize and start the FractaLedger system
 */
export function main(): Promise<void>;

/**
 * Load configuration function
 */
export function loadConfig(): Promise<any>;

/**
 * Initialize blockchain connectors function
 */
export function initializeBlockchainConnectors(config: any): Promise<any>;

/**
 * Monitor connector health function
 */
export function monitorConnectorHealth(blockchainConnectors: any, interval?: number): any;

/**
 * Stop health monitoring function
 */
export function stopHealthMonitoring(monitoringInterval: any): void;

/**
 * Initialize wallet manager function
 */
export function initializeWalletManager(config: any, blockchainConnectors: any, fabricClient: any): Promise<any>;

/**
 * Initialize Hyperledger function
 */
export function initializeHyperledger(config: any): Promise<any>;

/**
 * Initialize chaincode manager function
 */
export function initializeChaincodeManager(config: any, fabricClient: any): Promise<any>;

/**
 * Initialize balance reconciliation function
 */
export function initializeBalanceReconciliation(config: any, walletManager: any, fabricClient: any): Promise<any>;

/**
 * Start API server function
 */
export function startApiServer(
  config: any,
  blockchainConnectors: any,
  walletManager: any,
  fabricClient: any,
  chaincodeManager: any,
  balanceReconciliation: any
): Promise<any>;
