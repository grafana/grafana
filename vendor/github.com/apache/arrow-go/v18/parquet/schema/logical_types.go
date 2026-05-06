// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package schema

import (
	"fmt"
	"math"

	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
)

// DecimalMetadata is a struct for managing scale and precision information between
// converted and logical types.
type DecimalMetadata struct {
	IsSet     bool
	Scale     int32
	Precision int32
}

func getLogicalType(l *format.LogicalType) LogicalType {
	switch {
	case l.IsSetSTRING():
		return StringLogicalType{}
	case l.IsSetMAP():
		return MapLogicalType{}
	case l.IsSetLIST():
		return ListLogicalType{}
	case l.IsSetENUM():
		return EnumLogicalType{}
	case l.IsSetDECIMAL():
		return DecimalLogicalType{typ: l.DECIMAL}
	case l.IsSetDATE():
		return DateLogicalType{}
	case l.IsSetTIME():
		if timeUnitFromThrift(l.TIME.Unit) == TimeUnitUnknown {
			panic("parquet: TimeUnit must be one of MILLIS, MICROS, or NANOS for Time logical type")
		}
		return TimeLogicalType{typ: l.TIME}
	case l.IsSetTIMESTAMP():
		if timeUnitFromThrift(l.TIMESTAMP.Unit) == TimeUnitUnknown {
			panic("parquet: TimeUnit must be one of MILLIS, MICROS, or NANOS for Timestamp logical type")
		}
		return TimestampLogicalType{typ: l.TIMESTAMP}
	case l.IsSetINTEGER():
		return IntLogicalType{typ: l.INTEGER}
	case l.IsSetUNKNOWN():
		return NullLogicalType{}
	case l.IsSetJSON():
		return JSONLogicalType{}
	case l.IsSetBSON():
		return BSONLogicalType{}
	case l.IsSetUUID():
		return UUIDLogicalType{}
	case l.IsSetFLOAT16():
		return Float16LogicalType{}
	case l.IsSetVARIANT():
		return VariantLogicalType{}
	case l == nil:
		return NoLogicalType{}
	default:
		panic("invalid logical type")
	}
}

// TimeUnitType is an enum for denoting whether a time based logical type
// is using milliseconds, microseconds or nanoseconds.
type TimeUnitType int

// Constants for the TimeUnitType
const (
	TimeUnitMillis TimeUnitType = iota
	TimeUnitMicros
	TimeUnitNanos
	TimeUnitUnknown
)

// LogicalType is the descriptor that defines the usage of a physical primitive
// type in the schema, such as an Interval, Date, etc.
type LogicalType interface {
	// Returns true if a nested type like List or Map
	IsNested() bool
	// Returns true if this type can be serialized, ie: not Unknown/NoType/Interval
	IsSerialized() bool
	// Returns true if not NoLogicalType
	IsValid() bool
	// Returns true if it is NoType
	IsNone() bool
	// returns a string representation of the Logical Type
	String() string
	toThrift() *format.LogicalType
	// Return the equivalent ConvertedType for legacy Parquet systems
	ToConvertedType() (ConvertedType, DecimalMetadata)
	// Returns true if the specified ConvertedType is compatible with this
	// logical type
	IsCompatible(ConvertedType, DecimalMetadata) bool
	// Returns true if this logical type can be used with the provided physical type
	IsApplicable(t parquet.Type, tlen int32) bool
	// Returns true if the logical types are the same
	Equals(LogicalType) bool
	// Returns the default stat sort order for this logical type
	SortOrder() SortOrder
}

// TemporalLogicalType is a smaller interface for Time based logical types
// like Time / Timestamp
type TemporalLogicalType interface {
	LogicalType
	IsAdjustedToUTC() bool
	TimeUnit() TimeUnitType
}

// SortOrder mirrors the parquet.thrift sort order type
type SortOrder int8

// Constants for the Stat sort order definitions
const (
	SortSIGNED SortOrder = iota
	SortUNSIGNED
	SortUNKNOWN
)

