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

package planbuilder

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/mysql"
	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) resolveDb(name string) sql.Database {
	if name == "" {
		err := sql.ErrNoDatabaseSelected.New()
		b.handleErr(err)
	}
	database, err := b.cat.Database(b.ctx, name)
	if err != nil {
		b.handleErr(err)
	}

	// todo show tables as of expects privileged
	//if privilegedDatabase, ok := database.(mysql_db.PrivilegedDatabase); ok {
	//	database = privilegedDatabase.Unwrap()
	//}
	return database
}

// resolveDbForTable attempts to resolve the database and schema name qualifiers
// for a table. If the database is not specified, the current database is used.
// If the specified schema is not found, `ok` will be false.
func (b *Builder) resolveDbForTable(table ast.TableName) (sql.Database, bool) {
	dbName := table.DbQualifier.String()
	if dbName == "" {
		dbName = b.ctx.GetCurrentDatabase()
	}

	if dbName == "" {
		b.handleErr(sql.ErrNoDatabaseSelected.New())
	}

	database, err := b.cat.Database(b.ctx, dbName)
	if err != nil {
		b.handleErr(err)
	}

	schema := table.SchemaQualifier.String()
	if schema != "" {
		scd, ok := database.(sql.SchemaDatabase)
		if !ok {
			b.handleErr(fmt.Errorf("database %T does not support schemas", database))
		}
		database, ok, err = scd.GetSchema(b.ctx, schema)
		if err != nil {
			b.handleErr(err)
		}

		return database, ok
	}

	return database, true
}

// buildAlterTable converts AlterTable AST nodes. If there is a single clause in the statement, it is returned as
// the appropriate node type. Otherwise, a plan.Block is returned with children representing all the various clauses.
// Our validation rules for what counts as a legal set of alter clauses differs from mysql's here. MySQL seems to apply
// some form of precedence rules to the clauses in an ALTER TABLE so that e.g. DROP COLUMN always happens before other
// kinds of statements. So in MySQL, statements like `ALTER TABLE t ADD KEY (a), DROP COLUMN a` fails, whereas our
// analyzer happily produces a plan that adds an index and then drops that column. We do this in part for simplicity,
// and also because we construct more than one node per clause in some cases and really want them executed in a
// particular order in that case.
func (b *Builder) buildAlterTable(inScope *scope, query string, c *ast.AlterTable) (outScope *scope) {
	b.multiDDL = true
	defer func() {
		b.multiDDL = false
	}()

	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, c.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	statements := make([]sql.Node, 0, len(c.Statements))
	for i := 0; i < len(c.Statements); i++ {
		scopes := b.buildAlterTableClause(inScope, c.Statements[i])
		for _, scope := range scopes {
			statements = append(statements, scope.node)
		}
	}

	if len(statements) == 1 {
		outScope = inScope.push()
		outScope.node = statements[0]
		return outScope
	}

	outScope = inScope.push()
	outScope.node = plan.NewBlock(statements)
	return
}

func (b *Builder) buildDDL(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, c.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	if !c.Temporary {
		b.qFlags.Set(sql.QFlagDDL)
	}

	outScope = inScope.push()
	switch strings.ToLower(c.Action) {
	case ast.CreateStr:
		if c.TriggerSpec != nil {
			return b.buildCreateTrigger(inScope, subQuery, fullQuery, c)
		}
		if c.ProcedureSpec != nil {
			return b.buildCreateProcedure(inScope, subQuery, fullQuery, c)
		}
		if c.EventSpec != nil {
			return b.buildCreateEvent(inScope, subQuery, fullQuery, c)
		}
		if c.ViewSpec != nil {
			return b.buildCreateView(inScope, subQuery, fullQuery, c)
		}
		return b.buildCreateTable(inScope, c)
	case ast.DropStr:
		// get database
		if c.TriggerSpec != nil {
			dbName := c.TriggerSpec.TrigName.Qualifier.String()
			if dbName == "" {
				dbName = b.ctx.GetCurrentDatabase()
			}
			trigName := c.TriggerSpec.TrigName.Name.String()
			outScope.node = plan.NewDropTrigger(b.resolveDb(dbName), trigName, c.IfExists)
			return
		}
		if c.ProcedureSpec != nil {
			dbName := c.ProcedureSpec.ProcName.Qualifier.String()
			if dbName == "" {
				dbName = b.ctx.GetCurrentDatabase()
			}
			procName := c.ProcedureSpec.ProcName.Name.String()
			outScope.node = plan.NewDropProcedure(b.resolveDb(dbName), procName, c.IfExists)
			return
		}
		if c.EventSpec != nil {
			dbName := c.EventSpec.EventName.Qualifier.String()
			if dbName == "" {
				dbName = b.ctx.GetCurrentDatabase()
			}
			eventName := c.EventSpec.EventName.Name.String()
			outScope.node = plan.NewDropEvent(b.resolveDb(dbName), b.scheduler, eventName, c.IfExists)
			return
		}
		if len(c.FromViews) != 0 {
			return b.buildDropView(inScope, c)
		}
		return b.buildDropTable(inScope, c)
	case ast.AlterStr:
		if c.EventSpec != nil {
			return b.buildAlterEvent(inScope, subQuery, fullQuery, c)
		} else if !c.User.IsEmpty() {
			return b.buildAlterUser(inScope, subQuery, c)
		}
		b.handleErr(sql.ErrUnsupportedFeature.New(ast.String(c)))
	case ast.RenameStr:
		return b.buildRenameTable(inScope, c)
	case ast.TruncateStr:
		return b.buildTruncateTable(inScope, c)
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(c)))
	}
	return
}

func (b *Builder) buildDropView(inScope *scope, c *ast.DDL) (outScope *scope) {
	outScope = inScope.push()
	var dropViews []sql.Node
	dbName := c.FromViews[0].DbQualifier.String()
	if dbName == "" {
		dbName = b.currentDb().Name()
	}
	for _, v := range c.FromViews {
		if v.DbQualifier.String() != "" && v.DbQualifier.String() != dbName {
			err := sql.ErrUnsupportedFeature.New("dropping views on multiple databases in the same statement")
			b.handleErr(err)
		}

		viewName := strings.ToLower(v.Name.String())
		db, ok := b.resolveDbForTable(v)
		if !ok {
			if c.IfExists {
				b.ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    mysql.ERBadTable,
					Message: fmt.Sprintf("Unknown view '%s'", viewName),
				})
				continue
			} else {
				b.handleErr(sql.ErrDatabaseSchemaNotFound.New(v.SchemaQualifier.String()))
			}
		}

		dropViews = append(dropViews, plan.NewSingleDropView(db, v.Name.String()))
	}

	outScope.node = plan.NewDropView(dropViews, c.IfExists)
	return
}

func (b *Builder) buildDropTable(inScope *scope, c *ast.DDL) (outScope *scope) {
	outScope = inScope.push()
	var dropTables []sql.Node
	dbName := c.FromTables[0].DbQualifier.String()
	if dbName == "" {
		dbName = b.currentDb().Name()
	}

	for _, t := range c.FromTables {
		if t.DbQualifier.String() != "" && t.DbQualifier.String() != dbName {
			err := sql.ErrUnsupportedFeature.New("dropping tables on multiple databases in the same statement")
			b.handleErr(err)
		}
		tableName := strings.ToLower(t.Name.String())
		if c.IfExists {
			_, _, err := b.cat.Table(b.ctx, dbName, tableName)
			if sql.ErrTableNotFound.Is(err) && b.ctx != nil && b.ctx.Session != nil {
				b.ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    mysql.ERBadTable,
					Message: fmt.Sprintf("Unknown table '%s'", tableName),
				})
				continue
			} else if err != nil {
				b.handleErr(err)
			}
		}

		tableScope, ok := b.buildResolvedTableForTablename(inScope, t, nil)
		if ok {
			// attempting to drop a non-temporary table with DROP TEMPORARY, results in Unknown table
			if tbl, ok := tableScope.node.(sql.Table); ok {
				if tmpTbl := getTempTable(tbl); tmpTbl != nil && !tmpTbl.IsTemporary() && c.Temporary {
					err := sql.ErrUnknownTable.New(tableName)
					b.handleErr(err)
				}
			}
			dropTables = append(dropTables, tableScope.node)
		} else if !c.IfExists {
			err := sql.ErrTableNotFound.New(tableName)
			b.handleErr(err)
		}
	}

	outScope.node = plan.NewDropTable(dropTables, c.IfExists)
	return
}

func getTempTable(t sql.Table) sql.TemporaryTable {
	switch t := t.(type) {
	case sql.TemporaryTable:
		return t
	case sql.TableWrapper:
		return getTempTable(t.Underlying())
	case *plan.ResolvedTable:
		return getTempTable(t.Table)
	default:
		return nil
	}
}

