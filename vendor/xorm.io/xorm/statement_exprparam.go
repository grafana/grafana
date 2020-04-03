// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"strings"

	"xorm.io/builder"
)

type ErrUnsupportedExprType struct {
	tp string
}

func (err ErrUnsupportedExprType) Error() string {
	return fmt.Sprintf("Unsupported expression type: %v", err.tp)
}

type exprParam struct {
	colName string
	arg     interface{}
}

type exprParams struct {
	colNames []string
	args     []interface{}
}

func (exprs *exprParams) Len() int {
	return len(exprs.colNames)
}

func (exprs *exprParams) addParam(colName string, arg interface{}) {
	exprs.colNames = append(exprs.colNames, colName)
	exprs.args = append(exprs.args, arg)
}

func (exprs *exprParams) isColExist(colName string) bool {
	for _, name := range exprs.colNames {
		if strings.EqualFold(trimQuote(name), trimQuote(colName)) {
			return true
		}
	}
	return false
}

func (exprs *exprParams) getByName(colName string) (exprParam, bool) {
	for i, name := range exprs.colNames {
		if strings.EqualFold(name, colName) {
			return exprParam{name, exprs.args[i]}, true
		}
	}
	return exprParam{}, false
}

func (exprs *exprParams) writeArgs(w *builder.BytesWriter) error {
	for i, expr := range exprs.args {
		switch arg := expr.(type) {
		case *builder.Builder:
			if _, err := w.WriteString("("); err != nil {
				return err
			}
			if err := arg.WriteTo(w); err != nil {
				return err
			}
			if _, err := w.WriteString(")"); err != nil {
				return err
			}
		default:
			if _, err := w.WriteString(fmt.Sprintf("%v", arg)); err != nil {
				return err
			}
		}
		if i != len(exprs.args)-1 {
			if _, err := w.WriteString(","); err != nil {
				return err
			}
		}
	}
	return nil
}

func (exprs *exprParams) writeNameArgs(w *builder.BytesWriter) error {
	for i, colName := range exprs.colNames {
		if _, err := w.WriteString(colName); err != nil {
			return err
		}
		if _, err := w.WriteString("="); err != nil {
			return err
		}

		switch arg := exprs.args[i].(type) {
		case *builder.Builder:
			if _, err := w.WriteString("("); err != nil {
				return err
			}
			if err := arg.WriteTo(w); err != nil {
				return err
			}
			if _, err := w.WriteString("("); err != nil {
				return err
			}
		default:
			w.Append(exprs.args[i])
		}

		if i+1 != len(exprs.colNames) {
			if _, err := w.WriteString(","); err != nil {
				return err
			}
		}
	}
	return nil
}
