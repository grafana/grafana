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

// JSON_REMOVE(json_doc, path[, path] ...)
//
// JSONRemove Removes data from a JSON document and returns the result. Returns NULL if any argument is NULL. An error
// occurs if the json_doc argument is not a valid JSON document or any path argument is not a valid path expression or
// is $ or contains a * or ** wildcard. The path arguments are evaluated left to right. The document produced by
// evaluating one path becomes the new value against which the next path is evaluated. It is not an error if the element
// to be removed does not exist in the document; in that case, the path does not affect the document.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-remove
type JSONRemove struct {
	doc   sql.Expression
	paths []sql.Expression
}

func (j JSONRemove) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}
	return true
}

func (j JSONRemove) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j JSONRemove) Type() sql.Type {
	return types.JSON
}

func (j JSONRemove) IsNullable() bool {
	for _, path := range j.paths {
		if path.IsNullable() {
			return true
		}
	}
	return j.doc.IsNullable()
}

func (j JSONRemove) Children() []sql.Expression {
	return append([]sql.Expression{j.doc}, j.paths...)
}

func (j JSONRemove) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_remove did not receive the correct amount of args")
	}
	return NewJSONRemove(children...)
}

var _ sql.FunctionExpression = JSONRemove{}

// NewJSONRemove creates a new JSONRemove function.
func NewJSONRemove(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_REMOVE", "2 or more", len(args))
	}

	return JSONRemove{args[0], args[1:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONRemove) FunctionName() string {
	return "json_remove"
}

// Description implements sql.FunctionExpression
func (j JSONRemove) Description() string {
	return "removes data from JSON document."
}

func (j JSONRemove) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	doc, err := getMutableJSONVal(ctx, row, j.doc)
	if err != nil || doc == nil {
		return nil, getJsonFunctionError("json_remove", 1, err)
	}

	for _, path := range j.paths {
		path, err := buildPath(ctx, path, row)
		if err != nil {
			return nil, err
		}
		if path == nil {
			return nil, nil
		}

		doc, _, err = doc.Remove(ctx, *path)
		if err != nil {
			return nil, err
		}
	}
	return doc, nil
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONRemove) IsUnsupported() bool {
	return false
}
