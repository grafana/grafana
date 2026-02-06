// Copyright 2020-2024 Dolthub, Inc.
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

package function

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ExportSet implements the SQL function EXPORT_SET() which returns a string representation of bits in a number
type ExportSet struct {
	bits         sql.Expression
	on           sql.Expression
	off          sql.Expression
	separator    sql.Expression
	numberOfBits sql.Expression
}

var _ sql.FunctionExpression = (*ExportSet)(nil)
var _ sql.CollationCoercible = (*ExportSet)(nil)

// NewExportSet creates a new ExportSet expression
func NewExportSet(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 3 || len(args) > 5 {
		return nil, sql.ErrInvalidArgumentNumber.New("EXPORT_SET", "3, 4, or 5", len(args))
	}

	var separator, numberOfBits sql.Expression
	if len(args) >= 4 {
		separator = args[3]
	}
	if len(args) == 5 {
		numberOfBits = args[4]
	}

	return &ExportSet{
		bits:         args[0],
		on:           args[1],
		off:          args[2],
		separator:    separator,
		numberOfBits: numberOfBits,
	}, nil
}

// FunctionName implements sql.FunctionExpression
func (e *ExportSet) FunctionName() string {
	return "export_set"
}

// Description implements sql.FunctionExpression
func (e *ExportSet) Description() string {
	return "returns a string such that for every bit set in the value bits, you get an on string and for every unset bit, you get an off string."
}

// Children implements the Expression interface
func (e *ExportSet) Children() []sql.Expression {
	children := []sql.Expression{e.bits, e.on, e.off}
	if e.separator != nil {
		children = append(children, e.separator)
	}
	if e.numberOfBits != nil {
		children = append(children, e.numberOfBits)
	}
	return children
}

// Resolved implements the Expression interface
func (e *ExportSet) Resolved() bool {
	for _, child := range e.Children() {
		if !child.Resolved() {
			return false
		}
	}
	return true
}

// IsNullable implements the Expression interface
func (e *ExportSet) IsNullable() bool {
	for _, child := range e.Children() {
		if child.IsNullable() {
			return true
		}
	}
	return false
}

// Type implements the Expression interface
func (e *ExportSet) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible
func (e *ExportSet) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	collation, coercibility = sql.GetCoercibility(ctx, e.on)
	otherCollation, otherCoercibility := sql.GetCoercibility(ctx, e.off)
	collation, coercibility = sql.ResolveCoercibility(collation, coercibility, otherCollation, otherCoercibility)
	if e.separator != nil {
		otherCollation, otherCoercibility = sql.GetCoercibility(ctx, e.separator)
		collation, coercibility = sql.ResolveCoercibility(collation, coercibility, otherCollation, otherCoercibility)
	}
	return collation, coercibility
}

// String implements the Expression interface
func (e *ExportSet) String() string {
	children := e.Children()
	childStrs := make([]string, len(children))
	for i, child := range children {
		childStrs[i] = child.String()
	}
	return fmt.Sprintf("export_set(%s)", strings.Join(childStrs, ", "))
}

// WithChildren implements the Expression interface
func (e *ExportSet) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewExportSet(children...)
}

// Eval implements the Expression interface
func (e *ExportSet) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	bitsVal, err := e.bits.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if bitsVal == nil {
		return nil, nil
	}

	onVal, err := e.on.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if onVal == nil {
		return nil, nil
	}

	offVal, err := e.off.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if offVal == nil {
		return nil, nil
	}

	// Default separator is comma
	separatorVal := ","
	if e.separator != nil {
		sepVal, err := e.separator.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if sepVal == nil {
			return nil, nil
		}
		sepStr, _, err := types.LongText.Convert(ctx, sepVal)
		if err != nil {
			return nil, err
		}

		// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
		sepStr, err = sql.UnwrapAny(ctx, sepStr)
		if err != nil {
			return nil, err
		}

		separatorVal = sepStr.(string)
	}

	// Default number of bits is 64
	numberOfBitsVal := int64(64)
	if e.numberOfBits != nil {
		numBitsVal, err := e.numberOfBits.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if numBitsVal == nil {
			return nil, nil
		}
		numBitsInt, _, err := types.Int64.Convert(ctx, numBitsVal)
		if err != nil {
			return nil, err
		}
		numberOfBitsVal = numBitsInt.(int64)
		// MySQL silently clips to 64 if larger, treats negative as 64
		if numberOfBitsVal > 64 || numberOfBitsVal < 0 {
			numberOfBitsVal = 64
		}
	}

	// Convert arguments to proper types
	bitsInt, _, err := types.Uint64.Convert(ctx, bitsVal)
	if err != nil {
		return nil, err
	}

	onStr, _, err := types.LongText.Convert(ctx, onVal)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	onStr, err = sql.UnwrapAny(ctx, onStr)
	if err != nil {
		return nil, err
	}

	offStr, _, err := types.LongText.Convert(ctx, offVal)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	offStr, err = sql.UnwrapAny(ctx, offStr)
	if err != nil {
		return nil, err
	}

	bits := bitsInt.(uint64)
	on := onStr.(string)
	off := offStr.(string)

	// Build the result by examining bits from right to left (LSB to MSB)
	// but adding strings from left to right
	result := make([]string, numberOfBitsVal)
	for i := int64(0); i < numberOfBitsVal; i++ {
		if (bits & (1 << uint(i))) != 0 {
			result[i] = on
		} else {
			result[i] = off
		}
	}

	return strings.Join(result, separatorVal), nil
}
