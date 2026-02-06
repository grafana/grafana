//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blob

import (
	"context"
	"io"
	"net"
	"strings"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
)

// HTTPGetter is a function type that refers to a method that performs an HTTP GET operation.
type httpGetter func(ctx context.Context, i httpGetterInfo) (io.ReadCloser, error)

// HTTPGetterInfo is passed to an HTTPGetter function passing it parameters
// that should be used to make an HTTP GET request.
type httpGetterInfo struct {
	Range HTTPRange

	// ETag specifies the resource's etag that should be used when creating
	// the HTTP GET request's If-Match header
	ETag *azcore.ETag
}

// RetryReaderOptions configures the retry reader's behavior.
// Zero-value fields will have their specified default values applied during use.
// This allows for modification of a subset of fields.
type RetryReaderOptions struct {
	// MaxRetries specifies the maximum number of attempts a failed read will be retried
	// before producing an error.
	// The default value is three.
	MaxRetries int32

	// OnFailedRead, when non-nil, is called after any failure to read. Expected usage is diagnostic logging.
	OnFailedRead func(failureCount int32, lastError error, rnge HTTPRange, willRetry bool)

	// EarlyCloseAsError can be set to true to prevent retries after "read on closed response body". By default,
	// retryReader has the following special behaviour: closing the response body before it is all read is treated as a
	// retryable error. This is to allow callers to force a retry by closing the body from another goroutine (e.g. if the =
	// read is too slow, caller may want to force a retry in the hope that the retry will be quicker).  If
	// TreatEarlyCloseAsError is true, then retryReader's special behaviour is suppressed, and "read on closed body" is instead
	// treated as a fatal (non-retryable) error.
	// Note that setting TreatEarlyCloseAsError only guarantees that Closing will produce a fatal error if the Close happens
	// from the same "thread" (goroutine) as Read.  Concurrent Close calls from other goroutines may instead produce network errors
	// which will be retried.
	// The default value is false.
	EarlyCloseAsError bool

	doInjectError      bool
	doInjectErrorRound int32
	injectedError      error
}

// RetryReader attempts to read from response, and if there is a retry-able network error
// returned during reading, it will retry according to retry reader option through executing
// user defined action with provided data to get a new response, and continue the overall reading process
// through reading from the new response.
// RetryReader implements the io.ReadCloser interface.
type RetryReader struct {
	ctx                context.Context
	info               httpGetterInfo
	retryReaderOptions RetryReaderOptions
	getter             httpGetter
	countWasBounded    bool

	// we support Close-ing during Reads (from other goroutines), so we protect the shared state, which is response
	responseMu *sync.Mutex
	response   io.ReadCloser
}

// newRetryReader creates a retry reader.
func newRetryReader(ctx context.Context, initialResponse io.ReadCloser, info httpGetterInfo, getter httpGetter, o RetryReaderOptions) *RetryReader {
	if o.MaxRetries < 1 {
		o.MaxRetries = 3
	}
	return &RetryReader{
		ctx:                ctx,
		getter:             getter,
		info:               info,
		countWasBounded:    info.Range.Count != CountToEnd,
		response:           initialResponse,
		responseMu:         &sync.Mutex{},
		retryReaderOptions: o,
	}
}

// setResponse function
func (s *RetryReader) setResponse(r io.ReadCloser) {
	s.responseMu.Lock()
	defer s.responseMu.Unlock()
	s.response = r
}

// Read from retry reader
func (s *RetryReader) Read(p []byte) (n int, err error) {
	for try := int32(0); ; try++ {
		if s.countWasBounded && s.info.Range.Count == CountToEnd {
			// User specified an original count and the remaining bytes are 0, return 0, EOF
			return 0, io.EOF
		}

		s.responseMu.Lock()
		resp := s.response
		s.responseMu.Unlock()
		if resp == nil { // We don't have a response stream to read from, try to get one.
			newResponse, err := s.getter(s.ctx, s.info)
			if err != nil {
				return 0, err
			}
			// Successful GET; this is the network stream we'll read from.
			s.setResponse(newResponse)
			resp = newResponse
		}
		n, err := resp.Read(p) // Read from the stream (this will return non-nil err if forceRetry is called, from another goroutine, while it is running)

		// Injection mechanism for testing.
		if s.retryReaderOptions.doInjectError && try == s.retryReaderOptions.doInjectErrorRound {
			if s.retryReaderOptions.injectedError != nil {
				err = s.retryReaderOptions.injectedError
			} else {
				err = &net.DNSError{IsTemporary: true}
			}
		}

		// We successfully read data or end EOF.
		if err == nil || err == io.EOF {
			s.info.Range.Offset += int64(n) // Increments the start offset in case we need to make a new HTTP request in the future
			if s.info.Range.Count != CountToEnd {
				s.info.Range.Count -= int64(n) // Decrement the count in case we need to make a new HTTP request in the future
			}
			return n, err // Return the return to the caller
		}
		_ = s.Close()

		s.setResponse(nil) // Our stream is no longer good

		// Check the retry count and error code, and decide whether to retry.
		retriesExhausted := try >= s.retryReaderOptions.MaxRetries
		_, isNetError := err.(net.Error)
		isUnexpectedEOF := err == io.ErrUnexpectedEOF
		willRetry := (isNetError || isUnexpectedEOF || s.wasRetryableEarlyClose(err)) && !retriesExhausted

		// Notify, for logging purposes, of any failures
		if s.retryReaderOptions.OnFailedRead != nil {
			failureCount := try + 1 // because try is zero-based
			s.retryReaderOptions.OnFailedRead(failureCount, err, s.info.Range, willRetry)
		}

		if willRetry {
			continue
			// Loop around and try to get and read from new stream.
		}
		return n, err // Not retryable, or retries exhausted, so just return
	}
}

// By default, we allow early Closing, from another concurrent goroutine, to be used to force a retry
// Is this safe, to close early from another goroutine?  Early close ultimately ends up calling
// net.Conn.Close, and that is documented as "Any blocked Read or Write operations will be unblocked and return errors"
// which is exactly the behaviour we want.
// NOTE: that if caller has forced an early Close from a separate goroutine (separate from the Read)
// then there are two different types of error that may happen - either the one we check for here,
// or a net.Error (due to closure of connection). Which one happens depends on timing. We only need this routine
// to check for one, since the other is a net.Error, which our main Read retry loop is already handing.
func (s *RetryReader) wasRetryableEarlyClose(err error) bool {
	if s.retryReaderOptions.EarlyCloseAsError {
		return false // user wants all early closes to be errors, and so not retryable
	}
	// unfortunately, http.errReadOnClosedResBody is private, so the best we can do here is to check for its text
	return strings.HasSuffix(err.Error(), ReadOnClosedBodyMessage)
}

// ReadOnClosedBodyMessage of retry reader
const ReadOnClosedBodyMessage = "read on closed response body"

// Close retry reader
func (s *RetryReader) Close() error {
	s.responseMu.Lock()
	defer s.responseMu.Unlock()
	if s.response != nil {
		return s.response.Close()
	}
	return nil
}
