//go:generate protoc -I ./ ./grpc_broker.proto ./grpc_controller.proto ./grpc_stdio.proto --go_out=plugins=grpc:.

package plugin
