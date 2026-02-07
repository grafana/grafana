**What?** Embedding HTTP requests and responses into a gRPC service; a service and client to translate back and forth between the two, so you can use them with your preferred mux.

**Why?** Get all the goodness of protobuf encoding, HTTP/2, snappy, load balancing, persistent connection and native Kubernetes load balancing with ~none of the effort.

To rebuild generated protobuf code, run:

    protoc -I ./ --go_out=plugins=grpc:./ ./httpgrpc.proto

Follow the instructions here to get a working protoc: https://github.com/gogo/protobuf
