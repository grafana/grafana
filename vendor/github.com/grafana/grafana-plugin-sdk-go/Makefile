SRC_DIR=./proto
DST_DIR=./genproto

all: build

${DST_DIR}/datasource/datasource.pb.go: ${SRC_DIR}/datasource.proto
	protoc -I=${SRC_DIR} --go_out=plugins=grpc:${DST_DIR}/datasource/ ${SRC_DIR}/datasource.proto

build-proto: ${DST_DIR}/datasource/datasource.pb.go

build: build-proto
	go build ./...

.PHONY: all build build-proto
