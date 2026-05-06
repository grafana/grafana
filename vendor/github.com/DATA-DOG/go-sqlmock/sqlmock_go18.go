// +build go1.8

package sqlmock

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"log"
	"time"
)

// Sqlmock interface for Go 1.8+
type Sqlmock interface {
	// Embed common methods
	SqlmockCommon

	// NewRowsWithColumnDefinition allows Rows to be created from a
	// sql driver.Value slice with a definition of sql metadata
	NewRowsWithColumnDefinition(columns ...*Column) *Rows

	// New Column allows to create a Column
	NewColumn(name string) *Column
}

// ErrCancelled defines an error value, which can be expected in case of
// such cancellation error.
var ErrCancelled = errors.New("canceling query due to user request")

// Implement the "QueryerContext" interface
func (c *sqlmock) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	ex, err := c.query(query, args)
	if ex != nil {
		select {
		case <-time.After(ex.delay):
			if err != nil {
				return nil, err
			}
			return ex.rows, nil
		case <-ctx.Done():
			return nil, ErrCancelled
		}
	}

	return nil, err
}

// Implement the "ExecerContext" interface
func (c *sqlmock) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	ex, err := c.exec(query, args)
	if ex != nil {
		select {
		case <-time.After(ex.delay):
			if err != nil {
				return nil, err
			}
			return ex.result, nil
		case <-ctx.Done():
			return nil, ErrCancelled
		}
	}

	return nil, err
}

// Implement the "ConnBeginTx" interface
func (c *sqlmock) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	ex, err := c.begin()
	if ex != nil {
		select {
		case <-time.After(ex.delay):
			if err != nil {
				return nil, err
			}
			return c, nil
		case <-ctx.Done():
			return nil, ErrCancelled
		}
	}

	return nil, err
}

// Implement the "ConnPrepareContext" interface
func (c *sqlmock) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	ex, err := c.prepare(query)
	if ex != nil {
		select {
		case <-time.After(ex.delay):
			if err != nil {
				return nil, err
			}
			return &statement{c, ex, query}, nil
		case <-ctx.Done():
			return nil, ErrCancelled
		}
	}

	return nil, err
}

// Implement the "Pinger" interface - the explicit DB driver ping was only added to database/sql in Go 1.8
func (c *sqlmock) Ping(ctx context.Context) error {
	if !c.monitorPings {
		return nil
	}

	ex, err := c.ping()
	if ex != nil {
		select {
		case <-ctx.Done():
			return ErrCancelled
		case <-time.After(ex.delay):
		}
	}

	return err
}

func (c *sqlmock) ping() (*ExpectedPing, error) {
	var expected *ExpectedPing
	var fulfilled int
	var ok bool
	for _, next := range c.expected {
		next.Lock()
		if next.fulfilled() {
			next.Unlock()
			fulfilled++
			continue
		}

		if expected, ok = next.(*ExpectedPing); ok {
			break
		}

		next.Unlock()
		if c.ordered {
			return nil, fmt.Errorf("call to database Ping, was not expected, next expectation is: %s", next)
		}
	}

	if expected == nil {
		msg := "call to database Ping was not expected"
		if fulfilled == len(c.expected) {
			msg = "all expectations were already fulfilled, " + msg
		}
		return nil, fmt.Errorf(msg)
	}

	expected.triggered = true
	expected.Unlock()
	return expected, expected.err
}

// Implement the "StmtExecContext" interface
func (stmt *statement) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return stmt.conn.ExecContext(ctx, stmt.query, args)
}

// Implement the "StmtQueryContext" interface
func (stmt *statement) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return stmt.conn.QueryContext(ctx, stmt.query, args)
}

func (c *sqlmock) ExpectPing() *ExpectedPing {
	if !c.monitorPings {
		log.Println("ExpectPing will have no effect as monitoring pings is disabled. Use MonitorPingsOption to enable.")
		return nil
	}
	e := &ExpectedPing{}
	c.expected = append(c.expected, e)
	return e
}

