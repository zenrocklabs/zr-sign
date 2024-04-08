#!/bin/bash

# Create the results folder if it does not exist
mkdir -p results

# Find all .sol files in subdirectories
find . -name "*.sol" | while read file; do
  # Get the base name of the Solidity file without the extension
  base_name=$(basename "$file" .sol)

  # Check if the file contains an abstract contract
  if ! grep -q "abstract contract" "$file"; then
    echo "Analyzing contract: $file"

    # Analyze each non-abstract contract with Mythril
    docker run -v $(pwd):/src mythril/myth:latest analyze /src/$file --solv 0.8.13 -o json > "mythril_results/${base_name}_results.json"

    echo "Analysis completed for $file. Results saved in mythril_results/${base_name}_results.json"
  else
    echo "Skipping abstract contract: $file"
  fi
done

echo "Mythril analysis completed for all non-abstract contracts."
