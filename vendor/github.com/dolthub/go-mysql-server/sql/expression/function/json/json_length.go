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
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_LENGTH(json_doc [, path])
//
// JsonLength returns the length of a JSON document, or the length of the value extracted from the specified path.
// https://dev.mysql.com/doc/refman/8.0/en/json-attribute-functions.html#function_json-length
type JsonLength struct {
	JSON sql.Expression
	Path sql.Expression
}

var _ sql.FunctionExpression = (*JsonLength)(nil)
var _ sql.CollationCoercible = (*JsonLength)(nil)

// NewJsonLength creates a new JsonLength UDF.
func NewJsonLength(args ...sql.Expression) (sql.Expression, error) {
	if len(args) == 0 || len(args) > 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_LENGTH", 2, len(args))
	} else if len(args) == 1 {
		return &JsonLength{args[0], expression.NewLiteral("$", types.Text)}, nil
	} else {
		return &JsonLength{args[0], args[1]}, nil
	}
}

// FunctionName implements sql.FunctionExpression
func (j *JsonLength) FunctionName() string {
	return "json_length"
}

// Description implements sql.FunctionExpression
func (j *JsonLength) Description() string {
	return "returns length of JSON object"
}

// Resolved implements the sql.Expression interface.
func (j *JsonLength) Resolved() bool {
	return j.JSON.Resolved()
}

// Type implements the sql.Expression interface.
func (j *JsonLength) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JsonLength) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 7
}

// Eval implements the sql.Expression interface.
func (j *JsonLength) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.JsonLength")
	defer span.End()

	doc, err := getJSONDocumentFromRow(ctx, row, j.JSON)
	if err != nil {
		return nil, getJsonFunctionError("json_length", 1, err)
	}
	if doc == nil {
		return nil, nil
	}

	pathVal, err := j.Path.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if pathVal == nil {
		return nil, nil
	}
	var path string
	if p, _, strErr := types.LongText.Convert(ctx, pathVal); strErr == nil {
		path = p.(string)
	} else {
		return nil, strErr
	}

	res, err := types.LookupJSONValue(ctx, doc, path)
	if err != nil {
		return nil, err
	}

	if res == nil {
		return nil, nil
	}

	val, err := res.ToInterface(ctx)
	if err != nil {
		return nil, err
	}

	switch v := val.(type) {
	case nil:
		return nil, nil
	case []interface{}:
		if len(v) == 0 {
			return nil, nil
		}
		return len(v), nil
	case map[string]interface{}:
		return len(v), nil
	default:
		return 1, nil
	}
}

// IsNullable implements the sql.Expression interface.
func (j *JsonLength) IsNullable() bool {
	return j.JSON.IsNullable()
}

// Children implements the sql.Expression interface.
func (j *JsonLength) Children() []sql.Expression {
	return []sql.Expression{j.JSON, j.Path}
}

// WithChildren implements the Expression interface.
func (j *JsonLength) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJsonLength(children...)
}

func (j *JsonLength) String() string {
	return fmt.Sprintf("json_length(%s)", j.JSON.String())
}