func (b *Builder) buildTruncateTable(inScope *scope, c *ast.DDL) (outScope *scope) {
	outScope = inScope.push()
	tableScope, ok := b.buildResolvedTableForTablename(inScope, c.Table, nil)
	if !ok {
		b.handleErr(sql.ErrTableNotFound.New(c.Table.Name.String()))
	}
	outScope.node = plan.NewTruncate(
		c.Table.DbQualifier.String(),
		tableScope.node,
	)
	return
}

func (b *Builder) buildCreateTable(inScope *scope, c *ast.DDL) (outScope *scope) {
	outScope = inScope.push()
	if c.OptLike != nil {
		return b.buildCreateTableLike(inScope, c)
	}

	database, ok := b.resolveDbForTable(c.Table)
	if !ok {
		b.handleErr(sql.ErrDatabaseSchemaNotFound.New(c.Table.SchemaQualifier.String()))
	}

	// In the case that no table spec is given but a SELECT Statement return the CREATE TABLE node.
	// if the table spec != nil it will get parsed below.
	if c.TableSpec == nil && c.OptSelect != nil {
		selectScope := b.buildSelectStmt(inScope, c.OptSelect.Select)
		sch := b.resolveSchemaDefaults(outScope, selectScope.node.Schema())
		tableSpec := &plan.TableSpec{
			Schema: sql.NewPrimaryKeySchema(sch),
		}
		outScope.node = plan.NewCreateTableSelect(database, c.Table.Name.String(), c.IfNotExists, c.Temporary, selectScope.node, tableSpec)
		return outScope
	}

	idxDefs := b.buildIndexDefs(inScope, c.TableSpec)

	schema, collation, tblOpts := b.tableSpecToSchema(inScope, outScope, database, strings.ToLower(c.Table.Name.String()), c.TableSpec, false)
	fkDefs, chDefs := b.buildConstraintsDefs(outScope, c.Table, c.TableSpec)

	schema.Schema = assignColumnIndexesInSchema(schema.Schema)
	chDefs = assignColumnIndexesInCheckDefs(chDefs, schema.Schema)

	if privDb, ok := database.(mysql_db.PrivilegedDatabase); ok {
		if sv, ok := privDb.Unwrap().(sql.SchemaValidator); ok {
			if err := sv.ValidateSchema(schema.PhysicalSchema()); err != nil {
				b.handleErr(err)
			}
		}
	} else {
		if sv, ok := database.(sql.SchemaValidator); ok {
			if err := sv.ValidateSchema(schema.PhysicalSchema()); err != nil {
				b.handleErr(err)
			}
		}
	}

	tableSpec := &plan.TableSpec{
		Schema:    schema,
		IdxDefs:   idxDefs,
		FkDefs:    fkDefs,
		ChDefs:    chDefs,
		Collation: collation,
		TableOpts: tblOpts,
	}

	b.qFlags.Set(sql.QFlagSetDatabase)
	if c.OptSelect != nil {
		selectScope := b.buildSelectStmt(inScope, c.OptSelect.Select)
		outScope.node = plan.NewCreateTableSelect(database, c.Table.Name.String(), c.IfNotExists, c.Temporary, selectScope.node, tableSpec)
	} else {
		outScope.node = plan.NewCreateTable(
			database, c.Table.Name.String(), c.IfNotExists, c.Temporary, tableSpec)
	}

	return
}

func assignColumnIndexesInCheckDefs(defs []*sql.CheckConstraint, schema sql.Schema) []*sql.CheckConstraint {
	newDefs := make([]*sql.CheckConstraint, len(defs))
	for i, def := range defs {
		newDefs[i] = def
		newDefs[i].Expr = assignColumnIndexes(def.Expr, schema).(sql.Expression)
	}
	return newDefs
}

func assignColumnIndexesInSchema(schema sql.Schema) sql.Schema {
	newSch := make(sql.Schema, len(schema))
	for i, col := range schema {
		newSch[i] = col
		if col.Default != nil {
			newSch[i].Default = assignColumnIndexes(col.Default, schema).(*sql.ColumnDefaultValue)
		}
		if col.Generated != nil {
			newSch[i].Generated = assignColumnIndexes(col.Generated, schema).(*sql.ColumnDefaultValue)
		}
	}
	return newSch
}

func (b *Builder) getIndexDefs(table sql.Table) sql.IndexDefs {
	idxTbl, isIdxTbl := table.(sql.IndexAddressableTable)
	if !isIdxTbl {
		return nil
	}
	idxs, err := idxTbl.GetIndexes(b.ctx)
	if err != nil {
		b.handleErr(err)
	}
	idxDefs := make(sql.IndexDefs, 0, len(idxs))
	for _, idx := range idxs {
		if idx.IsGenerated() {
			continue
		}
		constraint := sql.IndexConstraint_None
		if idx.IsUnique() {
			if idx.ID() == "PRIMARY" {
				constraint = sql.IndexConstraint_Primary
			} else {
				constraint = sql.IndexConstraint_Unique
			}
		}
		exprs := idx.Expressions()
		columns := make([]sql.IndexColumn, len(exprs))
		for i, col := range exprs {
			col = col[strings.IndexByte(col, '.')+1:]
			columns[i] = sql.IndexColumn{Name: col}
		}
		idxDefs = append(idxDefs, &sql.IndexDef{
			Name:       idx.ID(),
			Storage:    sql.IndexUsing_Default,
			Constraint: constraint,
			Columns:    columns,
			Comment:    idx.Comment(),
		})
	}
	return idxDefs
}

func (b *Builder) buildCreateTableLike(inScope *scope, ct *ast.DDL) *scope {
	database, ok := b.resolveDbForTable(ct.Table)
	if !ok {
		b.handleErr(sql.ErrDatabaseSchemaNotFound.New(ct.Table.SchemaQualifier.String()))
	}

	newTableName := strings.ToLower(ct.Table.Name.String())

	var pkSch sql.PrimaryKeySchema
	var coll sql.CollationID
	var comment string
	outScope := inScope.push()
	if ct.TableSpec != nil {
		pkSch, coll, _ = b.tableSpecToSchema(inScope, outScope, database, strings.ToLower(ct.Table.Name.String()), ct.TableSpec, false)
	}

	var pkOrdinals []int
	var newSch sql.Schema
	newSchMap := make(map[string]struct{})
	var idxDefs sql.IndexDefs
	var checkDefs []*sql.CheckConstraint
	for _, likeTable := range ct.OptLike.LikeTables {
		outScope, ok = b.buildTablescan(outScope, likeTable, nil)
		if !ok {
			b.handleErr(sql.ErrTableNotFound.New(likeTable.Name.String()))
		}
		lTable, isResTbl := outScope.node.(*plan.ResolvedTable)
		if !isResTbl {
			err := fmt.Errorf("expected resolved table: %s", likeTable.Name.String())
			b.handleErr(err)
		}

		if coll == sql.Collation_Unspecified {
			coll = lTable.Collation()
		}

		if comment == "" {
			comment = lTable.Comment()
		}

		schOff := len(newSch)
		hasSkippedCols := false
		for _, col := range lTable.Schema() {
			newCol := *col
			name := strings.ToLower(newCol.Name)
			if _, ok := newSchMap[name]; ok {
				// TODO: throw warning
				hasSkippedCols = true
				continue
			}
			newSchMap[name] = struct{}{}
			newCol.Source = newTableName
			newSch = append(newSch, &newCol)
		}

		// if a column was skipped due to duplicates, don't copy over PK ords, idxDefs, or checkDefs
		// since they might be incorrect
		if hasSkippedCols {
			continue
		}

		// Copy over primary key schema ordinals
		if pkTable, isPkTable := lTable.Table.(sql.PrimaryKeyTable); isPkTable {
			for _, pkOrd := range pkTable.PrimaryKeySchema().PkOrdinals {
				pkOrdinals = append(pkOrdinals, schOff+pkOrd)
			}
		}

		// Load index definitions
		idxDefs = append(idxDefs, b.getIndexDefs(lTable.Table)...)

		// Load check constraints
		newCheckDefs := b.loadChecksFromTable(outScope, lTable.Table)
		for _, check := range newCheckDefs {
			// Prevent a name collision between old and new checks.
			// New check name will be assigned a name during building.
			check.Name = ""
		}
		checkDefs = append(checkDefs, newCheckDefs...)
	}

	var hasSkippedCols bool
	for _, col := range pkSch.Schema {
		name := strings.ToLower(col.Name)
		if _, ok := newSchMap[name]; ok {
			// TODO: throw warning
			hasSkippedCols = true
			continue
		}
		newSch = append(newSch, col)
	}
	if !hasSkippedCols {
		for _, pkOrd := range pkSch.PkOrdinals {
			pkOrdinals = append(pkOrdinals, len(newSch)+pkOrd)
		}
	}

	pkSchema := sql.NewPrimaryKeySchema(newSch, pkOrdinals...)
	pkSchema.Schema = b.resolveSchemaDefaults(outScope, pkSchema.Schema)

	tableSpec := &plan.TableSpec{
		Schema:    pkSchema,
		IdxDefs:   idxDefs,
		ChDefs:    checkDefs,
		Collation: coll,
		Comment:   comment,
	}

	b.qFlags.Set(sql.QFlagSetDatabase)

	outScope.setTableAlias(newTableName)
	outScope.node = plan.NewCreateTable(database, newTableName, ct.IfNotExists, ct.Temporary, tableSpec)
	return outScope
}

