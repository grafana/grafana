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
	"io"
	"sync"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Subquery is as an expression whose value is derived by executing a subquery. It must be executed for every row in
// the outer result set. It's in the plan package instead of the expression package because it functions more like a
// plan Node than an expression.
type Subquery struct {
	// The subquery to execute for each row in the outer result set
	Query sql.Node
	// correlated is a set of the field references in this subquery from out-of-scope
	correlated sql.ColSet
	// Cached hash results, if any
	hashCache sql.KeyValueCache

	// TODO: convert subquery expressions into apply joins
	// TODO: move expression.Eval into an execution package
	// TODO: analyzer rule to connect builder access
	b sql.NodeExecBuilder

	// Dispose function for the cache, if any. This would appear to violate the rule that nodes must be comparable by
	// reflect.DeepEquals, but it's safe in practice because the function is always nil until execution.
	disposeFunc sql.DisposeFunc

	// The original verbatim select statement for this subquery
	QueryString string

	// Cached results, if any
	cache []interface{}
	// Mutex to guard the caches
	cacheMu sync.Mutex
	// Whether results have been cached
	resultsCached bool

	// volatile indicates that the expression contains a non-deterministic function
	volatile bool
}

// NewSubquery returns a new subquery expression.
func NewSubquery(node sql.Node, queryString string) *Subquery {
	return &Subquery{Query: node, QueryString: queryString}
}

var _ sql.NonDeterministicExpression = (*Subquery)(nil)
var _ sql.ExpressionWithNodes = (*Subquery)(nil)
var _ sql.CollationCoercible = (*Subquery)(nil)

type StripRowNode struct {
	UnaryNode
	NumCols int
}

var _ sql.Node = (*StripRowNode)(nil)
var _ sql.CollationCoercible = (*StripRowNode)(nil)

func NewStripRowNode(child sql.Node, numCols int) sql.Node {
	return &StripRowNode{UnaryNode: UnaryNode{child}, NumCols: numCols}
}

// Describe implements the sql.Describable interface
func (srn *StripRowNode) Describe(options sql.DescribeOptions) string {
	return sql.Describe(srn.Child, options)
}

// String implements the fmt.Stringer interface
func (srn *StripRowNode) String() string {
	return srn.Child.String()
}

func (srn *StripRowNode) IsReadOnly() bool {
	return srn.Child.IsReadOnly()
}

// DebugString implements the sql.DebugStringer interface
func (srn *StripRowNode) DebugString() string {
	return sql.DebugString(srn.Child)
}

func (srn *StripRowNode) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(srn, len(children), 1)
	}
	return NewStripRowNode(children[0], srn.NumCols), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (srn *StripRowNode) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, srn.Child)
}

// PrependNode wraps its child by prepending column values onto any result rows
type PrependNode struct {
	UnaryNode
	Row sql.Row
}

var _ sql.Node = (*PrependNode)(nil)
var _ sql.CollationCoercible = (*PrependNode)(nil)

func NewPrependNode(child sql.Node, row sql.Row) sql.Node {
	return &PrependNode{
		UnaryNode: UnaryNode{Child: child},
		Row:       row,
	}
}

func (p *PrependNode) String() string {
	return p.Child.String()
}

func (p *PrependNode) IsReadOnly() bool {
	return p.Child.IsReadOnly()
}

func (p *PrependNode) DebugString() string {
	tp := sql.NewTreePrinter()
	_ = tp.WriteNode("Prepend(%s)", sql.FormatRow(p.Row))
	_ = tp.WriteChildren(sql.DebugString(p.Child))
	return tp.String()
}

func (p *PrependNode) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	return NewPrependNode(children[0], p.Row), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *PrependNode) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, p.Child)
}

// Eval implements the Expression interface.
func (s *Subquery) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	s.cacheMu.Lock()
	cached := s.resultsCached
	s.cacheMu.Unlock()

	if cached {
		if len(s.cache) == 0 {
			return nil, nil
		}
		return s.cache[0], nil
	}

	rows, err := s.evalMultiple(ctx, row)
	if err != nil {
		return nil, err
	}

	if len(rows) > 1 {
		return nil, sql.ErrExpectedSingleRow.New()
	}

	if s.canCacheResults() {
		s.cacheMu.Lock()
		if !s.resultsCached {
			s.cache, s.resultsCached = rows, true
		}
		s.cacheMu.Unlock()
	}

	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}

