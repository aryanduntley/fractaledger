#!/bin/bash

# FractaLedger Test Runner
# This script runs all tests for the FractaLedger system.

# Exit on error
set -e

# Print a message with a colored prefix
print_message() {
  echo -e "\033[1;34m[FractaLedger Tests]\033[0m $1"
}

# Print an error message with a colored prefix
print_error() {
  echo -e "\033[1;31m[FractaLedger Tests Error]\033[0m $1"
}

# Print a success message with a colored prefix
print_success() {
  echo -e "\033[1;32m[FractaLedger Tests Success]\033[0m $1"
}

# Run all tests
run_all_tests() {
  print_message "Running all tests..."
  npm test
}

# Run specific test files
run_specific_tests() {
  print_message "Running tests for $1..."
  npm test -- $1
}

# Run component tests
run_component_tests() {
  print_message "Running component tests..."
  npm test -- blockchain-connector.test.js connectors.test.js wallet-manager.test.js wallet-id-uniqueness.test.js
}

# Run chaincode tests
run_chaincode_tests() {
  print_message "Running chaincode tests..."
  npm test -- merchant-fee-chaincode.test.js
}

# Run API tests
run_api_tests() {
  print_message "Running API tests..."
  npm test -- api.test.js
}

# Run end-to-end tests
run_e2e_tests() {
  print_message "Running end-to-end tests..."
  npm test -- end-to-end.test.js
}

# Display help
show_help() {
  echo "FractaLedger Test Runner"
  echo "Usage: $0 [option]"
  echo ""
  echo "Options:"
  echo "  all                Run all tests"
  echo "  component          Run component tests (blockchain connectors, wallet manager)"
  echo "  chaincode          Run chaincode tests"
  echo "  api                Run API tests"
  echo "  e2e                Run end-to-end tests"
  echo "  <test-file>        Run a specific test file"
  echo "  help               Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 all             Run all tests"
  echo "  $0 component       Run component tests"
  echo "  $0 wallet-manager.test.js  Run wallet manager tests"
}

# Main function
main() {
  print_message "Starting FractaLedger tests..."
  
  # Check if a specific test is specified
  if [ $# -eq 0 ]; then
    run_all_tests
  else
    case "$1" in
      all)
        run_all_tests
        ;;
      component)
        run_component_tests
        ;;
      chaincode)
        run_chaincode_tests
        ;;
      api)
        run_api_tests
        ;;
      e2e)
        run_e2e_tests
        ;;
      help)
        show_help
        exit 0
        ;;
      *)
        if [[ $1 == *.test.js ]]; then
          run_specific_tests "$1"
        else
          print_error "Unknown option: $1"
          show_help
          exit 1
        fi
        ;;
    esac
  fi
  
  print_success "Tests completed successfully!"
}

# Run the main function with the provided arguments
main "$@"
