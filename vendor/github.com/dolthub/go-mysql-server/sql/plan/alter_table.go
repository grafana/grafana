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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type RenameTable struct {
	ddlNode
	OldNames    []string
	NewNames    []string
	alterTblDef bool
}

var _ sql.Node = (*RenameTable)(nil)
var _ sql.Databaser = (*RenameTable)(nil)
var _ sql.CollationCoercible = (*RenameTable)(nil)

// NewRenameTable creates a new RenameTable node
func NewRenameTable(db sql.Database, oldNames, newNames []string, alterTbl bool) *RenameTable {
	return &RenameTable{
		ddlNode:     ddlNode{db},
		OldNames:    oldNames,
		NewNames:    newNames,
		alterTblDef: alterTbl,
	}
}

func (r *RenameTable) WithDatabase(db sql.Database) (sql.Node, error) {
	nr := *r
	nr.Db = db
	return &nr, nil
}

func (r *RenameTable) String() string {
	return fmt.Sprintf("Rename table %s to %s", r.OldNames, r.NewNames)
}

func (r *RenameTable) IsReadOnly() bool {
	return false
}

func (r *RenameTable) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	renamer, _ := r.Db.(sql.TableRenamer)
	viewDb, _ := r.Db.(sql.ViewDatabase)
	viewRegistry := ctx.GetViewRegistry()

	for i, oldName := range r.OldNames {
		if tbl, exists := r.tableExists(ctx, oldName); exists {
			err := r.renameTable(ctx, renamer, tbl, oldName, r.NewNames[i])
			if err != nil {
				return nil, err
			}
		} else {
			success, err := r.renameView(ctx, viewDb, viewRegistry, oldName, r.NewNames[i])
			if err != nil {
				return nil, err
			} else if !success {
				return nil, sql.ErrTableNotFound.New(oldName)
			}
		}
	}

	return sql.RowsToRowIter(sql.NewRow(types.NewOkResult(0))), nil
}

