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

// JSON_OBJECT([key, val[, key, val] ...])
// https://dev.mysql.com/doc/refman/8.0/en/json-creation-functions.html#function_json-object

// JSONObject Evaluates a (possibly empty) list of key-value pairs and returns a JSON object containing those pairs. An
// error occurs if any key name is NULL or the number of arguments is odd.
type JSONObject struct {
	keyValPairs []sql.Expression
}

var _ sql.FunctionExpression = JSONObject{}
var _ sql.CollationCoercible = JSONObject{}

// NewJSONObject creates a new JSONObject function.
func NewJSONObject(exprs ...sql.Expression) (sql.Expression, error) {
	if len(exprs)%2 != 0 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_OBJECT", "an even number of", len(exprs))
	}

	return JSONObject{keyValPairs: exprs}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONObject) FunctionName() string {
	return "json_object"
}

// Description implements sql.FunctionExpression
func (j JSONObject) Description() string {
	return "creates JSON object."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONObject) IsUnsupported() bool {
	return false
}

func (j JSONObject) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}

	return true
}

func (j JSONObject) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}

	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j JSONObject) Type() sql.Type {
	return types.JSON
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (JSONObject) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 2
}

func (j JSONObject) IsNullable() bool {
	return false
}

func (j JSONObject) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	obj := make(map[string]interface{}, len(j.keyValPairs)/2)

	var key string
	for i, expr := range j.keyValPairs {
		val, err := expr.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if i%2 == 0 {
			val, _, err = types.LongText.Convert(ctx, val)
			if err != nil {
				return nil, err
			}
			key, _, err = sql.Unwrap[string](ctx, val)
			if err != nil {
				return nil, err
			}
		} else {
			val, err = sql.UnwrapAny(ctx, val)
			if err != nil {
				return nil, err
			}
			if json, ok := val.(sql.JSONWrapper); ok {
				val, err = json.ToInterface(ctx)
				if err != nil {
					return nil, err
				}
			}
			obj[key] = val
		}
	}

	return types.JSONDocument{Val: obj}, nil
}

func (j JSONObject) Children() []sql.Expression {
	return j.keyValPairs
}

func (j JSONObject) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_object did not receive the correct amount of args")
	}

	return NewJSONObject(children...)
}
