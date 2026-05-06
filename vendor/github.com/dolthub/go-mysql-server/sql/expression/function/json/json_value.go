// Copyright 2020-2021 Dolthub, Inc.
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
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JsonValue selects data from a json document using a json path and
// optional type coercion.
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-value
// usage: JSON_VALUE(json_doc, path, [returning type])
// TODO: [RETURNING TYPE] should be appended to path option in parser
// TODO: missing [on empty] and [on error] support
type JsonValue struct {
	JSON sql.Expression
	Path sql.Expression
	Typ  sql.Type
}

var _ sql.FunctionExpression = (*JsonValue)(nil)
var _ sql.CollationCoercible = (*JsonValue)(nil)

var jsonValueDefaultType = types.MustCreateString(sqltypes.VarChar, 512, sql.Collation_Default)

// NewJsonValue creates a new JsonValue UDF.
func NewJsonValue(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_VALUE", 2, len(args))
	} else if len(args) == 1 {
		return &JsonValue{JSON: args[0], Path: expression.NewLiteral("$", types.Text), Typ: jsonValueDefaultType}, nil
	} else if len(args) == 2 {
		return &JsonValue{JSON: args[0], Path: args[1], Typ: jsonValueDefaultType}, nil
	} else {
		// third argument is literal zero of the coercion type
		return &JsonValue{JSON: args[0], Path: args[1], Typ: args[2].Type()}, nil
	}
}

// FunctionName implements sql.FunctionExpression
func (j *JsonValue) FunctionName() string {
	return "json_value"
}

// Description implements sql.FunctionExpression
func (j *JsonValue) Description() string {
	return "returns value from JSON document"
}

// Resolved implements the sql.Expression interface.
func (j *JsonValue) Resolved() bool {
	return j.JSON.Resolved() && j.Path.Resolved()
}

// Type implements the sql.Expression interface.
func (j *JsonValue) Type() sql.Type { return j.Typ }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JsonValue) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 2
}

// Eval implements the sql.Expression interface.
func (j *JsonValue) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.JsonValue")
	defer span.End()

	js, err := getSearchableJSONVal(ctx, row, j.JSON)
	if err != nil {
		return nil, getJsonFunctionError("json_value", 1, err)
	}
	// If the document is SQL NULL, the result is SQL NULL
	if js == nil {
		return nil, nil
	}

	// json NULLs also result in sql NULLs.
	cmp, err := types.CompareJSON(ctx, js, types.JSONDocument{Val: nil})
	if cmp == 0 {
		return nil, nil
	}

	searchable, ok := js.(sql.JSONWrapper)
	if !ok {
		return fmt.Errorf("expected types.JSONValue, found: %T", js), nil
	}

	path, err := j.Path.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var res interface{}
	res, err = types.LookupJSONValue(ctx, searchable, path.(string))
	if err != nil || res == nil {
		return nil, err
	}

	// This is NOT CORRECT, but it prevents existing tests from regressing when the jsonpath module returns [] for
	// bad lookups on arrays, instead of an error. Note that this will cause lookups that expect [] to return incorrect
	// results.
	// See https://github.com/dolthub/dolt/issues/7905 for more information.
	cmp, err = types.CompareJSON(ctx, res, types.JSONDocument{Val: []interface{}{}})
	if err != nil {
		return nil, err
	}
	if cmp == 0 {
		return nil, nil
	}

	if j.Typ != nil {
		res, _, err = j.Typ.Convert(ctx, res)
		if err != nil {
			return nil, err
		}
	}

	return res, nil
}

// IsNullable implements the sql.Expression interface.
func (j *JsonValue) IsNullable() bool {
	return j.JSON.IsNullable() || j.Path.IsNullable()
}

// Children implements the sql.Expression interface.
func (j *JsonValue) Children() []sql.Expression {
	return []sql.Expression{j.JSON, j.Path}
}

// WithChildren implements the Expression interface.
func (j *JsonValue) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(j, len(children), 2)
	}
	ret := *j
	ret.JSON = children[0]
	ret.Path = children[1]
	return &ret, nil
}

func (j *JsonValue) String() string {
	children := j.Children()
	var parts = make([]string, len(children))
	for i, c := range children {
		parts[i] = c.String()
	}
	return fmt.Sprintf("json_value(%s)", strings.Join(parts, ", "))
}

// GetJSONFromWrapperOrCoercibleString takes a valid argument for JSON functions (either a JSON wrapper type or a string)
// and unwraps the JSON, or coerces the string into JSON. The return value can return any type that can be stored in
// a JSON column, not just maps. For a complete list, see
// https://dev.mysql.com/doc/refman/8.3/en/json-attribute-functions.html#function_json-type
func GetJSONFromWrapperOrCoercibleString(ctx *sql.Context, js interface{}, functionName string, argumentPosition int) (jsonData interface{}, err error) {
	// The first parameter can be either JSON or a string.
	switch jsType := js.(type) {
	case string:
		strData, _, err := types.LongBlob.Convert(ctx, js)
		if err != nil {
			return nil, err
		}
		if err = json.Unmarshal(strData.([]byte), &jsonData); err != nil {
			return nil, err
		}
		return jsonData, nil
	case sql.JSONWrapper:
		return jsType.ToInterface(ctx)
	default:
		return nil, sql.ErrInvalidJSONArgument.New(argumentPosition, functionName)
	}
}
