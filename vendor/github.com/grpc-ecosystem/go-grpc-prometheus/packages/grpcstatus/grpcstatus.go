package grpcstatus

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type gRPCStatus interface {
	GRPCStatus() *status.Status
}

func unwrapPkgErrorsGRPCStatus(err error) (*status.Status, bool) {
	type causer interface {
		Cause() error
	}

	// Unwrapping the github.com/pkg/errors causer interface, using `Cause` directly could miss some error implementing
	// the `GRPCStatus` function so we have to check it on our selves.
	unwrappedCauser := err
	for unwrappedCauser != nil {
		if s, ok := unwrappedCauser.(gRPCStatus); ok {
			return s.GRPCStatus(), true
		}
		cause, ok := unwrappedCauser.(causer)
		if !ok {
			break
		}
		unwrappedCauser = cause.Cause()
	}
	return nil, false
}

// Since error can be wrapped and the `FromError` function only checks for `GRPCStatus` function
// and as a fallback uses the `Unknown` gRPC status we need to unwrap the error if possible to get the original status.
// pkg/errors and Go native errors packages have two different approaches so we try to unwrap both types.
// Eventually should be implemented in the go-grpc status function `FromError`. See https://github.com/grpc/grpc-go/issues/2934
func FromError(err error) (s *status.Status, ok bool) {
	s, ok = status.FromError(err)
	if ok {
		return s, true
	}

	// Try to unwrap `github.com/pkg/errors` wrapped error
	s, ok = unwrapPkgErrorsGRPCStatus(err)
	if ok {
		return s, true
	}

	// Try to unwrap native wrapped errors using `fmt.Errorf` and `%w`
	s, ok = unwrapNativeWrappedGRPCStatus(err)
	if ok {
		return s, true
	}

	// We failed to unwrap any GRPSStatus so return default `Unknown`
	return status.New(codes.Unknown, err.Error()), false
}
