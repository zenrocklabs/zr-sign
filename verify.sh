#!/bin/bash
# Author Venimir Petkov
# Check if the network argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <network>"
    exit 1
fi

network=$1

# Execute the truffle commands
echo "Verifying ZrSignTypes with network $network..."
truffle run verify ZrSignTypes --network $network
if [ $? -ne 0 ]; then
    echo "Error verifying ZrSignTypes. Exiting."
    exit 1
fi

echo "Verifying ZrSign with network $network..."
truffle run verify ZrSign --network $network
if [ $? -ne 0 ]; then
    echo "Error verifying ZrSign. Exiting."
    exit 1
fi

echo "Verifying ZrSign with custom-proxy QProxy and network $network..."
truffle run verify ZrSign --custom-proxy QProxy --network $network
if [ $? -ne 0 ]; then
    echo "Error verifying ZrSign with custom-proxy. Exiting."
    exit 1
fi

echo "All verifications completed successfully."

# chmod +x verify.sh
# ./verify.sh sepolia
