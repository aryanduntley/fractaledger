# UTXO Transceivers

This directory contains transceiver implementations for UTXO-based blockchains. A transceiver is responsible for both broadcasting transactions to the blockchain network and receiving updates about wallet activity. This two-way communication ensures that wallet data stays up-to-date with on-chain transactions.

## What is a Transceiver?

A transceiver is a module that implements the `UTXOTransceiver` interface defined in `src/blockchain/utxoTransceiver.js`. It provides methods for:

1. **Broadcasting transactions** to the blockchain network
2. **Monitoring wallet addresses** for new transactions
3. **Getting wallet balances** from the blockchain
4. **Retrieving transaction history** for wallet addresses
5. **Getting unspent transaction outputs (UTXOs)** for wallet addresses

This approach completely separates transaction creation/signing from the blockchain interaction mechanism, allowing users to handle blockchain operations through their preferred method.

## Using Transceivers

To use a transceiver, you need to:

1. Create a transceiver implementation that extends the `UTXOTransceiver` interface
2. Configure your wallet to use the transceiver in the configuration file
3. The system will automatically load and use your transceiver when needed

### Configuration Example

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
        "callbackModule": "./transceivers/utxo-transceiver.js",
        "monitoringInterval": 60000,
        "autoMonitor": true
      }
    }
  ]
}
```

## Creating a Custom Transceiver

To create a custom transceiver, you need to extend the `UTXOTransceiver` interface and implement all required methods. You can use the `utxo-transceiver-example.js` file in this directory as a starting point.

### Important: Do Not Modify Files in node_modules

When using FractaLedger as an npm package, you should **never** modify files directly in the `node_modules` directory. Instead:

1. Copy the example transceiver file to your project directory:
   ```bash
   cp node_modules/fractaledger/transceivers/utxo-transceiver-example.js ./my-transceivers/bitcoin-transceiver.js
   ```

2. Customize the copied file to implement your specific blockchain interaction logic

3. Update your configuration file (`fractaledger.json` in your project root) to point to your custom implementation:
   ```json
   {
     "bitcoin": [
       {
         "name": "btc_wallet_1",
         "walletAddress": "bc1q...",
         "secretEnvVar": "BTC_WALLET_1_SECRET",
         "transceiver": {
           "method": "callback",
           "module": "./my-transceivers/bitcoin-transceiver.js",
           "config": {
             "apiUrl": "https://blockstream.info/api"
           }
         }
       }
     ]
   }
   ```

This approach ensures that your custom implementations survive package updates and don't get overwritten when you update the FractaLedger package.

### Required Methods

1. `broadcastTransaction(txHex, metadata)`: Broadcast a transaction to the blockchain network
2. `monitorWalletAddress(address, callback)`: Start monitoring a wallet address for new transactions
3. `stopMonitoringWalletAddress(address)`: Stop monitoring a wallet address
4. `getWalletBalance(address)`: Get the current balance of a wallet address
5. `getTransactionHistory(address, limit)`: Get transaction history for a wallet address
6. `getUTXOs(address)`: Get unspent transaction outputs (UTXOs) for a wallet address

### Example Implementations

#### Full Node Implementation

You can implement a transceiver that connects to a full node (e.g., Bitcoin Core) to broadcast transactions and monitor wallet addresses:

```javascript
const { UTXOTransceiver } = require('../src/blockchain/utxoTransceiver');
const Client = require('bitcoin-core');

class FullNodeTransceiver extends UTXOTransceiver {
  constructor(config = {}) {
    super(config);
    
    this.client = new Client({
      network: config.network || 'mainnet',
      host: config.host || 'localhost',
      port: config.port || 8332,
      username: config.username || 'rpcuser',
      password: config.password || 'rpcpassword'
    });
  }
  
