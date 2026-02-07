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

package sql

import (
	"fmt"
	"strings"
)

type IndexDef struct {
	Name       string
	Comment    string
	Columns    []IndexColumn
	Constraint IndexConstraint
	Storage    IndexUsing
}

func (i *IndexDef) String() string {
	return i.Name
}

func (i *IndexDef) IsUnique() bool {
	return i.Constraint == IndexConstraint_Unique
}

func (i *IndexDef) IsFullText() bool {
	return i.Constraint == IndexConstraint_Fulltext
}

func (i *IndexDef) IsSpatial() bool {
	return i.Constraint == IndexConstraint_Spatial
}

func (i *IndexDef) IsVector() bool {
	return i.Constraint == IndexConstraint_Vector
}

func (i *IndexDef) IsPrimary() bool {
	return i.Constraint == IndexConstraint_Primary
}

// ColumnNames returns each column's name without the length property.
func (i *IndexDef) ColumnNames() []string {
	colNames := make([]string, len(i.Columns))
	for i, col := range i.Columns {
		colNames[i] = col.Name
	}
	return colNames
}

type IndexDefs []*IndexDef

// IndexColumn is the column by which to add to an index.
type IndexColumn struct {
	Name string
	// Length represents the index prefix length. If zero, then no length was specified.
	Length int64
}

// IndexConstraint represents any constraints that should be applied to the index.
type IndexConstraint byte

const (
	IndexConstraint_None IndexConstraint = iota
	IndexConstraint_Unique
	IndexConstraint_Fulltext
	IndexConstraint_Spatial
	IndexConstraint_Vector
	IndexConstraint_Primary
)

// IndexUsing is the desired storage type.
type IndexUsing byte

const (
	IndexUsing_Default IndexUsing = iota
	IndexUsing_BTree
	IndexUsing_Hash
)

// Index is the representation of an index, and also creates an IndexLookup when given a collection of ranges.
type Index interface {
	// ID returns the identifier of the index.
	ID() string
	// Database returns the database name this index belongs to.
	Database() string
	// Table returns the table name this index belongs to.
	Table() string
	// Expressions returns the indexed expressions. If the result is more than
	// one expression, it means the index has multiple columns indexed. If it's
	// just one, it means it may be an expression or a column.
	Expressions() []string
	// IsUnique returns whether this index is unique
	IsUnique() bool
	// IsSpatial returns whether this index is a spatial index
	IsSpatial() bool
	// IsFullText returns whether this index is a Full-Text index
	IsFullText() bool
	// IsVector returns whether this index is a Full-Text index
	IsVector() bool
	// Comment returns the comment for this index
	Comment() string
	// IndexType returns the type of this index, e.g. BTREE
	IndexType() string
	// IsGenerated returns whether this index was generated. Generated indexes
	// are used for index access, but are not displayed (such as with SHOW INDEXES).
	IsGenerated() bool
	// ColumnExpressionTypes returns each expression and its associated Type.
	// Each expression string should exactly match the string returned from
	// Index.Expressions().
	ColumnExpressionTypes() []ColumnExpressionType
	// CanSupport returns whether this index supports lookups on the given
	// range filters.
	CanSupport(*Context, ...Range) bool
	// CanSupportOrderBy returns whether this index can optimize ORDER BY a given expression type.
	// Verifying that the expression's children match the index columns are done separately.
	CanSupportOrderBy(expr Expression) bool

	// PrefixLengths returns the prefix lengths for each column in this index
	PrefixLengths() []uint16
}

// ExtendedIndex is an extension of Index, that allows access to appended primary keys. MySQL internally represents an
// index as the collection of all explicitly referenced columns, while appending any unreferenced primary keys to the
// end (in order of their declaration). For full MySQL compatibility, integrators are encouraged to mimic this, however
// not all implementations may define their indexes (on tables with primary keys) in this way, therefore this interface
// is optional.
type ExtendedIndex interface {
	Index
	// ExtendedExpressions returns the same result as Expressions, but appends any primary keys that are implicitly in
	// the index. The appended primary keys are in declaration order.
	ExtendedExpressions() []string
	// ExtendedColumnExpressionTypes returns the same result as ColumnExpressionTypes, but appends the type of any
	// primary keys that are implicitly in the index. The appended primary keys are in declaration order.
	ExtendedColumnExpressionTypes() []ColumnExpressionType
}

// IndexLookup is the implementation-specific definition of an index lookup. The IndexLookup must contain all necessary
// information to retrieve exactly the rows in the table as specified by the ranges given to their parent index.
// Implementors are responsible for all semantics of correctly returning rows that match an index lookup.
type IndexLookup struct {
	Index               Index
	Ranges              RangeCollection
	VectorOrderAndLimit OrderAndLimit
	// IsPointLookup is true if the lookup will return one or zero
	// values; the range is null safe, the index is unique, every index
	// column has a range expression, and every range expression is an
	// exact equality.
	IsPointLookup   bool
	IsEmptyRange    bool
	IsSpatialLookup bool
	IsReverse       bool
}

var emptyLookup = IndexLookup{}

type IndexComparisonExpression interface {
	// TODO: IndexScanOp probably needs to be moved into this package as well
	IndexScanOperation() (IndexScanOp, Expression, Expression, bool)
}

type IndexScanOp uint8

//go:generate stringer -type=IndexScanOp -linecomment

