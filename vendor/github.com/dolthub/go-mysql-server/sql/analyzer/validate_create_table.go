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

package analyzer

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const MaxBytePrefix = 3072

// validateCreateTable validates various constraints about CREATE TABLE statements.
func validateCreateTable(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	ct, ok := n.(*plan.CreateTable)
	if !ok {
		return n, transform.SameTree, nil
	}

	err := validateIdentifiers(ct)
	if err != nil {
		return nil, transform.SameTree, err
	}

	sch := ct.PkSchema().Schema
	idxs := ct.Indexes()

	// First validate auto_increment columns before other validations
	// This ensures proper error precedence matching MySQL behavior
	keyedColumns := make(map[string]bool)
	for _, index := range idxs {
		for _, col := range index.Columns {
			keyedColumns[col.Name] = true
		}
	}

	err = validateAutoIncrementModify(sch, keyedColumns)
	if err != nil {
		return nil, transform.SameTree, err
	}

	strictMySQLCompat, err := isStrictMysqlCompatibilityEnabled(ctx)
	if err != nil {
		return nil, transform.SameTree, err
	}
	err = validateIndexes(ctx, sch, idxs, strictMySQLCompat)
	if err != nil {
		return nil, transform.SameTree, err
	}

	err = validateNoVirtualColumnsInPrimaryKey(sch)
	if err != nil {
		return nil, transform.SameTree, err
	}

	return n, transform.SameTree, nil
}

func validateNoVirtualColumnsInPrimaryKey(sch sql.Schema) error {
	for _, c := range sch {
		if c.PrimaryKey && c.Virtual {
			return sql.ErrVirtualColumnPrimaryKey.New()
		}
	}
	return nil
}

