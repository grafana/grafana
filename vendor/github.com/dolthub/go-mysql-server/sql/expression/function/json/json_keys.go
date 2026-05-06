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
	"sort"

	"github.com/dolthub/jsonpath"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSONKeys (json_doc[, path])
//
// JSONKeys Returns the keys from the top-level value of a JSON object as a JSON array, or, if a path argument is given,
// the top-level keys from the selected path. Returns NULL if any argument is NULL, the json_doc argument is not an
// object, or path, if given, does not locate an object. An error occurs if the json_doc argument is not a valid JSON
// document or the path argument is not a valid path expression or contains a * or ** wildcard. The result array is
// empty if the selected object is empty. If the top-level value has nested subobjects, the return value does not
// include keys from those subobjects.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-keys
type JSONKeys struct {
	JSON sql.Expression
	Path sql.Expression
}

var _ sql.FunctionExpression = &JSONKeys{}

// NewJSONKeys creates a new JSONKeys function.
func NewJSONKeys(args ...sql.Expression) (sql.Expression, error) {
	if len(args) == 1 {
		return &JSONKeys{args[0], expression.NewLiteral("$", types.Text)}, nil
	}
	if len(args) == 2 {
		return &JSONKeys{args[0], args[1]}, nil
	}
	return nil, sql.ErrInvalidArgumentNumber.New("JSON_KEYS", "1 or 2", len(args))
}

// FunctionName implements sql.FunctionExpression
func (j *JSONKeys) FunctionName() string {
	return "json_keys"
}

// Description implements sql.FunctionExpression
func (j *JSONKeys) Description() string {
	return "returns the keys from the top-level value of a JSON object as a JSON array."
}

// Resolved implements sql.Expression
func (j *JSONKeys) Resolved() bool {
	return j.JSON.Resolved() && j.Path.Resolved()
}

// String implements sql.Expression
func (j *JSONKeys) String() string {
	return fmt.Sprintf("%s(%s, %s)", j.FunctionName(), j.JSON.String(), j.Path.String())
}

// Type implements sql.Expression
func (j *JSONKeys) Type() sql.Type {
	return types.JSON
}

// IsNullable implements sql.Expression
func (j *JSONKeys) IsNullable() bool {
	return j.JSON.IsNullable()
}

// Eval implements sql.Expression
func (j *JSONKeys) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span(fmt.Sprintf("function.%s", j.FunctionName()))
	defer span.End()

	doc, err := getJSONDocumentFromRow(ctx, row, j.JSON)
	if err != nil {
		return nil, getJsonFunctionError("json_keys", 1, err)
	}
	if doc == nil {
		return nil, nil
	}

	path, err := buildPath(ctx, j.Path, row)
	if err != nil {
		return nil, err
	}
	if path == nil {
		return nil, nil
	}

	js, err := types.LookupJSONValue(ctx, doc, *path)
	if err != nil {
		if errors.Is(err, jsonpath.ErrKeyError) {
			return nil, nil
		}
		return nil, err
	}

	if js == nil {
		return nil, nil
	}

	val, err := js.ToInterface(ctx)
	if err != nil {
		return nil, err
	}

	switch v := val.(type) {
	case map[string]any:
		res := make([]string, 0)
		for k := range v {
			res = append(res, k)
		}
		sort.Slice(res, func(i, j int) bool {
			if len(res[i]) != len(res[j]) {
				return len(res[i]) < len(res[j])
			}
			return res[i] < res[j]
		})
		result, _, err := types.JSON.Convert(ctx, res)
		if err != nil {
			return nil, err
		}
		return result, nil
	default:
		return nil, nil
	}
}

// Children implements sql.Expression
func (j *JSONKeys) Children() []sql.Expression {
	return []sql.Expression{j.JSON, j.Path}
}

// WithChildren implements sql.Expression
func (j *JSONKeys) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJSONKeys(children...)
}
