#!/bin/bash

set -e

python scripts/updateLicense.py $(git ls-files "*\.go" | grep -v thrift-gen | grep -v tracetest)
