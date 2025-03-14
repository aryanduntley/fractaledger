# FractaLedger API Documentation

This document provides an overview of the FractaLedger API endpoints and how to use them.

## Authentication

All API endpoints (except `/api/health` and `/api/auth/login`) require authentication using a JWT token.

### Login

```
POST /api/auth/login
{
  "username": "admin",
  "password": "password"
}
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Use this token in the `Authorization` header for all subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Wallet Management

### Get All Wallets

```
GET /api/wallets
```

Response:

```json
[
  {
    "blockchain": "bitcoin",
    "name": "btc_wallet_1",
    "address": "bc1q...",
    "connectionType": "spv"
  },
  {
    "blockchain": "litecoin",
    "name": "ltc_wallet_1",
    "address": "ltc1q...",
    "connectionType": "spv"
  }
]
```

### Get Wallets for a Blockchain

```
GET /api/wallets/:blockchain
```

Response:

```json
[
  {
    "blockchain": "bitcoin",
    "name": "btc_wallet_1",
    "address": "bc1q...",
    "connectionType": "spv"
  },
  {
    "blockchain": "bitcoin",
    "name": "btc_wallet_2",
    "address": "bc1q...",
    "connectionType": "api"
  }
]
```

### Get Wallet Details

```
GET /api/wallets/:blockchain/:name
```

Response:

```json
{
  "blockchain": "bitcoin",
  "name": "btc_wallet_1",
  "address": "bc1q...",
  "connectionType": "spv",
  "balance": 1.5
}
```

### Get Wallet Read-Only Details

```
GET /api/wallets/:blockchain/:name/read-only
```

Response:

```json
{
  "blockchain": "bitcoin",
  "name": "btc_wallet_1",
  "address": "bc1q...",
  "connectionType": "spv",
  "balance": 1.5,
  "aggregateInternalBalance": 1.2,
  "excessBalance": 0.3,
  "baseInternalWalletId": "base_wallet_bitcoin_btc_wallet_1"
}
```

> **Note**: This endpoint provides read-only access to the primary wallet, including information about the aggregate balance of all internal wallets associated with this primary wallet, the excess balance (balance - aggregateInternalBalance), and the ID of the base internal wallet that represents this excess balance. This endpoint is particularly useful for monitoring the health of the system and ensuring that the primary wallet has sufficient funds to cover all internal wallets.

### Get Wallet Transactions

```
GET /api/wallets/:blockchain/:name/transactions?limit=10
```

Response:

```json
[
  {
    "txid": "0x1234567890abcdef",
    "amount": 0.5,
    "timestamp": "2025-03-12T12:00:00Z",
    "type": "incoming"
  },
  {
    "txid": "0xabcdef1234567890",
    "amount": 0.2,
    "timestamp": "2025-03-11T10:00:00Z",
    "type": "outgoing"
  }
]
```

## Internal Wallet Management

### Create Internal Wallet

```
POST /api/internal-wallets
{
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "internalWalletId": "internal_wallet_1",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "accountType": "premium"
  }
}
```

Response:

```json
{
  "id": "internal_wallet_1",
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "balance": 0,
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "accountType": "premium"
  },
  "createdAt": "2025-03-12T12:00:00Z"
}
```

> **Note**: The `metadata` field is optional and can contain any JSON object up to 2KB in size. It can be used to store additional information about the wallet.

### Get All Internal Wallets

```
GET /api/internal-wallets
```

Response:

```json
[
  {
    "id": "internal_wallet_1",
    "blockchain": "bitcoin",
    "primaryWalletName": "btc_wallet_1",
    "balance": 0.5,
    "metadata": {
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "accountType": "premium"
    },
    "createdAt": "2025-03-12T12:00:00Z"
  },
  {
    "id": "internal_wallet_2",
    "blockchain": "litecoin",
    "primaryWalletName": "ltc_wallet_1",
    "balance": 2.5,
    "metadata": {
      "customerName": "Jane Smith",
      "customerEmail": "jane@example.com",
      "accountType": "standard"
    },
    "createdAt": "2025-03-12T12:00:00Z"
  }
]
```

### Get Internal Wallet Details

```
GET /api/internal-wallets/:id
```

Response:

```json
{
  "id": "internal_wallet_1",
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "balance": 0.5,
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "accountType": "premium"
  },
  "createdAt": "2025-03-12T12:00:00Z"
}
```

### Get Internal Wallet Balance

```
GET /api/internal-wallets/:id/balance
```

Response:

```json
{
  "id": "internal_wallet_1",
  "balance": 0.5
}
```

### Update Internal Wallet Metadata

```
PUT /api/internal-wallets/:id/metadata
{
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john.doe@example.com",
    "accountType": "premium",
    "notes": "Customer since 2023"
  }
}
```

Response:

```json
{
  "id": "internal_wallet_1",
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "balance": 0.5,
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john.doe@example.com",
    "accountType": "premium",
    "notes": "Customer since 2023"
  },
  "createdAt": "2025-03-12T12:00:00Z",
  "updatedAt": "2025-03-12T13:30:00Z"
}
```

> **Note**: The metadata object can be up to 2KB in size. This endpoint completely replaces the existing metadata with the new metadata provided.

## Transactions

### Transfer Between Internal Wallets

```
POST /api/transactions/internal-transfer
{
  "fromInternalWalletId": "internal_wallet_1",
  "toInternalWalletId": "internal_wallet_2",
  "amount": 0.1,
  "memo": "Payment for services" // Optional
}
```

Response:

```json
{
  "id": "transfer_1",
  "fromWalletId": "internal_wallet_1",
  "toWalletId": "internal_wallet_2",
  "amount": 0.1,
  "memo": "Payment for services",
  "timestamp": "2025-03-12T12:00:00Z"
}
```

> **Note**: Internal transfers are only allowed between wallets that are on the same blockchain network and mapped to the same primary on-chain wallet. These transfers happen entirely within the internal ledger and do not create on-chain transactions, making them instant and free.

### Withdraw from Internal Wallet

```
POST /api/transactions/withdraw
{
  "internalWalletId": "internal_wallet_1",
  "toAddress": "bc1q...",
  "amount": 0.1
}
```

Response:

```json
{
  "id": "withdrawal_1",
  "internalWalletId": "internal_wallet_1",
  "toAddress": "bc1q...",
  "amount": 0.1,
  "fee": 0.0001,
  "timestamp": "2025-03-12T12:00:00Z",
  "txid": "0x1234567890abcdef"
}
```

> **Note**: The `fee` field represents the blockchain transaction fee (gas) required to process the on-chain transaction. This fee is deducted from the internal wallet's balance to ensure that the total withdrawal amount (including the fee) doesn't exceed the available balance. The fee varies based on network conditions and transaction size.

### Get Transaction History

```
GET /api/transactions?internalWalletId=internal_wallet_1&limit=10
```

Response:

```json
[
  {
    "txid": "tx1",
    "timestamp": "2025-03-12T12:00:00Z",
    "value": {
      "id": "internal_wallet_1",
      "blockchain": "bitcoin",
      "primaryWalletName": "btc_wallet_1",
      "balance": 0.5,
      "metadata": {
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "accountType": "premium"
      },
      "createdAt": "2025-03-12T12:00:00Z",
      "updatedAt": "2025-03-12T12:00:00Z"
    }
  },
  {
    "txid": "tx2",
    "timestamp": "2025-03-11T10:00:00Z",
    "value": {
      "id": "internal_wallet_1",
      "blockchain": "bitcoin",
      "primaryWalletName": "btc_wallet_1",
      "balance": 0.6,
      "metadata": {
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "accountType": "standard"
      },
      "createdAt": "2025-03-12T12:00:00Z",
      "updatedAt": "2025-03-11T10:00:00Z"
    }
  }
]
```

## Balance Reconciliation

### Get Reconciliation Configuration

```
GET /api/reconciliation/config
```

Returns the current balance reconciliation configuration.

**Response**

```json
{
  "strategy": "afterTransaction",
  "scheduledFrequency": 3600000,
  "warningThreshold": 0.00001,
  "strictMode": false
}
```

### Reconcile a Specific Wallet

```
POST /api/reconciliation/wallet/:blockchain/:name
```

Performs balance reconciliation for a specific primary wallet.

**Parameters**

- `blockchain` (path): The blockchain type (bitcoin, litecoin, dogecoin)
- `name` (path): The primary wallet name

**Response**

```json
{
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "onChainBalance": 1.5,
  "aggregateInternalBalance": 1.5,
  "difference": 0,
  "hasDiscrepancy": false,
  "timestamp": "2025-03-13T12:00:00Z"
}
```

### Reconcile All Wallets

```
POST /api/reconciliation/all
```

Performs balance reconciliation for all primary wallets.

**Response**

```json
[
  {
    "blockchain": "bitcoin",
    "primaryWalletName": "btc_wallet_1",
    "onChainBalance": 1.5,
    "aggregateInternalBalance": 1.5,
    "difference": 0,
    "hasDiscrepancy": false,
    "timestamp": "2025-03-13T12:00:00Z"
  },
  {
    "blockchain": "litecoin",
    "primaryWalletName": "ltc_wallet_1",
    "onChainBalance": 10.0,
    "aggregateInternalBalance": 10.0,
    "difference": 0,
    "hasDiscrepancy": false,
    "timestamp": "2025-03-13T12:00:00Z"
  }
]
```

### Get Balance Discrepancies

```
GET /api/reconciliation/discrepancies
```

Returns a list of balance discrepancies.

**Query Parameters**

- `resolved` (optional): Filter by resolved status (`true` or `false`)

**Response**

```json
[
  {
    "id": "discrepancy_1",
    "blockchain": "bitcoin",
    "primaryWalletName": "btc_wallet_1",
    "onChainBalance": 1.5,
    "aggregateInternalBalance": 1.6,
    "difference": 0.1,
    "timestamp": "2025-03-13T12:00:00Z",
    "resolved": false
  }
]
```

### Resolve a Balance Discrepancy

```
POST /api/reconciliation/discrepancies/:id/resolve
```

Resolves a balance discrepancy.

**Parameters**

- `id` (path): The discrepancy ID
- `resolution` (body): The resolution description

**Request Body**

```json
{
  "resolution": "Manual adjustment made to internal wallet balances"
}
```

**Response**

```json
{
  "id": "discrepancy_1",
  "blockchain": "bitcoin",
  "primaryWalletName": "btc_wallet_1",
  "onChainBalance": 1.5,
  "aggregateInternalBalance": 1.6,
  "difference": 0.1,
  "timestamp": "2025-03-13T12:00:00Z",
  "resolved": true,
  "resolution": "Manual adjustment made to internal wallet balances",
  "resolvedAt": "2025-03-13T12:30:00Z"
}
```

## API Messaging System

All API responses now include a structured messaging system that provides clear, consistent, and informative feedback. Messages are categorized by type and severity, making it easier to handle responses programmatically.

### Message Types

- **Info**: Informational messages about successful operations
- **Warning**: Alerts about potential issues that didn't prevent the operation
- **Error**: Messages about failures that prevented the operation

### Response Format

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
    }
  ]
}
```

