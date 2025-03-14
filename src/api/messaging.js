/**
 * API Messaging System
 * 
 * This module provides functionality for managing messages in API responses.
 * It allows for categorizing messages as info, warning, or error, and
 * prioritizing them based on severity.
 */

/**
 * Message types
 */
const MessageType = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Message codes
 */
const MessageCode = {
  // Info codes
  INFO_TRANSACTION_PROCESSED: 'INFO_001',
  INFO_WALLET_CREATED: 'INFO_002',
  INFO_BALANCE_UPDATED: 'INFO_003',
  INFO_RECONCILIATION_COMPLETE: 'INFO_004',
  
  // Warning codes
  WARN_PRIMARY_WALLET_BALANCE_LOW: 'WARN_001',
  WARN_BALANCE_DISCREPANCY: 'WARN_002',
  WARN_RECONCILIATION_NEEDED: 'WARN_003',
  WARN_TRANSACTION_DELAYED: 'WARN_004',
  
  // Error codes
  ERROR_INSUFFICIENT_BALANCE: 'ERROR_001',
  ERROR_WALLET_NOT_FOUND: 'ERROR_002',
  ERROR_TRANSACTION_FAILED: 'ERROR_003',
  ERROR_INVALID_PARAMETERS: 'ERROR_004'
};

/**
 * Message manager class
 */
class MessageManager {
  constructor() {
    this.messages = [];
  }
  
  /**
   * Add an info message
   * @param {string} code The message code
   * @param {string} message The message text
   * @param {Object} data Additional data for the message
   */
  addInfo(code, message, data = {}) {
    this.messages.push({
      type: MessageType.INFO,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Add a warning message
   * @param {string} code The message code
   * @param {string} message The message text
   * @param {Object} data Additional data for the message
   */
  addWarning(code, message, data = {}) {
    this.messages.push({
      type: MessageType.WARNING,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Add an error message
   * @param {string} code The message code
   * @param {string} message The message text
   * @param {Object} data Additional data for the message
   */
  addError(code, message, data = {}) {
    this.messages.push({
      type: MessageType.ERROR,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get all messages
   * @returns {Array} All messages
   */
  getMessages() {
    return [...this.messages];
  }
  
  /**
   * Get messages by type
   * @param {string} type The message type
   * @returns {Array} Messages of the specified type
   */
  getMessagesByType(type) {
    return this.messages.filter(message => message.type === type);
  }
  
  /**
   * Get messages by code
   * @param {string} code The message code
   * @returns {Array} Messages with the specified code
   */
  getMessagesByCode(code) {
    return this.messages.filter(message => message.code === code);
  }
  
  /**
   * Check if there are any messages
   * @returns {boolean} True if there are messages, false otherwise
   */
  hasMessages() {
    return this.messages.length > 0;
  }
  
  /**
   * Check if there are any messages of a specific type
   * @param {string} type The message type
   * @returns {boolean} True if there are messages of the specified type, false otherwise
   */
  hasMessagesOfType(type) {
    return this.getMessagesByType(type).length > 0;
  }
  
  /**
   * Check if there are any error messages
   * @returns {boolean} True if there are error messages, false otherwise
   */
  hasErrors() {
    return this.hasMessagesOfType(MessageType.ERROR);
  }
  
  /**
   * Check if there are any warning messages
   * @returns {boolean} True if there are warning messages, false otherwise
   */
  hasWarnings() {
    return this.hasMessagesOfType(MessageType.WARNING);
  }
  
  /**
   * Clear all messages
   */
  clear() {
    this.messages = [];
  }
  
  /**
   * Create a response object with messages
   * @param {Object} data The response data
   * @returns {Object} The response object with messages
   */
  createResponse(data = {}) {
    return {
      data,
      messages: this.getMessages()
    };
  }
}

/**
 * Create a new message manager
 * @returns {MessageManager} A new message manager instance
 */
function createMessageManager() {
  return new MessageManager();
}

module.exports = {
  MessageType,
  MessageCode,
  createMessageManager
};
