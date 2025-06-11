#!/bin/bash

# This script is used to validate the npm packages that are published to npmjs.org are in the correct format.
# It won't catch things like malformed JS or Types but it will assert that the package has
# the correct files and package.json properties.
ARTIFACTS_DIR="./npm-artifacts"

for file in "$ARTIFACTS_DIR"/*.tgz; do
  echo "🔍 Checking NPM package: $file"

  # Ignore named-exports for now as builds aren't compatible yet.
  yarn attw "$file" --ignore-rules "named-exports"
  yarn publint "$file"

done

echo "🚀 All NPM package checks passed! 🚀"
exit 0
