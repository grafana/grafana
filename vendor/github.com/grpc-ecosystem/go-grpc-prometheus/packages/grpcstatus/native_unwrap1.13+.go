// +build go1.13

package grpcstatus

import (
	"errors"
	"google.golang.org/grpc/status"
)

func unwrapNativeWrappedGRPCStatus(err error) (*status.Status, bool) {
	// Unwrapping the native Go unwrap interface
	var unwrappedStatus gRPCStatus
	if ok := errors.As(err, &unwrappedStatus); ok {
		return unwrappedStatus.GRPCStatus(), true
	}
	return nil, false
}
