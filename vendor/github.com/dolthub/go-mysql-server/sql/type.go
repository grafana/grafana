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

package sql

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"
	"unicode"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"
)

var (
	// ErrNotTuple is returned when the value is not a tuple.
	ErrNotTuple = errors.NewKind("value of type %T is not a tuple")

	// ErrInvalidColumnNumber is returned when a tuple has an invalid number of
	// arguments.
	ErrInvalidColumnNumber = errors.NewKind("tuple should contain %d column(s), but has %d")

	ErrInvalidBaseType = errors.NewKind("%v is not a valid %v base type")

	// ErrConvertToSQL is returned when Convert failed.
	// It makes an error less verbose comparing to what spf13/cast returns.
	ErrConvertToSQL = errors.NewKind("incompatible conversion to SQL type: '%v'->%s")
)

const (
	// DateLayout is the layout of the MySQL date format in the representation
	// Go understands.
	DateLayout = "2006-01-02"

	// TimestampDatetimeLayout is the formatting string with the layout of the timestamp
	// using the format of Go "time" package.
	TimestampDatetimeLayout = "2006-01-02 15:04:05.999999"

	// DatetimeLayoutNoTrim is the formatting string with the layout of the datetime that
	// doesn't trim trailing zeros
	DatetimeLayoutNoTrim = "2006-01-02 15:04:05.000000"
)

const (
	// False is the numeric representation of False as defined by MySQL.
	False = int8(0)
	// True is the numeric representation of True as defined by MySQL.
	True = int8(1)
)

type ConvertInRange bool

const (
	InRange    ConvertInRange = true
	OutOfRange                = false
)

// Type represents a SQL type.
type Type interface {
	CollationCoercible
	// Compare returns an integer comparing two values.
	// The result will be 0 if a==b, -1 if a < b, and +1 if a > b.
	Compare(context.Context, interface{}, interface{}) (int, error)
	// Convert a value of a compatible type to a most accurate type, returning
	// the new value, whether the value in range, or an error. If |inRange| is
	// false, the value was coerced according to MySQL's rules.
	Convert(context.Context, interface{}) (interface{}, ConvertInRange, error)
	// Equals returns whether the given type is equivalent to the calling type. All parameters are included in the
	// comparison, so ENUM("a", "b") is not equivalent to ENUM("a", "b", "c").
	Equals(otherType Type) bool
	// MaxTextResponseByteLength returns the maximum number of bytes needed to serialize an instance of this type
	// as a string in a response over the wire for MySQL's text protocol – in other words, this is the maximum bytes
	// needed to serialize any value of this type as human-readable text, NOT in a more compact, binary representation.
	MaxTextResponseByteLength(ctx *Context) uint32
	// Promote will promote the current type to the largest representing type of the same kind, such as Int8 to Int64.
	Promote() Type
	// SQL returns the sqltypes.Value for the given value.
	// Implementations can optionally use |dest| to append
	// serialized data, but should not mutate existing data.
	SQL(ctx *Context, dest []byte, v interface{}) (sqltypes.Value, error)
	// Type returns the query.Type for the given Type.
	Type() query.Type
	// ValueType returns the Go type of the value returned by Convert().
	ValueType() reflect.Type
	// Zero returns the golang zero value for this type
	Zero() interface{}
	fmt.Stringer
}

// TrimStringToNumberPrefix will remove any white space for s and truncate any trailing non-numeric characters.
func TrimStringToNumberPrefix(ctx *Context, s string, isInt bool) string {
	if isInt {
		s = strings.TrimLeft(s, IntCutSet)
	} else {
		s = strings.TrimLeft(s, NumericCutSet)
	}

	seenDigit := false
	seenDot := false
	seenExp := false
	signIndex := 0

	var i int
	for i = 0; i < len(s); i++ {
		char := rune(s[i])
		if unicode.IsDigit(char) {
			seenDigit = true
		} else if char == '.' && !seenDot && !isInt {
			seenDot = true
		} else if (char == 'e' || char == 'E') && !seenExp && seenDigit && !isInt {
			seenExp = true
			signIndex = i + 1
		} else if !((char == '-' || char == '+') && i == signIndex) {
			// TODO: this should not happen here, and it should use sql.ErrIncorrectTruncation
			if isInt {
				ctx.Warn(mysql.ERTruncatedWrongValue, "Truncated incorrect INTEGER value: '%s'", s)
			} else {
				ctx.Warn(mysql.ERTruncatedWrongValue, "Truncated incorrect DOUBLE value: '%s'", s)
			}
			break
		}
	}
	s = s[:i]
	if s == "" {
		s = "0"
	}
	return s
}

