package eventstreamapi

import (
	"context"
	"fmt"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"io"
)

type eventStreamWriterKey struct{}

// GetInputStreamWriter returns EventTypeHeader io.PipeWriter used for the operation's input event stream.
func GetInputStreamWriter(ctx context.Context) io.WriteCloser {
	writeCloser, _ := middleware.GetStackValue(ctx, eventStreamWriterKey{}).(io.WriteCloser)
	return writeCloser
}

func setInputStreamWriter(ctx context.Context, writeCloser io.WriteCloser) context.Context {
	return middleware.WithStackValue(ctx, eventStreamWriterKey{}, writeCloser)
}

// InitializeStreamWriter is a Finalize middleware initializes an in-memory pipe for sending event stream messages
// via the HTTP request body.
type InitializeStreamWriter struct{}

// AddInitializeStreamWriter adds the InitializeStreamWriter middleware to the provided stack.
func AddInitializeStreamWriter(stack *middleware.Stack) error {
	return stack.Finalize.Add(&InitializeStreamWriter{}, middleware.After)
}

// ID returns the identifier for the middleware.
func (i *InitializeStreamWriter) ID() string {
	return "InitializeStreamWriter"
}

// HandleFinalize is the middleware implementation.
func (i *InitializeStreamWriter) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	request, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type: %T", in.Request)
	}

	inputReader, inputWriter := io.Pipe()
	defer func() {
		if err == nil {
			return
		}
		_ = inputReader.Close()
		_ = inputWriter.Close()
	}()

	request, err = request.SetStream(inputReader)
	if err != nil {
		return out, metadata, err
	}
	in.Request = request

	ctx = setInputStreamWriter(ctx, inputWriter)

	out, metadata, err = next.HandleFinalize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	return out, metadata, err
}
