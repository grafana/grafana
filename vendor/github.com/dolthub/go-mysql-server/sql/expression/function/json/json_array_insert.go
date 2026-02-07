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

// JSON_ARRAY_INSERT(json_doc, path, val[, path, val] ...)
//
// JSONArrayInsert Updates a JSON document, inserting into an array within the document and returning the modified
// document. Returns NULL if any argument is NULL. An error occurs if the json_doc argument is not a valid JSON document
// or any path argument is not a valid path expression or contains a * or ** wildcard or does not end with an array
// element identifier. The path-value pairs are evaluated left to right. The document produced by evaluating one pair
// becomes the new value against which the next pair is evaluated. Pairs for which the path does not identify any array
// in the JSON document are ignored. If a path identifies an array element, the corresponding value is inserted at that
// element position, shifting any following values to the right. If a path identifies an array position past the end of
// an array, the value is inserted at the end of the array.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-array-insert
type JSONArrayInsert struct {
	doc      sql.Expression
	pathVals []sql.Expression
}

func (j JSONArrayInsert) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}
	return true
}

func (j JSONArrayInsert) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j JSONArrayInsert) Type() sql.Type {
	return types.JSON
}

func (j JSONArrayInsert) IsNullable() bool {
	for _, arg := range j.pathVals {
		if arg.IsNullable() {
			return true
		}
	}
	return j.doc.IsNullable()
}

func (j JSONArrayInsert) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	doc, err := getMutableJSONVal(ctx, row, j.doc)
	if err != nil || doc == nil {
		return nil, getJsonFunctionError("json_array_insert", 1, err)
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
		doc, _, err = doc.ArrayInsert(ctx, pair.path, pair.val)
		if err != nil {
			return nil, err
		}
	}

	return doc, nil
}

func (j JSONArrayInsert) Children() []sql.Expression {
	return append([]sql.Expression{j.doc}, j.pathVals...)
}

func (j JSONArrayInsert) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_array_insert did not receive the correct amount of args")
	}
	return NewJSONArrayInsert(children...)
}

var _ sql.FunctionExpression = JSONArrayInsert{}

// NewJSONArrayInsert creates a new JSONArrayInsert function.
func NewJSONArrayInsert(args ...sql.Expression) (sql.Expression, error) {
	if len(args) <= 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_ARRAY_INSERT", "more than 1", len(args))
	} else if (len(args)-1)%2 == 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_ARRAY_INSERT", "even number of path/val", len(args)-1)
	}

	return JSONArrayInsert{args[0], args[1:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONArrayInsert) FunctionName() string {
	return "json_array_insert"
}

// Description implements sql.FunctionExpression
func (j JSONArrayInsert) Description() string {
	return "inserts into JSON array."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONArrayInsert) IsUnsupported() bool {
	return false
}