// NullType represents the type of NULL values
type NullType interface {
	Type

	// IsNullType is a marker interface for types that represent NULL values.
	IsNullType() bool
}

// DeferredType is a placeholder for prepared statements
// that is replaced by the BindVar type on re-analysis.
type DeferredType interface {
	Type
	IsDeferred() bool
	Name() string
}

// NumberType represents all integer and floating point types.
// https://dev.mysql.com/doc/refman/8.0/en/integer-types.html
// https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html
// The type of the returned value is one of the following: int8, int16, int32, int64, uint8, uint16, uint32, uint64, float32, float64.
type NumberType interface {
	Type
	IsSigned() bool
	IsFloat() bool
	DisplayWidth() int
}

func IsNumberType(t Type) bool {
	_, ok := t.(NumberType)
	return ok
}

// RoundingNumberType represents Number Types that implement an additional interface
// that supports rounding when converting rather than the default truncation.
type RoundingNumberType interface {
	NumberType
	ConvertRound(context.Context, any) (any, ConvertInRange, error)
}

// StringType represents all string types, including VARCHAR and BLOB.
// https://dev.mysql.com/doc/refman/8.0/en/char.html
// https://dev.mysql.com/doc/refman/8.0/en/binary-varbinary.html
// https://dev.mysql.com/doc/refman/8.0/en/blob.html
// The type of the returned value is string.
type StringType interface {
	Type
	CharacterSet() CharacterSetID
	Collation() CollationID
	// MaxCharacterLength returns the maximum number of chars that can safely be stored in this type, based on
	// the current character set.
	MaxCharacterLength() int64
	// MaxByteLength returns the maximum number of bytes that may be consumed by a value stored in this type.
	MaxByteLength() int64
	// Length returns the maximum length, in characters, allowed for this string type.
	Length() int64
}

func IsStringType(t Type) bool {
	_, ok := t.(StringType)
	return ok
}

// DatetimeType represents DATE, DATETIME, and TIMESTAMP.
// https://dev.mysql.com/doc/refman/8.0/en/datetime.html
// The type of the returned value is time.Time.
type DatetimeType interface {
	Type
	ConvertWithoutRangeCheck(ctx context.Context, v interface{}) (time.Time, error)
	MaximumTime() time.Time
	MinimumTime() time.Time
	Precision() int
}

// YearType represents the YEAR type.
// https://dev.mysql.com/doc/refman/8.0/en/year.html
// The type of the returned value is int16.
type YearType interface {
	Type
}

// SetType represents the SET type.
// https://dev.mysql.com/doc/refman/8.0/en/set.html
// The type of the returned value is uint64.
type SetType interface {
	Type
	CharacterSet() CharacterSetID
	Collation() CollationID
	// NumberOfElements returns the number of elements in this set.
	NumberOfElements() uint16
	// BitsToString takes a previously-converted value and returns it as a string.
	BitsToString(bits uint64) (string, error)
	// Values returns all of the set's values in ascending order according to their corresponding bit value.
	Values() []string
}

// EnumType represents the ENUM type.
// https://dev.mysql.com/doc/refman/8.0/en/enum.html
// The type of the returned value is uint16.
type EnumType interface {
	Type
	// At returns the string at the given index, as well if the string was found.
	At(index int) (string, bool)
	CharacterSet() CharacterSetID
	Collation() CollationID
	// IndexOf returns the index of the given string. If the string was not found, then this returns -1.
	IndexOf(v string) int
	// IsSubsetOf returns whether every element in this is also in |otherType|, with the same indexes.
	// |otherType| may contain additional elements not in this.
	IsSubsetOf(otherType EnumType) bool
	// NumberOfElements returns the number of enumerations.
	NumberOfElements() uint16
	// Values returns the elements, in order, of every enumeration.
	Values() []string
}

