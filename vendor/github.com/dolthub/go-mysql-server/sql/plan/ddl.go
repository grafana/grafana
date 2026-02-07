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
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Ddl nodes have a reference to a database, but no children and a nil schema.
type ddlNode struct {
	Db sql.Database
}

// Resolved implements the Resolvable interface.
func (c *ddlNode) Resolved() bool {
	_, ok := c.Db.(sql.UnresolvedDatabase)
	return !ok
}

// Database implements the sql.Databaser interface.
func (c *ddlNode) Database() sql.Database {
	return c.Db
}

// Schema implements the Node interface.
func (*ddlNode) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the Node interface.
func (c *ddlNode) Children() []sql.Node { return nil }

// TableSpec is a node describing the schema of a table.
type TableSpec struct {
	TableOpts map[string]interface{}
	Comment   string
	Schema    sql.PrimaryKeySchema
	FkDefs    sql.ForeignKeyConstraints
	ChDefs    sql.CheckConstraints
	IdxDefs   sql.IndexDefs
	Collation sql.CollationID
}

// CreateTable is a node describing the creation of some table.
type CreateTable struct {
	like sql.Node
	ddlNode
	selectNode   sql.Node
	TableOpts    map[string]interface{}
	name         string
	pkSch        sql.PrimaryKeySchema
	fkDefs       sql.ForeignKeyConstraints
	idxDefs      sql.IndexDefs
	checks       sql.CheckConstraints
	fkParentTbls sql.ForeignKeyTables
	Collation    sql.CollationID
	ifNotExists  bool
	temporary    bool
}

var _ sql.Databaser = (*CreateTable)(nil)
var _ sql.Node = (*CreateTable)(nil)
var _ sql.Expressioner = (*CreateTable)(nil)
var _ sql.SchemaTarget = (*CreateTable)(nil)
var _ sql.CheckConstraintNode = (*CreateTable)(nil)
var _ sql.CollationCoercible = (*CreateTable)(nil)

// NewCreateTable creates a new CreateTable node
func NewCreateTable(db sql.Database, name string, ifn, temp bool, tableSpec *TableSpec) *CreateTable {
	for _, s := range tableSpec.Schema.Schema {
		s.Source = name
	}

	return &CreateTable{
		ddlNode:     ddlNode{db},
		name:        name,
		ifNotExists: ifn,
		temporary:   temp,
		pkSch:       tableSpec.Schema,
		fkDefs:      tableSpec.FkDefs,
		checks:      tableSpec.ChDefs,
		idxDefs:     tableSpec.IdxDefs,
		Collation:   tableSpec.Collation,
		TableOpts:   tableSpec.TableOpts,
	}
}

// NewCreateTableSelect create a new CreateTable node for CREATE TABLE [AS] SELECT
func NewCreateTableSelect(db sql.Database, name string, ifn, temp bool, selectNode sql.Node, tableSpec *TableSpec) *CreateTable {
	for _, s := range tableSpec.Schema.Schema {
		s.Source = name
	}

	return &CreateTable{
		ddlNode:     ddlNode{Db: db},
		name:        name,
		ifNotExists: ifn,
		temporary:   temp,
		selectNode:  selectNode,
		pkSch:       tableSpec.Schema,
		fkDefs:      tableSpec.FkDefs,
		checks:      tableSpec.ChDefs,
		idxDefs:     tableSpec.IdxDefs,
		Collation:   tableSpec.Collation,
		TableOpts:   tableSpec.TableOpts,
	}
}

// WithDatabase implements the sql.Databaser interface.
func (c *CreateTable) WithDatabase(db sql.Database) (sql.Node, error) {
	nc := *c
	nc.Db = db
	return &nc, nil
}

// WithIndexDefs returns a copy of this CreateTable instance, with the index definitions
// set to |idxDefs|.
func (c *CreateTable) WithIndexDefs(idxDefs sql.IndexDefs) (*CreateTable, error) {
	nc := *c
	nc.idxDefs = idxDefs
	return &nc, nil
}

