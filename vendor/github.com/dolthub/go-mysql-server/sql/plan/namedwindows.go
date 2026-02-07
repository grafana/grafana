// Copyright 2022 DoltHub, Inc.
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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// NamedWindows is a list of WINDOW clause definitions
// to be resolved and merged into OVER clause sql.Window
// nodes.
type NamedWindows struct {
	UnaryNode
	WindowDefs map[string]*sql.WindowDefinition
}

var _ sql.Node = (*NamedWindows)(nil)
var _ sql.CollationCoercible = (*NamedWindows)(nil)

func NewNamedWindows(windowDefs map[string]*sql.WindowDefinition, child sql.Node) *NamedWindows {
	return &NamedWindows{
		UnaryNode:  UnaryNode{Child: child},
		WindowDefs: windowDefs,
	}
}

func (n *NamedWindows) IsReadOnly() bool {
	return n.Child.IsReadOnly()
}

// String implements sql.Node
func (n *NamedWindows) String() string {
	var sb strings.Builder
	sb.WriteString("NamedWindows(")
	var sep string
	for n, def := range n.WindowDefs {
		sb.WriteString(strings.ReplaceAll(fmt.Sprintf("%s%s %s", sep, n, def), "over", "as"))
		sep = ", "
	}
	pr := sql.NewTreePrinter()
	sb.WriteString(")")
	_ = pr.WriteNode("%s", sb.String())
	_ = pr.WriteChildren(n.Child.String())
	return pr.String()
}

// DebugString implements sql.Node
func (n *NamedWindows) DebugString() string {
	var sb strings.Builder
	sb.WriteString("NamedWindows(")
	var sep string
	for n, def := range n.WindowDefs {
		sb.WriteString(strings.ReplaceAll(fmt.Sprintf("%s%s %s", sep, n, def.DebugString()), "over", "as"))
		sep = ", "
	}
	pr := sql.NewTreePrinter()
	sb.WriteString(")")
	_ = pr.WriteNode("%s", sb.String())
	_ = pr.WriteChildren(sql.DebugString(n.Child))
	return pr.String()
}

// RowIter implements sql.Node
func (n *NamedWindows) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	panic("cannot iterate *plan.NamedWindows")
}

// WithChildren implements sql.Node
func (n *NamedWindows) WithChildren(nodes ...sql.Node) (sql.Node, error) {
	if len(nodes) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(nodes), 1)
	}
	return NewNamedWindows(n.WindowDefs, nodes[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (n *NamedWindows) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, n.Child)
}
