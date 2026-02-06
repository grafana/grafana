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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

type itaType uint8

const (
	ItaTypeStatic itaType = iota
	ItaTypeLookup
)

var ErrInvalidLookupForIndexedTable = errors.NewKind("indexable table does not support given lookup: %s")

// IndexedTableAccess represents an indexed lookup of a particular plan.TableNode. The values for the key used to access
// the indexed table is provided in RowIter(), or during static analysis.
type IndexedTableAccess struct {
	TableNode sql.TableNode
	Table     sql.IndexedTable
	cols      sql.ColSet
	lb        *LookupBuilder
	lookup    sql.IndexLookup
	id        sql.TableId
	Typ       itaType
}

var _ sql.Table = (*IndexedTableAccess)(nil)
var _ sql.Node = (*IndexedTableAccess)(nil)
var _ sql.Nameable = (*IndexedTableAccess)(nil)
var _ sql.Expressioner = (*IndexedTableAccess)(nil)
var _ sql.CollationCoercible = (*IndexedTableAccess)(nil)
var _ sql.TableNode = (*IndexedTableAccess)(nil)

// NewIndexedAccessForTableNode creates an IndexedTableAccess node if the resolved table embeds
// an IndexAddressableTable, otherwise returns an error.
func NewIndexedAccessForTableNode(ctx *sql.Context, node sql.TableNode, lb *LookupBuilder) (*IndexedTableAccess, error) {
	var table = node.UnderlyingTable()
	iaTable, ok := table.(sql.IndexAddressableTable)
	if !ok {
		return nil, fmt.Errorf("table is not index addressable: %s", table.Name())
	}

	lookup, err := lb.GetLookup(ctx, lb.GetZeroKey())
	if err != nil {
		return nil, err
	}
	if !lookup.Index.CanSupport(ctx, lookup.Ranges.ToRanges()...) {
		return nil, ErrInvalidLookupForIndexedTable.New(lookup.Ranges.DebugString())
	}
	var indexedTable sql.IndexedTable
	indexedTable = iaTable.IndexedAccess(ctx, lookup)

	if mtn, ok := node.(sql.MutableTableNode); ok {
		mtn, err = mtn.WithTable(indexedTable)
		if err != nil {
			return nil, err
		}

		indexedTable, ok = mtn.WrappedTable().(sql.IndexedTable)
		if !ok {
			return nil, fmt.Errorf("table is not index addressable: %s", table.Name())
		}

		node = mtn
	}

	var id sql.TableId
	var cols sql.ColSet
	if tin, ok := node.(TableIdNode); ok {
		id = tin.Id()
		cols = tin.Columns()
	}

	return &IndexedTableAccess{
		TableNode: node,
		lb:        lb,
		Table:     indexedTable,
		Typ:       ItaTypeLookup,
		id:        id,
		cols:      cols,
	}, nil
}

// NewStaticIndexedAccessForTableNode creates an IndexedTableAccess node if the resolved table embeds
// an IndexAddressableTable, otherwise returns an error.
func NewStaticIndexedAccessForTableNode(ctx *sql.Context, node sql.TableNode, lookup sql.IndexLookup) (*IndexedTableAccess, error) {
	var table sql.Table
	table = node.UnderlyingTable()
	iaTable, ok := table.(sql.IndexAddressableTable)
	if !ok {
		return nil, fmt.Errorf("table is not index addressable: %s", table.Name())
	}

	if !lookup.Index.CanSupport(ctx, lookup.Ranges.ToRanges()...) {
		return nil, ErrInvalidLookupForIndexedTable.New(lookup.Ranges.DebugString())
	}
	indexedTable := iaTable.IndexedAccess(ctx, lookup)

	if mtn, ok := node.(sql.MutableTableNode); ok {
		var err error
		mtn, err = mtn.WithTable(indexedTable)
		if err != nil {
			return nil, err
		}

		indexedTable, ok = mtn.WrappedTable().(sql.IndexedTable)
		if !ok {
			return nil, fmt.Errorf("table is not index addressable: %s", table.Name())
		}

		node = mtn
	}

	var id sql.TableId
	var cols sql.ColSet
	if tin, ok := node.(TableIdNode); ok {
		id = tin.Id()
		cols = tin.Columns()
	}

	return &IndexedTableAccess{
		TableNode: node,
		lookup:    lookup,
		Table:     indexedTable,
		Typ:       ItaTypeStatic,
		id:        id,
		cols:      cols,
	}, nil
}

