// Copyright 2024 Dolthub, Inc.
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
	"context"
	"fmt"
	trace2 "runtime/trace"
	"strings"
	"unicode"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"
)

// GlobalParser is a temporary variable to expose Doltgres parser.
// It defaults to MysqlParser.
var GlobalParser Parser = NewMysqlParser()

// GlobalSchemaFormatter is a temporary variable to expose Doltgres schema formatter.
// It defaults to MySqlSchemaFormatter.
var GlobalSchemaFormatter SchemaFormatter = &MySqlSchemaFormatter{}

// Parser knows how to transform a SQL statement into an AST
type Parser interface {
	// ParseSimple takes a |query| and returns the parsed statement. If |query| represents a no-op statement,
	// such as ";" or "-- comment", then implementations must return Vitess' ErrEmpty error.
	ParseSimple(query string) (ast.Statement, error)
	// Parse parses |query| using the default parser options of the ctx and returns the parsed statement
	// along with the query string and remainder string if it's multiple queries. If |query| represents a
	// no-op statement, such as ";" or "-- comment", then implementations must return Vitess' ErrEmpty error.
	Parse(ctx *Context, query string, multi bool) (ast.Statement, string, string, error)
	// ParseWithOptions parses |query| using the given parser |options| and specified |delimiter|. The parsed statement
	// is returned, along with the query string and remainder string if |multi| has been set to true and there are
	// multiple statements in |query|. If |query| represents a no-op statement, such as ";" or "-- comment", then
	// implementations must return Vitess' ErrEmpty error.
	ParseWithOptions(ctx context.Context, query string, delimiter rune, multi bool, options ast.ParserOptions) (ast.Statement, string, string, error)
	// ParseOneWithOptions parses the first query using specified parsing returns the parsed statement along with
	// the index of the start of the next query. If |query| represents a no-op statement, such as ";" or "-- comment",
	// then implementations must return Vitess' ErrEmpty error.
	ParseOneWithOptions(context.Context, string, ast.ParserOptions) (ast.Statement, int, error)
}

// SchemaFormatter knows how to format a schema into a string
type SchemaFormatter interface {
	// GenerateCreateTableStatement returns 'CREATE TABLE' statement with given table names
	// and column definition statements in order and the collation and character set names for the table
	GenerateCreateTableStatement(tblName string, colStmts []string, temp, autoInc, tblCharsetName, tblCollName, comment string) string
	// GenerateCreateTableColumnDefinition returns column definition string for 'CREATE TABLE' statement for given column.
	// This part comes first in the 'CREATE TABLE' statement.
	GenerateCreateTableColumnDefinition(col *Column, colDefault, onUpdate string, tableCollation CollationID) string
	// GenerateCreateTablePrimaryKeyDefinition returns primary key definition string for 'CREATE TABLE' statement
	// for given column(s). This part comes after each column definitions.
	GenerateCreateTablePrimaryKeyDefinition(pkCols []string) string
	// GenerateCreateTableIndexDefinition returns index definition string for 'CREATE TABLE' statement
	// for given index. This part comes after primary key definition if there is any. Implementors can signal that the
	// index definition provided cannot be included with the second return param
	GenerateCreateTableIndexDefinition(isUnique, isSpatial, isFullText, isVector bool, indexID string, indexCols []string, comment string) (string, bool)
	// GenerateCreateTableForiegnKeyDefinition returns foreign key constraint definition string for 'CREATE TABLE' statement
	// for given foreign key. This part comes after index definitions if there are any.
	GenerateCreateTableForiegnKeyDefinition(fkName string, fkCols []string, parentTbl string, parentCols []string, onDelete, onUpdate string) string
	// GenerateCreateTableCheckConstraintClause returns check constraint clause string for 'CREATE TABLE' statement
	// for given check constraint. This part comes the last and after foreign key definitions if there are any.
	GenerateCreateTableCheckConstraintClause(checkName, checkExpr string, enforced bool) string
	// QuoteIdentifier returns the identifier given quoted according to this parser's dialect. This is used to
	// standardize identifiers that cannot be parsed without quoting, because they break the normal identifier naming
	// rules (such as containing spaces)
	QuoteIdentifier(identifier string) string
}

// MysqlParser is a mysql syntax parser used as parser in the engine for Dolt.
type MysqlParser struct{}

