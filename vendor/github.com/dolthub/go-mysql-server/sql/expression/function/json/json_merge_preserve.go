// Copyright 2022-2024 Dolthub, Inc.
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

// JSONMergePreserve (json_doc, json_doc[, json_doc] ...)
//
// JSONMergePreserve Merges two or more JSON documents and returns the merged result. Returns NULL if any argument is
// NULL. An error occurs if any argument is not a valid JSON document. Merging takes place according to the following
// rules:
//   - Adjacent arrays are merged to a single array.
//   - Adjacent objects are merged to a single object.
//   - A scalar value is autowrapped as an array and merged as an array.
//   - An adjacent array and object are merged by autowrapping the object as an array and merging the two arrays.
//
// This function was added in MySQL 8.0.3 as a synonym for JSONMerge. The JSONMerge function is now deprecated,
// and is subject to removal in a future release of MySQL.
//
// The behavior of JSONMergePatch is the same as that of JSONMergePreserve, with the following two exceptions:
//   - JSONMergePatch removes any member in the first object with a matching key in the second object, provided that
//     the value associated with the key in the second object is not JSON null.
//   - If the second object has a member with a key matching a member in the first object, JSONMergePatch replaces
//     the value in the first object with the value in the second object, whereas JSONMergePreserve appends the
//     second value to the first value.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-modification-functions.html#function_json-merge-preserve
type JSONMergePreserve struct {
	JSONs []sql.Expression
}

var _ sql.FunctionExpression = (*JSONMergePreserve)(nil)
var _ sql.CollationCoercible = (*JSONMergePreserve)(nil)

// NewJSONMergePreserve creates a new JSONMergePreserve function.
func NewJSONMergePreserve(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_MERGE_PRESERVE", 2, len(args))
	}

	return &JSONMergePreserve{JSONs: args}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONMergePreserve) FunctionName() string {
	return "json_merge_preserve"
}

// Description implements sql.FunctionExpression
func (j *JSONMergePreserve) Description() string {
	return "merges JSON documents, preserving duplicate keys."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONMergePreserve) IsUnsupported() bool {
	return false
}

// Resolved implements the Expression interface.
func (j *JSONMergePreserve) Resolved() bool {
	for _, d := range j.JSONs {
		if !d.Resolved() {
			return false
		}
	}
	return true
}

// String implements the Expression interface.
func (j *JSONMergePreserve) String() string {
	children := j.Children()
	var parts = make([]string, len(children))
	for i, c := range children {
		parts[i] = c.String()
	}
	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

// Type implements the Expression interface.
func (j *JSONMergePreserve) Type() sql.Type {
	return types.JSON
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONMergePreserve) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 2
}

// IsNullable implements the Expression interface.
func (j *JSONMergePreserve) IsNullable() bool {
	for _, d := range j.JSONs {
		if d.IsNullable() {
			return true
		}
	}
	return false
}

// Eval implements the Expression interface.
func (j *JSONMergePreserve) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	initDoc, err := getJSONDocumentFromRow(ctx, row, j.JSONs[0])
	if err != nil {
		return nil, getJsonFunctionError("json_merge_preserve", 1, err)
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
			return nil, getJsonFunctionError("json_merge_preserve", i+2, err)
		}
		if doc == nil {
			return nil, nil
		}
		val, err = doc.ToInterface(ctx)
		if err != nil {
			return nil, err
		}
		result = merge(result, val, false)
	}
	return types.JSONDocument{Val: result}, nil
}

// Children implements the Expression interface.
func (j *JSONMergePreserve) Children() []sql.Expression {
	return j.JSONs
}

// WithChildren implements the Expression interface.
func (j *JSONMergePreserve) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_merge_preserve did not receive the correct amount of args")
	}

	return NewJSONMergePreserve(children...)
}

// merge returns merged json document as interface{} type
// if patch is true, it will replace the value of the first object with the value of the second object
// otherwise, it will append the second value to the first value, creating an array if necessary
func merge(base, add interface{}, patch bool) interface{} {
	baseObj, baseOk := base.(map[string]interface{})
	addObj, addOk := add.(map[string]interface{})
	if !baseOk || !addOk {
		if patch {
			return add
		}
		return mergeIntoArrays(base, add)
	}

	// "base" and "add" are JSON objects
	for key, val := range addObj {
		if val == nil && patch {
			delete(baseObj, key)
			continue
		}
		baseVal, found := baseObj[key]
		if !found {
			baseObj[key] = val
			continue
		}
		baseObj[key] = merge(baseVal, val, patch)
	}

	return baseObj
}

// mergeIntoArrays returns array of interface{} that takes JSON object OR JSON array OR JSON value
func mergeIntoArrays(base, add interface{}) interface{} {
	var baseArray []interface{}

	if baseArr, ok := base.([]interface{}); ok {
		baseArray = baseArr
	} else {
		baseArray = append(baseArray, base)
	}

	if addArr, ok := add.([]interface{}); ok {
		return append(baseArray, addArr...)
	}

	return append(baseArray, add)
}
