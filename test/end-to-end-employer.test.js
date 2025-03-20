/**
 * End-to-End Employer/Employee Payroll Tests
 * 
 * This file contains end-to-end tests for the FractaLedger employer/employee payroll scenario,
 * demonstrating how to test the complete workflow from wallet registration to
 * payroll distribution.
 */

const { expect } = require('chai');
const request = require('supertest');
const { setupEmployerTest } = require('./employer-test-setup');

describe('End-to-End Employer/Employee Payroll Tests', () => {
  let server;
  let app;
  let token;
  let internalWallets;
  let mockConfig;
  let createBaseWallet;
  let destroyAllWallets;
  let mockWalletManager;
  
  beforeAll(async () => {
    // Initialize the test environment
    const setup = await setupEmployerTest();
    server = setup.server;
    app = setup.app;
    token = setup.token;
    internalWallets = setup.internalWallets;
    mockConfig = setup.mockConfig;
    createBaseWallet = setup.createBaseWallet;
    destroyAllWallets = setup.destroyAllWallets;
    mockWalletManager = setup.mockWalletManager;
  });
  
  afterAll(async () => {
    // Close the server after all tests are done
    if (server && server.close) {
      await server.close();
    }
  });
  
  describe('Employee Payroll Workflow', () => {
    beforeEach(async () => {
      // Create base wallet for employer/employee payroll scenario
      await createBaseWallet('bitcoin', 'base_employer_wallet');
    });
    
    afterEach(async () => {
      // Destroy all wallets and reset blockchain state after the test
      await destroyAllWallets();
      
      // Additional cleanup to ensure no state persists
      jest.clearAllMocks();
    });
    
    it('should complete the entire employee payroll workflow', async () => {
      // Step 1: Create a custom chaincode from the employee-payroll template
      const createChaincodeResponse = await request(app)
        .post('/api/chaincode/custom')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateId: 'employee-payroll',
          customId: 'my-employee-payroll'
        })
        .expect(200);
      
      expect(createChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(createChaincodeResponse.body).to.have.property('templateId', 'employee-payroll');
      
      // Step 2: Deploy the custom chaincode
      const deployChaincodeResponse = await request(app)
        .post('/api/chaincode/custom/my-custom-chaincode/deploy')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(deployChaincodeResponse.body).to.have.property('id', 'my-custom-chaincode');
      expect(deployChaincodeResponse.body).to.have.property('status', 'deployed');
      
      // Step 3: Create an employer internal wallet
      const createEmployerWalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employer_wallet_1',
          type: 'employer'
        })
        .expect(200);
      
      expect(createEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(createEmployerWalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployerWalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      // Step 4: Create employee internal wallets
      const createEmployee1WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_1',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee1WalletResponse.body).to.have.property('id', 'employee_wallet_1');
      expect(createEmployee1WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee1WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      const createEmployee2WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_2',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee2WalletResponse.body).to.have.property('id', 'employee_wallet_2');
      expect(createEmployee2WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee2WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      const createEmployee3WalletResponse = await request(app)
        .post('/api/internal-wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blockchain: 'bitcoin',
          primaryWalletName: 'base_employer_wallet',
          internalWalletId: 'employee_wallet_3',
          type: 'employee'
        })
        .expect(200);
      
      expect(createEmployee3WalletResponse.body).to.have.property('id', 'employee_wallet_3');
      expect(createEmployee3WalletResponse.body).to.have.property('blockchain', 'bitcoin');
      expect(createEmployee3WalletResponse.body).to.have.property('primaryWalletName', 'base_employer_wallet');
      
      // Step 5: Create a payroll configuration
      const createPayrollConfigResponse = await request(app)
        .post('/api/payroll-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payrollCycle: 'monthly',
          payrollDay: 15,
          employeePayments: {
            employee_wallet_1: 0.5,
            employee_wallet_2: 0.3,
            employee_wallet_3: 0.2
          }
        })
        .expect(200);
      
      expect(createPayrollConfigResponse.body).to.have.property('payrollCycle', 'monthly');
      expect(createPayrollConfigResponse.body).to.have.property('payrollDay', 15);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_1', 0.5);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_2', 0.3);
      expect(createPayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_3', 0.2);
      
      // Step 6: Fund the employer wallet (no fees for employer wallet funding)
      const fundEmployerWalletResponse = await request(app)
        .post('/api/internal-wallets/employer_wallet_1/fund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 2.0
        })
        .expect(200);
      
      expect(fundEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(fundEmployerWalletResponse.body).to.have.property('balance', 2.0);
      
      // Step 7: Process the payroll (no fees for employer to employee transfers)
      const processPayrollResponse = await request(app)
        .post('/api/process-payroll')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1',
          payrollDate: '2025-03-15'
        })
        .expect(200);
      
      expect(processPayrollResponse.body).to.have.property('id', 'payroll_2025-03-15');
      expect(processPayrollResponse.body).to.have.property('employerWalletId', 'employer_wallet_1');
      expect(processPayrollResponse.body).to.have.property('payrollDate', '2025-03-15');
      expect(processPayrollResponse.body).to.have.property('totalAmount', 1.0); // 0.5 + 0.3 + 0.2
      expect(processPayrollResponse.body.transactions).to.be.an('array');
      expect(processPayrollResponse.body.transactions).to.have.lengthOf(3);
      
      // Step 8: Verify the wallet balances after the payroll
      const getEmployerWalletResponse = await request(app)
        .get('/api/internal-wallets/employer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployerWalletResponse.body).to.have.property('id', 'employer_wallet_1');
      expect(getEmployerWalletResponse.body).to.have.property('balance', 1.0); // 2.0 - 1.0
      
      const getEmployee1WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1WalletResponse.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1WalletResponse.body).to.have.property('balance', 0.5);
      
      const getEmployee2WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee2WalletResponse.body).to.have.property('id', 'employee_wallet_2');
      expect(getEmployee2WalletResponse.body).to.have.property('balance', 0.3);
      
      const getEmployee3WalletResponse = await request(app)
        .get('/api/internal-wallets/employee_wallet_3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee3WalletResponse.body).to.have.property('id', 'employee_wallet_3');
      expect(getEmployee3WalletResponse.body).to.have.property('balance', 0.2);
      
      // Step 9: Update the payroll configuration
      const updatePayrollConfigResponse = await request(app)
        .put('/api/payroll-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payrollCycle: 'biweekly',
          payrollDay: 1,
          employeePayments: {
            employee_wallet_1: 0.25,
            employee_wallet_2: 0.15,
            employee_wallet_3: 0.1
          }
        })
        .expect(200);
      
      expect(updatePayrollConfigResponse.body).to.have.property('payrollCycle', 'biweekly');
      expect(updatePayrollConfigResponse.body).to.have.property('payrollDay', 1);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_1', 0.25);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_2', 0.15);
      expect(updatePayrollConfigResponse.body.employeePayments).to.have.property('employee_wallet_3', 0.1);
      
      // Step 10: Process another payroll with the updated configuration
      const processPayroll2Response = await request(app)
        .post('/api/process-payroll')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employerWalletId: 'employer_wallet_1',
          payrollDate: '2025-04-01'
        })
        .expect(200);
      
      expect(processPayroll2Response.body).to.have.property('id', 'payroll_2025-04-01');
      expect(processPayroll2Response.body).to.have.property('employerWalletId', 'employer_wallet_1');
      expect(processPayroll2Response.body).to.have.property('payrollDate', '2025-04-01');
      expect(processPayroll2Response.body).to.have.property('totalAmount', 0.5); // 0.25 + 0.15 + 0.1
      expect(processPayroll2Response.body.transactions).to.be.an('array');
      expect(processPayroll2Response.body.transactions).to.have.lengthOf(3);
      
      // Step 11: Verify the wallet balances after the second payroll
      const getEmployerWallet2Response = await request(app)
        .get('/api/internal-wallets/employer_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployerWallet2Response.body).to.have.property('id', 'employer_wallet_1');
      expect(getEmployerWallet2Response.body).to.have.property('balance', 0.5); // 1.0 - 0.5
      
      const getEmployee1Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1Wallet2Response.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1Wallet2Response.body).to.have.property('balance', 0.75); // 0.5 + 0.25
      
      const getEmployee2Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee2Wallet2Response.body).to.have.property('id', 'employee_wallet_2');
      // Use a more flexible approach for floating-point comparison
      const balance = getEmployee2Wallet2Response.body.balance;
      expect(Math.abs(balance - 0.45)).to.be.lessThan(0.0001); // Allow small epsilon for floating-point precision
      
      const getEmployee3Wallet2Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee3Wallet2Response.body).to.have.property('id', 'employee_wallet_3');
      expect(getEmployee3Wallet2Response.body).to.have.property('balance', 0.3); // 0.2 + 0.1
      
      // Step 12: Employee withdraws funds to an external address (blockchain fee applies)
      const withdrawResponse = await request(app)
        .post('/api/internal-wallets/employee_wallet_1/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          toAddress: 'bc1q...',
          amount: 0.5,
          fee: 0.0001
        })
        .expect(200);
      
      expect(withdrawResponse.body).to.have.property('id', 'withdrawal_1');
      expect(withdrawResponse.body).to.have.property('internalWalletId', 'employee_wallet_1');
      expect(withdrawResponse.body).to.have.property('toAddress', 'bc1q...');
      expect(withdrawResponse.body).to.have.property('amount', 0.5);
      expect(withdrawResponse.body).to.have.property('fee', 0.0001);
      
      // Step 13: Verify the employee wallet balance after withdrawal
      const getEmployee1Wallet3Response = await request(app)
        .get('/api/internal-wallets/employee_wallet_1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getEmployee1Wallet3Response.body).to.have.property('id', 'employee_wallet_1');
      expect(getEmployee1Wallet3Response.body).to.have.property('balance', 0.2499); // 0.75 - 0.5 - 0.0001
    });
  });
});