var _ Parser = &MysqlParser{}

// NewMysqlParser creates new MysqlParser
func NewMysqlParser() *MysqlParser {
	return &MysqlParser{}
}

// ParseSimple implements Parser interface.
func (m *MysqlParser) ParseSimple(query string) (ast.Statement, error) {
	return ast.Parse(query)
}

// Parse implements Parser interface.
func (m *MysqlParser) Parse(ctx *Context, query string, multi bool) (ast.Statement, string, string, error) {
	defer trace2.StartRegion(ctx, "Parse").End()
	return m.ParseWithOptions(ctx, query, ';', multi, LoadSqlMode(ctx).ParserOptions())
}

// ParseWithOptions implements Parser interface.
func (m *MysqlParser) ParseWithOptions(ctx context.Context, query string, delimiter rune, multi bool, options ast.ParserOptions) (stmt ast.Statement, parsed, remainder string, err error) {
	s := RemoveSpaceAndDelimiter(query, delimiter)
	parsed = s

	if !multi {
		stmt, err = ast.ParseWithOptions(ctx, s, options)
	} else {
		var ri int
		stmt, ri, err = ast.ParseOneWithOptions(ctx, s, options)
		if ri != 0 && ri < len(s) {
			parsed = s[:ri]
			parsed = RemoveSpaceAndDelimiter(parsed, delimiter)
			remainder = s[ri:]
		}
	}
	return
}

// ParseOneWithOptions implements Parser interface.
func (m *MysqlParser) ParseOneWithOptions(ctx context.Context, s string, options ast.ParserOptions) (ast.Statement, int, error) {
	return ast.ParseOneWithOptions(ctx, s, options)
}

// RemoveSpaceAndDelimiter removes space characters and given delimiter characters from the given query.
func RemoveSpaceAndDelimiter(query string, d rune) string {
	query = strings.TrimSpace(query)
	// trim spaces and empty statements
	return strings.TrimRightFunc(query, func(r rune) bool {
		return r == d || unicode.IsSpace(r)
	})
}

// EscapeSpecialCharactersInComment escapes special characters in a comment string.
func EscapeSpecialCharactersInComment(comment string) string {
	commentString := comment
	commentString = strings.ReplaceAll(commentString, "'", "''")
	commentString = strings.ReplaceAll(commentString, "\\", "\\\\")
	commentString = strings.ReplaceAll(commentString, "\"", "\\\"")
	commentString = strings.ReplaceAll(commentString, "\n", "\\n")
	commentString = strings.ReplaceAll(commentString, "\r", "\\r")
	commentString = strings.ReplaceAll(commentString, "\x00", "\\0")
	return commentString
}

type MySqlSchemaFormatter struct{}

var _ SchemaFormatter = &MySqlSchemaFormatter{}

// GenerateCreateTableStatement implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTableStatement(tblName string, colStmts []string, temp, autoInc, tblCharsetName, tblCollName, comment string) string {
	if comment != "" {
		// Escape any single quotes in the comment and add the COMMENT keyword
		comment = fmt.Sprintf(" COMMENT='%s'", EscapeSpecialCharactersInComment(comment))
	}

	if autoInc != "" {
		autoInc = fmt.Sprintf(" AUTO_INCREMENT=%s", autoInc)
	}

	return fmt.Sprintf(
		"CREATE%s TABLE %s (\n%s\n) ENGINE=InnoDB%s DEFAULT CHARSET=%s COLLATE=%s%s",
		temp,
		m.QuoteIdentifier(tblName),
		strings.Join(colStmts, ",\n"),
		autoInc,
		tblCharsetName,
		tblCollName,
		comment,
	)
}

