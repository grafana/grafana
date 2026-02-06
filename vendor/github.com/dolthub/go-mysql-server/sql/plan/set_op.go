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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const (
	UnionType = iota
	IntersectType
	ExceptType
)

// SetOp is a node that returns everything in Left and then everything in Right
type SetOp struct {
	BinaryNode
	Limit      sql.Expression
	Offset     sql.Expression
	cols       sql.ColSet
	SortFields sql.SortFields
	dispose    []sql.DisposeFunc
	SetOpType  int
	id         sql.TableId
	Distinct   bool
}

var _ sql.Node = (*SetOp)(nil)
var _ sql.Expressioner = (*SetOp)(nil)
var _ sql.CollationCoercible = (*SetOp)(nil)

// TODO: This might not be necessary now that SetOp exec indexes are assigned based on its left child node, instead of
// the cols in ColSet
var _ TableIdNode = (*SetOp)(nil)

// NewSetOp creates a new SetOp node with the given children.
func NewSetOp(setOpType int, left, right sql.Node, distinct bool, limit, offset sql.Expression, sortFields sql.SortFields) *SetOp {
	return &SetOp{
		BinaryNode: BinaryNode{left: left, right: right},
		Distinct:   distinct,
		Limit:      limit,
		Offset:     offset,
		SortFields: sortFields,
		SetOpType:  setOpType,
	}
}

func (s *SetOp) Name() string {
	// TODO union should have its own name, table id, cols, etc
	return ""
}

// WithId implements sql.TableIdNode
func (s *SetOp) WithId(id sql.TableId) TableIdNode {
	ret := *s
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (s *SetOp) Id() sql.TableId {
	return s.id
}

// WithColumns implements sql.TableIdNode
func (s *SetOp) WithColumns(set sql.ColSet) TableIdNode {
	ret := *s
	ret.cols = set
	return &ret
}

// Columns implements sql.TableIdNode
func (s *SetOp) Columns() sql.ColSet {
	return s.cols
}

func (s *SetOp) AddDispose(f sql.DisposeFunc) {
	s.dispose = append(s.dispose, f)
}

func (s *SetOp) Schema() sql.Schema {
	ls := s.left.Schema()
	rs := s.right.Schema()
	ret := make([]*sql.Column, len(ls))
	for i := range ls {
		c := *ls[i]
		if i < len(rs) {
			c.Type = types.GeneralizeTypes(ls[i].Type, rs[i].Type)
			c.Nullable = ls[i].Nullable || rs[i].Nullable
		}
		ret[i] = &c
	}
	return ret
}

// Opaque implements the sql.OpaqueNode interface.
// Like SubqueryAlias, the selects in a SetOp must be evaluated in isolation.
func (s *SetOp) Opaque() bool {
	return true
}

func (s *SetOp) Resolved() bool {
	res := s.Left().Resolved() && s.Right().Resolved()
	if s.Limit != nil {
		res = res && s.Limit.Resolved()
	}
	if s.Offset != nil {
		res = res && s.Offset.Resolved()
	}
	for _, sf := range s.SortFields {
		res = res && sf.Column.Resolved()
	}
	return res
}

func (s *SetOp) WithDistinct(b bool) *SetOp {
	ret := *s
	ret.Distinct = b
	return &ret
}

func (s *SetOp) WithLimit(e sql.Expression) *SetOp {
	ret := *s
	ret.Limit = e
	return &ret
}

func (s *SetOp) WithOffset(e sql.Expression) *SetOp {
	ret := *s
	ret.Offset = e
	return &ret
}

func (s *SetOp) Expressions() []sql.Expression {
	var exprs []sql.Expression
	if s.Limit != nil {
		exprs = append(exprs, s.Limit)
	}
	if s.Offset != nil {
		exprs = append(exprs, s.Offset)
	}
	if len(s.SortFields) > 0 {
		exprs = append(exprs, s.SortFields.ToExpressions()...)
	}
	return exprs
}

func (s *SetOp) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	var expLim, expOff, expSort int
	if s.Limit != nil {
		expLim = 1
	}
	if s.Offset != nil {
		expOff = 1
	}
	expSort = len(s.SortFields)

	if len(exprs) != expLim+expOff+expSort {
		return nil, fmt.Errorf("expected %d limit and %d sort fields", expLim, expSort)
	} else if len(exprs) == 0 {
		return s, nil
	}

	ret := *s
	if expLim == 1 {
		ret.Limit = exprs[0]
		exprs = exprs[1:]
	}
	if expOff == 1 {
		ret.Offset = exprs[0]
		exprs = exprs[1:]
	}
	ret.SortFields = s.SortFields.FromExpressions(exprs...)
	return &ret, nil
}

// WithChildren implements the Node interface.
func (s *SetOp) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 2)
	}
	ret := *s
	ret.left = children[0]
	ret.right = children[1]
	return &ret, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SetOp) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// Unions are able to return differing values, therefore they cannot be used to determine coercibility
	return sql.Collation_binary, 7
}

func (s *SetOp) Dispose() {
	for _, f := range s.dispose {
		f()
	}
}

func (s *SetOp) String() string {
	pr := sql.NewTreePrinter()
	var distinct string
	if s.Distinct {
		distinct = "distinct"
	} else {
		distinct = "all"
	}
	switch s.SetOpType {
	case UnionType:
		_ = pr.WriteNode("Union %s", distinct)
	case IntersectType:
		_ = pr.WriteNode("Intersect %s", distinct)
	case ExceptType:
		_ = pr.WriteNode("Except %s", distinct)
	}
	var children []string
	if len(s.SortFields) > 0 {
		children = append(children, fmt.Sprintf("sortFields: %s", s.SortFields.ToExpressions()))
	}
	if s.Limit != nil {
		children = append(children, fmt.Sprintf("limit: %s", s.Limit))
	}
	if s.Offset != nil {
		children = append(children, fmt.Sprintf("offset: %s", s.Offset))
	}
	children = append(children, s.left.String(), s.right.String())
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s *SetOp) IsReadOnly() bool {
	return s.left.IsReadOnly() && s.right.IsReadOnly()
}

func (s *SetOp) DebugString() string {
	pr := sql.NewTreePrinter()
	var distinct string
	if s.Distinct {
		distinct = "distinct"
	} else {
		distinct = "all"
	}
	switch s.SetOpType {
	case UnionType:
		_ = pr.WriteNode("Union %s", distinct)
	case IntersectType:
		_ = pr.WriteNode("Intersect %s", distinct)
	case ExceptType:
		_ = pr.WriteNode("Except %s", distinct)
	}
	var children []string
	if len(s.SortFields) > 0 {
		sFields := make([]string, len(s.SortFields))
		for i, e := range s.SortFields.ToExpressions() {
			sFields[i] = sql.DebugString(e)
		}
		children = append(children, fmt.Sprintf("sortFields: %s", strings.Join(sFields, ", ")))
	}
	if s.Limit != nil {
		children = append(children, fmt.Sprintf("limit: %s", s.Limit))
	}
	if s.Offset != nil {
		children = append(children, fmt.Sprintf("offset: %s", s.Offset))
	}
	children = append(children, sql.DebugString(s.left), sql.DebugString(s.right))
	_ = pr.WriteChildren(children...)
	return pr.String()
}