// validateAlterTable is a set of validation functions for ALTER TABLE statements not handled by more specific
// validation rules
func validateAlterTable(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var err error
	// Inspect is required here because alter table statements with multiple clauses are represented as a block of
	// plan nodes
	transform.Inspect(n, func(sql.Node) bool {
		switch n := n.(type) {
		case *plan.RenameTable:
			for _, name := range n.NewNames {
				err = ValidateIdentifier(name)
				if err != nil {
					return false
				}
			}
		case *plan.CreateCheck:
			err = ValidateIdentifier(n.Check.Name)
			if err != nil {
				return false
			}
		case *plan.CreateForeignKey:
			err = ValidateIdentifier(n.FkDef.Name)
			if err != nil {
				return false
			}
		}

		return true
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	return n, transform.SameTree, nil
}

// validateIdentifiers validates various constraints about identifiers in CREATE TABLE / ALTER TABLE statements.
func validateIdentifiers(ct *plan.CreateTable) error {
	if len(ct.Name()) > sql.MaxIdentifierLength {
		return sql.ErrInvalidIdentifier.New(ct.Name())
	}

	colNames := make(map[string]bool)
	for _, col := range ct.PkSchema().Schema {
		if len(col.Name) > sql.MaxIdentifierLength {
			return sql.ErrInvalidIdentifier.New(col.Name)
		}
		lower := strings.ToLower(col.Name)
		if colNames[lower] {
			return sql.ErrDuplicateColumn.New(col.Name)
		}
		colNames[lower] = true
	}

	for _, chDef := range ct.Checks() {
		if len(chDef.Name) > sql.MaxIdentifierLength {
			return sql.ErrInvalidIdentifier.New(chDef.Name)
		}
	}

	for _, idxDef := range ct.Indexes() {
		if len(idxDef.Name) > sql.MaxIdentifierLength {
			return sql.ErrInvalidIdentifier.New(idxDef.Name)
		}
	}

	for _, fkDef := range ct.ForeignKeys() {
		if len(fkDef.Name) > sql.MaxIdentifierLength {
			return sql.ErrInvalidIdentifier.New(fkDef.Name)
		}
	}

	return nil
}

func resolveAlterColumn(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlagAlterTable) {
		return n, transform.SameTree, nil
	}

	var sch sql.Schema
	var indexes []string
	var validator sql.SchemaValidator
	keyedColumns := make(map[string]bool)
	var err error
	transform.Inspect(n, func(n sql.Node) bool {
		if st, ok := n.(sql.SchemaTarget); ok {
			sch = st.TargetSchema()
		}
		switch n := n.(type) {
		case *plan.ModifyColumn:
			if rt, ok := n.Table.(*plan.ResolvedTable); ok {
				if sv, ok := rt.UnwrappedDatabase().(sql.SchemaValidator); ok {
					validator = sv
				}
			}
			keyedColumns, err = GetTableIndexColumns(ctx, n.Table)
			return false
		case *plan.RenameColumn:
			if rt, ok := n.Table.(*plan.ResolvedTable); ok {
				if sv, ok := rt.UnwrappedDatabase().(sql.SchemaValidator); ok {
					validator = sv
				}
			}
			return false
		case *plan.AddColumn:
			if rt, ok := n.Table.(*plan.ResolvedTable); ok {
				if sv, ok := rt.UnwrappedDatabase().(sql.SchemaValidator); ok {
					validator = sv
				}
			}
			keyedColumns, err = GetTableIndexColumns(ctx, n.Table)
			return false
		case *plan.DropColumn:
			if rt, ok := n.Table.(*plan.ResolvedTable); ok {
				if sv, ok := rt.UnwrappedDatabase().(sql.SchemaValidator); ok {
					validator = sv
				}
			}
			return false
		case *plan.AlterIndex:
			if rt, ok := n.Table.(*plan.ResolvedTable); ok {
				if sv, ok := rt.UnwrappedDatabase().(sql.SchemaValidator); ok {
					validator = sv
				}
			}
			indexes, err = GetTableIndexNames(ctx, a, n.Table)
		default:
		}
		return true
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	// Skip this validation if we didn't find one or more of the above node types
	if len(sch) == 0 {
		return n, transform.SameTree, nil
	}

	sch = sch.Copy() // Make a copy of the original schema to deal with any references to the original table.
	initialSch := sch

	addedColumn := false

	// Need a TransformUp here because multiple of these statement types can be nested under a Block node.
	// It doesn't look it, but this is actually an iterative loop over all the independent clauses in an ALTER statement
	n, same, err := transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch nn := n.(type) {
		case *plan.ModifyColumn:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}

			sch, err = ValidateModifyColumn(ctx, initialSch, sch, n.(*plan.ModifyColumn), keyedColumns)
			if err != nil {
				return nil, transform.SameTree, err
			}
			return n, transform.NewTree, nil
		case *plan.RenameColumn:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			sch, err = ValidateRenameColumn(initialSch, sch, n.(*plan.RenameColumn))
			if err != nil {
				return nil, transform.SameTree, err
			}
			return n, transform.NewTree, nil
		case *plan.AddColumn:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}

			sch, err = ValidateAddColumn(sch, n.(*plan.AddColumn))
			if err != nil {
				return nil, transform.SameTree, err
			}

			addedColumn = true
			return n, transform.NewTree, nil
		case *plan.DropColumn:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			sch, err = ValidateDropColumn(initialSch, sch, n.(*plan.DropColumn))
			if err != nil {
				return nil, transform.SameTree, err
			}
			delete(keyedColumns, nn.Column)

			return n, transform.NewTree, nil
		case *plan.AlterIndex:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			indexes, err = validateAlterIndex(ctx, initialSch, sch, n.(*plan.AlterIndex), indexes)
			if err != nil {
				return nil, transform.SameTree, err
			}

			keyedColumns = UpdateKeyedColumns(keyedColumns, nn)
			return n, transform.NewTree, nil
		case *plan.AlterPK:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			sch, err = validatePrimaryKey(ctx, initialSch, sch, n.(*plan.AlterPK))
			if err != nil {
				return nil, transform.SameTree, err
			}
			return n, transform.NewTree, nil
		case *plan.AlterDefaultSet:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			sch, err = ValidateAlterDefault(initialSch, sch, n.(*plan.AlterDefaultSet))
			if err != nil {
				return nil, transform.SameTree, err
			}
			return n, transform.NewTree, nil
		case *plan.AlterDefaultDrop:
			n, err := nn.WithTargetSchema(sch.Copy())
			if err != nil {
				return nil, transform.SameTree, err
			}
			sch, err = ValidateDropDefault(initialSch, sch, n.(*plan.AlterDefaultDrop))
			if err != nil {
				return nil, transform.SameTree, err
			}
			return n, transform.NewTree, nil
		}
		return n, transform.SameTree, nil
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	if validator != nil {
		if err := validator.ValidateSchema(sch); err != nil {
			return nil, transform.SameTree, err
		}
	}

	// We can't evaluate auto-increment until the end of the analysis, since we break adding a new auto-increment unique
	// column into two steps: first add the column, then create the index. If there was no index created, that's an error.
	if addedColumn {
		err = validateAutoIncrementModify(sch, keyedColumns)
		if err != nil {
			return nil, false, err
		}
	}

	return n, same, nil
}

// UpdateKeyedColumns updates the keyedColumns map based on the action of the AlterIndex node
func UpdateKeyedColumns(keyedColumns map[string]bool, n *plan.AlterIndex) map[string]bool {
	switch n.Action {
	case plan.IndexAction_Create:
		for _, col := range n.Columns {
			keyedColumns[col.Name] = true
		}
	case plan.IndexAction_Drop:
		for _, col := range n.Columns {
			delete(keyedColumns, col.Name)
		}
	}

	return keyedColumns
}

// ValidateRenameColumn checks that a DDL RenameColumn node can be safely executed (e.g. no collision with other
// column names, doesn't invalidate any table check constraints).
//
// Note that schema is passed in twice, because one version is the initial version before the alter column expressions
// are applied, and the second version is the current schema that is being modified as multiple nodes are processed.
func ValidateRenameColumn(initialSch, sch sql.Schema, rc *plan.RenameColumn) (sql.Schema, error) {
	table := rc.Table
	nameable := table.(sql.Nameable)

	err := ValidateIdentifier(rc.NewColumnName)
	if err != nil {
		return nil, err
	}

	// Check for column name collisions
	if sch.Contains(rc.NewColumnName, nameable.Name()) {
		return nil, sql.ErrColumnExists.New(rc.NewColumnName)
	}

	// Make sure this column exists. MySQL only checks the original schema, which means you can't add a column and
	// rename it in the same statement. But, it also has to exist in the modified schema -- it can't have been renamed or
	// dropped in this statement.
	if !initialSch.Contains(rc.ColumnName, nameable.Name()) || !sch.Contains(rc.ColumnName, nameable.Name()) {
		return nil, sql.ErrTableColumnNotFound.New(nameable.Name(), rc.ColumnName)
	}

	err = ValidateColumnNotUsedInCheckConstraint(rc.ColumnName, rc.Checks())
	if err != nil {
		return nil, err
	}

	return renameInSchema(sch, rc.ColumnName, rc.NewColumnName, nameable.Name()), nil
}

// ValidateAddColumn validates that the column specified in |ac| can be added to the specified
// |schema|. A new Schema is returned, with the added column, if the column can be added. Otherwise,
// an error is returned if there are any validation errors.
func ValidateAddColumn(schema sql.Schema, ac *plan.AddColumn) (sql.Schema, error) {
	table := ac.Table
	nameable := table.(sql.Nameable)

	err := ValidateIdentifier(ac.Column().Name)
	if err != nil {
		return nil, err
	}

	// Name collisions
	if schema.Contains(ac.Column().Name, nameable.Name()) {
		return nil, sql.ErrColumnExists.New(ac.Column().Name)
	}

	// Make sure columns named in After clause exist
	idx := -1
	if ac.Order() != nil && ac.Order().AfterColumn != "" {
		afterColumn := ac.Order().AfterColumn
		idx = schema.IndexOf(afterColumn, nameable.Name())
		if idx < 0 {
			return nil, sql.ErrTableColumnNotFound.New(nameable.Name(), afterColumn)
		}
	}

	newSch := make(sql.Schema, 0, len(schema)+1)
	if idx >= 0 {
		newSch = append(newSch, schema[:idx+1]...)
		newSch = append(newSch, ac.Column().Copy())
		newSch = append(newSch, schema[idx+1:]...)
	} else { // new column at end
		newSch = append(newSch, schema...)
		newSch = append(newSch, ac.Column().Copy())
	}

	return newSch, nil
}

// isStrictMysqlCompatibilityEnabled returns true if the strict_mysql_compatibility SQL system variable has been
// turned on in this session, otherwise it returns false, or any unexpected error querying the system variable.
func isStrictMysqlCompatibilityEnabled(ctx *sql.Context) (bool, error) {
	strictMysqlCompatibility, err := ctx.GetSessionVariable(ctx, "strict_mysql_compatibility")
	if err != nil {
		return false, err
	}
	i, ok := strictMysqlCompatibility.(int8)
	if !ok {
		return false, nil
	}
	return i == 1, nil
}

func ValidateModifyColumn(ctx *sql.Context, initialSch sql.Schema, schema sql.Schema, mc *plan.ModifyColumn, keyedColumns map[string]bool) (sql.Schema, error) {
	table := mc.Table
	tableName := table.(sql.Nameable).Name()

	// The old column must exist in the original schema before this statement was run.
	// It cannot have been renamed in the same statement.
	oldColName := mc.Column()
	if !schema.Contains(oldColName, tableName) || !initialSch.Contains(oldColName, tableName) {
		return nil, sql.ErrTableColumnNotFound.New(tableName, oldColName)
	}

	newCol := mc.NewColumn()
	if err := ValidateIdentifier(newCol.Name); err != nil {
		return nil, err
	}

	newSch := replaceInSchema(schema, newCol, tableName)
	if err := validateAutoIncrementModify(newSch, keyedColumns); err != nil {
		return nil, err
	}

	// TODO: When a column is being modified, we should ideally check that any existing table check constraints
	//       are still valid (e.g. if the column type changed) and throw an error if they are invalidated.
	//       That would be consistent with MySQL behavior.

	// not becoming a text/blob or json column
	if !types.IsTextBlob(newCol.Type) && !types.IsJSON(newCol.Type) {
		return newSch, nil
	}

	strictMySQLCompat, err := isStrictMysqlCompatibilityEnabled(ctx)
	if err != nil {
		return nil, err
	}

	// any indexes that use this column must have a prefix length
	ia, err := newIndexAnalyzerForNode(ctx, table)
	if err != nil {
		return nil, err
	}

	// TODO: not sure how this is different than `table` and `tableName`
	// Get underlying table and table name
	tbl := getTable(table)
	tblName := getTableName(table)
	indexes := ia.IndexesByTable(ctx, ctx.GetCurrentDatabase(), tblName)
	for _, index := range indexes {
		if index.IsFullText() {
			continue
		}
		prefixLengths := index.PrefixLengths()
		for i, expr := range index.Expressions() {
			col := plan.GetColumnFromIndexExpr(expr, tbl)
			if !strings.EqualFold(col.Name, oldColName) {
				continue
			}
			if types.IsJSON(newCol.Type) && !index.IsVector() {
				return nil, sql.ErrJSONIndex.New(col.Name)
			}
			var prefixLen int64
			if i < len(prefixLengths) {
				prefixLen = int64(prefixLengths[i])
			}
			err = validatePrefixLength(ctx, oldColName, prefixLen, newCol.Type, strictMySQLCompat, index.IsUnique())
			if err != nil {
				return nil, err
			}
		}
	}

	return newSch, nil
}

func ValidateIdentifier(name string) error {
	if len(name) > sql.MaxIdentifierLength {
		return sql.ErrInvalidIdentifier.New(name)
	}
	return nil
}

func ValidateDropColumn(initialSch, sch sql.Schema, dc *plan.DropColumn) (sql.Schema, error) {
	table := dc.Table
	nameable := table.(sql.Nameable)

	// Look for the column to be dropped and throw an error if it's not there. It must exist in the original schema before
	// this statement was run, it cannot have been added as part of this ALTER TABLE statement. This matches the MySQL
	// behavior.
	if !initialSch.Contains(dc.Column, nameable.Name()) || !sch.Contains(dc.Column, nameable.Name()) {
		return nil, sql.ErrTableColumnNotFound.New(nameable.Name(), dc.Column)
	}

	err := validateColumnSafeToDropWithCheckConstraint(dc.Column, dc.Checks())
	if err != nil {
		return nil, err
	}

	newSch := removeInSchema(sch, dc.Column, nameable.Name())

	return newSch, nil
}

// ValidateColumnNotUsedInCheckConstraint validates that the specified column name is not referenced in any of
// the specified table check constraints.
func ValidateColumnNotUsedInCheckConstraint(columnName string, checks sql.CheckConstraints) error {
	var err error
	for _, check := range checks {
		_ = transform.InspectExpr(check.Expr, func(e sql.Expression) bool {
			var name string
			switch e := e.(type) {
			case *expression.UnresolvedColumn:
				name = e.Name()
			case *expression.GetField:
				name = e.Name()
			default:
				return false
			}
			if strings.EqualFold(name, columnName) {
				err = sql.ErrCheckConstraintInvalidatedByColumnAlter.New(columnName, check.Name)
				return true
			}
			return false
		})

		if err != nil {
			return err
		}
	}
	return nil
}

// validateColumnSafeToDropWithCheckConstraint validates that the specified column name is safe to drop, even if
// referenced in a check constraint. Columns referenced in check constraints can be dropped if they are the only
// column referenced in the check constraint.
func validateColumnSafeToDropWithCheckConstraint(columnName string, checks sql.CheckConstraints) error {
	var err error
	for _, check := range checks {
		hasOtherCol := false
		hasMatchingCol := false
		_ = transform.InspectExpr(check.Expr, func(e sql.Expression) bool {
			var colName string
			switch e := e.(type) {
			case *expression.UnresolvedColumn:
				colName = e.Name()
			case *expression.GetField:
				colName = e.Name()
			default:
				return false
			}
			if strings.EqualFold(columnName, colName) {
				if hasOtherCol {
					err = sql.ErrCheckConstraintInvalidatedByColumnAlter.New(columnName, check.Name)
					return true
				} else {
					hasMatchingCol = true
				}
			} else {
				hasOtherCol = true
			}
			return false
		})

		if hasOtherCol && hasMatchingCol {
			err = sql.ErrCheckConstraintInvalidatedByColumnAlter.New(columnName, check.Name)
		}

		if err != nil {
			return err
		}
	}
	return nil
}

// validateAlterIndex validates the specified column can have an index added, dropped, or renamed. Returns an updated
// list of index name given the add, drop, or rename operations.
func validateAlterIndex(ctx *sql.Context, initialSch, sch sql.Schema, ai *plan.AlterIndex, indexes []string) ([]string, error) {
	switch ai.Action {
	case plan.IndexAction_Create:
		err := ValidateIdentifier(ai.IndexName)
		if err != nil {
			return nil, err
		}
		colMap := schToColMap(sch)
		strictMySQLCompat, err := isStrictMysqlCompatibilityEnabled(ctx)
		if err != nil {
			return nil, err
		}
		// TODO: plan.AlterIndex should just have a sql.IndexDef
		indexDef := &sql.IndexDef{
			Name:       ai.IndexName,
			Columns:    ai.Columns,
			Constraint: ai.Constraint,
			Storage:    ai.Using,
			Comment:    ai.Comment,
		}
		err = validateIndex(ctx, colMap, indexDef, strictMySQLCompat)
		if err != nil {
			return nil, err
		}
		return append(indexes, ai.IndexName), nil
	case plan.IndexAction_Drop:
		savedIdx := -1
		for i, idx := range indexes {
			if strings.EqualFold(idx, ai.IndexName) {
				savedIdx = i
				break
			}
		}
		if savedIdx == -1 {
			if ai.IfExists {
				return nil, nil
			}
			return nil, sql.ErrCantDropFieldOrKey.New(ai.IndexName)
		}
		// Remove the index from the list
		return append(indexes[:savedIdx], indexes[savedIdx+1:]...), nil
	case plan.IndexAction_Rename:
		err := ValidateIdentifier(ai.IndexName)
		if err != nil {
			return nil, err
		}
		savedIdx := -1
		for i, idx := range indexes {
			if strings.EqualFold(idx, ai.PreviousIndexName) {
				savedIdx = i
			}
		}
		if savedIdx == -1 {
			return nil, sql.ErrCantDropFieldOrKey.New(ai.IndexName)
		}
		// Simulate the rename by deleting the old name and adding the new one.
		return append(append(indexes[:savedIdx], indexes[savedIdx+1:]...), ai.IndexName), nil
	}

	return indexes, nil
}

// validatePrefixLength handles all errors related to creating indexes with prefix lengths
func validatePrefixLength(ctx *sql.Context, colName string, colLen int64, colType sql.Type, strictMySQLCompat, isUnique bool) error {
	// Throw prefix length error for non-string types with prefixes
	if !types.IsText(colType) {
		if colLen > 0 {
			return sql.ErrInvalidIndexPrefix.New(colName)
		}
		return nil
	}

	// Prefix length is required for BLOB and TEXT columns.
	if colLen == 0 && types.IsTextBlob(colType) {
		// MariaDB extends this behavior so that unique indexes don't require a prefix length.
		if strictMySQLCompat || !isUnique {
			return sql.ErrInvalidBlobTextKey.New(colName)
		}

		// The hash we compute doesn't take into account the collation settings of the column, so in a
		// case-insensitive collation, although "YES" and "yes" are equivalent, they will still generate
		// different hashes which won't correctly identify a real uniqueness constraint violation.
		if stringType, ok := colType.(types.StringType); ok {
			collation := stringType.Collation().Collation()
			if !collation.IsCaseSensitive || !collation.IsAccentSensitive {
				return sql.ErrCollationNotSupportedOnUniqueTextIndex.New()
			}
		}
	}

	if types.IsTextOnly(colType) {
		colLen = 4 * colLen
	}
	if colLen > MaxBytePrefix {
		return sql.ErrKeyTooLong.New()
	}

	// The specified prefix length is longer than the column
	maxByteLength := int64(colType.MaxTextResponseByteLength(ctx))
	if colLen > maxByteLength {
		return sql.ErrInvalidIndexPrefix.New(colName)
	}

	return nil
}

func replaceInSchema(sch sql.Schema, col *sql.Column, tableName string) sql.Schema {
	idx := sch.IndexOf(col.Name, tableName)
	schCopy := make(sql.Schema, len(sch))
	for i := range sch {
		if i == idx {
			cc := *col
			// Some information about the column is not specified in a MODIFY COLUMN statement, such as being a key
			cc.PrimaryKey = sch[i].PrimaryKey
			cc.Source = sch[i].Source
			if cc.PrimaryKey {
				cc.Nullable = false
			}

			schCopy[i] = &cc

		} else {
			cc := *sch[i]
			schCopy[i] = &cc
		}
	}
	return schCopy
}

func renameInSchema(sch sql.Schema, oldColName, newColName, tableName string) sql.Schema {
	idx := sch.IndexOf(oldColName, tableName)
	schCopy := make(sql.Schema, len(sch))
	for i := range sch {
		if i == idx {
			cc := *sch[i]
			cc.Name = newColName
			schCopy[i] = &cc
		} else {
			cc := *sch[i]
			schCopy[i] = &cc
		}
	}
	return schCopy
}

func removeInSchema(sch sql.Schema, colName, tableName string) sql.Schema {
	idx := sch.IndexOf(colName, tableName)
	if idx == -1 {
		return sch
	}

	schCopy := make(sql.Schema, len(sch)-1)
	for i := range sch {
		if i < idx {
			cc := *sch[i]
			schCopy[i] = &cc
		} else if i > idx {
			cc := *sch[i]
			schCopy[i-1] = &cc // We want to shift stuff over.
		}
	}
	return schCopy
}

func validateAutoIncrementModify(schema sql.Schema, keyedColumns map[string]bool) error {
	seen := false
	for _, col := range schema {
		if col.AutoIncrement {
			// Under MySQL 8.4+, AUTO_INCREMENT columns must be integer types.
			if !types.IsInteger(col.Type) {
				return sql.ErrInvalidColumnSpecifier.New(col.Name)
			}
			// keyedColumns == nil means they are trying to add auto_increment column
			if !col.PrimaryKey && !keyedColumns[col.Name] {
				// AUTO_INCREMENT col must be a key
				return sql.ErrInvalidAutoIncCols.New()
			}
			if col.Default != nil {
				// AUTO_INCREMENT col cannot have default
				return sql.ErrInvalidAutoIncCols.New()
			}
			if seen {
				// there can be at most one AUTO_INCREMENT col
				return sql.ErrInvalidAutoIncCols.New()
			}
			seen = true
		}
	}
	return nil
}

func schToColMap(sch sql.Schema) map[string]*sql.Column {
	colMap := make(map[string]*sql.Column, len(sch))
	for _, col := range sch {
		colMap[strings.ToLower(col.Name)] = col
	}
	return colMap
}

// validateIndexes prevents creating tables with blob/text primary keys and indexes without a specified length
func validateIndexes(ctx *sql.Context, sch sql.Schema, idxDefs sql.IndexDefs, strictMySQLCompat bool) error {
	colMap := schToColMap(sch)
	var hasPkIndexDef bool
	for _, idxDef := range idxDefs {
		if idxDef.IsPrimary() {
			hasPkIndexDef = true
		}
		if err := validateIndex(ctx, colMap, idxDef, strictMySQLCompat); err != nil {
			return err
		}
	}

	// TODO: this happens because sometimes the primary key is included in the index and other times it is not
	// if there was not a PkIndexDef, then any primary key text/blob columns must not have index lengths
	// otherwise, then it would've been validated before this
	if !hasPkIndexDef {
		for _, col := range sch {
			if col.PrimaryKey && types.IsTextBlob(col.Type) {
				return sql.ErrInvalidBlobTextKey.New(col.Name)
			}
		}
	}
	return nil
}

// validateIndex ensures that the Index Definition is valid for the table schema.
// This function will throw errors and warnings as needed.
// All columns in the index must be:
//   - in the schema
//   - not duplicated
//   - not JSON Type
//   - have the proper prefix length
func validateIndex(ctx *sql.Context, colMap map[string]*sql.Column, idxDef *sql.IndexDef, strictMySQLCompat bool) error {
	seenCols := make(map[string]struct{})
	for _, idxCol := range idxDef.Columns {
		schCol, exists := colMap[strings.ToLower(idxCol.Name)]
		if !exists {
			return sql.ErrKeyColumnDoesNotExist.New(idxCol.Name)
		}
		if _, ok := seenCols[schCol.Name]; ok {
			return sql.ErrDuplicateColumn.New(schCol.Name)
		}
		seenCols[schCol.Name] = struct{}{}
		if types.IsJSON(schCol.Type) && !idxDef.IsVector() {
			return sql.ErrJSONIndex.New(schCol.Name)
		}

		if idxDef.IsFullText() {
			continue
		}

		err := validatePrefixLength(ctx, idxCol.Name, idxCol.Length, schCol.Type, strictMySQLCompat, idxDef.IsUnique())
		if err != nil {
			return err
		}
	}

	if idxDef.IsSpatial() {
		if len(idxDef.Columns) != 1 {
			return sql.ErrTooManyKeyParts.New(1)
		}
		schCol, _ := colMap[strings.ToLower(idxDef.Columns[0].Name)]
		spatialCol, isSpatialCol := schCol.Type.(sql.SpatialColumnType)
		if !isSpatialCol {
			return sql.ErrBadSpatialIdxCol.New()
		}
		if schCol.Nullable {
			return sql.ErrNullableSpatialIdx.New()
		}
		if _, hasSRID := spatialCol.GetSpatialTypeSRID(); !hasSRID {
			ctx.Warn(3674, "The spatial index on column '%s' will not be used by the query optimizer since the column does not have an SRID attribute. Consider adding an SRID attribute to the column.", schCol.Name)
		}
	}

	return nil
}

// GetTableIndexColumns returns the columns over which indexes are defined
func GetTableIndexColumns(ctx *sql.Context, table sql.Node) (map[string]bool, error) {
	ia, err := newIndexAnalyzerForNode(ctx, table)
	if err != nil {
		return nil, err
	}

	keyedColumns := make(map[string]bool)
	indexes := ia.IndexesByTable(ctx, ctx.GetCurrentDatabase(), getTableName(table))
	for _, index := range indexes {
		for _, expr := range index.Expressions() {
			if col := plan.GetColumnFromIndexExpr(expr, getTable(table)); col != nil {
				keyedColumns[col.Name] = true
			}
		}
	}

	return keyedColumns, nil
}

// GetTableIndexNames returns the names of indexes associated with a table.
func GetTableIndexNames(ctx *sql.Context, _ *Analyzer, table sql.Node) ([]string, error) {
	ia, err := newIndexAnalyzerForNode(ctx, table)
	if err != nil {
		return nil, err
	}

	indexes := ia.IndexesByTable(ctx, ctx.GetCurrentDatabase(), getTableName(table))
	names := make([]string, len(indexes))

	for i, index := range indexes {
		names[i] = index.ID()
	}

	if HasPrimaryKeys(table.Schema()) {
		names = append(names, "PRIMARY")
	}

	return names, nil
}

// validatePrimaryKey validates a primary key add or drop operation.
func validatePrimaryKey(ctx *sql.Context, initialSch, sch sql.Schema, ai *plan.AlterPK) (sql.Schema, error) {
	tableName := getTableName(ai.Table)
	switch ai.Action {
	case plan.PrimaryKeyAction_Create:
		if HasPrimaryKeys(sch) {
			return nil, sql.ErrMultiplePrimaryKeysDefined.New()
		}

		colMap := schToColMap(sch)
		idxDef := &sql.IndexDef{
			Name:       "PRIMARY",
			Columns:    ai.Columns,
			Constraint: sql.IndexConstraint_Primary,
		}
		strictMySQLCompat, err := isStrictMysqlCompatibilityEnabled(ctx)
		if err != nil {
			return nil, err
		}
		err = validateIndex(ctx, colMap, idxDef, strictMySQLCompat)
		if err != nil {
			return nil, err
		}

		for _, idxCol := range ai.Columns {
			schCol := colMap[strings.ToLower(idxCol.Name)]
			if schCol.Virtual {
				return nil, sql.ErrVirtualColumnPrimaryKey.New()
			}
		}

		// Set the primary keys
		for _, col := range ai.Columns {
			sch[sch.IndexOf(col.Name, tableName)].PrimaryKey = true
		}

		return sch, nil
	case plan.PrimaryKeyAction_Drop:
		if !HasPrimaryKeys(sch) {
			return nil, sql.ErrCantDropFieldOrKey.New("PRIMARY")
		}

		for _, col := range sch {
			if col.PrimaryKey {
				col.PrimaryKey = false
			}
		}

		return sch, nil
	default:
		return sch, nil
	}
}

// ValidateAlterDefault validates the addition of a default value to a column.
func ValidateAlterDefault(initialSch, sch sql.Schema, as *plan.AlterDefaultSet) (sql.Schema, error) {
	idx := sch.IndexOf(as.ColumnName, getTableName(as.Table))
	if idx == -1 {
		return nil, sql.ErrTableColumnNotFound.New(as.ColumnName)
	}

	copiedDefault, err := as.Default.WithChildren(as.Default.Children()...)
	if err != nil {
		return nil, err
	}

	sch[idx].Default = copiedDefault.(*sql.ColumnDefaultValue)

	return sch, err
}

// ValidateDropDefault validates the dropping of a default value.
func ValidateDropDefault(initialSch, sch sql.Schema, ad *plan.AlterDefaultDrop) (sql.Schema, error) {
	idx := sch.IndexOf(ad.ColumnName, getTableName(ad.Table))
	if idx == -1 {
		return nil, sql.ErrTableColumnNotFound.New(ad.ColumnName)
	}

	sch[idx].Default = nil

	return sch, nil
}

func HasPrimaryKeys(sch sql.Schema) bool {
	for _, c := range sch {
		if c.PrimaryKey {
			return true
		}
	}

	return false
}
