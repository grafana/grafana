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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// RangeHeap is a Node that wraps a table with min and max range columns. When used as a secondary provider in Join
// operations, it can efficiently compute the rows whose ranges bound the value from the other table. When the ranges
// don't overlap, the amortized complexity is O(1) for each result row.
type RangeHeap struct {
	UnaryNode
	ValueColumnGf      sql.Expression
	MinColumnGf        sql.Expression
	MaxColumnGf        sql.Expression
	ComparisonType     sql.Type
	ValueColumnIndex   int
	MinColumnIndex     int
	MaxColumnIndex     int
	RangeIsClosedBelow bool
	RangeIsClosedAbove bool
}

var _ sql.Node = (*RangeHeap)(nil)

func NewRangeHeap(child sql.Node, value, min, max *expression.GetField, rangeIsClosedBelow, rangeIsClosedAbove bool) (*RangeHeap, error) {
	newSr := &RangeHeap{
		RangeIsClosedBelow: rangeIsClosedBelow,
		RangeIsClosedAbove: rangeIsClosedAbove,
		ValueColumnGf:      value,
		MinColumnGf:        min,
		MaxColumnGf:        max,
	}
	newSr.Child = child
	return newSr, nil
}

func (s *RangeHeap) String() string {
	return s.Child.String()
}

func (s *RangeHeap) DebugString() string {
	return sql.DebugString(s.Child)
}

func (s *RangeHeap) IsReadOnly() bool {
	return s.Child.IsReadOnly()
}

func (s *RangeHeap) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, fmt.Errorf("ds")
	}

	s2 := *s
	s2.UnaryNode = UnaryNode{Child: children[0]}
	return &s2, nil
}

var _ sql.Node = (*RangeHeap)(nil)
