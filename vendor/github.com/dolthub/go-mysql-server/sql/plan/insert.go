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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// ErrInsertIntoNotSupported is thrown when a table doesn't support inserts
var ErrInsertIntoNotSupported = errors.NewKind("table doesn't support INSERT INTO")
var ErrReplaceIntoNotSupported = errors.NewKind("table doesn't support REPLACE INTO")
var ErrOnDuplicateKeyUpdateNotSupported = errors.NewKind("table doesn't support ON DUPLICATE KEY UPDATE")
var ErrAutoIncrementNotSupported = errors.NewKind("table doesn't support AUTO_INCREMENT")
var ErrInsertIntoUnsupportedValues = errors.NewKind("%T is unsupported for inserts")
var ErrInsertIntoIncompatibleTypes = errors.NewKind("cannot convert type %s to %s")

// cc: https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sql-mode-strict
// The INSERT IGNORE syntax applies to these ignorable errors
// ER_BAD_NULL_ERROR - yes
// ER_DUP_ENTRY - yes
// ER_DUP_ENTRY_WITH_KEY_NAME - Yes
// ER_DUP_KEY - kinda
// ER_NO_PARTITION_FOR_GIVEN_VALUE - yes
// ER_NO_PARTITION_FOR_GIVEN_VALUE_SILENT - No
// ER_NO_REFERENCED_ROW_2 - Yes
// ER_ROW_DOES_NOT_MATCH_GIVEN_PARTITION_SET - No
// ER_ROW_IS_REFERENCED_2 - Yes
// ER_SUBQUERY_NO_1_ROW - yes
// ER_VIEW_CHECK_FAILED - No
var IgnorableErrors = []*errors.Kind{sql.ErrInsertIntoNonNullableProvidedNull,
	sql.ErrPrimaryKeyViolation,
	sql.ErrPartitionNotFound,
	sql.ErrExpectedSingleRow,
	sql.ErrForeignKeyChildViolation,
	sql.ErrForeignKeyParentViolation,
	sql.ErrDuplicateEntry,
	sql.ErrUniqueKeyViolation,
	sql.ErrCheckConstraintViolated,
}

// InsertInto is the top level node for INSERT INTO statements. It has a source for rows and a destination to insert
// them into.
type InsertInto struct {
	db          sql.Database
	Destination sql.Node
	Source      sql.Node
	// DeferredDefaults marks which columns in the destination schema are expected to have default values.
	DeferredDefaults sql.FastIntSet

	ColumnNames []string

	checks     sql.CheckConstraints
	OnDupExprs []sql.Expression
	// Returning is a list of expressions to return after the insert operation. This feature is not supported
	// in MySQL's syntax, but is exposed through PostgreSQL's and MariaDB's syntax.
	Returning []sql.Expression

	// FirstGenerateAutoIncRowIdx is the index of the first row inserted that increments last_insert_id.
	FirstGeneratedAutoIncRowIdx int

	IsReplace bool
	Ignore    bool
	// LiteralValueSource is set to |true| when |Source| is
	// a |Values| node with only literal expressions.
	LiteralValueSource bool
	HasAfterTrigger    bool
}

var _ sql.Databaser = (*InsertInto)(nil)
var _ sql.Node = (*InsertInto)(nil)
var _ sql.Expressioner = (*InsertInto)(nil)
var _ sql.CollationCoercible = (*InsertInto)(nil)
var _ DisjointedChildrenNode = (*InsertInto)(nil)

// NewInsertInto creates an InsertInto node.
func NewInsertInto(db sql.Database, dst, src sql.Node, isReplace bool, cols []string, onDupExprs []sql.Expression, ignore bool) *InsertInto {
	return &InsertInto{
		db:          db,
		Destination: dst,
		Source:      src,
		ColumnNames: cols,
		IsReplace:   isReplace,
		OnDupExprs:  onDupExprs,
		Ignore:      ignore,
	}
}

var _ sql.CheckConstraintNode = (*RenameColumn)(nil)

// Checks implements the sql.CheckConstraintNode interface.
func (ii *InsertInto) Checks() sql.CheckConstraints {
	return ii.checks
}

// WithChecks implements the sql.CheckConstraintNode interface.
func (ii *InsertInto) WithChecks(checks sql.CheckConstraints) sql.Node {
	ret := *ii
	ret.checks = checks
	return &ret
}

// Dispose implements the sql.Disposable interface.
func (ii *InsertInto) Dispose() {
	disposeNode(ii.Source)
}