func (r *RenameTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(r, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RenameTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (r *RenameTable) tableExists(ctx *sql.Context, name string) (sql.Table, bool) {
	tbl, ok, err := r.Db.GetTableInsensitive(ctx, name)
	if err != nil || !ok {
		return nil, false
	}
	return tbl, true
}

func (r *RenameTable) renameTable(ctx *sql.Context, renamer sql.TableRenamer, tbl sql.Table, oldName, newName string) error {
	if renamer == nil {
		return sql.ErrRenameTableNotSupported.New(r.Db.Name())
	}

	if fkTable, ok := tbl.(sql.ForeignKeyTable); ok {
		parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
		if err != nil {
			return err
		}
		for _, parentFk := range parentFks {
			//TODO: support renaming tables across databases for foreign keys
			if strings.ToLower(parentFk.Database) != strings.ToLower(parentFk.ParentDatabase) {
				return fmt.Errorf("updating foreign key table names across databases is not yet supported")
			}
			parentFk.ParentTable = newName
			childTbl, ok, err := r.Db.GetTableInsensitive(ctx, parentFk.Table)
			if err != nil {
				return err
			}
			if !ok {
				return sql.ErrTableNotFound.New(parentFk.Table)
			}
			childFkTbl, ok := childTbl.(sql.ForeignKeyTable)
			if !ok {
				return fmt.Errorf("referenced table `%s` supports foreign keys but declaring table `%s` does not", parentFk.ParentTable, parentFk.Table)
			}
			err = childFkTbl.UpdateForeignKey(ctx, parentFk.Name, parentFk)
			if err != nil {
				return err
			}
		}

		fks, err := fkTable.GetDeclaredForeignKeys(ctx)
		if err != nil {
			return err
		}
		for _, fk := range fks {
			fk.Table = newName
			oldKeyName := fk.Name
			// If the FK was auto named, update it to the new table name
			autonamedPrefix := fmt.Sprintf("%s_ibfk_", oldName)
			if strings.HasPrefix(fk.Name, autonamedPrefix) && len(fk.Name) > len(autonamedPrefix) {
				fk.Name = fmt.Sprintf("%s_ibfk_%s", newName, fk.Name[len(autonamedPrefix):])
			}
			err = fkTable.UpdateForeignKey(ctx, oldKeyName, fk)
			if err != nil {
				return err
			}
		}
	}

	err := renamer.RenameTable(ctx, oldName, newName)
	if err != nil {
		return err
	}

	return nil
}

func (r *RenameTable) renameView(ctx *sql.Context, viewDb sql.ViewDatabase, vr *sql.ViewRegistry, oldName, newName string) (bool, error) {
	if viewDb != nil {
		oldView, exists, err := viewDb.GetViewDefinition(ctx, oldName)
		if err != nil {
			return false, err
		} else if !exists {
			return false, nil
		}

		if r.alterTblDef {
			return false, sql.ErrExpectedTableFoundView.New(fmt.Sprintf("'%s.%s'", r.Db.Name(), oldName))
		}

		err = viewDb.DropView(ctx, oldName)
		if err != nil {
			return false, err
		}

		err = viewDb.CreateView(ctx, newName, oldView.TextDefinition, oldView.CreateViewStatement)
		if err != nil {
			return false, err
		}

		return true, nil
	} else {
		view, exists := vr.View(r.Db.Name(), oldName)
		if !exists {
			return false, nil
		}

		if r.alterTblDef {
			return false, sql.ErrExpectedTableFoundView.New(fmt.Sprintf("'%s.%s'", r.Db.Name(), oldName))
		}

		err := vr.Delete(r.Db.Name(), oldName)
		if err != nil {
			return false, nil
		}
		err = vr.Register(r.Db.Name(), sql.NewView(newName, view.Definition(), view.TextDefinition(), view.CreateStatement()))
		if err != nil {
			return false, nil
		}
		return true, nil
	}
}

type AddColumn struct {
	ddlNode
	Table     sql.Node
	column    *sql.Column
	order     *sql.ColumnOrder
	targetSch sql.Schema
}

var _ sql.Node = (*AddColumn)(nil)
var _ sql.Expressioner = (*AddColumn)(nil)
var _ sql.SchemaTarget = (*AddColumn)(nil)
var _ sql.CollationCoercible = (*AddColumn)(nil)

func (a *AddColumn) DebugString() string {
	pr := sql.NewTreePrinter()
	pr.WriteNode("add column %s to %s", a.column.Name, a.Table)

	var children []string
	children = append(children, sql.DebugString(a.column))
	for _, col := range a.targetSch {
		children = append(children, sql.DebugString(col))
	}

	pr.WriteChildren(children...)
	return pr.String()
}

func NewAddColumnResolved(table *ResolvedTable, column sql.Column, order *sql.ColumnOrder) *AddColumn {
	column.Source = table.Name()
	return &AddColumn{
		ddlNode: ddlNode{Db: table.SqlDatabase},
		Table:   table,
		column:  &column,
		order:   order,
	}
}

func NewAddColumn(database sql.Database, table *UnresolvedTable, column *sql.Column, order *sql.ColumnOrder) *AddColumn {
	column.Source = table.name
	return &AddColumn{
		ddlNode: ddlNode{Db: database},
		Table:   table,
		column:  column,
		order:   order,
	}
}

func (a *AddColumn) Column() *sql.Column {
	return a.column
}

func (a *AddColumn) Order() *sql.ColumnOrder {
	return a.order
}

func (a *AddColumn) IsReadOnly() bool {
	return false
}

func (a *AddColumn) WithDatabase(db sql.Database) (sql.Node, error) {
	na := *a
	na.Db = db
	return &na, nil
}

// Schema implements the sql.Node interface.
func (a *AddColumn) Schema() sql.Schema {
	return types.OkResultSchema
}

func (a *AddColumn) String() string {
	return fmt.Sprintf("add column %s", a.column.Name)
}

func (a *AddColumn) Expressions() []sql.Expression {
	return append(transform.WrappedColumnDefaults(a.targetSch), transform.WrappedColumnDefaults(sql.Schema{a.column})...)
}

func (a AddColumn) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1+len(a.targetSch) {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(exprs), 1+len(a.targetSch))
	}

	sch, err := transform.SchemaWithDefaults(a.targetSch, exprs[:len(a.targetSch)])
	if err != nil {
		return nil, err
	}

	a.targetSch = sch

	colSchema := sql.Schema{a.column}
	colSchema, err = transform.SchemaWithDefaults(colSchema, exprs[len(exprs)-1:])
	if err != nil {
		return nil, err
	}

	// *sql.Column is a reference type, make a copy before we modify it so we don't affect the original node
	a.column = colSchema[0]
	return &a, nil
}

