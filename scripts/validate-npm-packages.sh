#!/bin/bash
set -e

# This script is used to validate the npm packages that are published to npmjs.org are in the correct format.
# It won't catch things like malformed JS or Types but it will assert that the package has
# the correct files and package.json properties.
ARTIFACTS_DIR="./npm-artifacts"

for file in "$ARTIFACTS_DIR"/*.tgz; do
  echo "🔍 Checking NPM package: $file"

  if [[ "$file" == *"@grafana-i18n"* ]]; then
    IGNORE_RULES="named-exports false-cjs untyped-resolution"
  else
    IGNORE_RULES="named-exports false-cjs"
  fi
  # shellcheck disable=SC2086
  yarn attw "$file" --ignore-rules $IGNORE_RULES --profile node16
  yarn publint "$file"
done

echo "🚀 All NPM package checks passed! 🚀"
exit 0
