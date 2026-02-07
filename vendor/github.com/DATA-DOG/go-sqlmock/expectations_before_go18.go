//go:build !go1.8
// +build !go1.8

package sqlmock

import (
	"database/sql/driver"
	"fmt"
	"reflect"
)

// WillReturnRows specifies the set of resulting rows that will be returned
// by the triggered query
func (e *ExpectedQuery) WillReturnRows(rows *Rows) *ExpectedQuery {
	e.rows = &rowSets{sets: []*Rows{rows}, ex: e}
	return e
}

func (e *queryBasedExpectation) argsMatches(args []namedValue) error {
	if nil == e.args {
		if e.noArgs && len(args) > 0 {
			return fmt.Errorf("expected 0, but got %d arguments", len(args))
		}
		return nil
	}
	if len(args) != len(e.args) {
		return fmt.Errorf("expected %d, but got %d arguments", len(e.args), len(args))
	}
	for k, v := range args {
		// custom argument matcher
		matcher, ok := e.args[k].(Argument)
		if ok {
			// @TODO: does it make sense to pass value instead of named value?
			if !matcher.Match(v.Value) {
				return fmt.Errorf("matcher %T could not match %d argument %T - %+v", matcher, k, args[k], args[k])
			}
			continue
		}

		dval := e.args[k]
		// convert to driver converter
		darg, err := e.converter.ConvertValue(dval)
		if err != nil {
			return fmt.Errorf("could not convert %d argument %T - %+v to driver value: %s", k, e.args[k], e.args[k], err)
		}

		if !driver.IsValue(darg) {
			return fmt.Errorf("argument %d: non-subset type %T returned from Value", k, darg)
		}

		if !reflect.DeepEqual(darg, v.Value) {
			return fmt.Errorf("argument %d expected [%T - %+v] does not match actual [%T - %+v]", k, darg, darg, v.Value, v.Value)
		}
	}
	return nil
}

func (e *queryBasedExpectation) attemptArgMatch(args []namedValue) (err error) {
	// catch panic
	defer func() {
		if e := recover(); e != nil {
			_, ok := e.(error)
			if !ok {
				err = fmt.Errorf(e.(string))
			}
		}
	}()

	err = e.argsMatches(args)
	return
}
