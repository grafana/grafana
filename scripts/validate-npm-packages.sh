#!/bin/bash

# This script is used to validate the npm packages that are published to npmjs.org are in the correct format.
# It won't catch things like malformed JS or Types but it will assert that the package has
# the correct files and package.json properties.
ARTIFACTS_DIR="./npm-artifacts"

for file in $ARTIFACTS_DIR/*.tgz; do
  echo "🔍 Checking NPM package: $file"

  dir_name=$(basename "$file" .tgz)
  mkdir -p "./npm-artifacts/$dir_name"
  tar -xzf "$file" -C "./npm-artifacts/$dir_name" --strip-components=1

  # Navigate inside the new extracted directory
  cd "./npm-artifacts/$dir_name"

  # Check for required files and properties
  if [ ! -f package.json ] || [ ! -f README.md ] || [ ! -f CHANGELOG.md ] || [ ! -f LICENSE_APACHE2 ]; then
    echo -e "❌ Failed: Missing required files in directory: $dir_name.\n"
    exit 1
  fi

  # Skip @grafana/toolkit as its structure is so different to the other packages
  if [[ "$dir_name" == "@grafana-toolkit"* ]]; then

    if [ ! -d bin ] || [ ! -f bin/grafana-toolkit.js ]; then
      echo -e "❌ Failed: Missing 'bin' directory or required files in directory: $dir_name.\n"
      exit 1
    fi

    echo -e "✅ Passed: package checks for $file.\n"
    cd ../..
    continue
  fi

  # Assert commonjs builds
  if [ ! -d dist ] || [ ! -f dist/index.js ] || [ ! -f dist/index.d.ts ]; then
    echo -e "❌ Failed: Missing 'dist' directory or required files in directory: $dir_name.\n"
    exit 1
  fi

  if [ "$(jq -r '.main' package.json)" != "dist/index.js" ] || \
     [ "$(jq -r '.types' package.json)" != "dist/index.d.ts" ]; then
    echo -e "❌ Failed: Incorrect package.json properties in directory: $dir_name.\n"
    exit 1
  fi

  # Assert esm builds
  if [[ "$dir" == "@grafana-data"* || "$dir" == "@grafana-ui"* || "$dir" == "@grafana-runtime"* || "$dir" == "@grafana/e2e-selectors"* || "$dir" == "@grafana/schema"* ]]; then
    if [[ ! -d "dist/esm" || ! -f "dist/esm/index.js" ]]; then
        echo -e "❌ Failed: esm directory or its files missing in directory $dir.\n"
        exit 1
    fi

    if [[ $(jq -r '.module' package.json) != "dist/esm/index.js" ]]; then
        echo -e "❌ Failed: module property incorrect in package.json file in directory $dir.\n"
        exit 1
    fi
  fi

  echo -e "✅ Passed: package checks for $file.\n"
  cd ../..

done

echo "🚀 All npm package checks passed! 🚀"
rm -rf $ARTIFACTS_DIR/*/
exit 0
