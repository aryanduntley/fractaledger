#!/bin/bash

# FractaLedger Setup Script
# This script helps set up the FractaLedger system by installing dependencies,
# creating configuration files, and setting up the environment.

# Exit on error
set -e

# Print a message with a colored prefix
print_message() {
  echo -e "\033[1;34m[FractaLedger Setup]\033[0m $1"
}

# Print an error message with a colored prefix
print_error() {
  echo -e "\033[1;31m[FractaLedger Setup Error]\033[0m $1"
}

# Print a success message with a colored prefix
print_success() {
  echo -e "\033[1;32m[FractaLedger Setup Success]\033[0m $1"
}

# Check if Node.js is installed
check_nodejs() {
  print_message "Checking if Node.js is installed..."
  if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js (v14 or later) and try again."
    exit 1
  fi
  
  node_version=$(node -v | cut -d 'v' -f 2)
  node_major_version=$(echo $node_version | cut -d '.' -f 1)
  
  if [ $node_major_version -lt 14 ]; then
    print_error "Node.js version $node_version is not supported. Please install Node.js v14 or later."
    exit 1
  fi
  
  print_message "Node.js version $node_version is installed."
}

# Check if npm is installed
check_npm() {
  print_message "Checking if npm is installed..."
  if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
  fi
  
  npm_version=$(npm -v)
  print_message "npm version $npm_version is installed."
}

# Install dependencies
install_dependencies() {
  print_message "Installing dependencies..."
  npm install
  print_success "Dependencies installed successfully."
}

# Create configuration files
create_config_files() {
  print_message "Creating configuration files..."
  
  # Create config.json if it doesn't exist
  if [ ! -f "config.json" ]; then
    print_message "Creating config.json from template..."
    cp config-template.json config.json
    print_success "config.json created successfully."
    print_message "You can customize the config.json file to specify your blockchain connections and other settings."
  else
    print_message "config.json already exists. Skipping..."
  fi
  
  # Create .env if it doesn't exist
  if [ ! -f ".env" ]; then
    print_message "Creating .env from template..."
    cp .env.example .env
    print_success ".env created successfully."
    print_message "Please edit .env to add your wallet secrets and API keys."
    print_message "Keep this file secure and never commit it to version control."
  else
    print_message ".env already exists. Skipping..."
  fi
}

# Create directories
create_directories() {
  print_message "Creating required directories..."
  
  # Create logs directory
  mkdir -p logs
  
  # Create custom chaincode directory
  mkdir -p src/chaincode/custom
  
  # Create wallet directory
  mkdir -p wallet
  
  # Create crypto-config directory
  mkdir -p crypto-config
  
  print_success "Directories created successfully."
}

# Check if Docker is installed
check_docker() {
  print_message "Checking if Docker is installed..."
  if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker and try again."
    print_message "You can download Docker from https://www.docker.com/get-started"
    exit 1
  fi
  
  docker_version=$(docker --version | cut -d ' ' -f 3 | cut -d ',' -f 1)
  print_message "Docker version $docker_version is installed."
  
  # Check if Docker is running
  if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  
  print_message "Docker is running."
}

# Check if Docker Compose is installed
check_docker_compose() {
  print_message "Checking if Docker Compose is installed..."
  if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    print_message "You can install Docker Compose by following the instructions at https://docs.docker.com/compose/install/"
    exit 1
  fi
  
  docker_compose_version=$(docker-compose --version | cut -d ' ' -f 3 | cut -d ',' -f 1)
  print_message "Docker Compose version $docker_compose_version is installed."
}

# Set up Hyperledger Fabric
setup_hyperledger_fabric() {
  print_message "Setting up Hyperledger Fabric..."
  
  # Check if Hyperledger Fabric is already set up
  if [ -d "fabric-samples" ]; then
    print_message "Hyperledger Fabric is already set up. Skipping..."
    return
  fi
  
  # Ask the user if they want to set up Hyperledger Fabric
  read -p "Do you want to set up Hyperledger Fabric? This will download and install Hyperledger Fabric binaries and Docker images. (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_message "Skipping Hyperledger Fabric setup."
    return
  fi
  
  # Download Hyperledger Fabric binaries and Docker images
  print_message "Downloading Hyperledger Fabric binaries and Docker images..."
  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.4.9
  
  # Check if the download was successful
  if [ $? -ne 0 ]; then
    print_error "Failed to download Hyperledger Fabric binaries and Docker images."
    exit 1
  fi
  
  print_success "Hyperledger Fabric binaries and Docker images downloaded successfully."
  
  # Set up a basic Hyperledger Fabric network
  print_message "Setting up a basic Hyperledger Fabric network..."
  cd fabric-samples/test-network
  
  # Start the network
  ./network.sh up createChannel -c fractaledger -s couchdb
  
  # Check if the network was started successfully
  if [ $? -ne 0 ]; then
    print_error "Failed to start Hyperledger Fabric network."
    exit 1
  fi
  
  print_success "Hyperledger Fabric network started successfully."
  
  # Deploy the chaincode
  print_message "Deploying chaincode..."
  ./network.sh deployCC -c fractaledger -ccn fractaledger-chaincode -ccp ../../src/chaincode/templates/default -ccl javascript
  
  # Check if the chaincode was deployed successfully
  if [ $? -ne 0 ]; then
    print_error "Failed to deploy chaincode."
    exit 1
  fi
  
  print_success "Chaincode deployed successfully."
  
  # Copy the crypto material to the crypto-config directory
  print_message "Copying crypto material..."
  cd ../..
  cp -r fabric-samples/test-network/organizations/* crypto-config/
  
  print_success "Crypto material copied successfully."
}

# Create connection profile
create_connection_profile() {
  print_message "Creating connection profile..."
  
  # Create connection profile if it doesn't exist
  if [ ! -f "connection-profile.json" ]; then
    print_message "Creating connection-profile.json from template..."
    cp connection-profile-template.json connection-profile.json
    print_success "connection-profile.json created successfully."
    print_message "You can customize the connection-profile.json file to specify your Hyperledger Fabric network settings."
  else
    print_message "connection-profile.json already exists. Skipping..."
  fi
}

# Main function
main() {
  print_message "Starting FractaLedger setup..."
  
  # Check requirements
  check_nodejs
  check_npm
  check_docker
  check_docker_compose
  
  # Install dependencies
  install_dependencies
  
  # Create configuration files
  create_config_files
  
  # Create directories
  create_directories
  
  # Set up Hyperledger Fabric
  setup_hyperledger_fabric
  
  # Create connection profile
  create_connection_profile
  
  print_success "FractaLedger setup completed successfully!"
  print_message "You can now edit the configuration files and start the system with 'npm start'."
  print_message "To use Hyperledger Fabric, make sure the network is running and the connection profile is properly configured."
}

# Run the main function
main
