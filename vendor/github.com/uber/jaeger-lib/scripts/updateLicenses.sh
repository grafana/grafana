#!/bin/bash

set -e
set -x

python scripts/updateLicense.py $(go list -json $(glide nv) | jq -r '.Dir + "/" + (.GoFiles | .[])')
