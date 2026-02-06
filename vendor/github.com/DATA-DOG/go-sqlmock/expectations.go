package sqlmock

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"sync"
	"time"
)

// an expectation interface
type expectation interface {
	fulfilled() bool
	Lock()
	Unlock()
	String() string
}

// common expectation struct
// satisfies the expectation interface
type commonExpectation struct {
	sync.Mutex
	triggered bool
	err       error
}

func (e *commonExpectation) fulfilled() bool {
	return e.triggered
}

// ExpectedClose is used to manage *sql.DB.Close expectation
// returned by *Sqlmock.ExpectClose.
type ExpectedClose struct {
	commonExpectation
}

// WillReturnError allows to set an error for *sql.DB.Close action
func (e *ExpectedClose) WillReturnError(err error) *ExpectedClose {
	e.err = err
	return e
}

// String returns string representation
func (e *ExpectedClose) String() string {
	msg := "ExpectedClose => expecting database Close"
	if e.err != nil {
		msg += fmt.Sprintf(", which should return error: %s", e.err)
	}
	return msg
}

// ExpectedBegin is used to manage *sql.DB.Begin expectation
// returned by *Sqlmock.ExpectBegin.
type ExpectedBegin struct {
	commonExpectation
	delay time.Duration
}

// WillReturnError allows to set an error for *sql.DB.Begin action
func (e *ExpectedBegin) WillReturnError(err error) *ExpectedBegin {
	e.err = err
	return e
}

// String returns string representation
func (e *ExpectedBegin) String() string {
	msg := "ExpectedBegin => expecting database transaction Begin"
	if e.err != nil {
		msg += fmt.Sprintf(", which should return error: %s", e.err)
	}
	return msg
}

// WillDelayFor allows to specify duration for which it will delay
// result. May be used together with Context
func (e *ExpectedBegin) WillDelayFor(duration time.Duration) *ExpectedBegin {
	e.delay = duration
	return e
}

// ExpectedCommit is used to manage *sql.Tx.Commit expectation
// returned by *Sqlmock.ExpectCommit.
type ExpectedCommit struct {
	commonExpectation
}

// WillReturnError allows to set an error for *sql.Tx.Close action
func (e *ExpectedCommit) WillReturnError(err error) *ExpectedCommit {
	e.err = err
	return e
}

// String returns string representation
func (e *ExpectedCommit) String() string {
	msg := "ExpectedCommit => expecting transaction Commit"
	if e.err != nil {
		msg += fmt.Sprintf(", which should return error: %s", e.err)
	}
	return msg
}

// ExpectedRollback is used to manage *sql.Tx.Rollback expectation
// returned by *Sqlmock.ExpectRollback.
type ExpectedRollback struct {
	commonExpectation
}

// WillReturnError allows to set an error for *sql.Tx.Rollback action
func (e *ExpectedRollback) WillReturnError(err error) *ExpectedRollback {
	e.err = err
	return e
}

// String returns string representation
func (e *ExpectedRollback) String() string {
	msg := "ExpectedRollback => expecting transaction Rollback"
	if e.err != nil {
		msg += fmt.Sprintf(", which should return error: %s", e.err)
	}
	return msg
}

// ExpectedQuery is used to manage *sql.DB.Query, *dql.DB.QueryRow, *sql.Tx.Query,
// *sql.Tx.QueryRow, *sql.Stmt.Query or *sql.Stmt.QueryRow expectations.
// Returned by *Sqlmock.ExpectQuery.
type ExpectedQuery struct {
	queryBasedExpectation
	rows             driver.Rows
	delay            time.Duration
	rowsMustBeClosed bool
	rowsWereClosed   bool
}

// WithArgs will match given expected args to actual database query arguments.
// if at least one argument does not match, it will return an error. For specific
// arguments an sqlmock.Argument interface can be used to match an argument.
// Must not be used together with WithoutArgs()
func (e *ExpectedQuery) WithArgs(args ...driver.Value) *ExpectedQuery {
	if e.noArgs {
		panic("WithArgs() and WithoutArgs() must not be used together")
	}
	e.args = args
	return e
}

