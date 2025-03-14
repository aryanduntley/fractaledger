# FractaLedger Testing Guide

This directory contains tests for the FractaLedger system. This guide will help you understand the testing approach, available test files, and how to run the tests.

## Testing Approach

FractaLedger uses a multi-layered testing approach:

1. **Unit Testing**: Tests individual components in isolation
2. **Integration Testing**: Tests interactions between components
3. **End-to-End Testing**: Tests complete workflows from start to finish

## Test Files

### Component Tests

- **blockchain-connector.test.js**: Tests the abstract blockchain connector interface
- **connectors.test.js**: Tests all blockchain connector implementations (SPV, Full Node, API)
- **wallet-manager.test.js**: Tests the wallet manager component for wallet verification, creation, and management
- **wallet-id-uniqueness.test.js**: Tests the uniqueness constraint of internal wallet IDs across the system

### Chaincode Tests

- **merchant-fee-chaincode.test.js**: Tests the merchant fee chaincode template for handling merchant transactions and fee collection

### API Tests

- **api.test.js**: Tests the RESTful API endpoints

### End-to-End Tests

- **end-to-end.test.js**: Tests complete workflows from wallet registration to transaction processing

### New Features Tests

- **internal-transfers.test.js**: Tests the functionality of internal wallet transfers
- **base-wallet-protection.test.js**: Tests the base wallet protection mechanisms
- **balance-reconciliation.test.js**: Tests the balance reconciliation system
- **api-messaging.test.js**: Tests the API messaging system
- **new-features-integration.test.js**: Tests the integration of all new features

## Running Tests

### Using the Test Runner Script

The `run-all-tests.sh` script provides a convenient way to run tests:

```bash
# Run all tests
./run-all-tests.sh

# Run all tests (alternative)
./run-all-tests.sh all

# Run component tests
./run-all-tests.sh component

# Run chaincode tests
./run-all-tests.sh chaincode

# Run API tests
./run-all-tests.sh api

# Run end-to-end tests
./run-all-tests.sh e2e

# Run new features tests
./run-all-tests.sh new-features

# Run a specific test file
./run-all-tests.sh wallet-manager.test.js

# Show help
./run-all-tests.sh help
```

### Using npm

You can also run tests using npm:

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- wallet-manager.test.js

# Run tests with a specific pattern
npm test -- --grep "Wallet Management"
```

## Test Environment Setup

### Local Test Environment

For comprehensive testing, you'll need to set up a local test environment:

1. **Hyperledger Fabric**: Set up a local Hyperledger Fabric network for testing

```bash
# Set up a local Hyperledger Fabric network for testing
cd /tmp
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.4.9
cd fabric-samples/test-network
./network.sh up createChannel -c fractaledger -s couchdb
```

2. **UTXO Blockchain Testnets**: Use testnet versions of Bitcoin, Litecoin, and Dogecoin for testing

```bash
# Bitcoin Testnet
bitcoin-core -testnet

# Litecoin Testnet
litecoin-core -testnet

# Dogecoin Testnet
dogecoin-core -testnet
```

3. **Test Wallets**: Create test wallets for each supported blockchain and fund them with testnet coins

```bash
# Create a Bitcoin testnet wallet
bitcoin-cli -testnet createwallet "test_wallet"

# Get a new address
bitcoin-cli -testnet getnewaddress

# Fund the wallet using a testnet faucet
# Visit https://testnet-faucet.mempool.co/ and enter your address
```

## Writing Tests

### Unit Tests

When writing unit tests, follow these guidelines:

1. Test each component in isolation
2. Use mocks for dependencies
3. Test both success and error cases
4. Test edge cases

Example:

```javascript
describe('WalletManager', () => {
  let walletManager;
  let mockBlockchainConnector;
  let mockFabricClient;
  
  beforeEach(() => {
    // Set up mocks
    mockBlockchainConnector = {
      getBalance: sinon.stub().resolves(1.5),
      verifyUtxoWallet: sinon.stub().resolves(true)
    };
    
    mockFabricClient = {
      submitTransaction: sinon.stub().resolves(Buffer.from('{}'))
    };
    
    // Create wallet manager instance
    walletManager = new WalletManager(
      { bitcoin: { btc_wallet_1: mockBlockchainConnector } },
      mockFabricClient
    );
  });
  
  it('should create an internal wallet successfully', async () => {
    // Test implementation
  });
});
```

### Integration Tests

When writing integration tests, follow these guidelines:

1. Test interactions between components
2. Use mocks for external dependencies
3. Test complete workflows

Example:

```javascript
describe('WalletManager + BlockchainConnector Integration', () => {
  let walletManager;
  let spvConnector;
  let mockFabricClient;
  
  beforeEach(() => {
    // Set up components
    spvConnector = new SpvConnector('bitcoin', {
      name: 'btc_wallet_1',
      connectionType: 'spv',
      connectionDetails: {
        server: 'localhost:50001',
        network: 'testnet'
      },
      walletAddress: 'tb1q...',
      secret: 'private_key'
    });
    
    // Mock external dependencies
    spvConnector.client = {
      getBalance: sinon.stub().resolves(1.5)
    };
    
    mockFabricClient = {
      submitTransaction: sinon.stub().resolves(Buffer.from('{}'))
    };
    
    // Create wallet manager instance
    walletManager = new WalletManager(
      { bitcoin: { btc_wallet_1: spvConnector } },
      mockFabricClient
    );
  });
  
  it('should get balance from blockchain connector', async () => {
    // Test implementation
  });
});
```

### End-to-End Tests

When writing end-to-end tests, follow these guidelines:

1. Test complete workflows from start to finish
2. Use mocks for external dependencies
3. Test realistic user scenarios

Example:

```javascript
describe('Merchant Fee Collection Workflow', () => {
  it('should complete the entire merchant fee collection workflow', async () => {
    // Step 1: Create a custom chaincode
    // Step 2: Deploy the custom chaincode
    // Step 3: Create wallets
    // Step 4: Process transactions
    // Step 5: Verify results
  });
});
```

## Continuous Integration

To set up continuous integration for FractaLedger, you can use GitHub Actions or another CI/CD platform. Here's an example GitHub Actions workflow:

```yaml
name: FractaLedger Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    - name: Use Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16.x'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
```

## Test Coverage

To generate a test coverage report, run:

```bash
npm test -- --coverage
```

This will generate a coverage report in the `coverage` directory. You can open `coverage/lcov-report/index.html` in a browser to view the report.

## Troubleshooting

If you encounter issues when running tests, try the following:

1. Make sure all dependencies are installed: `npm install`
2. Check that the test environment is set up correctly
3. Check for syntax errors in your test files
4. Try running a single test file to isolate the issue
5. Check the Jest configuration in `jest.config.js`

If you still have issues, please open an issue on the GitHub repository.