// Schema implements the sql.Node interface.
// Insert nodes return rows that are inserted. Replaces return a concatenation of the deleted row and the inserted row.
// If no row was deleted, the value of those columns is nil.
func (ii *InsertInto) Schema() sql.Schema {
	if ii.IsReplace {
		return append(ii.Destination.Schema(), ii.Destination.Schema()...)
	}

	// Postgres allows the returned values of the insert statement to be controlled, so if returning expressions
	// were specified, then we return a different schema.
	if ii.Returning != nil {
		// We know that returning exprs are resolved here, because you can't call Schema() safely until Resolved() is true.
		returningSchema := sql.Schema{}
		for _, expr := range ii.Returning {
			returningSchema = append(returningSchema, transform.ExpressionToColumn(expr, ""))
		}

		return returningSchema
	}

	return ii.Destination.Schema()
}

// Children implements the sql.Node interface.
func (ii *InsertInto) Children() []sql.Node {
	// The source node is analyzed completely independently, so we don't include it in children
	return []sql.Node{ii.Destination}
}

// Database implements the sql.Databaser interface.
func (ii *InsertInto) Database() sql.Database {
	return ii.db
}

// IsReadOnly implements the sql.Node interface.
func (ii *InsertInto) IsReadOnly() bool {
	return false
}

// WithDatabase implements the sql.Databaser interface.
func (ii *InsertInto) WithDatabase(database sql.Database) (sql.Node, error) {
	nc := *ii
	nc.db = database
	return &nc, nil
}

func (ii *InsertInto) WithColumnNames(cols []string) *InsertInto {
	nii := *ii
	nii.ColumnNames = cols
	return &nii
}

// WithChildren implements the Node interface.
func (ii *InsertInto) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ii, len(children), 1)
	}

	np := *ii
	np.Destination = children[0]
	return &np, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*InsertInto) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// DisjointedChildren implements the interface DisjointedChildrenNode.
func (ii *InsertInto) DisjointedChildren() [][]sql.Node {
	return [][]sql.Node{
		{ii.Destination},
		{ii.Source},
	}
}

// WithDisjointedChildren implements the interface DisjointedChildrenNode.
func (ii *InsertInto) WithDisjointedChildren(children [][]sql.Node) (sql.Node, error) {
	if len(children) != 2 || len(children[0]) != 1 || len(children[1]) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ii, len(children), 2)
	}
	np := *ii
	np.Destination = children[0][0]
	np.Source = children[1][0]
	return &np, nil
}

// WithSource sets the source node for this insert, which is analyzed separately
func (ii *InsertInto) WithSource(src sql.Node) *InsertInto {
	np := *ii
	np.Source = src
	return &np
}

// WithAutoIncrementIdx sets the auto increment index for this insert operation. This indicates when the LAST_INSERT_ID
// session variable should be updated during insert.
func (ii *InsertInto) WithAutoIncrementIdx(firstGeneratedAutoIncRowIdx int) *InsertInto {
	np := *ii
	np.FirstGeneratedAutoIncRowIdx = firstGeneratedAutoIncRowIdx
	return &np
}

// WithDeferredDefaults sets the flags for the insert destination columns, which mark which of the columns are expected
// to be filled with the DEFAULT or GENERATED value.
func (ii *InsertInto) WithDeferredDefaults(deferredDefaults sql.FastIntSet) *InsertInto {
	np := *ii
	np.DeferredDefaults = deferredDefaults
	return &np
}

// String implements the fmt.Stringer interface.
func (ii *InsertInto) String() string {
	pr := sql.NewTreePrinter()
	if ii.IsReplace {
		_ = pr.WriteNode("Replace(%s)", strings.Join(ii.ColumnNames, ", "))
	} else {
		_ = pr.WriteNode("Insert(%s)", strings.Join(ii.ColumnNames, ", "))
	}
	_ = pr.WriteChildren(ii.Destination.String(), ii.Source.String())
	return pr.String()
}

// DebugString implements the sql.Node interface.
func (ii *InsertInto) DebugString() string {
	pr := sql.NewTreePrinter()
	if ii.IsReplace {
		_ = pr.WriteNode("Replace(%s)", strings.Join(ii.ColumnNames, ", "))
	} else {
		_ = pr.WriteNode("Insert(%s)", strings.Join(ii.ColumnNames, ", "))
	}
	_ = pr.WriteChildren(sql.DebugString(ii.Destination), sql.DebugString(ii.Source))
	return pr.String()
}

// Expressions implements the sql.Expressioner interface.
func (ii *InsertInto) Expressions() []sql.Expression {
	exprs := append(ii.OnDupExprs, ii.checks.ToExpressions()...)
	exprs = append(exprs, ii.Returning...)
	return exprs
}