// Resolved implements the Resolvable interface.
func (a *AddColumn) Resolved() bool {
	return a.ddlNode.Resolved() && a.Table.Resolved() && a.column.Default.Resolved() && a.targetSch.Resolved()
}

// WithTargetSchema implements sql.SchemaTarget
func (a AddColumn) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	a.targetSch = schema
	return &a, nil
}

func (a *AddColumn) TargetSchema() sql.Schema {
	return a.targetSch
}

func (a *AddColumn) ValidateDefaultPosition(tblSch sql.Schema) error {
	colsAfterThis := map[string]*sql.Column{a.column.Name: a.column}
	if a.order != nil {
		if a.order.First {
			for i := 0; i < len(tblSch); i++ {
				colsAfterThis[tblSch[i].Name] = tblSch[i]
			}
		} else {
			i := 1
			for ; i < len(tblSch); i++ {
				if tblSch[i-1].Name == a.order.AfterColumn {
					break
				}
			}
			for ; i < len(tblSch); i++ {
				colsAfterThis[tblSch[i].Name] = tblSch[i]
			}
		}
	}

	err := inspectDefaultForInvalidColumns(a.column, colsAfterThis)
	if err != nil {
		return err
	}

	return nil
}

func inspectDefaultForInvalidColumns(col *sql.Column, columnsAfterThis map[string]*sql.Column) error {
	if col.Default == nil {
		return nil
	}
	var err error
	sql.Inspect(col.Default, func(expr sql.Expression) bool {
		switch expr := expr.(type) {
		case *expression.GetField:
			if col, ok := columnsAfterThis[expr.Name()]; ok && col.Default != nil && !col.Default.IsLiteral() {
				err = sql.ErrInvalidDefaultValueOrder.New(col.Name)
				return false
			}
		}
		return true
	})
	return err
}

func (a AddColumn) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}
	a.Table = children[0]
	return &a, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AddColumn) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (a *AddColumn) Children() []sql.Node {
	return []sql.Node{a.Table}
}

// colDefault expression evaluates the column default for a row being inserted, correctly handling zero values and
// nulls
type ColDefaultExpression struct {
	Column *sql.Column
}

var _ sql.Expression = ColDefaultExpression{}
var _ sql.CollationCoercible = ColDefaultExpression{}

func (c ColDefaultExpression) Resolved() bool   { return true }
func (c ColDefaultExpression) String() string   { return "" }
func (c ColDefaultExpression) Type() sql.Type   { return c.Column.Type }
func (c ColDefaultExpression) IsNullable() bool { return c.Column.Default == nil }
func (c ColDefaultExpression) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if c.Column != nil && c.Column.Default != nil {
		return c.Column.Default.CollationCoercibility(ctx)
	}
	return sql.Collation_binary, 6
}

func (c ColDefaultExpression) Children() []sql.Expression {
	panic("ColDefaultExpression is only meant for immediate evaluation and should never be modified")
}

func (c ColDefaultExpression) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	panic("ColDefaultExpression is only meant for immediate evaluation and should never be modified")
}

func (c ColDefaultExpression) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	columnDefaultExpr := c.Column.Default
	if columnDefaultExpr == nil {
		columnDefaultExpr = c.Column.Generated
	}

	if columnDefaultExpr == nil && !c.Column.Nullable {
		val := c.Column.Type.Zero()
		ret, _, err := c.Column.Type.Convert(ctx, val)
		return ret, err
	} else if columnDefaultExpr != nil {
		val, err := columnDefaultExpr.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		ret, _, err := c.Column.Type.Convert(ctx, val)
		return ret, err
	}

	return nil, nil
}

