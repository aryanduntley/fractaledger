# FractaLedger Installation Guide

This guide provides step-by-step instructions for installing all the necessary components to run FractaLedger with Hyperledger Fabric on your machine.

## Step 1: Install Node.js and npm

FractaLedger requires Node.js (v14 or later) and npm (v6 or later).

### For Ubuntu/Debian:

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -

# Install Node.js and npm
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v16.x.x
npm --version   # Should show 8.x.x
```

### For macOS (using Homebrew):

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@16

# Verify installation
node --version
npm --version
```

### For Windows:

1. Download the Node.js installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the installation wizard
3. Verify installation by opening Command Prompt and running:
   ```
   node --version
   npm --version
   ```

## Step 2: Install Docker and Docker Compose

Hyperledger Fabric runs in Docker containers, so Docker and Docker Compose are required.

### For Ubuntu/Debian:

```bash
# Update package index
sudo apt-get update

# Install prerequisites
# Note: apt-transport-https is only needed for older Ubuntu/Debian versions (pre-16.04)
# It allows apt to use repositories accessed via HTTPS
# Modern versions of apt have this functionality built-in
sudo apt-get install -y ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Add your user to the docker group to run Docker without sudo
sudo usermod -aG docker $USER

# Install Docker Compose (latest version)
sudo curl -L "https://github.com/docker/compose/releases/download/v2.34.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Note: Docker Compose has two version numbers:
# 1. The binary version (e.g., v2.34.0) - This is what we're installing
# 2. The Compose file format version (e.g., 3.9) - This is used in docker-compose.yml files

# Verify installation
docker --version
docker-compose --version

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

**Note**: After adding your user to the docker group, you may need to log out and log back in for the changes to take effect.

### For macOS:

1. Download and install Docker Desktop from [Docker Hub](https://hub.docker.com/editions/community/docker-ce-desktop-mac/)
2. Follow the installation wizard
3. Start Docker Desktop
4. Verify installation by opening Terminal and running:
   ```bash
   docker --version
   docker-compose --version
   ```

### For Windows:

1. Download and install Docker Desktop from [Docker Hub](https://hub.docker.com/editions/community/docker-ce-desktop-windows/)
2. Follow the installation wizard
3. Start Docker Desktop
4. Verify installation by opening Command Prompt and running:
   ```
   docker --version
   docker-compose --version
   ```

## Step 3: Install Go Programming Language

Hyperledger Fabric requires Go version 1.14.x or higher.

### For Ubuntu/Debian:

```bash
# Download Go (latest version 1.24.2)
wget https://golang.org/dl/go1.24.2.linux-amd64.tar.gz

# Extract the archive
sudo tar -C /usr/local -xzf go1.24.2.linux-amd64.tar.gz

# Add Go to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
source ~/.profile

# Verify installation
go version  # Should show go1.24.2
```

### For macOS (using Homebrew):

```bash
# Install Go
brew install go

# Verify installation
go version
```

### For Windows:

1. Download the Go installer from [golang.org](https://golang.org/dl/)
2. Run the installer and follow the installation wizard
3. Verify installation by opening Command Prompt and running:
   ```
   go version
   ```

## Step 4: Install Python

Python is required for some Hyperledger Fabric tools.

### For Ubuntu/Debian:

```bash
# Install Python 3
sudo apt-get install -y python3 python3-pip

# Verify installation
python3 --version
pip3 --version
```

### For macOS (using Homebrew):

```bash
# Install Python 3
brew install python

# Verify installation
python3 --version
pip3 --version
```

### For Windows:

1. Download the Python installer from [python.org](https://www.python.org/downloads/)
2. Run the installer and follow the installation wizard
   - Make sure to check "Add Python to PATH" during installation
3. Verify installation by opening Command Prompt and running:
   ```
   python --version
   pip --version
   ```

## Step 5: Download Hyperledger Fabric Binaries and Docker Images

Now that you have all the prerequisites installed, you can download the Hyperledger Fabric binaries and Docker images.

```bash
# Create a directory for Fabric
mkdir -p ~/hyperledger
cd ~/hyperledger

# Download the install script
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh

# Install Fabric binaries, Docker images, and samples (latest version 3.1)
./install-fabric.sh docker binary samples

# Note: The install script creates a fabric-samples directory in the current directory
# Add Fabric binaries to PATH (note the nested fabric-samples directory)
echo 'export PATH=$PATH:~/hyperledger/fabric-samples/bin' >> ~/.profile
source ~/.profile

# Verify installation
peer version