// PrependRowInPlan returns a transformation function that prepends the row given to any row source in a query
// plan. Any source of rows, as well as any node that alters the schema of its children, will be wrapped so that its
// result rows are prepended with the row given.
func PrependRowInPlan(row sql.Row, lateral bool) func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
	return func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := n.(type) {
		case sql.Table, sql.Projector, *ValueDerivedTable, *TableCountLookup, sql.TableFunction:
			return NewPrependNode(n, row), transform.NewTree, nil
		case *SetOp:
			newSetOp := *n
			newRight, _, err := transform.Node(n.Right(), PrependRowInPlan(row, lateral))
			if err != nil {
				return n, transform.SameTree, err
			}
			newLeft, _, err := transform.Node(n.Left(), PrependRowInPlan(row, lateral))
			if err != nil {
				return n, transform.SameTree, err
			}
			newSetOp.left = newLeft
			newSetOp.right = newRight
			return &newSetOp, transform.NewTree, nil
		case *RecursiveCte:
			newRecursiveCte := *n
			newUnion, _, err := transform.Node(n.union, PrependRowInPlan(row, lateral))
			newRecursiveCte.union = newUnion.(*SetOp)
			return &newRecursiveCte, transform.NewTree, err
		case *SubqueryAlias:
			// For SubqueryAliases (i.e. DerivedTables), since they may have visibility to outer scopes, we need to
			// transform their inner nodes to prepend the outer scope row data. Ideally, we would only do this when
			// the subquery alias references those outer fields. That will also require updating subquery expression
			// scope handling to also make the same optimization.
			if n.OuterScopeVisibility || lateral {
				newSubqueryAlias := *n
				newChildNode, _, err := transform.Node(n.Child, PrependRowInPlan(row, lateral))
				newSubqueryAlias.Child = newChildNode
				return &newSubqueryAlias, transform.NewTree, err
			} else {
				return NewPrependNode(n, row), transform.NewTree, nil
			}
		}

		return n, transform.SameTree, nil
	}
}

func NewMax1Row(n sql.Node, name string) *Max1Row {
	return &Max1Row{Child: n, name: name, Mu: &sync.Mutex{}}
}

// Max1Row throws a runtime error if its child (usually subquery) tries
// to return more than one row.
type Max1Row struct {
	Child       sql.Node
	Mu          *sync.Mutex
	name        string
	Result      sql.Row
	EmptyResult bool
}

var _ sql.Node = (*Max1Row)(nil)
var _ sql.CollationCoercible = (*Max1Row)(nil)
var _ sql.NameableNode = (*Max1Row)(nil)
var _ sql.RenameableNode = (*Max1Row)(nil)

func (m *Max1Row) WithName(s string) sql.Node {
	ret := *m
	ret.name = s
	return &ret
}

func (m *Max1Row) Name() string {
	return m.name
}

func (m *Max1Row) IsReadOnly() bool {
	return m.Child.IsReadOnly()
}

func (m *Max1Row) Resolved() bool {
	return m.Child.Resolved()
}

func (m *Max1Row) Schema() sql.Schema {
	return m.Child.Schema()
}

func (m *Max1Row) Children() []sql.Node {
	return []sql.Node{m.Child}
}

func (m *Max1Row) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Max1Row")
	children := []string{m.Child.String()}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (m *Max1Row) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Max1Row")
	children := []string{sql.DebugString(m.Child)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// HasResults returns true after a successful call to PopulateResults()
func (m *Max1Row) HasResults() bool {
	return m.Result != nil || m.EmptyResult
}

func (m *Max1Row) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(m, len(children), 1)
	}
	ret := *m

	ret.Child = children[0]

	return &ret, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (m *Max1Row) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, m.Child)
}

