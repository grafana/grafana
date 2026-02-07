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

package rowexec

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type describeIter struct {
	schema sql.Schema
	i      int
}

func (i *describeIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.i >= len(i.schema) {
		return nil, io.EOF
	}

	f := i.schema[i.i]
	i.i++
	return sql.NewRow(f.Name, f.Type.String()), nil
}

func (i *describeIter) Close(*sql.Context) error {
	return nil
}

type process struct {
	user    string
	host    string
	db      string
	command string
	state   string
	info    string
	id      int64
	time    int64
}

func (p process) toRow() sql.Row {
	var db interface{}
	if p.db != "" {
		db = p.db
	}
	return sql.NewRow(
		p.id,
		p.user,
		p.host,
		db,
		p.command,
		p.time,
		p.state,
		p.info,
	)
}

// cc here: https://dev.mysql.com/doc/refman/8.0/en/show-table-status.html
func tableToStatusRow(ctx *sql.Context, table sql.Table) (sql.Row, error) {
	var numRows uint64
	var dataLength uint64
	var err error
	if st, ok := table.(sql.StatisticsTable); ok {
		numRows, _, err = st.RowCount(ctx)
		if err != nil {
			return nil, err
		}

		dataLength, err = st.DataLength(ctx)
		if err != nil {
			return nil, err
		}
	}
	var avgLength float64 = 0
	if numRows > 0 {
		avgLength = float64(dataLength) / float64(numRows)
	}

	var comment string
	if ct, ok := table.(sql.CommentedTable); ok {
		comment = ct.Comment()
	}

	return sql.NewRow(
		table.Name(), // Name
		"InnoDB",     // Engine
		// This column is unused. With the removal of .frm files in MySQL 8.0, this
		// column now reports a hardcoded value of 10, which is the last .frm file
		// version used in MySQL 5.7.
		"10",                       // Version
		"Fixed",                    // Row_format
		numRows,                    // Rows
		uint64(avgLength),          // Avg_row_length
		dataLength,                 // Data_length
		uint64(0),                  // Max_data_length (Unused for InnoDB)
		int64(0),                   // Index_length
		int64(0),                   // Data_free
		nil,                        // Auto_increment (always null)
		nil,                        // Create_time
		nil,                        // Update_time
		nil,                        // Check_time
		table.Collation().String(), // Collation
		nil,                        // Checksum
		nil,                        // Create_options
		comment,                    // Comment
	), nil
}

// generatePrivStrings creates a formatted GRANT <privilege_list> on <global/database/table> to <user@host> string
func generatePrivStrings(db, tbl, user string, privs []sql.PrivilegeType) string {
	sb := strings.Builder{}
	withGrantOption := ""
	for i, priv := range privs {
		privStr := priv.String()
		if privStr == sql.PrivilegeType_GrantOption.String() {
			if len(privs) > 1 {
				withGrantOption = " WITH GRANT OPTION"
			}
		} else {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(privStr)
		}
	}
	// handle special case for empty global and database privileges
	privStr := sb.String()
	if len(privStr) == 0 {
		if db == "*" {
			privStr = "USAGE"
		} else {
			return ""
		}
	}
	return fmt.Sprintf("GRANT %s ON %s.%s TO %s%s", privStr, db, tbl, user, withGrantOption)
}

// generateRoutinePrivStrings creates a formatted GRANT <PRILEDGE_LIST> on <ROUTINE_TYPE> <ROUTINE> to <user@host> string
func generateRoutinePrivStrings(db, routine, routine_type, user string, privs []sql.PrivilegeType) string {
	privStrs := make([]string, 0, len(privs))
	grantOption := ""
	for _, priv := range privs {
		if priv == sql.PrivilegeType_GrantOption {
			grantOption = " WITH GRANT OPTION"
			continue
		}

		privStr := priv.String()
		privStrs = append(privStrs, privStr)
	}

	// This is kind of an odd word to insert in the output, but it's what MySQL does when you have no privileges other
	// than Grant Options.
	finalPrivStr := "USAGE"
	if len(privStrs) > 0 {
		finalPrivStr = strings.Join(privStrs, ", ")
	}

	return fmt.Sprintf("GRANT %s ON %s %s.%s TO %s%s", finalPrivStr, routine_type, db, routine, user, grantOption)
}

