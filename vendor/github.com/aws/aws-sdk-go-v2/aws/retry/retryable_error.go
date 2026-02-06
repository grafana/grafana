package retry

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// IsErrorRetryable provides the interface of an implementation to determine if
// a error as the result of an operation is retryable.
type IsErrorRetryable interface {
	IsErrorRetryable(error) aws.Ternary
}

// IsErrorRetryables is a collection of checks to determine of the error is
// retryable.  Iterates through the checks and returns the state of retryable
// if any check returns something other than unknown.
type IsErrorRetryables []IsErrorRetryable

// IsErrorRetryable returns if the error is retryable if any of the checks in
// the list return a value other than unknown.
func (r IsErrorRetryables) IsErrorRetryable(err error) aws.Ternary {
	for _, re := range r {
		if v := re.IsErrorRetryable(err); v != aws.UnknownTernary {
			return v
		}
	}
	return aws.UnknownTernary
}

// IsErrorRetryableFunc wraps a function with the IsErrorRetryable interface.
type IsErrorRetryableFunc func(error) aws.Ternary

// IsErrorRetryable returns if the error is retryable.
func (fn IsErrorRetryableFunc) IsErrorRetryable(err error) aws.Ternary {
	return fn(err)
}

// RetryableError is an IsErrorRetryable implementation which uses the
// optional interface Retryable on the error value to determine if the error is
// retryable.
type RetryableError struct{}

// IsErrorRetryable returns if the error is retryable if it satisfies the
// Retryable interface, and returns if the attempt should be retried.
func (RetryableError) IsErrorRetryable(err error) aws.Ternary {
	var v interface{ RetryableError() bool }

	if !errors.As(err, &v) {
		return aws.UnknownTernary
	}

	return aws.BoolTernary(v.RetryableError())
}

// NoRetryCanceledError detects if the error was an request canceled error and
// returns if so.
type NoRetryCanceledError struct{}

// IsErrorRetryable returns the error is not retryable if the request was
// canceled.
func (NoRetryCanceledError) IsErrorRetryable(err error) aws.Ternary {
	var v interface{ CanceledError() bool }

	if !errors.As(err, &v) {
		return aws.UnknownTernary
	}

	if v.CanceledError() {
		return aws.FalseTernary
	}
	return aws.UnknownTernary
}

// RetryableConnectionError determines if the underlying error is an HTTP
// connection and returns if it should be retried.
//
// Includes errors such as connection reset, connection refused, net dial,
// temporary, and timeout errors.
type RetryableConnectionError struct{}

// IsErrorRetryable returns if the error is caused by and HTTP connection
// error, and should be retried.
func (r RetryableConnectionError) IsErrorRetryable(err error) aws.Ternary {
	if err == nil {
		return aws.UnknownTernary
	}
	var retryable bool

	var conErr interface{ ConnectionError() bool }
	var tempErr interface{ Temporary() bool }
	var timeoutErr interface{ Timeout() bool }
	var urlErr *url.Error
	var netOpErr *net.OpError
	var dnsError *net.DNSError

	if errors.As(err, &dnsError) {
		// NXDOMAIN errors should not be retried
		if dnsError.IsNotFound {
			return aws.BoolTernary(false)
		}

		// if !dnsError.Temporary(), error may or may not be temporary,
		// (i.e. !Temporary() =/=> !retryable) so we should fall through to
		// remaining checks
		if dnsError.Temporary() {
			return aws.BoolTernary(true)
		}
	}

	switch {
	case errors.As(err, &conErr) && conErr.ConnectionError():
		retryable = true

	case strings.Contains(err.Error(), "use of closed network connection"):
		fallthrough
	case strings.Contains(err.Error(), "connection reset"):
		// The errors "connection reset" and "use of closed network connection"
		// are effectively the same. It appears to be the difference between
		// sync and async read of TCP RST in the stdlib's net.Conn read loop.
		// see #2737
		retryable = true

	case errors.As(err, &urlErr):
		// Refused connections should be retried as the service may not yet be
		// running on the port. Go TCP dial considers refused connections as
		// not temporary.
		if strings.Contains(urlErr.Error(), "connection refused") {
			retryable = true
		} else {
			return r.IsErrorRetryable(errors.Unwrap(urlErr))
		}

	case errors.As(err, &netOpErr):
		// Network dial, or temporary network errors are always retryable.
		if strings.EqualFold(netOpErr.Op, "dial") || netOpErr.Temporary() {
			retryable = true
		} else {
			return r.IsErrorRetryable(errors.Unwrap(netOpErr))
		}

	case errors.As(err, &tempErr) && tempErr.Temporary():
		// Fallback to the generic temporary check, with temporary errors
		// retryable.
		retryable = true

	case errors.As(err, &timeoutErr) && timeoutErr.Timeout():
		// Fallback to the generic timeout check, with timeout errors
		// retryable.
		retryable = true

	default:
		return aws.UnknownTernary
	}

	return aws.BoolTernary(retryable)

}

// RetryableHTTPStatusCode provides a IsErrorRetryable based on HTTP status
// codes.
type RetryableHTTPStatusCode struct {
	Codes map[int]struct{}
}

// IsErrorRetryable return if the passed in error is retryable based on the
// HTTP status code.
func (r RetryableHTTPStatusCode) IsErrorRetryable(err error) aws.Ternary {
	var v interface{ HTTPStatusCode() int }

	if !errors.As(err, &v) {
		return aws.UnknownTernary
	}

	_, ok := r.Codes[v.HTTPStatusCode()]
	if !ok {
		return aws.UnknownTernary
	}

	return aws.TrueTernary
}

// RetryableErrorCode determines if an attempt should be retried based on the
// API error code.
type RetryableErrorCode struct {
	Codes map[string]struct{}
}

// IsErrorRetryable return if the error is retryable based on the error codes.
// Returns unknown if the error doesn't have a code or it is unknown.
func (r RetryableErrorCode) IsErrorRetryable(err error) aws.Ternary {
	var v interface{ ErrorCode() string }

	if !errors.As(err, &v) {
		return aws.UnknownTernary
	}

	_, ok := r.Codes[v.ErrorCode()]
	if !ok {
		return aws.UnknownTernary
	}

	return aws.TrueTernary
}

// retryableClockSkewError marks errors that can be caused by clock skew
// (difference between server time and client time).
// This is returned when there's certain confidence that adjusting the client time
// could allow a retry to succeed
type retryableClockSkewError struct{ Err error }

func (e *retryableClockSkewError) Error() string {
	return fmt.Sprintf("Probable clock skew error: %v", e.Err)
}

// Unwrap returns the wrapped error.
func (e *retryableClockSkewError) Unwrap() error {
	return e.Err
}

// RetryableError allows the retryer to retry this request
func (e *retryableClockSkewError) RetryableError() bool {
	return true
}