// Query meets http://golang.org/pkg/database/sql/driver/#Queryer
// Deprecated: Drivers should implement QueryerContext instead.
func (c *sqlmock) Query(query string, args []driver.Value) (driver.Rows, error) {
	namedArgs := make([]driver.NamedValue, len(args))
	for i, v := range args {
		namedArgs[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}

	ex, err := c.query(query, namedArgs)
	if ex != nil {
		time.Sleep(ex.delay)
	}
	if err != nil {
		return nil, err
	}

	return ex.rows, nil
}

func (c *sqlmock) query(query string, args []driver.NamedValue) (*ExpectedQuery, error) {
	var expected *ExpectedQuery
	var fulfilled int
	var ok bool
	for _, next := range c.expected {
		next.Lock()
		if next.fulfilled() {
			next.Unlock()
			fulfilled++
			continue
		}

		if c.ordered {
			if expected, ok = next.(*ExpectedQuery); ok {
				break
			}
			next.Unlock()
			return nil, fmt.Errorf("call to Query '%s' with args %+v, was not expected, next expectation is: %s", query, args, next)
		}
		if qr, ok := next.(*ExpectedQuery); ok {
			if err := c.queryMatcher.Match(qr.expectSQL, query); err != nil {
				next.Unlock()
				continue
			}
			if err := qr.attemptArgMatch(args); err == nil {
				expected = qr
				break
			}
		}
		next.Unlock()
	}

	if expected == nil {
		msg := "call to Query '%s' with args %+v was not expected"
		if fulfilled == len(c.expected) {
			msg = "all expectations were already fulfilled, " + msg
		}
		return nil, fmt.Errorf(msg, query, args)
	}

	defer expected.Unlock()

	if err := c.queryMatcher.Match(expected.expectSQL, query); err != nil {
		return nil, fmt.Errorf("Query: %v", err)
	}

	if err := expected.argsMatches(args); err != nil {
		return nil, fmt.Errorf("Query '%s', arguments do not match: %s", query, err)
	}

	expected.triggered = true
	if expected.err != nil {
		return expected, expected.err // mocked to return error
	}

	if expected.rows == nil {
		return nil, fmt.Errorf("Query '%s' with args %+v, must return a database/sql/driver.Rows, but it was not set for expectation %T as %+v", query, args, expected, expected)
	}
	return expected, nil
}

// Exec meets http://golang.org/pkg/database/sql/driver/#Execer
// Deprecated: Drivers should implement ExecerContext instead.
func (c *sqlmock) Exec(query string, args []driver.Value) (driver.Result, error) {
	namedArgs := make([]driver.NamedValue, len(args))
	for i, v := range args {
		namedArgs[i] = driver.NamedValue{
			Ordinal: i + 1,
			Value:   v,
		}
	}

	ex, err := c.exec(query, namedArgs)
	if ex != nil {
		time.Sleep(ex.delay)
	}
	if err != nil {
		return nil, err
	}

	return ex.result, nil
}

func (c *sqlmock) exec(query string, args []driver.NamedValue) (*ExpectedExec, error) {
	var expected *ExpectedExec
	var fulfilled int
	var ok bool
	for _, next := range c.expected {
		next.Lock()
		if next.fulfilled() {
			next.Unlock()
			fulfilled++
			continue
		}

		if c.ordered {
			if expected, ok = next.(*ExpectedExec); ok {
				break
			}
			next.Unlock()
			return nil, fmt.Errorf("call to ExecQuery '%s' with args %+v, was not expected, next expectation is: %s", query, args, next)
		}
		if exec, ok := next.(*ExpectedExec); ok {
			if err := c.queryMatcher.Match(exec.expectSQL, query); err != nil {
				next.Unlock()
				continue
			}

			if err := exec.attemptArgMatch(args); err == nil {
				expected = exec
				break
			}
		}
		next.Unlock()
	}
	if expected == nil {
		msg := "call to ExecQuery '%s' with args %+v was not expected"
		if fulfilled == len(c.expected) {
			msg = "all expectations were already fulfilled, " + msg
		}
		return nil, fmt.Errorf(msg, query, args)
	}
	defer expected.Unlock()

	if err := c.queryMatcher.Match(expected.expectSQL, query); err != nil {
		return nil, fmt.Errorf("ExecQuery: %v", err)
	}

	if err := expected.argsMatches(args); err != nil {
		return nil, fmt.Errorf("ExecQuery '%s', arguments do not match: %s", query, err)
	}

	expected.triggered = true
	if expected.err != nil {
		return expected, expected.err // mocked to return error
	}

	if expected.result == nil {
		return nil, fmt.Errorf("ExecQuery '%s' with args %+v, must return a database/sql/driver.Result, but it was not set for expectation %T as %+v", query, args, expected, expected)
	}

	return expected, nil
}

// @TODO maybe add ExpectedBegin.WithOptions(driver.TxOptions)

// NewRowsWithColumnDefinition allows Rows to be created from a
// sql driver.Value slice with a definition of sql metadata
func (c *sqlmock) NewRowsWithColumnDefinition(columns ...*Column) *Rows {
	r := NewRowsWithColumnDefinition(columns...)
	r.converter = c.converter
	return r
}

// NewColumn allows to create a Column that can be enhanced with metadata
// using OfType/Nullable/WithLength/WithPrecisionAndScale methods.
func (c *sqlmock) NewColumn(name string) *Column {
	return NewColumn(name)
}
