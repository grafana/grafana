package gocql

import "fmt"

const (
	errServer          = 0x0000
	errProtocol        = 0x000A
	errCredentials     = 0x0100
	errUnavailable     = 0x1000
	errOverloaded      = 0x1001
	errBootstrapping   = 0x1002
	errTruncate        = 0x1003
	errWriteTimeout    = 0x1100
	errReadTimeout     = 0x1200
	errReadFailure     = 0x1300
	errFunctionFailure = 0x1400
	errWriteFailure    = 0x1500
	errSyntax          = 0x2000
	errUnauthorized    = 0x2100
	errInvalid         = 0x2200
	errConfig          = 0x2300
	errAlreadyExists   = 0x2400
	errUnprepared      = 0x2500
)

type RequestError interface {
	Code() int
	Message() string
	Error() string
}

type errorFrame struct {
	frameHeader

	code    int
	message string
}

func (e errorFrame) Code() int {
	return e.code
}

func (e errorFrame) Message() string {
	return e.message
}

func (e errorFrame) Error() string {
	return e.Message()
}

func (e errorFrame) String() string {
	return fmt.Sprintf("[error code=%x message=%q]", e.code, e.message)
}

type RequestErrUnavailable struct {
	errorFrame
	Consistency Consistency
	Required    int
	Alive       int
}

func (e *RequestErrUnavailable) String() string {
	return fmt.Sprintf("[request_error_unavailable consistency=%s required=%d alive=%d]", e.Consistency, e.Required, e.Alive)
}

type RequestErrWriteTimeout struct {
	errorFrame
	Consistency Consistency
	Received    int
	BlockFor    int
	WriteType   string
}

type RequestErrWriteFailure struct {
	errorFrame
	Consistency Consistency
	Received    int
	BlockFor    int
	NumFailures int
	WriteType   string
}

type RequestErrReadTimeout struct {
	errorFrame
	Consistency Consistency
	Received    int
	BlockFor    int
	DataPresent byte
}

type RequestErrAlreadyExists struct {
	errorFrame
	Keyspace string
	Table    string
}

type RequestErrUnprepared struct {
	errorFrame
	StatementId []byte
}

type RequestErrReadFailure struct {
	errorFrame
	Consistency Consistency
	Received    int
	BlockFor    int
	NumFailures int
	DataPresent bool
}

type RequestErrFunctionFailure struct {
	errorFrame
	Keyspace string
	Function string
	ArgTypes []string
}