func newIndexesToShow(indexes []sql.Index) *indexesToShow {
	return &indexesToShow{
		indexes: indexes,
	}
}

type indexesToShow struct {
	indexes []sql.Index
	pos     int
	epos    int
}

type idxToShow struct {
	index      sql.Index
	expression string
	exPosition int
}

func (i *indexesToShow) next() (*idxToShow, error) {
	if i.pos >= len(i.indexes) {
		return nil, io.EOF
	}

	index := i.indexes[i.pos]
	expressions := index.Expressions()
	if i.epos >= len(expressions) {
		i.pos++
		if i.pos >= len(i.indexes) {
			return nil, io.EOF
		}

		index = i.indexes[i.pos]
		i.epos = 0
		expressions = index.Expressions()
	}

	show := &idxToShow{
		index:      index,
		expression: expressions[i.epos],
		exPosition: i.epos,
	}

	i.epos++
	return show, nil
}

type showIndexesIter struct {
	table *plan.ResolvedTable
	idxs  *indexesToShow
}

func (i *showIndexesIter) Next(ctx *sql.Context) (sql.Row, error) {
	show, err := i.idxs.next()
	if err != nil {
		return nil, err
	}

	var expression, columnName interface{}
	columnName, expression = nil, show.expression
	tbl := i.table

	if err != nil {
		return nil, err
	}

	nullable := ""
	if col := plan.GetColumnFromIndexExpr(show.expression, tbl); col != nil {
		columnName, expression = col.Name, nil
		if col.Nullable {
			nullable = "YES"
		}
	}

	visible := "YES"
	if x, ok := show.index.(sql.DriverIndex); ok && len(x.Driver()) > 0 {
		if !ctx.GetIndexRegistry().CanUseIndex(x) {
			visible = "NO"
		}
	}

	nonUnique := 0
	if !show.index.IsUnique() {
		nonUnique = 1
	}

	return sql.NewRow(
		show.index.Table(),     // "Table" string
		nonUnique,              // "Non_unique" int32, Values [0, 1]
		show.index.ID(),        // "Key_name" string
		show.exPosition+1,      // "Seq_in_index" int32
		columnName,             // "Column_name" string
		nil,                    // "Collation" string, Values [A, D, NULL]
		int64(0),               // "Cardinality" int64 (not calculated)
		nil,                    // "Sub_part" int64
		nil,                    // "Packed" string
		nullable,               // "Null" string, Values [YES, '']
		show.index.IndexType(), // "Index_type" string
		show.index.Comment(),   // "Comment" string
		"",                     // "Index_comment" string
		visible,                // "Visible" string, Values [YES, NO]
		expression,             // "Expression" string
	), nil
}

// isPriCol checks if this column is the first column in a unique index
func isPriCol(s *plan.ShowColumns, col *sql.Column, table sql.Table) bool {
	for _, idx := range s.Indexes {
		if !idx.IsUnique() {
			continue
		}
		// TODO: also have to determine that there are no primary keys defined later
		//   this currently works because the primary key shows up as unique, so the condition below satisfies it
		//   but I am not confident that this is always true
		idxExprs := idx.Expressions()
		firstIndexCol := plan.GetColumnFromIndexExpr(idxExprs[0], table)
		if firstIndexCol == nil || firstIndexCol.Name != col.Name {
			return false
		}
		for _, expr := range idxExprs {
			idxCol := plan.GetColumnFromIndexExpr(expr, table)
			if idxCol == nil || idxCol.Nullable {
				return false
			}
		}
		return true
	}
	return false
}

// isUnqCol checks if this the values in this column must be unique
func isUnqCol(s *plan.ShowColumns, col *sql.Column, table sql.Table) bool {
	for _, idx := range s.Indexes {
		// Column is in a unique index by itself
		idxExprs := idx.Expressions()
		if !idx.IsUnique() || len(idxExprs) > 1 {
			continue
		}
		firstIndexCol := plan.GetColumnFromIndexExpr(idxExprs[0], table)
		if firstIndexCol != nil && firstIndexCol.Name == col.Name {
			return true
		}
	}
	return false
}

