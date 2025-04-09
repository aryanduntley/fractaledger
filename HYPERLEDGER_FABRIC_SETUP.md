# Hyperledger Fabric Setup for FractaLedger

This document provides detailed instructions for setting up Hyperledger Fabric to work with FractaLedger. Following these steps is essential for the proper functioning of FractaLedger in a production environment.

## Prerequisites

Before setting up Hyperledger Fabric for FractaLedger, ensure you have the following prerequisites installed:

### Required Software

- **Docker Engine** (version 19.03.0 or higher)
  - [Docker Installation Guide](https://docs.docker.com/engine/install/)
  - Verify installation: `docker --version`

- **Docker Compose** (version 2.0.0 or higher)
  - [Docker Compose Installation Guide](https://docs.docker.com/compose/install/)
  - Verify installation: `docker-compose --version`
  - Note: Docker Compose has two version numbers:
    1. The binary version (e.g., v2.34.0) - This is the version of the Docker Compose tool
    2. The Compose file format version (e.g., 3.9) - This is used in docker-compose.yml files

- **Go Programming Language** (version 1.14.x or higher, latest is 1.24.2)
  - [Go Installation Guide](https://golang.org/doc/install)
  - Verify installation: `go version`

- **Node.js** (version 14.x or higher) and npm (version 6.x or higher)
  - [Node.js Installation Guide](https://nodejs.org/en/download/)
  - Verify installation: `node --version` and `npm --version`

- **Python** (version 3.7 or higher)
  - [Python Installation Guide](https://www.python.org/downloads/)
  - Verify installation: `python --version` or `python3 --version`

### System Requirements

- **Memory**: Minimum 4GB (8GB recommended)
- **Disk Space**: At least 10GB of free disk space
- **Operating System**: Linux (Ubuntu 18.04 or higher recommended), macOS, or Windows with WSL2
- **Network**: Internet connection for downloading Docker images and Fabric binaries

## Hyperledger Fabric Installation

### 1. Download Fabric Binaries and Docker Images

FractaLedger requires Hyperledger Fabric version 3.1 or higher. Use the following commands to download the necessary binaries and Docker images:

```bash
# Create a directory for Fabric binaries
mkdir -p ~/hyperledger
cd ~/hyperledger

# Download the install script
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh

# Install Fabric binaries, Docker images, and samples (latest version 3.1)
./install-fabric.sh docker binary samples

# Note: The install script creates a fabric-samples directory in the current directory
```

This script downloads:
- Fabric binaries (configtxgen, configtxlator, cryptogen, discover, idemixgen, orderer, peer)
- Fabric Docker images
- Fabric-CA Docker images
- Fabric samples repository

### 2. Verify Installation

Verify that the Fabric Docker images have been downloaded:

```bash
docker images | grep hyperledger
```

You should see several Hyperledger Fabric images, including:
- hyperledger/fabric-peer
- hyperledger/fabric-orderer
- hyperledger/fabric-ca
- hyperledger/fabric-tools
- hyperledger/fabric-ccenv
- hyperledger/fabric-baseos

### 3. Set Environment Variables

Add the Fabric binaries to your PATH:

```bash
export PATH=$PATH:~/hyperledger/fabric-samples/bin
```

To make this change permanent, add it to your shell profile file (e.g., ~/.bashrc, ~/.zshrc):

```bash
echo 'export PATH=$PATH:~/hyperledger/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc
```

If you're using a different shell, use the appropriate profile file:

```bash
# For bash (default on most systems)
echo 'export PATH=$PATH:~/hyperledger/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export PATH=$PATH:~/hyperledger/fabric-samples/bin' >> ~/.zshrc
source ~/.zshrc

# For profile (used by many login shells)
echo 'export PATH=$PATH:~/hyperledger/fabric-samples/bin' >> ~/.profile
source ~/.profile
```

You can also use the absolute path with $HOME to avoid any issues with the tilde (~) expansion:

```bash
echo 'export PATH=$PATH:$HOME/hyperledger/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc
```

### 4. Verify Binaries Installation

Check that the Fabric binaries are installed and accessible:

```bash
# Verify peer binary
peer version

# If you see "Command 'peer' not found", try these troubleshooting steps:

# 1. Check if the binaries were installed:
ls -la ~/hyperledger/fabric-samples/bin

# 2. Check if the PATH includes the bin directory
echo $PATH | grep fabric-samples

# 3. If not, try adding the full path to the command
~/hyperledger/fabric-samples/bin/peer version

# 4. Or use the absolute path with $HOME
export PATH=$PATH:$HOME/hyperledger/fabric-samples/bin
source ~/.bashrc

# 5. Try logging out and logging back in, as some PATH changes only take effect on new login sessions

# 6. If the bin directory is empty or doesn't exist, run the install script with explicit version:
cd ~/hyperledger
./install-fabric.sh --fabric-version 3.1 docker binary samples

# 7. Alternatively, you can download the binaries directly:
cd ~/hyperledger/fabric-samples
curl -sSL https://github.com/hyperledger/fabric/releases/download/v3.1.0/hyperledger-fabric-linux-amd64-3.1.0.tar.gz | tar xz
```

## Setting Up a Fabric Network for FractaLedger

FractaLedger requires a running Hyperledger Fabric network. You can either use the test network provided with Fabric samples or set up a custom network.

### Option 1: Using the Test Network (Recommended for Development)

```bash
# Navigate to the test-network directory
cd ~/hyperledger/fabric-samples/test-network

# Start the network with CouchDB as the state database
./network.sh up createChannel -c fractaledger -s couchdb

# Deploy the chaincode
./network.sh deployCC -c fractaledger -ccn fractaledger-chaincode -ccp /path/to/your/project/src/chaincode/templates/default -ccl javascript
```

### Option 2: Setting Up a Custom Network (Recommended for Production)

For production environments, it's recommended to set up a custom Fabric network with multiple organizations and peers. This process is more complex and beyond the scope of this document. Refer to the [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.2/deployment_guide_overview.html) for detailed instructions.

## Configuring FractaLedger to Connect to Fabric

After setting up your Hyperledger Fabric network, you need to configure FractaLedger to connect to it.

### 1. Copy Crypto Material

Copy the crypto material from your Fabric network to the FractaLedger project:

```bash
# For the test network
mkdir -p /path/to/your/project/crypto-config
cp -r ~/hyperledger/fabric-samples/test-network/organizations/* /path/to/your/project/crypto-config/
```

### 2. Create Connection Profile

Create a connection profile based on the template:

```bash
cp /path/to/your/project/connection-profile-template.json /path/to/your/project/connection-profile.json
```

Edit the connection profile to match your Fabric network configuration:

```json
{
  "name": "fractaledger-network",
  "version": "1.0.0",
  "client": {
    "organization": "Org1",
    "connection": {
      "timeout": {
        "peer": {
          "endorser": 300,
          "eventHub": 300,
          "eventReg": 300
        },
        "orderer": 300
      }
    },
    "credentialStore": {
      "path": "./wallet",
      "cryptoStore": {
        "path": "./wallet"
      }
    }
  },
  "channels": {
    "fractaledger-channel": {
      "orderers": [
        "orderer.example.com"
      ],
      "peers": {
        "peer0.org1.example.com": {
          "endorsingPeer": true,
          "chaincodeQuery": true,
          "ledgerQuery": true,
          "eventSource": true
        }
      }
    }
  },
  "organizations": {
    "Org1": {
      "mspid": "Org1MSP",
      "peers": [
        "peer0.org1.example.com"
      ],
      "certificateAuthorities": [
        "ca.org1.example.com"
      ]
    }
  },
  "orderers": {
    "orderer.example.com": {
      "url": "grpcs://localhost:7050",
      "grpcOptions": {
        "ssl-target-name-override": "orderer.example.com",
        "grpc.keepalive_time_ms": 300000,
        "grpc.keepalive_timeout_ms": 20000,
        "grpc.http2.min_time_between_pings_ms": 120000,
        "grpc.http2.max_pings_without_data": 0
      },
      "tlsCACerts": {
        "path": "./crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
      }
    }
  },
  "peers": {
    "peer0.org1.example.com": {
      "url": "grpcs://localhost:7051",
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org1.example.com",
        "grpc.keepalive_time_ms": 300000,
        "grpc.keepalive_timeout_ms": 20000,
        "grpc.http2.min_time_between_pings_ms": 120000,
        "grpc.http2.max_pings_without_data": 0
      },
      "tlsCACerts": {
        "path": "./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
      }
    }
  },
  "certificateAuthorities": {
    "ca.org1.example.com": {
      "url": "https://localhost:7054",
      "caName": "ca.org1.example.com",
      "httpOptions": {
        "verify": false
      },
      "tlsCACerts": {
        "path": "./crypto-config/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem"
      },
      "registrar": [
        {
          "enrollId": "admin",
          "enrollSecret": "adminpw"
        }
      ]
    }
  }
}
```

### 3. Update FractaLedger Configuration

Update the `fractaledger.json` file to include the Hyperledger Fabric configuration:

```json
{
  "hyperledger": {
    "channelName": "fractaledger-channel",
    "chaincodeName": "fractaledger-chaincode",
    "mspId": "Org1MSP",
    "peerEndpoint": "localhost:7051",
    "tlsCertPath": "./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
    "certPath": "./crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem",
    "keyDirectoryPath": "./crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore",
    "clientTlsCertPath": "./crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/tls/client.crt",
    "clientTlsKeyPath": "./crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/tls/client.key",
    "asLocalhost": true
  }
}
```

## Data Storage Locations

Understanding where Hyperledger Fabric stores its data is important for backup and maintenance:

### Docker Volumes

Hyperledger Fabric stores its data in Docker volumes. These volumes are typically located at:

```
/var/lib/docker/volumes/
```

The specific volumes used by Hyperledger Fabric include:

- **Peer Ledger Data**: Contains the blockchain ledger data
  - Volume name pattern: `peer0.org1.example.com`

- **CouchDB State Database**: Contains the world state database
  - Volume name pattern: `couchdb0`

- **Orderer Data**: Contains the ordering service data
  - Volume name pattern: `orderer.example.com`

You can list these volumes using:

```bash
docker volume ls | grep fabric
```

### Crypto Material

The cryptographic material (certificates, keys) is stored in the `crypto-config` directory in your project:

```
/path/to/your/project/crypto-config/
```

### Wallet Data

Identity information is stored in the `wallet` directory in your project:

```
/path/to/your/project/wallet/
```

## Backup Strategy

To back up your Hyperledger Fabric data:

### 1. Back up Docker Volumes

```bash
# Create a backup directory
mkdir -p /path/to/backup

# Back up a specific volume (e.g., peer0.org1.example.com)
docker run --rm -v peer0.org1.example.com:/source -v /path/to/backup:/backup \
  -w /source alpine tar -czf /backup/peer0.org1.example.com.tar.gz .
```

### 2. Back up Crypto Material

```bash
tar -czf /path/to/backup/crypto-config.tar.gz /path/to/your/project/crypto-config/
```

### 3. Back up Wallet Data

```bash
tar -czf /path/to/backup/wallet.tar.gz /path/to/your/project/wallet/
```

## Troubleshooting

### Common Issues

#### Docker Issues

- **Error**: `Cannot connect to the Docker daemon`
  - **Solution**: Ensure Docker is running: `sudo systemctl start docker`

- **Error**: `No space left on device`
  - **Solution**: Clean up unused Docker resources: `docker system prune -a`

#### Fabric Network Issues

- **Error**: `Error: failed to connect to peer0.org1.example.com:7051`
  - **Solution**: Ensure the Fabric network is running and the peer is accessible

- **Error**: `Error: endorsement failure during invoke`
  - **Solution**: Check the chaincode logs for errors: `docker logs <chaincode-container-id>`

#### Connection Profile Issues

- **Error**: `Error: Failed to connect to Fabric network: Error: PEM file not found at path`
  - **Solution**: Ensure the paths in the connection profile are correct and the files exist

### Checking Logs

To check the logs of Fabric components:

```bash
# Peer logs
docker logs peer0.org1.example.com

# Orderer logs
docker logs orderer.example.com

# CouchDB logs
docker logs couchdb0

# Chaincode logs (container ID will vary)
docker ps | grep chaincode
docker logs <chaincode-container-id>
```

## Additional Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Hyperledger Fabric Gateway Documentation](https://hyperledger.github.io/fabric-gateway/)
- [Docker Documentation](https://docs.docker.com/)
- [CouchDB Documentation](https://docs.couchdb.org/)

## Support

If you encounter issues with Hyperledger Fabric setup for FractaLedger, please:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Consult the Hyperledger Fabric documentation
4. Open an issue on the FractaLedger GitHub repository