  async broadcastTransaction(txHex, metadata = {}) {
    try {
      const txid = await this.client.sendRawTransaction(txHex);
      return txid;
    } catch (error) {
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  // Implement other required methods...
}

module.exports = FullNodeTransceiver;
```

#### API Service Implementation

You can implement a transceiver that uses a third-party API service (e.g., Blockstream, BlockCypher) to broadcast transactions and monitor wallet addresses:

```javascript
const { UTXOTransceiver } = require('../src/blockchain/utxoTransceiver');
const fetch = require('node-fetch');

class APITransceiver extends UTXOTransceiver {
  constructor(config = {}) {
    super(config);
    
    this.apiUrl = config.apiUrl || 'https://blockstream.info/api';
    this.apiKey = config.apiKey;
  }
  
  async broadcastTransaction(txHex, metadata = {}) {
    try {
      const response = await fetch(`${this.apiUrl}/tx`, {
        method: 'POST',
        body: txHex
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const txid = await response.text();
      return txid;
    } catch (error) {
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  // Implement other required methods...
}

module.exports = APITransceiver;
```

#### Electrum Implementation

You can implement a transceiver that connects to an Electrum server to broadcast transactions and monitor wallet addresses:

```javascript
const { UTXOTransceiver } = require('../src/blockchain/utxoTransceiver');
const { ElectrumClient } = require('electrum-client');

class ElectrumTransceiver extends UTXOTransceiver {
  constructor(config = {}) {
    super(config);
    
    this.server = config.server || 'electrum.blockstream.info';
    this.port = config.port || 50002;
    this.protocol = config.protocol || 'ssl';
    this.client = null;
  }
  
  async initialize() {
    this.client = new ElectrumClient(this.port, this.server, this.protocol);
    await this.client.connect();
  }
  
  async broadcastTransaction(txHex, metadata = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }
      
      const txid = await this.client.blockchain_transaction_broadcast(txHex);
      return txid;
    } catch (error) {
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }
  
  async cleanup() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
  
  // Implement other required methods...
}

module.exports = ElectrumTransceiver;
```

## Transceiver Events

Transceivers can emit events to notify the system about changes in wallet activity. The following events are supported:

1. `transaction`: Emitted when a transaction is broadcasted
2. `transactions`: Emitted when new transactions are detected for a monitored address
3. `balance`: Emitted when a wallet balance is updated
4. `error`: Emitted when an error occurs

You can listen for these events in your application:

```javascript
const connector = getConnector('bitcoin', 'btc_wallet_1');

connector.on('transaction', (data) => {
  console.log(`Transaction broadcasted: ${data.txid}`);
});

connector.on('transactions', (data) => {
  console.log(`New transactions detected for address ${data.address}`);
  console.log(data.transactions);
});

connector.on('balance', (data) => {
  console.log(`Balance updated for address ${data.address}: ${data.balance}`);
});

connector.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});
```

## Best Practices

1. **Error Handling**: Always include proper error handling in your transceiver to ensure that errors are properly reported back to the application.

2. **Connection Management**: If your transceiver connects to a remote service, make sure to properly manage the connection (connect before use, disconnect after use).

3. **Logging**: Include appropriate logging to help with debugging and monitoring.

4. **Retry Logic**: Consider implementing retry logic for transient errors.

5. **Dependency Management**: Keep dependencies to a minimum and ensure they are properly declared in your package.json.

6. **Security**: Be careful with sensitive information like private keys and API keys. Use environment variables for storing secrets.

7. **Monitoring**: Implement proper monitoring for wallet addresses to ensure that the system stays up-to-date with on-chain transactions.

8. **Cleanup**: Always clean up resources when they are no longer needed to prevent memory leaks and other issues.

## Conclusion

The transceiver architecture provides a flexible and extensible way to interact with UTXO-based blockchains. By implementing the `UTXOTransceiver` interface, you can create custom transceivers that use your preferred method of interacting with the blockchain network.

This approach completely separates transaction creation/signing from the blockchain interaction mechanism, allowing you to handle blockchain operations through your preferred method while still benefiting from the FractaLedger system's fractional ownership management capabilities.
