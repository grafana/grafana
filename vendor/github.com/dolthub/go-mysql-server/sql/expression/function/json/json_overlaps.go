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

// JSONOverlaps (json_doc1, json_doc2)
//
// JSONOverlaps Compares two JSON documents. Returns true (1) if the two document have any key-value pairs or array
// elements in common. If both arguments are scalars, the function performs a simple equality test.
//
// This function serves as counterpart to JSON_CONTAINS(), which requires all elements of the array searched for to be
// present in the array searched in. Thus, JSON_CONTAINS() performs an AND operation on search keys, while
// JSON_OVERLAPS() performs an OR operation.
//
// Queries on JSON columns of InnoDB tables using JSON_OVERLAPS() in the WHERE clause can be optimized using
// multi-valued indexes. Multi-Valued Indexes, provides detailed information and examples.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-overlaps
type JSONOverlaps struct {
	Left  sql.Expression
	Right sql.Expression
}

var _ sql.FunctionExpression = &JSONOverlaps{}

// NewJSONOverlaps creates a new JSONOverlaps function.
func NewJSONOverlaps(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_OVERLAPS", "2", len(args))
	}
	return &JSONOverlaps{Left: args[0], Right: args[1]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONOverlaps) FunctionName() string {
	return "json_overlaps"
}

// Description implements sql.FunctionExpression
func (j *JSONOverlaps) Description() string {
	return "compares two JSON documents, returns TRUE (1) if these have any key-value pairs or array elements in common, otherwise FALSE (0)."
}

// Resolved implements sql.Expression
func (j *JSONOverlaps) Resolved() bool {
	return j.Left.Resolved() && j.Right.Resolved()
}

// String implements sql.Expression
func (j *JSONOverlaps) String() string {
	return fmt.Sprintf("%s(%s, %s)", j.FunctionName(), j.Left.String(), j.Right.String())
}

// Type implements sql.Expression
func (j *JSONOverlaps) Type() sql.Type {
	return types.Boolean
}

// IsNullable implements sql.Expression
func (j *JSONOverlaps) IsNullable() bool {
	return j.Left.IsNullable() || j.Right.IsNullable()
}

// jsonEquals compares two JSON values.
// It returns true if the two values are exactly equal (type and order are important).
// It will recursively unwrap arrays and objects to compare their contents.
func jsonEquals(left, right interface{}) bool {
	lArr, lIsArr := left.([]interface{})
	rArr, rIsArr := right.([]interface{})
	if lIsArr && rIsArr {
		if len(lArr) != len(rArr) {
			return false
		}
		for i := range lArr {
			if !jsonEquals(lArr[i], rArr[i]) {
				return false
			}
		}
		return true
	}

	lMap, lIsMap := left.(map[string]interface{})
	rMap, rIsMap := right.(map[string]interface{})
	if lIsMap && rIsMap {
		if len(lMap) != len(rMap) {
			return false
		}
		for k := range lMap {
			if _, ok := rMap[k]; !ok {
				return false
			}
			if !jsonEquals(lMap[k], rMap[k]) {
				return false
			}
		}
		return true
	}

	if (lIsArr != rIsArr) || (lIsMap != rIsMap) {
		return false
	}

	return left == right
}

func overlaps(left, right interface{}) bool {
	switch lVal := left.(type) {
	case nil, bool, string, float64:
		switch rVal := right.(type) {
		case nil, bool, string, float64, map[string]interface{}:
			return jsonEquals(left, right)
		case []interface{}:
			// scalar must be in array
			for _, r := range rVal {
				if jsonEquals(left, r) {
					return true
				}
			}
		}
	case map[string]interface{}:
		switch rVal := right.(type) {
		case nil, bool, string, float64:
			return overlaps(right, left)
		case map[string]interface{}:
			// objects must have at least one key-value pair in common
			for k := range lVal {
				if _, ok := rVal[k]; !ok {
					continue
				}
				if jsonEquals(lVal[k], rVal[k]) {
					return true
				}
			}
		case []interface{}:
			// object must be in array
			for _, r := range rVal {
				if jsonEquals(lVal, r) {
					return true
				}
			}
		}
	case []interface{}:
		switch rVal := right.(type) {
		case nil, bool, string, float64:
			return overlaps(right, left)
		case map[string]interface{}:
			return overlaps(right, left)
		case []interface{}:
			// arrays must have at least one element in common
			// TODO: use maps for improved runtime?
			for _, l := range lVal {
				for _, r := range rVal {
					if jsonEquals(l, r) {
						return true
					}
				}
			}
		}
	}
	return false
}

// Eval implements sql.Expression
func (j *JSONOverlaps) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span(fmt.Sprintf("function.%s", j.FunctionName()))
	defer span.End()

	left, err := getJSONDocumentFromRow(ctx, row, j.Left)
	if err != nil {
		return nil, getJsonFunctionError("json_overlaps", 1, err)
	}
	if left == nil {
		return nil, nil
	}
	leftVal, err := left.ToInterface(ctx)
	if err != nil {
		return nil, err
	}

	right, err := getJSONDocumentFromRow(ctx, row, j.Right)
	if err != nil {
		return nil, getJsonFunctionError("json_overlaps", 2, err)
	}
	if right == nil {
		return nil, nil
	}
	rightVal, err := right.ToInterface(ctx)
	if err != nil {
		return nil, err
	}

	return overlaps(leftVal, rightVal), nil
}

// Children implements sql.Expression
func (j *JSONOverlaps) Children() []sql.Expression {
	return []sql.Expression{j.Left, j.Right}
}

// WithChildren implements sql.Expression
func (j *JSONOverlaps) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJSONOverlaps(children...)
}
