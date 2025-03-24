# FractaLedger

**Status: Initial Release** 🚧

This is the first release of FractaLedger. While the core functionality is in place, some instability is possible, and breaking changes may occur in future releases.

Please try it out, and report any bugs or feedback to help us improve it.

FractaLedger is a configurable off-chain UTXO management system that enables fractional ownership, secure fund distribution, and seamless on-chain interactions across multiple blockchains.

## Overview

FractaLedger solves the challenge of managing fractional ownership of UTXO-based cryptocurrencies (Bitcoin, Litecoin, Dogecoin, etc.) without requiring expensive on-chain transactions for every operation. It uses Hyperledger Fabric as an internal ledger to track fractional ownership while maintaining the security and transparency of blockchain technology.

### Key Features

- **Bring Your Own Wallet**: Users provide their own UTXO-based wallet addresses and private keys
- **Multi-Blockchain Support**: Works with Bitcoin, Litecoin, Dogecoin, and other UTXO-based blockchains
- **Comprehensive Blockchain Interaction**: Broadcast transactions and monitor wallet addresses with the transceiver architecture
- **Customizable Smart Contracts**: Define your own fund distribution rules, fee structures, and withdrawal logic
- **Comprehensive API**: Integrate with your existing applications through a RESTful API
- **Secure by Design**: No traditional database, all data stored on an internal blockchain
- **Internal Wallet Transfers**: Transfer funds between internal wallets without on-chain transactions
- **Base Wallet Protection**: Prevent withdrawals that would exceed the aggregate internal distributed amount
- **Base Internal Wallet**: Special internal wallet that represents excess funds in the primary on-chain wallet

## Prerequisites

Before installing FractaLedger, ensure you have the following prerequisites:

- **Node.js (v14 or later)** - Required to run the application
- **npm (v6 or later)** - Required to install dependencies

Depending on your transceiver configuration, you may also need:

- **Hyperledger Fabric** - Required for the internal ledger functionality
  - Docker and Docker Compose for running Fabric components
  - Fabric binaries (fabric-ca-client, peer, orderer)
  - Fabric SDK dependencies

- **Transaction Broadcasting Method** - Choose one or more:
  - Custom transceiver modules (for callback method)
  - Event listeners (for event method)
  - API endpoints (for API method)
  - Manual broadcasting (for return method)

## Installation

### As a Dependency in Your Project

```bash
# Install FractaLedger as a dependency
npm install fractaledger

# Initialize a new FractaLedger project
npx fractaledger-init --dir my-fractaledger-project

# Navigate to your project directory
cd my-fractaledger-project

# Edit configuration files
# - Update fractaledger.json with your blockchain connection details
# - Add your wallet secrets to .env (keep this file secure and never commit it to version control)

# Start the system
npm start
```

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/fractaledger.git
cd fractaledger

# Install dependencies
npm install

# Copy configuration templates
cp fractaledger-template.json fractaledger.json
cp .env.example .env

# Edit configuration files
# - Update fractaledger.json with your blockchain connection details
# - Add your wallet secrets to .env (keep this file secure and never commit it to version control)