// DefaultSortOrder returns the default stat sort order for the given physical type
func DefaultSortOrder(primitive format.Type) SortOrder {
	switch primitive {
	case format.Type_BOOLEAN, format.Type_INT32, format.Type_INT64, format.Type_FLOAT, format.Type_DOUBLE:
		return SortSIGNED
	case format.Type_BYTE_ARRAY, format.Type_FIXED_LEN_BYTE_ARRAY:
		return SortUNSIGNED
	case format.Type_INT96:
		fallthrough
	default:
		return SortUNKNOWN
	}
}

// GetLogicalSortOrder returns the default sort order for this logical type
// or falls back to the default sort order for the physical type if not valid
func GetLogicalSortOrder(logical LogicalType, primitive format.Type) SortOrder {
	switch {
	case logical == nil || !logical.IsValid():
		return SortUNKNOWN
	case logical.Equals(NoLogicalType{}):
		return DefaultSortOrder(primitive)
	default:
		return logical.SortOrder()
	}
}

type baseLogicalType struct{}

func (baseLogicalType) IsSerialized() bool {
	return true
}

func (baseLogicalType) IsValid() bool {
	return true
}

func (baseLogicalType) IsNested() bool {
	return false
}

func (baseLogicalType) IsNone() bool { return false }

// StringLogicalType is a UTF8 string, only usable with ByteArray and FixedLenByteArray
type StringLogicalType struct{ baseLogicalType }

func (StringLogicalType) SortOrder() SortOrder {
	return SortUNSIGNED
}

func (StringLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": StringLogicalType{}.String()})
}

func (StringLogicalType) String() string {
	return "String"
}

func (StringLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.UTF8, DecimalMetadata{}
}

func (StringLogicalType) IsCompatible(t ConvertedType, dec DecimalMetadata) bool {
	return t == ConvertedTypes.UTF8 && !dec.IsSet
}

func (StringLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.ByteArray
}

func (StringLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{STRING: format.NewStringType()}
}

func (StringLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(StringLogicalType)
	return ok
}

// MapLogicalType represents a mapped type
type MapLogicalType struct{ baseLogicalType }

func (MapLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (MapLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": MapLogicalType{}.String()})
}

func (MapLogicalType) String() string {
	return "Map"
}

func (MapLogicalType) IsNested() bool {
	return true
}

func (MapLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.Map, DecimalMetadata{}
}

func (MapLogicalType) IsCompatible(t ConvertedType, dec DecimalMetadata) bool {
	return (t == ConvertedTypes.Map || t == ConvertedTypes.MapKeyValue) && !dec.IsSet
}

func (MapLogicalType) IsApplicable(parquet.Type, int32) bool {
	return false
}

func (MapLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{MAP: format.NewMapType()}
}

func (MapLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(MapLogicalType)
	return ok
}

func NewListLogicalType() LogicalType {
	return ListLogicalType{}
}

// ListLogicalType is used for columns which are themselves nested lists
type ListLogicalType struct{ baseLogicalType }

func (ListLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (ListLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": ListLogicalType{}.String()})
}

func (ListLogicalType) String() string {
	return "List"
}

func (ListLogicalType) IsNested() bool {
	return true
}

func (ListLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.List, DecimalMetadata{}
}

func (ListLogicalType) IsCompatible(t ConvertedType, dec DecimalMetadata) bool {
	return t == ConvertedTypes.List && !dec.IsSet
}

func (ListLogicalType) IsApplicable(parquet.Type, int32) bool {
	return false
}

func (ListLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{LIST: format.NewListType()}
}

func (ListLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(ListLogicalType)
	return ok
}

// EnumLogicalType is for representing an enum, which should be a byte array type
type EnumLogicalType struct{ baseLogicalType }

func (EnumLogicalType) SortOrder() SortOrder {
	return SortUNSIGNED
}

func (EnumLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": EnumLogicalType{}.String()})
}

func (EnumLogicalType) String() string {
	return "Enum"
}

func (EnumLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.Enum, DecimalMetadata{}
}

func (EnumLogicalType) IsCompatible(t ConvertedType, dec DecimalMetadata) bool {
	return t == ConvertedTypes.Enum && !dec.IsSet
}

func (EnumLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.ByteArray
}

func (EnumLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{ENUM: format.NewEnumType()}
}

func (EnumLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(EnumLogicalType)
	return ok
}

// NewDecimalLogicalType returns a Decimal logical type with the given
// precision and scale.
//
// Panics if precision < 1 or scale is not in the range (0, precision)
func NewDecimalLogicalType(precision int32, scale int32) LogicalType {
	if precision < 1 {
		panic("parquet: precision must be greater than or equal to 1 for decimal logical type")
	}
	if scale < 0 || scale > precision {
		panic("parquet: scale must be a non-negative integer that does not exceed precision for decimal logical type")
	}
	return DecimalLogicalType{typ: &format.DecimalType{Precision: precision, Scale: scale}}
}

// DecimalLogicalType is used to represent a decimal value of a given
// precision and scale
type DecimalLogicalType struct {
	baseLogicalType
	typ *format.DecimalType
}

func (t DecimalLogicalType) Precision() int32 {
	return t.typ.Precision
}

func (t DecimalLogicalType) Scale() int32 {
	return t.typ.Scale
}

func (DecimalLogicalType) SortOrder() SortOrder {
	return SortSIGNED
}

func (t DecimalLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"Type": "Decimal", "precision": t.typ.Precision, "scale": t.typ.Scale})
}