func (b *Builder) buildRenameTable(inScope *scope, ddl *ast.DDL) (outScope *scope) {
	outScope = inScope
	if len(ddl.FromTables) != len(ddl.ToTables) {
		panic("Expected from tables and to tables of equal length")
	}

	var fromTables, toTables []string
	for _, table := range ddl.FromTables {
		fromTables = append(fromTables, table.Name.String())
	}
	for _, table := range ddl.ToTables {
		toTables = append(toTables, table.Name.String())
	}

	outScope.node = plan.NewRenameTable(b.currentDb(), fromTables, toTables, b.multiDDL)
	return
}

func (b *Builder) isUniqueColumn(tableSpec *ast.TableSpec, columnName string) bool {
	for _, column := range tableSpec.Columns {
		if column.Name.String() == columnName {
			return column.Type.KeyOpt == colKeyUnique ||
				column.Type.KeyOpt == colKeyUniqueKey
		}
	}
	err := fmt.Errorf("unknown column name %s", columnName)
	b.handleErr(err)
	return false

}

func (b *Builder) buildAlterTableClause(inScope *scope, ddl *ast.DDL) []*scope {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, ddl.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScopes := make([]*scope, 0, 1)

	// RENAME a to b, c to d ..
	if ddl.Action == ast.RenameStr {
		outScopes = append(outScopes, b.buildRenameTable(inScope, ddl))
	} else {
		var ok bool
		tableScope, ok := b.buildResolvedTableForTablename(inScope, ddl.Table, nil)
		if !ok {
			b.handleErr(sql.ErrTableNotFound.New(ddl.Table.Name.String()))
		}
		rt, ok := tableScope.node.(*plan.ResolvedTable)
		if !ok {
			err := fmt.Errorf("expected resolved table: %s", ddl.Table.Name.String())
			b.handleErr(err)
		}

		if ddl.ColumnAction != "" {
			columnActionOutscope := b.buildAlterTableColumnAction(tableScope, ddl, rt)
			outScopes = append(outScopes, columnActionOutscope.copy())

			if ddl.TableSpec != nil {
				if len(ddl.TableSpec.Columns) != 1 {
					err := sql.ErrUnsupportedFeature.New("unexpected number of columns in a single alter column clause")
					b.handleErr(err)
				}

				column := ddl.TableSpec.Columns[0]
				isUnique := b.isUniqueColumn(ddl.TableSpec, column.Name.String())
				if isUnique {
					createIndex := plan.NewAlterCreateIndex(
						rt.Database(),
						rt,
						ddl.IfNotExists,
						column.Name.String(),
						sql.IndexUsing_BTree,
						sql.IndexConstraint_Unique,
						[]sql.IndexColumn{{Name: column.Name.String()}},
						"",
					)

					createIndexScope := inScope.push()
					createIndexScope.node = createIndex
					outScopes = append(outScopes, createIndexScope)
				}
			}
		}

		if ddl.ConstraintAction != "" {
			if len(ddl.TableSpec.Constraints) != 1 && ddl.ConstraintAction != ast.RenameStr {
				b.handleErr(sql.ErrUnsupportedFeature.New("unexpected number of constraints in a single alter constraint clause"))
			}
			outScopes = append(outScopes, b.buildAlterConstraint(tableScope, ddl, rt))
		}

		if ddl.IndexSpec != nil {
			outScopes = append(outScopes, b.buildAlterIndex(tableScope, ddl, rt))
		}

		if ddl.AutoIncSpec != nil {
			outScopes = append(outScopes, b.buildAlterAutoIncrement(tableScope, ddl, rt))
		}

		if ddl.DefaultSpec != nil {
			outScopes = append(outScopes, b.buildAlterDefault(tableScope, ddl, rt))
		}

		if ddl.AlterCollationSpec != nil {
			outScopes = append(outScopes, b.buildAlterCollationSpec(tableScope, ddl, rt))
		}

		if ddl.AlterCommentSpec != nil {
			outScopes = append(outScopes, b.buildAlterCommentSpec(tableScope, ddl, rt))
		}

		if ddl.NotNullSpec != nil {
			outScopes = append(outScopes, b.buildAlterNotNull(tableScope, ddl, rt))
		}

		if ddl.ColumnTypeSpec != nil {
			outScopes = append(outScopes, b.buildAlterChangeColumnType(tableScope, ddl, rt))
		}

		for _, s := range outScopes {
			if ts, ok := s.node.(sql.SchemaTarget); ok {
				s.node = b.modifySchemaTarget(s, ts, rt.Schema())
			}
		}
		pkt, _ := rt.Table.(sql.PrimaryKeyTable)
		if pkt != nil {
			for _, s := range outScopes {
				if ts, ok := s.node.(sql.PrimaryKeySchemaTarget); ok {
					s.node = b.modifySchemaTarget(inScope, ts, rt.Schema())
					ts.WithPrimaryKeySchema(pkt.PrimaryKeySchema())
				}
			}
		}
	}
	return outScopes
}

func (b *Builder) buildAlterTableColumnAction(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	switch strings.ToLower(ddl.ColumnAction) {
	case ast.AddStr:
		sch, _, _ := b.tableSpecToSchema(inScope, outScope, table.Database(), ddl.Table.Name.String(), ddl.TableSpec, true)
		outScope.node = plan.NewAddColumnResolved(table, *sch.Schema[0], columnOrderToColumnOrder(ddl.ColumnOrder))
	case ast.DropStr:
		drop := plan.NewDropColumnResolved(table, ddl.Column.String())
		checks := b.loadChecksFromTable(outScope, table.Table)
		outScope.node = drop.WithChecks(checks)
	case ast.RenameStr:
		rename := plan.NewRenameColumnResolved(table, ddl.Column.String(), ddl.ToColumn.String())
		checks := b.loadChecksFromTable(outScope, table.Table)
		outScope.node = rename.WithChecks(checks)
	case ast.ModifyStr, ast.ChangeStr:
		// modify adds a new column maybe with same name
		// make new hierarchy so it resolves before old column
		outScope = inScope.push()
		sch, _, _ := b.tableSpecToSchema(inScope, outScope, table.Database(), ddl.Table.Name.String(), ddl.TableSpec, true)
		modifyCol := plan.NewModifyColumnResolved(table, ddl.Column.String(), *sch.Schema[0], columnOrderToColumnOrder(ddl.ColumnOrder))
		outScope.node = modifyCol
	default:
		err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
		b.handleErr(err)
	}

	return outScope
}

