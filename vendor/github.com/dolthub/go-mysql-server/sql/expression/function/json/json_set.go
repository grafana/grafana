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

// JSONSet (json_doc, path, val[, path, val] ...)
//
// JSONSet Inserts or updates data in a JSON document and returns the result. Returns NULL if any argument is NULL or
// path, if given, does not locate an object. An error occurs if the json_doc argument is not a valid JSON document or
// any path argument is not a valid path expression or contains a * or ** wildcard. The path-value pairs are evaluated
// left to right. The document produced by evaluating one pair becomes the new value against which the next pair is
// evaluated. A path-value pair for an existing path in the document overwrites the existing document value with the
// new value. A path-value pair for a non-existing path in the document adds the value to the document if the path
// identifies one of these types of values:
//   - A member not present in an existing object. The member is added to the object and associated with the new value.
//   - A position past the end of an existing array. The array is extended with the new value. If the existing value is
//     not an array, it is auto-wrapped as an array, then extended with the new value.
//
// Otherwise, a path-value pair for a non-existing path in the document is ignored and has no effect.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-set

type JSONSet struct {
	JSONDoc     sql.Expression
	PathAndVals []sql.Expression
}

var _ sql.FunctionExpression = (*JSONContains)(nil)

// NewJSONSet creates a new JSONSet function.
func NewJSONSet(args ...sql.Expression) (sql.Expression, error) {
	if len(args) <= 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_SET", "more than 1", len(args))
	} else if (len(args)-1)%2 == 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_SET", "even number of path/val", len(args)-1)
	}

	return &JSONSet{args[0], args[1:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONSet) FunctionName() string {
	return "json_set"
}

// Description implements sql.FunctionExpression
func (j *JSONSet) Description() string {
	return "inserts data into JSON document."
}

// Resolved implements sql.Expression
func (j *JSONSet) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}

	return true
}

// Children implements sql.Expression
func (j *JSONSet) Children() []sql.Expression {
	return append([]sql.Expression{j.JSONDoc}, j.PathAndVals...)
}

// WithChildren implements sql.Expression
func (j *JSONSet) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_set did not receive the correct amount of args")
	}

	return NewJSONSet(children...)
}

// String implements Stringer
func (j *JSONSet) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

// Type implements sql.Expression
func (j *JSONSet) Type() sql.Type {
	return types.JSON
}

// IsNullable implements sql.Expression
func (j *JSONSet) IsNullable() bool {
	for _, pv := range j.PathAndVals {
		if pv.IsNullable() {
			return true
		}
	}
	return j.JSONDoc.IsNullable()
}

// Eval implements sql.Expression
func (j *JSONSet) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	doc, err := getMutableJSONVal(ctx, row, j.JSONDoc)
	if err != nil || doc == nil {
		return nil, getJsonFunctionError("json_set", 1, err)
	}

	pairs := make([]pathValPair, 0, len(j.PathAndVals)/2)
	for i := 0; i < len(j.PathAndVals); i += 2 {
		argPair, err := buildPathValue(ctx, j.PathAndVals[i], j.PathAndVals[i+1], row)
		if argPair == nil || err != nil {
			return nil, err
		}
		pairs = append(pairs, *argPair)
	}

	// Apply the path-value pairs to the document.
	for _, pair := range pairs {
		doc, _, err = doc.Set(ctx, pair.path, pair.val)
		if err != nil {
			return nil, err
		}
	}

	return doc, nil
}
