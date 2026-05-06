#!/bin/bash

# go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
# go install github.com/planetscale/vtprotobuf/cmd/protoc-gen-go-vtproto@latest

which protoc
protoc-gen-go --version
which protoc-gen-go-vtproto

protoc --go_out=. --plugin protoc-gen-go=${GOBIN}/protoc-gen-go --go-vtproto_out=. \
  --plugin protoc-gen-go-vtproto=${GOBIN}/protoc-gen-go-vtproto \
  --go-vtproto_opt=features=marshal+unmarshal+size \
  control.proto