// Name implements the Nameable interface.
func (c *CreateTable) Name() string {
	return c.name
}

// Resolved implements the Resolvable interface.
func (c *CreateTable) Resolved() bool {
	if !c.ddlNode.Resolved() || !c.pkSch.Schema.Resolved() {
		return false
	}

	for _, chDef := range c.checks {
		if !chDef.Expr.Resolved() {
			return false
		}
	}

	if c.like != nil {
		if !c.like.Resolved() {
			return false
		}
	}

	if c.selectNode != nil {
		if !c.selectNode.Resolved() {
			return false
		}
	}

	return true
}

// String implements the fmt.Stringer interface.
func (c *CreateTable) String() string {
	ifNotExists := ""
	if c.ifNotExists {
		ifNotExists = "if not exists "
	}
	return fmt.Sprintf("Create table %s%s", ifNotExists, c.name)
}

// DebugString implements the sql.DebugStringer interface.
func (c *CreateTable) DebugString() string {
	p := sql.NewTreePrinter()

	ifNotExists := ""
	if c.ifNotExists {
		ifNotExists = "if not exists "
	}

	if c.selectNode != nil {
		p.WriteNode("Create table %s%s as", ifNotExists, c.name)
		p.WriteChildren(sql.DebugString(c.selectNode))
		return p.String()
	}

	p.WriteNode("Create table %s%s", ifNotExists, c.name)

	var children []string
	children = append(children, c.schemaDebugString())

	if len(c.fkDefs) > 0 {
		children = append(children, c.foreignKeysDebugString())
	}
	if len(c.idxDefs) > 0 {
		children = append(children, c.indexesDebugString())
	}
	if len(c.checks) > 0 {
		children = append(children, c.checkConstraintsDebugString())
	}

	p.WriteChildren(children...)
	return p.String()
}

func (c *CreateTable) foreignKeysDebugString() string {
	p := sql.NewTreePrinter()
	p.WriteNode("ForeignKeys")
	var children []string
	for _, def := range c.fkDefs {
		children = append(children, sql.DebugString(def))
	}
	p.WriteChildren(children...)
	return p.String()
}

func (c *CreateTable) indexesDebugString() string {
	p := sql.NewTreePrinter()
	p.WriteNode("Indexes")
	var children []string
	for _, def := range c.idxDefs {
		children = append(children, sql.DebugString(def))
	}
	p.WriteChildren(children...)
	return p.String()
}

func (c *CreateTable) checkConstraintsDebugString() string {
	p := sql.NewTreePrinter()
	p.WriteNode("CheckConstraints")
	var children []string
	for _, def := range c.checks {
		children = append(children, sql.DebugString(def))
	}
	p.WriteChildren(children...)
	return p.String()
}

func (c *CreateTable) schemaDebugString() string {
	p := sql.NewTreePrinter()
	p.WriteNode("Columns")
	var children []string
	for _, col := range c.pkSch.Schema {
		children = append(children, sql.DebugString(col))
	}
	p.WriteChildren(children...)
	return p.String()
}

// Schema implements the sql.Node interface.
func (c *CreateTable) Schema() sql.Schema {
	return types.OkResultSchema
}

func (c *CreateTable) PkSchema() sql.PrimaryKeySchema {
	return c.pkSch
}

// TargetSchema implements the sql.TargetSchema interface.
func (c *CreateTable) TargetSchema() sql.Schema {
	return c.pkSch.Schema
}

// WithTargetSchema  implements the sql.TargetSchema interface.
func (c *CreateTable) WithTargetSchema(_ sql.Schema) (sql.Node, error) {
	return nil, fmt.Errorf("unable to set target schema without primary key info")
}

// Children implements the Node interface.
func (c *CreateTable) Children() []sql.Node {
	if c.like != nil {
		return []sql.Node{c.like}
	}
	if c.selectNode != nil {
		return []sql.Node{c.selectNode}
	}
	return nil
}

