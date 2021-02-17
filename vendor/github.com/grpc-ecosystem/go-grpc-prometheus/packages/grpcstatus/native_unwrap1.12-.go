// +build !go1.13

package grpcstatus

import (
	"google.golang.org/grpc/status"
)

func unwrapNativeWrappedGRPCStatus(err error) (*status.Status, bool) {
	return nil, false
}