# Start the system
npm start
```

### CLI Tools

FractaLedger provides several command-line tools to help you get started:

1. **Initialize a New Project**
   ```bash
   npx fractaledger-init --dir my-fractaledger-project
   ```
   This command creates a new FractaLedger project with the necessary directory structure and configuration files.

2. **Generate a Transceiver**
   ```bash
   npx fractaledger-generate-transceiver --type bitcoin --output ./my-transceivers
   ```
   This command generates a custom transceiver implementation for the specified blockchain.

3. **Generate a Configuration File**
   ```bash
   npx fractaledger-generate-config --output ./fractaledger.json
   ```
   This command generates a configuration file with interactive prompts for customization.

## Hyperledger Fabric Setup

FractaLedger requires Hyperledger Fabric as its internal ledger. While the application handles much of the Fabric interaction, you'll need to set up the Fabric network first:

1. **Install Fabric Prerequisites**:
   - Docker and Docker Compose
   - Go programming language (v1.14 or later)
   - Fabric binaries

2. **Set Up Fabric Network**:
   - Use the Fabric test network or set up your own network
   - Create a channel for FractaLedger
   - Generate connection profiles and certificates

3. **Configure FractaLedger**:
   - Update the `hyperledger` section in `config.json` with your network details
   - Set the appropriate environment variables in `.env`

For detailed Fabric setup instructions, refer to the [Hyperledger Fabric documentation](https://hyperledger-fabric.readthedocs.io/).

## Configuration

FractaLedger uses a configuration-based approach that allows you to specify how to connect to various blockchains and how to manage your wallets. The main configuration file is `config.json`, and sensitive information like private keys is stored in environment variables.

### Example Configuration

See `config-template.json` for a complete example configuration. Here's a simplified version:

```json
{
  "bitcoin": [
    {
      "name": "btc_wallet_1",
      "network": "mainnet",
      "walletAddress": "bc1q...",
      "secretEnvVar": "BTC_WALLET_1_SECRET",
      "transceiver": {
        "method": "callback",
        "module": "./transceivers/utxo-transceiver.js",
        "config": {
          "apiUrl": "https://blockstream.info/api",
          "monitoringInterval": 60000
        }
      }
    }
  ],
  "hyperledger": {
    "networkConfig": {
      "channelName": "fractaledger-channel",
      "chaincodeName": "fractaledger-chaincode"
    }
  }
}
```

### Transceiver Architecture

FractaLedger uses a flexible transceiver architecture that handles both transaction broadcasting and wallet address monitoring. This approach completely separates transaction creation/signing from the broadcasting and monitoring mechanisms, allowing you to use your existing infrastructure for blockchain interactions.

#### Transceiver Methods

FractaLedger supports four transceiver methods:

1. **Callback Method**
   - Uses a custom transceiver module to broadcast transactions and monitor wallet addresses
   - Allows you to implement your own broadcasting and monitoring logic
   - Provides maximum flexibility and control
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_1",
     "network": "mainnet",
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_1_SECRET",
     "transceiver": {
       "method": "callback",
       "module": "./transceivers/utxo-transceiver.js",
       "config": {
         "apiUrl": "https://blockstream.info/api",
         "monitoringInterval": 60000
       }
     }
   }
   ```

2. **Event Method**
   - Emits events with transaction data and wallet address updates for external listeners
   - Useful for integrating with event-driven architectures
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_2",
     "network": "mainnet",
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_2_SECRET",
     "transceiver": {
       "method": "event"
     }
   }
   ```

3. **API Method**
   - Makes transactions and wallet address updates available through API endpoints
   - Useful for web applications and services
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_3",
     "network": "mainnet",
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_3_SECRET",
     "transceiver": {
       "method": "api"
     }
   }
   ```

