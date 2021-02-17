package centrifuge

import (
	"fmt"

	"github.com/centrifugal/protocol"
)

var _ error = (*Error)(nil)

// Error represents client reply error.
type Error struct {
	Code    uint32
	Message string
}

func (e *Error) toProto() *protocol.Error {
	return &protocol.Error{
		Code:    e.Code,
		Message: e.Message,
	}
}

func (e Error) Error() string {
	return fmt.Sprintf("%d: %s", e.Code, e.Message)
}

// Here we define well-known errors that can be used in client protocol
// replies.
// Library user can define own application specific errors. When define new
// custom error it is recommended to use error codes > 1000 assuming that
// codes in interval 0-999 reserved by Centrifuge.
var (
	// ErrorInternal means server error, if returned this is a signal
	// that something went wrong with server itself and client most probably
	// not guilty.
	ErrorInternal = &Error{
		Code:    100,
		Message: "internal server error",
	}
	// ErrorUnauthorized says that request is unauthorized.
	ErrorUnauthorized = &Error{
		Code:    101,
		Message: "unauthorized",
	}
	// ErrorUnknownChannel means that channel name does not exist.
	ErrorUnknownChannel = &Error{
		Code:    102,
		Message: "unknown channel",
	}
	// ErrorPermissionDenied means that access to resource not allowed.
	ErrorPermissionDenied = &Error{
		Code:    103,
		Message: "permission denied",
	}
	// ErrorMethodNotFound means that method sent in command does not exist.
	ErrorMethodNotFound = &Error{
		Code:    104,
		Message: "method not found",
	}
	// ErrorAlreadySubscribed returned when client wants to subscribe on channel
	// it already subscribed to.
	ErrorAlreadySubscribed = &Error{
		Code:    105,
		Message: "already subscribed",
	}
	// ErrorLimitExceeded says that some sort of limit exceeded, server logs should
	// give more detailed information. See also ErrorTooManyRequests which is more
	// specific for rate limiting purposes.
	ErrorLimitExceeded = &Error{
		Code:    106,
		Message: "limit exceeded",
	}
	// ErrorBadRequest says that server can not process received
	// data because it is malformed. Retrying request does not make sense.
	ErrorBadRequest = &Error{
		Code:    107,
		Message: "bad request",
	}
	// ErrorNotAvailable means that resource is not enabled.
	ErrorNotAvailable = &Error{
		Code:    108,
		Message: "not available",
	}
	// ErrorTokenExpired indicates that connection token expired.
	ErrorTokenExpired = &Error{
		Code:    109,
		Message: "token expired",
	}
	// ErrorExpired indicates that connection expired (no token involved).
	ErrorExpired = &Error{
		Code:    110,
		Message: "expired",
	}
	// ErrorTooManyRequests means that server rejected request due to
	// its rate limiting strategies.
	ErrorTooManyRequests = &Error{
		Code:    111,
		Message: "too many requests",
	}
)
