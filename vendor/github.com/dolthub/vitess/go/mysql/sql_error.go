/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

import (
	"bytes"
	"fmt"
	"regexp"
	"strconv"

	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/dolthub/vitess/go/vt/vterrors"

	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
)

// SQLError is the error structure returned from calling a db library function
type SQLError struct {
	Num     int
	State   string
	Message string
	Query   string
}

// NewSQLError creates a new SQLError.
// If sqlState is left empty, it will default to "HY000" (general error).
// TODO: Should be aligned with vterrors, stack traces and wrapping
func NewSQLError(number int, sqlState string, format string, args ...interface{}) *SQLError {
	if sqlState == "" {
		sqlState = SSUnknownSQLState
	}
	return &SQLError{
		Num:     number,
		State:   sqlState,
		Message: fmt.Sprintf(format, args...),
	}
}

// Error implements the error interface
func (se *SQLError) Error() string {
	buf := &bytes.Buffer{}
	buf.WriteString(se.Message)

	// Add MySQL errno and SQLSTATE in a format that we can later parse.
	// There's no avoiding string parsing because all errors
	// are converted to strings anyway at RPC boundaries.
	// See NewSQLErrorFromError.
	fmt.Fprintf(buf, " (errno %v) (sqlstate %v)", se.Num, se.State)

	if se.Query != "" {
		fmt.Fprintf(buf, " during query: %s", sqlparser.TruncateForLog(se.Query))
	}

	return buf.String()
}

// Number returns the internal MySQL error code.
func (se *SQLError) Number() int {
	return se.Num
}

// SQLState returns the SQLSTATE value.
func (se *SQLError) SQLState() string {
	return se.State
}

var errExtract = regexp.MustCompile(`.*\(errno ([0-9]*)\) \(sqlstate ([0-9a-zA-Z]{5})\).*`)

// NewSQLErrorFromError returns a *SQLError from the provided error.
// If it's not the right type, it still tries to get it from a regexp.
func NewSQLErrorFromError(err error) error {
	if err == nil {
		return nil
	}

	if serr, ok := err.(*SQLError); ok {
		return serr
	}

	msg := err.Error()
	match := errExtract.FindStringSubmatch(msg)
	if len(match) < 2 {
		// Map vitess error codes into the mysql equivalent
		code := vterrors.Code(err)
		num := ERUnknownError
		switch code {
		case vtrpcpb.Code_CANCELED:
			num = ERQueryInterrupted
		case vtrpcpb.Code_UNKNOWN:
			num = ERUnknownError
		case vtrpcpb.Code_INVALID_ARGUMENT:
			// TODO/demmer there are several more appropriate mysql error
			// codes for the various invalid argument cases.
			// it would be better to change the call sites to use
			// the mysql style "(errno X) (sqlstate Y)" format rather than
			// trying to add vitess error codes for all these cases
			num = ERUnknownError
		case vtrpcpb.Code_DEADLINE_EXCEEDED:
			num = ERQueryInterrupted
		case vtrpcpb.Code_NOT_FOUND:
			num = ERUnknownError
		case vtrpcpb.Code_ALREADY_EXISTS:
			num = ERUnknownError
		case vtrpcpb.Code_PERMISSION_DENIED:
			num = ERAccessDeniedError
		case vtrpcpb.Code_UNAUTHENTICATED:
			num = ERAccessDeniedError
		case vtrpcpb.Code_RESOURCE_EXHAUSTED:
			num = ERTooManyUserConnections
		case vtrpcpb.Code_FAILED_PRECONDITION:
			num = ERUnknownError
		case vtrpcpb.Code_ABORTED:
			num = ERQueryInterrupted
		case vtrpcpb.Code_OUT_OF_RANGE:
			num = ERUnknownError
		case vtrpcpb.Code_UNIMPLEMENTED:
			num = ERNotSupportedYet
		case vtrpcpb.Code_INTERNAL:
			num = ERUnknownError
		case vtrpcpb.Code_UNAVAILABLE:
			num = ERUnknownError
		case vtrpcpb.Code_DATA_LOSS:
			num = ERUnknownError
		}

		// Not found, build a generic SQLError.
		return &SQLError{
			Num:     num,
			State:   SSUnknownSQLState,
			Message: msg,
		}
	}

	num, err := strconv.Atoi(match[1])
	if err != nil {
		return &SQLError{
			Num:     ERUnknownError,
			State:   SSUnknownSQLState,
			Message: msg,
		}
	}

	serr := &SQLError{
		Num:     num,
		State:   match[2],
		Message: msg,
	}
	return serr
}