// isMulCol checks if values in this column can be non-unique and that it's the first column in an index
func isMulCol(s *plan.ShowColumns, col *sql.Column, table sql.Table) bool {
	for _, idx := range s.Indexes {
		idxExprs := idx.Expressions()
		firstIdxCol := plan.GetColumnFromIndexExpr(idxExprs[0], table)
		// Not first column in index, ignore
		if firstIdxCol == nil || firstIdxCol.Name != col.Name {
			continue
		}
		// Is part of non-unique key or not the only column in the key
		if !idx.IsUnique() || len(idxExprs) > 1 {
			return true
		}
	}
	return false
}

func (i *showIndexesIter) Close(*sql.Context) error {
	return nil
}

type showCreateTablesIter struct {
	table        sql.Node
	pkSchema     sql.PrimaryKeySchema
	schema       sql.Schema
	indexes      []sql.Index
	checks       sql.CheckConstraints
	didIteration bool
	isView       bool
}

func (i *showCreateTablesIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.didIteration {
		return nil, io.EOF
	}

	i.didIteration = true

	var row sql.Row
	switch table := i.table.(type) {
	case *plan.ResolvedTable:
		// MySQL behavior is to allow show create table for views, but not show create view for tables.
		if i.isView {
			return nil, plan.ErrNotView.New(table.Name())
		}

		composedCreateTableStatement, err := i.produceCreateTableStatement(ctx, table.Table, i.schema, i.pkSchema)
		if err != nil {
			return nil, err
		}
		row = sql.NewRow(
			table.Name(),                 // "Table" string
			composedCreateTableStatement, // "Create Table" string
		)
	case *plan.SubqueryAlias:
		characterSetClient, err := ctx.GetSessionVariable(ctx, "character_set_client")
		if err != nil {
			return nil, err
		}
		collationConnection, err := ctx.GetSessionVariable(ctx, "collation_connection")
		if err != nil {
			return nil, err
		}
		row = sql.NewRow(
			table.Name(),                      // "View" string
			produceCreateViewStatement(table), // "Create View" string
			characterSetClient,
			collationConnection,
		)
	default:
		panic(fmt.Sprintf("unexpected type %T", i.table))
	}

	return row, nil
}

type NameAndSchema interface {
	sql.Nameable
	Schema() sql.Schema
}

func convertColumnDefaultToString(ctx *sql.Context, def *sql.ColumnDefaultValue) (string, error) {
	// TODO : string literals should have character set introducer
	colDefaultStr := def.String()
	defType := def.Type()

	// These types do not need to be quoted
	if !def.IsLiteral() || colDefaultStr == "NULL" || types.IsTime(defType) || types.IsText(defType) {
		return colDefaultStr, nil
	}
	v, err := def.Eval(ctx, nil)
	if err != nil {
		return "", err
	}
	if types.IsBit(def.OutType) {
		return fmt.Sprintf("b'%b'", v), nil
	}
	return fmt.Sprintf("'%v'", v), nil
}

