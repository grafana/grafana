package mssql

import (
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
}

func (e Error) Error() string {
	return "mssql: " + e.Message
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
	Message string
}

func (e StreamError) Error() string {
	return e.Message
}

func streamErrorf(format string, v ...interface{}) StreamError {
	return StreamError{"Invalid TDS stream: " + fmt.Sprintf(format, v...)}
}

func badStreamPanic(err error) {
	panic(err)
}

func badStreamPanicf(format string, v ...interface{}) {
	panic(streamErrorf(format, v...))
}