4. **Return Method**
   - Simply returns transaction data and wallet address updates without broadcasting or monitoring
   - Useful for manual broadcasting or testing
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_4",
     "network": "mainnet",
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_4_SECRET",
     "transceiver": {
       "method": "return"
     }
   }
   ```

#### Custom Transceivers

You can create custom transceiver modules to implement your own transaction broadcasting and wallet address monitoring logic. These modules should implement the `UTXOTransceiver` interface, which includes methods for:

- Broadcasting transactions
- Monitoring wallet addresses
- Getting wallet balances
- Getting transaction history
- Getting UTXOs (Unspent Transaction Outputs)

For more information about custom transceivers, see the [transceivers/README.md](transceivers/README.md) file.

### Environment Variables

Sensitive information like private keys and API keys should be stored in environment variables. See `.env.example` for a complete list of required environment variables.

### Custom Environment File Location

By default, FractaLedger looks for the `.env` file in the current working directory. However, you can specify a custom location for your environment file in the `config.json`:

```json
{
  "environment": {
    "envFilePath": "/path/to/your/.env"
  }
}
```

This allows you to:
- Keep your environment variables in a more secure location
- Use different environment files for different environments (development, staging, production)
- Share configuration files without sharing sensitive information

## Project Structure

```
fractaledger/
├── src/                      # Source code
│   ├── api/                  # API server
│   ├── blockchain/           # Blockchain connectors
│   │   ├── blockchainConnector.js  # Blockchain connector interface
│   │   ├── connectorManager.js     # Connector initialization
│   │   ├── transactionBuilder.js   # Transaction creation and signing
│   │   ├── transceiverManager.js   # Transaction broadcasting and wallet monitoring
│   │   └── utxoTransceiver.js      # UTXO transceiver interface
│   ├── chaincode/            # Hyperledger Fabric chaincode
│   │   ├── custom/           # User-customized chaincodes
│   │   ├── templates/        # Chaincode templates
│   │   │   ├── default/      # Default chaincode template
│   │   │   └── merchant-fee/ # Merchant fee chaincode template
│   │   └── chaincodeManager.js     # Chaincode management
│   ├── config/               # Configuration management
│   ├── hyperledger/          # Hyperledger Fabric integration
│   ├── wallet/               # Wallet management
│   └── index.js              # Main entry point
├── transceivers/             # Transceiver modules
│   ├── utxo-transceiver.js   # Generic UTXO transceiver implementation
│   ├── mock-transceiver.js   # Mock transceiver for testing
│   └── README.md             # Transceiver documentation
├── API.md                    # API documentation
├── config.json               # Configuration file (created from template)
├── .env                      # Environment variables (created from template)
├── .env.example              # Environment variables template
├── package.json              # Project dependencies
├── setup.sh                  # Setup script
└── README.md                 # This file
```

## Usage

### API Endpoints

FractaLedger provides a RESTful API for interacting with the system. See [API.md](API.md) for complete API documentation. Here are some example endpoints:

```
# Wallet Management
POST /api/wallets - Register a new wallet
GET /api/wallets - List all registered wallets

# Internal Wallet Management
POST /api/internal-wallets - Create a new internal wallet
GET /api/internal-wallets - List all internal wallets
GET /api/internal-wallets/:id/balance - Get the balance of an internal wallet

# Transactions
POST /api/transactions/withdraw - Initiate a withdrawal
GET /api/transactions - List all transactions
POST /api/transactions/broadcast - Broadcast a transaction

# Wallet Monitoring
POST /api/wallets/:id/monitor - Start monitoring a wallet address
DELETE /api/wallets/:id/monitor - Stop monitoring a wallet address
GET /api/wallets/:id/transactions - Get transaction history for a wallet