func (i *showCreateTablesIter) produceCreateTableStatement(ctx *sql.Context, table sql.Table, schema sql.Schema, pkSchema sql.PrimaryKeySchema) (string, error) {
	colStmts := make([]string, len(schema))
	var primaryKeyCols []string

	var pkOrdinals []int
	if len(pkSchema.Schema) > 0 {
		pkOrdinals = pkSchema.PkOrdinals
	}

	// Statement creation parts for each column
	tableCollation := table.Collation()
	for i, col := range schema {
		var colDefaultStr string
		var err error
		if col.Default != nil && col.Generated == nil {
			// TODO : string literals should have character set introducer
			colDefaultStr, err = convertColumnDefaultToString(ctx, col.Default)
			if err != nil {
				return "", err
			}
		}

		var onUpdateStr string
		if col.OnUpdate != nil {
			onUpdateStr, err = convertColumnDefaultToString(ctx, col.OnUpdate)
			if err != nil {
				return "", err
			}
		}

		if col.PrimaryKey && len(pkSchema.Schema) == 0 {
			pkOrdinals = append(pkOrdinals, i)
		}

		colStmts[i] = sql.GenerateCreateTableColumnDefinition(col, colDefaultStr, onUpdateStr, tableCollation)
	}

	for _, i := range pkOrdinals {
		primaryKeyCols = append(primaryKeyCols, schema[i].Name)
	}

	if len(primaryKeyCols) > 0 {
		colStmts = append(colStmts, sql.GenerateCreateTablePrimaryKeyDefinition(primaryKeyCols))
	}

	for _, index := range i.indexes {
		// The primary key may or may not be declared as an index by the table; don't print it twice.
		if index.ID() == "PRIMARY" {
			continue
		}

		prefixLengths := index.PrefixLengths()
		var indexCols []string
		for i, expr := range index.Expressions() {
			col := plan.GetColumnFromIndexExpr(expr, table)
			if col != nil {
				indexDef := sql.QuoteIdentifier(col.Name)
				if len(prefixLengths) > i && prefixLengths[i] != 0 {
					indexDef += fmt.Sprintf("(%v)", prefixLengths[i])
				}
				indexCols = append(indexCols, indexDef)
			}
		}

		indexDefn, shouldInclude := sql.GenerateCreateTableIndexDefinition(index.IsUnique(), index.IsSpatial(),
			index.IsFullText(), index.IsVector(), index.ID(), indexCols, index.Comment())
		if shouldInclude {
			colStmts = append(colStmts, indexDefn)
		}
	}

	fkt, err := getForeignKeyTable(table)
	if err == nil && fkt != nil {
		fks, err := fkt.GetDeclaredForeignKeys(ctx)
		if err != nil {
			return "", err
		}
		for _, fk := range fks {
			onDelete := ""
			if len(fk.OnDelete) > 0 && fk.OnDelete != sql.ForeignKeyReferentialAction_DefaultAction {
				onDelete = string(fk.OnDelete)
			}
			onUpdate := ""
			if len(fk.OnUpdate) > 0 && fk.OnUpdate != sql.ForeignKeyReferentialAction_DefaultAction {
				onUpdate = string(fk.OnUpdate)
			}
			colStmts = append(colStmts, sql.GenerateCreateTableForiegnKeyDefinition(fk.Name, fk.Columns, fk.ParentTable, fk.ParentColumns, onDelete, onUpdate))
		}
	}

	if i.checks != nil {
		for _, check := range i.checks {
			colStmts = append(colStmts, sql.GenerateCreateTableCheckConstraintClause(check.Name, check.Expr.String(), check.Enforced))
		}
	}

	comment := ""
	if commentedTable, ok := table.(sql.CommentedTable); ok {
		comment = commentedTable.Comment()
	}

	autoInc := ""
	if tbl := getAutoIncrementTable(table); tbl != nil {
		autoIncVal, err := tbl.PeekNextAutoIncrementValue(ctx)
		// TODO: possible to get ErrNoAutoIncrementCol here, so we just ignore
		if err != nil && err.Error() != sql.ErrNoAutoIncrementCol.Error() {
			return "", err
		}
		if autoIncVal > 1 {
			autoInc = fmt.Sprintf("%v", autoIncVal)
		}
	}

	temp := ""
	if tbl := getTempTable(table); tbl != nil && tbl.IsTemporary() {
		temp = " TEMPORARY"
	}

	return sql.GenerateCreateTableStatement(table.Name(), colStmts, temp, autoInc, table.Collation().CharacterSet().Name(), table.Collation().Name(), comment), nil
}

func produceCreateViewStatement(view *plan.SubqueryAlias) string {
	return fmt.Sprintf(
		"CREATE VIEW `%s` AS %s",
		view.Name(),
		view.TextDefinition,
	)
}

func (i *showCreateTablesIter) Close(*sql.Context) error {
	return nil
}

func getForeignKeyTable(t sql.Table) (sql.ForeignKeyTable, error) {
	switch t := t.(type) {
	case sql.ForeignKeyTable:
		return t, nil
	case sql.TableWrapper:
		return getForeignKeyTable(t.Underlying())
	case *plan.ResolvedTable:
		return getForeignKeyTable(t.Table)
	default:
		return nil, sql.ErrNoForeignKeySupport.New(t.Name())
	}
}

func getAutoIncrementTable(t sql.Table) sql.AutoIncrementGetter {
	switch t := t.(type) {
	case sql.AutoIncrementGetter:
		return t
	case sql.TableWrapper:
		return getAutoIncrementTable(t.Underlying())
	case *plan.ResolvedTable:
		return getAutoIncrementTable(t.Table)
	default:
		return nil
	}
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

func formatReplicaStatusTimestamp(t *time.Time) string {
	if t == nil {
		return ""
	}

	return t.Format(time.UnixDate)
}
