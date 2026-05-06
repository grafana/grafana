package smithy

import "fmt"

// APIError provides the generic API and protocol agnostic error type all SDK
// generated exception types will implement.
type APIError interface {
	error

	// ErrorCode returns the error code for the API exception.
	ErrorCode() string
	// ErrorMessage returns the error message for the API exception.
	ErrorMessage() string
	// ErrorFault returns the fault for the API exception.
	ErrorFault() ErrorFault
}

// GenericAPIError provides a generic concrete API error type that SDKs can use
// to deserialize error responses into. Should be used for unmodeled or untyped
// errors.
type GenericAPIError struct {
	Code    string
	Message string
	Fault   ErrorFault
}

// ErrorCode returns the error code for the API exception.
func (e *GenericAPIError) ErrorCode() string { return e.Code }

// ErrorMessage returns the error message for the API exception.
func (e *GenericAPIError) ErrorMessage() string { return e.Message }

// ErrorFault returns the fault for the API exception.
func (e *GenericAPIError) ErrorFault() ErrorFault { return e.Fault }

func (e *GenericAPIError) Error() string {
	return fmt.Sprintf("api error %s: %s", e.Code, e.Message)
}

var _ APIError = (*GenericAPIError)(nil)

// OperationError decorates an underlying error which occurred while invoking
// an operation with names of the operation and API.
type OperationError struct {
	ServiceID     string
	OperationName string
	Err           error
}

// Service returns the name of the API service the error occurred with.
func (e *OperationError) Service() string { return e.ServiceID }

// Operation returns the name of the API operation the error occurred with.
func (e *OperationError) Operation() string { return e.OperationName }

// Unwrap returns the nested error if any, or nil.
func (e *OperationError) Unwrap() error { return e.Err }

func (e *OperationError) Error() string {
	return fmt.Sprintf("operation error %s: %s, %v", e.ServiceID, e.OperationName, e.Err)
}

// DeserializationError provides a wrapper for an error that occurs during
// deserialization.
type DeserializationError struct {
	Err      error //  original error
	Snapshot []byte
}

// Error returns a formatted error for DeserializationError
func (e *DeserializationError) Error() string {
	const msg = "deserialization failed"
	if e.Err == nil {
		return msg
	}
	return fmt.Sprintf("%s, %v", msg, e.Err)
}

// Unwrap returns the underlying Error in DeserializationError
func (e *DeserializationError) Unwrap() error { return e.Err }

// ErrorFault provides the type for a Smithy API error fault.
type ErrorFault int

// ErrorFault enumeration values
const (
	FaultUnknown ErrorFault = iota
	FaultServer
	FaultClient
)

func (f ErrorFault) String() string {
	switch f {
	case FaultServer:
		return "server"
	case FaultClient:
		return "client"
	default:
		return "unknown"
	}
}

// SerializationError represents an error that occurred while attempting to serialize a request
type SerializationError struct {
	Err error // original error
}

// Error returns a formatted error for SerializationError
func (e *SerializationError) Error() string {
	const msg = "serialization failed"
	if e.Err == nil {
		return msg
	}
	return fmt.Sprintf("%s: %v", msg, e.Err)
}

// Unwrap returns the underlying Error in SerializationError
func (e *SerializationError) Unwrap() error { return e.Err }

// CanceledError is the error that will be returned by an API request that was
// canceled. API operations given a Context may return this error when
// canceled.
type CanceledError struct {
	Err error
}

// CanceledError returns true to satisfy interfaces checking for canceled errors.
func (*CanceledError) CanceledError() bool { return true }

// Unwrap returns the underlying error, if there was one.
func (e *CanceledError) Unwrap() error {
	return e.Err
}

func (e *CanceledError) Error() string {
	return fmt.Sprintf("canceled, %v", e.Err)
}
