/**
 * Employee Payroll API Extension
 * 
 * This extension adds endpoints for managing employees and processing payroll.
 * It is designed to work with the employee-payroll chaincode template.
 */

/**
 * Register the employee payroll extension with the API server
 * @param {Object} app The Express app instance
 * @param {Function} authenticateJWT The authentication middleware
 * @param {Object} dependencies Additional dependencies (walletManager, fabricClient, etc.)
 */
function registerEmployeePayrollExtension(app, authenticateJWT, dependencies) {
  const { walletManager, fabricClient } = dependencies;
  
  /**
   * Register a new employee
   * POST /api/employees
   */
  app.post('/api/employees', authenticateJWT, async (req, res) => {
    try {
      const { id, name, walletId, salary, department, position, paymentFrequency, startDate, metadata } = req.body;
      
      if (!id || !name || !walletId || !salary) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Check if the wallet exists
      const internalWallet = await walletManager.getInternalWallet(walletId);
      
      if (!internalWallet) {
        return res.status(404).json({ error: 'Internal wallet not found' });
      }
      
      // Register the employee
      const result = await fabricClient.submitTransaction(
        'registerEmployee',
        id,
        name,
        walletId,
        salary.toString(),
        department || '',
        position || '',
        startDate || new Date().toISOString(),
        paymentFrequency || 'monthly',
        metadata ? JSON.stringify(metadata) : '{}'
      );
      
      const employee = JSON.parse(result.toString());
      
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get all employees
   * GET /api/employees
   */
  app.get('/api/employees', authenticateJWT, async (req, res) => {
    try {
      // Get all employees from the Fabric network
      const result = await fabricClient.evaluateTransaction('getAllEmployees');
      const employees = JSON.parse(result.toString());
      
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get an employee
   * GET /api/employees/:id
   */
  app.get('/api/employees/:id', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the employee from the Fabric network
      const result = await fabricClient.evaluateTransaction('getEmployee', id);
      const employee = JSON.parse(result.toString());
      
      res.json(employee);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });
  
  /**
   * Update an employee
   * PUT /api/employees/:id
   */
  app.put('/api/employees/:id', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, walletId, salary, department, position, paymentFrequency, status, metadata } = req.body;
      
      if (!name || !walletId || !salary) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Check if the wallet exists
      const internalWallet = await walletManager.getInternalWallet(walletId);
      
      if (!internalWallet) {
        return res.status(404).json({ error: 'Internal wallet not found' });
      }
      
      // Update the employee
      const result = await fabricClient.submitTransaction(
        'updateEmployeeInfo',
        id,
        name,
        walletId,
        salary.toString(),
        department || '',
        position || '',
        paymentFrequency || 'monthly',
        status || 'active',
        metadata ? JSON.stringify(metadata) : '{}'
      );
      
      const employee = JSON.parse(result.toString());
      
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Deactivate an employee
   * POST /api/employees/:id/deactivate
   */
  app.post('/api/employees/:id/deactivate', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Deactivate the employee
      const result = await fabricClient.submitTransaction('deactivateEmployee', id);
      const employee = JSON.parse(result.toString());
      
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Fund an internal wallet (simulate deposit)
   * POST /api/internal-wallets/:id/fund
   */
  app.post('/api/internal-wallets/:id/fund', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      
      if (!amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get the internal wallet
      const internalWallet = await walletManager.getInternalWallet(id);
      
      if (!internalWallet) {
        return res.status(404).json({ error: 'Internal wallet not found' });
      }
      
      // Check if this is a base internal wallet
      if (internalWallet.metadata && internalWallet.metadata.isBaseWallet) {
        return res.status(400).json({
          error: 'Cannot directly fund a base internal wallet. Base internal wallet balances are automatically calculated during reconciliation.',
          messages: [
            {
              type: 'error',
              code: 'ERROR_005',
              message: 'Cannot directly fund a base internal wallet',
              data: {
                walletId: id,
                isBaseWallet: true
              },
              timestamp: new Date().toISOString()
            }
          ]
        });
      }
      
      // Update the internal wallet balance
      try {
        const updatedWallet = await walletManager.updateInternalWalletBalance(id, parseFloat(amount));
        
        // Trigger reconciliation to update the base wallet balance
        try {
          await walletManager.reconcileBaseInternalWallet(internalWallet.blockchain, internalWallet.primaryWalletName);
        } catch (reconciliationError) {
          console.warn(`Failed to reconcile base internal wallet after funding: ${reconciliationError.message}`);
          // Continue with the operation even if reconciliation fails
        }
        
        res.json(updatedWallet);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Process payroll
   * POST /api/payroll/process
   */
  app.post('/api/payroll/process', authenticateJWT, async (req, res) => {
    try {
      const { employerWalletId } = req.body;
      
      if (!employerWalletId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get the employer wallet
      const employerWallet = await walletManager.getInternalWallet(employerWalletId);
      
      if (!employerWallet) {
        return res.status(404).json({ error: 'Employer wallet not found' });
      }
      
      // Process the payroll
      const result = await fabricClient.submitTransaction('processMonthlyPayroll', employerWalletId);
      const payroll = JSON.parse(result.toString());
      
      res.json(payroll.payments || []);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Process individual payment
   * POST /api/payroll/individual-payment
   */
  app.post('/api/payroll/individual-payment', authenticateJWT, async (req, res) => {
    try {
      const { employerWalletId, employeeId, amount, paymentType } = req.body;
      
      if (!employerWalletId || !employeeId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get the employer wallet
      const employerWallet = await walletManager.getInternalWallet(employerWalletId);
      
      if (!employerWallet) {
        return res.status(404).json({ error: 'Employer wallet not found' });
      }
      
      // Process the individual payment
      const result = await fabricClient.submitTransaction(
        'processIndividualPayment',
        employerWalletId,
        employeeId,
        amount ? amount.toString() : null,
        paymentType || 'regular'
      );
      
      const payment = JSON.parse(result.toString());
      
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get employee payment history
   * GET /api/employees/:id/payment-history
   */
  app.get('/api/employees/:id/payment-history', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { limit } = req.query;
      
      // Get the employee payment history
      const result = await fabricClient.evaluateTransaction(
        'getEmployeePaymentHistory',
        id,
        limit || '10'
      );
      
      const payments = JSON.parse(result.toString());
      
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerEmployeePayrollExtension;
