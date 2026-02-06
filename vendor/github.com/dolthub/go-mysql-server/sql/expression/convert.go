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

package expression

import (
	"fmt"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/mysql"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/sirupsen/logrus"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ErrConvertExpression is returned when a conversion is not possible.
var ErrConvertExpression = errors.NewKind("expression '%v': couldn't convert to %v")

const (
	// ConvertToBinary is a conversion to binary.
	ConvertToBinary = "binary"
	// ConvertToChar is a conversion to char.
	ConvertToChar = "char"
	// ConvertToNChar is a conversion to nchar.
	ConvertToNChar = "nchar"
	// ConvertToDate is a conversion to date.
	ConvertToDate = "date"
	// ConvertToDatetime is a conversion to datetime.
	ConvertToDatetime = "datetime"
	// ConvertToDecimal is a conversion to decimal.
	ConvertToDecimal = "decimal"
	// ConvertToFloat is a conversion to float.
	ConvertToFloat = "float"
	// ConvertToDouble is a conversion to double.
	ConvertToDouble = "double"
	// ConvertToJSON is a conversion to json.
	ConvertToJSON = "json"
	// ConvertToReal is a conversion to double.
	ConvertToReal = "real"
	// ConvertToSigned is a conversion to signed.
	ConvertToSigned = "signed"
	// ConvertToTime is a conversion to time.
	ConvertToTime = "time"
	// ConvertToYear isa convert to year.
	ConvertToYear = "year"
	// ConvertToUnsigned is a conversion to unsigned.
	ConvertToUnsigned = "unsigned"
)

// Convert represent a CAST(x AS T) or CONVERT(x, T) operation that casts x expression to type T.
type Convert struct {
	UnaryExpression

	// cachedDecimalType is the cached Decimal type for this convert expression. Because new Decimal types
	// must be created with their specific scale and precision values, unlike other types, we cache the created
	// type to avoid re-creating it on every call to Type().
	cachedDecimalType sql.DecimalType

	// castToType is a string representation of the base type to which we are casting (e.g. "char", "float", "decimal")
	castToType string
	// typeLength is the optional length parameter for types that support it (e.g. "char(10)")
	typeLength int
	// typeScale is the optional scale parameter for types that support it (e.g. "decimal(10, 2)")
	typeScale int
}

var _ sql.Expression = (*Convert)(nil)
var _ sql.CollationCoercible = (*Convert)(nil)

// NewConvert creates a new Convert expression that will attempt to convert the specified expression |expr| into the
// |castToType| type. All optional parameters (i.e. typeLength, typeScale, and charset) are omitted and initialized
// to their zero values.
func NewConvert(expr sql.Expression, castToType string) *Convert {
	disableRounding(expr)
	return &Convert{
		UnaryExpression: UnaryExpression{Child: expr},
		castToType:      strings.ToLower(castToType),
	}
}

// NewConvertWithLengthAndScale creates a new Convert expression that will attempt to convert |expr| into the
// |castToType| type, with |typeLength| specifying a length constraint of the converted type, and |typeScale| specifying
// a scale constraint of the converted type.
func NewConvertWithLengthAndScale(expr sql.Expression, castToType string, typeLength, typeScale int) *Convert {
	disableRounding(expr)
	return &Convert{
		UnaryExpression: UnaryExpression{Child: expr},
		castToType:      strings.ToLower(castToType),
		typeLength:      typeLength,
		typeScale:       typeScale,
	}
}

// GetConvertToType returns which type the both left and right values should be converted to.
// If neither sql.Type represent number, then converted to string. Otherwise, we try to get
// the appropriate type to avoid any precision loss.
func GetConvertToType(l, r sql.Type) string {
	if types.Null == l {
		return GetConvertToType(r, r)
	}
	if types.Null == r {
		return GetConvertToType(l, l)
	}

	if !types.IsNumber(l) || !types.IsNumber(r) {
		// Special handling for BLOB types - preserve binary data
		if types.IsBlobType(l) || types.IsBlobType(r) {
			return ConvertToBinary
		}
		return ConvertToChar
	}

	if types.IsDecimal(l) || types.IsDecimal(r) {
		return ConvertToDecimal
	}
	if types.IsBit(l) || types.IsBit(r) {
		return ConvertToSigned
	}
	if types.IsUnsigned(l) && types.IsUnsigned(r) {
		return ConvertToUnsigned
	}
	if types.IsSigned(l) && types.IsSigned(r) {
		return ConvertToSigned
	}
	if types.IsInteger(l) && types.IsInteger(r) {
		return ConvertToSigned
	}

	return ConvertToChar
}

// IsNullable implements the Expression interface.
func (c *Convert) IsNullable() bool {
	switch c.castToType {
	case ConvertToDate, ConvertToDatetime:
		return true
	default:
		return c.Child.IsNullable()
	}
}

// Type implements the Expression interface.
func (c *Convert) Type() sql.Type {
	switch c.castToType {
	case ConvertToBinary:
		return types.LongBlob
	case ConvertToChar, ConvertToNChar:
		return types.LongText
	case ConvertToDate:
		return types.Date
	case ConvertToDatetime:
		return types.MustCreateDatetimeType(sqltypes.Datetime, c.typeLength)
	case ConvertToDecimal:
		if c.cachedDecimalType == nil {
			c.cachedDecimalType = createConvertedDecimalType(c.typeLength, c.typeScale, true)
		}
		return c.cachedDecimalType
	case ConvertToFloat:
		return types.Float32
	case ConvertToDouble, ConvertToReal:
		return types.Float64
	case ConvertToJSON:
		return types.JSON
	case ConvertToSigned:
		return types.Int64
	case ConvertToTime:
		return types.Time
	case ConvertToUnsigned:
		return types.Uint64
	case ConvertToYear:
		return types.Year
	default:
		return types.Null
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *Convert) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	switch c.castToType {
	case ConvertToBinary:
		return sql.Collation_binary, 2
	case ConvertToChar, ConvertToNChar:
		return ctx.GetCollation(), 2
	case ConvertToDate:
		return sql.Collation_binary, 5
	case ConvertToDatetime:
		return sql.Collation_binary, 5
	case ConvertToDecimal:
		return sql.Collation_binary, 5
	case ConvertToDouble, ConvertToReal, ConvertToFloat:
		return sql.Collation_binary, 5
	case ConvertToJSON:
		return ctx.GetCharacterSet().BinaryCollation(), 2
	case ConvertToSigned:
		return sql.Collation_binary, 5
	case ConvertToTime:
		return sql.Collation_binary, 5
	case ConvertToUnsigned:
		return sql.Collation_binary, 5
	case ConvertToYear:
		return sql.Collation_binary, 5
	default:
		return sql.Collation_binary, 7
	}
}

// String implements the Stringer interface.
func (c *Convert) String() string {
	extraTypeInfo := ""
	if c.typeLength > 0 {
		if c.typeScale > 0 {
			extraTypeInfo = fmt.Sprintf("(%d,%d)", c.typeLength, c.typeScale)
		} else {
			extraTypeInfo = fmt.Sprintf("(%d)", c.typeLength)
		}
	}
	return fmt.Sprintf("convert(%v, %v%s)", c.Child, c.castToType, extraTypeInfo)
}

// DebugString implements the Expression interface.
func (c *Convert) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("convert")
	children := []string{
		fmt.Sprintf("type: %v", c.castToType),
	}

	if c.typeLength > 0 {
		children = append(children, fmt.Sprintf("typeLength: %v", c.typeLength))
	}

	if c.typeScale > 0 {
		children = append(children, fmt.Sprintf("typeScale: %v", c.typeScale))
	}

	children = append(children, sql.DebugString(c.Child))

	_ = pr.WriteChildren(children...)
	return pr.String()
}