type DropColumn struct {
	ddlNode
	Table        sql.Node
	Column       string
	checks       sql.CheckConstraints
	targetSchema sql.Schema
}

var _ sql.Node = (*DropColumn)(nil)
var _ sql.Databaser = (*DropColumn)(nil)
var _ sql.SchemaTarget = (*DropColumn)(nil)
var _ sql.CheckConstraintNode = (*DropColumn)(nil)
var _ sql.CollationCoercible = (*DropColumn)(nil)

func NewDropColumnResolved(table *ResolvedTable, column string) *DropColumn {
	return &DropColumn{
		ddlNode: ddlNode{Db: table.SqlDatabase},
		Table:   table,
		Column:  column,
	}
}

func NewDropColumn(database sql.Database, table *UnresolvedTable, column string) *DropColumn {
	return &DropColumn{
		ddlNode: ddlNode{Db: database},
		Table:   table,
		Column:  column,
	}
}

func (d *DropColumn) Checks() sql.CheckConstraints {
	return d.checks
}

func (d *DropColumn) WithChecks(checks sql.CheckConstraints) sql.Node {
	ret := *d
	ret.checks = checks
	return &ret
}

func (d *DropColumn) WithDatabase(db sql.Database) (sql.Node, error) {
	nd := *d
	nd.Db = db
	return &nd, nil
}

func (d *DropColumn) String() string {
	return fmt.Sprintf("drop column %s", d.Column)
}

func (d *DropColumn) IsReadOnly() bool {
	return false
}

// Validate returns an error if this drop column operation is invalid (because it would invalidate a column default
// or other constraint).
// TODO: move this check to analyzer
func (d *DropColumn) Validate(ctx *sql.Context, tbl sql.Table) error {
	colIdx := d.targetSchema.IndexOfColName(d.Column)
	if colIdx == -1 {
		return sql.ErrTableColumnNotFound.New(tbl.Name(), d.Column)
	}

	for _, col := range d.targetSchema {
		if col.Default == nil {
			continue
		}
		var err error
		sql.Inspect(col.Default, func(expr sql.Expression) bool {
			switch expr := expr.(type) {
			case *expression.GetField:
				if expr.Name() == d.Column {
					err = sql.ErrDropColumnReferencedInDefault.New(d.Column, expr.Name())
					return false
				}
			}
			return true
		})
		if err != nil {
			return err
		}
	}

	if fkTable, ok := tbl.(sql.ForeignKeyTable); ok {
		lowercaseColumn := strings.ToLower(d.Column)
		fks, err := fkTable.GetDeclaredForeignKeys(ctx)
		if err != nil {
			return err
		}
		for _, fk := range fks {
			for _, fkCol := range fk.Columns {
				if lowercaseColumn == strings.ToLower(fkCol) {
					return sql.ErrForeignKeyDropColumn.New(d.Column, fk.Name)
				}
			}
		}
		parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
		if err != nil {
			return err
		}
		for _, parentFk := range parentFks {
			for _, parentFkCol := range parentFk.Columns {
				if lowercaseColumn == strings.ToLower(parentFkCol) {
					return sql.ErrForeignKeyDropColumn.New(d.Column, parentFk.Name)
				}
			}
		}
	}

	return nil
}

func (d *DropColumn) Schema() sql.Schema {
	return types.OkResultSchema
}

func (d *DropColumn) Resolved() bool {
	return d.Table.Resolved() && d.ddlNode.Resolved() && d.targetSchema.Resolved()
}

func (d *DropColumn) Children() []sql.Node {
	return []sql.Node{d.Table}
}

func (d DropColumn) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}
	d.Table = children[0]
	return &d, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropColumn) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (d DropColumn) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	d.targetSchema = schema
	return &d, nil
}

func (d *DropColumn) TargetSchema() sql.Schema {
	return d.targetSchema
}

func (d *DropColumn) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(d.targetSchema)
}