// NewStaticIndexedAccessForFullTextTable creates an IndexedTableAccess node for Full-Text tables, which have a
// different behavior compared to other indexed tables.
func NewStaticIndexedAccessForFullTextTable(node sql.TableNode, lookup sql.IndexLookup, ftTable sql.IndexedTable) *IndexedTableAccess {
	return &IndexedTableAccess{
		TableNode: node,
		lookup:    lookup,
		Table:     ftTable,
		Typ:       ItaTypeStatic,
	}
}

func (i *IndexedTableAccess) WithDatabase(database sql.Database) (sql.Node, error) {
	return i, nil
}

func (i *IndexedTableAccess) UnderlyingTable() sql.Table {
	return i.TableNode.UnderlyingTable()
}

// WithId implements sql.TableIdNode
func (i *IndexedTableAccess) WithId(id sql.TableId) TableIdNode {
	ret := *i
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (i *IndexedTableAccess) Id() sql.TableId {
	return i.id
}

// WithColumns implements sql.TableIdNode
func (i *IndexedTableAccess) WithColumns(set sql.ColSet) TableIdNode {
	ret := *i
	ret.cols = set
	return &ret
}

// Columns implements sql.TableIdNode
func (i *IndexedTableAccess) Columns() sql.ColSet {
	return i.cols
}

func (i *IndexedTableAccess) IsStatic() bool {
	return !i.lookup.IsEmpty()
}

func (i *IndexedTableAccess) Resolved() bool {
	return i.TableNode.Resolved()
}

func (i *IndexedTableAccess) IsReadOnly() bool {
	return true
}

func (i *IndexedTableAccess) Schema() sql.Schema {
	return i.TableNode.Schema()
}

func (i *IndexedTableAccess) Collation() sql.CollationID {
	return i.TableNode.Collation()
}

func (i *IndexedTableAccess) Comment() string {
	if ct, ok := i.Table.(sql.CommentedTable); ok {
		return ct.Comment()
	}
	return ""
}

func (i *IndexedTableAccess) Children() []sql.Node {
	return nil
}

func (i *IndexedTableAccess) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 0)
	}

	return i, nil
}

func (i *IndexedTableAccess) Name() string {
	return i.TableNode.Name()
}

func (i *IndexedTableAccess) WithName(s string) sql.Node {
	ret := *i
	ret.TableNode = i.TableNode.(sql.RenameableNode).WithName(s).(sql.TableNode)
	return &ret
}

func (i *IndexedTableAccess) Database() sql.Database {
	return i.TableNode.Database()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (i *IndexedTableAccess) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return i.TableNode.CollationCoercibility(ctx)
}

func (i *IndexedTableAccess) Index() sql.Index {
	if !i.lookup.IsEmpty() {
		return i.lookup.Index
	}
	return i.lb.index
}

// CanBuildIndex returns whether an index lookup on this table can be successfully built for a zero-valued key. For a
// static lookup, no lookup needs to be built, so returns true.
func (i *IndexedTableAccess) CanBuildIndex(ctx *sql.Context) (bool, error) {
	// If the lookup was provided at analysis time (static evaluation), then an index was already built
	if !i.lookup.IsEmpty() {
		return true, nil
	}

	key := i.lb.GetZeroKey()
	lookup, err := i.lb.GetLookup(ctx, key)
	return err == nil && !lookup.IsEmpty(), nil
}

func (i *IndexedTableAccess) IsStrictLookup() bool {
	if !i.lb.index.IsUnique() {
		return false
	}
	for _, m := range i.lb.matchesNullMask {
		if m {
			return false
		}
	}
	if len(i.lb.keyExprs) != len(i.lb.index.Expressions()) {
		// only partial key
		return false
	}
	if strings.EqualFold(i.lb.index.ID(), "primary") {
		return true
	}
	for _, e := range i.lb.keyExprs {
		if e.IsNullable() {
			// nullable key may not be
			return false
		}
	}
	return true
}

func (i *IndexedTableAccess) GetLookup(ctx *sql.Context, row sql.Row) (sql.IndexLookup, error) {
	// if the lookup was provided at analysis time (static evaluation), use it.
	if !i.lookup.IsEmpty() {
		return i.lookup, nil
	}

	key, err := i.lb.GetKey(ctx, row)
	if err != nil {
		return sql.IndexLookup{}, err
	}
	return i.lb.GetLookup(ctx, key)
}

