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

package sql

import (
	"fmt"

	"gopkg.in/src-d/go-errors.v1"
)

// SortField is a field by which a query will be sorted.
type SortField struct {
	// Column to order by.
	Column Expression
	// Column Expression2 to order by. This is always the same value as Column, but avoids a type cast
	Column2 Expression2
	// Order type.
	Order SortOrder
	// NullOrdering defining how nulls will be ordered.
	NullOrdering NullOrdering
}

type SortFields []SortField

func (sf SortFields) ToExpressions() []Expression {
	es := make([]Expression, len(sf))
	for i, f := range sf {
		es[i] = f.Column
	}
	return es
}

func (sf SortFields) FromExpressions(exprs ...Expression) SortFields {
	var fields = make(SortFields, len(sf))

	if len(exprs) != len(fields) {
		panic(fmt.Sprintf("Invalid expression slice. Wanted %d elements, got %d", len(fields), len(exprs)))
	}

	for i, expr := range exprs {
		expr2, _ := expr.(Expression2)
		fields[i] = SortField{
			Column:       expr,
			Column2:      expr2,
			NullOrdering: sf[i].NullOrdering,
			Order:        sf[i].Order,
		}
	}
	return fields
}

func (s SortField) String() string {
	return fmt.Sprintf("%s %s", s.Column, s.Order)
}

func (s SortField) DebugString() string {
	nullOrdering := "nullsFirst"
	if s.NullOrdering == NullsLast {
		nullOrdering = "nullsLast"
	}
	return fmt.Sprintf("%s %s %s", DebugString(s.Column), DebugString(s.Order), nullOrdering)
}

// ErrUnableSort is thrown when something happens on sorting
var ErrUnableSort = errors.NewKind("unable to sort")

// SortOrder represents the order of the sort (ascending or descending).
type SortOrder byte

const (
	// Ascending order.
	Ascending SortOrder = 1
	// Descending order.
	Descending SortOrder = 2
)

func (s SortOrder) String() string {
	switch s {
	case Ascending:
		return "ASC"
	case Descending:
		return "DESC"
	default:
		return "invalid SortOrder"
	}
}

// NullOrdering represents how to order based on null values.
type NullOrdering byte

const (
	// NullsFirst puts the null values before any other values.
	NullsFirst NullOrdering = iota
	// NullsLast puts the null values after all other values.
	NullsLast NullOrdering = 2
)