// GenerateCreateTableColumnDefinition implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTableColumnDefinition(col *Column, colDefault, onUpdate string, tableCollation CollationID) string {
	var colTypeString string
	if collationType, ok := col.Type.(TypeWithCollation); ok {
		colTypeString = collationType.StringWithTableCollation(tableCollation)
	} else {
		colTypeString = col.Type.String()
	}
	stmt := fmt.Sprintf("  %s %s", m.QuoteIdentifier(col.Name), colTypeString)
	if !col.Nullable {
		stmt = fmt.Sprintf("%s NOT NULL", stmt)
	}

	if col.AutoIncrement {
		stmt = fmt.Sprintf("%s AUTO_INCREMENT", stmt)
	}

	if c, ok := col.Type.(SpatialColumnType); ok {
		if s, d := c.GetSpatialTypeSRID(); d {
			stmt = fmt.Sprintf("%s /*!80003 SRID %v */", stmt, s)
		}
	}

	if col.Generated != nil {
		storedStr := ""
		if !col.Virtual {
			storedStr = " STORED"
		}
		stmt = fmt.Sprintf("%s GENERATED ALWAYS AS %s%s", stmt, col.Generated.String(), storedStr)
	}

	if col.Default != nil && col.Generated == nil {
		stmt = fmt.Sprintf("%s DEFAULT %s", stmt, colDefault)
	}

	if col.OnUpdate != nil {
		stmt = fmt.Sprintf("%s ON UPDATE %s", stmt, onUpdate)
	}

	if col.Comment != "" {
		stmt = fmt.Sprintf("%s COMMENT '%s'", stmt, EscapeSpecialCharactersInComment(col.Comment))
	}
	return stmt
}

// GenerateCreateTablePrimaryKeyDefinition implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTablePrimaryKeyDefinition(pkCols []string) string {
	return fmt.Sprintf("  PRIMARY KEY (%s)", strings.Join(m.QuoteIdentifiers(pkCols), ","))
}

// GenerateCreateTableIndexDefinition implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTableIndexDefinition(isUnique, isSpatial, isFullText, isVector bool, indexID string, indexCols []string, comment string) (string, bool) {
	unique := ""
	if isUnique {
		unique = "UNIQUE "
	}

	spatial := ""
	if isSpatial {
		unique = "SPATIAL "
	}

	fulltext := ""
	if isFullText {
		fulltext = "FULLTEXT "
	}

	vector := ""
	if isVector {
		vector = "VECTOR "
	}

	key := fmt.Sprintf("  %s%s%s%sKEY %s (%s)", unique, spatial, fulltext, vector, m.QuoteIdentifier(indexID), strings.Join(indexCols, ","))
	if comment != "" {
		key = fmt.Sprintf("%s COMMENT '%s'", key, comment)
	}
	return key, true
}

// GenerateCreateTableForiegnKeyDefinition implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTableForiegnKeyDefinition(fkName string, fkCols []string, parentTbl string, parentCols []string, onDelete, onUpdate string) string {
	keyCols := strings.Join(m.QuoteIdentifiers(fkCols), ",")
	refCols := strings.Join(m.QuoteIdentifiers(parentCols), ",")
	fkey := fmt.Sprintf("  CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (%s)", m.QuoteIdentifier(fkName), keyCols, m.QuoteIdentifier(parentTbl), refCols)
	if onDelete != "" {
		fkey = fmt.Sprintf("%s ON DELETE %s", fkey, onDelete)
	}
	if onUpdate != "" {
		fkey = fmt.Sprintf("%s ON UPDATE %s", fkey, onUpdate)
	}
	return fkey
}

// GenerateCreateTableCheckConstraintClause implements the SchemaFormatter interface.
func (m *MySqlSchemaFormatter) GenerateCreateTableCheckConstraintClause(checkName, checkExpr string, enforced bool) string {
	cc := fmt.Sprintf("  CONSTRAINT %s CHECK (%s)", m.QuoteIdentifier(checkName), checkExpr)
	if !enforced {
		cc = fmt.Sprintf("%s /*!80016 NOT ENFORCED */", cc)
	}
	return cc
}

// QuoteIdentifier wraps the specified identifier in backticks and escapes all occurrences of backticks in the
// identifier by replacing them with double backticks.
func (m *MySqlSchemaFormatter) QuoteIdentifier(id string) string {
	return fmt.Sprintf("`%s`", strings.ReplaceAll(id, "`", "``"))
}

// QuoteIdentifiers wraps each of the specified identifiers in backticks, escapes all occurrences of backticks in
// the identifier, and returns a slice of the quoted identifiers.
func (m *MySqlSchemaFormatter) QuoteIdentifiers(ids []string) []string {
	quoted := make([]string, len(ids))
	for i, id := range ids {
		quoted[i] = m.QuoteIdentifier(id)
	}
	return quoted
}
