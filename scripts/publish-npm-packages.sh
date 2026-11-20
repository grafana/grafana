#!/bin/bash

# Set default values for dist-tag and registry for local development
# to prevent running this script and accidentally publishing to npm
dist_tag="canary"
registry="http://localhost:4873"

# Require either ACTIONS_ID_TOKEN_REQUEST_URL or NPM_TOKEN to be set
if [ -z "$ACTIONS_ID_TOKEN_REQUEST_URL" ] && [ -z "$NPM_TOKEN" ]; then
    echo "ERROR: Either ACTIONS_ID_TOKEN_REQUEST_URL or NPM_TOKEN environment variable must be set."
    echo "If running in Github Actions, ensure that 'id-token: write' permission is granted."
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

echo "Starting to release $dist_tag version with NPM version $(npm --version) to registry $registry"

if [ -n "$NPM_TOKEN" ]; then
  echo "Configured NPM_TOKEN in ~/.npmrc"
  registry_without_protocol=${registry#*:}
  echo "$registry_without_protocol/:_authToken=${NPM_TOKEN}" >> ~/.npmrc
fi

# Loop over .tar files in directory and publish them to npm registry.
# A version that is already published is skipped, so running the script again after a partial publish can end green.
failed_packages=()
for file in ./npm-artifacts/*.tgz; do
    if ! spec=$(tar -xzOf "$file" package/package.json | node -p 'const p = JSON.parse(require("fs").readFileSync(0, "utf8")); p.name + "@" + p.version'); then
        echo "ERROR: Could not read the name and version of $file"
        failed_packages+=("$file")
        continue
    fi

    if view_output=$(npm view "$spec" version --registry "$registry" 2>&1); then
        echo "Skipping $spec: it is already published."
        continue
    fi

    # Only E404 means that the version is not published. Any other error, such as a network failure, says nothing about it.
    if [[ "$view_output" != *E404* ]]; then
        echo "$view_output"
        echo "ERROR: Could not check whether $spec is already published."
        failed_packages+=("$file")
        continue
    fi

    if ! npm publish "$file" --tag "$dist_tag" --registry "$registry"; then
        failed_packages+=("$file")
    fi
done

# Log failed packages and exit with error if any failed
if (( ${#failed_packages[@]} > 0 )); then
    echo ""
    echo "ERROR: The following packages failed to publish:"
    for pkg in "${failed_packages[@]}"; do
        echo "  - $pkg"
    done
    exit 1
fi

