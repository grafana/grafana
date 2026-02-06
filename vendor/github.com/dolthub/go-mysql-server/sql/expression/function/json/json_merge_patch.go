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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSONMergePatch (json_doc, json_doc[, json_doc] ...)
//
// JSONMergePatch Performs an RFC 7396 compliant merge of two or more JSON documents and returns the merged result,
// without preserving members having duplicate keys. Raises an error if at least one of the documents passed as arguments
// to this function is not valid. JSONMergePatch performs a merge as follows:
//   - If the first argument is not an object, the result of the merge is the same as if an empty object had been merged
//     with the second argument.
//   - If the second argument is not an object, the result of the merge is the second argument.
//   - If both arguments are objects, the result of the merge is an object with the following members:
//   - All members of the first object which do not have a corresponding member with the same key in the second
//     object.
//   - All members of the second object which do not have a corresponding key in the first object, and whose value is
//     not the JSON null literal.
//   - All members with a key that exists in both the first and the second object, and whose value in the second
//     object is not the JSON null literal. The values of these members are the results of recursively merging the
//     value in the first object with the value in the second object.
//
// The behavior of JSONMergePatch is the same as that of JSONMergePreserve, with the following two exceptions:
//   - JSONMergePatch removes any member in the first object with a matching key in the second object, provided that
//     the value associated with the key in the second object is not JSON null.
//   - If the second object has a member with a key matching a member in the first object, JSONMergePatch replaces
//     the value in the first object with the value in the second object, whereas JSONMergePreserve appends the
//     second value to the first value.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-merge-patch
type JSONMergePatch struct {
	JSONs []sql.Expression
}

var _ sql.FunctionExpression = &JSONMergePatch{}

// NewJSONMergePatch creates a new JSONMergePatch function.
func NewJSONMergePatch(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_MERGE_PATCH", 2, len(args))
	}
	return &JSONMergePatch{JSONs: args}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONMergePatch) FunctionName() string {
	return "json_merge_patch"
}

// Description implements sql.FunctionExpression
func (j *JSONMergePatch) Description() string {
	return "merges JSON documents, replacing values of duplicate keys"
}

// Resolved implements sql.Expression
func (j *JSONMergePatch) Resolved() bool {
	for _, arg := range j.JSONs {
		if !arg.Resolved() {
			return false
		}
	}
	return true
}

// String implements sql.Expression
func (j *JSONMergePatch) String() string {
	children := j.Children()
	var parts = make([]string, len(children))
	for i, c := range children {
		parts[i] = c.String()
	}
	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

// Type implements the Expression interface.
func (j *JSONMergePatch) Type() sql.Type {
	return types.JSON
}

// IsNullable implements the Expression interface.
func (j *JSONMergePatch) IsNullable() bool {
	for _, arg := range j.JSONs {
		if arg.IsNullable() {
			return true
		}
	}
	return false
}

// Eval implements the Expression interface.
func (j *JSONMergePatch) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	initDoc, err := getJSONDocumentFromRow(ctx, row, j.JSONs[0])
	if err != nil {
		return nil, getJsonFunctionError("json_merge_patch", 1, err)
	}
	if initDoc == nil {
		return nil, nil
	}

	val, err := initDoc.ToInterface(ctx)
	if err != nil {
		return nil, err
	}

	result := types.DeepCopyJson(val)
	for i, json := range j.JSONs[1:] {
		var doc sql.JSONWrapper
		doc, err = getJSONDocumentFromRow(ctx, row, json)
		if err != nil {
			return nil, getJsonFunctionError("json_merge_patch", i+2, err)
		}
		if doc == nil {
			return nil, nil
		}
		val, err = doc.ToInterface(ctx)
		if err != nil {
			return nil, err
		}
		result = merge(result, val, true)
	}
	return types.JSONDocument{Val: result}, nil
}

// Children implements the Expression interface.
func (j *JSONMergePatch) Children() []sql.Expression {
	return j.JSONs
}

// WithChildren implements the Expression interface.
func (j *JSONMergePatch) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJSONMergePatch(children...)
}
