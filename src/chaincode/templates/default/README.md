# FractaLedger Default Chaincode Template

This is the default chaincode template for the FractaLedger system. It provides basic functionality for managing internal wallets and transactions. Users can customize this template to fit their specific needs.

## Overview

The default chaincode template includes the following functionality:

- Creating and managing internal wallets
- Updating wallet balances
- Transferring funds between internal wallets
- Withdrawing funds from internal wallets
- Tracking transaction history
- Distributing funds based on percentages

## Customization

You can customize this template to fit your specific needs by modifying the existing functions or adding new ones. Here are some common customization scenarios:

### Fee Structures

You can modify the `withdrawFromInternalWallet` function to implement custom fee structures. For example:

```javascript
async withdrawFromInternalWallet(ctx, internalWalletId, toAddress, amount, fee) {
  // ... existing code ...
  
  // Custom fee calculation
  let customFee = transactionFee;
  
  // Example: Tiered fee structure
  if (withdrawalAmount > 10) {
    customFee = transactionFee * 0.9; // 10% discount for larger withdrawals
  }
  
  const totalAmount = withdrawalAmount + customFee;
  
  // ... rest of the function ...
}
```

### Fund Distribution Rules

You can modify the `distributeFunds` function or create new distribution functions to implement custom distribution rules. For example:

```javascript
async distributeEqualFunds(ctx, primaryWalletName, amount) {
  // ... existing code ...
  
  // Get all internal wallets for the primary wallet
  const allWallets = await this.getAllInternalWallets(ctx);
  const wallets = allWallets.filter(wallet => wallet.primaryWalletName === primaryWalletName);
  
  // Distribute funds equally
  const distributionAmount = totalAmount / wallets.length;
  
  // ... rest of the function ...
}
```

### Withdrawal Logic

You can implement custom withdrawal logic by adding validation rules to the `withdrawFromInternalWallet` function. For example:

```javascript
async withdrawFromInternalWallet(ctx, internalWalletId, toAddress, amount, fee) {
  // ... existing code ...
  
  // Custom withdrawal rules
  
  // Example: Withdrawal limits
  if (withdrawalAmount > 100) {
    throw new Error(`Withdrawal amount exceeds limit`);
  }
  
  // Example: Withdrawal frequency
  const withdrawalHistory = await this.getWithdrawalHistory(ctx, internalWalletId);
  const recentWithdrawals = withdrawalHistory.filter(w => {
    const withdrawalDate = new Date(w.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - withdrawalDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1; // Within the last day
  });
  
  if (recentWithdrawals.length >= 3) {
    throw new Error(`Withdrawal frequency limit exceeded`);
  }
  
  // ... rest of the function ...
}
```

### Transaction Frequency

You can implement transaction frequency controls by adding validation rules to the relevant functions. For example:

```javascript
async transferBetweenInternalWallets(ctx, fromWalletId, toWalletId, amount) {
  // ... existing code ...
  
  // Custom transaction frequency rules
  
  // Example: Transfer frequency
  const transferHistory = await this.getTransferHistory(ctx, fromWalletId);
  const recentTransfers = transferHistory.filter(t => {
    const transferDate = new Date(t.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - transferDate);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    return diffMinutes <= 5; // Within the last 5 minutes
  });
  
  if (recentTransfers.length >= 5) {
    throw new Error(`Transfer frequency limit exceeded`);
  }
  
  // ... rest of the function ...
}
```

### Direct Passthrough Mode

You can implement a direct passthrough mode by adding a new function that automatically forwards received funds to internal wallets. For example:

```javascript
async directPassthrough(ctx, primaryWalletName, amount, fee) {
  // ... existing code ...
  
  // Get all internal wallets for the primary wallet
  const allWallets = await this.getAllInternalWallets(ctx);
  const wallets = allWallets.filter(wallet => wallet.primaryWalletName === primaryWalletName);
  
  // Calculate the amount to distribute (minus fee)
  const distributionAmount = totalAmount - fee;
  
  // Distribute funds based on predefined rules
  // ... distribution logic ...
  
  // ... rest of the function ...
}
```

## Deployment

To deploy your customized chaincode, follow these steps:

1. Modify the chaincode template as needed
2. Package the chaincode
3. Install the chaincode on the Hyperledger Fabric network
4. Instantiate the chaincode on the channel

For more information on deploying chaincode, refer to the Hyperledger Fabric documentation.

## Testing

You can test your customized chaincode using the Jest testing framework. Create test files in the `__tests__` directory and run them using the `npm test` command.

## Best Practices

- Keep your chaincode functions simple and focused on a single responsibility
- Implement proper error handling and validation
- Use descriptive variable and function names
- Add comments to explain complex logic
- Test your chaincode thoroughly before deployment
