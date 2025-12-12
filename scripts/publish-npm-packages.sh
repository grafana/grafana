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
CHANGES_COUNT=$(git show --name-only --format= HEAD -- packages/grafana-e2e-selectors | awk 'END{print NR}')
if (( CHANGES_COUNT > 0 )); then
    # Wait a little bit to allow the package to be published to the registry
    sleep 5s
    regex_pattern="canary: ([0-9.-]+)"
    TAGS=$(npm dist-tag ls @grafana/e2e-selectors)
    if [[ $TAGS =~ $regex_pattern ]]; then
        echo "$CHANGES_COUNT file(s) in packages/grafana-e2e-selectors were changed. Adding 'modified' tag to @grafana/e2e-selectors@${BASH_REMATCH[1]}"
        
        # If using OIDC, exchange token for npm auth (npm publish handles OIDC internally,
        # but dist-tag requires explicit authentication)
        # Reference: https://github.com/electron/npm-trusted-auth-action
        if [ -n "$ACTIONS_ID_TOKEN_REQUEST_URL" ] && [ -n "$ACTIONS_ID_TOKEN_REQUEST_TOKEN" ]; then
            echo "Fetching GitHub OIDC token..."
            OIDC_TOKEN=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
                "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=npm:registry.npmjs.org" | jq -r '.value // empty')
            
            if [ -z "$OIDC_TOKEN" ]; then
                echo "Warning: Failed to fetch OIDC token, dist-tag operation may fail"
            else
                # Mask the OIDC token so it won't appear in logs
                echo "::add-mask::$OIDC_TOKEN"
                echo "Exchanging OIDC token for npm auth token..."
                ENCODED_PACKAGE=$(printf "%s" "@grafana/e2e-selectors" | jq -Rr @uri)
                RESPONSE=$(curl -sS -X POST \
                    -H "Authorization: Bearer $OIDC_TOKEN" \
                    -H "Accept: application/json" \
                    -w "\n%{http_code}" \
                    "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/$ENCODED_PACKAGE")
                
                HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
                BODY=$(echo "$RESPONSE" | sed '$d')
                
                if [ "$HTTP_CODE" != "201" ]; then
                    echo "Warning: Failed to exchange token. Status: $HTTP_CODE"
                else
                    NPM_AUTH_TOKEN=$(echo "$BODY" | jq -r '.token // empty')
                    if [ -n "$NPM_AUTH_TOKEN" ]; then
                        # Mask the token so it won't appear in logs
                        echo "::add-mask::$NPM_AUTH_TOKEN"
                        echo "Configuring npm auth via NPM_TOKEN env var"
                        export NPM_TOKEN="$NPM_AUTH_TOKEN"
                        # Reference the env var in npmrc (single quotes intentional - npm expands it at runtime)
                        # shellcheck disable=SC2016
                        echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' >> ~/.npmrc
                    else
                        echo "Warning: No token in response, dist-tag operation may fail"
                    fi
                fi
            fi
        fi
        
        npm dist-tag add @grafana/e2e-selectors@"${BASH_REMATCH[1]}" modified
    fi
fi

