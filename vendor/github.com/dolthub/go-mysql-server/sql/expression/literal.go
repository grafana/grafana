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

	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Literal represents a literal expression (string, number, bool, ...).
type Literal struct {
	Val  interface{}
	Typ  sql.Type
	val2 sql.Value
}

var _ sql.Expression = &Literal{}
var _ sql.Expression2 = &Literal{}
var _ sql.CollationCoercible = &Literal{}
var _ sqlparser.Injectable = &Literal{}

// NewLiteral creates a new Literal expression.
func NewLiteral(value interface{}, fieldType sql.Type) *Literal {
	val2, _ := sql.ConvertToValue(value)
	return &Literal{
		Val:  value,
		val2: val2,
		Typ:  fieldType,
	}
}

// Resolved implements the Expression interface.
func (lit *Literal) Resolved() bool {
	return true
}

// IsNullable implements the Expression interface.
func (lit *Literal) IsNullable() bool {
	return lit.Val == nil
}

// Type implements the Expression interface.
func (lit *Literal) Type() sql.Type {
	return lit.Typ
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (lit *Literal) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if types.IsText(lit.Typ) {
		collation, _ = lit.Typ.CollationCoercibility(ctx)
		return collation, 4
	}
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (lit *Literal) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return lit.Val, nil
}

func (lit *Literal) String() string {
	switch litVal := lit.Val.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", litVal)
	case string:
		switch lit.Typ.Type() {
		// utf8 charset cannot encode binary string
		case query.Type_VARBINARY, query.Type_BINARY:
			return fmt.Sprintf("'0x%X'", litVal)
		}
		// Conversion of \' to \'\' required as this string will be interpreted by the sql engine.
		// Backslash chars also need to be replaced.
		escaped := strings.ReplaceAll(litVal, "'", "''")
		escaped = strings.ReplaceAll(escaped, "\\", "\\\\")
		return fmt.Sprintf("'%s'", escaped)
	case decimal.Decimal:
		return litVal.StringFixed(litVal.Exponent() * -1)
	case []byte:
		return fmt.Sprintf("0x%X", litVal)
	case nil:
		return "NULL"
	default:
		return fmt.Sprint(litVal)
	}
}

func (lit *Literal) DebugString() string {
	typeStr := lit.Typ.String()
	switch v := lit.Val.(type) {
	case string:
		return fmt.Sprintf("%s (%s)", v, typeStr)
	case []byte:
		return fmt.Sprintf("BLOB(%s)", string(v))
	case nil:
		return fmt.Sprintf("NULL (%s)", typeStr)
	case int, uint, int8, uint8, int16, uint16, int32, uint32, int64, uint64:
		return fmt.Sprintf("%d (%s)", v, typeStr)
	case float32, float64:
		return fmt.Sprintf("%f (%s)", v, typeStr)
	case bool:
		return fmt.Sprintf("%t (%s)", v, typeStr)
	default:
		return fmt.Sprintf("%s (%s)", v, typeStr)
	}
}

// WithChildren implements the Expression interface.
func (lit *Literal) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(lit, len(children), 0)
	}
	return lit, nil
}

// Children implements the Expression interface.
func (*Literal) Children() []sql.Expression {
	return nil
}

func (lit *Literal) Eval2(ctx *sql.Context, row sql.Row2) (sql.Value, error) {
	return lit.val2, nil
}

func (lit *Literal) Type2() sql.Type2 {
	t2, ok := lit.Typ.(sql.Type2)
	if !ok {
		panic(fmt.Errorf("expected Type2, but was %T", lit.Typ))
	}
	return t2
}

// Value returns the literal value.
func (p *Literal) Value() interface{} {
	return p.Val
}

func (lit *Literal) WithResolvedChildren(children []any) (any, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(lit, len(children), 0)
	}
	return lit, nil
}