# Chaincode Management
GET /api/chaincode/templates - List available chaincode templates
POST /api/chaincode/custom - Create a custom chaincode
PUT /api/chaincode/custom/:id - Update a custom chaincode
POST /api/chaincode/custom/:id/deploy - Deploy a custom chaincode
```

## Advanced Features

### Internal Wallet Transfers

Internal wallet transfers allow you to move funds between internal wallets that are mapped to the same primary on-chain wallet without requiring on-chain transactions. This feature is particularly useful for:

- Transferring funds between users within the same system
- Reallocating funds between different internal wallets
- Implementing internal payment systems without incurring blockchain transaction fees

#### API Endpoint

```
POST /api/transactions/internal-transfer
{
  "fromInternalWalletId": "internal_wallet_1",
  "toInternalWalletId": "internal_wallet_2",
  "amount": 0.1,
  "memo": "Payment for services" // Optional
}
```

Internal transfers are processed entirely within the Hyperledger Fabric ledger and do not create on-chain transactions. This makes them:

- Instant (no need to wait for blockchain confirmations)
- Free (no blockchain transaction fees)
- Private (not visible on the public blockchain)

### Base Wallet Protection

Base wallet protection ensures that the primary on-chain wallet always has sufficient funds to cover all internal wallets. This is achieved through:

1. **Base Internal Wallet**: A special internal wallet that represents excess funds in the primary wallet
2. **Read-Only Wallet Access**: API endpoint that provides aggregate balance information
3. **Enhanced Withdrawal Validation**: Checks to prevent withdrawals that would exceed the aggregate internal distributed amount

#### Configuration

To enable base internal wallet creation, add the following to your configuration file:

```json
"baseInternalWallet": {
  "namePrefix": "base_wallet_",
  "description": "Represents excess funds in the primary on-chain wallet",
  "createOnInitialization": true
}
```

#### Base Internal Wallet

The base internal wallet follows this naming convention:

```
{namePrefix}{blockchain}_{primaryWalletName}
```

For example, for a Bitcoin primary wallet named "btc_wallet_1", the base internal wallet would be named:

```
base_wallet_bitcoin_btc_wallet_1
```

#### Read-Only Wallet Access

```
GET /api/wallets/:blockchain/:name/read-only
```

Response:

```json
{
  "blockchain": "bitcoin",
  "name": "btc_wallet_1",
  "address": "bc1q...",
  "balance": 1.5,
  "aggregateInternalBalance": 1.2,
  "excessBalance": 0.3,
  "baseInternalWalletId": "base_wallet_bitcoin_btc_wallet_1"
}
```

This endpoint provides information about the primary wallet, including the aggregate balance of all internal wallets, the excess balance, and the ID of the base internal wallet.

### Balance Integrity Checking

FractaLedger includes a robust balance reconciliation system that ensures the integrity of your wallet balances. This feature verifies that the sum of all internal wallet balances matches the actual on-chain balance of the primary wallet.

#### Configuration

Configure balance reconciliation in your `config.json` file:

```json
"balanceReconciliation": {
  "strategy": "afterTransaction", 
  "scheduledFrequency": 3600000,
  "warningThreshold": 0.00001,
  "strictMode": false
}
```

- **strategy**: When to perform reconciliation
  - `afterTransaction`: Check after each transaction
  - `scheduled`: Check at regular intervals
  - `both`: Use both strategies
- **scheduledFrequency**: Interval in milliseconds for scheduled reconciliation (default: 1 hour)
- **warningThreshold**: Minimum difference to trigger a warning (default: 0.00001)
- **strictMode**: If true, transactions will fail when discrepancies are detected

#### API Endpoints

```
# Reconciliation Configuration
GET /api/reconciliation/config - Get reconciliation configuration

# Manual Reconciliation
POST /api/reconciliation/wallet/:blockchain/:name - Reconcile a specific wallet
POST /api/reconciliation/all - Reconcile all wallets