// EvalMultiple returns all rows returned by a subquery.
func (s *Subquery) EvalMultiple(ctx *sql.Context, row sql.Row) ([]any, error) {
	s.cacheMu.Lock()
	cached := s.resultsCached
	s.cacheMu.Unlock()
	if cached {
		return s.cache, nil
	}

	result, err := s.evalMultiple(ctx, row)
	if err != nil {
		return nil, err
	}

	if s.canCacheResults() {
		s.cacheMu.Lock()
		if s.resultsCached == false {
			s.cache, s.resultsCached = result, true
		}
		s.cacheMu.Unlock()
	}

	return result, nil
}

func (s *Subquery) canCacheResults() bool {
	return s.correlated.Empty() && !s.volatile
}

func (s *Subquery) evalMultiple(ctx *sql.Context, row sql.Row) ([]any, error) {
	// Any source of rows, as well as any node that alters the schema of its children, needs to be wrapped so that its
	// result rows are prepended with the scope row.
	q, _, err := transform.Node(s.Query, PrependRowInPlan(row, false))
	if err != nil {
		return nil, err
	}

	if s.b == nil {
		return nil, fmt.Errorf("attempted to evaluate uninitialized subquery")
	}

	iter, err := s.b.Build(ctx, q, row)
	if err != nil {
		return nil, err
	}

	returnsTuple := len(s.Query.Schema()) > 1

	// Reduce the result row to the size of the expected schema. This means chopping off the first len(row) columns.
	col := len(row)
	var result []any
	for {
		row, err := iter.Next(ctx)
		if err == io.EOF {
			break
		}

		if err != nil {
			return nil, err
		}

		if returnsTuple {
			result = append(result, append([]interface{}{}, row[col:]...))
		} else {
			result = append(result, row[col])
		}
	}

	if err := iter.Close(ctx); err != nil {
		return nil, err
	}

	return result, nil
}

// HashMultiple returns all rows returned by a subquery, backed by a sql.KeyValueCache. Keys are constructed using the
// 64-bit hash of the values stored.
func (s *Subquery) HashMultiple(ctx *sql.Context, row sql.Row) (sql.KeyValueCache, error) {
	s.cacheMu.Lock()
	cached := s.resultsCached && s.hashCache != nil
	s.cacheMu.Unlock()
	if cached {
		return s.hashCache, nil
	}

	result, err := s.evalMultiple(ctx, row)
	if err != nil {
		return nil, err
	}

	if s.canCacheResults() {
		s.cacheMu.Lock()
		defer s.cacheMu.Unlock()
		if !s.resultsCached || s.hashCache == nil {
			hashCache, disposeFn := ctx.Memory.NewHistoryCache()
			err = putAllRows(ctx, hashCache, s.Query.Schema(), result)
			if err != nil {
				return nil, err
			}
			s.cache, s.hashCache, s.disposeFunc, s.resultsCached = result, hashCache, disposeFn, true
		}
		return s.hashCache, nil
	}

	cache := sql.NewMapCache()
	err = putAllRows(ctx, cache, s.Query.Schema(), result)
	if err != nil {
		return nil, err
	}
	return cache, nil
}

// HasResultRow returns whether the subquery has a result set > 0.
func (s *Subquery) HasResultRow(ctx *sql.Context, row sql.Row) (bool, error) {
	// First check if the query was cached.
	s.cacheMu.Lock()
	cached := s.resultsCached
	s.cacheMu.Unlock()

	if cached {
		return len(s.cache) > 0, nil
	}

	// Any source of rows, as well as any node that alters the schema of its children, needs to be wrapped so that its
	// result rows are prepended with the scope row.
	q, _, err := transform.Node(s.Query, PrependRowInPlan(row, false))
	if err != nil {
		return false, err
	}

	if s.b == nil {
		return false, fmt.Errorf("attempted to evaluate uninitialized subquery")
	}

	iter, err := s.b.Build(ctx, q, row)
	if err != nil {
		return false, err
	}

	// Call the iterator once and see if it has a row. If io.EOF is received return false.
	_, err = iter.Next(ctx)
	if err == io.EOF {
		err = iter.Close(ctx)
		return false, err
	} else if err != nil {
		return false, err
	}

	err = iter.Close(ctx)
	if err != nil {
		return false, err
	}

	return true, nil
}