func (i *IndexedTableAccess) getLookup2(ctx *sql.Context, row sql.Row2) (sql.IndexLookup, error) {
	// if the lookup was provided at analysis time (static evaluation), use it.
	if !i.lookup.IsEmpty() {
		return i.lookup, nil
	}

	key, err := i.lb.GetKey2(ctx, row)
	if err != nil {
		return sql.IndexLookup{}, err
	}
	return i.lb.GetLookup(ctx, key)
}

func (i *IndexedTableAccess) String() string {
	pr := sql.NewTreePrinter()
	pr.WriteNode("IndexedTableAccess(%s)", i.TableNode.Name())
	var children []string
	children = append(children, fmt.Sprintf("index: %s", formatIndexDecoratorString(i.Index())))
	if !i.lookup.IsEmpty() && i.lookup.Ranges.Len() > 0 {
		children = append(children, fmt.Sprintf("filters: %s", i.lookup.Ranges.DebugString()))
	}
	if !i.lookup.IsEmpty() && i.lookup.VectorOrderAndLimit.OrderBy != nil {
		children = append(children, fmt.Sprintf("order: %s", i.lookup.VectorOrderAndLimit.DebugString()))
	}

	if pt, ok := i.Table.(sql.ProjectedTable); ok {
		projections := pt.Projections()
		if projections != nil {
			columns := make([]string, len(projections))
			for i, c := range projections {
				columns[i] = strings.ToLower(c)
			}
			children = append(children, fmt.Sprintf("columns: %v", columns))
		}
	}

	if i.lb != nil && len(i.lb.keyExprs) > 0 {
		keys := make([]string, len(i.lb.keyExprs))
		for i, e := range i.lb.keyExprs {
			keys[i] = e.String()
		}
		children = append(children, fmt.Sprintf("keys: %s", strings.Join(keys, ", ")))
	}

	if ft, ok := i.Table.(sql.FilteredTable); ok {
		var filters []string
		for _, f := range ft.Filters() {
			filters = append(filters, f.String())
		}
		if len(filters) > 0 {
			pr.WriteChildren(fmt.Sprintf("filters: %v", filters))
		}
	}

	if i.lookup.IsReverse {
		children = append(children, fmt.Sprintf("reverse: %v", i.lookup.IsReverse))
	}

	pr.WriteChildren(children...)
	return pr.String()
}

func formatIndexDecoratorString(idx sql.Index) string {
	var expStrs []string
	expStrs = append(expStrs, idx.Expressions()...)
	return fmt.Sprintf("[%s]", strings.Join(expStrs, ","))
}

func (i *IndexedTableAccess) DebugString() string {
	pr := sql.NewTreePrinter()
	pr.WriteNode("IndexedTableAccess(%s)", i.TableNode.Name())
	var children []string
	children = append(children, fmt.Sprintf("index: %s", formatIndexDecoratorString(i.Index())))
	if !i.lookup.IsEmpty() {
		if i.lookup.Ranges.Len() > 0 {
			children = append(children, fmt.Sprintf("static: %s", i.lookup.Ranges.DebugString()))
		}
		if !i.lookup.IsEmpty() && i.lookup.VectorOrderAndLimit.OrderBy != nil {
			children = append(children, fmt.Sprintf("order: %s", i.lookup.VectorOrderAndLimit.DebugString()))
		}
		if i.lookup.IsReverse {
			children = append(children, fmt.Sprintf("reverse: %v", i.lookup.IsReverse))
		}
	} else {
		var filters []string
		for _, e := range i.lb.keyExprs {
			filters = append(filters, sql.DebugString(e))
		}
		if len(filters) > 0 {
			children = append(children, fmt.Sprintf("keys: %v", filters))
		}
	}

	children = append(children, fmt.Sprintf("colSet: %s", i.Columns()), fmt.Sprintf("tableId: %d", i.Id()))

	// TableWrappers may want to print their own debug info
	if wrapper, ok := i.Table.(sql.TableWrapper); ok {
		if ds, ok := wrapper.(sql.DebugStringer); ok {
			children = append(children, sql.DebugString(ds))
		}
	} else {
		children = append(children, TableDebugString(i.Table))
	}

	pr.WriteChildren(children...)
	return pr.String()
}

// Expressions implements sql.Expressioner
func (i *IndexedTableAccess) Expressions() []sql.Expression {
	if !i.lookup.IsEmpty() {
		return nil
	}
	return i.lb.Expressions()
}

func (i *IndexedTableAccess) NullMask() []bool {
	if !i.lookup.IsEmpty() {
		return nil
	}
	return i.lb.matchesNullMask
}

