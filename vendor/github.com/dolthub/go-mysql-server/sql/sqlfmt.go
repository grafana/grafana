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

package sql

// All functions here are used together to generate 'CREATE TABLE' statement. Each function takes what it requires
// to build the definition, which are mostly exact names or values (e.g. columns, indexes names, types, etc.)
// These functions allow creating the compatible 'CREATE TABLE' statement from both GMS and Dolt, which use different
// implementations of schema, column and other objects.

// GenerateCreateTableStatement returns 'CREATE TABLE' statement with given table names
// and column definition statements in order and the collation and character set names for the table
func GenerateCreateTableStatement(tblName string, colStmts []string, temp, autoInc, tblCharsetName, tblCollName, comment string) string {
	return GlobalSchemaFormatter.GenerateCreateTableStatement(tblName, colStmts, temp, autoInc, tblCharsetName, tblCollName, comment)
}

// GenerateCreateTableColumnDefinition returns column definition string for 'CREATE TABLE' statement for given column.
// This part comes first in the 'CREATE TABLE' statement.
func GenerateCreateTableColumnDefinition(col *Column, colDefault, onUpdate string, tableCollation CollationID) string {
	return GlobalSchemaFormatter.GenerateCreateTableColumnDefinition(col, colDefault, onUpdate, tableCollation)
}

// GenerateCreateTablePrimaryKeyDefinition returns primary key definition string for 'CREATE TABLE' statement
// for given column(s). This part comes after each column definitions.
func GenerateCreateTablePrimaryKeyDefinition(pkCols []string) string {
	return GlobalSchemaFormatter.GenerateCreateTablePrimaryKeyDefinition(pkCols)
}

// GenerateCreateTableIndexDefinition returns index definition string for 'CREATE TABLE' statement
// for given index. This part comes after primary key definition if there is any.
func GenerateCreateTableIndexDefinition(isUnique, isSpatial, isFullText, isVector bool, indexID string, indexCols []string, comment string) (string, bool) {
	return GlobalSchemaFormatter.GenerateCreateTableIndexDefinition(isUnique, isSpatial, isFullText, isVector, indexID, indexCols, comment)
}

// GenerateCreateTableForiegnKeyDefinition returns foreign key constraint definition string for 'CREATE TABLE' statement
// for given foreign key. This part comes after index definitions if there are any.
func GenerateCreateTableForiegnKeyDefinition(fkName string, fkCols []string, parentTbl string, parentCols []string, onDelete, onUpdate string) string {
	return GlobalSchemaFormatter.GenerateCreateTableForiegnKeyDefinition(fkName, fkCols, parentTbl, parentCols, onDelete, onUpdate)
}

// GenerateCreateTableCheckConstraintClause returns check constraint clause string for 'CREATE TABLE' statement
// for given check constraint. This part comes the last and after foreign key definitions if there are any.
func GenerateCreateTableCheckConstraintClause(checkName, checkExpr string, enforced bool) string {
	return GlobalSchemaFormatter.GenerateCreateTableCheckConstraintClause(checkName, checkExpr, enforced)
}

// QuoteIdentifier wraps the specified identifier in backticks and escapes all occurrences of backticks in the
// identifier by replacing them with double backticks.
func QuoteIdentifier(id string) string {
	return GlobalSchemaFormatter.QuoteIdentifier(id)
}

// QuoteIdentifiers wraps each of the specified identifiers in backticks, escapes all occurrences of backticks in
// the identifier, and returns a slice of the quoted identifiers.
func QuoteIdentifiers(ids []string) []string {
	quoted := make([]string, len(ids))
	for i, id := range ids {
		quoted[i] = GlobalSchemaFormatter.QuoteIdentifier(id)
	}
	return quoted
}