// WithChildren implements the Expression interface.
func (c *Convert) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewConvertWithLengthAndScale(children[0], c.castToType, c.typeLength, c.typeScale), nil
}

// Eval implements the Expression interface.
func (c *Convert) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	// Should always return nil, and a warning instead
	casted, err := convertValue(ctx, val, c.castToType, c.Child.Type(), c.typeLength, c.typeScale)
	if err != nil {
		if c.castToType == ConvertToJSON {
			return nil, ErrConvertExpression.Wrap(err, c.String(), c.castToType)
		}
		ctx.Warn(1292, "Incorrect %s value: %v", c.castToType, val)
		return nil, nil
	}

	return casted, nil
}

// convertValue converts a value from its current type to the specified target type for CAST/CONVERT operations.
// It handles type-specific conversion logic and applies length/scale constraints where applicable.
// If |typeLength| and |typeScale| are 0, they are ignored, otherwise they are used as constraints on the
// converted type where applicable (e.g. Char conversion supports only |typeLength|, Decimal conversion supports
// |typeLength| and |typeScale|).
// Only returns an error if converting to JSON, Date, and Datetime; the zero value is returned for float types.
// Nil is returned in all other cases.
func convertValue(ctx *sql.Context, val interface{}, castTo string, originType sql.Type, typeLength, typeScale int) (interface{}, error) {
	if val == nil {
		return nil, nil
	}
	switch strings.ToLower(castTo) {
	case ConvertToBinary:
		b, _, err := types.TypeAwareConversion(ctx, val, originType, types.LongBlob)
		if err != nil {
			return nil, nil
		}
		if types.IsTextOnly(originType) {
			// For string types we need to re-encode the string as we want the binary representation of the character set
			encoder := originType.(sql.StringType).Collation().CharacterSet().Encoder()
			encodedBytes, ok := encoder.Encode(b.([]byte))
			if !ok {
				return nil, fmt.Errorf("unable to re-encode string to convert to binary")
			}
			b = encodedBytes
		}
		if bb, ok := b.([]byte); ok && len(bb) < typeLength {
			b = append(bb, make([]byte, typeLength-len(bb))...)
		}
		return truncateConvertedValue(b, typeLength)
	case ConvertToChar, ConvertToNChar:
		s, _, err := types.TypeAwareConversion(ctx, val, originType, types.LongText)
		if err != nil {
			return nil, nil
		}
		return truncateConvertedValue(s, typeLength)
	case ConvertToDate:
		_, isTime := val.(time.Time)
		_, isString := val.(string)
		_, isBinary := val.([]byte)
		if !(isTime || isString || isBinary) {
			return nil, nil
		}
		d, _, err := types.Date.Convert(ctx, val)
		if err != nil {
			return nil, err
		}
		return d, nil
	case ConvertToDatetime:
		_, isTime := val.(time.Time)
		_, isString := val.(string)
		_, isBinary := val.([]byte)
		if !(isTime || isString || isBinary) {
			return nil, nil
		}
		d, _, err := types.MustCreateDatetimeType(sqltypes.Datetime, typeLength).Convert(ctx, val)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return nil, err
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return d, nil
	case ConvertToDecimal:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		dt := createConvertedDecimalType(typeLength, typeScale, false)
		d, _, err := dt.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return dt.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return d, nil
	case ConvertToFloat:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		d, _, err := types.Float32.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return types.Float64.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return d, nil
	case ConvertToDouble, ConvertToReal:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		d, _, err := types.Float64.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return types.Float64.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return d, nil
	case ConvertToJSON:
		js, _, err := types.JSON.Convert(ctx, val)
		if err != nil {
			return nil, err
		}
		return js, nil
	case ConvertToSigned:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		num, _, err := types.Int64.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return types.Int64.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return num, nil
	case ConvertToTime:
		t, _, err := types.Time.Convert(ctx, val)
		if err != nil {
			return nil, nil
		}
		return t, nil
	case ConvertToUnsigned:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		num, inRange, err := types.Uint64.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return types.Uint64.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		if !inRange {
			ctx.Warn(1105, "Cast to unsigned converted negative integer to its positive complement")
		}
		return num, nil
	case ConvertToYear:
		value, err := types.ConvertHexBlobToDecimalForNumericContext(val, originType)
		if err != nil {
			return nil, err
		}
		num, _, err := types.Uint64.Convert(ctx, value)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return types.Float64.Zero(), nil
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}
		return num, nil
	default:
		return nil, nil
	}
}

