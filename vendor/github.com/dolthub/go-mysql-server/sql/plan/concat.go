// Copyright 2021 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql"
)

// Concat is a node that returns everything in Left and then everything in
// Right, but it excludes any results in Right that already appeared in Left.
// Similar to Distinct(Union(...)) but allows Left to return the same row
// more than once.
type Concat struct {
	BinaryNode
}

var _ sql.Node = (*Concat)(nil)
var _ sql.CollationCoercible = (*Concat)(nil)

// NewConcat creates a new Concat node with the given children.
// See concatJoin memo expression for more details.
func NewConcat(left, right sql.Node) *Concat {
	return &Concat{
		BinaryNode: BinaryNode{left: left, right: right},
	}
}

func (c *Concat) Schema() sql.Schema {
	ls := c.left.Schema()
	rs := c.right.Schema()
	ret := make([]*sql.Column, len(ls))
	for i := range ls {
		c := *ls[i]
		if i < len(rs) {
			c.Nullable = ls[i].Nullable || rs[i].Nullable
		}
		ret[i] = &c
	}
	return ret
}

// WithChildren implements the Node interface.
func (c *Concat) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 2)
	}
	return NewConcat(children[0], children[1]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Concat) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// As this is similar to UNION, it isn't possible to determine what the resulting coercibility may be
	return sql.Collation_binary, 7
}

func (c *Concat) IsReadOnly() bool {
	return c.left.IsReadOnly() && c.right.IsReadOnly()
}

func (c Concat) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Concat")
	_ = pr.WriteChildren(c.left.String(), c.right.String())
	return pr.String()
}

func (c Concat) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Concat")
	_ = pr.WriteChildren(sql.DebugString(c.left), sql.DebugString(c.right))
	return pr.String()
}
