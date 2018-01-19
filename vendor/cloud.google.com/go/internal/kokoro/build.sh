#!/bin/bash

# Fail on any error
set -eo pipefail

# Display commands being run
set -x

# cd to project dir on Kokoro instance
cd git/gocloud

go version

# Set $GOPATH
export GOPATH="$HOME/go"
GOCLOUD_HOME=$GOPATH/src/cloud.google.com/go
mkdir -p $GOCLOUD_HOME

# Move code into $GOPATH and get dependencies
cp -R ./* $GOCLOUD_HOME
cd $GOCLOUD_HOME
go get -v ./...

# # Don't run integration tests until we can protect against code from 
# # untrusted forks reading and storing our service account key.
# cd internal/kokoro
# # Don't print out encryption keys, etc
# set +x
# key=$(cat $KOKORO_ARTIFACTS_DIR/keystore/*_encrypted_ba2d6f7723ed_key)
# iv=$(cat $KOKORO_ARTIFACTS_DIR/keystore/*_encrypted_ba2d6f7723ed_iv)
# pass=$(cat $KOKORO_ARTIFACTS_DIR/keystore/*_encrypted_ba2d6f7723ed_pass)

# openssl aes-256-cbc -K $key -iv $iv -pass pass:$pass -in kokoro-key.json.enc -out key.json -d
# set -x

# export GCLOUD_TESTS_GOLANG_KEY="$(pwd)/key.json"
# export GCLOUD_TESTS_GOLANG_PROJECT_ID="dulcet-port-762"
# cd $GOCLOUD_HOME

# Run tests and tee output to log file, to be pushed to GCS as artifact.
go test -race -v -short ./... 2>&1 | tee $KOKORO_ARTIFACTS_DIR/$KOKORO_GERRIT_CHANGE_NUMBER.txt

# Make sure README.md is up to date.
make -C internal/readme test diff