// truncateConvertedValue truncates |val| to the specified |typeLength| if |val|
// is a string or byte slice. If the typeLength is 0, or if it is greater than
// the length of |val|, then |val| is simply returned as is. If |val| is not a
// string or []byte, then an error is returned.
func truncateConvertedValue(val interface{}, typeLength int) (interface{}, error) {
	if typeLength <= 0 {
		return val, nil
	}

	switch v := val.(type) {
	case []byte:
		if len(v) <= typeLength {
			typeLength = len(v)
		}
		return v[:typeLength], nil
	case string:
		if len(v) <= typeLength {
			typeLength = len(v)
		}
		return v[:typeLength], nil
	default:
		return nil, fmt.Errorf("unsupported type for truncation: %T", val)
	}
}

// createConvertedDecimalType creates a new Decimal type with the specified |precision| and |scale|. If a Decimal
// type cannot be created from the values specified, the internal Decimal type is returned. If |logErrors| is true,
// an error will also logged to the standard logger. (Setting |logErrors| to false, allows the caller to prevent
// spurious error message from being logged multiple times for the same error.) This function is intended to be
// used in places where an error cannot be returned (e.g. Node.Type() implementations), hence why it logs an error
// instead of returning one.
func createConvertedDecimalType(length, scale int, logErrors bool) sql.DecimalType {
	if length > 0 && scale > 0 {
		dt, err := types.CreateColumnDecimalType(uint8(length), uint8(scale))
		if err != nil {
			if logErrors {
				logrus.StandardLogger().Errorf("unable to create decimal type with length %d and scale %d: %v", length, scale, err)
			}
			return types.InternalDecimalType
		}
		return dt
	}
	return types.InternalDecimalType
}
