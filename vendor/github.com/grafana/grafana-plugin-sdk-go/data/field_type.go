package data

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"
)

// FieldType indicates the Go type underlying the Field.
type FieldType int

const (
	// FieldTypeUnknown indicates that we do not know the field type
	FieldTypeUnknown FieldType = iota

	// FieldTypeInt8 indicates the underlying primitive is a []int8.
	FieldTypeInt8
	// FieldTypeNullableInt8 indicates the underlying primitive is a []*int8.
	FieldTypeNullableInt8

	// FieldTypeInt16 indicates the underlying primitive is a []int16.
	FieldTypeInt16
	// FieldTypeNullableInt16 indicates the underlying primitive is a []*int16.
	FieldTypeNullableInt16

	// FieldTypeInt32 indicates the underlying primitive is a []int32.
	FieldTypeInt32
	// FieldTypeNullableInt32 indicates the underlying primitive is a []*int32.
	FieldTypeNullableInt32

	// FieldTypeInt64 indicates the underlying primitive is a []int64.
	FieldTypeInt64
	// FieldTypeNullableInt64 indicates the underlying primitive is a []*int64.
	FieldTypeNullableInt64

	// FieldTypeUint8 indicates the underlying primitive is a []uint8.
	FieldTypeUint8
	// FieldTypeNullableUint8 indicates the underlying primitive is a []*uint8.
	FieldTypeNullableUint8

	// FieldTypeUint16 indicates the underlying primitive is a []uint16.
	FieldTypeUint16
	// FieldTypeNullableUint16 indicates the underlying primitive is a []*uint16.
	FieldTypeNullableUint16

	// FieldTypeUint32 indicates the underlying primitive is a []uint32.
	FieldTypeUint32
	// FieldTypeNullableUint32 indicates the underlying primitive is a []*uint32.
	FieldTypeNullableUint32

	// FieldTypeUint64 indicates the underlying primitive is a []uint64.
	FieldTypeUint64
	// FieldTypeNullableUint64 indicates the underlying primitive is a []*uint64.
	FieldTypeNullableUint64

	// FieldTypeFloat32 indicates the underlying primitive is a []float32.
	FieldTypeFloat32
	// FieldTypeNullableFloat32 indicates the underlying primitive is a []*float32.
	FieldTypeNullableFloat32

	// FieldTypeFloat64 indicates the underlying primitive is a []float64.
	FieldTypeFloat64
	// FieldTypeNullableFloat64 indicates the underlying primitive is a []*float64.
	FieldTypeNullableFloat64

	// FieldTypeString indicates the underlying primitive is a []string.
	FieldTypeString
	// FieldTypeNullableString indicates the underlying primitive is a []*string.
	FieldTypeNullableString

	// FieldTypeBool indicates the underlying primitive is a []bool.
	FieldTypeBool
	// FieldTypeNullableBool indicates the underlying primitive is a []*bool.
	FieldTypeNullableBool

	// FieldTypeTime indicates the underlying primitive is a []time.Time.
	FieldTypeTime
	// FieldTypeNullableTime indicates the underlying primitive is a []*time.Time.
	FieldTypeNullableTime

	// FieldTypeJSON indicates the underlying primitive is a []json.RawMessage.
	FieldTypeJSON

	// FieldTypeNullableJSON indicates the underlying primitive is a []*json.RawMessage.
	// Deprecated: Use FieldTypeJSON, an array can be null anyway
	FieldTypeNullableJSON

	// FieldTypeEnum indicates the underlying primitive is a []data.EnumItemIndex, with field mapping metadata
	FieldTypeEnum
	// FieldTypeNullableEnum indicates the underlying primitive is a []*data.EnumItemIndex, with field mapping metadata
	FieldTypeNullableEnum
)

// MarshalJSON marshals the enum as a quoted json string
func (p FieldType) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBufferString(`"`)
	buffer.WriteString(p.ItemTypeString())
	buffer.WriteString(`"`)
	return buffer.Bytes(), nil
}

// UnmarshalJSON unmarshals a quoted json string to the enum value
func (p *FieldType) UnmarshalJSON(b []byte) error {
	var j string
	err := json.Unmarshal(b, &j)
	if err != nil {
		return err
	}

	f, ok := FieldTypeFromItemTypeString(j)
	if !ok {
		return fmt.Errorf("unknown field type: %s", j)
	}
	*p = f
	return nil
}