func (b *Builder) buildAlterConstraint(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	parsedConstraint := b.convertConstraintDefinition(inScope, ddl.TableSpec.Constraints[0])
	switch strings.ToLower(ddl.ConstraintAction) {
	case ast.AddStr:
		switch c := parsedConstraint.(type) {
		case *sql.ForeignKeyConstraint:
			c.Database = table.SqlDatabase.Name()
			c.Table = table.Name()

			ds, ok := table.SqlDatabase.(sql.DatabaseSchema)
			if ok {
				c.SchemaName = ds.SchemaName()
			}

			if err := b.validateOnUpdateOnDeleteRefActions(c); err != nil {
				b.handleErr(err)
			}
			alterFk := plan.NewAlterAddForeignKey(c)
			alterFk.DbProvider = b.cat
			outScope.node = alterFk
		case *sql.CheckConstraint:
			outScope.node = plan.NewAlterAddCheck(table, c)
		default:
			err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
			b.handleErr(err)
		}
	case ast.DropStr:
		switch c := parsedConstraint.(type) {
		case *sql.ForeignKeyConstraint:
			database := table.SqlDatabase.Name()
			dropFk := plan.NewAlterDropForeignKey(database, table.Name(), c.Name)
			dropFk.DbProvider = b.cat
			outScope.node = dropFk
		case *sql.CheckConstraint:
			outScope.node = plan.NewAlterDropCheck(table, c.Name)
		case namedConstraint:
			outScope.node = &plan.DropConstraint{
				UnaryNode: plan.UnaryNode{Child: table},
				Name:      c.name,
				IfExists:  ddl.ConstraintIfExists,
			}
		default:
			err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
			b.handleErr(err)
		}
	case ast.RenameStr:
		if len(ddl.TableSpec.Constraints) != 2 {
			err := sql.ErrUnsupportedFeature.New("expected two constraints for rename constraint")
			b.handleErr(err)
		}
		switch c := parsedConstraint.(type) {
		case *sql.ForeignKeyConstraint:
			otherConstraint := b.convertConstraintDefinition(inScope, ddl.TableSpec.Constraints[1])
			cc, ok := otherConstraint.(*sql.ForeignKeyConstraint)
			if !ok {
				err := sql.ErrUnsupportedFeature.New("expected foreign key constraint")
				b.handleErr(err)
			}
			database := table.SqlDatabase.Name()

			ds, ok := table.SqlDatabase.(sql.DatabaseSchema)
			if ok {
				c.SchemaName = ds.SchemaName()
			}

			dropFk := plan.NewAlterRenameForeignKey(database, table.Name(), c.Name, cc.Name)
			dropFk.DbProvider = b.cat
			outScope.node = dropFk
		default:
			// TODO: *sql.CheckConstraint, namedConstraint
			err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
			b.handleErr(err)
		}
	}
	return
}

func (b *Builder) buildConstraintsDefs(inScope *scope, tname ast.TableName, spec *ast.TableSpec) (fks []*sql.ForeignKeyConstraint, checks []*sql.CheckConstraint) {
	for _, unknownConstraint := range spec.Constraints {
		parsedConstraint := b.convertConstraintDefinition(inScope, unknownConstraint)
		switch constraint := parsedConstraint.(type) {
		case *sql.ForeignKeyConstraint:
			constraint.Database = tname.DbQualifier.String()
			constraint.Table = tname.Name.String()
			if err := b.validateOnUpdateOnDeleteRefActions(constraint); err != nil {
				b.handleErr(err)
			}
			if constraint.Database == "" {
				constraint.Database = b.ctx.GetCurrentDatabase()
			}
			fks = append(fks, constraint)
		case *sql.CheckConstraint:
			checks = append(checks, constraint)
		default:
			err := sql.ErrUnknownConstraintDefinition.New(unknownConstraint.Name, unknownConstraint)
			b.handleErr(err)
		}
	}
	return
}

func columnOrderToColumnOrder(order *ast.ColumnOrder) *sql.ColumnOrder {
	if order == nil {
		return nil
	}
	if order.First {
		return &sql.ColumnOrder{First: true}
	} else {
		return &sql.ColumnOrder{AfterColumn: order.AfterColumn.String()}
	}
}

func (b *Builder) buildIndexDefs(_ *scope, spec *ast.TableSpec) (idxDefs sql.IndexDefs) {
	for _, idxDef := range spec.Indexes {
		constraint := sql.IndexConstraint_None
		if idxDef.Info.Primary {
			constraint = sql.IndexConstraint_Primary
		} else if idxDef.Info.Unique {
			constraint = sql.IndexConstraint_Unique
		} else if idxDef.Info.Spatial {
			constraint = sql.IndexConstraint_Spatial
		} else if idxDef.Info.Fulltext {
			constraint = sql.IndexConstraint_Fulltext
		} else if idxDef.Info.Vector {
			// TODO: different kinds of vector HNSW, IVFFLAT, etc...
			constraint = sql.IndexConstraint_Vector
		}

		columns := b.gatherIndexColumns(idxDef.Columns)

		var comment string
		for _, option := range idxDef.Options {
			if strings.ToLower(option.Name) == strings.ToLower(ast.KeywordString(ast.COMMENT_KEYWORD)) {
				comment = string(option.Value.Val)
			}
		}
		idxDefs = append(idxDefs, &sql.IndexDef{
			Name:       idxDef.Info.Name.String(),
			Storage:    sql.IndexUsing_Default, //TODO: add vitess support for USING
			Constraint: constraint,
			Columns:    columns,
			Comment:    comment,
		})
	}

	for _, colDef := range spec.Columns {
		if colDef.Type.KeyOpt == colKeyFulltextKey {
			idxDefs = append(idxDefs, &sql.IndexDef{
				Storage:    sql.IndexUsing_Default,
				Constraint: sql.IndexConstraint_Fulltext,
				Columns: []sql.IndexColumn{
					{
						Name: colDef.Name.String(),
					},
				},
			})
			continue
		}
		if colDef.Type.KeyOpt == colKeyUnique || colDef.Type.KeyOpt == colKeyUniqueKey {
			idxDefs = append(idxDefs, &sql.IndexDef{
				Storage:    sql.IndexUsing_Default,
				Constraint: sql.IndexConstraint_Unique,
				Columns: []sql.IndexColumn{
					{
						Name: colDef.Name.String(),
					},
				},
			})
		}
	}
	return
}

type namedConstraint struct {
	name string
}

func (b *Builder) convertConstraintDefinition(inScope *scope, cd *ast.ConstraintDefinition) interface{} {
	if fkConstraint, ok := cd.Details.(*ast.ForeignKeyDefinition); ok {
		columns := make([]string, len(fkConstraint.Source))
		for i, col := range fkConstraint.Source {
			columns[i] = col.String()
		}
		refColumns := make([]string, len(fkConstraint.ReferencedColumns))
		for i, col := range fkConstraint.ReferencedColumns {
			refColumns[i] = col.String()
		}
		refDatabase := fkConstraint.ReferencedTable.DbQualifier.String()
		if refDatabase == "" {
			refDatabase = b.ctx.GetCurrentDatabase()
		}
		// The database and table are set in the calling function
		return &sql.ForeignKeyConstraint{
			Name:           cd.Name,
			Columns:        columns,
			ParentDatabase: refDatabase,
			ParentSchema:   fkConstraint.ReferencedTable.SchemaQualifier.String(),
			ParentTable:    fkConstraint.ReferencedTable.Name.String(),
			ParentColumns:  refColumns,
			OnUpdate:       b.buildReferentialAction(fkConstraint.OnUpdate),
			OnDelete:       b.buildReferentialAction(fkConstraint.OnDelete),
			IsResolved:     false,
		}
	} else if chConstraint, ok := cd.Details.(*ast.CheckConstraintDefinition); ok {
		var c sql.Expression
		if chConstraint.Expr != nil {
			c = b.buildScalar(inScope, chConstraint.Expr)
		}

		return &sql.CheckConstraint{
			Name:     cd.Name,
			Expr:     c,
			Enforced: chConstraint.Enforced,
		}
	} else if len(cd.Name) > 0 && cd.Details == nil {
		return namedConstraint{cd.Name}
	}
	err := sql.ErrUnknownConstraintDefinition.New(cd.Name, cd)
	b.handleErr(err)
	return nil
}

func (b *Builder) buildReferentialAction(action ast.ReferenceAction) sql.ForeignKeyReferentialAction {
	switch action {
	case ast.Restrict:
		return sql.ForeignKeyReferentialAction_Restrict
	case ast.Cascade:
		return sql.ForeignKeyReferentialAction_Cascade
	case ast.NoAction:
		return sql.ForeignKeyReferentialAction_NoAction
	case ast.SetNull:
		return sql.ForeignKeyReferentialAction_SetNull
	case ast.SetDefault:
		return sql.ForeignKeyReferentialAction_SetDefault
	default:
		return sql.ForeignKeyReferentialAction_DefaultAction
	}
}