// WithoutArgs will ensure that no arguments are passed for this query.
// if at least one argument is passed, it will return an error. This allows
// for stricter validation of the query arguments.
// Must no be used together with WithArgs()
func (e *ExpectedQuery) WithoutArgs() *ExpectedQuery {
	if len(e.args) > 0 {
		panic("WithoutArgs() and WithArgs() must not be used together")
	}
	e.noArgs = true
	return e
}

// RowsWillBeClosed expects this query rows to be closed.
func (e *ExpectedQuery) RowsWillBeClosed() *ExpectedQuery {
	e.rowsMustBeClosed = true
	return e
}

// WillReturnError allows to set an error for expected database query
func (e *ExpectedQuery) WillReturnError(err error) *ExpectedQuery {
	e.err = err
	return e
}

// WillDelayFor allows to specify duration for which it will delay
// result. May be used together with Context
func (e *ExpectedQuery) WillDelayFor(duration time.Duration) *ExpectedQuery {
	e.delay = duration
	return e
}

// String returns string representation
func (e *ExpectedQuery) String() string {
	msg := "ExpectedQuery => expecting Query, QueryContext or QueryRow which:"
	msg += "\n  - matches sql: '" + e.expectSQL + "'"

	if len(e.args) == 0 {
		msg += "\n  - is without arguments"
	} else {
		msg += "\n  - is with arguments:\n"
		for i, arg := range e.args {
			msg += fmt.Sprintf("    %d - %+v\n", i, arg)
		}
		msg = strings.TrimSpace(msg)
	}

	if e.rows != nil {
		msg += fmt.Sprintf("\n  - %s", e.rows)
	}

	if e.err != nil {
		msg += fmt.Sprintf("\n  - should return error: %s", e.err)
	}

	return msg
}

// ExpectedExec is used to manage *sql.DB.Exec, *sql.Tx.Exec or *sql.Stmt.Exec expectations.
// Returned by *Sqlmock.ExpectExec.
type ExpectedExec struct {
	queryBasedExpectation
	result driver.Result
	delay  time.Duration
}

// WithArgs will match given expected args to actual database exec operation arguments.
// if at least one argument does not match, it will return an error. For specific
// arguments an sqlmock.Argument interface can be used to match an argument.
// Must not be used together with WithoutArgs()
func (e *ExpectedExec) WithArgs(args ...driver.Value) *ExpectedExec {
	if len(e.args) > 0 {
		panic("WithArgs() and WithoutArgs() must not be used together")
	}
	e.args = args
	return e
}

// WithoutArgs will ensure that no args are passed for this expected database exec action.
// if at least one argument is passed, it will return an error. This allows for stricter
// validation of the query arguments.
// Must not be used together with WithArgs()
func (e *ExpectedExec) WithoutArgs() *ExpectedExec {
	if len(e.args) > 0 {
		panic("WithoutArgs() and WithArgs() must not be used together")
	}
	e.noArgs = true
	return e
}

// WillReturnError allows to set an error for expected database exec action
func (e *ExpectedExec) WillReturnError(err error) *ExpectedExec {
	e.err = err
	return e
}

// WillDelayFor allows to specify duration for which it will delay
// result. May be used together with Context
func (e *ExpectedExec) WillDelayFor(duration time.Duration) *ExpectedExec {
	e.delay = duration
	return e
}

// String returns string representation
func (e *ExpectedExec) String() string {
	msg := "ExpectedExec => expecting Exec or ExecContext which:"
	msg += "\n  - matches sql: '" + e.expectSQL + "'"

	if len(e.args) == 0 {
		msg += "\n  - is without arguments"
	} else {
		msg += "\n  - is with arguments:\n"
		var margs []string
		for i, arg := range e.args {
			margs = append(margs, fmt.Sprintf("    %d - %+v", i, arg))
		}
		msg += strings.Join(margs, "\n")
	}

	if e.result != nil {
		if res, ok := e.result.(*result); ok {
			msg += "\n  - should return Result having:"
			msg += fmt.Sprintf("\n      LastInsertId: %d", res.insertID)
			msg += fmt.Sprintf("\n      RowsAffected: %d", res.rowsAffected)
			if res.err != nil {
				msg += fmt.Sprintf("\n      Error: %s", res.err)
			}
		}
	}

	if e.err != nil {
		msg += fmt.Sprintf("\n  - should return error: %s", e.err)
	}

	return msg
}