// WithExpressions implements the sql.Expressioner interface.
func (ii *InsertInto) WithExpressions(newExprs ...sql.Expression) (sql.Node, error) {
	if len(newExprs) != len(ii.OnDupExprs)+len(ii.checks)+len(ii.Returning) {
		return nil, sql.ErrInvalidChildrenNumber.New(ii, len(newExprs), len(ii.OnDupExprs)+len(ii.checks)+len(ii.Returning))
	}

	nii := *ii
	nii.OnDupExprs = newExprs[:len(nii.OnDupExprs)]
	newExprs = newExprs[len(nii.OnDupExprs):]

	var err error
	nii.checks, err = nii.checks.FromExpressions(newExprs[:len(nii.checks)])
	if err != nil {
		return nil, err
	}

	newExprs = newExprs[len(nii.checks):]
	nii.Returning = newExprs

	return &nii, nil
}

// Resolved implements the Resolvable interface.
func (ii *InsertInto) Resolved() bool {
	if !ii.Destination.Resolved() || !ii.Source.Resolved() {
		return false
	}

	for _, checkExpr := range ii.checks {
		if !checkExpr.Expr.Resolved() {
			return false
		}
	}

	return expression.ExpressionsResolved(ii.OnDupExprs...) &&
		expression.ExpressionsResolved(ii.Returning...)
}

// InsertDestination is a wrapper for a table to be used with InsertInto.Destination that allows the schema to be
// overridden. This is useful when the table in question has late-resolving column defaults.
type InsertDestination struct {
	UnaryNode
	DestinationName string
	Sch             sql.Schema
}

var _ sql.Node = (*InsertDestination)(nil)
var _ sql.Nameable = (*InsertDestination)(nil)
var _ sql.Expressioner = (*InsertDestination)(nil)
var _ sql.CollationCoercible = (*InsertDestination)(nil)

func NewInsertDestination(schema sql.Schema, node sql.Node) *InsertDestination {
	nameable := node.(sql.Nameable)
	return &InsertDestination{
		UnaryNode:       UnaryNode{Child: node},
		Sch:             schema,
		DestinationName: nameable.Name(),
	}
}

func (id *InsertDestination) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(id.Sch)
}

func (id InsertDestination) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(id.Sch) {
		return nil, sql.ErrInvalidChildrenNumber.New(id, len(exprs), len(id.Sch))
	}

	sch, err := transform.SchemaWithDefaults(id.Sch, exprs)
	if err != nil {
		return nil, err
	}

	id.Sch = sch
	return &id, nil
}

func (id *InsertDestination) Name() string {
	return id.DestinationName
}

func (id *InsertDestination) IsReadOnly() bool {
	return true
}

func (id *InsertDestination) String() string {
	return id.UnaryNode.Child.String()
}

func (id *InsertDestination) DebugString() string {
	pr := sql.NewTreePrinter()
	pr.WriteNode("InsertDestination")
	var children []string
	for _, col := range id.Sch {
		children = append(children, sql.DebugString(col.Default))
	}
	children = append(children, sql.DebugString(id.Child))

	pr.WriteChildren(children...)

	return pr.String()
}

func (id *InsertDestination) Schema() sql.Schema {
	return id.Sch
}

func (id *InsertDestination) Resolved() bool {
	if !id.UnaryNode.Resolved() {
		return false
	}

	for _, col := range id.Sch {
		if !col.Default.Resolved() {
			return false
		}
	}

	return true
}

func (id InsertDestination) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(id, len(children), 1)
	}

	id.UnaryNode.Child = children[0]
	return &id, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (id *InsertDestination) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, id.Child)
}

func GetInsertable(node sql.Node) (sql.InsertableTable, error) {
	switch node := node.(type) {
	case sql.InsertableTable:
		return node, nil
	case *ResolvedTable:
		return getInsertableTable(node.Table)
	case sql.TableWrapper:
		return getInsertableTable(node.Underlying())
	case *InsertDestination:
		return GetInsertable(node.Child)
	case *PrependNode:
		return GetInsertable(node.Child)
	default:
		return nil, ErrInsertIntoNotSupported.New()
	}
}

func getInsertableTable(t sql.Table) (sql.InsertableTable, error) {
	switch t := t.(type) {
	case sql.InsertableTable:
		return t, nil
	case sql.TableWrapper:
		return getInsertableTable(t.Underlying())
	default:
		return nil, ErrInsertIntoNotSupported.New()
	}
}
