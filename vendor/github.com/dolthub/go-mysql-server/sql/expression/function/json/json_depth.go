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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSONDepth (json_doc)
//
// JSONDepth Returns the maximum depth of a JSON document. Returns NULL if the argument is NULL. An error occurs if the
// argument is not a valid JSON document. An empty array, empty object, or scalar value has depth 1. A nonempty array
// containing only elements of depth 1 or nonempty object containing only member values of depth 1 has depth 2.
// Otherwise, a JSON document has depth greater than 2.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-attribute-functions.html#function_json-depth
type JSONDepth struct {
	JSON sql.Expression
}

var _ sql.FunctionExpression = &JSONDepth{}

// NewJSONDepth creates a new JSONDepth function.
func NewJSONDepth(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_DEPTH", "1", len(args))
	}
	return &JSONDepth{JSON: args[0]}, nil
}

// FunctionName implements sql.FunctionExpression interface.
func (j *JSONDepth) FunctionName() string {
	return "json_depth"
}

// Description implements sql.FunctionExpression interface.
func (j *JSONDepth) Description() string {
	return "returns maximum depth of JSON document."
}

// Resolved implements sql.Expression interface.
func (j *JSONDepth) Resolved() bool {
	return j.JSON.Resolved()
}

// String implements sql.Expression interface.
func (j *JSONDepth) String() string {
	return fmt.Sprintf("%s(%s)", j.FunctionName(), j.JSON.String())
}

// Type implements sql.Expression interface.
func (j *JSONDepth) Type() sql.Type {
	return types.Int64
}

// IsNullable implements sql.Expression interface.
func (j *JSONDepth) IsNullable() bool {
	return j.JSON.IsNullable()
}

// depth returns the maximum depth of a JSON document.
func depth(obj interface{}) (int, error) {
	var maxDepth int
	switch o := obj.(type) {
	case []interface{}:
		for _, v := range o {
			d, err := depth(v)
			if err != nil {
				return 0, err
			}
			if d > maxDepth {
				maxDepth = d
			}
		}
	case map[string]interface{}:
		for _, v := range o {
			d, err := depth(v)
			if err != nil {
				return 0, err
			}
			if d > maxDepth {
				maxDepth = d
			}
		}
	}
	return maxDepth + 1, nil
}

// Eval implements sql.Expression interface.
func (j *JSONDepth) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span(fmt.Sprintf("function.%s", j.FunctionName()))
	defer span.End()

	doc, err := getJSONDocumentFromRow(ctx, row, j.JSON)
	if err != nil {
		return nil, getJsonFunctionError("json_depth", 1, err)
	}
	if doc == nil {
		return nil, nil
	}

	val, err := doc.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	d, err := depth(val)
	if err != nil {
		return nil, err
	}

	return d, nil
}

// Children implements sql.Expression interface.
func (j *JSONDepth) Children() []sql.Expression {
	return []sql.Expression{j.JSON}
}

// WithChildren implements sql.Expression interface.
func (j *JSONDepth) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJSONDepth(children...)
}
