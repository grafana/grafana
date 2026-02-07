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

package aggregation

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_OBJECTAGG(key, value) [over_clause]
//
// JSONObjectAgg Takes two column names or expressions as arguments, the first of these being used as a key and the
// second as a value, and returns a JSON object containing key-value pairs. Returns NULL if the result contains no rows,
// or in the event of an error. An error occurs if any key name is NULL or the number of arguments is not equal to 2.
//
// https://dev.mysql.com/doc/refman/8.0/en/aggregate-functions.html#function_json-objectagg
//
// see also: https://dev.mysql.com/doc/refman/8.0/en/json.html#json-normalization
type JSONObjectAgg struct {
	key    sql.Expression
	value  sql.Expression
	window *sql.WindowDefinition
	id     sql.ColumnId
}

var _ sql.FunctionExpression = (*JSONObjectAgg)(nil)
var _ sql.Aggregation = (*JSONObjectAgg)(nil)
var _ sql.WindowAdaptableExpression = (*JSONObjectAgg)(nil)
var _ sql.CollationCoercible = (*JSONObjectAgg)(nil)

// NewJSONObjectAgg creates a new JSONObjectAgg function.
func NewJSONObjectAgg(key, value sql.Expression) sql.Expression {
	return &JSONObjectAgg{key: key, value: value}
}

// Id implements the Aggregation interface
func (j *JSONObjectAgg) Id() sql.ColumnId {
	return j.id
}

// WithId implements the Aggregation interface
func (j *JSONObjectAgg) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *j
	ret.id = id
	return &ret
}

// FunctionName implements sql.FunctionExpression
func (j *JSONObjectAgg) FunctionName() string {
	return "json_objectagg"
}

// Description implements sql.FunctionExpression
func (j *JSONObjectAgg) Description() string {
	return "returns result set as a single JSON object."
}

// Resolved implements the Expression interface.
func (j *JSONObjectAgg) Resolved() bool {
	return j.key.Resolved() && j.value.Resolved()
}

func (j *JSONObjectAgg) String() string {
	return fmt.Sprintf("JSON_OBJECTAGG(%s, %s)", j.key, j.value)
}

// Type implements the Expression interface.
func (j *JSONObjectAgg) Type() sql.Type {
	return types.JSON
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONObjectAgg) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCharacterSet().BinaryCollation(), 2
}

// IsNullable implements the Expression interface.
func (j *JSONObjectAgg) IsNullable() bool {
	return false
}

// Children implements the Expression interface.
func (j *JSONObjectAgg) Children() []sql.Expression {
	return []sql.Expression{j.key, j.value}
}

// WithChildren implements the Expression interface.
func (j *JSONObjectAgg) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(j, len(children), 2)
	}

	return NewJSONObjectAgg(children[0], children[1]), nil
}

// WithWindow implements sql.Aggregation
func (j *JSONObjectAgg) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	nj := *j
	nj.window = window
	return &nj
}

// Window implements sql.Aggregation
func (j *JSONObjectAgg) Window() *sql.WindowDefinition {
	return j.window
}

// NewBuffer implements the Aggregation interface.
func (j *JSONObjectAgg) NewBuffer() (sql.AggregationBuffer, error) {
	row := make(map[string]interface{})
	return &jsonObjectBuffer{row, j}, nil
}

// NewWindowFunctionAggregation implements sql.WindowAdaptableExpression
func (j *JSONObjectAgg) NewWindowFunction() (sql.WindowFunction, error) {
	return NewWindowedJSONObjectAgg(j), nil
}

// Eval implements the Expression interface.
func (j *JSONObjectAgg) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, ErrEvalUnsupportedOnAggregation.New("JSONObjectAgg")
}

type jsonObjectBuffer struct {
	vals map[string]interface{}
	joa  *JSONObjectAgg
}

// Update implements the AggregationBuffer interface.
func (j *jsonObjectBuffer) Update(ctx *sql.Context, row sql.Row) error {
	key, err := j.joa.key.Eval(ctx, row)
	if err != nil {
		return err
	}

	// An error occurs if any key name is NULL
	if key == nil {
		return sql.ErrJSONObjectAggNullKey.New()
	}

	val, err := j.joa.value.Eval(ctx, row)
	if err != nil {
		return err
	}

	// unwrap wrapper values
	val, err = sql.UnwrapAny(ctx, val)
	if err != nil {
		return err
	}
	if js, ok := val.(sql.JSONWrapper); ok {
		val, err = js.ToInterface(ctx)
		if err != nil {
			return err
		}
	}

	// Update the map.
	convertedKey, _, err := types.LongText.Convert(ctx, key)
	if err != nil {
		return nil
	}
	keyAsString, _, err := sql.Unwrap[string](ctx, convertedKey)
	j.vals[keyAsString] = val

	return nil
}

// Eval implements the AggregationBuffer interface.
func (j *jsonObjectBuffer) Eval(ctx *sql.Context) (interface{}, error) {
	// When no rows are present return NULL
	if len(j.vals) == 0 {
		return nil, nil
	}

	return types.JSONDocument{Val: j.vals}, nil
}

// Dispose implements the Disposable interface.
func (j *jsonObjectBuffer) Dispose() {
}
