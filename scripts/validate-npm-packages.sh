#!/usr/bin/env bash
set -e

# This script is used to validate the npm packages that are published to npmjs.org are in the correct format.
# It won't catch things like malformed JS or Types but it will assert that the package has
# the correct files and package.json properties.
ARTIFACTS_DIR="./npm-artifacts"

failed_checks=()

for file in "$ARTIFACTS_DIR"/*.tgz; do
  echo "🔍 Checking NPM package: $file"

  # TODO: Fix the error with @grafana/i18n/eslint-resolution
  if [[ "$file" == *"@grafana-i18n"* ]]; then
    ATTW_FLAGS="--profile node16"
  fi

  # shellcheck disable=SC2086
  if ! yarn attw "$file" --ignore-rules "false-cjs" $ATTW_FLAGS; then
    echo "attw check failed for $file"
    echo ""
    failed_checks+=("$file - yarn attw")
  fi

  if ! yarn publint "$file"; then
    echo "publint check failed for $file"
    echo ""
    failed_checks+=("$file - yarn publint")
  fi
done

if (( ${#failed_checks[@]} > 0 )); then
  echo ""
  echo "❌ The following NPM package checks failed:"
  for check in "${failed_checks[@]}"; do
    echo "  - $check"
  done
  exit 1
fi

echo "🚀 All NPM package checks passed! 🚀"
exit 0