// WithChildren implements the Node interface.
func (c *CreateTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	nc := *c
	if len(children) == 0 {
		return &nc, nil
	}
	if len(children) == 1 {
		if c.like != nil {
			nc.like = children[0]
		} else {
			nc.selectNode = children[0]
		}
		return &nc, nil
	}
	return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
}

// IsReadOnly implements the Node interface.
func (c *CreateTable) IsReadOnly() bool {
	return false
}

// Expressions implements the sql.Expressioner interface.
func (c *CreateTable) Expressions() []sql.Expression {
	exprs := transform.WrappedColumnDefaults(c.pkSch.Schema)

	for _, ch := range c.checks {
		exprs = append(exprs, ch.Expr)
	}

	return exprs
}

// WithExpressions implements the sql.Expressioner interface.
func (c *CreateTable) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	schemaLen := len(c.pkSch.Schema)
	length := schemaLen + len(c.checks)
	if len(exprs) != length {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(exprs), length)
	}

	nc := *c

	// Make sure to make a deep copy of any slices here so we aren't modifying the original pointer
	ns, err := transform.SchemaWithDefaults(c.pkSch.Schema, exprs[:schemaLen])
	if err != nil {
		return nil, err
	}

	nc.pkSch = sql.NewPrimaryKeySchema(ns, c.pkSch.PkOrdinals...)

	ncd, err := c.checks.FromExpressions(exprs[schemaLen:])
	if err != nil {
		return nil, err
	}

	nc.checks = ncd
	return &nc, nil
}