# Discrepancy Management
GET /api/reconciliation/discrepancies - List all balance discrepancies
POST /api/reconciliation/discrepancies/:id/resolve - Resolve a discrepancy
```

#### Discrepancy Resolution

When a discrepancy is detected, it's recorded in the ledger with details about the difference. Administrators can review and resolve discrepancies through the API, providing a resolution description that explains the cause and action taken.

### API Messaging System

FractaLedger includes a structured messaging system for API responses that provides clear, consistent, and informative feedback to clients. This system categorizes messages by type and severity, making it easier to handle responses programmatically.

#### Message Types

- **Info**: Informational messages about successful operations
- **Warning**: Alerts about potential issues that didn't prevent the operation
- **Error**: Messages about failures that prevented the operation

#### Response Format

API responses include both the requested data and any relevant messages:

```json
{
  "data": {
    "success": true,
    "transfer": {
      "id": "transfer_123",
      "fromWalletId": "internal_wallet_1",
      "toWalletId": "internal_wallet_2",
      "amount": 0.1,
      "timestamp": "2025-03-13T12:00:00Z"
    }
  },
  "messages": [
    {
      "type": "info",
      "code": "INFO_001",
      "message": "Internal transfer processed successfully",
      "data": {
        "fromWalletId": "internal_wallet_1",
        "toWalletId": "internal_wallet_2",
        "amount": 0.1
      },
      "timestamp": "2025-03-13T12:00:00Z"
    },
    {
      "type": "warning",
      "code": "WARN_001",
      "message": "Primary wallet balance is low",
      "data": {
        "blockchain": "bitcoin",
        "primaryWalletName": "btc_wallet_1",
        "primaryWalletBalance": 1.2,
        "aggregateInternalBalance": 1.1
      },
      "timestamp": "2025-03-13T12:00:00Z"
    }
  ]
}
```

#### Message Codes

Each message includes a unique code that can be used for programmatic handling:

- **INFO_001**: Transaction processed successfully
- **INFO_002**: Wallet created successfully
- **WARN_001**: Primary wallet balance is low
- **WARN_002**: Balance discrepancy detected
- **ERROR_001**: Insufficient balance
- **ERROR_002**: Wallet not found

This messaging system makes it easier to build robust client applications that can handle both successful operations and various error conditions in a consistent way.

### Customizing Smart Contracts

FractaLedger allows you to customize the smart contract logic for fund distribution, fee structures, and withdrawal management. The system provides two main ways to customize smart contracts:

1. **Using the API**: You can create, update, and deploy custom chaincodes using the API endpoints.
2. **Direct File Editing**: You can directly edit the chaincode files in the `src/chaincode/custom` directory.

#### Chaincode Templates

FractaLedger comes with two chaincode templates:

1. **Default Template**: Basic functionality for managing internal wallets and transactions.
2. **Merchant Fee Template**: Specialized functionality for merchant fee collection use cases.

You can create a custom chaincode based on one of these templates and then customize it to fit your specific needs.

#### Example Use Cases

1. **Merchant Fee Collection**: Take a percentage fee for facilitating cryptocurrency transfers between customers and merchants.
   - Use the merchant fee template as a starting point
   - Customize the fee calculation logic to fit your fee structure
   - Deploy the custom chaincode

2. **Employee Payment System**: Distribute funds to employees based on predefined rules and schedules.
   - Use the default template as a starting point
   - Add custom logic for salary calculation and payment scheduling
   - Deploy the custom chaincode

3. **Investment Fund**: Manage fractional ownership of cryptocurrency investments with custom distribution rules.
   - Use the default template as a starting point
   - Add custom logic for investment tracking and profit distribution
   - Deploy the custom chaincode

## Development

### Running in Development Mode

```bash
# Start the system in development mode
npm run dev
```

### Testing

```bash
# Run tests
npm test
```

### Building for Production

```bash
# Build the project for production
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Import Paths

FractaLedger provides several import paths for accessing specific functionality:

### CommonJS (Node.js)

```javascript
// Import the entire package
const fractaledger = require('fractaledger');

// Import specific modules
const { BlockchainConnector } = require('fractaledger/blockchain');
const { initializeWalletManager } = require('fractaledger/wallet');
const { SPVTransceiver } = require('fractaledger/transceivers');
const { startApiServer } = require('fractaledger/api');
```

### ES Modules (Modern JavaScript)

```javascript
// Import the entire package
import fractaledger from 'fractaledger';

// Import specific modules
import { BlockchainConnector } from 'fractaledger/blockchain';
import { initializeWalletManager } from 'fractaledger/wallet';
import { SPVTransceiver } from 'fractaledger/transceivers';
import { startApiServer } from 'fractaledger/api';
```

## TypeScript Support

FractaLedger includes TypeScript definitions for better IDE support and type checking. When using TypeScript, you'll get autocompletion and type checking for all FractaLedger APIs:

```typescript
import { BlockchainConnector } from 'fractaledger/blockchain';
import { 
  WalletConfig, 
  TransactionOptions, 
  CreateTransactionOptions, 
  SendTransactionOptions 
} from 'fractaledger/blockchain';

// Create a blockchain connector with proper type checking
const config: WalletConfig = {
  name: 'btc_wallet_1',
  network: 'mainnet',
  walletAddress: 'bc1q...',
  secretEnvVar: 'BTC_WALLET_1_SECRET',
  transceiver: {
    method: 'callback',
    callbackModule: './transceivers/utxo-transceiver.js'
  }
};

const connector = new BlockchainConnector('bitcoin', config);

// Create a transaction with proper type checking
const createOptions: CreateTransactionOptions = {
  opReturn: 'Hello, world!',
  feeRate: 2
};

const transaction = await connector.createTransaction(inputs, outputs, createOptions);

// Send a transaction with proper type checking
const sendOptions: SendTransactionOptions = {
  fee: 10000,
  feeRate: 2,
  utxos: inputs,
  opReturn: 'Hello, world!'
};

const result = await connector.sendTransaction('bc1q...', 0.1, sendOptions);
```

