package azblob

import (
	"context"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
)

const CountToEnd = 0

// HTTPGetter is a function type that refers to a method that performs an HTTP GET operation.
type HTTPGetter func(ctx context.Context, i HTTPGetterInfo) (*http.Response, error)

// HTTPGetterInfo is passed to an HTTPGetter function passing it parameters
// that should be used to make an HTTP GET request.
type HTTPGetterInfo struct {
	// Offset specifies the start offset that should be used when
	// creating the HTTP GET request's Range header
	Offset int64

	// Count specifies the count of bytes that should be used to calculate
	// the end offset when creating the HTTP GET request's Range header
	Count int64

	// ETag specifies the resource's etag that should be used when creating
	// the HTTP GET request's If-Match header
	ETag ETag
}

// FailedReadNotifier is a function type that represents the notification function called when a read fails
type FailedReadNotifier func(failureCount int, lastError error, offset int64, count int64, willRetry bool)

// RetryReaderOptions contains properties which can help to decide when to do retry.
type RetryReaderOptions struct {
	// MaxRetryRequests specifies the maximum number of HTTP GET requests that will be made
	// while reading from a RetryReader. A value of zero means that no additional HTTP
	// GET requests will be made.
	MaxRetryRequests   int
	doInjectError      bool
	doInjectErrorRound int
	injectedError      error

	// NotifyFailedRead is called, if non-nil, after any failure to read. Expected usage is diagnostic logging.
	NotifyFailedRead FailedReadNotifier

	// TreatEarlyCloseAsError can be set to true to prevent retries after "read on closed response body". By default,
	// retryReader has the following special behaviour: closing the response body before it is all read is treated as a
	// retryable error. This is to allow callers to force a retry by closing the body from another goroutine (e.g. if the =
	// read is too slow, caller may want to force a retry in the hope that the retry will be quicker).  If
	// TreatEarlyCloseAsError is true, then retryReader's special behaviour is suppressed, and "read on closed body" is instead
	// treated as a fatal (non-retryable) error.
	// Note that setting TreatEarlyCloseAsError only guarantees that Closing will produce a fatal error if the Close happens
	// from the same "thread" (goroutine) as Read.  Concurrent Close calls from other goroutines may instead produce network errors
	// which will be retried.
	TreatEarlyCloseAsError bool

	ClientProvidedKeyOptions ClientProvidedKeyOptions
}

// retryReader implements io.ReaderCloser methods.
// retryReader tries to read from response, and if there is retriable network error
// returned during reading, it will retry according to retry reader option through executing
// user defined action with provided data to get a new response, and continue the overall reading process
// through reading from the new response.
type retryReader struct {
	ctx             context.Context
	info            HTTPGetterInfo
	countWasBounded bool
	o               RetryReaderOptions
	getter          HTTPGetter

	// we support Close-ing during Reads (from other goroutines), so we protect the shared state, which is response
	responseMu *sync.Mutex
	response   *http.Response
}

// NewRetryReader creates a retry reader.
func NewRetryReader(ctx context.Context, initialResponse *http.Response,
	info HTTPGetterInfo, o RetryReaderOptions, getter HTTPGetter) io.ReadCloser {
	return &retryReader{
		ctx:             ctx,
		getter:          getter,
		info:            info,
		countWasBounded: info.Count != CountToEnd,
		response:        initialResponse,
		responseMu:      &sync.Mutex{},
		o:               o}
}

func (s *retryReader) setResponse(r *http.Response) {
	s.responseMu.Lock()
	defer s.responseMu.Unlock()
	s.response = r
}

func (s *retryReader) Read(p []byte) (n int, err error) {
	for try := 0; ; try++ {
		//fmt.Println(try)       // Comment out for debugging.
		if s.countWasBounded && s.info.Count == CountToEnd {
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
		n, err := resp.Body.Read(p) // Read from the stream (this will return non-nil err if forceRetry is called, from another goroutine, while it is running)

		// Injection mechanism for testing.
		if s.o.doInjectError && try == s.o.doInjectErrorRound {
			if s.o.injectedError != nil {
				err = s.o.injectedError
			} else {
				err = &net.DNSError{IsTemporary: true}
			}
		}

		// We successfully read data or end EOF.
		if err == nil || err == io.EOF {
			s.info.Offset += int64(n) // Increments the start offset in case we need to make a new HTTP request in the future
			if s.info.Count != CountToEnd {
				s.info.Count -= int64(n) // Decrement the count in case we need to make a new HTTP request in the future
			}
			return n, err // Return the return to the caller
		}
		s.Close()          // Error, close stream
		s.setResponse(nil) // Our stream is no longer good

		// Check the retry count and error code, and decide whether to retry.
		retriesExhausted := try >= s.o.MaxRetryRequests
		_, isNetError := err.(net.Error)
		isUnexpectedEOF := err == io.ErrUnexpectedEOF
		willRetry := (isNetError || isUnexpectedEOF || s.wasRetryableEarlyClose(err)) && !retriesExhausted

		// Notify, for logging purposes, of any failures
		if s.o.NotifyFailedRead != nil {
			failureCount := try + 1 // because try is zero-based
			s.o.NotifyFailedRead(failureCount, err, s.info.Offset, s.info.Count, willRetry)
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
// then there are two different types of error that may happen - either the one one we check for here,
// or a net.Error (due to closure of connection). Which one happens depends on timing. We only need this routine
// to check for one, since the other is a net.Error, which our main Read retry loop is already handing.
func (s *retryReader) wasRetryableEarlyClose(err error) bool {
	if s.o.TreatEarlyCloseAsError {
		return false // user wants all early closes to be errors, and so not retryable
	}
	// unfortunately, http.errReadOnClosedResBody is private, so the best we can do here is to check for its text
	return strings.HasSuffix(err.Error(), ReadOnClosedBodyMessage)
}

const ReadOnClosedBodyMessage = "read on closed response body"

func (s *retryReader) Close() error {
	s.responseMu.Lock()
	defer s.responseMu.Unlock()
	if s.response != nil && s.response.Body != nil {
		return s.response.Body.Close()
	}
	return nil
}
