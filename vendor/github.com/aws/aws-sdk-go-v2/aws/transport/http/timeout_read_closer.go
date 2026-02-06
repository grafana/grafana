package http

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

type readResult struct {
	n   int
	err error
}

// ResponseTimeoutError is an error when the reads from the response are
// delayed longer than the timeout the read was configured for.
type ResponseTimeoutError struct {
	TimeoutDur time.Duration
}

// Timeout returns that the error is was caused by a timeout, and can be
// retried.
func (*ResponseTimeoutError) Timeout() bool { return true }

func (e *ResponseTimeoutError) Error() string {
	return fmt.Sprintf("read on body reach timeout limit, %v", e.TimeoutDur)
}

// timeoutReadCloser will handle body reads that take too long.
// We will return a ErrReadTimeout error if a timeout occurs.
type timeoutReadCloser struct {
	reader   io.ReadCloser
	duration time.Duration
}

// Read will spin off a goroutine to call the reader's Read method. We will
// select on the timer's channel or the read's channel. Whoever completes first
// will be returned.
func (r *timeoutReadCloser) Read(b []byte) (int, error) {
	timer := time.NewTimer(r.duration)
	c := make(chan readResult, 1)

	go func() {
		n, err := r.reader.Read(b)
		timer.Stop()
		c <- readResult{n: n, err: err}
	}()

	select {
	case data := <-c:
		return data.n, data.err
	case <-timer.C:
		return 0, &ResponseTimeoutError{TimeoutDur: r.duration}
	}
}

func (r *timeoutReadCloser) Close() error {
	return r.reader.Close()
}

// AddResponseReadTimeoutMiddleware adds a middleware to the stack that wraps the
// response body so that a read that takes too long will return an error.
//
// Deprecated: This API was previously exposed to customize behavior of the
// Kinesis service. That customization has been removed and this middleware's
// implementation can cause panics within the standard library networking loop.
// See #2752.
func AddResponseReadTimeoutMiddleware(stack *middleware.Stack, duration time.Duration) error {
	return stack.Deserialize.Add(&readTimeout{duration: duration}, middleware.After)
}

// readTimeout wraps the response body with a timeoutReadCloser
type readTimeout struct {
	duration time.Duration
}

// ID returns the id of the middleware
func (*readTimeout) ID() string {
	return "ReadResponseTimeout"
}

// HandleDeserialize implements the DeserializeMiddleware interface
func (m *readTimeout) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	response, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, &smithy.DeserializationError{Err: fmt.Errorf("unknown transport type %T", out.RawResponse)}
	}

	response.Body = &timeoutReadCloser{
		reader:   response.Body,
		duration: m.duration,
	}
	out.RawResponse = response

	return out, metadata, err
}
