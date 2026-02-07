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

package expression

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Wrapper simply acts as a wrapper for another expression. If a nil expression is wrapped, then the wrapper functions
// as a guard against functions that expect non-nil expressions.
type Wrapper struct {
	inner sql.Expression
}

var _ sql.Expression = (*Wrapper)(nil)
var _ sql.CollationCoercible = (*Wrapper)(nil)

// WrapExpression takes in an expression and wraps it, returning the resulting Wrapper expression. Useful for when
// an expression is nil.
func WrapExpression(expr sql.Expression) *Wrapper {
	return &Wrapper{expr}
}

// WrapExpressions takes in a number of expressions and wraps each one, returning the resulting slice. Useful for when
// an expression in a slice may be nil.
func WrapExpressions(exprs ...sql.Expression) []sql.Expression {
	wrappers := make([]sql.Expression, len(exprs))
	for i, expr := range exprs {
		wrappers[i] = WrapExpression(expr)
	}
	return wrappers
}

// Children implements sql.Expression
func (w *Wrapper) Children() []sql.Expression {
	if w.inner == nil {
		return nil
	}
	return []sql.Expression{w.inner}
}

// Eval implements sql.Expression
func (w *Wrapper) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if w.inner == nil {
		return nil, nil
	}
	return w.inner.Eval(ctx, row)
}

// IsNullable implements sql.Expression
func (w *Wrapper) IsNullable() bool {
	if w.inner == nil {
		return true
	}
	return w.inner.IsNullable()
}

// Resolved implements sql.Expression
func (w *Wrapper) Resolved() bool {
	if w.inner == nil {
		return true
	}
	return w.inner.Resolved()
}

// String implements sql.Expression
func (w *Wrapper) String() string {
	if w.inner == nil {
		return ""
	}
	return fmt.Sprintf("(%s)", w.inner.String())
}

// DebugString implements sql.DebugStringer
func (w *Wrapper) DebugString() string {
	if w.inner == nil {
		return ""
	}
	return fmt.Sprintf("(%s)", sql.DebugString(w.inner))
}

// Type implements sql.Expression
func (w *Wrapper) Type() sql.Type {
	if w.inner == nil {
		return types.Null
	}
	return w.inner.Type()
}

// Unwrap returns the wrapped expression, or nil if no expression was wrapped.
func (w *Wrapper) Unwrap() sql.Expression {
	return w.inner
}

// WithChildren implements sql.Expression
func (w *Wrapper) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) == 0 {
		return WrapExpression(nil), nil
	} else if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(w, len(children), 1)
	}
	return WrapExpression(children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (w *Wrapper) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if w.inner == nil {
		return sql.Collation_binary, 6
	}
	return sql.GetCoercibility(ctx, w.inner)
}
