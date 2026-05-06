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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_EXTRACT(json_doc, path[, path] ...)
//
// JSONExtract extracts data from a json document using json paths.
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-extract
type JSONExtract struct {
	JSON  sql.Expression
	Paths []sql.Expression
}

var _ sql.FunctionExpression = (*JSONExtract)(nil)
var _ sql.CollationCoercible = (*JSONExtract)(nil)

// NewJSONExtract creates a new JSONExtract UDF.
func NewJSONExtract(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_EXTRACT", 2, len(args))
	}

	return &JSONExtract{args[0], args[1:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j *JSONExtract) FunctionName() string {
	return "json_extract"
}

// Description implements sql.FunctionExpression
func (j *JSONExtract) Description() string {
	return "returns data from JSON document"
}

// Resolved implements the sql.Expression interface.
func (j *JSONExtract) Resolved() bool {
	for _, p := range j.Paths {
		if !p.Resolved() {
			return false
		}
	}
	return j.JSON.Resolved()
}

// Type implements the sql.Expression interface.
func (j *JSONExtract) Type() sql.Type { return types.JSON }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONExtract) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 2
}

// Eval implements the sql.Expression interface.
func (j *JSONExtract) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.JSONExtract")
	defer span.End()

	js, err := getSearchableJSONVal(ctx, row, j.JSON)
	if err != nil {
		return nil, getJsonFunctionError("json_extract", 1, err)
	}
	// If the document is SQL NULL, the result is SQL NULL
	if js == nil {
		return nil, nil
	}

	searchable, ok := js.(sql.JSONWrapper)
	if !ok {
		return fmt.Errorf("expected types.JSONValue, found: %T", js), nil
	}

	var results = make([]sql.JSONWrapper, len(j.Paths))
	for i, p := range j.Paths {
		path, err := p.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		path, _, err = types.LongText.Convert(ctx, path)
		if err != nil {
			return nil, err
		}

		if path == nil {
			return nil, nil
		}

		results[i], err = types.LookupJSONValue(ctx, searchable, path.(string))
		if err != nil {
			return nil, fmt.Errorf("failed to extract from expression '%s'; %s", j.JSON.String(), err.Error())
		}
	}

	if len(results) == 1 {
		return results[0], nil
	}

	return types.ConcatenateJSONValues(ctx, results...)
}

// IsNullable implements the sql.Expression interface.
func (j *JSONExtract) IsNullable() bool {
	for _, p := range j.Paths {
		if p.IsNullable() {
			return true
		}
	}
	return j.JSON.IsNullable()
}

// Children implements the sql.Expression interface.
func (j *JSONExtract) Children() []sql.Expression {
	return append([]sql.Expression{j.JSON}, j.Paths...)
}

// WithChildren implements the Expression interface.
func (j *JSONExtract) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewJSONExtract(children...)
}

func (j *JSONExtract) String() string {
	children := j.Children()
	var parts = make([]string, len(children))
	for i, c := range children {
		parts[i] = c.String()
	}
	return fmt.Sprintf("json_extract(%s)", strings.Join(parts, ", "))
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONExtract) IsUnsupported() bool {
	return false
}