// normalizeValue returns a canonical version of a value for use in a sql.KeyValueCache.
// Two values that compare equal should have the same canonical version.
func normalizeForKeyValueCache(ctx *sql.Context, val interface{}) (interface{}, error) {
	val, err := sql.UnwrapAny(ctx, val)
	if err != nil {
		return nil, err
	}
	return val, nil
}

func putAllRows(ctx *sql.Context, cache sql.KeyValueCache, sch sql.Schema, vals []interface{}) error {
	for _, val := range vals {
		normVal, err := normalizeForKeyValueCache(ctx, val)
		if err != nil {
			return err
		}
		rowKey, err := hash.HashOf(ctx, sch, sql.NewRow(normVal))
		if err != nil {
			return err
		}
		err = cache.Put(rowKey, normVal)
		if err != nil {
			return err
		}
	}
	return nil
}

// IsNullable implements the Expression interface.
func (s *Subquery) IsNullable() bool {
	return true
}

// Describe implements the sql.Describable interface
func (s *Subquery) Describe(options sql.DescribeOptions) string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Subquery")
	var children []string
	if options.Debug {
		children = []string{
			fmt.Sprintf("cacheable: %t", s.canCacheResults()),
			fmt.Sprintf("alias-string: %s", s.QueryString),
			sql.Describe(s.Query, options),
		}
	} else {
		children = []string{
			fmt.Sprintf("cacheable: %t", s.canCacheResults()),
			sql.Describe(s.Query, options),
		}
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s *Subquery) String() string {
	return fmt.Sprintf("Subquery(%s)", s.QueryString)
}

func (s *Subquery) DebugString() string {
	return s.Describe(sql.DescribeOptions{
		Debug: true,
	})
}

// Resolved implements the Expression interface.
func (s *Subquery) Resolved() bool {
	return s.Query.Resolved()
}

// Type implements the Expression interface.
func (s *Subquery) Type() sql.Type {
	qs := s.Query.Schema()
	if len(qs) == 1 {
		return s.Query.Schema()[0].Type
	}
	ts := make([]sql.Type, len(qs))
	for i, c := range qs {
		ts[i] = c.Type
	}
	return types.CreateTuple(ts...)
}

// WithChildren implements the Expression interface.
func (s *Subquery) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}
	return s, nil
}

// Children implements the Expression interface.
func (s *Subquery) Children() []sql.Expression {
	return nil
}

// NodeChildren implements the sql.ExpressionWithNodes interface.
func (s *Subquery) NodeChildren() []sql.Node {
	return []sql.Node{s.Query}
}

// WithNodeChildren implements the sql.ExpressionWithNodes interface.
func (s *Subquery) WithNodeChildren(children ...sql.Node) (sql.ExpressionWithNodes, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return s.WithQuery(children[0]), nil
}

// WithQuery returns the subquery with the query node changed.
func (s *Subquery) WithQuery(node sql.Node) *Subquery {
	ns := *s
	ns.Query = node
	return &ns
}

// WithExecBuilder returns the subquery with a recursive execution builder.
func (s *Subquery) WithExecBuilder(b sql.NodeExecBuilder) *Subquery {
	ns := *s
	ns.b = b
	return &ns
}

func (s *Subquery) IsNonDeterministic() bool {
	return !s.canCacheResults()
}

func (s *Subquery) Volatile() bool {
	return s.volatile
}

func (s *Subquery) WithVolatile() *Subquery {
	ret := *s
	ret.volatile = true
	return &ret
}

func (s *Subquery) WithCorrelated(cols sql.ColSet) *Subquery {
	ret := *s
	ret.correlated = cols
	return &ret
}

func (s *Subquery) Correlated() sql.ColSet {
	return s.correlated
}

func (s *Subquery) CanCacheResults() bool {
	return s.canCacheResults()
}

// Dispose implements sql.Disposable
func (s *Subquery) Dispose() {
	if s.disposeFunc != nil {
		s.disposeFunc()
		s.disposeFunc = nil
	}
	disposeNode(s.Query)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *Subquery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, s.Query)
}