func (t DecimalLogicalType) String() string {
	return fmt.Sprintf("Decimal(precision=%d, scale=%d)", t.typ.Precision, t.typ.Scale)
}

func (t DecimalLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.Decimal, DecimalMetadata{IsSet: true, Scale: t.typ.GetScale(), Precision: t.typ.GetPrecision()}
}

func (t DecimalLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.Decimal &&
		dec.IsSet && dec.Scale == t.typ.Scale && dec.Precision == t.typ.Precision
}

func (t DecimalLogicalType) IsApplicable(typ parquet.Type, tlen int32) bool {
	switch typ {
	case parquet.Types.Int32:
		return 1 <= t.typ.Precision && t.typ.Precision <= 9
	case parquet.Types.Int64:
		if t.typ.Precision < 10 {
			debug.Log("int64 used for decimal logical, precision is small enough to use int32")
		}
		return 1 <= t.typ.Precision && t.typ.Precision <= 18
	case parquet.Types.FixedLenByteArray:
		return t.typ.Precision <= int32(math.Floor(math.Log10(math.Pow(2.0, (8.0*float64(tlen)-1.0)))))
	case parquet.Types.ByteArray:
		return true
	}
	return false
}

func (t DecimalLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{DECIMAL: t.typ}
}

func (t DecimalLogicalType) Equals(rhs LogicalType) bool {
	other, ok := rhs.(DecimalLogicalType)
	if !ok {
		return false
	}
	return t.typ.Precision == other.typ.Precision && t.typ.Scale == other.typ.Scale
}

// DateLogicalType is an int32 representing the number of days since the Unix Epoch
// 1 January 1970
type DateLogicalType struct{ baseLogicalType }

func (DateLogicalType) SortOrder() SortOrder {
	return SortSIGNED
}

func (DateLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": DateLogicalType{}.String()})
}

func (DateLogicalType) String() string {
	return "Date"
}

func (DateLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.Date, DecimalMetadata{}
}

func (DateLogicalType) IsCompatible(t ConvertedType, dec DecimalMetadata) bool {
	return t == ConvertedTypes.Date && !dec.IsSet
}

func (DateLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.Int32
}

func (DateLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{DATE: format.NewDateType()}
}

func (DateLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(DateLogicalType)
	return ok
}

func timeUnitFromThrift(unit *format.TimeUnit) TimeUnitType {
	switch {
	case unit == nil:
		return TimeUnitUnknown
	case unit.IsSetMILLIS():
		return TimeUnitMillis
	case unit.IsSetMICROS():
		return TimeUnitMicros
	case unit.IsSetNANOS():
		return TimeUnitNanos
	default:
		return TimeUnitUnknown
	}
}

