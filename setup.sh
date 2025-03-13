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
  
  print_success "Directories created successfully."
}

# Main function
main() {
  print_message "Starting FractaLedger setup..."
  
  # Check requirements
  check_nodejs
  check_npm
  
  # Install dependencies
  install_dependencies
  
  # Create configuration files
  create_config_files
  
  # Create directories
  create_directories
  
  print_success "FractaLedger setup completed successfully!"
  print_message "You can now edit the configuration files and start the system with 'npm start'."
}

# Run the main function
main
