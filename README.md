# FractaLedger

FractaLedger is a configurable off-chain UTXO management system that enables fractional ownership, secure fund distribution, and seamless on-chain interactions across multiple blockchains.

## Overview

FractaLedger solves the challenge of managing fractional ownership of UTXO-based cryptocurrencies (Bitcoin, Litecoin, Dogecoin, etc.) without requiring expensive on-chain transactions for every operation. It uses Hyperledger Fabric as an internal ledger to track fractional ownership while maintaining the security and transparency of blockchain technology.

### Key Features

- **Bring Your Own Wallet**: Users provide their own UTXO-based wallet addresses and private keys
- **Multi-Blockchain Support**: Works with Bitcoin, Litecoin, Dogecoin, and other UTXO-based blockchains
- **Flexible Connection Options**: Connect via full node, SPV node, or API services
- **Customizable Smart Contracts**: Define your own fund distribution rules, fee structures, and withdrawal logic
- **Comprehensive API**: Integrate with your existing applications through a RESTful API
- **Secure by Design**: No traditional database, all data stored on an internal blockchain

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fractaledger.git
cd fractaledger

# Install dependencies
npm install

# Copy configuration templates
cp config-template.json config.json
cp .env.example .env

# Edit configuration files
# - Update config.json with your blockchain connection details
# - Add your wallet secrets to .env

# Start the system
npm start
```

## Configuration

FractaLedger uses a configuration-based approach that allows you to specify how to connect to various blockchains and how to manage your wallets. The main configuration file is `config.json`, and sensitive information like private keys is stored in environment variables.

### Example Configuration

See `config-template.json` for a complete example configuration. Here's a simplified version:

```json
{
  "bitcoin": [
    {
      "name": "btc_wallet_1",
      "connectionType": "spv",
      "connectionDetails": {
        "server": "localhost:50001",
        "network": "mainnet"
      },
      "walletAddress": "bc1q...",
      "secretEnvVar": "BTC_WALLET_1_SECRET"
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

### Connection Types

FractaLedger supports three types of connections to UTXO-based blockchains:

1. **SPV (Simple Payment Verification) Node**
   - Lightweight connection that doesn't require a full blockchain download
   - Uses SPV protocol to verify transactions
   - Suitable for most use cases
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_1",
     "connectionType": "spv",
     "connectionDetails": {
       "server": "localhost:50001",
       "network": "mainnet"
     },
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_1_SECRET"
   }
   ```

2. **Full Node**
   - Connects to a full blockchain node via RPC
   - Requires running a full node (Bitcoin Core, Litecoin Core, etc.)
   - Provides maximum security and reliability
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_3",
     "connectionType": "fullNode",
     "connectionDetails": {
       "host": "localhost",
       "port": 8332,
       "username": "bitcoinrpc",
       "password": "rpcpassword",
       "protocol": "http",
       "network": "mainnet"
     },
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_3_SECRET"
   }
   ```

3. **API Service**
   - Connects to a blockchain API service (BlockCypher, Blockstream, Blockchair)
   - Doesn't require running any nodes
   - Easiest to set up but relies on third-party services
   - Supports multiple API providers
   - Example configuration:
   ```json
   {
     "name": "btc_wallet_2",
     "connectionType": "api",
     "connectionDetails": {
       "provider": "blockCypher",
       "endpoint": "https://api.blockcypher.com/v1/btc/main",
       "apiKeyEnvVar": "BLOCKCYPHER_API_KEY"
     },
     "walletAddress": "bc1q...",
     "secretEnvVar": "BTC_WALLET_2_SECRET"
   }
   ```

You can configure multiple wallets with different connection types for the same blockchain, providing flexibility and redundancy.

### Environment Variables

Sensitive information like private keys and API keys should be stored in environment variables. See `.env.example` for a complete list of required environment variables.

## Project Structure

```
fractaledger/
├── src/                      # Source code
│   ├── api/                  # API server
│   ├── blockchain/           # Blockchain connectors
│   │   ├── connectors/       # Specific connector implementations
│   │   ├── blockchainConnector.js  # Abstract connector interface
│   │   └── connectorManager.js     # Connector initialization
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
├── API.md                    # API documentation
├── config-template.json      # Configuration template
├── .env.example              # Environment variables template
├── package.json              # Project dependencies
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

# Chaincode Management
GET /api/chaincode/templates - List available chaincode templates
POST /api/chaincode/custom - Create a custom chaincode
PUT /api/chaincode/custom/:id - Update a custom chaincode
POST /api/chaincode/custom/:id/deploy - Deploy a custom chaincode
```

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