func (b *Builder) buildAlterIndex(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	switch strings.ToLower(ddl.IndexSpec.Action) {
	case ast.CreateStr:
		var using sql.IndexUsing
		switch ddl.IndexSpec.Using.Lowered() {
		case "", "btree":
			using = sql.IndexUsing_BTree
		case "hash":
			using = sql.IndexUsing_Hash
		default:
			return b.buildExternalCreateIndex(inScope, ddl)
		}

		var constraint sql.IndexConstraint
		switch ddl.IndexSpec.Type {
		case ast.UniqueStr:
			constraint = sql.IndexConstraint_Unique
		case ast.FulltextStr:
			constraint = sql.IndexConstraint_Fulltext
		case ast.SpatialStr:
			constraint = sql.IndexConstraint_Spatial
		case ast.VectorStr:
			constraint = sql.IndexConstraint_Vector
		case ast.PrimaryStr:
			constraint = sql.IndexConstraint_Primary
		default:
			constraint = sql.IndexConstraint_None
		}

		columns := b.gatherIndexColumns(ddl.IndexSpec.Columns)

		var comment string
		for _, option := range ddl.IndexSpec.Options {
			if strings.ToLower(option.Name) == strings.ToLower(ast.KeywordString(ast.COMMENT_KEYWORD)) {
				comment = string(option.Value.Val)
			}
		}

		if constraint == sql.IndexConstraint_Primary {
			outScope.node = plan.NewAlterCreatePk(table.SqlDatabase, table, columns)
			return
		}

		indexName := ddl.IndexSpec.ToName.String()
		if strings.ToLower(indexName) == ast.PrimaryStr {
			err := sql.ErrInvalidIndexName.New(indexName)
			b.handleErr(err)
		}

		createIndex := plan.NewAlterCreateIndex(
			table.SqlDatabase,
			table,
			ddl.IfNotExists,
			ddl.IndexSpec.ToName.String(),
			using,
			constraint,
			columns,
			comment,
		)
		outScope.node = b.modifySchemaTarget(inScope, createIndex, table.Schema())
		return
	case ast.DropStr:
		if ddl.IndexSpec.Type == ast.PrimaryStr {
			outScope.node = plan.NewAlterDropPk(table.SqlDatabase, table)
			return
		}
		outScope.node = plan.NewAlterDropIndex(table.Database(), table, ddl.IfExists, ddl.IndexSpec.ToName.String())
		return
	case ast.RenameStr:
		outScope.node = plan.NewAlterRenameIndex(table.Database(), table, ddl.IndexSpec.FromName.String(), ddl.IndexSpec.ToName.String())
		return
	case "disable":
		outScope.node = plan.NewAlterDisableEnableKeys(table.SqlDatabase, table, true)
		return
	case "enable":
		outScope.node = plan.NewAlterDisableEnableKeys(table.SqlDatabase, table, false)
		return
	default:
		err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
		b.handleErr(err)
	}
	return
}

func (b *Builder) gatherIndexColumns(cols []*ast.IndexColumn) []sql.IndexColumn {
	out := make([]sql.IndexColumn, len(cols))
	for i, col := range cols {
		var length int64
		var err error
		if col.Length != nil && col.Length.Type == ast.IntVal {
			length, err = strconv.ParseInt(string(col.Length.Val), 10, 64)
			if err != nil {
				b.handleErr(err)
			}
			if length < 1 {
				err := sql.ErrKeyZero.New(col.Column)
				b.handleErr(err)
			}
		}
		out[i] = sql.IndexColumn{
			Name:   col.Column.String(),
			Length: length,
		}
	}
	return out
}

func (b *Builder) buildAlterAutoIncrement(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	val, ok := ddl.AutoIncSpec.Value.(*ast.SQLVal)
	if !ok {
		err := sql.ErrInvalidSQLValType.New(ddl.AutoIncSpec.Value)
		b.handleErr(err)
	}

	var autoVal uint64
	if val.Type == ast.IntVal {
		i, err := strconv.ParseUint(string(val.Val), 10, 64)
		if err != nil {
			b.handleErr(err)
		}
		autoVal = i
	} else if val.Type == ast.FloatVal {
		f, err := strconv.ParseFloat(string(val.Val), 10)
		if err != nil {
			b.handleErr(err)
		}
		autoVal = uint64(f)
	} else {
		err := sql.ErrInvalidSQLValType.New(ddl.AutoIncSpec.Value)
		b.handleErr(err)
	}

	outScope.node = plan.NewAlterAutoIncrement(table.Database(), table, autoVal)
	return
}

func (b *Builder) buildAlterNotNull(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	spec := ddl.NotNullSpec

	// Resolve the schema defaults, so we don't leave around any UnresolvedColumnDefault expressions,
	// otherwise Doltgres won't be able to process these nodes.
	resolvedSchema := b.resolveSchemaDefaults(inScope, table.Schema())
	for _, c := range resolvedSchema {
		if strings.EqualFold(c.Name, spec.Column.String()) {
			colCopy := *c
			switch strings.ToLower(spec.Action) {
			case ast.SetStr:
				// Set NOT NULL constraint
				colCopy.Nullable = false
			case ast.DropStr:
				// Drop NOT NULL constraint
				colCopy.Nullable = true
			default:
				err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
				b.handleErr(err)
			}

			modifyColumn := plan.NewModifyColumnResolved(table, c.Name, colCopy, nil)
			outScope.node = b.modifySchemaTarget(inScope, modifyColumn, table.Schema())
			return
		}
	}
	err := sql.ErrTableColumnNotFound.New(table.Name(), spec.Column.String())
	b.handleErr(err)
	return
}

func (b *Builder) buildAlterChangeColumnType(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	spec := ddl.ColumnTypeSpec

	// Resolve the schema defaults, so we don't leave around any UnresolvedColumnDefault expressions,
	// otherwise Doltgres won't be able to process these nodes.
	resolvedSchema := b.resolveSchemaDefaults(inScope, table.Schema())
	for _, c := range resolvedSchema {
		if strings.EqualFold(c.Name, spec.Column.String()) {
			colCopy := *c
			typ, err := types.ColumnTypeToType(&spec.Type)
			if err != nil {
				b.handleErr(err)
				return
			}
			colCopy.Type = typ
			modifyColumn := plan.NewModifyColumnResolved(table, c.Name, colCopy, nil)
			outScope.node = b.modifySchemaTarget(inScope, modifyColumn, table.Schema())
			return
		}
	}
	err := sql.ErrTableColumnNotFound.New(table.Name(), spec.Column.String())
	b.handleErr(err)
	return
}

