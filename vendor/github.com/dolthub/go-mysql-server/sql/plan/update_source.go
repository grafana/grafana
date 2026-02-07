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

package plan

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
)

// UpdateSource is the source of updates for an Update node. Its schema is the concatenation of the old and new rows,
// before and after being updated.
type UpdateSource struct {
	UnaryNode
	UpdateExprs []sql.Expression
	Ignore      bool
}

var _ sql.Node = (*UpdateSource)(nil)
var _ sql.CollationCoercible = (*UpdateSource)(nil)

// NewUpdateSource returns a new UpdateSource from the node and expressions given.
func NewUpdateSource(node sql.Node, ignore bool, updateExprs []sql.Expression) *UpdateSource {
	return &UpdateSource{
		UnaryNode:   UnaryNode{node},
		UpdateExprs: updateExprs,
		Ignore:      ignore,
	}
}

// Expressions implements the sql.Expressioner interface.
func (u *UpdateSource) Expressions() []sql.Expression {
	return u.UpdateExprs
}

func (u *UpdateSource) IsReadOnly() bool {
	return true
}

// WithExpressions implements the sql.Expressioner interface.
func (u *UpdateSource) WithExpressions(newExprs ...sql.Expression) (sql.Node, error) {
	if len(newExprs) != len(u.UpdateExprs) {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(u.UpdateExprs), 1)
	}
	return NewUpdateSource(u.Child, u.Ignore, newExprs), nil
}

// Schema implements sql.Node. The schema of an update is a concatenation of the old and new rows.
func (u *UpdateSource) Schema() sql.Schema {
	return append(u.Child.Schema(), u.Child.Schema()...)
}

// Resolved implements the Resolvable interface.
func (u *UpdateSource) Resolved() bool {
	if !u.Child.Resolved() {
		return false
	}
	for _, updateExpr := range u.UpdateExprs {
		if !updateExpr.Resolved() {
			return false
		}
	}
	return true
}

func (u *UpdateSource) String() string {
	tp := sql.NewTreePrinter()
	var updateExprs []string
	for _, e := range u.UpdateExprs {
		updateExprs = append(updateExprs, e.String())
	}
	_ = tp.WriteNode("UpdateSource(%s)", strings.Join(updateExprs, ","))
	_ = tp.WriteChildren(u.Child.String())
	return tp.String()
}

func (u *UpdateSource) DebugString() string {
	pr := sql.NewTreePrinter()
	var updateExprs []string
	for _, e := range u.UpdateExprs {
		updateExprs = append(updateExprs, sql.DebugString(e))
	}
	_ = pr.WriteNode("UpdateSource(%s)", strings.Join(updateExprs, ","))
	_ = pr.WriteChildren(sql.DebugString(u.Child))
	return pr.String()
}

func (u *UpdateSource) GetChildSchema() (sql.Schema, error) {
	if nodeHasJoin(u.Child) {
		return u.Child.Schema(), nil
	}

	table, err := GetUpdatable(u.Child)
	if err != nil {
		return nil, err
	}

	return table.Schema(), nil
}

func nodeHasJoin(node sql.Node) bool {
	hasJoinNode := false
	transform.Inspect(node, func(node sql.Node) bool {
		switch node.(type) {
		case *JoinNode:
			hasJoinNode = true
			return false
		default:
			return true
		}
	})

	return hasJoinNode
}

func (u *UpdateSource) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(children), 1)
	}
	return NewUpdateSource(children[0], u.Ignore, u.UpdateExprs), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (u *UpdateSource) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, u.Child)
}