// CollationCoercibility implements the sql.CollationCoercible interface.
func (*CreateTable) CollationCoercibility(_ *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// CreateForeignKeys creates the foreign keys on the table.
func (c *CreateTable) CreateForeignKeys(ctx *sql.Context, tableNode sql.Table) error {
	fkTbl, ok := tableNode.(sql.ForeignKeyTable)
	if !ok {
		return sql.ErrNoForeignKeySupport.New(c.name)
	}

	fkChecks, err := ctx.GetSessionVariable(ctx, "foreign_key_checks")
	if err != nil {
		return err
	}

	for i, fkDef := range c.fkDefs {
		if fkChecks.(int8) == 1 {
			fkParentTbl := c.fkParentTbls[i]
			// If a foreign key is self-referential then the analyzer uses a nil since the table does not yet exist
			if fkParentTbl == nil {
				fkParentTbl = fkTbl
			}
			// If foreign_key_checks are true, then the referenced tables will be populated
			err = ResolveForeignKey(ctx, fkTbl, fkParentTbl, *fkDef, true, true, true)
			if err != nil {
				return err
			}
		} else {
			// If foreign_key_checks are true, then the referenced tables will be populated
			err = ResolveForeignKey(ctx, fkTbl, nil, *fkDef, true, false, false)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// ForeignKeys returns any foreign keys that will be declared on this table.
func (c *CreateTable) ForeignKeys() []*sql.ForeignKeyConstraint {
	return c.fkDefs
}

// WithParentForeignKeyTables adds the tables that are referenced in each foreign key. The table indices is assumed
// to match the foreign key indices in their respective slices.
func (c *CreateTable) WithParentForeignKeyTables(refTbls []sql.ForeignKeyTable) (*CreateTable, error) {
	if len(c.fkDefs) != len(refTbls) {
		return nil, fmt.Errorf("table `%s` defines `%d` foreign keys but found `%d` referenced tables",
			c.name, len(c.fkDefs), len(refTbls))
	}
	nc := *c
	nc.fkParentTbls = refTbls
	return &nc, nil
}

// CreateChecks creates the check constraints on the table.
func (c *CreateTable) CreateChecks(ctx *sql.Context, tableNode sql.Table) error {
	chAlterable, ok := tableNode.(sql.CheckAlterableTable)
	if !ok {
		return ErrNoCheckConstraintSupport.New(c.name)
	}

	for _, ch := range c.checks {
		check, err := NewCheckDefinition(ctx, ch)
		if err != nil {
			return err
		}
		err = chAlterable.CreateCheck(ctx, check)
		if err != nil {
			return err
		}
	}

	return nil
}

// Checks returns any check constraints that will be declared on this table.
func (c *CreateTable) Checks() sql.CheckConstraints {
	return c.checks
}

// WithChecks returns a new CreateTable node with the given check constraints.
func (c *CreateTable) WithChecks(checks sql.CheckConstraints) sql.Node {
	ret := *c
	ret.checks = checks
	return &ret
}

// Indexes returns any indexes that will be declared on this table.
func (c *CreateTable) Indexes() sql.IndexDefs {
	return c.idxDefs
}

func (c *CreateTable) IfNotExists() bool {
	return c.ifNotExists
}

func (c *CreateTable) Temporary() bool {
	return c.temporary
}

func (c *CreateTable) Like() sql.Node {
	return c.like
}

func (c *CreateTable) Select() sql.Node {
	return c.selectNode
}

func (c *CreateTable) ValidateDefaultPosition() error {
	colsAfterThis := make(map[string]*sql.Column)
	for i := len(c.pkSch.Schema) - 1; i >= 0; i-- {
		col := c.pkSch.Schema[i]
		colsAfterThis[col.Name] = col
		if err := inspectDefaultForInvalidColumns(col, colsAfterThis); err != nil {
			return err
		}
	}

	return nil
}

// DropTable is a node describing dropping one or more tables
type DropTable struct {
	Tables       []sql.Node
	TriggerNames []string
	ifExists     bool
}

var _ sql.Node = (*DropTable)(nil)
var _ sql.CollationCoercible = (*DropTable)(nil)

// NewDropTable creates a new DropTable node
func NewDropTable(tbls []sql.Node, ifExists bool) *DropTable {
	return &DropTable{
		Tables:   tbls,
		ifExists: ifExists,
	}
}

// WithTriggers returns this node but with the given triggers.
func (d *DropTable) WithTriggers(triggers []string) sql.Node {
	nd := *d
	nd.TriggerNames = triggers
	return &nd
}

// TableNames returns the names of the tables to drop.
func (d *DropTable) TableNames() ([]string, error) {
	tblNames := make([]string, len(d.Tables))
	for i, t := range d.Tables {
		// either *ResolvedTable OR *UnresolvedTable here
		if uTable, ok := t.(*UnresolvedTable); ok {
			tblNames[i] = uTable.Name()
		} else if rTable, ok := t.(*ResolvedTable); ok {
			tblNames[i] = rTable.Name()
		} else {
			return []string{}, sql.ErrInvalidType.New(t)
		}
	}
	return tblNames, nil
}

// IfExists returns ifExists variable.
func (d *DropTable) IfExists() bool {
	return d.ifExists
}

// Children implements the Node interface.
func (d *DropTable) Children() []sql.Node {
	return d.Tables
}

// Resolved implements the sql.Expression interface.
func (d *DropTable) Resolved() bool {
	for _, table := range d.Tables {
		if !table.Resolved() {
			return false
		}
	}

	return true
}

func (d *DropTable) IsReadOnly() bool {
	return false
}

// Schema implements the sql.Expression interface.
func (d *DropTable) Schema() sql.Schema {
	return types.OkResultSchema
}

// WithChildren implements the Node interface.
func (d *DropTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	// Number of children can be smaller than original as the non-existent
	// tables get filtered out in some cases
	var newChildren = make([]sql.Node, len(children))
	copy(newChildren, children)
	nd := *d
	nd.Tables = newChildren
	return &nd, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// String implements the sql.Node interface.
func (d *DropTable) String() string {
	ifExists := ""
	tblNames, _ := d.TableNames()
	names := strings.Join(tblNames, ", ")
	if d.ifExists {
		ifExists = "if exists "
	}
	return fmt.Sprintf("Drop table %s%s", ifExists, names)
}