func (b *Builder) buildAlterDefault(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	switch strings.ToLower(ddl.DefaultSpec.Action) {
	case ast.SetStr:
		for _, c := range table.Schema() {
			if strings.EqualFold(c.Name, ddl.DefaultSpec.Column.String()) {
				defaultExpr := b.convertDefaultExpression(inScope, ddl.DefaultSpec.Value, c.Type, c.Nullable)
				defSet := plan.NewAlterDefaultSet(table.Database(), table, ddl.DefaultSpec.Column.String(), defaultExpr)
				outScope.node = b.modifySchemaTarget(inScope, defSet, table.Schema())
				return
			}
		}
		err := sql.ErrTableColumnNotFound.New(table.Name(), ddl.DefaultSpec.Column.String())
		b.handleErr(err)
		return
	case ast.DropStr:
		outScope.node = plan.NewAlterDefaultDrop(table.Database(), table, ddl.DefaultSpec.Column.String())
		return
	default:
		err := sql.ErrUnsupportedFeature.New(ast.String(ddl))
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildAlterCollationSpec(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	collation, err := sql.ParseCollation(ddl.AlterCollationSpec.CharacterSet, ddl.AlterCollationSpec.Collation, false)
	if err != nil {
		b.handleErr(err)
	}
	outScope.node = plan.NewAlterTableCollationResolved(table, collation)
	return
}

func (b *Builder) buildAlterCommentSpec(inScope *scope, ddl *ast.DDL, table *plan.ResolvedTable) (outScope *scope) {
	outScope = inScope
	outScope.node = plan.NewAlterTableComment(table, ddl.AlterCommentSpec.Comment)
	return
}

func (b *Builder) buildDefaultExpression(inScope *scope, defaultExpr ast.Expr) *sql.ColumnDefaultValue {
	if defaultExpr == nil {
		return nil
	}
	parsedExpr := b.buildScalar(inScope, defaultExpr)

	// Function expressions must be enclosed in parentheses (except for current_timestamp() and now())
	_, isParenthesized := defaultExpr.(*ast.ParenExpr)
	isLiteral := !isParenthesized

	// A literal will never have children, thus we can also check for that.
	if unaryExpr, is := defaultExpr.(*ast.UnaryExpr); is {
		if _, lit := unaryExpr.Expr.(*ast.SQLVal); lit {
			isLiteral = true
		}
	} else if !isParenthesized {
		if f, ok := parsedExpr.(*expression.UnresolvedFunction); ok {
			// Datetime and Timestamp columns allow now and current_timestamp to not be enclosed in parens,
			// but they still need to be treated as function expressions
			switch strings.ToLower(f.Name()) {
			case "now", "current_timestamp", "localtime", "localtimestamp":
				isLiteral = false
			default:
				err := sql.ErrSyntaxError.New("column default function expressions must be enclosed in parentheses")
				b.handleErr(err)
			}
		}
	}

	return ExpressionToColumnDefaultValue(parsedExpr, isLiteral, isParenthesized)
}

// ExpressionToColumnDefaultValue takes in an Expression and returns the equivalent ColumnDefaultValue if the expression
// is valid for a default value. If the expression represents a literal (and not an expression that returns a literal, so "5"
// rather than "(5)"), then the parameter "isLiteral" should be true.
func ExpressionToColumnDefaultValue(inputExpr sql.Expression, isLiteral, isParenthesized bool) *sql.ColumnDefaultValue {
	return &sql.ColumnDefaultValue{
		Expr:          inputExpr,
		OutType:       nil,
		Literal:       isLiteral,
		ReturnNil:     true,
		Parenthesized: isParenthesized,
	}
}

func (b *Builder) buildExternalCreateIndex(inScope *scope, ddl *ast.DDL) (outScope *scope) {
	config := make(map[string]string)
	for _, option := range ddl.IndexSpec.Options {
		if option.Using != "" {
			config[option.Name] = option.Using
		} else {
			config[option.Name] = string(option.Value.Val)
		}
	}

	dbName := strings.ToLower(ddl.Table.DbQualifier.String())
	tblName := strings.ToLower(ddl.Table.Name.String())

	var ok bool
	outScope, ok = b.buildTablescan(inScope, ddl.Table, nil)
	if !ok {
		b.handleErr(sql.ErrTableNotFound.New(tblName))
	}
	table, ok := outScope.node.(*plan.ResolvedTable)
	if !ok {
		err := fmt.Errorf("expected resolved table: %s", tblName)
		b.handleErr(err)
	}

	tableId := outScope.tables[tblName]
	cols := make([]sql.Expression, len(ddl.IndexSpec.Columns))
	for i, col := range ddl.IndexSpec.Columns {
		colName := strings.ToLower(col.Column.String())
		c, ok := inScope.resolveColumn(dbName, tblName, colName, true, false)
		if !ok {
			b.handleErr(sql.ErrColumnNotFound.New(colName))
		}
		cols[i] = expression.NewGetFieldWithTable(int(c.id), int(tableId), c.typ, c.db, c.table, c.col, c.nullable)
	}

	createIndex := plan.NewCreateIndex(
		ddl.IndexSpec.ToName.String(),
		table,
		cols,
		ddl.IndexSpec.Using.Lowered(),
		config,
	)
	createIndex.Catalog = b.cat
	outScope.node = createIndex
	return
}

// validatePrec ensures that the Time functions used for OnUpdate for columns is correct
func validatePrec(expr sql.Expression, colPrec int) (bool, error) {
	now, ok := expr.(*function.Now)
	if !ok {
		return true, nil
	}
	children := now.Children()
	if len(children) == 0 {
		return colPrec == 0, nil
	}
	lit, isLit := children[0].(*expression.Literal)
	if !isLit {
		return true, nil
	}
	val, err := lit.Eval(nil, nil)
	if err != nil {
		return false, err
	}
	prec, ok := types.CoalesceInt(val)
	if !ok {
		return false, nil
	}
	return prec == colPrec, nil
}

// validateDefaultExprs ensures that the Time functions used for OnUpdate for columns is correct
func validateDefaultExprs(col *sql.Column) error {
	if col.Default == nil {
		return nil
	}
	if !(types.IsDatetimeType(col.Type) || types.IsTimestampType(col.Type)) {
		return nil
	}
	var colPrec int
	if dt, ok := col.Type.(sql.DatetimeType); ok {
		colPrec = dt.Precision()
	}
	if isValid, err := validatePrec(col.Default.Expr, colPrec); err != nil {
		return err
	} else if !isValid {
		return sql.ErrInvalidColumnDefaultValue.New(col.Name)
	}
	return nil
}

// validateOnUpdateExprs ensures that the Time functions used for OnUpdate for columns is correct
func validateOnUpdateExprs(col *sql.Column) error {
	if col.OnUpdate == nil {
		return nil
	}
	if !(types.IsDatetimeType(col.Type) || types.IsTimestampType(col.Type)) {
		return sql.ErrInvalidOnUpdate.New(col.Name)
	}
	var colPrec int
	if dt, ok := col.Type.(sql.DatetimeType); ok {
		colPrec = dt.Precision()
	}
	if isValid, err := validatePrec(col.OnUpdate.Expr, colPrec); err != nil {
		return err
	} else if !isValid {
		return sql.ErrInvalidOnUpdate.New(col.Name)
	}
	return nil
}

// TableSpecToSchema creates a sql.Schema from a parsed TableSpec and returns the parsed primary key schema, collation ID, and table comment.
func (b *Builder) tableSpecToSchema(inScope, outScope *scope, db sql.Database, tableName string, tableSpec *ast.TableSpec, forceInvalidCollation bool) (sql.PrimaryKeySchema, sql.CollationID, map[string]interface{}) {
	// TODO: helper method?
	tblOpts := make(map[string]interface{})
	for _, tblOpt := range tableSpec.TableOpts {
		optName := strings.ToLower(tblOpt.Name)
		var optVal interface{}
		switch optName {
		case "auto_increment":
			// convert string to uint64
			val, err := strconv.ParseUint(tblOpt.Value, 10, 64)
			if err != nil {
				b.handleErr(err)
			}
			optVal = val
		default:
			optVal = tblOpt.Value
		}
		// TODO: deal with conflicting and duplicate table options
		tblOpts[optName] = optVal
	}

	// TODO: somewhere downstream updates an ALTER MODIFY column's type collation
	//   to match the underlying. That only happens if the type stays unspecified.

	tableCollation := sql.Collation_Unspecified
	if !forceInvalidCollation {
		tableCollation = sql.Collation_Default
		if cdb, _ := db.(sql.CollatedDatabase); cdb != nil {
			tableCollation = cdb.GetCollation(b.ctx)
		}
		charsetOpt, hasCharset := tblOpts["character set"]
		if !hasCharset {
			charsetOpt = ""
		}
		collateOpt, hasCollate := tblOpts["collate"]
		if !hasCollate {
			collateOpt = ""
		}
		var err error
		tableCollation, err = sql.ParseCollation(charsetOpt.(string), collateOpt.(string), false)
		if err != nil {
			b.handleErr(err)
		}
	}

	tabId := outScope.addTable(tableName)

	defaults := make([]ast.Expr, len(tableSpec.Columns))
	generated := make([]ast.Expr, len(tableSpec.Columns))
	updates := make([]ast.Expr, len(tableSpec.Columns))
	var schema sql.Schema
	for i, cd := range tableSpec.Columns {
		if cd.Type.ResolvedType == nil {
			sqlType := cd.Type.SQLType()
			// Use the table's collation if no character or collation was specified for the table
			if len(cd.Type.Charset) == 0 && len(cd.Type.Collate) == 0 {
				if tableCollation != sql.Collation_Unspecified && !types.IsBinary(sqlType) {
					cd.Type.Collate = tableCollation.Name()
				}
			}
		}
		defaults[i] = cd.Type.Default
		generated[i] = cd.Type.GeneratedExpr
		updates[i] = cd.Type.OnUpdate

		column := b.columnDefinitionToColumn(inScope, cd, tableSpec.Indexes)
		column.DatabaseSource = db.Name()

		if column.PrimaryKey && bool(cd.Type.Null) {
			b.handleErr(ErrPrimaryKeyOnNullField.New())
		}

		schema = append(schema, column)
		outScope.newColumn(scopeColumn{
			tableId:  tabId,
			table:    tableName,
			db:       db.Name(),
			col:      strings.ToLower(column.Name),
			typ:      column.Type,
			nullable: column.Nullable,
		})
	}

	for i, def := range defaults {
		// Early validation for enum default 0 to catch it before conversion
		if def != nil && types.IsEnum(schema[i].Type) {
			if lit, ok := def.(*ast.SQLVal); ok {
				if lit.Type == ast.IntVal && string(lit.Val) == "0" {
					b.handleErr(sql.ErrInvalidColumnDefaultValue.New(schema[i].Name))
				}
			}
		}

		schema[i].Default = b.convertDefaultExpression(outScope, def, schema[i].Type, schema[i].Nullable)
		err := validateDefaultExprs(schema[i])
		if err != nil {
			b.handleErr(err)
		}
		if def != nil && generated[i] != nil {
			b.handleErr(sql.ErrGeneratedColumnWithDefault.New())
		}
	}

	for i, gen := range generated {
		if gen != nil {
			virtual := !bool(tableSpec.Columns[i].Type.Stored)
			schema[i].Generated = b.convertDefaultExpression(outScope, gen, schema[i].Type, schema[i].Nullable)
			// generated expressions are always parenthesized, but we don't record this in the parser
			schema[i].Generated.Parenthesized = true
			schema[i].Generated.Literal = false
			schema[i].Virtual = virtual
		}
	}

	for i, onUpdateExpr := range updates {
		schema[i].OnUpdate = b.convertDefaultExpression(outScope, onUpdateExpr, schema[i].Type, schema[i].Nullable)
		err := validateOnUpdateExprs(schema[i])
		if err != nil {
			b.handleErr(err)
		}
	}

	pkSch := sql.NewPrimaryKeySchema(schema, getPkOrdinals(tableSpec)...)
	return pkSch, tableCollation, tblOpts
}

// jsonTableSpecToSchemaHelper creates a sql.Schema from a parsed TableSpec
func (b *Builder) jsonTableSpecToSchemaHelper(jsonTableSpec *ast.JSONTableSpec, sch sql.Schema) {
	for _, cd := range jsonTableSpec.Columns {
		if cd.Spec != nil {
			b.jsonTableSpecToSchemaHelper(cd.Spec, sch)
			continue
		}
		typ, err := types.ColumnTypeToType(&cd.Type)
		if err != nil {
			b.handleErr(err)
		}
		col := &sql.Column{
			Type:          typ,
			Name:          cd.Name.String(),
			AutoIncrement: bool(cd.Type.Autoincrement),
		}
		sch = append(sch, col)
		continue
	}
}

// jsonTableSpecToSchema creates a sql.Schema from a parsed TableSpec
func (b *Builder) jsonTableSpecToSchema(tableSpec *ast.JSONTableSpec) sql.Schema {
	var sch sql.Schema
	b.jsonTableSpecToSchemaHelper(tableSpec, sch)
	return sch
}

// These constants aren't exported from vitess for some reason. This could be removed if we changed this.
const (
	colKeyNone ast.ColumnKeyOption = iota
	colKeyPrimary
	colKeySpatialKey
	colKeyUnique
	colKeyUniqueKey
	colKey
	colKeyFulltextKey
)

func getPkOrdinals(ts *ast.TableSpec) []int {
	for _, idxDef := range ts.Indexes {
		if idxDef.Info.Primary {

			pkOrdinals := make([]int, 0)
			colIdx := make(map[string]int)
			for i := 0; i < len(ts.Columns); i++ {
				colIdx[ts.Columns[i].Name.Lowered()] = i
			}

			for _, i := range idxDef.Columns {
				pkOrdinals = append(pkOrdinals, colIdx[i.Column.Lowered()])
			}

			return pkOrdinals
		}
	}

	// no primary key expression, check for inline PK column
	for i, col := range ts.Columns {
		if col.Type.KeyOpt == colKeyPrimary {
			return []int{i}
		}
	}

	return []int{}
}

// columnDefinitionToColumn returns the sql.Column for the column definition given, as part of a create table
// statement. Defaults and generated expressions must be handled separately.
func (b *Builder) columnDefinitionToColumn(inScope *scope, cd *ast.ColumnDefinition, indexes []*ast.IndexDefinition) *sql.Column {
	internalTyp, err := types.ColumnTypeToType(&cd.Type)
	if err != nil {
		b.handleErr(err)
	}

	// Primary key info can either be specified in the column's type info (for in-line declarations), or in a slice of
	// indexes attached to the table def. We have to check both places to find if a column is part of the primary key
	isPkey := cd.Type.KeyOpt == colKeyPrimary

	if !isPkey {
	OuterLoop:
		for _, index := range indexes {
			if index.Info.Primary {
				for _, indexCol := range index.Columns {
					if indexCol.Column.Equal(cd.Name) {
						isPkey = true
						break OuterLoop
					}
				}
			}
		}
	}

	var comment string
	if cd.Type.Comment != nil && cd.Type.Comment.Type == ast.StrVal {
		comment = string(cd.Type.Comment.Val)
	}

	nullable := !isPkey && !bool(cd.Type.NotNull)
	extra := ""

	if cd.Type.Autoincrement {
		extra = "auto_increment"
	}

	if cd.Type.SRID != nil {
		sridVal, err := strconv.ParseInt(string(cd.Type.SRID.Val), 10, 32)
		if err != nil {
			b.handleErr(err)
		}

		if err = types.ValidateSRID(int(sridVal), ""); err != nil {
			b.handleErr(err)
		}
		if s, ok := internalTyp.(sql.SpatialColumnType); ok {
			internalTyp = s.SetSRID(uint32(sridVal))
		} else {
			b.handleErr(sql.ErrInvalidType.New(fmt.Sprintf("cannot define SRID for %s", internalTyp)))
		}
	}

	return &sql.Column{
		Name:          cd.Name.String(),
		Type:          internalTyp,
		AutoIncrement: bool(cd.Type.Autoincrement),
		Nullable:      nullable && !bool(cd.Type.Autoincrement),
		PrimaryKey:    isPkey,
		Comment:       comment,
		Extra:         extra,
	}
}

// modifySchemaTarget resolves the schema defaults and sets the target schema for the node.
func (b *Builder) modifySchemaTarget(inScope *scope, n sql.SchemaTarget, sch sql.Schema) sql.Node {
	targSchema := b.resolveSchemaDefaults(inScope, sch)
	ret, err := n.WithTargetSchema(targSchema)
	if err != nil {
		b.handleErr(err)
	}
	return ret
}

// ResolveSchemaDefaults resolves any column default value expressions for the specified |schema|, for the table
// named |tableName| and returns the schema with the default value expressions resolved. Note that any GetField
// expressions in the column default value expressions have not had their indexes corrected yet.
func (b *Builder) ResolveSchemaDefaults(db string, tableName string, schema sql.Schema) sql.Schema {
	tableScope := b.newScope()
	for _, c := range schema {
		tableScope.newColumn(scopeColumn{
			table:       strings.ToLower(tableName),
			db:          strings.ToLower(db),
			col:         strings.ToLower(c.Name),
			originalCol: c.Name,
			typ:         c.Type,
			nullable:    c.Nullable,
		})
	}

	return b.resolveSchemaDefaults(tableScope, schema)
}

// validateOnUpdateOnDeleteRefActions validates that the specified |constraint| is using referential actions
// supported by the current dialect. For example, MySQL parses the syntax for the SET DEFAULT referential action,
// but doesn't actually support it, so if the MySQL parser is in use, this method will return an error stating
// that SET DEFAULT is not supported.
func (b *Builder) validateOnUpdateOnDeleteRefActions(constraint *sql.ForeignKeyConstraint) error {
	if _, ok := b.parser.(*sql.MysqlParser); ok {
		if constraint.OnUpdate == sql.ForeignKeyReferentialAction_SetDefault ||
			constraint.OnDelete == sql.ForeignKeyReferentialAction_SetDefault {
			return sql.ErrForeignKeySetDefault.New()
		}
	}

	return nil
}

func (b *Builder) resolveSchemaDefaults(inScope *scope, schema sql.Schema) sql.Schema {
	if len(schema) == 0 {
		return nil
	}
	if len(inScope.cols) < len(schema) {
		// alter statements only add definitions for modified columns
		// backfill rest of columns
		resolveScope := inScope.replace()
		for _, col := range schema {
			resolveScope.newColumn(scopeColumn{
				db:       col.DatabaseSource,
				table:    strings.ToLower(col.Source),
				col:      strings.ToLower(col.Name),
				typ:      col.Type,
				nullable: col.Nullable,
			})
		}
		inScope = resolveScope
	}

	newSch := schema.Copy()
	partitions := partitionTableColumns(newSch)
	if len(partitions) == 1 {
		for _, col := range newSch {
			col.Default = b.resolveColumnDefaultExpression(inScope, col, col.Default)
			col.Generated = b.resolveColumnDefaultExpression(inScope, col, col.Generated)
			col.OnUpdate = b.resolveColumnDefaultExpression(inScope, col, col.OnUpdate)
		}
	} else {
		for _, part := range partitions {
			start := part[0]
			end := part[1]
			subScope := inScope.replace()
			for i := start; i < end; i++ {
				subScope.addColumn(inScope.cols[i])
			}
			for _, col := range newSch[start:end] {
				col.Default = b.resolveColumnDefaultExpression(subScope, col, col.Default)
				col.Generated = b.resolveColumnDefaultExpression(subScope, col, col.Generated)
				col.OnUpdate = b.resolveColumnDefaultExpression(subScope, col, col.OnUpdate)
			}
		}
	}
	return newSch
}

// partitionTableColumns splits a sql.Schema into a list
// of [2]int{start,end} ranges that each partition the tables
// included in the schema.
func partitionTableColumns(sch sql.Schema) [][2]int {
	var ret [][2]int
	var i int = 1
	var prevI int = 0
	for i < len(sch) {
		if strings.EqualFold(sch[i-1].Source, sch[i].Source) &&
			strings.EqualFold(sch[i-1].DatabaseSource, sch[i].DatabaseSource) {
			i++
			continue
		}
		ret = append(ret, [2]int{prevI, i})
		prevI = i
		i++
	}
	ret = append(ret, [2]int{prevI, i})
	return ret
}

func (b *Builder) resolveColumnDefaultExpression(inScope *scope, columnDef *sql.Column, colDefault *sql.ColumnDefaultValue) *sql.ColumnDefaultValue {
	if colDefault == nil || colDefault.Expr == nil {
		return colDefault
	}

	def, ok := colDefault.Expr.(*sql.UnresolvedColumnDefault)
	if !ok {
		// no resolution work to be done, return the original value
		return colDefault
	}

	// Empty string is a special case, it means the default value is the empty string
	// TODO: why isn't this serialized as ''
	if def.String() == "" {
		return b.convertDefaultExpression(inScope, &ast.SQLVal{Val: []byte{}, Type: ast.StrVal}, columnDef.Type, columnDef.Nullable)
	}

	parsed, err := b.parser.ParseSimple(fmt.Sprintf("SELECT %s", def))
	if err != nil {
		err := sql.ErrInvalidColumnDefaultValue.Wrap(err, def)
		b.handleErr(err)
	}

	selectStmt, ok := parsed.(*ast.Select)
	if !ok || len(selectStmt.SelectExprs) != 1 {
		err := sql.ErrInvalidColumnDefaultValue.New(def)
		b.handleErr(err)
	}

	expr := selectStmt.SelectExprs[0]
	ae, ok := expr.(*ast.AliasedExpr)
	if !ok {
		err := sql.ErrInvalidColumnDefaultValue.New(def)
		b.handleErr(err)
	}

	return b.convertDefaultExpression(inScope, ae.Expr, columnDef.Type, columnDef.Nullable)
}

func (b *Builder) convertDefaultExpression(inScope *scope, defaultExpr ast.Expr, typ sql.Type, nullable bool) *sql.ColumnDefaultValue {
	if defaultExpr == nil {
		return nil
	}
	resExpr := b.buildScalar(inScope, defaultExpr)

	// Function expressions must be enclosed in parentheses (except for current_timestamp() and now())
	_, isParenthesized := defaultExpr.(*ast.ParenExpr)
	isLiteral := !isParenthesized

	// A literal will never have children, thus we can also check for that.
	if unaryExpr, is := defaultExpr.(*ast.UnaryExpr); is {
		if _, lit := unaryExpr.Expr.(*ast.SQLVal); lit {
			isLiteral = true
		}
	} else if !isParenthesized {
		if _, ok := resExpr.(sql.FunctionExpression); ok {
			switch resExpr.(type) {
			case *function.Now:
				// Datetime and Timestamp columns allow now and current_timestamp to not be enclosed in parens,
				// but they still need to be treated as function expressions
				isLiteral = false
			default:
				// All other functions must *always* be enclosed in parens
				err := sql.ErrSyntaxError.New("column default function expressions must be enclosed in parentheses")
				b.handleErr(err)
			}
		}
	}

	// TODO: fix the vitess parser so that it parses negative numbers as numbers and not negation of an expression
	if unaryMinusExpr, ok := resExpr.(*expression.UnaryMinus); ok {
		if literalExpr, ok := unaryMinusExpr.Child.(*expression.Literal); ok {
			switch val := literalExpr.Value().(type) {
			case float32:
				resExpr = expression.NewLiteral(-val, types.Float32)
				isLiteral = true
			case float64:
				resExpr = expression.NewLiteral(-val, types.Float64)
				isLiteral = true
			}
		}
	}

	return &sql.ColumnDefaultValue{
		Expr:          resExpr,
		OutType:       typ,
		Literal:       isLiteral,
		ReturnNil:     nullable,
		Parenthesized: isParenthesized,
	}
}

func (b *Builder) buildDBDDL(inScope *scope, c *ast.DBDDL) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, c.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	switch strings.ToLower(c.Action) {
	case ast.CreateStr:
		if strings.ContainsRune(c.DBName, '/') {
			b.handleErr(sql.ErrInvalidDatabaseName.New(c.DBName))
		}

		var charsetStr, collationStr string
		if len(c.CharsetCollate) != 0 && b.ctx != nil && b.ctx.Session != nil {
			b.ctx.Session.Warn(&sql.Warning{
				Level:   "Warning",
				Code:    mysql.ERNotSupportedYet,
				Message: "Setting CHARACTER SET, COLLATION and ENCRYPTION are not supported yet",
			})
		}
		for _, cc := range c.CharsetCollate {
			ccType := strings.ToLower(cc.Type)
			switch ccType {
			case "character set", "charset":
				charsetStr = cc.Value
			case "collate":
				collationStr = cc.Value
			}
		}
		// TODO: ensure that collation and charset match when setting them
		if len(charsetStr) == 0 && len(collationStr) == 0 {
			collation, err := b.ctx.Session.GetSessionVariable(b.ctx, "collation_server")
			if err != nil {
				b.handleErr(err)
			}
			collationStr = collation.(string)
		}
		collation, err := sql.ParseCollation(charsetStr, collationStr, false)
		if err != nil {
			b.handleErr(err)
		}

		var node sql.Node
		switch c.SchemaOrDatabase {
		case "database":
			createDb := plan.NewCreateDatabase(c.DBName, c.IfNotExists, collation)
			createDb.Catalog = b.cat
			node = createDb
		case "schema":
			createSchema := plan.NewCreateSchema(c.DBName, c.IfNotExists, collation)
			createSchema.Catalog = b.cat
			node = createSchema
		}

		outScope.node = node
	case ast.DropStr:
		dropDb := plan.NewDropDatabase(c.DBName, c.IfExists)
		dropDb.Catalog = b.cat
		outScope.node = dropDb
	case ast.AlterStr:
		if len(c.CharsetCollate) == 0 {
			if len(c.DBName) > 0 {
				b.handleErr(sql.ErrSyntaxError.New(fmt.Sprintf("alter database %s", c.DBName)))
			}
			b.handleErr(sql.ErrSyntaxError.New("alter database"))
		}
		var charsetStr, collationStr string
		for _, cc := range c.CharsetCollate {
			ccType := strings.ToLower(cc.Type)
			if ccType == "character set" {
				charsetStr = cc.Value
			} else if ccType == "collate" {
				collationStr = cc.Value
			}
		}
		collation, err := sql.ParseCollation(charsetStr, collationStr, false)
		if err != nil {
			b.handleErr(err)
		}
		alterDb := plan.NewAlterDatabase(c.DBName, collation)
		alterDb.Catalog = b.cat
		outScope.node = alterDb
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(c)))
	}
	return outScope
}

