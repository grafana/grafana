/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqltypes

import (
	"bytes"
	"fmt"

	"strconv"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// numeric represents a numeric value extracted from
// a Value, used for arithmetic operations.
type numeric struct {
	typ  querypb.Type
	ival int64
	uval uint64
	fval float64
}

var zeroBytes = []byte("0")

// Add adds two values together
// if v1 or v2 is null, then it returns null
func Add(v1, v2 Value) (Value, error) {
	if v1.IsNull() || v2.IsNull() {
		return NULL, nil
	}

	lv1, err := newNumeric(v1)
	if err != nil {
		return NULL, err
	}

	lv2, err := newNumeric(v2)
	if err != nil {
		return NULL, err
	}

	lresult, err := addNumericWithError(lv1, lv2)
	if err != nil {
		return NULL, err
	}

	return castFromNumeric(lresult, lresult.typ), nil
}

// Subtract takes two values and subtracts them
func Subtract(v1, v2 Value) (Value, error) {
	if v1.IsNull() || v2.IsNull() {
		return NULL, nil
	}

	lv1, err := newNumeric(v1)
	if err != nil {
		return NULL, err
	}

	lv2, err := newNumeric(v2)
	if err != nil {
		return NULL, err
	}

	lresult, err := subtractNumericWithError(lv1, lv2)
	if err != nil {
		return NULL, err
	}

	return castFromNumeric(lresult, lresult.typ), nil
}

// Multiply takes two values and multiplies it together
func Multiply(v1, v2 Value) (Value, error) {
	if v1.IsNull() || v2.IsNull() {
		return NULL, nil
	}

	lv1, err := newNumeric(v1)
	if err != nil {
		return NULL, err
	}
	lv2, err := newNumeric(v2)
	if err != nil {
		return NULL, err
	}
	lresult, err := multiplyNumericWithError(lv1, lv2)
	if err != nil {
		return NULL, err
	}

	return castFromNumeric(lresult, lresult.typ), nil
}

// Float Division for MySQL. Replicates behavior of "/" operator
func Divide(v1, v2 Value) (Value, error) {
	if v1.IsNull() || v2.IsNull() {
		return NULL, nil
	}

	lv2AsFloat, err := ToFloat64(v2)
	divisorIsZero := lv2AsFloat == 0

	if divisorIsZero || err != nil {
		return NULL, err
	}

	lv1, err := newNumeric(v1)
	if err != nil {
		return NULL, err
	}

	lv2, err := newNumeric(v2)
	if err != nil {
		return NULL, err
	}

	lresult, err := divideNumericWithError(lv1, lv2)
	if err != nil {
		return NULL, err
	}

	return castFromNumeric(lresult, lresult.typ), nil
}

// NullsafeAdd adds two Values in a null-safe manner. A null value
// is treated as 0. If both values are null, then a null is returned.
// If both values are not null, a numeric value is built
// from each input: Signed->int64, Unsigned->uint64, Float->float64.
// Otherwise the 'best type fit' is chosen for the number: int64 or float64.
// Addition is performed by upgrading types as needed, or in case
// of overflow: int64->uint64, int64->float64, uint64->float64.
// Unsigned ints can only be added to positive ints. After the
// addition, if one of the input types was Decimal, then
// a Decimal is built. Otherwise, the final type of the
// result is preserved.
func NullsafeAdd(v1, v2 Value, resultType querypb.Type) Value {
	if v1.IsNull() {
		v1 = MakeTrusted(resultType, zeroBytes)
	}
	if v2.IsNull() {
		v2 = MakeTrusted(resultType, zeroBytes)
	}

	lv1, err := newNumeric(v1)
	if err != nil {
		return NULL
	}
	lv2, err := newNumeric(v2)
	if err != nil {
		return NULL
	}
	lresult := addNumeric(lv1, lv2)

	return castFromNumeric(lresult, resultType)
}

// NullsafeCompare returns 0 if v1==v2, -1 if v1<v2, and 1 if v1>v2.
// NULL is the lowest value. If any value is
// numeric, then a numeric comparison is performed after
// necessary conversions. If none are numeric, then it's
// a simple binary comparison. Uncomparable values return an error.
func NullsafeCompare(v1, v2 Value) (int, error) {
	// Based on the categorization defined for the types,
	// we're going to allow comparison of the following:
	// Null, isNumber, IsBinary. This will exclude IsQuoted
	// types that are not Binary, and Expression.
	if v1.IsNull() {
		if v2.IsNull() {
			return 0, nil
		}
		return -1, nil
	}
	if v2.IsNull() {
		return 1, nil
	}
	if isNumber(v1.Type()) || isNumber(v2.Type()) {
		lv1, err := newNumeric(v1)
		if err != nil {
			return 0, err
		}
		lv2, err := newNumeric(v2)
		if err != nil {
			return 0, err
		}
		return compareNumeric(lv1, lv2), nil
	}
	if isByteComparable(v1) && isByteComparable(v2) {
		return bytes.Compare(v1.ToBytes(), v2.ToBytes()), nil
	}
	return 0, fmt.Errorf("types are not comparable: %v vs %v", v1.Type(), v2.Type())
}

// isByteComparable returns true if the type is binary or date/time.
func isByteComparable(v Value) bool {
	if v.IsBinary() {
		return true
	}
	switch v.Type() {
	case Timestamp, Date, Time, Datetime:
		return true
	}
	return false
}

// Min returns the minimum of v1 and v2. If one of the
// values is NULL, it returns the other value. If both
// are NULL, it returns NULL.
func Min(v1, v2 Value) (Value, error) {
	return minmax(v1, v2, true)
}

// Max returns the maximum of v1 and v2. If one of the
// values is NULL, it returns the other value. If both
// are NULL, it returns NULL.
func Max(v1, v2 Value) (Value, error) {
	return minmax(v1, v2, false)
}

func minmax(v1, v2 Value, min bool) (Value, error) {
	if v1.IsNull() {
		return v2, nil
	}
	if v2.IsNull() {
		return v1, nil
	}

	n, err := NullsafeCompare(v1, v2)
	if err != nil {
		return NULL, err
	}

	// XNOR construct. See tests.
	v1isSmaller := n < 0
	if min == v1isSmaller {
		return v1, nil
	}
	return v2, nil
}

// Cast converts a Value to the target type.
func Cast(v Value, typ querypb.Type) (Value, error) {
	if v.Type() == typ || v.IsNull() {
		return v, nil
	}
	if IsSigned(typ) && v.IsSigned() {
		return MakeTrusted(typ, v.ToBytes()), nil
	}
	if IsUnsigned(typ) && v.IsUnsigned() {
		return MakeTrusted(typ, v.ToBytes()), nil
	}
	if (IsFloat(typ) || typ == Decimal) && (v.IsIntegral() || v.IsFloat() || v.Type() == Decimal) {
		return MakeTrusted(typ, v.ToBytes()), nil
	}
	if IsQuoted(typ) && (v.IsIntegral() || v.IsFloat() || v.Type() == Decimal || v.IsQuoted()) {
		return MakeTrusted(typ, v.ToBytes()), nil
	}

	// Explicitly disallow Expression.
	if v.Type() == Expression {
		return NULL, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v cannot be cast to %v", v, typ)
	}

	// If the above fast-paths were not possible,
	// go through full validation.
	return NewValue(typ, v.ToBytes())
}

// ToUint64 converts Value to uint64.
func ToUint64(v Value) (uint64, error) {
	num, err := newIntegralNumeric(v)
	if err != nil {
		return 0, err
	}
	switch num.typ {
	case Int64:
		if num.ival < 0 {
			return 0, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "negative number cannot be converted to unsigned: %d", num.ival)
		}
		return uint64(num.ival), nil
	case Uint64:
		return num.uval, nil
	}
	panic("unreachable")
}

