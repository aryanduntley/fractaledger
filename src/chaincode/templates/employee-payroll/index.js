/*
 * FractaLedger Employee Payroll Chaincode
 *
 * This is a customized chaincode template for the FractaLedger system,
 * specifically designed for employer/employee payroll management.
 * It extends the default template with additional functionality for
 * handling employee salary payments on a scheduled basis.
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class EmployeePayrollContract extends Contract {
  /**
   * Initialize the ledger
   * @param {Context} ctx The transaction context
   */
  async initLedger(ctx) {
    console.info('============= START : Initialize Ledger ===========');
    
    // Initialize any required data structures
    
    // Initialize payroll configuration
    const payrollConfig = {
      defaultPaymentFrequency: 'monthly', // Default payment frequency
      paymentDayOfMonth: 15, // Default payment day for monthly payments
      paymentDayOfWeek: 5, // Default payment day for weekly payments (5 = Friday)
      taxRate: 0, // Default tax rate (0% - no tax withholding by default)
      updatedAt: new Date().toISOString()
    };
    
    // Store the payroll configuration on the ledger
    await ctx.stub.putState('PAYROLL_CONFIG', Buffer.from(JSON.stringify(payrollConfig)));
    
    console.info('============= END : Initialize Ledger ===========');
  }
  
  /**
   * Create a new internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @param {string} blockchain The blockchain type (bitcoin, litecoin, dogecoin)
   * @param {string} primaryWalletName The primary wallet name
   * @param {string} type The wallet type (employer, employee)
   * @returns {Object} The created internal wallet
   */
  async createInternalWallet(ctx, id, blockchain, primaryWalletName, type = 'employee') {
    console.info('============= START : Create Internal Wallet ===========');
    
    // Check if the internal wallet already exists
    const walletAsBytes = await ctx.stub.getState(id);
    if (walletAsBytes && walletAsBytes.length > 0) {
      throw new Error(`Internal wallet ${id} already exists`);
    }
    
    // Create the internal wallet
    const internalWallet = {
      id,
      blockchain,
      primaryWalletName,
      type, // Wallet type (employer or employee)
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store the internal wallet on the ledger
    await ctx.stub.putState(id, Buffer.from(JSON.stringify(internalWallet)));
    
    console.info('============= END : Create Internal Wallet ===========');
    
    return internalWallet;
  }
  
  /**
   * Get an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @returns {Object} The internal wallet
   */
  async getInternalWallet(ctx, id) {
    console.info('============= START : Get Internal Wallet ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    console.info('============= END : Get Internal Wallet ===========');
    
    return internalWallet;
  }
  
  /**
   * Get all internal wallets
   * @param {Context} ctx The transaction context
   * @returns {Array} All internal wallets
   */
  async getAllInternalWallets(ctx) {
    console.info('============= START : Get All Internal Wallets ===========');
    
    // Get all internal wallets from the ledger
    const startKey = '';
    const endKey = '';
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    
    const internalWallets = [];
    
    let result = await iterator.next();
    while (!result.done) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const internalWallet = JSON.parse(value);
        // Only include actual wallet objects (not configuration or other data)
        if (internalWallet.id && internalWallet.blockchain) {
          internalWallets.push(internalWallet);
        }
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get All Internal Wallets ===========');
    
    return internalWallets;
  }
  
  /**
   * Update the balance of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @param {number} balance The new balance
   * @returns {Object} The updated internal wallet
   */
  async updateInternalWalletBalance(ctx, id, balance) {
    console.info('============= START : Update Internal Wallet Balance ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    // Update the balance
    internalWallet.balance = parseFloat(balance);
    internalWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallet on the ledger
    await ctx.stub.putState(id, Buffer.from(JSON.stringify(internalWallet)));
    
    console.info('============= END : Update Internal Wallet Balance ===========');
    
    return internalWallet;
  }
  
  /**
   * Get the balance of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} id The internal wallet ID
   * @returns {Object} The internal wallet balance
   */
  async getInternalWalletBalance(ctx, id) {
    console.info('============= START : Get Internal Wallet Balance ===========');
    
    // Get the internal wallet from the ledger
    const walletAsBytes = await ctx.stub.getState(id);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${id} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    console.info('============= END : Get Internal Wallet Balance ===========');
    
    return {
      id,
      balance: internalWallet.balance
    };
  }
  
  /**
   * Transfer funds between internal wallets
   * @param {Context} ctx The transaction context
   * @param {string} fromWalletId The source internal wallet ID
   * @param {string} toWalletId The destination internal wallet ID
   * @param {number} amount The amount to transfer
   * @returns {Object} The transfer result
   */
  async transferBetweenInternalWallets(ctx, fromWalletId, toWalletId, amount) {
    console.info('============= START : Transfer Between Internal Wallets ===========');
    
    // Parse the amount
    const transferAmount = parseFloat(amount);
    
    // Get the source internal wallet
    const fromWalletAsBytes = await ctx.stub.getState(fromWalletId);
    if (!fromWalletAsBytes || fromWalletAsBytes.length === 0) {
      throw new Error(`Source internal wallet ${fromWalletId} does not exist`);
    }
    
    const fromWallet = JSON.parse(fromWalletAsBytes.toString());
    
    // Get the destination internal wallet
    const toWalletAsBytes = await ctx.stub.getState(toWalletId);
    if (!toWalletAsBytes || toWalletAsBytes.length === 0) {
      throw new Error(`Destination internal wallet ${toWalletId} does not exist`);
    }
    
    const toWallet = JSON.parse(toWalletAsBytes.toString());
    
    // Check if the source wallet has enough balance
    if (fromWallet.balance < transferAmount) {
      throw new Error(`Insufficient balance in source internal wallet ${fromWalletId}`);
    }
    
    // Update the balances
    fromWallet.balance -= transferAmount;
    fromWallet.updatedAt = new Date().toISOString();
    
    toWallet.balance += transferAmount;
    toWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallets on the ledger
    await ctx.stub.putState(fromWalletId, Buffer.from(JSON.stringify(fromWallet)));
    await ctx.stub.putState(toWalletId, Buffer.from(JSON.stringify(toWallet)));
    
    // Create a transfer record
    const transferId = ctx.stub.getTxID();
    const transfer = {
      id: transferId,
      fromWalletId,
      toWalletId,
      amount: transferAmount,
      timestamp: new Date().toISOString()
    };
    
    // Store the transfer record on the ledger
    await ctx.stub.putState(`TRANSFER_${transferId}`, Buffer.from(JSON.stringify(transfer)));
    
    console.info('============= END : Transfer Between Internal Wallets ===========');
    
    return transfer;
  }
  
  /**
   * Withdraw funds from an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} internalWalletId The internal wallet ID
   * @param {string} toAddress The destination address
   * @param {number} amount The amount to withdraw
   * @param {number} fee The transaction fee
   * @returns {Object} The withdrawal result
   */
  async withdrawFromInternalWallet(ctx, internalWalletId, toAddress, amount, fee) {
    console.info('============= START : Withdraw From Internal Wallet ===========');
    
    // Parse the amount and fee
    const withdrawalAmount = parseFloat(amount);
    const transactionFee = parseFloat(fee);
    const totalAmount = withdrawalAmount + transactionFee;
    
    // Get the internal wallet
    const walletAsBytes = await ctx.stub.getState(internalWalletId);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${internalWalletId} does not exist`);
    }
    
    const internalWallet = JSON.parse(walletAsBytes.toString());
    
    // Check if the internal wallet has enough balance
    if (internalWallet.balance < totalAmount) {
      throw new Error(`Insufficient balance in internal wallet ${internalWalletId}`);
    }
    
    // Update the balance
    internalWallet.balance -= totalAmount;
    internalWallet.updatedAt = new Date().toISOString();
    
    // Store the updated internal wallet on the ledger
    await ctx.stub.putState(internalWalletId, Buffer.from(JSON.stringify(internalWallet)));
    
    // Create a withdrawal record
    const withdrawalId = ctx.stub.getTxID();
    const withdrawal = {
      id: withdrawalId,
      internalWalletId,
      toAddress,
      amount: withdrawalAmount,
      fee: transactionFee,
      timestamp: new Date().toISOString()
    };
    
    // Store the withdrawal record on the ledger
    await ctx.stub.putState(`WITHDRAWAL_${withdrawalId}`, Buffer.from(JSON.stringify(withdrawal)));
    
    console.info('============= END : Withdraw From Internal Wallet ===========');
    
    return withdrawal;
  }
  
  /**
   * Get the transaction history of an internal wallet
   * @param {Context} ctx The transaction context
   * @param {string} internalWalletId The internal wallet ID
   * @param {number} limit The maximum number of transactions to return
   * @returns {Array} The transaction history
   */
  async getTransactionHistory(ctx, internalWalletId, limit = '10') {
    console.info('============= START : Get Transaction History ===========');
    
    // Get the transaction history from the ledger
    const iterator = await ctx.stub.getHistoryForKey(internalWalletId);
    
    const transactions = [];
    let count = 0;
    const maxLimit = parseInt(limit);
    
    let result = await iterator.next();
    while (!result.done && count < maxLimit) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const transaction = {
          txid: result.value.txId,
          timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
          value: JSON.parse(value)
        };
        transactions.push(transaction);
        count++;
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get Transaction History ===========');
    
    return transactions;
  }
  
  // Employee Payroll Specific Functions
  
  /**
   * Update the payroll configuration
   * @param {Context} ctx The transaction context
   * @param {string} defaultPaymentFrequency The default payment frequency
   * @param {number} paymentDayOfMonth The payment day of month for monthly payments
   * @param {number} paymentDayOfWeek The payment day of week for weekly payments
   * @param {number} taxRate The tax rate for withholding
   * @returns {Object} The updated payroll configuration
   */
  async updatePayrollConfiguration(ctx, defaultPaymentFrequency, paymentDayOfMonth, paymentDayOfWeek, taxRate) {
    console.info('============= START : Update Payroll Configuration ===========');
    
    // Parse the parameters
    const dayOfMonth = parseInt(paymentDayOfMonth);
    const dayOfWeek = parseInt(paymentDayOfWeek);
    const tax = parseFloat(taxRate);
    
    // Get the current payroll configuration
    const payrollConfigAsBytes = await ctx.stub.getState('PAYROLL_CONFIG');
    let payrollConfig = {};
    
    if (payrollConfigAsBytes && payrollConfigAsBytes.length > 0) {
      payrollConfig = JSON.parse(payrollConfigAsBytes.toString());
    }
    
    // Update the payroll configuration
    payrollConfig.defaultPaymentFrequency = defaultPaymentFrequency;
    payrollConfig.paymentDayOfMonth = dayOfMonth;
    payrollConfig.paymentDayOfWeek = dayOfWeek;
    payrollConfig.taxRate = tax;
    payrollConfig.updatedAt = new Date().toISOString();
    
    // Store the updated payroll configuration on the ledger
    await ctx.stub.putState('PAYROLL_CONFIG', Buffer.from(JSON.stringify(payrollConfig)));
    
    console.info('============= END : Update Payroll Configuration ===========');
    
    return payrollConfig;
  }
  
  /**
   * Get the payroll configuration
   * @param {Context} ctx The transaction context
   * @returns {Object} The payroll configuration
   */
  async getPayrollConfiguration(ctx) {
    console.info('============= START : Get Payroll Configuration ===========');
    
    // Get the payroll configuration from the ledger
    const payrollConfigAsBytes = await ctx.stub.getState('PAYROLL_CONFIG');
    if (!payrollConfigAsBytes || payrollConfigAsBytes.length === 0) {
      throw new Error('Payroll configuration does not exist');
    }
    
    const payrollConfig = JSON.parse(payrollConfigAsBytes.toString());
    
    console.info('============= END : Get Payroll Configuration ===========');
    
    return payrollConfig;
  }
  
  /**
   * Register a new employee
   * @param {Context} ctx The transaction context
   * @param {string} id The employee ID
   * @param {string} name The employee name
   * @param {string} walletId The employee's internal wallet ID
   * @param {number} salary The employee's salary
   * @param {string} department The employee's department
   * @param {string} position The employee's position
   * @param {string} startDate The employee's start date
   * @param {string} paymentFrequency The employee's payment frequency
   * @param {string} metadata Additional employee metadata (JSON string)
   * @returns {Object} The registered employee
   */
  async registerEmployee(ctx, id, name, walletId, salary, department, position, startDate, paymentFrequency, metadata) {
    console.info('============= START : Register Employee ===========');
    
    // Check if the employee already exists
    const employeeAsBytes = await ctx.stub.getState(`EMPLOYEE_${id}`);
    if (employeeAsBytes && employeeAsBytes.length > 0) {
      throw new Error(`Employee ${id} already exists`);
    }
    
    // Check if the wallet exists
    const walletAsBytes = await ctx.stub.getState(walletId);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${walletId} does not exist`);
    }
    
    // Parse the salary
    const employeeSalary = parseFloat(salary);
    
    // Parse the metadata
    let employeeMetadata = {};
    if (metadata) {
      employeeMetadata = JSON.parse(metadata);
    }
    
    // Create the employee
    const employee = {
      id,
      name,
      walletId,
      salary: employeeSalary,
      department,
      position,
      startDate,
      paymentFrequency,
      lastPaymentDate: null,
      status: 'active',
      metadata: employeeMetadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store the employee on the ledger
    await ctx.stub.putState(`EMPLOYEE_${id}`, Buffer.from(JSON.stringify(employee)));
    
    console.info('============= END : Register Employee ===========');
    
    return employee;
  }
  
  /**
   * Update employee information
   * @param {Context} ctx The transaction context
   * @param {string} id The employee ID
   * @param {string} name The employee name
   * @param {string} walletId The employee's internal wallet ID
   * @param {number} salary The employee's salary
   * @param {string} department The employee's department
   * @param {string} position The employee's position
   * @param {string} paymentFrequency The employee's payment frequency
   * @param {string} status The employee's status
   * @param {string} metadata Additional employee metadata (JSON string)
   * @returns {Object} The updated employee
   */
  async updateEmployeeInfo(ctx, id, name, walletId, salary, department, position, paymentFrequency, status, metadata) {
    console.info('============= START : Update Employee Info ===========');
    
    // Get the employee from the ledger
    const employeeAsBytes = await ctx.stub.getState(`EMPLOYEE_${id}`);
    if (!employeeAsBytes || employeeAsBytes.length === 0) {
      throw new Error(`Employee ${id} does not exist`);
    }
    
    const employee = JSON.parse(employeeAsBytes.toString());
    
    // Check if the wallet exists
    const walletAsBytes = await ctx.stub.getState(walletId);
    if (!walletAsBytes || walletAsBytes.length === 0) {
      throw new Error(`Internal wallet ${walletId} does not exist`);
    }
    
    // Parse the salary
    const employeeSalary = parseFloat(salary);
    
    // Parse the metadata
    let employeeMetadata = {};
    if (metadata) {
      employeeMetadata = JSON.parse(metadata);
    }
    
    // Update the employee
    employee.name = name;
    employee.walletId = walletId;
    employee.salary = employeeSalary;
    employee.department = department;
    employee.position = position;
    employee.paymentFrequency = paymentFrequency;
    employee.status = status;
    employee.metadata = employeeMetadata;
    employee.updatedAt = new Date().toISOString();
    
    // Store the updated employee on the ledger
    await ctx.stub.putState(`EMPLOYEE_${id}`, Buffer.from(JSON.stringify(employee)));
    
    console.info('============= END : Update Employee Info ===========');
    
    return employee;
  }
  
  /**
   * Get an employee
   * @param {Context} ctx The transaction context
   * @param {string} id The employee ID
   * @returns {Object} The employee
   */
  async getEmployee(ctx, id) {
    console.info('============= START : Get Employee ===========');
    
    // Get the employee from the ledger
    const employeeAsBytes = await ctx.stub.getState(`EMPLOYEE_${id}`);
    if (!employeeAsBytes || employeeAsBytes.length === 0) {
      throw new Error(`Employee ${id} does not exist`);
    }
    
    const employee = JSON.parse(employeeAsBytes.toString());
    
    console.info('============= END : Get Employee ===========');
    
    return employee;
  }
  
  /**
   * Get all employees
   * @param {Context} ctx The transaction context
   * @returns {Array} All employees
   */
  async getAllEmployees(ctx) {
    console.info('============= START : Get All Employees ===========');
    
    // Get all employees from the ledger
    const startKey = 'EMPLOYEE_';
    const endKey = 'EMPLOYEE_\uffff';
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    
    const employees = [];
    
    let result = await iterator.next();
    while (!result.done) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const employee = JSON.parse(value);
        employees.push(employee);
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get All Employees ===========');
    
    return employees;
  }
  
  /**
   * Deactivate an employee
   * @param {Context} ctx The transaction context
   * @param {string} id The employee ID
   * @returns {Object} The deactivated employee
   */
  async deactivateEmployee(ctx, id) {
    console.info('============= START : Deactivate Employee ===========');
    
    // Get the employee from the ledger
    const employeeAsBytes = await ctx.stub.getState(`EMPLOYEE_${id}`);
    if (!employeeAsBytes || employeeAsBytes.length === 0) {
      throw new Error(`Employee ${id} does not exist`);
    }
    
    const employee = JSON.parse(employeeAsBytes.toString());
    
    // Update the employee status
    employee.status = 'inactive';
    employee.updatedAt = new Date().toISOString();
    
    // Store the updated employee on the ledger
    await ctx.stub.putState(`EMPLOYEE_${id}`, Buffer.from(JSON.stringify(employee)));
    
    console.info('============= END : Deactivate Employee ===========');
    
    return employee;
  }
  
  /**
   * Process a payment for a specific employee
   * @param {Context} ctx The transaction context
   * @param {string} employerId The employer's internal wallet ID
   * @param {string} employeeId The employee ID
   * @param {number} amount The payment amount (optional, defaults to employee's salary)
   * @param {string} paymentType The payment type (regular, bonus, adjustment)
   * @returns {Object} The payment result
   */
  async processIndividualPayment(ctx, employerId, employeeId, amount = null, paymentType = 'regular') {
    console.info('============= START : Process Individual Payment ===========');
    
    // Get the employer wallet
    const employerWalletAsBytes = await ctx.stub.getState(employerId);
    if (!employerWalletAsBytes || employerWalletAsBytes.length === 0) {
      throw new Error(`Employer wallet ${employerId} does not exist`);
    }
    
    const employerWallet = JSON.parse(employerWalletAsBytes.toString());
    
    // Check if the wallet is an employer wallet
    if (employerWallet.type !== 'employer') {
      throw new Error(`Wallet ${employerId} is not an employer wallet`);
    }
    
    // Get the employee
    const employeeAsBytes = await ctx.stub.getState(`EMPLOYEE_${employeeId}`);
    if (!employeeAsBytes || employeeAsBytes.length === 0) {
      throw new Error(`Employee ${employeeId} does not exist`);
    }
    
    const employee = JSON.parse(employeeAsBytes.toString());
    
    // Check if the employee is active
    if (employee.status !== 'active') {
      throw new Error(`Employee ${employeeId} is not active`);
    }
    
    // Get the employee wallet
    const employeeWalletAsBytes = await ctx.stub.getState(employee.walletId);
    if (!employeeWalletAsBytes || employeeWalletAsBytes.length === 0) {
      throw new Error(`Employee wallet ${employee.walletId} does not exist`);
    }
    
    const employeeWallet = JSON.parse(employeeWalletAsBytes.toString());
    
    // Determine the payment amount
    let paymentAmount = amount ? parseFloat(amount) : employee.salary;
    
    // Get the payroll configuration for tax withholding
    const payrollConfigAsBytes = await ctx.stub.getState('PAYROLL_CONFIG');
    if (!payrollConfigAsBytes || payrollConfigAsBytes.length === 0) {
      throw new Error('Payroll configuration does not exist');
    }
    
    const payrollConfig = JSON.parse(payrollConfigAsBytes.toString());
    
    // Calculate tax withholding if applicable
    let taxAmount = 0;
    let grossAmount = paymentAmount;
    
    if (payrollConfig.taxRate > 0) {
      taxAmount = paymentAmount * (payrollConfig.taxRate / 100);
      paymentAmount -= taxAmount;
    }
    
    // Check if the employer wallet has enough balance
    if (employerWallet.balance < grossAmount) {
      throw new Error(`Insufficient balance in employer wallet ${employerId}`);
    }
    
    // Update the balances
    employerWallet.balance -= grossAmount;
    employerWallet.updatedAt = new Date().toISOString();
    
    employeeWallet.balance += paymentAmount;
    employeeWallet.updatedAt = new Date().toISOString();
    
    // Store the updated wallets on the ledger
    await ctx.stub.putState(employerId, Buffer.from(JSON.stringify(employerWallet)));
    await ctx.stub.putState(employee.walletId, Buffer.from(JSON.stringify(employeeWallet)));
    
    // Update the employee's last payment date
    employee.lastPaymentDate = new Date().toISOString();
    employee.updatedAt = new Date().toISOString();
    
    // Store the updated employee on the ledger
    await ctx.stub.putState(`EMPLOYEE_${employeeId}`, Buffer.from(JSON.stringify(employee)));
    
    // Create a payment record
    const paymentId = ctx.stub.getTxID();
    const payment = {
      id: paymentId,
      employerId,
      employeeId,
      employeeWalletId: employee.walletId,
      grossAmount,
      netAmount: paymentAmount,
      taxAmount,
      paymentType,
      timestamp: new Date().toISOString()
    };
    
    // Store the payment record on the ledger
    await ctx.stub.putState(`PAYMENT_${paymentId}`, Buffer.from(JSON.stringify(payment)));
    
    console.info('============= END : Process Individual Payment ===========');
    
    return payment;
  }
  
  /**
   * Process a bonus payment for an employee
   * @param {Context} ctx The transaction context
   * @param {string} employerId The employer's internal wallet ID
   * @param {string} employeeId The employee ID
   * @param {number} amount The bonus amount
   * @returns {Object} The payment result
   */
  async processBonus(ctx, employerId, employeeId, amount) {
    console.info('============= START : Process Bonus ===========');
    
    // Process the bonus payment
    const payment = await this.processIndividualPayment(ctx, employerId, employeeId, amount, 'bonus');
    
    console.info('============= END : Process Bonus ===========');
    
    return payment;
  }
  
  /**
   * Process monthly payroll for all eligible employees
   * @param {Context} ctx The transaction context
   * @param {string} employerId The employer's internal wallet ID
   * @returns {Object} The payroll processing result
   */
  async processMonthlyPayroll(ctx, employerId) {
    console.info('============= START : Process Monthly Payroll ===========');
    
    // Get the employer wallet
    const employerWalletAsBytes = await ctx.stub.getState(employerId);
    if (!employerWalletAsBytes || employerWalletAsBytes.length === 0) {
      throw new Error(`Employer wallet ${employerId} does not exist`);
    }
    
    const employerWallet = JSON.parse(employerWalletAsBytes.toString());
    
    // Check if the wallet is an employer wallet
    if (employerWallet.type !== 'employer') {
      throw new Error(`Wallet ${employerId} is not an employer wallet`);
    }
    
    // Get all employees
    const allEmployees = await this.getAllEmployees(ctx);
    
    // Filter active employees
    const activeEmployees = allEmployees.filter(employee => employee.status === 'active');
    
    // Get the current date
    const now = new Date();
    
    // Get the payroll configuration
    const payrollConfigAsBytes = await ctx.stub.getState('PAYROLL_CONFIG');
    if (!payrollConfigAsBytes || payrollConfigAsBytes.length === 0) {
      throw new Error('Payroll configuration does not exist');
    }
    
    const payrollConfig = JSON.parse(payrollConfigAsBytes.toString());
    
    // Calculate the total payroll amount
    let totalPayrollAmount = 0;
    const eligibleEmployees = [];
    
    for (const employee of activeEmployees) {
      // Check if the employee is due for payment based on their payment frequency
      let isDue = false;
      
      if (!employee.lastPaymentDate) {
        // First payment
        isDue = true;
      } else {
        const lastPaymentDate = new Date(employee.lastPaymentDate);
        
        switch (employee.paymentFrequency) {
          case 'monthly':
            // Check if it's been a month since the last payment
            isDue = (
              now.getMonth() > lastPaymentDate.getMonth() ||
              (now.getMonth() === lastPaymentDate.getMonth() && now.getFullYear() > lastPaymentDate.getFullYear())
            ) && now.getDate() >= payrollConfig.paymentDayOfMonth;
            break;
          case 'bi-weekly':
            // Check if it's been two weeks since the last payment
            const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
            isDue = (now.getTime() - lastPaymentDate.getTime()) >= twoWeeksInMs;
            break;
          case 'weekly':
            // Check if it's been a week since the last payment
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            isDue = (now.getTime() - lastPaymentDate.getTime()) >= oneWeekInMs;
            break;
          default:
            throw new Error(`Unknown payment frequency: ${employee.paymentFrequency}`);
        }
      }
      
      if (isDue) {
        eligibleEmployees.push(employee);
        
        // Calculate tax withholding if applicable
        let taxAmount = 0;
        let grossAmount = employee.salary;
        
        if (payrollConfig.taxRate > 0) {
          taxAmount = employee.salary * (payrollConfig.taxRate / 100);
        }
        
        totalPayrollAmount += grossAmount;
      }
    }
    
    // Check if the employer wallet has enough balance
    if (employerWallet.balance < totalPayrollAmount) {
      throw new Error(`Insufficient balance in employer wallet ${employerId} for payroll`);
    }
    
    // Process payments for eligible employees
    const payments = [];
    
    for (const employee of eligibleEmployees) {
      try {
        const payment = await this.processIndividualPayment(ctx, employerId, employee.id);
        payments.push(payment);
      } catch (error) {
        console.error(`Error processing payment for employee ${employee.id}: ${error.message}`);
      }
    }
    
    // Create a payroll record
    const payrollId = ctx.stub.getTxID();
    const payroll = {
      id: payrollId,
      employerId,
      totalAmount: totalPayrollAmount,
      employeeCount: payments.length,
      timestamp: new Date().toISOString(),
      payments
    };
    
    // Store the payroll record on the ledger
    await ctx.stub.putState(`PAYROLL_${payrollId}`, Buffer.from(JSON.stringify(payroll)));
    
    console.info('============= END : Process Monthly Payroll ===========');
    
    return payroll;
  }
  
  /**
   * Get employee payment history
   * @param {Context} ctx The transaction context
   * @param {string} employeeId The employee ID
   * @param {number} limit The maximum number of payments to return
   * @returns {Array} The employee payment history
   */
  async getEmployeePaymentHistory(ctx, employeeId, limit = '10') {
    console.info('============= START : Get Employee Payment History ===========');
    
    // Get all payments from the ledger
    const startKey = 'PAYMENT_';
    const endKey = 'PAYMENT_\uffff';
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    
    const payments = [];
    let count = 0;
    const maxLimit = parseInt(limit);
    
    let result = await iterator.next();
    while (!result.done && count < maxLimit) {
      const value = result.value.value.toString('utf8');
      if (value) {
        const payment = JSON.parse(value);
        if (payment.employeeId === employeeId) {
          payments.push(payment);
          count++;
        }
      }
      result = await iterator.next();
    }
    
    await iterator.close();
    
    console.info('============= END : Get Employee Payment History ===========');
    
    return payments;
  }
}

module.exports = EmployeePayrollContract;