// ExtendedTypeTag is primarily used by ParseColumnTypeString when parsing strings representing extended types
const ExtendedTypeTag = "extended_"

func ParseColumnTypeString(columnType string) (sql.Type, error) {
	if strings.HasPrefix(columnType, ExtendedTypeTag) {
		columnType = columnType[len(ExtendedTypeTag):]
		// If the pipe character "|" is present, then we ignore all information after it (including the pipe), as it
		// represents a comment
		if pipeIdx := strings.Index(columnType, "|"); pipeIdx != -1 {
			columnType = columnType[:pipeIdx]
		}
		c, err := types.DeserializeTypeFromString(columnType)
		if err != nil {
			return nil, err
		}
		return c, nil
	}
	parsed, err := ast.Parse(fmt.Sprintf("create table t(a %s)", columnType))
	if err != nil {
		return nil, err
	}
	ddl, ok := parsed.(*ast.DDL)
	if !ok {
		return nil, fmt.Errorf("failed to parse type info for column: %s", columnType)
	}
	parsedTyp := ddl.TableSpec.Columns[0].Type
	typ, err := types.ColumnTypeToType(&parsedTyp)
	if err != nil {
		return nil, err
	}
	if parsedTyp.SRID != nil {
		sridVal, err := strconv.ParseInt(string(parsedTyp.SRID.Val), 10, 32)
		if err != nil {
			return nil, err
		}

		if err = types.ValidateSRID(int(sridVal), ""); err != nil {
			return nil, err
		}
		if s, ok := typ.(sql.SpatialColumnType); ok {
			typ = s.SetSRID(uint32(sridVal))
		} else {
			return nil, sql.ErrInvalidType.New(fmt.Sprintf("cannot define SRID for %s", typ))
		}
	}
	return typ, nil
}

var _ sql.Database = dummyDb{}

type dummyDb struct {
	name string
}

func (d dummyDb) Name() string                 { return d.name }
func (d dummyDb) Tables() map[string]sql.Table { return nil }
func (d dummyDb) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
	return nil, false, nil
}
func (d dummyDb) GetTableNames(ctx *sql.Context) ([]string, error) {
	return nil, nil
}