// WithExpressions implements sql.Expressioner
func (i *IndexedTableAccess) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if !i.lookup.IsEmpty() {
		if len(exprs) != 0 {
			return nil, sql.ErrInvalidChildrenNumber.New(i, len(exprs), 0)
		}
		n := *i
		return &n, nil
	}
	lb, err := i.lb.WithExpressions(i, exprs...)
	if err != nil {
		return nil, err
	}
	ret := *i
	ret.lb = lb
	return &ret, nil
}

func (i IndexedTableAccess) WithTable(table sql.IndexedTable) (sql.Node, error) {
	i.Table = table
	return &i, nil
}

// Partitions implements sql.Table
func (i *IndexedTableAccess) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return i.Table.LookupPartitions(ctx, i.lookup)
}

// PartitionRows implements sql.Table
func (i *IndexedTableAccess) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	return i.Table.PartitionRows(ctx, partition)
}

// GetIndexLookup returns the sql.IndexLookup from an IndexedTableAccess.
// This method is exported for use in integration tests.
func GetIndexLookup(ita *IndexedTableAccess) sql.IndexLookup {
	return ita.lookup
}

type lookupBuilderKey []interface{}

// LookupBuilder abstracts secondary table access for an LookupJoin.
// A row from the primary table is first evaluated on the secondary index's
// expressions (columns) to produce a lookupBuilderKey. Consider the
// query below, assuming B has an index `xy (x,y)`:
//
// select * from A join B on a.x = b.x AND a.y = b.y
//
// Assume we choose A as the primary row source and B as a secondary lookup
// on `xy`. For every row in A, we will produce a lookupBuilderKey on B
// using the join condition. For the A row (x=1,y=2), the lookup key into B
// will be (1,2) to reflect the B-xy index access.
//
// Then we construct a sql.RangeCollection to represent the (1,2) point
// lookup into B-xy. The collection will always be a single range, because
// a point lookup cannot be a disjoint set of ranges. The range will also
// have the same dimension as the index itself. If the join condition is
// a partial prefix on the index (ex: INDEX x (x)), the unfiltered columns
// are padded.
//
// The <=> filter is a special case for two reasons. 1) It is not a point
// lookup, the corresponding range will either be IsNull or IsNotNull
// depending on whether the primary row key column is nil or not,
// respectfully. 2) The format of the output range is variable, while
// equality ranges are identical except for bound values.
//
// Currently the analyzer constructs one of these and uses it for the
// IndexedTableAccess nodes below an indexed join, for example. This struct is
// also used to implement Expressioner on the IndexedTableAccess node.
type LookupBuilder struct {
	index     sql.Index
	keyExprs  []sql.Expression
	keyExprs2 []sql.Expression2
	// When building the lookup, we will use an MySQLIndexBuilder. If the
	// extracted lookup value is NULL, but we have a non-NULL safe
	// comparison, then the lookup should return no values. But if the
	// comparison is NULL-safe, then the lookup should returns indexed
	// values having that value <=> NULL. For each |keyExpr|, this field
	// contains |true| if the lookup should also match NULLs, and |false|
	// otherwise.
	matchesNullMask []bool

	key  lookupBuilderKey
	rang sql.MySQLRange
	cets []sql.ColumnExpressionType

	nullSafe      bool
	isPointLookup bool
	emptyRange    bool
}

func NewLookupBuilder(index sql.Index, keyExprs []sql.Expression, matchesNullMask []bool) *LookupBuilder {
	cets := index.ColumnExpressionTypes()
	var nullSafe = true
	for i := range matchesNullMask {
		if matchesNullMask[i] {
			nullSafe = false
		}
	}
	return &LookupBuilder{
		index:           index,
		keyExprs:        keyExprs,
		matchesNullMask: matchesNullMask,
		cets:            cets,
		nullSafe:        nullSafe,
		isPointLookup:   true,
	}
}

func (lb *LookupBuilder) initializeRange(key lookupBuilderKey) {
	lb.rang = make(sql.MySQLRange, len(lb.cets))
	lb.emptyRange = false
	lb.isPointLookup = len(key) == len(lb.cets)
	var i int
	for i < len(key) {
		if key[i] == nil {
			lb.emptyRange = true
			lb.isPointLookup = false
		}
		if lb.matchesNullMask[i] {
			if key[i] == nil {
				lb.rang[i] = sql.NullRangeColumnExpr(lb.cets[i].Type)

			} else {
				lb.rang[i] = sql.NotNullRangeColumnExpr(lb.cets[i].Type)
			}
		} else {
			lb.rang[i] = sql.ClosedRangeColumnExpr(key[i], key[i], lb.cets[i].Type)
		}
		i++
	}
	for i < len(lb.cets) {
		lb.rang[i] = sql.AllRangeColumnExpr(lb.cets[i].Type)
		lb.isPointLookup = false
		i++
	}
	return
}

