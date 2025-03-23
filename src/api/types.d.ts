/**
 * API Module Type Definitions
 * 
 * This file contains TypeScript type definitions for the API module.
 */

import { Express, Request, Response, NextFunction } from 'express';

/**
 * Message type enum
 */
export enum MessageType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Message code enum
 */
export enum MessageCode {
  // Info messages
  INFO_TRANSACTION_PROCESSED = 'INFO_001',
  INFO_WALLET_CREATED = 'INFO_002',
  INFO_WALLET_UPDATED = 'INFO_003',
  INFO_WALLET_DELETED = 'INFO_004',
  INFO_INTERNAL_WALLET_CREATED = 'INFO_005',
  INFO_INTERNAL_WALLET_UPDATED = 'INFO_006',
  INFO_WALLET_MONITORING_STARTED = 'INFO_007',
  INFO_WALLET_MONITORING_STOPPED = 'INFO_008',
  
  // Warning messages
  WARN_PRIMARY_WALLET_BALANCE_LOW = 'WARN_001',
  WARN_BALANCE_DISCREPANCY = 'WARN_002',
  WARN_TRANSACTION_PENDING = 'WARN_003',
  WARN_TRANSACTION_FAILED = 'WARN_004',
  
  // Error messages
  ERROR_INSUFFICIENT_BALANCE = 'ERROR_001',
  ERROR_WALLET_NOT_FOUND = 'ERROR_002',
  ERROR_INVALID_PARAMETERS = 'ERROR_003',
  ERROR_TRANSACTION_FAILED = 'ERROR_004',
  ERROR_INTERNAL_SERVER_ERROR = 'ERROR_005',
  ERROR_UNAUTHORIZED = 'ERROR_006',
  ERROR_FORBIDDEN = 'ERROR_007',
  ERROR_TRANSACTION_NOT_FOUND = 'ERROR_008'
}

/**
 * Message interface
 */
export interface Message {
  type: MessageType;
  code: MessageCode | string;
  message: string;
  data?: any;
  timestamp: string;
}

/**
 * Message manager interface
 */
export interface MessageManager {
  messages: Message[];
  addInfo(code: MessageCode | string, message: string, data?: any): void;
  addWarning(code: MessageCode | string, message: string, data?: any): void;
  addError(code: MessageCode | string, message: string, data?: any): void;
  createResponse(data?: any): any;
}

/**
 * Create message manager function
 */
export function createMessageManager(): MessageManager;

/**
 * API server dependencies interface
 */
export interface ApiServerDependencies {
  walletManager: any;
  fabricClient: any;
  chaincodeManager: any;
  balanceReconciliation: any;
  config: any;
}

/**
 * API server interface
 */
export interface ApiServer {
  app: Express;
  authenticateJWT: (req: Request, res: Response, next: NextFunction) => void;
  dependencies: ApiServerDependencies;
  close: () => Promise<void>;
  registerExtension: (extension: (app: Express, authenticateJWT: any, dependencies: ApiServerDependencies) => void) => void;
}

/**
 * Start API server function
 */
export function startApiServer(
  config: any,
  blockchainConnectors: any,
  walletManager: any,
  fabricClient: any,
  chaincodeManager: any,
  balanceReconciliation: any,
  app?: Express
): Promise<ApiServer>;
