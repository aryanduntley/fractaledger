# Base Internal Wallet

## Overview

The Base Internal Wallet is a special type of internal wallet that automatically tracks the excess funds in a primary on-chain wallet. It serves as a safety mechanism to prevent over-withdrawals and provides a clear view of the available funds that are not allocated to other internal wallets.

## Purpose

The primary purpose of the Base Internal Wallet is to:

1. **Automatically track excess funds**: It represents the difference between the total balance of the primary on-chain wallet and the sum of all other internal wallets associated with that primary wallet.

2. **Prevent accidental over-withdrawals**: By providing a clear view of the excess funds, it helps prevent situations where more funds are withdrawn than are available in the primary wallet.

3. **Simplify accounting**: It provides a straightforward way to account for all funds in the system, ensuring that the sum of all internal wallets (including the base internal wallet) equals the total balance of the primary on-chain wallet.

## How It Works

1. **Creation**: A Base Internal Wallet is automatically created for each primary on-chain wallet when the system initializes.

2. **Balance Calculation**: The balance of the Base Internal Wallet is calculated as:
   ```
   BaseInternalWalletBalance = PrimaryWalletBalance - SumOfOtherInternalWalletBalances
   ```

3. **Updates**: The balance is automatically updated during reconciliation processes, which can be triggered:
   - After each transaction
   - On a scheduled basis
   - Manually through the API

4. **Withdrawals**: The Base Internal Wallet can only be used for withdrawal requests. It cannot be used for transfers to other internal wallets.

## Important Constraints

1. **No Direct Funding**: The Base Internal Wallet cannot be directly funded. Its balance is automatically calculated based on the primary wallet's balance and the sum of other internal wallets.

2. **Withdrawal Only**: The Base Internal Wallet can only be used for withdrawal requests to external addresses. It cannot be used for internal transfers.

3. **No Manual Balance Adjustments**: The balance of the Base Internal Wallet cannot be manually adjusted. It is always calculated automatically.

## Example Scenario

1. Primary on-chain wallet has a balance of 100 BTC.
2. Three internal wallets are created with balances of 20 BTC each (total: 60 BTC).
3. The Base Internal Wallet automatically shows a balance of 40 BTC (100 - 60).
4. If another 10 BTC is added to one of the internal wallets, the Base Internal Wallet balance automatically adjusts to 30 BTC.
5. If the primary wallet receives an additional 20 BTC (new balance: 120 BTC), the Base Internal Wallet balance automatically increases to 50 BTC.

## API Access

The Base Internal Wallet can be accessed through the standard internal wallet endpoints, but with the following limitations:

1. The `/api/internal-wallets/:id/fund` endpoint will return an error if used with a Base Internal Wallet ID.
2. The `/api/transactions/internal-transfer` endpoint will return an error if the Base Internal Wallet is used as either the source or destination.

You can identify a Base Internal Wallet by:
1. Its ID format: `base_wallet_[blockchain]_[primaryWalletName]`
2. The `isBaseWallet: true` property in its metadata

## Best Practices

1. **Regular Reconciliation**: Schedule regular reconciliation processes to ensure the Base Internal Wallet balance accurately reflects the excess funds.

2. **Monitoring**: Set up alerts for significant changes in the Base Internal Wallet balance, as these might indicate unexpected fund movements.

3. **Audit Trail**: Maintain a comprehensive audit trail of all transactions affecting the Base Internal Wallet, including reconciliation adjustments.