func timeUnitToString(unit *format.TimeUnit) string {
	switch {
	case unit == nil:
		return "unknown"
	case unit.IsSetMILLIS():
		return "milliseconds"
	case unit.IsSetMICROS():
		return "microseconds"
	case unit.IsSetNANOS():
		return "nanoseconds"
	default:
		return "unknown"
	}
}

func timeUnitFromString(v string) TimeUnitType {
	switch v {
	case "millis":
		return TimeUnitMillis
	case "micros":
		return TimeUnitMicros
	case "nanos":
		return TimeUnitNanos
	default:
		return TimeUnitUnknown
	}
}

func createTimeUnit(unit TimeUnitType) *format.TimeUnit {
	tunit := format.NewTimeUnit()
	switch unit {
	case TimeUnitMicros:
		tunit.MICROS = format.NewMicroSeconds()
	case TimeUnitMillis:
		tunit.MILLIS = format.NewMilliSeconds()
	case TimeUnitNanos:
		tunit.NANOS = format.NewNanoSeconds()
	default:
		panic("parquet: time unit must be one of MILLIS, MICROS, or NANOS for Time logical type")
	}
	return tunit
}

// NewTimeLogicalType returns a time type of the given unit.
func NewTimeLogicalType(isAdjustedToUTC bool, unit TimeUnitType) LogicalType {
	return TimeLogicalType{typ: &format.TimeType{
		IsAdjustedToUTC: isAdjustedToUTC,
		Unit:            createTimeUnit(unit),
	}}
}

// TimeLogicalType is a time type without a date and must be an
// int32 for milliseconds, or an int64 for micro or nano seconds.
type TimeLogicalType struct {
	baseLogicalType
	typ *format.TimeType
}

func (t TimeLogicalType) IsAdjustedToUTC() bool {
	return t.typ.IsAdjustedToUTC
}

func (t TimeLogicalType) TimeUnit() TimeUnitType {
	return timeUnitFromThrift(t.typ.Unit)
}

func (TimeLogicalType) SortOrder() SortOrder {
	return SortSIGNED
}

func (t TimeLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"Type": "Time", "isAdjustedToUTC": t.typ.IsAdjustedToUTC, "timeUnit": timeUnitToString(t.typ.GetUnit())})
}

func (t TimeLogicalType) String() string {
	return fmt.Sprintf("Time(isAdjustedToUTC=%t, timeUnit=%s)", t.typ.GetIsAdjustedToUTC(), timeUnitToString(t.typ.GetUnit()))
}

func (t TimeLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	unit := timeUnitFromThrift(t.typ.Unit)
	if t.typ.IsAdjustedToUTC {
		switch unit {
		case TimeUnitMillis:
			return ConvertedTypes.TimeMillis, DecimalMetadata{}
		case TimeUnitMicros:
			return ConvertedTypes.TimeMicros, DecimalMetadata{}
		}
	}
	return ConvertedTypes.None, DecimalMetadata{}
}

func (t TimeLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}
	unit := timeUnitFromThrift(t.typ.Unit)
	if t.typ.IsAdjustedToUTC {
		switch unit {
		case TimeUnitMillis:
			return c == ConvertedTypes.TimeMillis
		case TimeUnitMicros:
			return c == ConvertedTypes.TimeMicros
		}
	}

	return c == ConvertedTypes.None || c == ConvertedTypes.NA
}

func (t TimeLogicalType) IsApplicable(typ parquet.Type, _ int32) bool {
	return (typ == parquet.Types.Int32 && t.typ.GetUnit().IsSetMILLIS()) ||
		(typ == parquet.Types.Int64 &&
			(t.typ.GetUnit().IsSetMICROS() || t.typ.GetUnit().IsSetNANOS()))
}

func (t TimeLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{TIME: t.typ}
}

func (t TimeLogicalType) Equals(rhs LogicalType) bool {
	other, ok := rhs.(TimeLogicalType)
	if !ok {
		return false
	}
	return t.typ.IsAdjustedToUTC == other.typ.IsAdjustedToUTC &&
		timeUnitFromThrift(t.typ.Unit) == timeUnitFromThrift(other.typ.Unit)
}