// ToInt64 converts Value to int64.
func ToInt64(v Value) (int64, error) {
	num, err := newIntegralNumeric(v)
	if err != nil {
		return 0, err
	}
	switch num.typ {
	case Int64:
		return num.ival, nil
	case Uint64:
		ival := int64(num.uval)
		if ival < 0 {
			return 0, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "unsigned number overflows int64 value: %d", num.uval)
		}
		return ival, nil
	}
	panic("unreachable")
}

// ToFloat64 converts Value to float64.
func ToFloat64(v Value) (float64, error) {
	num, err := newNumeric(v)
	if err != nil {
		return 0, err
	}
	switch num.typ {
	case Int64:
		return float64(num.ival), nil
	case Uint64:
		return float64(num.uval), nil
	case Float64:
		return num.fval, nil
	}
	panic("unreachable")
}

// ToNative converts Value to a native go type.
// Decimal is returned as []byte.
func ToNative(v Value) (interface{}, error) {
	var out interface{}
	var err error
	switch {
	case v.Type() == Null:
		// no-op
	case v.IsSigned():
		return ToInt64(v)
	case v.IsUnsigned():
		return ToUint64(v)
	case v.IsFloat():
		return ToFloat64(v)
	case v.IsQuoted() || v.Type() == Bit || v.Type() == Decimal:
		out = v.val
	case v.Type() == Expression:
		err = vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v cannot be converted to a go type", v)
	}
	return out, err
}