// WillReturnResult arranges for an expected Exec() to return a particular
// result, there is sqlmock.NewResult(lastInsertID int64, affectedRows int64) method
// to build a corresponding result. Or if actions needs to be tested against errors
// sqlmock.NewErrorResult(err error) to return a given error.
func (e *ExpectedExec) WillReturnResult(result driver.Result) *ExpectedExec {
	e.result = result
	return e
}

// ExpectedPrepare is used to manage *sql.DB.Prepare or *sql.Tx.Prepare expectations.
// Returned by *Sqlmock.ExpectPrepare.
type ExpectedPrepare struct {
	commonExpectation
	mock         *sqlmock
	expectSQL    string
	statement    driver.Stmt
	closeErr     error
	mustBeClosed bool
	wasClosed    bool
	delay        time.Duration
}

// WillReturnError allows to set an error for the expected *sql.DB.Prepare or *sql.Tx.Prepare action.
func (e *ExpectedPrepare) WillReturnError(err error) *ExpectedPrepare {
	e.err = err
	return e
}

// WillReturnCloseError allows to set an error for this prepared statement Close action
func (e *ExpectedPrepare) WillReturnCloseError(err error) *ExpectedPrepare {
	e.closeErr = err
	return e
}

// WillDelayFor allows to specify duration for which it will delay
// result. May be used together with Context
func (e *ExpectedPrepare) WillDelayFor(duration time.Duration) *ExpectedPrepare {
	e.delay = duration
	return e
}

// WillBeClosed expects this prepared statement to
// be closed.
func (e *ExpectedPrepare) WillBeClosed() *ExpectedPrepare {
	e.mustBeClosed = true
	return e
}

// ExpectQuery allows to expect Query() or QueryRow() on this prepared statement.
// This method is convenient in order to prevent duplicating sql query string matching.
func (e *ExpectedPrepare) ExpectQuery() *ExpectedQuery {
	eq := &ExpectedQuery{}
	eq.expectSQL = e.expectSQL
	eq.converter = e.mock.converter
	e.mock.expected = append(e.mock.expected, eq)
	return eq
}

// ExpectExec allows to expect Exec() on this prepared statement.
// This method is convenient in order to prevent duplicating sql query string matching.
func (e *ExpectedPrepare) ExpectExec() *ExpectedExec {
	eq := &ExpectedExec{}
	eq.expectSQL = e.expectSQL
	eq.converter = e.mock.converter
	e.mock.expected = append(e.mock.expected, eq)
	return eq
}

// String returns string representation
func (e *ExpectedPrepare) String() string {
	msg := "ExpectedPrepare => expecting Prepare statement which:"
	msg += "\n  - matches sql: '" + e.expectSQL + "'"

	if e.err != nil {
		msg += fmt.Sprintf("\n  - should return error: %s", e.err)
	}

	if e.closeErr != nil {
		msg += fmt.Sprintf("\n  - should return error on Close: %s", e.closeErr)
	}

	return msg
}

// query based expectation
// adds a query matching logic
type queryBasedExpectation struct {
	commonExpectation
	expectSQL string
	converter driver.ValueConverter
	args      []driver.Value
	noArgs    bool // ensure no args are passed
}

// ExpectedPing is used to manage *sql.DB.Ping expectations.
// Returned by *Sqlmock.ExpectPing.
type ExpectedPing struct {
	commonExpectation
	delay time.Duration
}

// WillDelayFor allows to specify duration for which it will delay result. May
// be used together with Context.
func (e *ExpectedPing) WillDelayFor(duration time.Duration) *ExpectedPing {
	e.delay = duration
	return e
}

// WillReturnError allows to set an error for expected database ping
func (e *ExpectedPing) WillReturnError(err error) *ExpectedPing {
	e.err = err
	return e
}

// String returns string representation
func (e *ExpectedPing) String() string {
	msg := "ExpectedPing => expecting database Ping"
	if e.err != nil {
		msg += fmt.Sprintf(", which should return error: %s", e.err)
	}
	return msg
}
