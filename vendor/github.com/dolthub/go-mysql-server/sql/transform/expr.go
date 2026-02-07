// Copyright 2020-2021 Dolthub, Inc.
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

package transform

import (
	"errors"
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Expr applies a transformation function to the given expression
// tree from the bottom up. Each callback [f] returns a TreeIdentity
// that is aggregated into a final output indicating whether the
// expression tree was changed.
func Expr(e sql.Expression, f ExprFunc) (sql.Expression, TreeIdentity, error) {
	children := e.Children()
	if len(children) == 0 {
		return f(e)
	}

	var (
		newChildren []sql.Expression
		err         error
	)

	for i := 0; i < len(children); i++ {
		c := children[i]
		c, same, err := Expr(c, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newChildren == nil {
				newChildren = make([]sql.Expression, len(children))
				copy(newChildren, children)
			}
			newChildren[i] = c
		}
	}

	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		e, err = e.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}

	e, sameN, err := f(e)
	if err != nil {
		return nil, SameTree, err
	}
	return e, sameC && sameN, nil
}

// Exprs applies a transformation function to the given set of expressions and returns the result.
func Exprs(e []sql.Expression, f ExprFunc) ([]sql.Expression, TreeIdentity, error) {
	var (
		newExprs []sql.Expression
	)

	for i := 0; i < len(e); i++ {
		c := e[i]
		c, same, err := Expr(c, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newExprs == nil {
				newExprs = make([]sql.Expression, len(e))
				copy(newExprs, e)
			}
			newExprs[i] = c
		}
	}

	if len(newExprs) == 0 {
		return e, SameTree, nil
	}

	return newExprs, NewTree, nil
}

var stopInspect = errors.New("stop")

// InspectExpr traverses the given expression tree from the bottom up, breaking if
// stop = true. Returns a bool indicating whether traversal was interrupted.
func InspectExpr(node sql.Expression, f func(sql.Expression) bool) bool {
	_, _, err := Expr(node, func(e sql.Expression) (sql.Expression, TreeIdentity, error) {
		ok := f(e)
		if ok {
			return nil, SameTree, stopInspect
		}
		return e, SameTree, nil
	})
	return errors.Is(err, stopInspect)
}

// InspectUp traverses the given node tree from the bottom up, breaking if
// stop = true. Returns a bool indicating whether traversal was interrupted.
func InspectUp(node sql.Node, f func(sql.Node) bool) bool {
	stop := errors.New("stop")
	_, _, err := Node(node, func(e sql.Node) (sql.Node, TreeIdentity, error) {
		ok := f(e)
		if ok {
			return nil, SameTree, stop
		}
		return e, SameTree, nil
	})
	return errors.Is(err, stop)
}

// Clone duplicates an existing sql.Expression, returning new nodes with the
// same structure and internal values. It can be useful when dealing with
// stateful expression nodes where an evaluation needs to create multiple
// independent histories of the internal state of the expression nodes.
func Clone(expr sql.Expression) (sql.Expression, error) {
	expr, _, err := Expr(expr, func(e sql.Expression) (sql.Expression, TreeIdentity, error) {
		return e, NewTree, nil
	})
	return expr, err
}

// ExprWithNode applies a transformation function to the given expression from the bottom up.
func ExprWithNode(n sql.Node, e sql.Expression, f ExprWithNodeFunc) (sql.Expression, TreeIdentity, error) {
	children := e.Children()
	if len(children) == 0 {
		return f(n, e)
	}

	var (
		newChildren []sql.Expression
		err         error
	)

	for i := 0; i < len(children); i++ {
		c := children[i]
		c, sameC, err := ExprWithNode(n, c, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !sameC {
			if newChildren == nil {
				newChildren = make([]sql.Expression, len(children))
				copy(newChildren, children)
			}
			newChildren[i] = c
		}
	}

	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		e, err = e.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}

	e, sameN, err := f(n, e)
	if err != nil {
		return nil, SameTree, err
	}
	return e, sameC && sameN, nil
}

// ExpressionToColumn converts the expression to the form that should be used in a Schema. Expressions that have Name()
// and Table() methods will use these; otherwise, String() and "" are used, respectively. The type and nullability are
// taken from the expression directly.
func ExpressionToColumn(e sql.Expression, name string) *sql.Column {
	if n, ok := e.(sql.Nameable); ok {
		name = n.Name()
	}

	var table string
	if t, ok := e.(sql.Tableable); ok {
		table = t.Table()
	}

	var db string
	if t, ok := e.(sql.Databaseable); ok {
		db = t.Database()
	}

	return &sql.Column{
		Name:           name,
		Source:         table,
		DatabaseSource: db,
		Type:           e.Type(),
		Nullable:       e.IsNullable(),
	}
}

// SchemaWithDefaults returns a copy of the schema given with the defaults provided. Default expressions must be
// wrapped with expression.Wrapper.
func SchemaWithDefaults(schema sql.Schema, defaultExprs []sql.Expression) (sql.Schema, error) {
	if len(schema) != len(defaultExprs) {
		return nil, fmt.Errorf("expected %d default expressions, got %d", len(schema), len(defaultExprs))
	}

	sch := schema.Copy()
	for i, col := range sch {
		wrapper, ok := defaultExprs[i].(*expression.Wrapper)
		if !ok {
			return nil, fmt.Errorf("expected expression.Wrapper, got %T", defaultExprs[i])
		}
		wrappedExpr := wrapper.Unwrap()
		if wrappedExpr == nil {
			continue
		}

		defaultExpr, ok := wrappedExpr.(*sql.ColumnDefaultValue)
		if !ok {
			return nil, fmt.Errorf("expected *sql.ColumnDefaultValue, got %T", wrappedExpr)
		}
		if col.Default != nil {
			col.Default = defaultExpr
		} else {
			col.Generated = defaultExpr
		}
	}

	return sch, nil
}

// WrappedColumnDefaults returns the column defaults / generated expressions for the schema given,
// wrapped with expression.Wrapper
func WrappedColumnDefaults(schema sql.Schema) []sql.Expression {
	defs := make([]sql.Expression, len(schema))
	for i, col := range schema {
		defaultVal := col.Default
		if defaultVal == nil && col.Generated != nil {
			defaultVal = col.Generated
		}
		defs[i] = expression.WrapExpression(defaultVal)
	}
	return defs
}
