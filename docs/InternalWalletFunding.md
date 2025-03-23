# Internal Wallet Funding Endpoint

## Overview

The `/api/internal-wallets/:id/fund` endpoint is used to fund an internal wallet with a specified amount. This endpoint is implemented in both the merchant-fee and employee-payroll API extensions.

## How It Works

When an internal wallet is funded, the following process occurs:

1. The endpoint receives a request with the internal wallet ID and the amount to fund.
2. It first checks if the internal wallet exists.
3. It verifies that the wallet is not a base internal wallet (base wallets cannot be directly funded).
4. It updates the internal wallet's balance by adding the specified amount.
5. After updating the balance, it triggers a reconciliation process to update the base internal wallet balance.
6. The base internal wallet balance is automatically calculated as the difference between the primary on-chain wallet balance and the sum of all other internal wallets associated with that primary wallet.

## Implementation Details

### Wallet Balance Update

The wallet balance is updated using the `updateInternalWalletBalance` method in the wallet manager. This method:

1. Retrieves the internal wallet from the Hyperledger Fabric ledger.
2. Checks if it's a base internal wallet (which cannot be directly updated).
3. Updates the wallet balance in the ledger.
4. Triggers a reconciliation to update the base wallet balance.

### Base Wallet Protection

The system includes a protection mechanism to ensure that the primary on-chain wallet always has sufficient funds to cover all internal wallets:

1. When funding an internal wallet, the system checks if the wallet is a base internal wallet. If it is, the request is rejected because base internal wallets are automatically managed by the system.
2. After funding an internal wallet, the system reconciles the base internal wallet to ensure it correctly represents the excess funds in the primary wallet.
3. The base internal wallet balance is calculated as: `primaryWalletBalance - aggregateNonBaseWalletBalance`.

### Reconciliation Process

The reconciliation process ensures that the sum of all internal wallet balances (including the base wallet) matches the actual on-chain balance of the primary wallet:

1. It gets the on-chain balance of the primary wallet.
2. It calculates the aggregate balance of all non-base internal wallets.
3. It calculates the excess balance that should be in the base wallet: `excessBalance = onChainBalance - aggregateInternalBalance`.
4. It updates the base wallet balance to match this excess balance.

## Error Handling

The endpoint includes several error checks:

1. It verifies that the amount parameter is provided.
2. It checks if the internal wallet exists.
3. It ensures that the wallet is not a base internal wallet (which cannot be directly funded).
4. If any of these checks fail, an appropriate error response is returned.

## Security Considerations

1. The endpoint requires JWT authentication to ensure only authorized users can fund internal wallets.
2. Base internal wallets are protected from direct funding to maintain the integrity of the system.
3. The reconciliation process ensures that the total of all internal wallet balances never exceeds the actual on-chain balance of the primary wallet.

## Example Request

```http
POST /api/internal-wallets/internal_wallet_1/fund
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "amount": 0.5
}
```

## Example Response

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
  "createdAt": "2025-03-12T12:00:00Z",
  "updatedAt": "2025-03-13T12:00:00Z"
}
```

## Error Responses

### Missing Amount Parameter

```json
{
  "error": "Missing required parameters"
}
```

### Internal Wallet Not Found

```json
{
  "error": "Internal wallet not found"
}
```

### Attempting to Fund a Base Internal Wallet

```json
{
  "error": "Cannot directly fund a base internal wallet. Base internal wallet balances are automatically calculated during reconciliation.",
  "messages": [
    {
      "type": "error",
      "code": "ERROR_005",
      "message": "Cannot directly fund a base internal wallet",
      "data": {
        "walletId": "base_wallet_bitcoin_btc_wallet_1",
        "isBaseWallet": true
      },
      "timestamp": "2025-03-13T12:00:00Z"
    }
  ]
}
```