// NewTimestampLogicalType returns a logical timestamp type with "forceConverted"
// set to false
func NewTimestampLogicalType(isAdjustedToUTC bool, unit TimeUnitType) LogicalType {
	return TimestampLogicalType{
		typ: &format.TimestampType{
			IsAdjustedToUTC: isAdjustedToUTC,
			Unit:            createTimeUnit(unit),
		},
		forceConverted: false,
		fromConverted:  false,
	}
}

// NewTimestampLogicalTypeForce returns a timestamp logical type with
// "forceConverted" set to true
func NewTimestampLogicalTypeForce(isAdjustedToUTC bool, unit TimeUnitType) LogicalType {
	return TimestampLogicalType{
		typ: &format.TimestampType{
			IsAdjustedToUTC: isAdjustedToUTC,
			Unit:            createTimeUnit(unit),
		},
		forceConverted: true,
		fromConverted:  false,
	}
}

// TimestampOpt options used with New Timestamp Logical Type
type TimestampOpt func(*TimestampLogicalType)

// WithTSIsAdjustedToUTC sets the IsAdjustedToUTC field of the timestamp type.
func WithTSIsAdjustedToUTC() TimestampOpt {
	return func(t *TimestampLogicalType) {
		t.typ.IsAdjustedToUTC = true
	}
}

// WithTSTimeUnitType sets the time unit for the timestamp type
func WithTSTimeUnitType(unit TimeUnitType) TimestampOpt {
	return func(t *TimestampLogicalType) {
		t.typ.Unit = createTimeUnit(unit)
	}
}

// WithTSForceConverted enable force converted mode
func WithTSForceConverted() TimestampOpt {
	return func(t *TimestampLogicalType) {
		t.forceConverted = true
	}
}

// WithTSFromConverted enable the timestamp logical type to be
// constructed from a converted type.
func WithTSFromConverted() TimestampOpt {
	return func(t *TimestampLogicalType) {
		t.fromConverted = true
	}
}

// NewTimestampLogicalTypeWithOpts creates a new TimestampLogicalType with the provided options.
//
// TimestampType Unit defaults to milliseconds (TimeUnitMillis)
func NewTimestampLogicalTypeWithOpts(opts ...TimestampOpt) LogicalType {
	ts := TimestampLogicalType{
		typ: &format.TimestampType{
			Unit: createTimeUnit(TimeUnitMillis), // default to milliseconds
		},
	}

	for _, o := range opts {
		o(&ts)
	}

	return ts
}

// TimestampLogicalType represents an int64 number that can be decoded
// into a year, month, day, hour, minute, second, and subsecond
type TimestampLogicalType struct {
	baseLogicalType
	typ *format.TimestampType
	// forceConverted denotes whether or not the resulting serialized
	// type when writing to parquet will be written as the legacy
	// ConvertedType TIMESTAMP_MICROS/TIMESTAMP_MILLIS (true)
	// or if it will write the proper current Logical Types (false, default)
	forceConverted bool
	// fromConverted denotes if the timestamp type was created by
	// translating a legacy converted type of TIMESTAMP_MILLIS or
	// TIMESTAMP_MICROS rather than by using the current logical
	// types. Default is false.
	fromConverted bool
}

func (t TimestampLogicalType) IsFromConvertedType() bool {
	return t.fromConverted
}

func (t TimestampLogicalType) IsAdjustedToUTC() bool {
	return t.typ.IsAdjustedToUTC
}

func (t TimestampLogicalType) TimeUnit() TimeUnitType {
	return timeUnitFromThrift(t.typ.Unit)
}

func (TimestampLogicalType) SortOrder() SortOrder {
	return SortSIGNED
}

func (t TimestampLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"Type":                     "Timestamp",
		"isAdjustedToUTC":          t.typ.IsAdjustedToUTC,
		"timeUnit":                 timeUnitToString(t.typ.GetUnit()),
		"is_from_converted_type":   t.fromConverted,
		"force_set_converted_type": t.forceConverted,
	})
}

