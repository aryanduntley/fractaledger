# FractaLedger API Extensions

This directory contains example API extensions for the FractaLedger system. These extensions demonstrate how to add custom endpoints to the FractaLedger API server without modifying the core code.

## How API Extensions Work

API extensions are modular components that can be added to the FractaLedger API server. Each extension is a JavaScript module that exports a function that takes an Express app instance, authentication middleware, and other dependencies, and adds routes to the app.

### Extension Structure

A typical API extension looks like this:

```javascript
/**
 * Example API Extension
 * 
 * This extension adds custom endpoints to the FractaLedger API server.
 */

/**
 * Register the extension with the API server
 * @param {Object} app The Express app instance
 * @param {Function} authenticateJWT The authentication middleware
 * @param {Object} dependencies Additional dependencies (walletManager, fabricClient, etc.)
 */
function registerExtension(app, authenticateJWT, dependencies) {
  const { walletManager, fabricClient } = dependencies;
  
  // Add your custom routes here
  app.post('/api/custom-endpoint', authenticateJWT, async (req, res) => {
    try {
      // Your endpoint logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerExtension;
```

### Using Extensions

To use an extension, you need to:

1. Copy the extension file to your project directory
2. Import the extension in your application
3. Register the extension with the API server

Example:

```javascript
const express = require('express');
const { startApiServer } = require('fractaledger');
const myExtension = require('./my-extension');

// Start the API server
const serverObj = await startApiServer(config, blockchainConnectors, walletManager, fabricClient, chaincodeManager);

// Register the extension
myExtension(serverObj.app, serverObj.authenticateJWT, {
  walletManager,
  fabricClient,
  // Add any other dependencies your extension needs
});
```

## Available Extensions

### Merchant Fee Extension

The `merchant-fee-extension.js` file adds endpoints for managing merchant fees and processing merchant transactions. This extension is designed to work with the merchant-fee chaincode template.

Endpoints:
- `POST /api/fee-config` - Create or update fee configuration
- `GET /api/fee-config` - Get fee configuration
- `POST /api/internal-wallets/:id/fund` - Fund an internal wallet
- `POST /api/transactions/merchant` - Process a merchant transaction

### Employee Payroll Extension

The `employee-payroll-extension.js` file adds endpoints for managing employees and processing payroll. This extension is designed to work with the employee-payroll chaincode template.

Endpoints:
- `POST /api/employees` - Register a new employee
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get an employee
- `PUT /api/employees/:id` - Update an employee
- `POST /api/internal-wallets/:id/fund` - Fund an internal wallet
- `POST /api/payroll/process` - Process payroll

## Creating Your Own Extensions

You can create your own extensions by following these steps:

1. Create a new JavaScript file in your project directory
2. Define a function that takes an Express app instance, authentication middleware, and dependencies
3. Add your custom routes to the app
4. Export the function

Example:

```javascript
function registerMyExtension(app, authenticateJWT, dependencies) {
  const { walletManager, fabricClient } = dependencies;
  
  app.post('/api/my-custom-endpoint', authenticateJWT, async (req, res) => {
    try {
      // Your endpoint logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerMyExtension;
```

## Best Practices

1. **Modular Design**: Keep your extensions modular and focused on specific functionality.
2. **Error Handling**: Implement proper error handling in your extensions.
3. **Authentication**: Use the provided authentication middleware for protected endpoints.
4. **Documentation**: Document your extensions thoroughly.
5. **Testing**: Write tests for your extensions.
