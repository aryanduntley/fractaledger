# FractaLedger Project Structure

This document provides an overview of the FractaLedger project structure and explains the purpose of each directory and key file.

## Directory Structure

```
fractaledger/
├── src/                      # Source code
│   ├── api/                  # API server
│   │   └── server.js         # Express server setup and API endpoints
│   ├── blockchain/           # Blockchain connectors
│   │   ├── connectors/       # Specific connector implementations
│   │   │   └── spvConnector.js  # SPV node connector
│   │   ├── blockchainConnector.js  # Abstract connector interface
│   │   └── connectorManager.js     # Connector initialization
│   ├── chaincode/            # Hyperledger Fabric chaincode
│   │   ├── custom/           # User-customized chaincodes
│   │   ├── templates/        # Chaincode templates
│   │   │   ├── default/      # Default chaincode template
│   │   │   └── merchant-fee/ # Merchant fee chaincode template
│   │   └── chaincodeManager.js     # Chaincode management
│   ├── config/               # Configuration management
│   │   └── configLoader.js   # Configuration loading and validation
│   ├── hyperledger/          # Hyperledger Fabric integration
│   │   └── fabricManager.js  # Fabric client initialization and management
│   ├── wallet/               # Wallet management
│   │   └── walletManager.js  # Wallet initialization and management
│   └── index.js              # Main entry point
├── test/                     # Test files
│   ├── api.test.js           # API tests
│   ├── blockchain-connector.test.js  # Blockchain connector tests
│   ├── run-tests.sh          # Test runner script
│   └── setup.js              # Test setup
├── API.md                    # API documentation
├── config-template.json      # Configuration template
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore file
├── jest.config.js            # Jest configuration
├── LICENSE                   # License file
├── package.json              # Project dependencies
├── README.md                 # Project overview
├── setup.sh                  # Setup script
└── STRUCTURE.md              # This file
```

## Key Components

### API Server (`src/api/server.js`)

The API server provides RESTful endpoints for interacting with the FractaLedger system. It handles authentication, wallet management, internal wallet management, transactions, and chaincode management.

### Blockchain Connectors (`src/blockchain/`)

The blockchain connectors provide a unified interface for interacting with different UTXO-based blockchains. The abstract `BlockchainConnector` class defines the interface, and specific implementations provide the actual functionality:

1. **SpvConnector** (`src/blockchain/connectors/spvConnector.js`): Connects to UTXO-based blockchains using SPV (Simple Payment Verification) protocol. This is a lightweight connection that doesn't require a full blockchain download.

2. **FullNodeConnector** (`src/blockchain/connectors/fullNodeConnector.js`): Connects to a full blockchain node via RPC. This provides maximum security and reliability but requires running a full node (Bitcoin Core, Litecoin Core, etc.).

3. **ApiConnector** (`src/blockchain/connectors/apiConnector.js`): Connects to blockchain API services like BlockCypher, Blockstream, or Blockchair. This is the easiest to set up but relies on third-party services.

The `ConnectorManager` (`src/blockchain/connectorManager.js`) initializes and manages these connectors based on the configuration.

### Chaincode Management (`src/chaincode/`)

The chaincode management module provides functionality for managing Hyperledger Fabric chaincode. It includes templates for common use cases and allows users to create, customize, and deploy their own chaincodes.

### Configuration Management (`src/config/`)

The configuration management module loads and validates the configuration from various sources, including environment variables, configuration files, and command-line arguments.

### Hyperledger Fabric Integration (`src/hyperledger/`)

The Hyperledger Fabric integration module provides functionality for interacting with the Hyperledger Fabric network. It handles client initialization, transaction submission, and chaincode deployment.

### Wallet Management (`src/wallet/`)

The wallet management module provides functionality for managing UTXO-based wallets. It handles wallet initialization, balance checking, transaction history, and transaction submission.

## Key Files

### Main Entry Point (`src/index.js`)

The main entry point initializes and starts the FractaLedger system. It loads the configuration, initializes the blockchain connectors, wallet manager, Hyperledger Fabric client, chaincode manager, and starts the API server.

### Configuration Template (`config-template.json`)

The configuration template provides a starting point for configuring the FractaLedger system. It includes settings for blockchain connections, Hyperledger Fabric, and API server.

### Environment Variables Template (`.env.example`)

The environment variables template provides a starting point for configuring environment variables. It includes settings for sensitive information like private keys and API keys.

### API Documentation (`API.md`)

The API documentation provides detailed information about the RESTful API endpoints, including request and response formats, authentication, and error handling.

### Setup Script (`setup.sh`)

The setup script helps users set up the FractaLedger system by installing dependencies, creating configuration files, and setting up the environment.

### Test Runner Script (`test/run-tests.sh`)

The test runner script helps users run the tests for the FractaLedger system. It can run all tests or specific tests based on a pattern.

## Development Workflow

1. **Setup**: Run `./setup.sh` to set up the project.
2. **Configuration**: Edit `config.json` and `.env` to configure the system.
3. **Development**: Run `npm run dev` to start the system in development mode.
4. **Testing**: Run `./test/run-tests.sh` to run the tests.
5. **Building**: Run `npm run build` to build the project for production.
6. **Deployment**: Deploy the built project to your production environment.

## Customization

The FractaLedger system is designed to be highly customizable. Users can:

1. **Add New Blockchain Connectors**: Implement the `BlockchainConnector` interface to add support for new blockchains.
2. **Customize Chaincode**: Create custom chaincodes based on the provided templates to implement specific business logic.
3. **Extend the API**: Add new API endpoints to support additional functionality.
4. **Configure the System**: Adjust the configuration to fit specific requirements.

## Best Practices

1. **Security**: Keep sensitive information like private keys and API keys in environment variables, not in configuration files.
2. **Testing**: Write tests for all new functionality and run the existing tests before deploying changes.
3. **Documentation**: Document all changes and additions to the system.
4. **Backup**: Regularly backup your configuration and data.
5. **Monitoring**: Set up monitoring to track the health and performance of the system.