func (t TimestampLogicalType) IsSerialized() bool {
	return !t.fromConverted
}

func (t TimestampLogicalType) String() string {
	return fmt.Sprintf("Timestamp(isAdjustedToUTC=%t, timeUnit=%s, is_from_converted_type=%t, force_set_converted_type=%t)",
		t.typ.GetIsAdjustedToUTC(), timeUnitToString(t.typ.GetUnit()), t.fromConverted, t.forceConverted)
}

func (t TimestampLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	unit := timeUnitFromThrift(t.typ.Unit)
	if t.typ.IsAdjustedToUTC || t.forceConverted {
		switch unit {
		case TimeUnitMillis:
			return ConvertedTypes.TimestampMillis, DecimalMetadata{}
		case TimeUnitMicros:
			return ConvertedTypes.TimestampMicros, DecimalMetadata{}
		}
	}
	return ConvertedTypes.None, DecimalMetadata{}
}

func (t TimestampLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}

	switch timeUnitFromThrift(t.typ.Unit) {
	case TimeUnitMillis:
		if t.typ.GetIsAdjustedToUTC() || t.forceConverted {
			return c == ConvertedTypes.TimestampMillis
		}
	case TimeUnitMicros:
		if t.typ.GetIsAdjustedToUTC() || t.forceConverted {
			return c == ConvertedTypes.TimestampMicros
		}
	}

	return c == ConvertedTypes.None || c == ConvertedTypes.NA
}

func (TimestampLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.Int64
}

func (t TimestampLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{TIMESTAMP: t.typ}
}

func (t TimestampLogicalType) Equals(rhs LogicalType) bool {
	other, ok := rhs.(TimestampLogicalType)
	if !ok {
		return false
	}
	return t.typ.IsAdjustedToUTC == other.typ.IsAdjustedToUTC &&
		timeUnitFromThrift(t.typ.Unit) == timeUnitFromThrift(other.typ.Unit)
}

// NewIntLogicalType creates an integer logical type of the desired bitwidth
// and whether it is signed or not.
//
// Bit width must be exactly 8, 16, 32 or 64 for an integer logical type
func NewIntLogicalType(bitWidth int8, signed bool) LogicalType {
	switch bitWidth {
	case 8, 16, 32, 64:
	default:
		panic("parquet: bit width must be exactly 8, 16, 32, or 64 for Int logical type")
	}
	return IntLogicalType{
		typ: &format.IntType{
			BitWidth: bitWidth,
			IsSigned: signed,
		},
	}
}

// IntLogicalType represents an integer type of a specific bit width and
// is either signed or unsigned.
type IntLogicalType struct {
	baseLogicalType
	typ *format.IntType
}

func (t IntLogicalType) BitWidth() int8 {
	return t.typ.BitWidth
}

func (t IntLogicalType) IsSigned() bool {
	return t.typ.IsSigned
}

func (t IntLogicalType) SortOrder() SortOrder {
	if t.typ.IsSigned {
		return SortSIGNED
	}
	return SortUNSIGNED
}

func (t IntLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"Type": "Int", "bitWidth": t.typ.BitWidth, "isSigned": t.typ.IsSigned,
	})
}

func (t IntLogicalType) String() string {
	return fmt.Sprintf("Int(bitWidth=%d, isSigned=%t)", t.typ.GetBitWidth(), t.typ.GetIsSigned())
}

func (t IntLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	var d DecimalMetadata
	if t.typ.IsSigned {
		switch t.typ.BitWidth {
		case 8:
			return ConvertedTypes.Int8, d
		case 16:
			return ConvertedTypes.Int16, d
		case 32:
			return ConvertedTypes.Int32, d
		case 64:
			return ConvertedTypes.Int64, d
		}
	} else {
		switch t.typ.BitWidth {
		case 8:
			return ConvertedTypes.Uint8, d
		case 16:
			return ConvertedTypes.Uint16, d
		case 32:
			return ConvertedTypes.Uint32, d
		case 64:
			return ConvertedTypes.Uint64, d
		}
	}
	return ConvertedTypes.None, d
}

