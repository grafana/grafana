#!/bin/sh

set -e

MY_DIR=$(dirname "$0")

cd "${MY_DIR}"
mkdir -p "artifacts"

echo "Linux"
GOARCH=amd64 GOOS=linux go build -o "artifacts/jsonmerge" ./cmd

echo "Windows"
GOARCH=amd64 GOOS=windows go build -o "artifacts/jsonmerge.exe" ./cmd

echo "Mac(darwin)"
GOARCH=amd64 GOOS=darwin go build -o "artifacts/jsonmerge_darwin" ./cmd

echo "Build done"