func (lb *LookupBuilder) GetLookup(ctx *sql.Context, key lookupBuilderKey) (sql.IndexLookup, error) {
	if lb.rang == nil {
		lb.initializeRange(key)
		return sql.IndexLookup{
			Index:           lb.index,
			Ranges:          sql.MySQLRangeCollection{lb.rang},
			IsPointLookup:   lb.nullSafe && lb.isPointLookup && lb.index.IsUnique(),
			IsEmptyRange:    lb.emptyRange,
			IsSpatialLookup: false,
		}, nil
	}

	lb.emptyRange = false
	lb.isPointLookup = len(key) == len(lb.cets)
	for i := range key {
		if key[i] == nil {
			lb.emptyRange = true
			lb.isPointLookup = false
		}
		if lb.matchesNullMask[i] {
			if key[i] == nil {
				lb.rang[i] = sql.NullRangeColumnExpr(lb.cets[i].Type)
			} else {
				k, _, err := lb.rang[i].Typ.Convert(ctx, key[i])
				if err != nil {
					// TODO: throw warning, and this should truncate for strings
					err = nil
					k = lb.rang[i].Typ.Zero()
				}
				lb.rang[i].LowerBound = sql.Below{Key: k}
				lb.rang[i].UpperBound = sql.Above{Key: k}
			}
		} else {
			k, _, err := lb.rang[i].Typ.Convert(ctx, key[i])
			if err != nil {
				// TODO: throw warning, and this should truncate for strings
				err = nil
				k = lb.rang[i].Typ.Zero()
			}
			lb.rang[i].LowerBound = sql.Below{Key: k}
			lb.rang[i].UpperBound = sql.Above{Key: k}
		}
	}

	return sql.IndexLookup{
		Index:           lb.index,
		Ranges:          sql.MySQLRangeCollection{lb.rang},
		IsPointLookup:   lb.nullSafe && lb.isPointLookup && lb.index.IsUnique(),
		IsEmptyRange:    lb.emptyRange,
		IsSpatialLookup: false,
	}, nil
}

func (lb *LookupBuilder) GetKey(ctx *sql.Context, row sql.Row) (lookupBuilderKey, error) {
	if lb.key == nil {
		lb.key = make([]interface{}, len(lb.keyExprs))
	}
	for i := range lb.keyExprs {
		var err error
		lb.key[i], err = lb.keyExprs[i].Eval(ctx, row)
		if err != nil {
			return nil, err
		}
	}
	return lb.key, nil
}

func (lb *LookupBuilder) GetKey2(ctx *sql.Context, row sql.Row2) (lookupBuilderKey, error) {
	if lb.key == nil {
		lb.key = make([]interface{}, len(lb.keyExprs))
	}
	for i := range lb.keyExprs {
		var err error
		lb.key[i], err = lb.keyExprs2[i].Eval2(ctx, row)
		if err != nil {
			return nil, err
		}
	}
	return lb.key, nil
}

func (lb *LookupBuilder) GetZeroKey() lookupBuilderKey {
	key := make(lookupBuilderKey, len(lb.keyExprs))
	for i, keyExpr := range lb.keyExprs {
		key[i] = keyExpr.Type().Zero()
	}
	return key
}

func (lb *LookupBuilder) Index() sql.Index {
	return lb.index
}

func (lb *LookupBuilder) Expressions() []sql.Expression {
	return lb.keyExprs
}

func (lb *LookupBuilder) DebugString() string {
	keyExprs := make([]string, len(lb.keyExprs))
	for i := range lb.keyExprs {
		keyExprs[i] = sql.DebugString(lb.keyExprs[i])
	}
	return fmt.Sprintf("on %s, using fields %s", formatIndexDecoratorString(lb.Index()), strings.Join(keyExprs, ", "))
}

func (lb *LookupBuilder) WithExpressions(node sql.Node, exprs ...sql.Expression) (*LookupBuilder, error) {
	if len(exprs) != len(lb.keyExprs) {
		return &LookupBuilder{}, sql.ErrInvalidChildrenNumber.New(node, len(exprs), len(lb.keyExprs))
	}
	ret := *lb
	ret.keyExprs = exprs
	return &ret, nil
}