func (t IntLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}
	v, _ := t.ToConvertedType()
	return c == v
}

func (t IntLogicalType) IsApplicable(typ parquet.Type, _ int32) bool {
	return (typ == parquet.Types.Int32 && t.typ.GetBitWidth() <= 32) ||
		(typ == parquet.Types.Int64 && t.typ.GetBitWidth() == 64)
}

func (t IntLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{INTEGER: t.typ}
}

func (t IntLogicalType) Equals(rhs LogicalType) bool {
	other, ok := rhs.(IntLogicalType)
	if !ok {
		return false
	}

	return t.typ.GetIsSigned() == other.typ.GetIsSigned() &&
		t.typ.GetBitWidth() == other.typ.GetBitWidth()
}

// UnknownLogicalType is a type that is essentially a placeholder for when
// we don't know the type.
type UnknownLogicalType struct{ baseLogicalType }

func (UnknownLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (UnknownLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": UnknownLogicalType{}.String()})
}

func (UnknownLogicalType) IsValid() bool { return false }

func (UnknownLogicalType) IsSerialized() bool { return false }

func (UnknownLogicalType) String() string {
	return "Unknown"
}

func (UnknownLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.NA, DecimalMetadata{}
}

func (UnknownLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.NA && !dec.IsSet
}

func (UnknownLogicalType) IsApplicable(parquet.Type, int32) bool { return true }

func (UnknownLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{UNKNOWN: format.NewNullType()}
}

func (UnknownLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(UnknownLogicalType)
	return ok
}

// JSONLogicalType represents a byte array column which is to be interpreted
// as a JSON string.
type JSONLogicalType struct{ baseLogicalType }

func (JSONLogicalType) SortOrder() SortOrder {
	return SortUNSIGNED
}

func (JSONLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": JSONLogicalType{}.String()})
}

func (JSONLogicalType) String() string {
	return "JSON"
}

func (JSONLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.JSON, DecimalMetadata{}
}

func (JSONLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.JSON && !dec.IsSet
}

func (JSONLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.ByteArray
}

func (JSONLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{JSON: format.NewJsonType()}
}

func (JSONLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(JSONLogicalType)
	return ok
}

// BSONLogicalType represents a binary JSON string in the byte array
type BSONLogicalType struct{ baseLogicalType }

func (BSONLogicalType) SortOrder() SortOrder {
	return SortUNSIGNED
}

func (BSONLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": BSONLogicalType{}.String()})
}

func (BSONLogicalType) String() string {
	return "BSON"
}

func (BSONLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.BSON, DecimalMetadata{}
}

func (BSONLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.BSON && !dec.IsSet
}

func (BSONLogicalType) IsApplicable(t parquet.Type, _ int32) bool {
	return t == parquet.Types.ByteArray
}

func (BSONLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{BSON: format.NewBsonType()}
}

func (BSONLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(BSONLogicalType)
	return ok
}

// UUIDLogicalType can only be used with a FixedLength byte array column
// that is exactly 16 bytes long
type UUIDLogicalType struct{ baseLogicalType }

func (UUIDLogicalType) SortOrder() SortOrder {
	return SortUNSIGNED
}

func (UUIDLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": UUIDLogicalType{}.String()})
}

func (UUIDLogicalType) String() string {
	return "UUID"
}

func (UUIDLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.None, DecimalMetadata{}
}

func (UUIDLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}
	switch c {
	case ConvertedTypes.None, ConvertedTypes.NA:
		return true
	}
	return false
}

func (UUIDLogicalType) IsApplicable(t parquet.Type, tlen int32) bool {
	return t == parquet.Types.FixedLenByteArray && tlen == 16
}

func (UUIDLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{UUID: format.NewUUIDType()}
}

func (UUIDLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(UUIDLogicalType)
	return ok
}

// IntervalLogicalType is not yet in the thrift spec, but represents
// an interval time and needs to be a fixed length byte array of 12 bytes
type IntervalLogicalType struct{ baseLogicalType }