const (
	IndexScanOpEq         IndexScanOp = iota // =
	IndexScanOpNullSafeEq                    // <=>
	IndexScanOpInSet                         // =
	IndexScanOpNotInSet                      // !=
	IndexScanOpNotEq                         // !=
	IndexScanOpGt                            // >
	IndexScanOpGte                           // >=
	IndexScanOpLt                            // <
	IndexScanOpLte                           // <=
	IndexScanOpAnd                           // &&
	IndexScanOpOr                            // ||
	IndexScanOpIsNull                        // IS NULL
	IndexScanOpIsNotNull                     // IS NOT NULL
	IndexScanOpSpatialEq                     // SpatialEq
	IndexScanOpFulltextEq                    // FulltextEq
)

// Swap returns the identity op for swapping a comparison's LHS and RHS
func (o IndexScanOp) Swap() IndexScanOp {
	switch o {
	case IndexScanOpGt:
		return IndexScanOpLt
	case IndexScanOpGte:
		return IndexScanOpLte
	case IndexScanOpLt:
		return IndexScanOpGt
	case IndexScanOpLte:
		return IndexScanOpGte
	default:
		return o
	}
}

func NewIndexLookup(idx Index, ranges MySQLRangeCollection, isPointLookup, isEmptyRange, isSpatialLookup, isReverse bool) IndexLookup {
	if isReverse {
		for i, j := 0, len(ranges)-1; i < j; i, j = i+1, j-1 {
			ranges[i], ranges[j] = ranges[j], ranges[i]
		}
	}
	return IndexLookup{
		Index:           idx,
		Ranges:          ranges,
		IsPointLookup:   isPointLookup,
		IsEmptyRange:    isEmptyRange,
		IsSpatialLookup: isSpatialLookup,
		IsReverse:       isReverse,
	}
}

func (il IndexLookup) IsEmpty() bool {
	return il.Index == nil
}

func (il IndexLookup) String() string {
	pr := NewTreePrinter()
	_ = pr.WriteNode("IndexLookup")
	pr.WriteChildren(fmt.Sprintf("index: %s", il.Index), fmt.Sprintf("ranges: %s", il.Ranges.String()))
	return pr.String()
}

func (il IndexLookup) DebugString() string {
	pr := NewTreePrinter()
	_ = pr.WriteNode("IndexLookup")
	pr.WriteChildren(fmt.Sprintf("index: %s", il.Index), fmt.Sprintf("ranges: %s", il.Ranges.DebugString()))
	return pr.String()
}

// FilteredIndex is an extension of |Index| that allows an index to declare certain filter predicates handled,
// allowing them to be removed from the overall plan for greater execution efficiency
type FilteredIndex interface {
	Index
	// HandledFilters returns a subset of |filters| that are satisfied
	// by index lookups to this index.
	HandledFilters(filters []Expression) (handled []Expression)
}

type IndexOrder byte

const (
	IndexOrderNone IndexOrder = iota
	IndexOrderAsc
	IndexOrderDesc
)

// OrderedIndex is an extension of |Index| that allows indexes to declare their return order. The query engine can
// optimize certain queries if the order of an index is guaranteed, e.g. removing a sort operation.
type OrderedIndex interface {
	Index
	// Order returns the order of results for reads from this index
	Order() IndexOrder
	// Reversible returns whether or not this index can be iterated on backwards
	Reversible() bool
}

// ColumnExpressionType returns a column expression along with its Type.
type ColumnExpressionType struct {
	Type       Type
	Expression string
}

// ValidatePrimaryKeyDrop validates that a primary key may be dropped. If any validation error is returned, then it
// means it is not valid to drop this table's primary key. Validation includes checking for PK columns with the
// auto_increment property, in which case, MySQL requires that another index exists on the table where the first
// column in the index is the auto_increment column from the primary key.
// https://dev.mysql.com/doc/refman/8.0/en/innodb-auto-increment-handling.html
func ValidatePrimaryKeyDrop(ctx *Context, t IndexAddressableTable, oldSchema PrimaryKeySchema) error {
	// If the primary key doesn't have an auto_increment option set, then we don't validate anything else
	autoIncrementColumn := findPrimaryKeyAutoIncrementColumn(oldSchema)
	if autoIncrementColumn == nil {
		return nil
	}

	// If there is an auto_increment option set, then we need to verify that there is still a supporting index,
	// meaning the index is prefixed with the primary key column that contains the auto_increment option.
	indexes, err := t.GetIndexes(ctx)
	if err != nil {
		return err
	}

	for _, idx := range indexes {
		// Don't bother considering FullText or Spatial indexes, since these aren't valid
		// on auto_increment int columns anyway.
		if idx.IsFullText() || idx.IsSpatial() {
			continue
		}

		// Skip the primary key index, since we're trying to delete it
		if strings.ToLower(idx.ID()) == "primary" {
			continue
		}

		if idx.Expressions()[0] == autoIncrementColumn.Source+"."+autoIncrementColumn.Name {
			// By this point, we've verified that it's valid to drop the table's primary key
			return nil
		}
	}

	// We've searched all indexes and couldn't find one supporting the auto_increment column, so we error out.
	return ErrWrongAutoKey.New()
}

// findPrimaryKeyAutoIncrementColumn returns the first column in the primary key that has the auto_increment option,
// otherwise it returns null if no primary key columns are defined with the auto_increment option.
func findPrimaryKeyAutoIncrementColumn(schema PrimaryKeySchema) *Column {
	for _, ordinal := range schema.PkOrdinals {
		if schema.Schema[ordinal].AutoIncrement {
			return schema.Schema[ordinal]
		}
	}
	return nil
}
