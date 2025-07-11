#!/usr/bin/env bash

echo $PWD

# Check if pkg directory and Makefile exist
if [ -d "pkg" ] && [ -f "Makefile" ]; then
    echo "Found pkg directory and Makefile. Running make run-air..."
    make run-air
else
    echo "Error: pkg directory or Makefile not found in current directory."
    echo "Please ensure you are in the correct Grafana project directory."
    exit 1
fi