// FieldTypeFor will return the FieldType that holds items of item's type.
// If the FieldType is not recognized, FieldTypeUnknown is returned.
// For example, for an item of type *int8, FieldTypeNullableInt8 will be returned.
// nolint:gocyclo
func FieldTypeFor(item interface{}) FieldType {
	switch item.(type) {
	case int8:
		return FieldTypeInt8
	case *int8:
		return FieldTypeNullableInt8

	case int16:
		return FieldTypeInt16
	case *int16:
		return FieldTypeNullableInt16
	case int32:
		return FieldTypeInt32
	case *int32:
		return FieldTypeNullableInt32

	case int64:
		return FieldTypeInt64
	case *int64:
		return FieldTypeNullableInt64

	// uints
	case uint8:
		return FieldTypeUint8
	case *uint8:
		return FieldTypeNullableUint8

	case uint16:
		return FieldTypeUint16
	case *uint16:
		return FieldTypeNullableUint16

	case uint32:
		return FieldTypeUint32
	case *uint32:
		return FieldTypeNullableUint32

	case uint64:
		return FieldTypeUint64
	case *uint64:
		return FieldTypeNullableUint64

	// floats
	case float32:
		return FieldTypeFloat32
	case *float32:
		return FieldTypeNullableFloat32

	case float64:
		return FieldTypeFloat64
	case *float64:
		return FieldTypeNullableFloat64

	// string and bool
	case bool:
		return FieldTypeBool
	case *bool:
		return FieldTypeNullableBool

	case string:
		return FieldTypeString
	case *string:
		return FieldTypeNullableString

	// others
	case time.Time:
		return FieldTypeTime
	case *time.Time:
		return FieldTypeNullableTime

	case json.RawMessage:
		return FieldTypeJSON
	case *json.RawMessage:
		return FieldTypeNullableJSON

	case EnumItemIndex:
		return FieldTypeEnum
	case *EnumItemIndex:
		return FieldTypeNullableEnum
	}

	return FieldTypeUnknown
}

// NullableType converts the FieldType to the corresponding nullable type.
// Calling this on FieldTypeUnknown will panic.
func (p FieldType) NullableType() FieldType {
	switch p {
	// ints
	case FieldTypeInt8, FieldTypeNullableInt8:
		return FieldTypeNullableInt8

	case FieldTypeInt16, FieldTypeNullableInt16:
		return FieldTypeNullableInt16

	case FieldTypeInt32, FieldTypeNullableInt32:
		return FieldTypeNullableInt32

	case FieldTypeInt64, FieldTypeNullableInt64:
		return FieldTypeNullableInt64

	// uints
	case FieldTypeUint8, FieldTypeNullableUint8:
		return FieldTypeNullableUint8

	case FieldTypeUint16, FieldTypeNullableUint16:
		return FieldTypeNullableUint16

	case FieldTypeUint32, FieldTypeNullableUint32:
		return FieldTypeNullableUint32

	case FieldTypeUint64, FieldTypeNullableUint64:
		return FieldTypeNullableUint64

	// floats
	case FieldTypeFloat32, FieldTypeNullableFloat32:
		return FieldTypeNullableFloat32

	case FieldTypeFloat64, FieldTypeNullableFloat64:
		return FieldTypeNullableFloat64

	// other
	case FieldTypeString, FieldTypeNullableString:
		return FieldTypeNullableString

	case FieldTypeBool, FieldTypeNullableBool:
		return FieldTypeNullableBool

	case FieldTypeTime, FieldTypeNullableTime:
		return FieldTypeNullableTime

	case FieldTypeJSON, FieldTypeNullableJSON:
		return FieldTypeNullableJSON

	case FieldTypeEnum, FieldTypeNullableEnum:
		return FieldTypeNullableEnum

	default:
		panic(fmt.Sprintf("unsupported vector ptype: %+v", p))
	}
}