func (d DropColumn) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(d.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(exprs), len(d.targetSchema))
	}

	sch, err := transform.SchemaWithDefaults(d.targetSchema, exprs)
	if err != nil {
		return nil, err
	}
	d.targetSchema = sch

	return &d, nil
}

type RenameColumn struct {
	ddlNode
	Table         sql.Node
	ColumnName    string
	NewColumnName string
	checks        sql.CheckConstraints
	targetSchema  sql.Schema
}

var _ sql.Node = (*RenameColumn)(nil)
var _ sql.Databaser = (*RenameColumn)(nil)
var _ sql.SchemaTarget = (*RenameColumn)(nil)
var _ sql.CheckConstraintNode = (*RenameColumn)(nil)
var _ sql.CollationCoercible = (*RenameColumn)(nil)

func NewRenameColumnResolved(table *ResolvedTable, columnName string, newColumnName string) *RenameColumn {
	return &RenameColumn{
		ddlNode:       ddlNode{Db: table.SqlDatabase},
		Table:         table,
		ColumnName:    columnName,
		NewColumnName: newColumnName,
	}
}

func NewRenameColumn(database sql.Database, table *UnresolvedTable, columnName string, newColumnName string) *RenameColumn {
	return &RenameColumn{
		ddlNode:       ddlNode{Db: database},
		Table:         table,
		ColumnName:    columnName,
		NewColumnName: newColumnName,
	}
}

func (r *RenameColumn) Checks() sql.CheckConstraints {
	return r.checks
}

func (r *RenameColumn) WithChecks(checks sql.CheckConstraints) sql.Node {
	ret := *r
	ret.checks = checks
	return &ret
}

func (r *RenameColumn) WithDatabase(db sql.Database) (sql.Node, error) {
	nr := *r
	nr.Db = db
	return &nr, nil
}

func (r RenameColumn) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	r.targetSchema = schema
	return &r, nil
}

func (r *RenameColumn) TargetSchema() sql.Schema {
	return r.targetSchema
}

func (r *RenameColumn) String() string {
	return fmt.Sprintf("rename column %s to %s", r.ColumnName, r.NewColumnName)
}

func (r *RenameColumn) IsReadOnly() bool {
	return false
}

func (r *RenameColumn) DebugString() string {
	pr := sql.NewTreePrinter()
	pr.WriteNode("rename column %s to %s", r.ColumnName, r.NewColumnName)

	var children []string
	for _, col := range r.targetSchema {
		children = append(children, sql.DebugString(col))
	}

	pr.WriteChildren(children...)
	return pr.String()
}

func (r *RenameColumn) Resolved() bool {
	return r.Table.Resolved() && r.ddlNode.Resolved() && r.targetSchema.Resolved()
}

func (r *RenameColumn) Schema() sql.Schema {
	return types.OkResultSchema
}

func (r *RenameColumn) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(r.targetSchema)
}

func (r RenameColumn) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(r.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(exprs), len(r.targetSchema))
	}

	sch, err := transform.SchemaWithDefaults(r.targetSchema, exprs)
	if err != nil {
		return nil, err
	}

	r.targetSchema = sch
	return &r, nil
}

func (r *RenameColumn) Children() []sql.Node {
	return []sql.Node{r.Table}
}

func (r RenameColumn) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 1)
	}
	r.Table = children[0]
	return &r, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RenameColumn) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

type ModifyColumn struct {
	ddlNode
	Table        sql.Node
	columnName   string
	column       *sql.Column
	order        *sql.ColumnOrder
	targetSchema sql.Schema
}

var _ sql.Node = (*ModifyColumn)(nil)
var _ sql.Expressioner = (*ModifyColumn)(nil)
var _ sql.Databaser = (*ModifyColumn)(nil)
var _ sql.SchemaTarget = (*ModifyColumn)(nil)
var _ sql.CollationCoercible = (*ModifyColumn)(nil)

func NewModifyColumnResolved(table *ResolvedTable, columnName string, column sql.Column, order *sql.ColumnOrder) *ModifyColumn {
	column.Source = table.Name()
	return &ModifyColumn{
		ddlNode:    ddlNode{Db: table.SqlDatabase},
		Table:      table,
		columnName: columnName,
		column:     &column,
		order:      order,
	}
}

