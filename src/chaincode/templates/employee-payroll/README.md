# FractaLedger Employee Payroll Chaincode Template

This is a specialized chaincode template for the FractaLedger system, designed specifically for employer/employee payroll management. It extends the default template with additional functionality for handling employee salary payments on a scheduled basis.

## Overview

The employee payroll chaincode template includes the following functionality:

- All the basic functionality from the default template
- Wallet type classification (employer, employee)
- Employee registration with salary configuration
- Scheduled monthly salary payments
- Payment history tracking and reporting
- Support for different payment frequencies (monthly, bi-weekly, weekly)
- Salary adjustments and bonus payments

## Use Case

This template is ideal for businesses that want to manage employee payments using cryptocurrency. For example:

- Companies with remote workers who prefer cryptocurrency payments
- Organizations with international employees where traditional banking may be challenging
- Businesses looking to automate their payroll process using blockchain technology
- Startups wanting to offer cryptocurrency payment options to employees

## Key Features

### Employee Registration

The template includes an employee registration system that allows you to:

- Register employees with their internal wallet IDs
- Set individual salary amounts for each employee
- Configure payment frequency (monthly, bi-weekly, weekly)
- Add employee metadata (department, position, start date)

You can update employee information at any time using the `updateEmployeeInfo` function.

### Scheduled Payments

The `processMonthlyPayroll` function handles the entire payroll process:

1. Identifies all registered employees due for payment
2. Verifies that the employer wallet has sufficient funds
3. Calculates the appropriate amount for each employee based on their salary
4. Transfers the salary amount from the employer wallet to each employee's wallet
5. Records the payment details on the ledger

### Wallet Types

The template extends the internal wallet model to include a `type` field, which can be:

- `employer`: A wallet owned by the employer that funds the payroll
- `employee`: A wallet owned by an employee who receives salary payments

### Payment History

The template maintains a comprehensive payment history that includes:

- Payment date and time
- Employee ID and wallet ID
- Payment amount
- Payment type (regular salary, bonus, adjustment)
- Transaction ID

## Customization

You can customize this template to fit your specific needs by modifying the existing functions or adding new ones. Here are some common customization scenarios:

### Variable Pay Structure

You can modify the payment calculation logic to implement a variable pay structure. For example:

```javascript
// Calculate the payment amount
let paymentAmount = employee.baseSalary;

// Add performance bonus if applicable
if (employee.performanceRating > 4) {
  paymentAmount += employee.baseSalary * 0.1; // 10% bonus for high performers
} else if (employee.performanceRating > 3) {
  paymentAmount += employee.baseSalary * 0.05; // 5% bonus for good performers
}

// Add overtime pay if applicable
if (employee.overtimeHours > 0) {
  const overtimePay = employee.overtimeHours * (employee.baseSalary / 160) * 1.5;
  paymentAmount += overtimePay;
}
```

### Department-Based Payments

You can implement department-based payment processing by grouping employees by department:

```javascript
// Get all employees
const allEmployees = await this.getAllEmployees(ctx);

// Group employees by department
const departments = {};
for (const employee of allEmployees) {
  if (!departments[employee.department]) {
    departments[employee.department] = [];
  }
  departments[employee.department].push(employee);
}

// Process payments by department
for (const [department, employees] of Object.entries(departments)) {
  // Calculate total department payroll
  let departmentTotal = 0;
  for (const employee of employees) {
    departmentTotal += employee.salary;
  }
  
  // Check if department has a budget limit
  if (departmentBudgets[department] && departmentTotal > departmentBudgets[department]) {
    throw new Error(`Department ${department} exceeds budget limit`);
  }
  
  // Process payments for department employees
  for (const employee of employees) {
    // Process individual payment
    // ...
  }
}
```

### Tax Withholding

You can modify the `processMonthlyPayroll` function to implement tax withholding:

```javascript
// Calculate tax withholding
const taxRate = 0.2; // 20% tax rate
const taxAmount = employee.salary * taxRate;
const netPayment = employee.salary - taxAmount;

// Update the employee wallet with net payment
employeeWallet.balance += netPayment;
employeeWallet.updatedAt = new Date().toISOString();
await ctx.stub.putState(employeeWalletId, Buffer.from(JSON.stringify(employeeWallet)));

// Transfer tax amount to tax authority wallet
taxAuthorityWallet.balance += taxAmount;
taxAuthorityWallet.updatedAt = new Date().toISOString();
await ctx.stub.putState(taxAuthorityWalletId, Buffer.from(JSON.stringify(taxAuthorityWallet)));
```

### Multiple Payment Frequencies

You can implement support for different payment frequencies:

```javascript
// Determine if employee is due for payment
const now = new Date();
const lastPaymentDate = new Date(employee.lastPaymentDate || employee.startDate);
let isDue = false;

switch (employee.paymentFrequency) {
  case 'monthly':
    // Check if it's been a month since the last payment
    isDue = (
      now.getMonth() > lastPaymentDate.getMonth() ||
      (now.getMonth() === lastPaymentDate.getMonth() && now.getFullYear() > lastPaymentDate.getFullYear())
    ) && now.getDate() >= lastPaymentDate.getDate();
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

if (isDue) {
  // Process payment
  // ...
}
```

## Implementation Details

### Employee Data Structure

The employee data structure includes:

```javascript
{
  id: "emp123",                      // Unique employee ID
  name: "John Doe",                  // Employee name
  walletId: "wallet123",             // Internal wallet ID
  salary: 5000,                      // Monthly salary amount
  department: "Engineering",         // Department
  position: "Software Engineer",     // Job position
  startDate: "2023-01-15",           // Employment start date
  paymentFrequency: "monthly",       // Payment frequency
  lastPaymentDate: "2023-02-15",     // Last payment date
  status: "active",                  // Employee status
  metadata: {                        // Additional metadata
    taxId: "123-45-6789",
    address: "123 Main St",
    contactEmail: "john@example.com"
  }
}
```

### Key Functions

The template includes the following key functions:

- `registerEmployee`: Register a new employee with their wallet ID and salary information
- `updateEmployeeInfo`: Update an existing employee's information
- `processMonthlyPayroll`: Process monthly salary payments for all eligible employees
- `processIndividualPayment`: Process a payment for a specific employee
- `getEmployeePaymentHistory`: Get the payment history for a specific employee
- `getAllEmployees`: Get a list of all registered employees
- `deactivateEmployee`: Deactivate an employee (e.g., when they leave the company)
- `processBonus`: Process a one-time bonus payment for an employee

## Deployment

To deploy your customized chaincode, follow these steps:

1. Modify the chaincode template as needed
2. Package the chaincode
3. Install the chaincode on the Hyperledger Fabric network
4. Instantiate the chaincode on the channel

For more information on deploying chaincode, refer to the Hyperledger Fabric documentation.

## Testing

You can test your customized chaincode using the Jest testing framework. Create test files in the `__tests__` directory and run them using the `npm test` command.

## Best Practices

- Ensure the employer wallet always has sufficient funds for payroll
- Implement proper error handling for payment failures
- Keep employee data secure and private
- Regularly back up employee and payment data
- Implement proper access controls for payroll functions
- Test thoroughly before deploying to production
- Document any customizations for future reference