// NonNullableType converts the FieldType to the corresponding not-nullable type.
// Calling this on FieldTypeUnknown will panic.
func (p FieldType) NonNullableType() FieldType {
	switch p {
	// ints
	case FieldTypeInt8, FieldTypeNullableInt8:
		return FieldTypeInt8

	case FieldTypeInt16, FieldTypeNullableInt16:
		return FieldTypeInt16

	case FieldTypeInt32, FieldTypeNullableInt32:
		return FieldTypeInt32

	case FieldTypeInt64, FieldTypeNullableInt64:
		return FieldTypeInt64

	// uints
	case FieldTypeUint8, FieldTypeNullableUint8:
		return FieldTypeUint8

	case FieldTypeUint16, FieldTypeNullableUint16:
		return FieldTypeUint16

	case FieldTypeUint32, FieldTypeNullableUint32:
		return FieldTypeUint32

	case FieldTypeUint64, FieldTypeNullableUint64:
		return FieldTypeUint64

	// floats
	case FieldTypeFloat32, FieldTypeNullableFloat32:
		return FieldTypeFloat32

	case FieldTypeFloat64, FieldTypeNullableFloat64:
		return FieldTypeFloat64

	// other
	case FieldTypeString, FieldTypeNullableString:
		return FieldTypeString

	case FieldTypeBool, FieldTypeNullableBool:
		return FieldTypeBool

	case FieldTypeTime, FieldTypeNullableTime:
		return FieldTypeTime

	case FieldTypeJSON, FieldTypeNullableJSON:
		return FieldTypeJSON

	case FieldTypeEnum, FieldTypeNullableEnum:
		return FieldTypeEnum
	default:
		panic(fmt.Sprintf("unsupported vector ptype: %+v", p))
	}
}

// FieldTypeFromItemTypeString returns a field type from the current string
//
//nolint:goconst,gocyclo
func FieldTypeFromItemTypeString(s string) (FieldType, bool) {
	switch s {
	case "int8":
		return FieldTypeInt8, true
	case "*int8":
		return FieldTypeNullableInt8, true

	case "int16":
		return FieldTypeInt16, true
	case "*int16":
		return FieldTypeNullableInt16, true

	case "int32":
		return FieldTypeInt32, true
	case "*int32":
		return FieldTypeNullableInt32, true

	case "int", "int64":
		return FieldTypeInt64, true
	case "*int64":
		return FieldTypeNullableInt64, true

	case "uint8":
		return FieldTypeUint8, true
	case "*uint8":
		return FieldTypeNullableUint8, true

	case "uint16":
		return FieldTypeUint16, true
	case "*uint16":
		return FieldTypeNullableUint16, true

	case "uint32":
		return FieldTypeUint32, true
	case "*uint32":
		return FieldTypeNullableUint32, true

	case "uint64":
		return FieldTypeUint64, true
	case "*uint64":
		return FieldTypeNullableUint64, true

	case "float32":
		return FieldTypeFloat32, true
	case "*float32":
		return FieldTypeNullableFloat32, true

	case "double", "float", "float64":
		return FieldTypeFloat64, true
	case "*float64":
		return FieldTypeNullableFloat64, true

	case "string":
		return FieldTypeString, true
	case "*string":
		return FieldTypeNullableString, true

	case "bool", "boolean":
		return FieldTypeBool, true
	case "*bool":
		return FieldTypeNullableBool, true

	case "time", "time.Time":
		return FieldTypeTime, true
	case "*time.Time":
		return FieldTypeNullableTime, true

	case "json", "json.RawMessage":
		return FieldTypeJSON, true
	case "*json.RawMessage":
		return FieldTypeNullableJSON, true

	case "enum":
		return FieldTypeEnum, true
	case "*enum":
		return FieldTypeNullableEnum, true
	}

	return FieldTypeNullableString, false
}

