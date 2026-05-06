// +build !go1.8

package sqlmock

import (
	"database/sql/driver"
	"fmt"
	"log"
	"time"
)

// Sqlmock interface for Go up to 1.7
type Sqlmock interface {
	// Embed common methods
	SqlmockCommon
}

type namedValue struct {
	Name    string
	Ordinal int
	Value   driver.Value
}

func (c *sqlmock) ExpectPing() *ExpectedPing {
	log.Println("ExpectPing has no effect on Go 1.7 or below")
	return &ExpectedPing{}
}

// Query meets http://golang.org/pkg/database/sql/driver/#Queryer
func (c *sqlmock) Query(query string, args []driver.Value) (driver.Rows, error) {
	namedArgs := make([]namedValue, len(args))
	for i, v := range args {
		namedArgs[i] = namedValue{
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

func (c *sqlmock) query(query string, args []namedValue) (*ExpectedQuery, error) {
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
func (c *sqlmock) Exec(query string, args []driver.Value) (driver.Result, error) {
	namedArgs := make([]namedValue, len(args))
	for i, v := range args {
		namedArgs[i] = namedValue{
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

func (c *sqlmock) exec(query string, args []namedValue) (*ExpectedExec, error) {
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
