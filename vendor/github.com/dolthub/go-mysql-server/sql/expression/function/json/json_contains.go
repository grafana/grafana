// Copyright 2021 Dolthub, Inc.
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

// JSON_CONTAINS(target, candidate[, path])
//
// JSONContains indicates by returning 1 or 0 whether a given candidate JSON document is contained within a target JSON
// document, or, if a path argument was supplied, whether the candidate is found at a specific path within the target.
// Returns NULL if any argument is NULL, or if the path argument does not identify a section of the target document.
// An error occurs if target or candidate is not a valid JSON document, or if the path argument is not a valid path
// expression or contains a * or ** wildcard. To check only whether any data exists at the path, use
// JSON_CONTAINS_PATH() instead.
//
// The following rules define containment:
//   - A candidate scalar is contained in a target scalar if and only if they are comparable and are equal. Two scalar
//     values are comparable if they have the same JSON_TYPE() types, with the exception that values of types INTEGER
//     and DECIMAL are also comparable to each other.
//   - A candidate array is contained in a target array if and only if every element in the candidate is contained in
//     some element of the target.
//   - A candidate non-array is contained in a target array if and only if the candidate is contained in some element
//     of the target.
//   - A candidate object is contained in a target object if and only if for each key in the candidate there is a key
//     with the same name in the target and the value associated with the candidate key is contained in the value
//     associated with the target key.
//
// Otherwise, the candidate value is not contained in the target document.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-contains
// TODO: Add multi index optimization -> https://dev.mysql.com/doc/refman/8.0/en/create-index.html#create-index-multi-valued
type JSONContains struct {
	JSONTarget    sql.Expression
	JSONCandidate sql.Expression
	Path          sql.Expression
}

var _ sql.FunctionExpression = (*JSONContains)(nil)
var _ sql.CollationCoercible = (*JSONContains)(nil)

// NewJSONContains creates a new JSONContains function.
func NewJSONContains(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_CONTAINS", "2 or 3", len(args))
	}

	if len(args) == 2 {
		return &JSONContains{args[0], args[1], nil}, nil
	}

	return &JSONContains{args[0], args[1], args[2]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONContains) FunctionName() string {
	return "json_contains"
}

// Description implements sql.FunctionExpression
func (j *JSONContains) Description() string {
	return "returns whether JSON document contains specific object at path."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONContains) IsUnsupported() bool {
	return false
}

func (j *JSONContains) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}
	return true
}

func (j *JSONContains) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j *JSONContains) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONContains) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (j *JSONContains) IsNullable() bool {
	return j.JSONTarget.IsNullable() || j.JSONCandidate.IsNullable() || (j.Path != nil && j.Path.IsNullable())
}

func (j *JSONContains) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	target, err := getSearchableJSONVal(ctx, row, j.JSONTarget)
	if err != nil {
		return nil, getJsonFunctionError("json_contains", 1, err)
	}
	if target == nil {
		return nil, nil
	}

	candidate, err := getSearchableJSONVal(ctx, row, j.JSONCandidate)
	if err != nil {
		return nil, getJsonFunctionError("json_contains", 2, err)
	}
	if candidate == nil {
		return nil, nil
	}

	// If there's a path reevaluate target based off of it
	if j.Path != nil {
		// Evaluate the given path if there is one
		path, err := j.Path.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		path, _, err = types.LongText.Convert(ctx, path)
		if err != nil {
			return nil, err
		}

		extracted, err := types.LookupJSONValue(ctx, target, path.(string))
		if err != nil {
			return nil, err
		}
		var ok bool
		target, ok = extracted.(sql.JSONWrapper)
		if !ok {
			return nil, nil
		}
		if target == nil {
			return nil, nil
		}
	}

	// Now determine whether the candidate value exists in the target
	targetVal, err := target.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	candidateVal, err := candidate.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	return types.ContainsJSON(targetVal, candidateVal)
}

func (j *JSONContains) Children() []sql.Expression {
	if j.Path != nil {
		return []sql.Expression{j.JSONTarget, j.JSONCandidate, j.Path}
	}

	return []sql.Expression{j.JSONTarget, j.JSONCandidate}
}

func (j *JSONContains) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_contains did not receive the correct amount of args")
	}

	return NewJSONContains(children...)
}
