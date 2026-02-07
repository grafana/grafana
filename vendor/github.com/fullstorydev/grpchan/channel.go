package grpchan

import (
	"google.golang.org/grpc"
)

// Channel is an abstraction of a GRPC transport. With corresponding generated
// code, it can provide an alternate transport to the standard HTTP/2-based one.
// For example, a Channel implementation could instead provide an HTTP 1.1-based
// transport, or an in-process transport.
//
// Deprecated: Use grpc.ClientConnInterface instead.
type Channel = grpc.ClientConnInterface