# If the peer command is not found even though the binaries are installed, try:
# 1. Check if the PATH includes the bin directory
echo $PATH | grep fabric-samples

# 2. If not, try adding the full path to the command
~/hyperledger/fabric-samples/bin/peer version

# 3. Or use the absolute path to the peer binary
export PATH=$PATH:$HOME/hyperledger/fabric-samples/bin
source ~/.bashrc

# If you see "Command 'peer' not found", check if the binaries were installed:
ls -la ~/hyperledger/fabric-samples/bin

# If the bin directory is empty or doesn't exist, check if the script created a nested directory:
ls -la ~/hyperledger
ls -la ~/hyperledger/fabric-samples

# Run the install script with explicit version if needed:
./install-fabric.sh --fabric-version 3.1 docker binary samples

# Alternatively, you can download the binaries directly:
cd ~/hyperledger/fabric-samples
curl -sSL https://github.com/hyperledger/fabric/releases/download/v3.1.0/hyperledger-fabric-linux-amd64-3.1.0.tar.gz | tar xz
```

## Step 6: Install FractaLedger

Now you can install FractaLedger as a dependency in your project.

```bash
# Create a new directory for your project
mkdir -p my-fractaledger-project
cd my-fractaledger-project

# Initialize a new Node.js project
npm init -y

# Install FractaLedger as a dependency
npm install fractaledger

# Initialize a new FractaLedger project
npx fractaledger-init --dir .
```

## Step 7: Set Up a Test Hyperledger Fabric Network

Before configuring FractaLedger, you need to set up a Hyperledger Fabric network.

```bash
# Navigate to the test-network directory
cd ~/fabric-samples/test-network

# Start the network with CouchDB as the state database
./network.sh up createChannel -c fractaledger -s couchdb

# Deploy the chaincode
./network.sh deployCC -c fractaledger -ccn fractaledger-chaincode -ccp /path/to/your/project/src/chaincode/templates/default -ccl javascript
```

## Step 8: Configure FractaLedger

Now you need to configure FractaLedger to connect to your Hyperledger Fabric network.

### 1. Copy Crypto Material

```bash
# Create crypto-config directory
mkdir -p crypto-config

# Copy crypto material from the test network
cp -r ~/fabric-samples/test-network/organizations/* crypto-config/
```

### 2. Update Configuration

Edit the `fractaledger.json` file to include the Hyperledger Fabric configuration:

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

### 3. Update Environment Variables

Edit the `.env` file to include any necessary environment variables:

```
# API configuration
JWT_SECRET=your_jwt_secret
API_PORT=3000

# Wallet secrets (if using UTXO blockchains)
BTC_WALLET_1_SECRET=your_wallet_private_key_or_seed
```

## Step 9: Start FractaLedger

Now you can start FractaLedger:

```bash
# Start the system
npm start
```

## Verifying Installation

To verify that everything is working correctly:

1. Check that the Hyperledger Fabric network is running:
   ```bash
   docker ps
   ```
   You should see several containers running, including peer, orderer, and CouchDB containers.

2. Check that FractaLedger is connected to the Hyperledger Fabric network:
   ```bash
   # If you've configured the API, you can access it at:
   curl http://localhost:3000/api/health
   ```

3. Check the logs for any errors:
   ```bash
   cat logs/fractaledger.log
   ```

## Troubleshooting

### Docker Issues

- **Error**: `Cannot connect to the Docker daemon`
  - **Solution**: Ensure Docker is running: `sudo systemctl start docker`

- **Error**: `No space left on device`
  - **Solution**: Clean up unused Docker resources: `docker system prune -a`

### Fabric Network Issues

- **Error**: `Error: failed to connect to peer0.org1.example.com:7051`
  - **Solution**: Ensure the Fabric network is running and the peer is accessible

- **Error**: `Error: endorsement failure during invoke`
  - **Solution**: Check the chaincode logs for errors: `docker logs <chaincode-container-id>`

### Connection Profile Issues

- **Error**: `Error: Failed to connect to Fabric network: Error: PEM file not found at path`
  - **Solution**: Ensure the paths in the connection profile are correct and the files exist

## Next Steps

Now that you have installed FractaLedger and set up a Hyperledger Fabric network, you can:

1. Create internal wallets
2. Set up UTXO blockchain connections (if needed)
3. Develop your application using the FractaLedger API

For more information, refer to the [FractaLedger documentation](README.md).

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

For more detailed information about Hyperledger Fabric setup, refer to the [Hyperledger Fabric Setup Guide](HYPERLEDGER_FABRIC_SETUP.md).
