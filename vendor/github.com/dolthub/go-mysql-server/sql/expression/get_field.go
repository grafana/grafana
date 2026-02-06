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

package expression

import (
	"fmt"
	"strings"

	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

// GetField is an expression to get the field of a table.
type GetField struct {
	fieldType  sql.Type
	fieldType2 sql.Type2
	// schemaFormatter is the schemaFormatter used to quote field names
	schemaFormatter sql.SchemaFormatter

	db         string
	table      string
	name       string
	fieldIndex int

	// exprId lets the lifecycle of getFields be idempotent. We can re-index
	// or re-apply scope/caching optimizations without worrying about losing
	// the reference to the unique id.
	exprId  sql.ColumnId
	tableId sql.TableId

	// quoteName indicates whether the field name should be quoted when printed with String()
	quoteName bool
	nullable  bool
}

var _ sql.Expression = (*GetField)(nil)
var _ sql.Expression2 = (*GetField)(nil)
var _ sql.CollationCoercible = (*GetField)(nil)
var _ sql.IdExpression = (*GetField)(nil)

// NewGetField creates a GetField expression.
func NewGetField(index int, fieldType sql.Type, fieldName string, nullable bool) *GetField {
	return NewGetFieldWithTable(index, 0, fieldType, "", "", fieldName, nullable)
}

// NewGetFieldWithTable creates a GetField expression with table name. The table name may be an alias.
func NewGetFieldWithTable(index, tableId int, fieldType sql.Type, db, table, fieldName string, nullable bool) *GetField {
	fieldType2, _ := fieldType.(sql.Type2)
	return &GetField{
		db:         db,
		table:      table,
		fieldIndex: index,
		fieldType:  fieldType,
		fieldType2: fieldType2,
		name:       fieldName,
		nullable:   nullable,
		exprId:     sql.ColumnId(index),
		tableId:    sql.TableId(tableId),
	}
}

// Index returns the index where the GetField will look for the value from a sql.Row.
func (p *GetField) Index() int { return p.fieldIndex }

func (p *GetField) Id() sql.ColumnId { return p.exprId }

func (p *GetField) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *p
	ret.exprId = id
	return &ret
}

func (p *GetField) TableId() sql.TableId { return p.tableId }

func (p *GetField) Database() string { return p.db }

// Children implements the Expression interface.
func (*GetField) Children() []sql.Expression {
	return nil
}

// Table returns the name of the field table.
func (p *GetField) Table() string { return p.table }

func (p *GetField) TableID() sql.TableId {
	return p.tableId
}

// WithTable returns a copy of this expression with the table given
func (p *GetField) WithTable(table string) *GetField {
	p2 := *p
	p2.table = table
	return &p2
}

// WithName returns a copy of this expression with the field name given.
func (p *GetField) WithName(name string) *GetField {
	p2 := *p
	p2.name = name
	return &p2
}

// Resolved implements the Expression interface.
func (p *GetField) Resolved() bool {
	return true
}

// Name implements the Nameable interface.
func (p *GetField) Name() string {
	return p.name
}

// IsNullable returns whether the field is nullable or not.
func (p *GetField) IsNullable() bool {
	return p.nullable
}

// Type returns the type of the field.
func (p *GetField) Type() sql.Type {
	return p.fieldType
}

// Type2 returns the type of the field, if this field has a sql.Type2.
func (p *GetField) Type2() sql.Type2 {
	return p.fieldType2
}

// ErrIndexOutOfBounds is returned when the field index is out of the bounds.
var ErrIndexOutOfBounds = errors.NewKind("unable to find field with index %d in row of %d columns")

// Eval implements the Expression interface.
func (p *GetField) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if p.fieldIndex < 0 || p.fieldIndex >= len(row) {
		return nil, ErrIndexOutOfBounds.New(p.fieldIndex, len(row))
	}
	return row[p.fieldIndex], nil
}

func (p *GetField) Eval2(ctx *sql.Context, row sql.Row2) (sql.Value, error) {
	if p.fieldIndex < 0 || p.fieldIndex >= row.Len() {
		return sql.Value{}, ErrIndexOutOfBounds.New(p.fieldIndex, row.Len())
	}

	return row.GetField(p.fieldIndex), nil
}

// WithChildren implements the Expression interface.
func (p *GetField) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 0)
	}
	return p, nil
}

func (p *GetField) String() string {
	// We never quote anything if the table identifier is present. Quoting the field name is a very narrow use case
	// used only for serializing column default values and related fields, in which case the table name will always be
	// stripped away. The output of this method is load-bearing in many places of analysis and execution.
	if p.table == "" {
		if p.quoteName {
			return p.schemaFormatter.QuoteIdentifier(p.name)
		}
		return p.name
	}

	return p.table + "." + p.name
}

func (p *GetField) DebugString() string {
	var notNull string
	if !p.nullable {
		notNull = "!null"
	}
	if p.table == "" {
		return fmt.Sprintf("%s:%d%s", p.name, p.fieldIndex, notNull)
	}
	return fmt.Sprintf("%s.%s:%d%s", p.table, p.name, p.fieldIndex, notNull)
}

// WithIndex returns this same GetField with a new index.
func (p *GetField) WithIndex(n int) sql.Expression {
	p2 := *p
	p2.fieldIndex = n
	return &p2
}

// WithQuotedNames returns a copy of this expression with the backtick names flag set to the given value.
func (p *GetField) WithQuotedNames(formatter sql.SchemaFormatter, quoteNames bool) *GetField {
	p2 := *p
	p2.quoteName = quoteNames
	p2.schemaFormatter = formatter
	return &p2
}

// IsQuotedIdentifier returns whether the field name should be quoted.
func (p *GetField) IsQuotedIdentifier() bool {
	return p.quoteName
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *GetField) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	collation, _ = p.fieldType.CollationCoercibility(ctx)
	return collation, 2
}

// SchemaToGetFields takes a schema and returns an expression array of
// GetFields. If |columns| is provided, each get field will get the
// appropriate expression id.
func SchemaToGetFields(s sql.Schema, columns sql.ColSet) []sql.Expression {
	ret := make([]sql.Expression, len(s))

	var offset sql.ColumnId
	if !columns.Empty() {
		offset, _ = columns.Next(1)
	}
	for i, col := range s {
		// 0 id represents the dual table column
		id := i
		if offset > 0 {
			id += int(offset)
		}
		ret[i] = NewGetFieldWithTable(id, 0, col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable)
	}

	return ret
}

// ExtractGetField returns the inner GetField expression from another expression. If there are multiple GetField
// expressions that are not the same, then none of the GetField expressions are returned.
func ExtractGetField(e sql.Expression) *GetField {
	var field *GetField
	multipleFields := false
	sql.Inspect(e, func(expr sql.Expression) bool {
		if f, ok := expr.(*GetField); ok {
			if field == nil {
				field = f
			} else if strings.ToLower(field.table) != strings.ToLower(f.table) ||
				strings.ToLower(field.name) != strings.ToLower(f.name) {
				multipleFields = true
				return false
			}
			return true
		}
		return true
	})

	if multipleFields {
		return nil
	}
	return field
}
