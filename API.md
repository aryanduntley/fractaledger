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

## Chaincode Management

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
