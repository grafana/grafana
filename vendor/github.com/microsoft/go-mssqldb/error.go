package mssql

import (
	"database/sql/driver"
	"fmt"
)

// Error represents an SQL Server error. This
// type includes methods for reading the contents
// of the struct, which allows calling programs
// to check for specific error conditions without
// having to import this package directly.
type Error struct {
	Number     int32
	State      uint8
	Class      uint8
	Message    string
	ServerName string
	ProcName   string
	LineNo     int32
	// All lists all errors that were received from first to last.
	// This includes the last one, which is described in the other members.
	All []Error
}

func (e Error) Error() string {
	return "mssql: " + e.Message
}

func (e Error) String() string {
	return e.Message
}

// SQLErrorNumber returns the SQL Server error number.
func (e Error) SQLErrorNumber() int32 {
	return e.Number
}

func (e Error) SQLErrorState() uint8 {
	return e.State
}

func (e Error) SQLErrorClass() uint8 {
	return e.Class
}

func (e Error) SQLErrorMessage() string {
	return e.Message
}

func (e Error) SQLErrorServerName() string {
	return e.ServerName
}

func (e Error) SQLErrorProcName() string {
	return e.ProcName
}

func (e Error) SQLErrorLineNo() int32 {
	return e.LineNo
}

type StreamError struct {
	InnerError error
}

func (e StreamError) Error() string {
	return "Invalid TDS stream: " + e.InnerError.Error()
}

func badStreamPanic(err error) {
	panic(StreamError{InnerError: err})
}

func badStreamPanicf(format string, v ...interface{}) {
	panic(fmt.Errorf(format, v...))
}

// ServerError is returned when the server got a fatal error
// that aborts the process and severs the connection.
//
// To get the errors returned before the process was aborted,
// unwrap this error or call errors.As with a pointer to an
// mssql.Error variable.
type ServerError struct {
	sqlError Error
}

func (e ServerError) Error() string {
	return "SQL Server had internal error"
}

func (e ServerError) Unwrap() error {
	return e.sqlError
}

// RetryableError is returned when an error was caused by a bad
// connection at the start of a query and can be safely retried
// using database/sql's automatic retry logic.
//
// In many cases database/sql's retry logic will transparently
// handle this error, the retried call will return successfully,
// and you won't even see this error. However, you may see this
// error if the retry logic cannot successfully handle the error.
// In that case you can get the underlying error by calling this
// error's UnWrap function.
type RetryableError struct {
	err error
}

func (r RetryableError) Error() string {
	return r.err.Error()
}

func (r RetryableError) Unwrap() error {
	return r.err
}

func (r RetryableError) Is(err error) bool {
	return err == driver.ErrBadConn
}
