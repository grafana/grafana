// Copyright 2023 Dolthub, Inc.
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

package rowexec

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// ExprCloserIter ensures that all expressions that implement sql.Closer are closed. This is implemented as a capturing
// iterator, as our workflow only supports closing nodes, not expressions.
type ExprCloserIter struct {
	iter  sql.RowIter
	exprs []sql.Closer
}

var _ sql.RowIter = (*ExprCloserIter)(nil)

// AddExpressionCloser returns a new iterator that ensures that any expressions that implement sql.Closer are closed.
// If there are no expressions that implement sql.Closer in the tree, then the original iterator is returned.
func AddExpressionCloser(node sql.Node, iter sql.RowIter) sql.RowIter {
	var exprs []sql.Closer
	transform.InspectExpressions(node, func(expr sql.Expression) bool {
		if closer, ok := expr.(sql.Closer); ok {
			exprs = append(exprs, closer)
			// If we've hit an expression that closes, then we assume that the expression will also close its children.
			return false
		}
		return true
	})
	if len(exprs) == 0 {
		return iter
	}
	return &ExprCloserIter{
		iter:  iter,
		exprs: exprs,
	}
}

// Next implements the interface sql.RowIter.
func (eci *ExprCloserIter) Next(ctx *sql.Context) (sql.Row, error) {
	return eci.iter.Next(ctx)
}

// Close implements the interface sql.RowIter.
func (eci *ExprCloserIter) Close(ctx *sql.Context) error {
	err := eci.iter.Close(ctx)
	for _, expr := range eci.exprs {
		if nErr := expr.Close(ctx); err == nil {
			err = nErr
		}
	}
	return err
}

func (eci *ExprCloserIter) GetIter() sql.RowIter {
	return eci.iter
}

func (eci *ExprCloserIter) WithChildIter(childIter sql.RowIter) sql.RowIter {
	neci := *eci
	neci.iter = childIter
	return &neci
}
