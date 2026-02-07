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
	"encoding/json"
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSONPretty (json_val)
//
// JSONPretty Provides pretty-printing of JSON values similar to that implemented in PHP and by other languages and
// database systems. The value supplied must be a JSON value or a valid string representation of a JSON value.
// Extraneous whitespaces and newlines present in this value have no effect on the output. For a NULL value, the
// function returns NULL. If the value is not a JSON document, or if it cannot be parsed as one, the function fails
// with an error. Formatting of the output from this function adheres to the following rules:
//   - Each array element or object member appears on a separate line, indented by one additional level as compared to
//     its parent.
//   - Each level of indentation adds two leading spaces.
//   - A comma separating individual array elements or object members is printed before the newline that separates the
//     two elements or members.
//   - The key and the value of an object member are separated by a colon followed by a space (': ').
//   - An empty object or array is printed on a single line. No space is printed between the opening and closing brace.
//   - Special characters in string scalars and key names are escaped employing the same rules used by JSONQuote.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-utility-functions.html#function_json-pretty
type JSONPretty struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = &JSONPretty{}

// NewJSONPretty creates a new JSONPretty function.
func NewJSONPretty(arg sql.Expression) sql.Expression {
	return &JSONPretty{expression.UnaryExpression{Child: arg}}
}

// FunctionName implements sql.FunctionExpression
func (j *JSONPretty) FunctionName() string {
	return "json_pretty"
}

// Description implements sql.FunctionExpression
func (j *JSONPretty) Description() string {
	return "prints a JSON document in human-readable format."
}

// String implements sql.Expression
func (j *JSONPretty) String() string {
	return fmt.Sprintf("%s(%s)", j.FunctionName(), j.Child.String())
}

// Type implements sql.Expression
func (j *JSONPretty) Type() sql.Type {
	return types.LongText
}

// Eval implements sql.Expression
func (j *JSONPretty) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span(fmt.Sprintf("function.%s", j.FunctionName()))
	defer span.End()

	doc, err := getJSONDocumentFromRow(ctx, row, j.Child)
	if err != nil {
		return nil, getJsonFunctionError("json_pretty", 1, err)
	}
	if doc == nil {
		return nil, nil
	}
	val, err := doc.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	res, err := json.MarshalIndent(val, "", "  ")
	if err != nil {
		return nil, err
	}

	return string(res), nil
}

// WithChildren implements sql.Expression
func (j *JSONPretty) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(j, len(children), 1)
	}
	return NewJSONPretty(children[0]), nil
}