// newNumeric parses a value and produces an Int64, Uint64 or Float64.
func newNumeric(v Value) (numeric, error) {
	str := v.ToString()
	switch {
	case v.IsSigned():
		ival, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v", err)
		}
		return numeric{ival: ival, typ: Int64}, nil
	case v.IsUnsigned():
		uval, err := strconv.ParseUint(str, 10, 64)
		if err != nil {
			return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v", err)
		}
		return numeric{uval: uval, typ: Uint64}, nil
	case v.IsFloat():
		fval, err := strconv.ParseFloat(str, 64)
		if err != nil {
			return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v", err)
		}
		return numeric{fval: fval, typ: Float64}, nil
	}

	// For other types, do best effort.
	if ival, err := strconv.ParseInt(str, 10, 64); err == nil {
		return numeric{ival: ival, typ: Int64}, nil
	}
	if fval, err := strconv.ParseFloat(str, 64); err == nil {
		return numeric{fval: fval, typ: Float64}, nil
	}
	return numeric{ival: 0, typ: Int64}, nil
}

// newIntegralNumeric parses a value and produces an Int64 or Uint64.
func newIntegralNumeric(v Value) (numeric, error) {
	str := v.ToString()
	switch {
	case v.IsSigned():
		ival, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v", err)
		}
		return numeric{ival: ival, typ: Int64}, nil
	case v.IsUnsigned():
		uval, err := strconv.ParseUint(str, 10, 64)
		if err != nil {
			return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "%v", err)
		}
		return numeric{uval: uval, typ: Uint64}, nil
	}

	// For other types, do best effort.
	if ival, err := strconv.ParseInt(str, 10, 64); err == nil {
		return numeric{ival: ival, typ: Int64}, nil
	}
	if uval, err := strconv.ParseUint(str, 10, 64); err == nil {
		return numeric{uval: uval, typ: Uint64}, nil
	}
	return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "could not parse value: '%s'", str)
}

func addNumeric(v1, v2 numeric) numeric {
	v1, v2 = prioritize(v1, v2)
	switch v1.typ {
	case Int64:
		return intPlusInt(v1.ival, v2.ival)
	case Uint64:
		switch v2.typ {
		case Int64:
			return uintPlusInt(v1.uval, v2.ival)
		case Uint64:
			return uintPlusUint(v1.uval, v2.uval)
		}
	case Float64:
		return floatPlusAny(v1.fval, v2)
	}
	panic("unreachable")
}

func addNumericWithError(v1, v2 numeric) (numeric, error) {
	v1, v2 = prioritize(v1, v2)
	switch v1.typ {
	case Int64:
		return intPlusIntWithError(v1.ival, v2.ival)
	case Uint64:
		switch v2.typ {
		case Int64:
			return uintPlusIntWithError(v1.uval, v2.ival)
		case Uint64:
			return uintPlusUintWithError(v1.uval, v2.uval)
		}
	case Float64:
		return floatPlusAny(v1.fval, v2), nil
	}
	panic("unreachable")
}

func subtractNumericWithError(v1, v2 numeric) (numeric, error) {
	switch v1.typ {
	case Int64:
		switch v2.typ {
		case Int64:
			return intMinusIntWithError(v1.ival, v2.ival)
		case Uint64:
			return intMinusUintWithError(v1.ival, v2.uval)
		case Float64:
			return anyMinusFloat(v1, v2.fval), nil
		}
	case Uint64:
		switch v2.typ {
		case Int64:
			return uintMinusIntWithError(v1.uval, v2.ival)
		case Uint64:
			return uintMinusUintWithError(v1.uval, v2.uval)
		case Float64:
			return anyMinusFloat(v1, v2.fval), nil
		}
	case Float64:
		return floatMinusAny(v1.fval, v2), nil
	}
	panic("unreachable")
}

func multiplyNumericWithError(v1, v2 numeric) (numeric, error) {
	v1, v2 = prioritize(v1, v2)
	switch v1.typ {
	case Int64:
		return intTimesIntWithError(v1.ival, v2.ival)
	case Uint64:
		switch v2.typ {
		case Int64:
			return uintTimesIntWithError(v1.uval, v2.ival)
		case Uint64:
			return uintTimesUintWithError(v1.uval, v2.uval)
		}
	case Float64:
		return floatTimesAny(v1.fval, v2), nil
	}
	panic("unreachable")
}

