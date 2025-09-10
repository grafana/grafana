#!/bin/bash

# Set default values for dist-tag and registry for local development
# to prevent running this script and accidentally publishing to npm
dist_tag="canary"
registry="http://localhost:4873"

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

echo "Starting to release $dist_tag version with NPM version $(npm --version) to registry $registry"

if [[ "$NPM_TOKEN" != "oidc" ]]; then
  registry_without_protocol=${registry#*:}
  echo "$registry_without_protocol/:_authToken=${NPM_TOKEN}" >> ~/.npmrc
fi

# Loop over .tar files in directory and publish them to npm registry
failed_packages=()
for file in ./npm-artifacts/*.tgz; do
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

# Check if any files in packages/grafana-e2e-selectors were changed. If so, add a 'modified' tag to the package
CHANGES_COUNT=$(git diff HEAD~1..HEAD --name-only -- packages/grafana-e2e-selectors | awk 'END{print NR}')
if (( CHANGES_COUNT > 0 )); then
    # Wait a little bit to allow the package to be published to the registry
    sleep 5s
    regex_pattern="canary: ([0-9.-]+)"
    TAGS=$(npm dist-tag ls @grafana/e2e-selectors)
    if [[ $TAGS =~ $regex_pattern ]]; then
        echo "$CHANGES_COUNT file(s) in packages/grafana-e2e-selectors were changed. Adding 'modified' tag to @grafana/e2e-selectors@${BASH_REMATCH[1]}"
        npm dist-tag add @grafana/e2e-selectors@"${BASH_REMATCH[1]}" modified
    fi
fi

