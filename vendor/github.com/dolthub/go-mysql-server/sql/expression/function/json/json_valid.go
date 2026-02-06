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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_VALID(val)
//
// Returns 0 or 1 to indicate whether a value is valid JSON. Returns NULL if the argument is NULL.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-attribute-functions.html#function_json-valid
type JSONValid struct {
	JSON sql.Expression
}

var _ sql.FunctionExpression = JSONValid{}

// NewJSONValid creates a new JSONValid function.
func NewJSONValid(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_VALID", "1", len(args))
	}
	return &JSONValid{args[0]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONValid) FunctionName() string {
	return "json_valid"
}

// Description implements sql.FunctionExpression
func (j JSONValid) Description() string {
	return "returns whether JSON value is valid."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONValid) IsUnsupported() bool {
	return false
}

func (j JSONValid) Resolved() bool {
	return j.JSON.Resolved()
}

func (j JSONValid) String() string {
	return fmt.Sprintf("%s(%s)", j.FunctionName(), j.JSON.String())
}

func (j JSONValid) Type() sql.Type {
	return types.Boolean
}

func (j JSONValid) IsNullable() bool {
	return j.JSON.IsNullable()
}

func (j JSONValid) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	doc, err := getJSONDocumentFromRow(ctx, row, j.JSON)
	if err != nil {
		return false, nil
	}
	if doc == nil {
		return nil, nil
	}
	return true, nil
}

func (j JSONValid) Children() []sql.Expression {
	return []sql.Expression{j.JSON}
}

func (j JSONValid) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_valid did not receive the correct amount of args")
	}

	return NewJSONValid(children...)
}
