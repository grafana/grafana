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

package json

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_ARRAY_APPEND(json_doc, path, val[, path, val] ...)
//
// JSONArrayAppend Appends values to the end of the indicated arrays within a JSON document and returns the result.
// Returns NULL if any argument is NULL. An error occurs if the json_doc argument is not a valid JSON document or any
// path argument is not a valid path expression or contains a * or ** wildcard. The path-value pairs are evaluated left
// to right. The document produced by evaluating one pair becomes the new value against which the next pair is
// evaluated. If a path selects a scalar or object value, that value is autowrapped within an array and the new value is
// added to that array. Pairs for which the path does not identify any value in the JSON document are ignored.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-array-append
type JSONArrayAppend struct {
	doc      sql.Expression
	pathVals []sql.Expression
}

func (j JSONArrayAppend) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}
	return true
}

func (j JSONArrayAppend) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j JSONArrayAppend) Type() sql.Type {
	return types.JSON
}

func (j JSONArrayAppend) IsNullable() bool {
	for _, arg := range j.pathVals {
		if arg.IsNullable() {
			return true
		}
	}
	return j.doc.IsNullable()
}

func (j JSONArrayAppend) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	doc, err := getMutableJSONVal(ctx, row, j.doc)
	if err != nil || doc == nil {
		return nil, getJsonFunctionError("json_array_append", 1, err)

	}

	pairs := make([]pathValPair, 0, len(j.pathVals)/2)
	for i := 0; i < len(j.pathVals); i += 2 {
		argPair, err := buildPathValue(ctx, j.pathVals[i], j.pathVals[i+1], row)
		if argPair == nil || err != nil {
			return nil, err
		}
		pairs = append(pairs, *argPair)
	}

	// Apply the path-value pairs to the document.
	for _, pair := range pairs {
		doc, _, err = doc.ArrayAppend(ctx, pair.path, pair.val)
		if err != nil {
			return nil, err
		}
	}

	return doc, nil
}

func (j JSONArrayAppend) Children() []sql.Expression {
	return append([]sql.Expression{j.doc}, j.pathVals...)
}

func (j JSONArrayAppend) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_array_append did not receive the correct number of args")
	}
	return NewJSONArrayAppend(children...)
}

var _ sql.FunctionExpression = JSONArrayAppend{}

// NewJSONArrayAppend creates a new JSONArrayAppend function.
func NewJSONArrayAppend(args ...sql.Expression) (sql.Expression, error) {
	if len(args) <= 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_ARRAY_APPEND", "more than 1", len(args))
	} else if (len(args)-1)%2 == 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_ARRAY_APPEND", "even number of path/val", len(args)-1)
	}

	return JSONArrayAppend{args[0], args[1:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONArrayAppend) FunctionName() string {
	return "json_array_append"
}

// Description implements sql.FunctionExpression
func (j JSONArrayAppend) Description() string {
	return "appends data to JSON document."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONArrayAppend) IsUnsupported() bool {
	return false
}
