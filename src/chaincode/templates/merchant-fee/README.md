# FractaLedger Merchant Fee Chaincode Template

This is a specialized chaincode template for the FractaLedger system, designed specifically for merchant fee collection use cases. It extends the default template with additional functionality for handling merchant transactions and fee collection.

## Overview

The merchant fee chaincode template includes the following functionality:

- All the basic functionality from the default template
- Wallet type classification (merchant, customer, fee)
- Fee configuration management
- Merchant transaction processing with automatic fee collection
- Merchant-specific fee rates
- Transaction history tracking

## Use Case

This template is ideal for businesses that facilitate transactions between customers and merchants and want to collect a fee for each transaction. For example:

- E-commerce platforms that connect buyers and sellers
- Payment processors that handle transactions between customers and businesses
- Marketplaces that facilitate peer-to-peer transactions

## Key Features

### Fee Configuration

The template includes a fee configuration system that allows you to:

- Set a default fee percentage for all transactions
- Define minimum and maximum fee amounts
- Set merchant-specific fee rates

You can update the fee configuration at any time using the `updateFeeConfiguration` function.

### Merchant Transaction Processing

The `processMerchantTransaction` function handles the entire transaction flow:

1. Verifies that the customer has sufficient funds
2. Calculates the fee based on the fee configuration
3. Transfers the appropriate amount to the merchant
4. Collects the fee in a designated fee wallet
5. Records the transaction details on the ledger

### Wallet Types

The template extends the internal wallet model to include a `type` field, which can be:

- `customer`: A wallet owned by a customer who makes purchases
- `merchant`: A wallet owned by a merchant who receives payments
- `fee`: A wallet that collects transaction fees

## Customization

You can customize this template to fit your specific needs by modifying the existing functions or adding new ones. Here are some common customization scenarios:

### Tiered Fee Structure

You can modify the fee calculation logic in the `processMerchantTransaction` function to implement a tiered fee structure. For example:

```javascript
// Calculate the fee
let feePercentage = feeConfig.defaultFeePercentage;

// Check if there's a merchant-specific fee
if (feeConfig.merchantSpecificFees[merchantWalletId]) {
  feePercentage = feeConfig.merchantSpecificFees[merchantWalletId];
}

// Apply tiered fee structure
if (transactionAmount > 1000) {
  feePercentage = feePercentage * 0.8; // 20% discount for large transactions
} else if (transactionAmount > 500) {
  feePercentage = feePercentage * 0.9; // 10% discount for medium transactions
}

let feeAmount = transactionAmount * (feePercentage / 100);
```

### Volume-Based Discounts

You can implement volume-based discounts by tracking the total transaction volume for each merchant and adjusting the fee accordingly:

```javascript
// Get merchant transaction history
const merchantTransactions = await this.getMerchantTransactions(ctx, merchantWalletId, '1000');

// Calculate total transaction volume
let totalVolume = 0;
for (const tx of merchantTransactions) {
  totalVolume += tx.amount;
}

// Apply volume-based discount
let feePercentage = feeConfig.defaultFeePercentage;
if (totalVolume > 10000) {
  feePercentage = feePercentage * 0.7; // 30% discount for high-volume merchants
} else if (totalVolume > 5000) {
  feePercentage = feePercentage * 0.8; // 20% discount for medium-volume merchants
} else if (totalVolume > 1000) {
  feePercentage = feePercentage * 0.9; // 10% discount for low-volume merchants
}
```

### Fee Splitting

You can modify the `processMerchantTransaction` function to split the fee between multiple wallets:

```javascript
// Split the fee between multiple wallets
const platformFeeAmount = feeAmount * 0.7; // 70% to the platform
const referralFeeAmount = feeAmount * 0.3; // 30% to the referrer

// Update the platform fee wallet
platformFeeWallet.balance += platformFeeAmount;
platformFeeWallet.updatedAt = new Date().toISOString();
await ctx.stub.putState(platformFeeWalletId, Buffer.from(JSON.stringify(platformFeeWallet)));

// Update the referral fee wallet
referralFeeWallet.balance += referralFeeAmount;
referralFeeWallet.updatedAt = new Date().toISOString();
await ctx.stub.putState(referralFeeWalletId, Buffer.from(JSON.stringify(referralFeeWallet)));
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

- Keep your fee structure transparent and fair
- Implement proper error handling and validation
- Use descriptive variable and function names
- Add comments to explain complex logic
- Test your chaincode thoroughly before deployment