func divideNumericWithError(v1, v2 numeric) (numeric, error) {
	switch v1.typ {
	case Int64:
		return floatDivideAnyWithError(float64(v1.ival), v2)

	case Uint64:
		return floatDivideAnyWithError(float64(v1.uval), v2)

	case Float64:
		return floatDivideAnyWithError(v1.fval, v2)
	}
	panic("unreachable")
}

// prioritize reorders the input parameters
// to be Float64, Uint64, Int64.
func prioritize(v1, v2 numeric) (altv1, altv2 numeric) {
	switch v1.typ {
	case Int64:
		if v2.typ == Uint64 || v2.typ == Float64 {
			return v2, v1
		}
	case Uint64:
		if v2.typ == Float64 {
			return v2, v1
		}
	}
	return v1, v2
}

func intPlusInt(v1, v2 int64) numeric {
	result := v1 + v2
	if v1 > 0 && v2 > 0 && result < 0 {
		goto overflow
	}
	if v1 < 0 && v2 < 0 && result > 0 {
		goto overflow
	}
	return numeric{typ: Int64, ival: result}

overflow:
	return numeric{typ: Float64, fval: float64(v1) + float64(v2)}
}

func intPlusIntWithError(v1, v2 int64) (numeric, error) {
	result := v1 + v2
	if (result > v1) != (v2 > 0) {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT value is out of range in %v + %v", v1, v2)
	}
	return numeric{typ: Int64, ival: result}, nil
}

func intMinusIntWithError(v1, v2 int64) (numeric, error) {
	result := v1 - v2

	if (result < v1) != (v2 > 0) {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT value is out of range in %v - %v", v1, v2)
	}
	return numeric{typ: Int64, ival: result}, nil
}

func intTimesIntWithError(v1, v2 int64) (numeric, error) {
	result := v1 * v2
	if v1 != 0 && result/v1 != v2 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT value is out of range in %v * %v", v1, v2)
	}
	return numeric{typ: Int64, ival: result}, nil

}

func intMinusUintWithError(v1 int64, v2 uint64) (numeric, error) {
	if v1 < 0 || v1 < int64(v2) {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v - %v", v1, v2)
	}
	return uintMinusUintWithError(uint64(v1), v2)
}

func uintPlusInt(v1 uint64, v2 int64) numeric {
	return uintPlusUint(v1, uint64(v2))
}

func uintPlusIntWithError(v1 uint64, v2 int64) (numeric, error) {
	if v2 < 0 && v1 < uint64(v2) {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v + %v", v1, v2)
	}
	// convert to int -> uint is because for numeric operators (such as + or -)
	// where one of the operands is an unsigned integer, the result is unsigned by default.
	return uintPlusUintWithError(v1, uint64(v2))
}

func uintMinusIntWithError(v1 uint64, v2 int64) (numeric, error) {
	if int64(v1) < v2 && v2 > 0 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v - %v", v1, v2)
	}
	// uint - (- int) = uint + int
	if v2 < 0 {
		return uintPlusIntWithError(v1, -v2)
	}
	return uintMinusUintWithError(v1, uint64(v2))
}

func uintTimesIntWithError(v1 uint64, v2 int64) (numeric, error) {
	if v2 < 0 || int64(v1) < 0 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v * %v", v1, v2)
	}
	return uintTimesUintWithError(v1, uint64(v2))
}

func uintPlusUint(v1, v2 uint64) numeric {
	result := v1 + v2
	if result < v2 {
		return numeric{typ: Float64, fval: float64(v1) + float64(v2)}
	}
	return numeric{typ: Uint64, uval: result}
}

func uintPlusUintWithError(v1, v2 uint64) (numeric, error) {
	result := v1 + v2
	if result < v2 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v + %v", v1, v2)
	}
	return numeric{typ: Uint64, uval: result}, nil
}

func uintMinusUintWithError(v1, v2 uint64) (numeric, error) {
	result := v1 - v2
	if v2 > v1 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v - %v", v1, v2)
	}

	return numeric{typ: Uint64, uval: result}, nil
}

func uintTimesUintWithError(v1, v2 uint64) (numeric, error) {
	result := v1 * v2
	if result < v2 || result < v1 {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT UNSIGNED value is out of range in %v * %v", v1, v2)
	}
	return numeric{typ: Uint64, uval: result}, nil
}

func floatPlusAny(v1 float64, v2 numeric) numeric {
	switch v2.typ {
	case Int64:
		v2.fval = float64(v2.ival)
	case Uint64:
		v2.fval = float64(v2.uval)
	}
	return numeric{typ: Float64, fval: v1 + v2.fval}
}

