//go:generate protoc -I ./ ./grpc_broker.proto ./grpc_controller.proto --go_out=plugins=grpc:.

package plugin
