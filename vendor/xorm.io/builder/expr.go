// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// Expression represetns a SQL express with arguments
type Expression struct {
	sql  string
	args []interface{}
}

var _ Cond = &Expression{}

// Expr generate customerize SQL
func Expr(sql string, args ...interface{}) Cond {
	return &Expression{sql, args}
}

func (expr *Expression) Content() string {
	return expr.sql
}

func (expr *Expression) Args() []interface{} {
	return expr.args
}

// OpWriteTo implements UpdateCond interface
func (expr *Expression) OpWriteTo(op string, w Writer) error {
	return expr.WriteTo(w)
}

// WriteTo implements Cond interface
func (expr *Expression) WriteTo(w Writer) error {
	if _, err := fmt.Fprint(w, expr.sql); err != nil {
		return err
	}
	w.Append(expr.args...)
	return nil
}

// And implements Cond interface
func (expr *Expression) And(conds ...Cond) Cond {
	return And(expr, And(conds...))
}

// Or implements Cond interface
func (expr *Expression) Or(conds ...Cond) Cond {
	return Or(expr, Or(conds...))
}

// IsValid implements Cond interface
func (expr *Expression) IsValid() bool {
	return len(expr.sql) > 0
}