func floatMinusAny(v1 float64, v2 numeric) numeric {
	switch v2.typ {
	case Int64:
		v2.fval = float64(v2.ival)
	case Uint64:
		v2.fval = float64(v2.uval)
	}
	return numeric{typ: Float64, fval: v1 - v2.fval}
}

func floatTimesAny(v1 float64, v2 numeric) numeric {
	switch v2.typ {
	case Int64:
		v2.fval = float64(v2.ival)
	case Uint64:
		v2.fval = float64(v2.uval)
	}
	return numeric{typ: Float64, fval: v1 * v2.fval}
}

func floatDivideAnyWithError(v1 float64, v2 numeric) (numeric, error) {
	switch v2.typ {
	case Int64:
		v2.fval = float64(v2.ival)
	case Uint64:
		v2.fval = float64(v2.uval)
	}
	result := v1 / v2.fval
	divisorLessThanOne := v2.fval < 1
	resultMismatch := (v2.fval*result != v1)

	if divisorLessThanOne && resultMismatch {
		return numeric{}, vterrors.Errorf(vtrpcpb.Code_INVALID_ARGUMENT, "BIGINT is out of range in %v / %v", v1, v2.fval)
	}

	return numeric{typ: Float64, fval: v1 / v2.fval}, nil
}

func anyMinusFloat(v1 numeric, v2 float64) numeric {
	switch v1.typ {
	case Int64:
		v1.fval = float64(v1.ival)
	case Uint64:
		v1.fval = float64(v1.uval)
	}
	return numeric{typ: Float64, fval: v1.fval - v2}
}

func castFromNumeric(v numeric, resultType querypb.Type) Value {
	switch {
	case IsSigned(resultType):
		switch v.typ {
		case Int64:
			return MakeTrusted(resultType, strconv.AppendInt(nil, v.ival, 10))
		case Uint64:
			return MakeTrusted(resultType, strconv.AppendInt(nil, int64(v.uval), 10))
		case Float64:
			return MakeTrusted(resultType, strconv.AppendInt(nil, int64(v.fval), 10))

		}
	case IsUnsigned(resultType):
		switch v.typ {
		case Uint64:
			return MakeTrusted(resultType, strconv.AppendUint(nil, v.uval, 10))
		case Int64:
			return MakeTrusted(resultType, strconv.AppendUint(nil, uint64(v.ival), 10))
		case Float64:
			return MakeTrusted(resultType, strconv.AppendUint(nil, uint64(v.fval), 10))

		}
	case IsFloat(resultType) || resultType == Decimal:
		switch v.typ {
		case Int64:
			return MakeTrusted(resultType, strconv.AppendInt(nil, v.ival, 10))
		case Uint64:
			return MakeTrusted(resultType, strconv.AppendUint(nil, v.uval, 10))
		case Float64:
			format := byte('g')
			if resultType == Decimal {
				format = 'f'
			}
			return MakeTrusted(resultType, strconv.AppendFloat(nil, v.fval, format, -1, 64))
		}
	}
	return NULL
}

func compareNumeric(v1, v2 numeric) int {
	// Equalize the types.
	switch v1.typ {
	case Int64:
		switch v2.typ {
		case Uint64:
			if v1.ival < 0 {
				return -1
			}
			v1 = numeric{typ: Uint64, uval: uint64(v1.ival)}
		case Float64:
			v1 = numeric{typ: Float64, fval: float64(v1.ival)}
		}
	case Uint64:
		switch v2.typ {
		case Int64:
			if v2.ival < 0 {
				return 1
			}
			v2 = numeric{typ: Uint64, uval: uint64(v2.ival)}
		case Float64:
			v1 = numeric{typ: Float64, fval: float64(v1.uval)}
		}
	case Float64:
		switch v2.typ {
		case Int64:
			v2 = numeric{typ: Float64, fval: float64(v2.ival)}
		case Uint64:
			v2 = numeric{typ: Float64, fval: float64(v2.uval)}
		}
	}

	// Both values are of the same type.
	switch v1.typ {
	case Int64:
		switch {
		case v1.ival == v2.ival:
			return 0
		case v1.ival < v2.ival:
			return -1
		}
	case Uint64:
		switch {
		case v1.uval == v2.uval:
			return 0
		case v1.uval < v2.uval:
			return -1
		}
	case Float64:
		switch {
		case v1.fval == v2.fval:
			return 0
		case v1.fval < v2.fval:
			return -1
		}
	}

	// v1>v2
	return 1
}