func NewModifyColumn(database sql.Database, table *UnresolvedTable, columnName string, column *sql.Column, order *sql.ColumnOrder) *ModifyColumn {
	column.Source = table.name
	return &ModifyColumn{
		ddlNode:    ddlNode{Db: database},
		Table:      table,
		columnName: columnName,
		column:     column,
		order:      order,
	}
}

func (m *ModifyColumn) WithDatabase(db sql.Database) (sql.Node, error) {
	nm := *m
	nm.Db = db
	return &nm, nil
}

func (m *ModifyColumn) Column() string {
	return m.columnName
}

func (m *ModifyColumn) NewColumn() *sql.Column {
	return m.column
}

func (m *ModifyColumn) Order() *sql.ColumnOrder {
	return m.order
}

// Schema implements the sql.Node interface.
func (m *ModifyColumn) Schema() sql.Schema {
	return types.OkResultSchema
}

func (m *ModifyColumn) String() string {
	return fmt.Sprintf("modify column %s", m.column.Name)
}

func (m *ModifyColumn) IsReadOnly() bool {
	return false
}

func (m *ModifyColumn) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	nm := *m
	nm.targetSchema = schema
	return &nm, nil
}

func (m *ModifyColumn) TargetSchema() sql.Schema {
	return m.targetSchema
}

func (m *ModifyColumn) Children() []sql.Node {
	return []sql.Node{m.Table}
}

func (m *ModifyColumn) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(m, len(children), 1)
	}
	nm := *m
	nm.Table = children[0]
	return &nm, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ModifyColumn) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (m *ModifyColumn) Expressions() []sql.Expression {
	return append(transform.WrappedColumnDefaults(m.targetSchema), expression.WrapExpressions(m.column.Default)...)
}

func (m *ModifyColumn) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1+len(m.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(m, len(exprs), 1+len(m.targetSchema))
	}

	nm := *m
	sch, err := transform.SchemaWithDefaults(nm.targetSchema, exprs[:len(nm.targetSchema)])
	if err != nil {
		return nil, err
	}
	nm.targetSchema = sch

	unwrappedColDefVal, ok := exprs[len(exprs)-1].(*expression.Wrapper).Unwrap().(*sql.ColumnDefaultValue)
	if ok {
		nm.column.Default = unwrappedColDefVal
	} else { // nil fails type check
		nm.column.Default = nil
	}
	return &nm, nil
}

// Resolved implements the Resolvable interface.
func (m *ModifyColumn) Resolved() bool {
	return m.Table.Resolved() && m.column.Default.Resolved() && m.ddlNode.Resolved() && m.targetSchema.Resolved()
}

func (m *ModifyColumn) ValidateDefaultPosition(tblSch sql.Schema) error {
	colsBeforeThis := make(map[string]*sql.Column)
	colsAfterThis := make(map[string]*sql.Column) // includes the modified column
	if m.order == nil {
		i := 0
		for ; i < len(tblSch); i++ {
			if tblSch[i].Name == m.column.Name {
				colsAfterThis[m.column.Name] = m.column
				break
			}
			colsBeforeThis[tblSch[i].Name] = tblSch[i]
		}
		for ; i < len(tblSch); i++ {
			colsAfterThis[tblSch[i].Name] = tblSch[i]
		}
	} else if m.order.First {
		for i := 0; i < len(tblSch); i++ {
			colsAfterThis[tblSch[i].Name] = tblSch[i]
		}
	} else {
		i := 1
		for ; i < len(tblSch); i++ {
			colsBeforeThis[tblSch[i].Name] = tblSch[i]
			if tblSch[i-1].Name == m.order.AfterColumn {
				break
			}
		}
		for ; i < len(tblSch); i++ {
			colsAfterThis[tblSch[i].Name] = tblSch[i]
		}
		delete(colsBeforeThis, m.column.Name)
		colsAfterThis[m.column.Name] = m.column
	}

	err := inspectDefaultForInvalidColumns(m.column, colsAfterThis)
	if err != nil {
		return err
	}
	thisCol := map[string]*sql.Column{m.column.Name: m.column}
	for _, colBefore := range colsBeforeThis {
		err = inspectDefaultForInvalidColumns(colBefore, thisCol)
		if err != nil {
			return err
		}
	}

	return nil
}

