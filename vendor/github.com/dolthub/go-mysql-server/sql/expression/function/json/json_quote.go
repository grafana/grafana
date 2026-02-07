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

package json

import (
	"fmt"
	"reflect"

	"github.com/dolthub/go-mysql-server/internal/strings"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSONQuote (string)
//
// JSONQuote Quotes a string as a JSON value by wrapping it with double quote characters and escaping interior quote and
// other characters, then returning the result as a utf8mb4 string. Returns NULL if the argument is NULL. This function
// is typically used to produce a valid JSON string literal for inclusion within a JSON document. Certain special
// characters are escaped with backslashes per the escape sequences shown in Table 12.23, “JSON_UNQUOTE() Special
// Character Escape Sequences”:
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#json-unquote-character-escape-sequences
//
// https://dev.mysql.com/doc/refman/8.0/en/json-creation-functions.html#function_json-quote
type JSONQuote struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*JSONQuote)(nil)
var _ sql.CollationCoercible = (*JSONQuote)(nil)

// NewJSONQuote creates a new JSONQuote UDF.
func NewJSONQuote(json sql.Expression) sql.Expression {
	return &JSONQuote{expression.UnaryExpression{Child: json}}
}

// FunctionName implements sql.FunctionExpression
func (js *JSONQuote) FunctionName() string {
	return "json_quote"
}

// Description implements sql.FunctionExpression
func (js *JSONQuote) Description() string {
	return "quotes a string as a JSON value and returns the result as a utf8mb4 string."
}

// String implements the fmt.Stringer interface.
func (js *JSONQuote) String() string {
	return fmt.Sprintf("%s(%s)", js.FunctionName(), js.Child)
}

// Type implements the Expression interface.
func (*JSONQuote) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONQuote) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 4
}

// WithChildren implements the Expression interface.
func (js *JSONQuote) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(js, len(children), 1)
	}
	return NewJSONQuote(children[0]), nil
}

// Eval implements the Expression interface.
func (js *JSONQuote) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	typ := js.Child.Type()
	if typ != types.Null && !types.IsText(typ) {
		return nil, sql.ErrInvalidType.New(typ)
	}

	val, err := js.Child.Eval(ctx, row)
	if val == nil || err != nil {
		return val, err
	}

	ex, _, err := types.LongText.Convert(ctx, val)
	if err != nil {
		return nil, err
	}
	if ex == nil {
		return nil, nil
	}
	str, ok := ex.(string)
	if !ok {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(ex).String())
	}

	return strings.Quote(str), nil
}
