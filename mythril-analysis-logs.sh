#!/bin/bash

# Find all .sol files in subdirectories
find . -name "*.sol" | while read file; do
  # Get the base name of the Solidity file without the extension
  base_name=$(basename "$file" .sol)

  # Check if the file contains an abstract contract
  if ! grep -q "abstract contract" "$file"; then
    echo "Analyzing contract: $file"

    # Analyze each non-abstract contract with Mythril and print the results to the terminal
    docker run -v $(pwd):/src mythril/myth:latest analyze /src/$file --solv 0.8.13 -o json

    echo "Analysis completed for $file."
  else
    echo "Skipping abstract contract: $file"
  fi
done

echo "Mythril analysis completed for all non-abstract contracts."