type AlterTableCollation struct {
	ddlNode
	Table     sql.Node
	Collation sql.CollationID
}

var _ sql.Node = (*AlterTableCollation)(nil)
var _ sql.Databaser = (*AlterTableCollation)(nil)

// NewAlterTableCollationResolved returns a new *AlterTableCollation
func NewAlterTableCollationResolved(table *ResolvedTable, collation sql.CollationID) *AlterTableCollation {
	return &AlterTableCollation{
		ddlNode:   ddlNode{Db: table.SqlDatabase},
		Table:     table,
		Collation: collation,
	}
}

// NewAlterTableCollation returns a new *AlterTableCollation
func NewAlterTableCollation(database sql.Database, table *UnresolvedTable, collation sql.CollationID) *AlterTableCollation {
	return &AlterTableCollation{
		ddlNode:   ddlNode{Db: database},
		Table:     table,
		Collation: collation,
	}
}

// WithDatabase implements the interface sql.Databaser.
func (atc *AlterTableCollation) WithDatabase(db sql.Database) (sql.Node, error) {
	natc := *atc
	natc.Db = db
	return &natc, nil
}

func (atc *AlterTableCollation) IsReadOnly() bool {
	return false
}

// String implements the interface sql.Node.
func (atc *AlterTableCollation) String() string {
	return fmt.Sprintf("alter table %s collate %s", atc.Table.String(), atc.Collation.Name())
}

// DebugString implements the interface sql.Node.
func (atc *AlterTableCollation) DebugString() string {
	return atc.String()
}

// Resolved implements the interface sql.Node.
func (atc *AlterTableCollation) Resolved() bool {
	return atc.Table.Resolved() && atc.ddlNode.Resolved()
}

// Schema implements the interface sql.Node.
func (atc *AlterTableCollation) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the interface sql.Node.
func (atc *AlterTableCollation) Children() []sql.Node {
	return []sql.Node{atc.Table}
}

// WithChildren implements the interface sql.Node.
func (atc *AlterTableCollation) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(atc, len(children), 1)
	}
	natc := *atc
	natc.Table = children[0]
	return &natc, nil
}

type AlterTableComment struct {
	ddlNode
	Table   sql.Node
	Comment string
}

var _ sql.Node = (*AlterTableComment)(nil)
var _ sql.Databaser = (*AlterTableComment)(nil)

func NewAlterTableComment(table *ResolvedTable, comment string) *AlterTableComment {
	return &AlterTableComment{
		ddlNode: ddlNode{Db: table.SqlDatabase},
		Table:   table,
		Comment: comment,
	}
}

// WithDatabase implements the interface sql.Databaser
func (atc *AlterTableComment) WithDatabase(db sql.Database) (sql.Node, error) {
	natc := *atc
	natc.Db = db
	return &natc, nil
}

// IsReadOnly implements the interface sql.Node
func (atc *AlterTableComment) IsReadOnly() bool {
	return false
}

// String implements the interface sql.Node
func (atc *AlterTableComment) String() string {
	return fmt.Sprintf("alter table %s comment %s", atc.Table.String(), atc.Comment)
}

// DebugString implements the interface sql.Node
func (atc *AlterTableComment) DebugString() string {
	return atc.String()
}

// Resolved implements the interface sql.Node
func (atc *AlterTableComment) Resolved() bool {
	return atc.Table.Resolved() && atc.ddlNode.Resolved()
}

// Schema implements the interface sql.Node
func (atc *AlterTableComment) Schema() sql.Schema {
	return atc.Table.Schema()
}

// Children implements the interface sql.Node
func (atc *AlterTableComment) Children() []sql.Node {
	return []sql.Node{atc.Table}
}

// WithChildren implements the interface sql.Node
func (atc *AlterTableComment) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(atc, len(children), 1)
	}
	natc := *atc
	natc.Table = children[0]
	return &natc, nil
}
