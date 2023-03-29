#!/bin/bash

# This script is used to validate the npm packages that are published to npmjs.org are in the correct format.
# It won't catch things like malformed JS or Types but it will assert that the package has
# the correct files and package.json properties.
ARTIFACTS_DIR="./npm-artifacts"

for file in $ARTIFACTS_DIR/*.tgz; do
  echo "🔍 Checking NPM package: $file"
  # get filename then strip everything after package name.
  dir_name=$(basename "$file" .tgz | sed 's/@\(.*\)-[0-9].*/\1/')
  mkdir -p "./npm-artifacts/$dir_name"
  tar -xzf "$file" -C "./npm-artifacts/$dir_name" --strip-components=1

  # Make sure the tar wasn't empty
  if [ ! -d "./npm-artifacts/$dir_name" ]; then
    echo -e "❌ Failed: Empty package $dir_name.\n"
    exit 1
  fi

  # Navigate inside the new extracted directory
  pushd "./npm-artifacts/$dir_name"

  # Check for required files
	check_files=("package.json" "README.md" "CHANGELOG.md" "LICENSE_APACHE2")
	for check_file in "${check_files[@]}"; do
		if [ ! -f "$check_file" ]; then
			echo -e "❌ Failed: Missing required file $check_file in package $dir_name.\n"
			exit 1
		fi
	done

  # @grafana/toolkit structure is different to the other packages
  if [[ "$dir_name" == "grafana-toolkit" ]]; then
    if [ ! -d bin ] || [ ! -f bin/grafana-toolkit.js ]; then
      echo -e "❌ Failed: Missing 'bin' directory or required files in package $dir_name.\n"
      exit 1
    fi

    echo -e "✅ Passed: package checks for $file.\n"
    popd
    continue
  fi

  # Assert commonjs builds
  if [ ! -d dist ] || [ ! -f dist/index.js ] || [ ! -f dist/index.d.ts ]; then
    echo -e "❌ Failed: Missing 'dist' directory or required commonjs files in package $dir_name.\n"
    exit 1
  fi

  if [ "$(jq -r '.main' package.json)" != "dist/index.js" ] || \
     [ "$(jq -r '.types' package.json)" != "dist/index.d.ts" ]; then
    echo -e "❌ Failed: Incorrect package.json properties in package $dir_name.\n"
    exit 1
  fi

  # Assert esm builds
  esm_packages=("grafana-data" "grafana-ui" "grafana-runtime" "grafana-e2e-selectors" "grafana-schema")
  if [[ "${esm_packages[*]}" =~ "$dir" ]]; then
    if [[ ! -d "dist/esm" || ! -f "dist/esm/index.js" ]]; then
        echo -e "❌ Failed: Missing esm directory or esm entry file in package $dir.\n"
        exit 1
    fi

    if [[ $(jq -r '.module' package.json) != "dist/esm/index.js" ]]; then
        echo -e "❌ Failed: module property incorrect in package.json file in package $dir.\n"
        exit 1
    fi
  fi

  echo -e "✅ Passed: package checks for $file.\n"
  popd

done

echo "🚀 All NPM package checks passed! 🚀"
rm -rf $ARTIFACTS_DIR/*/
exit 0