### Message Codes

Each message includes a unique code that can be used for programmatic handling:

- **INFO_001**: Transaction processed successfully
- **INFO_002**: Wallet created successfully
- **INFO_003**: Balance updated successfully
- **INFO_004**: Reconciliation completed successfully
- **WARN_001**: Primary wallet balance is low
- **WARN_002**: Balance discrepancy detected
- **WARN_003**: Reconciliation needed
- **WARN_004**: Transaction delayed
- **ERROR_001**: Insufficient balance
- **ERROR_002**: Wallet not found
- **ERROR_003**: Transaction failed
- **ERROR_004**: Invalid parameters

## Chaincode Management

> **Note**: Chaincode Management API endpoints are disabled by default for security reasons. To enable these endpoints, set `api.endpoints.chaincodeManagement.enabled` to `true` in your configuration file:
>
> ```json
> {
>   "api": {
>     "endpoints": {
>       "chaincodeManagement": {
>         "enabled": true
>       }
>     }
>   }
> }
> ```
>
> It is recommended to keep these endpoints disabled in production environments and only enable them during initial setup or when chaincode modifications are needed.

### Get Available Templates

```
GET /api/chaincode/templates
```

Response:

```json
[
  {
    "id": "default",
    "name": "fractaledger-chaincode",
    "description": "FractaLedger Chaincode for Hyperledger Fabric",
    "readme": "# FractaLedger Default Chaincode Template\n\nThis is the default chaincode template for the FractaLedger system..."
  },
  {
    "id": "merchant-fee",
    "name": "fractaledger-merchant-fee-chaincode",
    "description": "FractaLedger Merchant Fee Chaincode for Hyperledger Fabric",
    "readme": "# FractaLedger Merchant Fee Chaincode Template\n\nThis is a specialized chaincode template for the FractaLedger system..."
  }
]
```

