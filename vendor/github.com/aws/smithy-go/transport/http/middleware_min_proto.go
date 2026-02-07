package http

import (
	"context"
	"fmt"
	"github.com/aws/smithy-go/middleware"
	"strings"
)

// MinimumProtocolError is an error type indicating that the established connection did not meet the expected minimum
// HTTP protocol version.
type MinimumProtocolError struct {
	proto              string
	expectedProtoMajor int
	expectedProtoMinor int
}

// Error returns the error message.
func (m *MinimumProtocolError) Error() string {
	return fmt.Sprintf("operation requires minimum HTTP protocol of HTTP/%d.%d, but was %s",
		m.expectedProtoMajor, m.expectedProtoMinor, m.proto)
}

// RequireMinimumProtocol is a deserialization middleware that asserts that the established HTTP connection
// meets the minimum major ad minor version.
type RequireMinimumProtocol struct {
	ProtoMajor int
	ProtoMinor int
}

// AddRequireMinimumProtocol adds the RequireMinimumProtocol middleware to the stack using the provided minimum
// protocol major and minor version.
func AddRequireMinimumProtocol(stack *middleware.Stack, major, minor int) error {
	return stack.Deserialize.Insert(&RequireMinimumProtocol{
		ProtoMajor: major,
		ProtoMinor: minor,
	}, "OperationDeserializer", middleware.Before)
}

// ID returns the middleware identifier string.
func (r *RequireMinimumProtocol) ID() string {
	return "RequireMinimumProtocol"
}

// HandleDeserialize asserts that the established connection is a HTTP connection with the minimum major and minor
// protocol version.
func (r *RequireMinimumProtocol) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	response, ok := out.RawResponse.(*Response)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type: %T", out.RawResponse)
	}

	if !strings.HasPrefix(response.Proto, "HTTP") {
		return out, metadata, &MinimumProtocolError{
			proto:              response.Proto,
			expectedProtoMajor: r.ProtoMajor,
			expectedProtoMinor: r.ProtoMinor,
		}
	}

	if response.ProtoMajor < r.ProtoMajor || response.ProtoMinor < r.ProtoMinor {
		return out, metadata, &MinimumProtocolError{
			proto:              response.Proto,
			expectedProtoMajor: r.ProtoMajor,
			expectedProtoMinor: r.ProtoMinor,
		}
	}

	return out, metadata, err
}
