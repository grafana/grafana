#!/bin/bash

# Set default values for dist-tag and registry for local development
# to prevent running this script and accidentally publishing to npm
dist_tag="canary"
registry="http://localhost:4873"

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

if [ -z "$NPM_TOKEN" ]; then
  echo "The NPM_TOKEN environment variable does not exist."
  exit 1
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --dist-tag)
        dist_tag="$2"
        shift # past argument
        shift # past value
        ;;
        --registry)
        registry="$2"
        shift # past argument
        shift # past value
        ;;
        *)    # unknown option
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

echo "Changes detected in ${count} packages"
echo "Starting to release $dist_tag version"

echo "$registry/:_authToken=${NPM_TOKEN}" >> ~/.npmrc

# Loop over .tar files in directory and publish them to npm registry
for file in ./npm-artifacts/*.tgz; do
    npm publish "$file" --tag "$dist_tag" --registry "$registry"
done
