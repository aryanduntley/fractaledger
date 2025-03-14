/**
 * API Messaging System Tests
 * 
 * This file contains tests for the API messaging system, which provides
 * structured feedback in API responses.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { MessageType, MessageCode, createMessageManager } = require('../src/api/messaging');

describe('API Messaging System', () => {
  let messageManager;
  
  beforeEach(() => {
    messageManager = createMessageManager();
  });
  
  describe('Message Manager Creation', () => {
    it('should create a new message manager', () => {
      expect(messageManager).to.be.an('object');
      expect(messageManager).to.have.property('messages').that.is.an('array');
      expect(messageManager.messages).to.be.empty;
    });
  });
  
  describe('Message Types', () => {
    it('should have the correct message types', () => {
      expect(MessageType).to.be.an('object');
      expect(MessageType).to.have.property('INFO', 'info');
      expect(MessageType).to.have.property('WARNING', 'warning');
      expect(MessageType).to.have.property('ERROR', 'error');
    });
  });
  
  describe('Message Codes', () => {
    it('should have the correct message codes', () => {
      expect(MessageCode).to.be.an('object');
      
      // Info codes
      expect(MessageCode).to.have.property('INFO_TRANSACTION_PROCESSED', 'INFO_001');
      expect(MessageCode).to.have.property('INFO_WALLET_CREATED', 'INFO_002');
      expect(MessageCode).to.have.property('INFO_BALANCE_UPDATED', 'INFO_003');
      expect(MessageCode).to.have.property('INFO_RECONCILIATION_COMPLETE', 'INFO_004');
      
      // Warning codes
      expect(MessageCode).to.have.property('WARN_PRIMARY_WALLET_BALANCE_LOW', 'WARN_001');
      expect(MessageCode).to.have.property('WARN_BALANCE_DISCREPANCY', 'WARN_002');
      expect(MessageCode).to.have.property('WARN_RECONCILIATION_NEEDED', 'WARN_003');
      expect(MessageCode).to.have.property('WARN_TRANSACTION_DELAYED', 'WARN_004');
      
      // Error codes
      expect(MessageCode).to.have.property('ERROR_INSUFFICIENT_BALANCE', 'ERROR_001');
      expect(MessageCode).to.have.property('ERROR_WALLET_NOT_FOUND', 'ERROR_002');
      expect(MessageCode).to.have.property('ERROR_TRANSACTION_FAILED', 'ERROR_003');
      expect(MessageCode).to.have.property('ERROR_INVALID_PARAMETERS', 'ERROR_004');
    });
  });
  
  describe('Adding Messages', () => {
    it('should add an info message', () => {
      messageManager.addInfo(
        MessageCode.INFO_TRANSACTION_PROCESSED,
        'Transaction processed successfully',
        { txid: '0x1234567890abcdef' }
      );
      
      expect(messageManager.messages).to.have.lengthOf(1);
      expect(messageManager.messages[0]).to.have.property('type', MessageType.INFO);
      expect(messageManager.messages[0]).to.have.property('code', MessageCode.INFO_TRANSACTION_PROCESSED);
      expect(messageManager.messages[0]).to.have.property('message', 'Transaction processed successfully');
      expect(messageManager.messages[0]).to.have.property('data').that.deep.equals({ txid: '0x1234567890abcdef' });
      expect(messageManager.messages[0]).to.have.property('timestamp');
    });
    
    it('should add a warning message', () => {
      messageManager.addWarning(
        MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW,
        'Primary wallet balance is low',
        { balance: 0.1, threshold: 0.5 }
      );
      
      expect(messageManager.messages).to.have.lengthOf(1);
      expect(messageManager.messages[0]).to.have.property('type', MessageType.WARNING);
      expect(messageManager.messages[0]).to.have.property('code', MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW);
      expect(messageManager.messages[0]).to.have.property('message', 'Primary wallet balance is low');
      expect(messageManager.messages[0]).to.have.property('data').that.deep.equals({ balance: 0.1, threshold: 0.5 });
      expect(messageManager.messages[0]).to.have.property('timestamp');
    });
    
    it('should add an error message', () => {
      messageManager.addError(
        MessageCode.ERROR_INSUFFICIENT_BALANCE,
        'Insufficient balance for withdrawal',
        { available: 0.1, requested: 0.5 }
      );
      
      expect(messageManager.messages).to.have.lengthOf(1);
      expect(messageManager.messages[0]).to.have.property('type', MessageType.ERROR);
      expect(messageManager.messages[0]).to.have.property('code', MessageCode.ERROR_INSUFFICIENT_BALANCE);
      expect(messageManager.messages[0]).to.have.property('message', 'Insufficient balance for withdrawal');
      expect(messageManager.messages[0]).to.have.property('data').that.deep.equals({ available: 0.1, requested: 0.5 });
      expect(messageManager.messages[0]).to.have.property('timestamp');
    });
    
    it('should add multiple messages of different types', () => {
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      messageManager.addWarning(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW, 'Balance low');
      messageManager.addError(MessageCode.ERROR_INSUFFICIENT_BALANCE, 'Insufficient balance');
      
      expect(messageManager.messages).to.have.lengthOf(3);
      expect(messageManager.messages[0]).to.have.property('type', MessageType.INFO);
      expect(messageManager.messages[1]).to.have.property('type', MessageType.WARNING);
      expect(messageManager.messages[2]).to.have.property('type', MessageType.ERROR);
    });
  });
  
  describe('Getting Messages', () => {
    beforeEach(() => {
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      messageManager.addWarning(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW, 'Balance low');
      messageManager.addError(MessageCode.ERROR_INSUFFICIENT_BALANCE, 'Insufficient balance');
    });
    
    it('should get all messages', () => {
      const messages = messageManager.getMessages();
      
      expect(messages).to.be.an('array');
      expect(messages).to.have.lengthOf(3);
      expect(messages).to.deep.equal(messageManager.messages);
      
      // Ensure the returned array is a copy, not a reference
      messages.push({ type: 'test' });
      expect(messageManager.messages).to.have.lengthOf(3);
    });
    
    it('should get messages by type', () => {
      const infoMessages = messageManager.getMessagesByType(MessageType.INFO);
      const warningMessages = messageManager.getMessagesByType(MessageType.WARNING);
      const errorMessages = messageManager.getMessagesByType(MessageType.ERROR);
      
      expect(infoMessages).to.be.an('array');
      expect(infoMessages).to.have.lengthOf(1);
      expect(infoMessages[0]).to.have.property('type', MessageType.INFO);
      
      expect(warningMessages).to.be.an('array');
      expect(warningMessages).to.have.lengthOf(1);
      expect(warningMessages[0]).to.have.property('type', MessageType.WARNING);
      
      expect(errorMessages).to.be.an('array');
      expect(errorMessages).to.have.lengthOf(1);
      expect(errorMessages[0]).to.have.property('type', MessageType.ERROR);
    });
    
    it('should get messages by code', () => {
      const transactionMessages = messageManager.getMessagesByCode(MessageCode.INFO_TRANSACTION_PROCESSED);
      const balanceMessages = messageManager.getMessagesByCode(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW);
      
      expect(transactionMessages).to.be.an('array');
      expect(transactionMessages).to.have.lengthOf(1);
      expect(transactionMessages[0]).to.have.property('code', MessageCode.INFO_TRANSACTION_PROCESSED);
      
      expect(balanceMessages).to.be.an('array');
      expect(balanceMessages).to.have.lengthOf(1);
      expect(balanceMessages[0]).to.have.property('code', MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW);
    });
  });
  
  describe('Checking Message Presence', () => {
    it('should check if there are any messages', () => {
      expect(messageManager.hasMessages()).to.be.false;
      
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      
      expect(messageManager.hasMessages()).to.be.true;
    });
    
    it('should check if there are messages of a specific type', () => {
      expect(messageManager.hasMessagesOfType(MessageType.INFO)).to.be.false;
      expect(messageManager.hasMessagesOfType(MessageType.WARNING)).to.be.false;
      expect(messageManager.hasMessagesOfType(MessageType.ERROR)).to.be.false;
      
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      
      expect(messageManager.hasMessagesOfType(MessageType.INFO)).to.be.true;
      expect(messageManager.hasMessagesOfType(MessageType.WARNING)).to.be.false;
      expect(messageManager.hasMessagesOfType(MessageType.ERROR)).to.be.false;
    });
    
    it('should check if there are error messages', () => {
      expect(messageManager.hasErrors()).to.be.false;
      
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      expect(messageManager.hasErrors()).to.be.false;
      
      messageManager.addError(MessageCode.ERROR_INSUFFICIENT_BALANCE, 'Insufficient balance');
      expect(messageManager.hasErrors()).to.be.true;
    });
    
    it('should check if there are warning messages', () => {
      expect(messageManager.hasWarnings()).to.be.false;
      
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      expect(messageManager.hasWarnings()).to.be.false;
      
      messageManager.addWarning(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW, 'Balance low');
      expect(messageManager.hasWarnings()).to.be.true;
    });
  });
  
  describe('Clearing Messages', () => {
    it('should clear all messages', () => {
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      messageManager.addWarning(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW, 'Balance low');
      
      expect(messageManager.messages).to.have.lengthOf(2);
      
      messageManager.clear();
      
      expect(messageManager.messages).to.be.empty;
    });
  });
  
  describe('Creating Response', () => {
    it('should create a response with messages', () => {
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      messageManager.addWarning(MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW, 'Balance low');
      
      const data = { success: true, txid: '0x1234567890abcdef' };
      const response = messageManager.createResponse(data);
      
      expect(response).to.be.an('object');
      expect(response).to.have.property('data').that.deep.equals(data);
      expect(response).to.have.property('messages').that.is.an('array');
      expect(response.messages).to.have.lengthOf(2);
      expect(response.messages[0]).to.have.property('type', MessageType.INFO);
      expect(response.messages[1]).to.have.property('type', MessageType.WARNING);
    });
    
    it('should create a response with empty data if not provided', () => {
      messageManager.addInfo(MessageCode.INFO_TRANSACTION_PROCESSED, 'Transaction processed');
      
      const response = messageManager.createResponse();
      
      expect(response).to.be.an('object');
      expect(response).to.have.property('data').that.deep.equals({});
      expect(response).to.have.property('messages').that.is.an('array');
      expect(response.messages).to.have.lengthOf(1);
    });
  });
  
  describe('API Integration', () => {
    let app;
    let request;
    
    beforeEach(() => {
      // Mock the API server
      request = require('supertest');
      const express = require('express');
      
      app = express();
      app.use(express.json());
      
      // Mock endpoint that uses the message manager
      app.post('/api/transactions/withdraw', (req, res) => {
        const { internalWalletId, toAddress, amount } = req.body;
        
        // Create a new message manager for this request
        const msgManager = createMessageManager();
        
        // Validate request parameters
        if (!internalWalletId || !toAddress || !amount) {
          msgManager.addError(
            MessageCode.ERROR_INVALID_PARAMETERS,
            'Missing required parameters',
            { required: ['internalWalletId', 'toAddress', 'amount'] }
          );
          return res.status(400).json(msgManager.createResponse());
        }
        
        // Simulate a successful withdrawal
        const result = {
          id: 'withdrawal_1',
          internalWalletId,
          toAddress,
          amount: parseFloat(amount),
          fee: 0.0001,
          timestamp: new Date().toISOString()
        };
        
        // Add success message
        msgManager.addInfo(
          MessageCode.INFO_TRANSACTION_PROCESSED,
          'Withdrawal processed successfully',
          { txid: '0x1234567890abcdef' }
        );
        
        // Add warning if balance is low after withdrawal
        if (parseFloat(amount) > 0.5) {
          msgManager.addWarning(
            MessageCode.WARN_PRIMARY_WALLET_BALANCE_LOW,
            'Primary wallet balance is low after withdrawal',
            { balance: 0.4, threshold: 0.5 }
          );
        }
        
        // Return response with messages
        res.json(msgManager.createResponse({ withdrawal: result }));
      });
    });
    
    it('should include messages in API responses', async () => {
      const response = await request(app)
        .post('/api/transactions/withdraw')
        .send({
          internalWalletId: 'internal_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.1
        })
        .expect(200);
      
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('withdrawal');
      expect(response.body.data.withdrawal).to.have.property('id', 'withdrawal_1');
      
      expect(response.body).to.have.property('messages');
      expect(response.body.messages).to.be.an('array');
      expect(response.body.messages).to.have.lengthOf(1);
      expect(response.body.messages[0]).to.have.property('type', 'info');
      expect(response.body.messages[0]).to.have.property('code', 'INFO_001');
      expect(response.body.messages[0]).to.have.property('message', 'Withdrawal processed successfully');
    });
    
    it('should include warning messages when appropriate', async () => {
      const response = await request(app)
        .post('/api/transactions/withdraw')
        .send({
          internalWalletId: 'internal_wallet_1',
          toAddress: 'bc1q...',
          amount: 0.6 // This will trigger the warning
        })
        .expect(200);
      
      expect(response.body).to.have.property('messages');
      expect(response.body.messages).to.be.an('array');
      expect(response.body.messages).to.have.lengthOf(2);
      
      const infoMessage = response.body.messages.find(m => m.type === 'info');
      const warningMessage = response.body.messages.find(m => m.type === 'warning');
      
      expect(infoMessage).to.exist;
      expect(infoMessage).to.have.property('code', 'INFO_001');
      
      expect(warningMessage).to.exist;
      expect(warningMessage).to.have.property('code', 'WARN_001');
      expect(warningMessage).to.have.property('message', 'Primary wallet balance is low after withdrawal');
      expect(warningMessage).to.have.property('data');
      expect(warningMessage.data).to.have.property('balance', 0.4);
      expect(warningMessage.data).to.have.property('threshold', 0.5);
    });
    
    it('should return error messages for invalid requests', async () => {
      const response = await request(app)
        .post('/api/transactions/withdraw')
        .send({
          // Missing required parameters
          internalWalletId: 'internal_wallet_1'
        })
        .expect(400);
      
      expect(response.body).to.have.property('data').that.deep.equals({});
      expect(response.body).to.have.property('messages');
      expect(response.body.messages).to.be.an('array');
      expect(response.body.messages).to.have.lengthOf(1);
      expect(response.body.messages[0]).to.have.property('type', 'error');
      expect(response.body.messages[0]).to.have.property('code', 'ERROR_004');
      expect(response.body.messages[0]).to.have.property('message', 'Missing required parameters');
      expect(response.body.messages[0]).to.have.property('data');
      expect(response.body.messages[0].data).to.have.property('required').that.includes('toAddress');
      expect(response.body.messages[0].data).to.have.property('required').that.includes('amount');
    });
  });
  
  describe('Real-world Use Cases', () => {
    it('should handle balance reconciliation messages', () => {
      const msgManager = createMessageManager();
      
      // Simulate a balance discrepancy
      msgManager.addWarning(
        MessageCode.WARN_BALANCE_DISCREPANCY,
        'Balance discrepancy detected',
        {
          blockchain: 'bitcoin',
          primaryWalletName: 'btc_wallet_1',
          onChainBalance: 1.5,
          aggregateInternalBalance: 1.6,
          difference: 0.1
        }
      );
      
      // Add a reconciliation needed message
      msgManager.addWarning(
        MessageCode.WARN_RECONCILIATION_NEEDED,
        'Manual reconciliation recommended',
        {
          lastReconciliation: '2025-03-12T12:00:00Z',
          threshold: '24h'
        }
      );
      
      const response = msgManager.createResponse({ success: true });
      
      expect(response).to.have.property('data').that.deep.equals({ success: true });
      expect(response).to.have.property('messages').that.is.an('array');
      expect(response.messages).to.have.lengthOf(2);
      
      const discrepancyMessage = response.messages.find(m => m.code === MessageCode.WARN_BALANCE_DISCREPANCY);
      const reconciliationMessage = response.messages.find(m => m.code === MessageCode.WARN_RECONCILIATION_NEEDED);
      
      expect(discrepancyMessage).to.exist;
      expect(discrepancyMessage.data).to.have.property('difference', 0.1);
      
      expect(reconciliationMessage).to.exist;
      expect(reconciliationMessage.data).to.have.property('lastReconciliation', '2025-03-12T12:00:00Z');
    });
    
    it('should handle transaction failure messages', () => {
      const msgManager = createMessageManager();
      
      // Simulate a transaction failure
      msgManager.addError(
        MessageCode.ERROR_TRANSACTION_FAILED,
        'Transaction failed',
        {
          reason: 'Network error',
          txid: '0x1234567890abcdef',
          retryable: true
        }
      );
      
      // Add a transaction delayed message
      msgManager.addWarning(
        MessageCode.WARN_TRANSACTION_DELAYED,
        'Transaction is delayed',
        {
          txid: '0x1234567890abcdef',
          submittedAt: '2025-03-12T12:00:00Z',
          currentDelay: '30m'
        }
      );
      
      const response = msgManager.createResponse({ success: false });
      
      expect(response).to.have.property('data').that.deep.equals({ success: false });
      expect(response).to.have.property('messages').that.is.an('array');
      expect(response.messages).to.have.lengthOf(2);
      
      const errorMessage = response.messages.find(m => m.code === MessageCode.ERROR_TRANSACTION_FAILED);
      const delayMessage = response.messages.find(m => m.code === MessageCode.WARN_TRANSACTION_DELAYED);
      
      expect(errorMessage).to.exist;
      expect(errorMessage.data).to.have.property('reason', 'Network error');
      expect(errorMessage.data).to.have.property('retryable', true);
      
      expect(delayMessage).to.exist;
      expect(delayMessage.data).to.have.property('txid', '0x1234567890abcdef');
      expect(delayMessage.data).to.have.property('currentDelay', '30m');
    });
  });
});