// ItemTypeString returns the string representation of the type of element within in the vector
// nolint:gocyclo
func (p FieldType) ItemTypeString() string {
	switch p {
	case FieldTypeInt8:
		return "int8"
	case FieldTypeNullableInt8:
		return "*int8"

	case FieldTypeInt16:
		return "int16"
	case FieldTypeNullableInt16:
		return "*int16"

	case FieldTypeInt32:
		return "int32"
	case FieldTypeNullableInt32:
		return "*int32"

	case FieldTypeInt64:
		return "int64"
	case FieldTypeNullableInt64:
		return "*int64"

	case FieldTypeUint8:
		return "uint8"
	case FieldTypeNullableUint8:
		return "*uint8"

	case FieldTypeUint16:
		return "uint16"
	case FieldTypeNullableUint16:
		return "*uint16"

	case FieldTypeUint32:
		return "uint32"
	case FieldTypeNullableUint32:
		return "*uint32"

	case FieldTypeUint64:
		return "uint64"
	case FieldTypeNullableUint64:
		return "*uint64"

	case FieldTypeFloat32:
		return "float32"
	case FieldTypeNullableFloat32:
		return "*float32"

	case FieldTypeFloat64:
		return "float64"
	case FieldTypeNullableFloat64:
		return "*float64"

	case FieldTypeString:
		return "string"
	case FieldTypeNullableString:
		return "*string"

	case FieldTypeBool:
		return "bool"
	case FieldTypeNullableBool:
		return "*bool"

	case FieldTypeTime:
		return "time.Time"
	case FieldTypeNullableTime:
		return "*time.Time"

	case FieldTypeJSON:
		return "json.RawMessage"
	case FieldTypeNullableJSON:
		return "*json.RawMessage"

	// Non-standard field type
	case FieldTypeEnum:
		return "enum"
	case FieldTypeNullableEnum:
		return "*enum"
	}
	return "invalid/unsupported type"
}

// ValidFieldType returns if a primitive slice is a valid supported Field type.
func ValidFieldType(t interface{}) bool {
	switch t.(type) {
	// ints
	case []int8:
		return true
	case []*int8:
		return true
	case []int16:
		return true
	case []*int16:
		return true
	case []int32:
		return true
	case []*int32:
		return true
	case []int64:
		return true
	case []*int64:
		return true

	// uints
	case []uint8:
		return true
	case []*uint8:
		return true
	case []uint16:
		return true
	case []*uint16:
		return true
	case []uint32:
		return true
	case []*uint32:
		return true
	case []uint64:
		return true
	case []*uint64:
		return true

	// floats
	case []float32:
		return true
	case []*float32:
		return true
	case []float64:
		return true
	case []*float64:
		return true

	case []string:
		return true
	case []*string:
		return true
	case []bool:
		return true
	case []*bool:
		return true
	case []time.Time:
		return true
	case []*time.Time:
		return true
	case []json.RawMessage:
		return true
	case []*json.RawMessage:
		return true
	default:
		return false
	}
}

// Nullable returns true if the field type is nullable
func (p FieldType) Nullable() bool {
	return p.NullableType() == p
}

// Numeric returns true if the field type is numeric
func (p FieldType) Numeric() bool {
	switch p {
	case FieldTypeInt8, FieldTypeInt16, FieldTypeInt32, FieldTypeInt64:
		return true
	case FieldTypeNullableInt8, FieldTypeNullableInt16, FieldTypeNullableInt32, FieldTypeNullableInt64:
		return true

	case FieldTypeUint8, FieldTypeUint16, FieldTypeUint32, FieldTypeUint64:
		return true
	case FieldTypeNullableUint8, FieldTypeNullableUint16, FieldTypeNullableUint32, FieldTypeNullableUint64:
		return true

	case FieldTypeFloat32, FieldTypeFloat64:
		return true
	case FieldTypeNullableFloat32, FieldTypeNullableFloat64:
		return true
	}
	return false
}

// Time returns if Field type is a time type (FieldTypeTime or FieldTypeNullableTime).
func (p FieldType) Time() bool {
	return p == FieldTypeTime || p == FieldTypeNullableTime
}

// JSON returns if Field type is a json type (FieldTypeJSON or FieldTypeNullableJSON).
func (p FieldType) JSON() bool {
	return p == FieldTypeJSON || p == FieldTypeNullableJSON
}

// numericFieldTypes is an array of FieldTypes that are numeric.
var numericFieldTypes = [...]FieldType{
	FieldTypeInt8, FieldTypeInt16, FieldTypeInt32, FieldTypeInt64,
	FieldTypeNullableInt8, FieldTypeNullableInt16, FieldTypeNullableInt32, FieldTypeNullableInt64,

	FieldTypeUint8, FieldTypeUint16, FieldTypeUint32, FieldTypeUint64,
	FieldTypeNullableUint8, FieldTypeNullableUint16, FieldTypeNullableUint32, FieldTypeNullableUint64,

	FieldTypeFloat32, FieldTypeFloat64,
	FieldTypeNullableFloat32, FieldTypeNullableFloat64}

// NumericFieldTypes returns a slice of FieldTypes that are numeric.
func NumericFieldTypes() []FieldType {
	return numericFieldTypes[:]
}
