// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package dtablefunctions

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

var _ sql.TableFunction = &TableFunctionWrapper{}
var _ sql.ExecSourceRel = &TableFunctionWrapper{}

// TableFunctionWrapper represents a table function with underlying
// regular function. It allows using regular function as table function.
type TableFunctionWrapper struct {
	underlyingFunc sql.Function
	database       sql.Database
	funcExpr       sql.Expression
	args           []sql.Expression
}

// NewTableFunctionWrapper creates new TableFunction
// with given Function as underlying function.
func NewTableFunctionWrapper(f sql.Function) sql.TableFunction {
	return &TableFunctionWrapper{
		underlyingFunc: f,
	}
}

func (t *TableFunctionWrapper) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	nt := *t
	nt.database = db
	nt.args = args
	f, err := nt.underlyingFunc.NewInstance(args)
	if err != nil {
		return nil, err
	}
	if !f.Resolved() {
		return nil, fmt.Errorf("table function is unresolved")
	}
	nt.funcExpr = f
	return &nt, nil
}

func (t *TableFunctionWrapper) Children() []sql.Node {
	return nil
}

func (t *TableFunctionWrapper) Database() sql.Database {
	return t.database
}

func (t *TableFunctionWrapper) Expressions() []sql.Expression {
	if t.funcExpr == nil {
		return nil
	}
	return []sql.Expression{t.funcExpr}
}

func (t *TableFunctionWrapper) IsReadOnly() bool {
	return true
}

func (t *TableFunctionWrapper) Name() string {
	return t.underlyingFunc.FunctionName()
}

func (t *TableFunctionWrapper) RowIter(ctx *sql.Context, r sql.Row) (sql.RowIter, error) {
	v, err := t.funcExpr.Eval(ctx, r)
	if err != nil {
		return nil, err
	}
	if ri, ok := v.(sql.RowIter); ok {
		return ri, nil
	}
	return sql.RowsToRowIter(sql.Row{v}), nil
}

func (t *TableFunctionWrapper) Resolved() bool {
	for _, expr := range t.args {
		if !expr.Resolved() {
			return false
		}
	}
	return true
}

func (t *TableFunctionWrapper) Schema() sql.Schema {
	return sql.Schema{&sql.Column{Name: t.underlyingFunc.FunctionName(), Type: t.funcExpr.Type()}}
}

func (t *TableFunctionWrapper) String() string {
	var args []string
	for _, expr := range t.args {
		args = append(args, expr.String())
	}
	return fmt.Sprintf("%s(%s)", t.underlyingFunc.FunctionName(), strings.Join(args, ", "))
}

func (t *TableFunctionWrapper) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 0)
	}
	return t, nil
}

func (t *TableFunctionWrapper) WithDatabase(database sql.Database) (sql.Node, error) {
	nt := *t
	nt.database = database
	return &nt, nil
}

func (t *TableFunctionWrapper) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if t.funcExpr == nil {
		if len(exprs) != 0 {
			return nil, sql.ErrInvalidChildrenNumber.New(t, len(exprs), 0)
		}
	}
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(exprs), 1)
	}
	nt := *t
	nt.funcExpr = exprs[0]
	return &nt, nil
}
