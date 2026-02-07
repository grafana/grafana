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
	"fmt"
	"sync"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// NewHashLookup returns a node that performs an indexed hash lookup
// of cached rows for fulfilling RowIter() calls. In particular, this
// node sits directly on top of a `CachedResults` node and has two
// expressions: a projection for hashing the Child row results and
// another projection for hashing the parent row values when
// performing a lookup. When RowIter is called, if cached results are
// available, it fulfills the RowIter call by performing a hash lookup
// on the projected results. If cached results are not available, it
// simply delegates to the child.
func NewHashLookup(n sql.Node, rightEntryKey sql.Expression, leftProbeKey sql.Expression, joinType JoinType) *HashLookup {
	leftKeySch := hash.ExprsToSchema(leftProbeKey)
	compareType := types.GetCompareType(leftProbeKey.Type(), rightEntryKey.Type())
	return &HashLookup{
		UnaryNode:     UnaryNode{n},
		RightEntryKey: rightEntryKey,
		LeftProbeKey:  leftProbeKey,
		CompareType:   compareType,
		Mutex:         new(sync.Mutex),
		JoinType:      joinType,
		leftKeySch:    leftKeySch,
	}
}

type HashLookup struct {
	UnaryNode
	RightEntryKey sql.Expression
	LeftProbeKey  sql.Expression
	CompareType   sql.Type
	Mutex         *sync.Mutex
	Lookup        *map[interface{}][]sql.Row
	leftKeySch    sql.Schema
	JoinType      JoinType
}

var _ sql.Node = (*HashLookup)(nil)
var _ sql.Expressioner = (*HashLookup)(nil)
var _ sql.CollationCoercible = (*HashLookup)(nil)

func (n *HashLookup) Expressions() []sql.Expression {
	return []sql.Expression{n.RightEntryKey, n.LeftProbeKey}
}

func (n *HashLookup) IsReadOnly() bool {
	return n.Child.IsReadOnly()
}

func (n *HashLookup) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(exprs), 2)
	}
	ret := *n
	ret.RightEntryKey = exprs[0]
	ret.LeftProbeKey = exprs[1]
	ret.leftKeySch = hash.ExprsToSchema(ret.LeftProbeKey)
	return &ret, nil
}

func (n *HashLookup) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("HashLookup")
	children := make([]string, 3)
	children[0] = fmt.Sprintf("left-key: %s", n.LeftProbeKey)
	children[1] = fmt.Sprintf("right-key: %s", n.RightEntryKey)
	children[2] = n.Child.String()
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (n *HashLookup) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("HashLookup")
	children := make([]string, 3)
	children[0] = fmt.Sprintf("left-key: %s", sql.DebugString(n.LeftProbeKey))
	children[1] = fmt.Sprintf("right-key: %s", sql.DebugString(n.RightEntryKey))
	children[2] = sql.DebugString(n.Child)
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (n *HashLookup) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 1)
	}
	nn := *n
	nn.UnaryNode.Child = children[0]
	return &nn, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (n *HashLookup) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, n.Child)
}

// GetHashKey converts a tuple expression returning []interface{} into something comparable.
// Fast paths a few smaller slices into fixed size arrays, puts everything else
// through string serialization and a hash for now. It is OK to hash lossy here
// as the join condition is still evaluated after the matching rows are returned.
func (n *HashLookup) GetHashKey(ctx *sql.Context, e sql.Expression, row sql.Row) (interface{}, error) {
	key, err := e.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	key, _, err = n.CompareType.Convert(ctx, key)
	if types.ErrValueNotNil.Is(err) {
		// The LHS expression was NullType. This is allowed.
		return nil, nil
	}
	if err != nil && !sql.ErrTruncatedIncorrect.Is(err) {
		// Truncated warning is already thrown elsewhere.
		return nil, err
	}
	if s, ok := key.([]interface{}); ok {
		return hash.HashOf(ctx, n.leftKeySch, s)
	}
	// byte slices are not hashable
	if k, ok := key.([]byte); ok {
		return string(k), nil
	}

	return hash.HashOfSimple(ctx, key, n.CompareType)
}

func (n *HashLookup) Dispose() {
	n.Lookup = nil
}
