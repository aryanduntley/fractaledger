#!/bin/bash

# FractaLedger Test Runner
# This script runs the tests for the FractaLedger system.

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

# Run specific tests
run_specific_tests() {
  print_message "Running tests for $1..."
  npm test -- --grep "$1"
}

# Main function
main() {
  print_message "Starting FractaLedger tests..."
  
  # Check if a specific test is specified
  if [ $# -eq 0 ]; then
    run_all_tests
  else
    run_specific_tests "$1"
  fi
  
  print_success "Tests completed successfully!"
}

# Run the main function with the provided arguments
main "$@"
