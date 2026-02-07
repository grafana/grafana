package grpcutil

import (
	"context"
	"errors"
	"fmt"

	"github.com/gogo/protobuf/proto"
	"github.com/gogo/status"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

// ErrorToStatus returns a *github.com/gogo/status.Status representation of err.
//
//   - If err implements the method `GRPCStatus() *google.golang.org/grpc/status.Status` and
//     `GRPCStatus()` does not return nil, or if err wraps a type satisfying this, Status from
//     `GRPCStatus()` is converted to gogo Status, and returned. In that case, ok is true.
//
//   - If err is or GRPCStatus() returns nil, a nil Status is returned and ok is false.
//
//   - Otherwise, err is an error not compatible with this function. In this
//     case, a nil Status is returned and ok is false.
func ErrorToStatus(err error) (*status.Status, bool) {
	if err == nil {
		return nil, false
	}
	type grpcStatus interface{ GRPCStatus() *grpcstatus.Status }
	var gs grpcStatus
	if errors.As(err, &gs) {
		st := gs.GRPCStatus()
		if st == nil {
			return nil, false
		}
		return status.FromGRPCStatus(st), true
	}
	return nil, false
}

// ErrorToStatusCode extracts gRPC status code from error and returns it.
//
//   - If err is nil, codes.OK is returned.
//
//   - If err implements (or wraps error that implements) the method
//     `GRPCStatus() *google.golang.org/grpc/status.Status`, and
//     `GRPCStatus()` returns a non-nil status, code from the status
//     is returned.
//
//   - Otherwise code.Unknown is returned.
func ErrorToStatusCode(err error) codes.Code {
	if err == nil {
		return codes.OK
	}
	type grpcStatus interface{ GRPCStatus() *grpcstatus.Status }
	var gs grpcStatus
	if errors.As(err, &gs) {
		st := gs.GRPCStatus()
		if st != nil {
			return st.Code()
		}
	}
	return codes.Unknown
}

// Status creates a new a *github.com/gogo/status.Status with the
// given error code, error message and error details.
func Status(errCode codes.Code, errMessage string, details ...proto.Message) *status.Status {
	stat := status.New(errCode, errMessage)
	if len(details) > 0 {
		statWithDetails, err := stat.WithDetails(details...)
		if err == nil {
			return statWithDetails
		}
		statusErr := fmt.Errorf("error while creating details for a Status with code %s and error message %q: %w", errCode, errMessage, err)
		return status.New(codes.InvalidArgument, statusErr.Error())
	}
	return stat
}

// IsCanceled checks whether an error comes from an operation being canceled.
func IsCanceled(err error) bool {
	if errors.Is(err, context.Canceled) {
		return true
	}
	statusCode := ErrorToStatusCode(err)
	return statusCode == codes.Canceled
}