### Specialized Transaction Interfaces

FractaLedger provides specialized interfaces for different transaction operations:

1. **TransactionOptions**: General interface for transaction operations
   - `opReturn?`: Optional OP_RETURN data
   - `fee?`: Optional transaction fee
   - `feeRate?`: Optional fee rate in satoshis per byte
   - `utxos`: Required UTXOs to use for the transaction

2. **CreateTransactionOptions**: Interface for the `createTransaction` method
   - `opReturn?`: Optional OP_RETURN data
   - `fee?`: Optional transaction fee
   - `feeRate?`: Optional fee rate in satoshis per byte
   - `utxos?`: Optional UTXOs to use for the transaction

3. **SendTransactionOptions**: Interface for the `sendTransaction` method
   - `opReturn?`: Optional OP_RETURN data
   - `fee`: Required transaction fee
   - `feeRate`: Required fee rate in satoshis per byte
   - `utxos`: Required UTXOs to use for the transaction

### Working with Optional Properties

When working with optional properties in TypeScript (marked with `?`), you may encounter type compatibility issues. In these cases, you can use type assertions to tell TypeScript that you know what you're doing:

```typescript
const sendOptions = {
  fee: 10000,
  feeRate: 2,
  utxos: inputs,
  opReturn: 'Hello, world!'
};

// Use type assertion when TypeScript has trouble with complex interfaces
const result = await connector.sendTransaction('bc1q...', 0.1, sendOptions as any);
```

For more detailed information about TypeScript support, see [PackageExportsImplementation.md](PackageExportsImplementation.md).

## Documentation

FractaLedger provides comprehensive documentation across various files. Here's a complete list of documentation files available in the project:

### Core Documentation
- [README.md](README.md) - Main project documentation
- [API.md](API.md) - API documentation
- [STRUCTURE.md](STRUCTURE.md) - Project structure documentation
- [PackageExportsImplementation.md](PackageExportsImplementation.md) - Exports and typescript documentation

### Component Documentation
- [docs/BaseInternalWallet.md](docs/BaseInternalWallet.md) - Base internal wallet documentation
- [docs/InternalWalletFunding.md](docs/InternalWalletFunding.md) - Internal wallet funding documentation
- [docs/InternalWalletFundingAndPrimaryWallet.md](docs/InternalWalletFundingAndPrimaryWallet.md) - Internal wallet primary wallet check documentation
- [docs/InternalWalletFundingSufficientFundsCheck.md](docs/InternalWalletFundingSufficientFundsCheck.md) - Internal Wallet funds check documentation
- [docs/InternalWalletFundingSummary.md](docs/InternalWalletFundingSummary.md) - Internal wallet funds summary documentation
- [docs/InternalWalletFundingEndpointExplanation.md](docs/InternalWalletFundingEndpointExplanation.md) - Internal wallet API documentation
- [docs/TransceiverSystemDocumentation.md](docs/TransceiverSystemDocumentation.md) - Transceiver System documentation
- [docs/TransceiverEndpointsGuide.md](docs/TransceiverEndpointsGuide.md) - Transceiver enpoints documentation
- [api-extensions/README.md](api-extensions/README.md) - API extensions documentation
- [transceivers/README.md](transceivers/README.md) - Transceivers documentation
- [logs/README.md](logs/README.md) - Logs directory documentation
- [test/README.md](test/README.md) - Test documentation

### Chaincode Documentation
- [src/chaincode/custom/README.md](src/chaincode/custom/README.md) - Custom chaincode documentation
- [src/chaincode/templates/default/README.md](src/chaincode/templates/default/README.md) - Default chaincode template documentation
- [src/chaincode/templates/merchant-fee/README.md](src/chaincode/templates/merchant-fee/README.md) - Merchant fee chaincode template documentation
- [src/chaincode/templates/employee-payroll/README.md](src/chaincode/templates/employee-payroll/README.md) - Employee payroll chaincode template documentation
