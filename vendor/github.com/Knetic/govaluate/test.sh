#!/bin/bash

# Script that runs tests, code coverage, and benchmarks all at once.
# Builds a symlink in /tmp, mostly to avoid messing with GOPATH at the user's shell level.

TEMPORARY_PATH="/tmp/govaluate_test"
SRC_PATH="${TEMPORARY_PATH}/src"
FULL_PATH="${TEMPORARY_PATH}/src/govaluate"

# set up temporary directory
rm -rf "${FULL_PATH}"
mkdir -p "${SRC_PATH}"

ln -s $(pwd) "${FULL_PATH}"
export GOPATH="${TEMPORARY_PATH}"

pushd "${TEMPORARY_PATH}/src/govaluate"

# run the actual tests.
export GOVALUATE_TORTURE_TEST="true"
go test -bench=. -benchmem -coverprofile coverage.out
status=$?

if [ "${status}" != 0 ];
then
	exit $status
fi

# coverage
go tool cover -func=coverage.out

popd
