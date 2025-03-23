# Internal Wallet Funding and Primary Wallet Relationship

## Overview

This document explains how the `/api/internal-wallets/:id/fund` endpoint works in relation to the primary on-chain wallet, specifically focusing on how the system ensures that the primary wallet has sufficient funds to cover all internal wallets.

## Primary Wallet and Internal Wallet Relationship

In the FractaLedger system:

1. Each internal wallet is associated with a primary on-chain wallet.
2. The primary wallet holds the actual cryptocurrency on the blockchain.
3. Internal wallets represent portions of the primary wallet's balance, allocated for different purposes.
4. The sum of all internal wallet balances should never exceed the primary wallet's on-chain balance.

## How Funding Works

When an internal wallet is funded through the `/api/internal-wallets/:id/fund` endpoint:

1. The system increases the balance of the specified internal wallet by the provided amount.
2. This operation does not directly interact with the blockchain or the primary wallet.
3. Instead, it updates the internal ledger maintained in Hyperledger Fabric.
4. After updating the internal wallet's balance, the system triggers a reconciliation process to ensure the integrity of the system.

## Base Internal Wallet and Balance Protection

The key to understanding how the system ensures the primary wallet has sufficient funds lies in the concept of the "Base Internal Wallet":

1. Each primary wallet has an associated "Base Internal Wallet" that represents the unallocated funds in the primary wallet.
2. The base wallet's balance is automatically calculated as: `primaryWalletBalance - sumOfOtherInternalWalletBalances`.
3. When you fund an internal wallet, the base wallet's balance is automatically reduced to maintain the balance equation.
4. If the sum of all internal wallet balances would exceed the primary wallet's balance, the base wallet would have a negative balance, which is not allowed.

## Reconciliation Process

After funding an internal wallet, the system performs a reconciliation process:

1. It retrieves the current on-chain balance of the primary wallet.
2. It calculates the sum of all non-base internal wallet balances.
3. It calculates what the base wallet balance should be: `baseWalletBalance = primaryWalletBalance - sumOfOtherInternalWalletBalances`.
4. It updates the base wallet's balance to this calculated value.
5. If this calculation would result in a negative base wallet balance, it indicates that the internal wallets are trying to allocate more funds than are available in the primary wallet.

## Sufficient Funds Check

The system ensures the primary wallet has sufficient funds through several mechanisms:

1. **Base Wallet Balance Check**: The base wallet balance must remain non-negative after any operation.
2. **Withdrawal Validation**: Before processing a withdrawal, the system checks that the primary wallet has enough funds to cover all internal wallets.
3. **Reconciliation Alerts**: If a discrepancy is detected during reconciliation, the system generates alerts.
4. **Strict Mode Option**: In strict mode, transactions will fail if they would cause a balance discrepancy.

## Example Scenario

Let's walk through an example:

1. Primary Wallet Balance: 1.0 BTC
2. Internal Wallet A Balance: 0.3 BTC
3. Internal Wallet B Balance: 0.2 BTC
4. Base Internal Wallet Balance: 0.5 BTC (automatically calculated as 1.0 - 0.3 - 0.2)

If you fund Internal Wallet A with 0.2 BTC:
1. Internal Wallet A Balance becomes 0.5 BTC
2. The system triggers reconciliation
3. Base Internal Wallet Balance is recalculated as 0.3 BTC (1.0 - 0.5 - 0.2)
4. The total of all internal wallets (0.5 + 0.2 + 0.3 = 1.0) still equals the primary wallet balance

If you try to fund Internal Wallet A with 0.6 BTC:
1. Internal Wallet A Balance would become 0.9 BTC
2. The system triggers reconciliation
3. Base Internal Wallet Balance would be calculated as -0.1 BTC (1.0 - 0.9 - 0.2)
4. Since this would result in a negative base wallet balance, the system would detect a discrepancy
5. In strict mode, this operation would fail

## Implementation Details

The key implementation components that ensure this functionality are:

1. **WalletManager.updateInternalWalletBalance**: Updates the internal wallet balance and triggers reconciliation.
2. **WalletManager.reconcileBaseInternalWallet**: Recalculates and updates the base wallet balance.
3. **BalanceReconciliation.reconcileWallet**: Performs a full reconciliation check and records any discrepancies.
4. **API Extensions**: Both merchant-fee-extension.js and employee-payroll-extension.js implement the `/api/internal-wallets/:id/fund` endpoint with these protections.

## Conclusion

The internal wallet funding endpoint works by updating the internal ledger in Hyperledger Fabric, not by directly interacting with the blockchain. The system ensures that the primary on-chain wallet has sufficient funds through the base internal wallet mechanism and reconciliation process, which maintains the invariant that the sum of all internal wallet balances equals the primary wallet's on-chain balance.