// DecimalType represents the DECIMAL type.
// https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html
// The type of the returned value is decimal.Decimal.
type DecimalType interface {
	Type
	// ConvertToNullDecimal converts the given value to a decimal.NullDecimal if it has a compatible type. It is worth
	// noting that Convert() returns a nil value for nil inputs, and also returns decimal.Decimal rather than
	// decimal.NullDecimal.
	ConvertToNullDecimal(v interface{}) (decimal.NullDecimal, error)
	//ConvertNoBoundsCheck normalizes an interface{} to a decimal type without performing expensive bound checks
	ConvertNoBoundsCheck(v interface{}) (decimal.Decimal, error)
	// BoundsCheck rounds and validates a decimal, returning the decimal,
	// whether the value was out of range, and an error.
	BoundsCheck(v decimal.Decimal) (decimal.Decimal, ConvertInRange, error)
	// ExclusiveUpperBound returns the exclusive upper bound for this Decimal.
	// For example, DECIMAL(5,2) would return 1000, as 999.99 is the max represented.
	ExclusiveUpperBound() decimal.Decimal
	// MaximumScale returns the maximum scale allowed for the current precision.
	MaximumScale() uint8
	// Precision returns the base-10 precision of the type, which is the total number of digits. For example, a
	// precision of 3 means that 999, 99.9, 9.99, and .999 are all valid maximums (depending on the scale).
	Precision() uint8
	// Scale returns the scale, or number of digits after the decimal, that may be held.
	// This will always be less than or equal to the precision.
	Scale() uint8
}

func IsDecimalType(t Type) bool {
	_, ok := t.(DecimalType)
	return ok
}

type Type2 interface {
	Type

	// Compare2 returns an integer comparing two Values.
	Compare2(Value, Value) (int, error)
	// Convert2 converts a value of a compatible type.
	Convert2(Value) (Value, error)
	// Zero2 returns the zero Value for this type.
	Zero2() Value
	// SQL2 returns the sqltypes.Value for the given value
	SQL2(Value) (sqltypes.Value, error)
}

// SpatialColumnType is a node that contains a reference to all spatial types.
type SpatialColumnType interface {
	// GetSpatialTypeSRID returns the SRID value for spatial types.
	GetSpatialTypeSRID() (uint32, bool)
	// SetSRID sets SRID value for spatial types.
	SetSRID(uint32) Type
	// MatchSRID returns nil if column type SRID matches given value SRID otherwise returns error.
	MatchSRID(interface{}) error
}

// SystemVariableType represents a SQL type specifically (and only) used in system variables. Assigning any non-system
// variables a SystemVariableType will cause errors.
type SystemVariableType interface {
	Type
	// EncodeValue returns the given value as a string for storage.
	EncodeValue(interface{}) (string, error)
	// DecodeValue returns the original value given to EncodeValue from the given string. This is different from `Convert`,
	// as the encoded value may technically be an "illegal" value according to the type rules.
	DecodeValue(string) (interface{}, error)
	// UnderlyingType returns the underlying type that this system variable type is based on.
	UnderlyingType() Type
}

// ExtendedType is a serializable type that offers an extended interface for interacting with types in a wider context.
type ExtendedType interface {
	Type
	// SerializedCompare compares two byte slices that each represent a serialized value, without first deserializing
	// the value. This should return the same result as the Compare function.
	SerializedCompare(ctx context.Context, v1 []byte, v2 []byte) (int, error)
	// SerializeValue converts the given value into a binary representation.
	SerializeValue(ctx context.Context, val any) ([]byte, error)
	// DeserializeValue converts a binary representation of a value into its canonical type.
	DeserializeValue(ctx context.Context, val []byte) (any, error)
	// FormatValue returns a string version of the value. Primarily intended for display.
	FormatValue(val any) (string, error)
	// MaxSerializedWidth returns the maximum size that the serialized value may represent.
	MaxSerializedWidth() ExtendedTypeSerializedWidth
	// ConvertToType converts the given value of the given type to this type, or returns an error if
	// no conversion is possible.
	ConvertToType(ctx *Context, typ ExtendedType, val any) (any, error)
}

type ExtendedTypeSerializedWidth uint8

const (
	ExtendedTypeSerializedWidth_64K       ExtendedTypeSerializedWidth = iota // Represents a variably-sized value. The maximum number of bytes is (2^16)-1.
	ExtendedTypeSerializedWidth_Unbounded                                    // Represents a variably-sized value. The maximum number of bytes is (2^64)-1, which is practically unbounded.
)
