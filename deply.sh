#!/bin/bash

# Function to deploy to a network
deploy() {
  local network=$1
  echo "Deploying to $network network..."
  npx hardhat run --network $network scripts/deploy.ts
  if [ $? -ne 0 ]; then
    echo "Deployment to $network network failed!"
    exit 1
  fi
  echo "Deployment to $network network succeeded."
}

# Deploy to all networks
deploy "sepolia"
deploy "polygon_amoy"
deploy "avalanche_fuji"
deploy "arb_sepolia"
deploy "binance_testnet"
deploy "base_sepolia"
deploy "optimism_sepolia"

echo "All deployments completed successfully."