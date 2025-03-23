/**
 * API Module
 * 
 * This module exports all API-related functionality, including:
 * - startApiServer: Function to start the API server
 * - MessageType: Enum for message types (info, warning, error)
 * - MessageCode: Enum for message codes
 * - createMessageManager: Function to create a message manager
 * 
 * The API provides RESTful endpoints for interacting with the FractaLedger system.
 */

const { startApiServer } = require('./server');
const { MessageType, MessageCode, createMessageManager } = require('./messaging');

module.exports = {
  startApiServer,
  MessageType,
  MessageCode,
  createMessageManager
};
