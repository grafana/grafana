# gRPC Channels

[![Build Status](https://circleci.com/gh/fullstorydev/grpchan/tree/master.svg?style=svg)](https://circleci.com/gh/fullstorydev/grpchan/tree/master)
[![Go Report Card](https://goreportcard.com/badge/github.com/fullstorydev/grpchan)](https://goreportcard.com/report/github.com/fullstorydev/grpchan)
[![GoDoc](https://godoc.org/github.com/fullstorydev/grpchan?status.svg)](https://godoc.org/github.com/fullstorydev/grpchan)

This repo provides an abstraction for an RPC connection: the `Channel`.
Implementations of `Channel` can provide alternate transports -- different
from the standard HTTP/2-based transport provided by the `google.golang.org/grpc`
package.

This can be useful for providing new transports, such as HTTP 1.1, web sockets,
or (significantly) in-process channels for testing.

This repo also contains two such alternate transports: an HTTP 1.1 implementation
of gRPC (which supports all stream kinds other than full-duplex bidi streams) and
an in-process transport (which allows a process to dispatch handlers implemented
in the same program without needing serialize and de-serialize messages over the
loopback network interface).

In order to use channels with your proto-defined gRPC services, you need to use a
protoc plugin included in this repo: `protoc-gen-grpchan`.

```bash
go install github.com/fullstorydev/grpchan/cmd/protoc-gen-grpchan
```

You use the plugin via a `--grpchan_out` parameter to protoc. Specify the same
output directory to this parameter as you supply to `--go_out`. The plugin will
then generate `*.pb.grpchan.go` files, alongside the `*.pb.go` files. These
additional files contain additional methods that let you use the proto-defined
service methods with alternate transports.

```go
//go:generate protoc --go_out=plugins=grpc:. --grpchan_out=. my.proto
```