### Create Custom Chaincode

```
POST /api/chaincode/custom
{
  "templateId": "default",
  "customId": "my-custom-chaincode"
}
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "templateId": "default",
  "path": "/path/to/my-custom-chaincode"
}
```

### Get All Custom Chaincodes

```
GET /api/chaincode/custom
```

Response:

```json
[
  {
    "id": "my-custom-chaincode",
    "name": "fractaledger-custom-my-custom-chaincode",
    "description": "FractaLedger Chaincode for Hyperledger Fabric",
    "path": "/path/to/my-custom-chaincode"
  }
]
```

### Get Custom Chaincode Details

```
GET /api/chaincode/custom/:id
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "name": "fractaledger-custom-my-custom-chaincode",
  "description": "FractaLedger Chaincode for Hyperledger Fabric",
  "path": "/path/to/my-custom-chaincode"
}
```

### Update Custom Chaincode

```
PUT /api/chaincode/custom/:id
{
  "filePath": "index.js",
  "content": "// Your updated chaincode content"
}
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "path": "/path/to/my-custom-chaincode",
  "updatedFile": "index.js"
}
```

### Delete Custom Chaincode

```
DELETE /api/chaincode/custom/:id
```

Response:

```json
{
  "success": true
}
```

### Install Dependencies for Custom Chaincode

```
POST /api/chaincode/custom/:id/install-dependencies
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "status": "dependencies installed",
  "stdout": "...",
  "stderr": "..."
}
```

### Deploy Custom Chaincode

```
POST /api/chaincode/custom/:id/deploy
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "status": "deployed",
  "timestamp": "2025-03-12T12:00:00Z"
}
```

### Update Deployed Chaincode

```
POST /api/chaincode/custom/:id/update
```

Response:

```json
{
  "id": "my-custom-chaincode",
  "status": "updated",
  "timestamp": "2025-03-12T12:00:00Z"
}
```

## Error Handling

All API endpoints return appropriate HTTP status codes and error messages in case of failure:

```json
{
  "error": "Error message"
}
```

Common status codes:
- 400: Bad Request (missing or invalid parameters)
- 401: Unauthorized (missing or invalid authentication)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource not found)
- 500: Internal Server Error (server-side error)