func (IntervalLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (IntervalLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": IntervalLogicalType{}.String()})
}

func (IntervalLogicalType) String() string {
	return "Interval"
}

func (IntervalLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.Interval, DecimalMetadata{}
}

func (IntervalLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.Interval && !dec.IsSet
}

func (IntervalLogicalType) IsApplicable(t parquet.Type, tlen int32) bool {
	return t == parquet.Types.FixedLenByteArray && tlen == 12
}

func (IntervalLogicalType) toThrift() *format.LogicalType {
	panic("no parquet IntervalLogicalType yet implemented")
}

func (IntervalLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(IntervalLogicalType)
	return ok
}

// Float16LogicalType can only be used with a FixedLength byte array column
// that is exactly 2 bytes long
type Float16LogicalType struct{ baseLogicalType }

func (Float16LogicalType) SortOrder() SortOrder {
	return SortSIGNED
}

func (Float16LogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": Float16LogicalType{}.String()})
}

func (Float16LogicalType) String() string {
	return "Float16"
}

func (Float16LogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.None, DecimalMetadata{}
}

func (Float16LogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}
	switch c {
	case ConvertedTypes.None, ConvertedTypes.NA:
		return true
	}
	return false
}

func (Float16LogicalType) IsApplicable(t parquet.Type, tlen int32) bool {
	return t == parquet.Types.FixedLenByteArray && tlen == 2
}

func (Float16LogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{FLOAT16: format.NewFloat16Type()}
}

func (Float16LogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(Float16LogicalType)
	return ok
}

type VariantLogicalType struct{ baseLogicalType }

func (VariantLogicalType) IsNested() bool { return true }

func (VariantLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (VariantLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": VariantLogicalType{}.String()})
}

func (VariantLogicalType) String() string {
	return "Variant"
}

func (VariantLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.None, DecimalMetadata{}
}

func (VariantLogicalType) IsCompatible(ct ConvertedType, _ DecimalMetadata) bool {
	return ct == ConvertedTypes.None
}

func (VariantLogicalType) IsApplicable(parquet.Type, int32) bool { return false }

func (VariantLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{VARIANT: format.NewVariantType()}
}

func (VariantLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(VariantLogicalType)
	return ok
}

type NullLogicalType struct{ baseLogicalType }

func (NullLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (NullLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": NullLogicalType{}.String()})
}

func (NullLogicalType) String() string {
	return "Null"
}

func (NullLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.None, DecimalMetadata{}
}

func (NullLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	if dec.IsSet {
		return false
	}
	switch c {
	case ConvertedTypes.None, ConvertedTypes.NA:
		return true
	}
	return false
}

func (NullLogicalType) IsApplicable(parquet.Type, int32) bool {
	return true
}

func (NullLogicalType) toThrift() *format.LogicalType {
	return &format.LogicalType{UNKNOWN: format.NewNullType()}
}

func (NullLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(NullLogicalType)
	return ok
}

type NoLogicalType struct{ baseLogicalType }

func (NoLogicalType) SortOrder() SortOrder {
	return SortUNKNOWN
}

func (NoLogicalType) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"Type": NoLogicalType{}.String()})
}

func (NoLogicalType) IsSerialized() bool { return false }

func (NoLogicalType) String() string {
	return "None"
}

func (NoLogicalType) ToConvertedType() (ConvertedType, DecimalMetadata) {
	return ConvertedTypes.None, DecimalMetadata{}
}

func (NoLogicalType) IsCompatible(c ConvertedType, dec DecimalMetadata) bool {
	return c == ConvertedTypes.None && !dec.IsSet
}

func (NoLogicalType) IsApplicable(parquet.Type, int32) bool {
	return true
}

func (NoLogicalType) toThrift() *format.LogicalType {
	panic("cannot convert NoLogicalType to thrift")
}

func (NoLogicalType) Equals(rhs LogicalType) bool {
	_, ok := rhs.(NoLogicalType)
	return ok
}

func (NoLogicalType) IsNone() bool { return true }
