// Copyright 2022 Dolthub, Inc.
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

package expression

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"unsafe"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// BitOp expressions include BIT -AND, -OR and -XOR (&, | and ^) operations
// https://dev.mysql.com/doc/refman/8.0/en/bit-functions.html
type BitOp struct {
	BinaryExpressionStub
	Op string
}

var _ sql.Expression = (*BitOp)(nil)
var _ sql.CollationCoercible = (*BitOp)(nil)

// NewBitOp creates a new BitOp sql.Expression.
func NewBitOp(left, right sql.Expression, op string) *BitOp {
	return &BitOp{BinaryExpressionStub{LeftChild: left, RightChild: right}, op}
}

// NewBitAnd creates a new BitOp & sql.Expression.
func NewBitAnd(left, right sql.Expression) *BitOp {
	return NewBitOp(left, right, sqlparser.BitAndStr)
}

// NewBitOr creates a new BitOp | sql.Expression.
func NewBitOr(left, right sql.Expression) *BitOp {
	return NewBitOp(left, right, sqlparser.BitOrStr)
}

// NewBitXor creates a new BitOp ^ sql.Expression.
func NewBitXor(left, right sql.Expression) *BitOp {
	return NewBitOp(left, right, sqlparser.BitXorStr)
}

// NewShiftLeft creates a new BitOp << sql.Expression.
func NewShiftLeft(left, right sql.Expression) *BitOp {
	return NewBitOp(left, right, sqlparser.ShiftLeftStr)
}

// NewShiftRight creates a new BitOp >> sql.Expression.
func NewShiftRight(left, right sql.Expression) *BitOp {
	return NewBitOp(left, right, sqlparser.ShiftRightStr)
}

func (b *BitOp) String() string {
	return fmt.Sprintf("(%s %s %s)", b.LeftChild, b.Op, b.RightChild)
}

func (b *BitOp) DebugString() string {
	return fmt.Sprintf("(%s %s %s)", sql.DebugString(b.LeftChild), b.Op, sql.DebugString(b.RightChild))
}

// IsNullable implements the sql.Expression interface.
func (b *BitOp) IsNullable() bool {
	return b.BinaryExpressionStub.IsNullable()
}

// Type returns the greatest type for given operation.
func (b *BitOp) Type() sql.Type {
	rTyp := b.RightChild.Type()
	if types.IsDeferredType(rTyp) {
		return rTyp
	}
	lTyp := b.LeftChild.Type()
	if types.IsDeferredType(lTyp) {
		return lTyp
	}

	// MySQL bitwise operations always return unsigned results, even for signed operands.
	return types.Uint64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*BitOp) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// WithChildren implements the Expression interface.
func (b *BitOp) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(b, len(children), 2)
	}
	return NewBitOp(children[0], children[1], b.Op), nil
}

// Eval implements the Expression interface.
func (b *BitOp) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	lval, rval, err := b.evalLeftRight(ctx, row)
	if err != nil {
		return nil, err
	}

	if lval == nil || rval == nil {
		return nil, nil
	}

	lval, rval, err = b.convertLeftRight(ctx, lval, rval)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(b.Op) {
	case sqlparser.BitAndStr:
		return bitAnd(lval, rval)
	case sqlparser.BitOrStr:
		return bitOr(lval, rval)
	case sqlparser.BitXorStr:
		return bitXor(lval, rval)
	case sqlparser.ShiftLeftStr:
		return shiftLeft(lval, rval)
	case sqlparser.ShiftRightStr:
		return shiftRight(lval, rval)
	}

	return nil, errUnableToEval.New(lval, b.Op, rval)
}

func (b *BitOp) evalLeftRight(ctx *sql.Context, row sql.Row) (interface{}, interface{}, error) {
	var lval, rval interface{}
	var err error

	// bit ops used with Interval error is caught at parsing the query
	lval, err = b.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, nil, err
	}

	rval, err = b.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, nil, err
	}

	return lval, rval, nil
}

func (b *BitOp) convertLeftRight(ctx *sql.Context, left interface{}, right interface{}) (interface{}, interface{}, error) {
	// Determine the appropriate conversion type based on operand types
	var typ sql.Type
	lTyp := b.LeftChild.Type()
	rTyp := b.RightChild.Type()

	if types.IsText(lTyp) || types.IsText(rTyp) {
		typ = types.Float64
	} else if types.IsUnsigned(lTyp) && types.IsUnsigned(rTyp) {
		typ = types.Uint64
	} else if types.IsSigned(lTyp) && types.IsSigned(rTyp) {
		typ = types.Int64
	} else {
		typ = types.Float64
	}

	left = convertValueToType(ctx, typ, left, types.IsTime(b.LeftChild.Type()))
	right = convertValueToType(ctx, typ, right, types.IsTime(b.RightChild.Type()))

	return left, right, nil
}

