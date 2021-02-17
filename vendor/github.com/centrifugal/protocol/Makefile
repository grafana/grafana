all: proto

install:
	go mod vendor
	GO111MODULE=off go get -u github.com/gogo/protobuf/protoc-gen-gogofaster
	GO111MODULE=off go get github.com/hairyhenderson/gomplate

proto:
	gomplate -f client.template > definitions/client.proto
	GOGO=1 gomplate -f client.template > client.proto
	cat client.proto
	protoc --proto_path=vendor/:. --gogofaster_out=plugins=grpc:../protocol client.proto
	rm client.proto

test:
	go test -race
