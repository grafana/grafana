/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package vterrors

import (
	"fmt"
	"io"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
)

// This file contains functions to convert errors to and from gRPC codes.
// Use these methods to return an error through gRPC and still
// retain its code.

// CodeToLegacyErrorCode maps a vtrpcpb.Code to a vtrpcpb.LegacyErrorCode.
func CodeToLegacyErrorCode(code vtrpcpb.Code) vtrpcpb.LegacyErrorCode {
	switch code {
	case vtrpcpb.Code_OK:
		return vtrpcpb.LegacyErrorCode_SUCCESS_LEGACY
	case vtrpcpb.Code_CANCELED:
		return vtrpcpb.LegacyErrorCode_CANCELLED_LEGACY
	case vtrpcpb.Code_UNKNOWN:
		return vtrpcpb.LegacyErrorCode_UNKNOWN_ERROR_LEGACY
	case vtrpcpb.Code_INVALID_ARGUMENT:
		return vtrpcpb.LegacyErrorCode_BAD_INPUT_LEGACY
	case vtrpcpb.Code_DEADLINE_EXCEEDED:
		return vtrpcpb.LegacyErrorCode_DEADLINE_EXCEEDED_LEGACY
	case vtrpcpb.Code_ALREADY_EXISTS:
		return vtrpcpb.LegacyErrorCode_INTEGRITY_ERROR_LEGACY
	case vtrpcpb.Code_PERMISSION_DENIED:
		return vtrpcpb.LegacyErrorCode_PERMISSION_DENIED_LEGACY
	case vtrpcpb.Code_RESOURCE_EXHAUSTED:
		return vtrpcpb.LegacyErrorCode_RESOURCE_EXHAUSTED_LEGACY
	case vtrpcpb.Code_FAILED_PRECONDITION:
		return vtrpcpb.LegacyErrorCode_QUERY_NOT_SERVED_LEGACY
	case vtrpcpb.Code_ABORTED:
		return vtrpcpb.LegacyErrorCode_NOT_IN_TX_LEGACY
	case vtrpcpb.Code_INTERNAL:
		return vtrpcpb.LegacyErrorCode_INTERNAL_ERROR_LEGACY
	case vtrpcpb.Code_UNAVAILABLE:
		// Legacy code assumes Unavailable errors are sent as Internal.
		return vtrpcpb.LegacyErrorCode_INTERNAL_ERROR_LEGACY
	case vtrpcpb.Code_UNAUTHENTICATED:
		return vtrpcpb.LegacyErrorCode_UNAUTHENTICATED_LEGACY
	default:
		return vtrpcpb.LegacyErrorCode_UNKNOWN_ERROR_LEGACY
	}
}

// LegacyErrorCodeToCode maps a vtrpcpb.LegacyErrorCode to a gRPC vtrpcpb.Code.
func LegacyErrorCodeToCode(code vtrpcpb.LegacyErrorCode) vtrpcpb.Code {
	switch code {
	case vtrpcpb.LegacyErrorCode_SUCCESS_LEGACY:
		return vtrpcpb.Code_OK
	case vtrpcpb.LegacyErrorCode_CANCELLED_LEGACY:
		return vtrpcpb.Code_CANCELED
	case vtrpcpb.LegacyErrorCode_UNKNOWN_ERROR_LEGACY:
		return vtrpcpb.Code_UNKNOWN
	case vtrpcpb.LegacyErrorCode_BAD_INPUT_LEGACY:
		return vtrpcpb.Code_INVALID_ARGUMENT
	case vtrpcpb.LegacyErrorCode_DEADLINE_EXCEEDED_LEGACY:
		return vtrpcpb.Code_DEADLINE_EXCEEDED
	case vtrpcpb.LegacyErrorCode_INTEGRITY_ERROR_LEGACY:
		return vtrpcpb.Code_ALREADY_EXISTS
	case vtrpcpb.LegacyErrorCode_PERMISSION_DENIED_LEGACY:
		return vtrpcpb.Code_PERMISSION_DENIED
	case vtrpcpb.LegacyErrorCode_RESOURCE_EXHAUSTED_LEGACY:
		return vtrpcpb.Code_RESOURCE_EXHAUSTED
	case vtrpcpb.LegacyErrorCode_QUERY_NOT_SERVED_LEGACY:
		return vtrpcpb.Code_FAILED_PRECONDITION
	case vtrpcpb.LegacyErrorCode_NOT_IN_TX_LEGACY:
		return vtrpcpb.Code_ABORTED
	case vtrpcpb.LegacyErrorCode_INTERNAL_ERROR_LEGACY:
		// Legacy code sends internal error instead of Unavailable.
		return vtrpcpb.Code_UNAVAILABLE
	case vtrpcpb.LegacyErrorCode_TRANSIENT_ERROR_LEGACY:
		return vtrpcpb.Code_UNAVAILABLE
	case vtrpcpb.LegacyErrorCode_UNAUTHENTICATED_LEGACY:
		return vtrpcpb.Code_UNAUTHENTICATED
	default:
		return vtrpcpb.Code_UNKNOWN
	}
}

// truncateError shortens errors because gRPC has a size restriction on them.
func truncateError(err error) string {
	// For more details see: https://github.com/grpc/grpc-go/issues/443
	// The gRPC spec says "Clients may limit the size of Response-Headers,
	// Trailers, and Trailers-Only, with a default of 8 KiB each suggested."
	// Therefore, we assume 8 KiB minus some headroom.
	GRPCErrorLimit := 8*1024 - 512
	if len(err.Error()) <= GRPCErrorLimit {
		return err.Error()
	}
	truncateInfo := "[...] [remainder of the error is truncated because gRPC has a size limit on errors.]"
	truncatedErr := err.Error()[:GRPCErrorLimit]
	return fmt.Sprintf("%v %v", truncatedErr, truncateInfo)
}

// ToGRPC returns an error as a gRPC error, with the appropriate error code.
func ToGRPC(err error) error {
	if err == nil {
		return nil
	}
	return status.Errorf(codes.Code(Code(err)), "%v", truncateError(err))
}

// FromGRPC returns a gRPC error as a vtError, translating between error codes.
// However, there are a few errors which are not translated and passed as they
// are. For example, io.EOF since our code base checks for this error to find
// out that a stream has finished.
func FromGRPC(err error) error {
	if err == nil {
		return nil
	}
	if err == io.EOF {
		// Do not wrap io.EOF because we compare against it for finished streams.
		return err
	}
	code := codes.Unknown
	if s, ok := status.FromError(err); ok {
		code = s.Code()
	}
	return New(vtrpcpb.Code(code), err.Error())
}