// convertUintFromInt returns any int64 value converted to uint64 value
// including negative numbers. Mysql does not return negative result on
// bit arithmetic operations, so all results are returned in uint64 type.
func convertUintFromInt(n int64) uint64 {
	intStr := strconv.FormatUint(*(*uint64)(unsafe.Pointer(&n)), 2)
	uintVal, err := strconv.ParseUint(intStr, 2, 64)
	if err != nil {
		return 0
	}
	return uintVal
}

func bitAnd(lval, rval interface{}) (interface{}, error) {
	if lval == nil || rval == nil {
		return 0, nil
	}

	switch l := lval.(type) {
	case float64:
		switch r := rval.(type) {
		case float64:
			left := convertUintFromInt(int64(math.Round(l)))
			right := convertUintFromInt(int64(math.Round(r)))
			return left & right, nil
		}
	case uint64:
		switch r := rval.(type) {
		case uint64:
			return l & r, nil
		}
	case int64:
		switch r := rval.(type) {
		case int64:
			left := convertUintFromInt(l)
			right := convertUintFromInt(r)
			return left & right, nil
		}
	}

	return nil, errUnableToCast.New(lval, rval)
}

func bitOr(lval, rval interface{}) (interface{}, error) {
	if lval == nil && rval == nil {
		return 0, nil
	} else if lval == nil {
		switch r := rval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(r))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(r)))), nil
		case uint64:
			return r, nil
		}
	} else if rval == nil {
		switch l := lval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(l))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(l)))), nil
		case uint64:
			return l, nil
		}
	}

	switch l := lval.(type) {
	case float64:
		switch r := rval.(type) {
		case float64:
			left := convertUintFromInt(int64(math.Round(l)))
			right := convertUintFromInt(int64(math.Round(r)))
			return left | right, nil
		}
	case uint64:
		switch r := rval.(type) {
		case uint64:
			return l | r, nil
		}
	case int64:
		switch r := rval.(type) {
		case int64:
			left := convertUintFromInt(l)
			right := convertUintFromInt(r)
			return left | right, nil
		}
	}

	return nil, errUnableToCast.New(lval, rval)
}

func bitXor(lval, rval interface{}) (interface{}, error) {
	if lval == nil && rval == nil {
		return 0, nil
	} else if lval == nil {
		switch r := rval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(r))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(r)))), nil
		case uint64:
			return r, nil
		}
	} else if rval == nil {
		switch l := lval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(l))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(l)))), nil
		case uint64:
			return l, nil
		}
	}

	switch l := lval.(type) {
	case float64:
		switch r := rval.(type) {
		case float64:
			left := convertUintFromInt(int64(math.Round(l)))
			right := convertUintFromInt(int64(math.Round(r)))
			return left ^ right, nil
		}
	case uint64:
		switch r := rval.(type) {
		case uint64:
			return l ^ r, nil
		}
	case int64:
		switch r := rval.(type) {
		case int64:
			left := convertUintFromInt(l)
			right := convertUintFromInt(r)
			return left ^ right, nil
		}
	}

	return nil, errUnableToCast.New(lval, rval)
}

func shiftLeft(lval, rval interface{}) (interface{}, error) {
	if lval == nil {
		return 0, nil
	}
	if rval == nil {
		switch l := lval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(l))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(l)))), nil
		case uint64:
			return l, nil
		}
	}
	switch l := lval.(type) {
	case float64:
		switch r := rval.(type) {
		case float64:
			left := convertUintFromInt(int64(math.Round(l)))
			right := convertUintFromInt(int64(math.Round(r)))
			return left << right, nil
		}
	case uint64:
		switch r := rval.(type) {
		case uint64:
			return l << r, nil
		}
	case int64:
		switch r := rval.(type) {
		case int64:
			left := convertUintFromInt(l)
			right := convertUintFromInt(r)
			return left << right, nil
		}
	}

	return nil, errUnableToCast.New(lval, rval)
}

func shiftRight(lval, rval interface{}) (interface{}, error) {
	if lval == nil {
		return 0, nil
	}
	if rval == nil {
		switch l := lval.(type) {
		case float64:
			return convertUintFromInt(int64(math.Round(l))), nil
		case int64:
			return convertUintFromInt(int64(math.Round(float64(l)))), nil
		case uint64:
			return l, nil
		}
	}
	switch l := lval.(type) {
	case float64:
		switch r := rval.(type) {
		case float64:
			left := convertUintFromInt(int64(math.Round(l)))
			right := convertUintFromInt(int64(math.Round(r)))
			return left >> right, nil
		}
	case uint64:
		switch r := rval.(type) {
		case uint64:
			return l >> r, nil
		}
	case int64:
		switch r := rval.(type) {
		case int64:
			left := convertUintFromInt(l)
			right := convertUintFromInt(r)
			return left >> right, nil
		}
	}

	return nil, errUnableToCast.New(lval, rval)
}
