#!/bin/bash

# Temporary - remove this script once the dashboard schema are mature

# Remove the appropriate ellipses from the schema to check for unspecified
# fields in the artifacts (validating "open")

# Run from root of grafana repo
CMD=${CLI:-bin/darwin-amd64/grafana-cli}
for DASH in $(grep -rl '"schemaVersion": 30' devenv); do echo $DASH; $CMD cue validate-resource --dashboard $DASH; done
