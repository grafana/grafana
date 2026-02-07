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

package extensions

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"reflect"
	"strings"
	"sync"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"github.com/apache/arrow-go/v18/parquet/variant"
	"github.com/google/uuid"
)

// VariantType is the arrow extension type for representing Variant values as
// defined by the Parquet Variant specification for encoding and shredding values.
// The underlying storage must be a struct type with a minimum of two fields
// ("metadata" and "value") and an optional third field ("typed_value").
//
// See the documentation for [NewVariantType] for the rules for creating a variant
// type.
type VariantType struct {
	arrow.ExtensionBase

	metadataFieldIdx   int
	valueFieldIdx      int
	typedValueFieldIdx int
}

// NewDefaultVariantType creates a basic, non-shredded variant type. The underlying
// storage type will be struct<metadata: binary non-null, value: binary non-null>.
func NewDefaultVariantType() *VariantType {
	s := arrow.StructOf(
		arrow.Field{Name: "metadata", Type: arrow.BinaryTypes.Binary, Nullable: false},
		arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: false})

	vt, _ := NewVariantType(s)
	return vt
}

func createShreddedField(dt arrow.DataType) arrow.DataType {
	switch t := dt.(type) {
	case arrow.ListLikeType:
		return arrow.ListOfNonNullable(arrow.StructOf(
			arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: true},
			arrow.Field{Name: "typed_value", Type: createShreddedField(t.Elem()), Nullable: true},
		))
	case *arrow.StructType:
		fields := make([]arrow.Field, 0, t.NumFields())
		for i := range t.NumFields() {
			f := t.Field(i)
			fields = append(fields, arrow.Field{
				Name: f.Name,
				Type: arrow.StructOf(arrow.Field{
					Name:     "value",
					Type:     arrow.BinaryTypes.Binary,
					Nullable: true,
				}, arrow.Field{
					Name:     "typed_value",
					Type:     createShreddedField(f.Type),
					Nullable: true,
				}),
				Nullable: false,
				Metadata: f.Metadata,
			})
		}
		return arrow.StructOf(fields...)
	default:
		return dt
	}
}

// NewShreddedVariantType creates a new VariantType extension type using the provided
// type to define a shredded schema by setting the `typed_value` field accordingly and
// properly constructing the shredded fields for structs, lists and so on.
//
// For example:
//
//	NewShreddedVariantType(arrow.StructOf(
//	     arrow.Field{Name: "latitude", Type: arrow.PrimitiveTypes.Float64},
//	     arrow.Field{Name: "longitude", Type: arrow.PrimitiveTypes.Float32}))
//
// Will create a variant type with the following structure:
//
//	arrow.StructOf(
//	     arrow.Field{Name: "metadata", Type: arrow.BinaryTypes.Binary, Nullable: false},
//	     arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: true},
//	     arrow.Field{Name: "typed_value", Type: arrow.StructOf(
//	       arrow.Field{Name: "latitude", Type: arrow.StructOf(
//	         arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: true},
//	         arrow.Field{Name: "typed_value", Type: arrow.PrimitiveTypes.Float64, Nullable: true}),
//	         Nullable: false},
//	     arrow.Field{Name: "longitude", Type: arrow.StructOf(
//	         arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: true},
//	         arrow.Field{Name: "typed_value", Type: arrow.PrimitiveTypes.Float32, Nullable: true}),
//	         Nullable: false},
//	 ), Nullable: true})
//
// This is intended to be a convenient way to create a shredded variant type from a definition
// of the fields to shred. If the provided data type is nil, it will create a default
// variant type.
func NewShreddedVariantType(dt arrow.DataType) *VariantType {
	if dt == nil {
		return NewDefaultVariantType()
	}

	vt, _ := NewVariantType(arrow.StructOf(
		arrow.Field{Name: "metadata", Type: arrow.BinaryTypes.Binary, Nullable: false},
		arrow.Field{Name: "value", Type: arrow.BinaryTypes.Binary, Nullable: true},
		arrow.Field{
			Name:     "typed_value",
			Type:     createShreddedField(dt),
			Nullable: true,
		}))
	return vt
}

// NewVariantType creates a new variant type based on the provided storage type.
//
// The rules for a variant storage type are:
//  1. MUST be a struct
//  2. MUST have non-nullable field named "metadata" that is binary/largebinary/binary_view
//  3. Must satisfy exactly one of the following:
//     a. MUST have non-nullable field named "value" that is binary/largebinary/binary_view
//     b. MUST have an nullable field named "value" that is binary/largebinary/binary_view
//     and another nullable field named "typed_value" that is either a primitive type or
//     a list/large_list/list_view or struct which also satisfies the following requirements:
//     i. The elements must be NON-NULLABLE
//     ii. There must either be a single NON-NULLABLE field named "value" which is
//     binary/largebinary/binary_view or have an nullable "value" field and an nullable
//     "typed_value" field that follows the rules laid out in (b).
//
// The metadata field may also be dictionary encoded
func NewVariantType(storage arrow.DataType) (*VariantType, error) {
	s, ok := storage.(*arrow.StructType)
	if !ok {
		return nil, fmt.Errorf("%w: bad storage type %s for variant type", arrow.ErrInvalid, storage)
	}

	var (
		metadataFieldIdx   = -1
		valueFieldIdx      = -1
		typedValueFieldIdx = -1
	)

	if metadataFieldIdx, ok = s.FieldIdx("metadata"); !ok {
		return nil, fmt.Errorf("%w: missing non-nullable field 'metadata' in variant storage type %s", arrow.ErrInvalid, storage)
	}

	var valueOk, typedValueOk bool
	valueFieldIdx, valueOk = s.FieldIdx("value")
	typedValueFieldIdx, typedValueOk = s.FieldIdx("typed_value")

	if !valueOk && !typedValueOk {
		return nil, fmt.Errorf("%w: there must be at least one of 'value' or 'typed_value' fields in variant storage type %s", arrow.ErrInvalid, storage)
	}

	if s.NumFields() == 3 && (!valueOk || !typedValueOk) {
		return nil, fmt.Errorf("%w: has 3 fields, but missing one of 'value' or 'typed_value' fields, %s", arrow.ErrInvalid, storage)
	}

	if s.NumFields() > 3 {
		return nil, fmt.Errorf("%w: too many fields in variant storage type %s, expected 2 or 3", arrow.ErrInvalid, storage)
	}

	mdField := s.Field(metadataFieldIdx)
	if mdField.Nullable {
		return nil, fmt.Errorf("%w: metadata field must be non-nullable binary type, got %s", arrow.ErrInvalid, mdField.Type)
	}

	if !isBinary(mdField.Type) {
		if mdField.Type.ID() != arrow.DICTIONARY || !isBinary(mdField.Type.(*arrow.DictionaryType).ValueType) {
			return nil, fmt.Errorf("%w: metadata field must be non-nullable binary type, got %s", arrow.ErrInvalid, mdField.Type)
		}
	}

	if valueOk {
		valField := s.Field(valueFieldIdx)
		if !isBinary(valField.Type) {
			return nil, fmt.Errorf("%w: value field must be binary type, got %s", arrow.ErrInvalid, valField.Type)
		}
	}

	if !typedValueOk {
		return &VariantType{
			ExtensionBase:      arrow.ExtensionBase{Storage: storage},
			metadataFieldIdx:   metadataFieldIdx,
			valueFieldIdx:      valueFieldIdx,
			typedValueFieldIdx: -1,
		}, nil
	}

	typedValueField := s.Field(typedValueFieldIdx)
	if !typedValueField.Nullable {
		return nil, fmt.Errorf("%w: typed_value field must be nullable, got %s", arrow.ErrInvalid, typedValueField.Type)
	}

	dt := typedValueField.Type
	if dt.ID() == arrow.EXTENSION {
		dt = dt.(arrow.ExtensionType).StorageType()
	}

	if nt, ok := dt.(arrow.NestedType); ok {
		if !validNestedType(nt) {
			return nil, fmt.Errorf("%w: typed_value field must be a valid nested type, got %s", arrow.ErrInvalid, typedValueField.Type)
		}
	}

	return &VariantType{
		ExtensionBase:      arrow.ExtensionBase{Storage: storage},
		metadataFieldIdx:   metadataFieldIdx,
		valueFieldIdx:      valueFieldIdx,
		typedValueFieldIdx: typedValueFieldIdx,
	}, nil
}

func (*VariantType) ArrayType() reflect.Type {
	return reflect.TypeOf(VariantArray{})
}

func (v *VariantType) Metadata() arrow.Field {
	return v.StorageType().(*arrow.StructType).Field(v.metadataFieldIdx)
}

func (v *VariantType) Value() arrow.Field {
	if v.valueFieldIdx == -1 {
		return arrow.Field{}
	}
	return v.StorageType().(*arrow.StructType).Field(v.valueFieldIdx)
}

func (v *VariantType) TypedValue() arrow.Field {
	if v.typedValueFieldIdx == -1 {
		return arrow.Field{}
	}

	return v.StorageType().(*arrow.StructType).Field(v.typedValueFieldIdx)
}

func (*VariantType) ExtensionName() string { return "parquet.variant" }

func (v *VariantType) String() string {
	return fmt.Sprintf("extension<%s>", v.ExtensionName())
}

func (v *VariantType) ExtensionEquals(other arrow.ExtensionType) bool {
	return v.ExtensionName() == other.ExtensionName() &&
		arrow.TypeEqual(v.Storage, other.StorageType())
}

func (*VariantType) Serialize() string { return "" }
func (*VariantType) Deserialize(storageType arrow.DataType, _ string) (arrow.ExtensionType, error) {
	return NewVariantType(storageType)
}

func (*VariantType) ParquetLogicalType() schema.LogicalType {
	return schema.VariantLogicalType{}
}

func (v *VariantType) NewBuilder(mem memory.Allocator) array.Builder {
	return NewVariantBuilder(mem, v)
}

func isBinary(dt arrow.DataType) bool {
	return dt.ID() == arrow.BINARY || dt.ID() == arrow.LARGE_BINARY ||
		dt.ID() == arrow.BINARY_VIEW
}

func validStruct(s *arrow.StructType) bool {
	switch s.NumFields() {
	case 1:
		f := s.Field(0)
		return (f.Name == "value" && isBinary(f.Type)) || f.Name == "typed_value"
	case 2:
		valField, ok := s.FieldByName("value")
		if !ok || !valField.Nullable || !isBinary(valField.Type) {
			return false
		}

		typedField, ok := s.FieldByName("typed_value")
		if !ok || !typedField.Nullable {
			return false
		}

		if nt, ok := typedField.Type.(arrow.NestedType); ok && nt.Name() != "extension" {
			return validNestedType(nt)
		}

		return true
	default:
		return false
	}
}

func validNestedType(dt arrow.NestedType) bool {
	switch t := dt.(type) {
	case arrow.ListLikeType:
		if t.ElemField().Nullable {
			return false
		}

		s, ok := t.Elem().(*arrow.StructType)
		if !ok {
			return false
		}

		return validStruct(s)
	case *arrow.StructType:
		if t.NumFields() == 0 {
			return false
		}

		for i := range t.NumFields() {
			f := t.Field(i)
			if f.Nullable {
				return false
			}

			s, ok := f.Type.(*arrow.StructType)
			if !ok {
				return false
			}

			if !validStruct(s) {
				return false
			}
		}

		return true
	default:
		return false
	}
}

// VariantArray is an extension Array type containing Variant values which may
// potentially be shredded into multiple fields.
type VariantArray struct {
	array.ExtensionArrayBase

	rdr     variantReader
	rdrErr  error
	initRdr sync.Once
}

func (v *VariantArray) initReader() {
	// initialize a reader that coalesces shredded fields back into a variant
	// or just returns the basic variants if the array is not shredded.
	v.initRdr.Do(func() {
		vt := v.ExtensionType().(*VariantType)
		st := v.Storage().(*array.Struct)
		metaField := st.Field(vt.metadataFieldIdx)
		metadata, ok := metaField.(arrow.TypedArray[[]byte])
		if !ok {
			// we already validated that if the metadata field isn't a binary
			// type directly, it must be a dictionary with a binary value type.
			metadata, _ = array.NewDictWrapper[[]byte](metaField.(*array.Dictionary))
		}

		var value arrow.TypedArray[[]byte]
		if vt.valueFieldIdx != -1 {
			valueField := st.Field(vt.valueFieldIdx)
			value = valueField.(arrow.TypedArray[[]byte])
		}

		var ivreader typedValReader
		var err error
		if vt.typedValueFieldIdx != -1 {
			ivreader, err = getReader(st.Field(vt.typedValueFieldIdx))
			if err != nil {
				v.rdrErr = err
				return
			}
			v.rdr = &shreddedVariantReader{
				metadata:   metadata,
				value:      value,
				typedValue: ivreader,
			}
		} else {
			v.rdr = &basicVariantReader{
				metadata: metadata,
				value:    value,
			}
		}
	})
}

// Metadata returns the metadata column of the variant array, containing the
// metadata for each variant value.
func (v *VariantArray) Metadata() arrow.TypedArray[[]byte] {
	vt := v.ExtensionType().(*VariantType)
	return v.Storage().(*array.Struct).Field(vt.metadataFieldIdx).(arrow.TypedArray[[]byte])
}

// UntypedValues returns the untyped variant values for each element of the array,
// if the array is not shredded this will contain the variant bytes for each value.
// If the array is shredded, this will contain any variant values that are either
// partially shredded objects or are not shredded at all (e.g. a value that doesnt
// match the types of the shredding).
//
// The shredded array and the untyped values array together are used to encode a
// single value. If this is not encoding shredded object fields, then a given index
// will never be null in both arrays. (A null value will be an encoded null variant value
// in this array with a null in the shredded array).
//
// If both arrays are null for a given index (only valid for shredded object fields),
// it means that the value is missing entirely (as opposed to existing and having a
// value of null).
func (v *VariantArray) UntypedValues() arrow.TypedArray[[]byte] {
	vt := v.ExtensionType().(*VariantType)
	if vt.valueFieldIdx == -1 {
		return nil
	}
	return v.Storage().(*array.Struct).Field(vt.valueFieldIdx).(arrow.TypedArray[[]byte])
}

// Shredded returns the typed array for the shredded values of the variant array,
// following the rules of the Parquet Variant specification. As such, this array will
// always be either a struct, a list, or a primitive array.
//
// The reason for exposing this is to allow users to quickly access one of the shredded
// fields without having to decode the entire variant value.
func (v *VariantArray) Shredded() arrow.Array {
	vt := v.ExtensionType().(*VariantType)
	if vt.typedValueFieldIdx == -1 {
		return nil
	}

	return v.Storage().(*array.Struct).Field(vt.typedValueFieldIdx)
}

// IsShredded returns true if the variant has shredded columns.
func (v *VariantArray) IsShredded() bool {
	return v.ExtensionType().(*VariantType).typedValueFieldIdx != -1
}

// IsNull will also take into account the special case where there is an
// encoded null variant in the untyped values array for this index and return
// appropriately.
func (v *VariantArray) IsNull(i int) bool {
	if v.Storage().IsNull(i) {
		return true
	}

	vt := v.ExtensionType().(*VariantType)
	if vt.typedValueFieldIdx != -1 {
		typedArr := v.Storage().(*array.Struct).Field(vt.typedValueFieldIdx)
		if !typedArr.IsNull(i) {
			return false
		}
	}

	valArr := v.Storage().(*array.Struct).Field(vt.valueFieldIdx)
	b := valArr.(arrow.TypedArray[[]byte]).Value(i)
	return len(b) == 1 && b[0] == 0 // variant null
}

func (v *VariantArray) IsValid(i int) bool {
	return !v.IsNull(i)
}

func (v *VariantArray) String() string {
	o := new(strings.Builder)
	o.WriteString("VariantArray[")
	for i := 0; i < v.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if v.IsNull(i) {
			o.WriteString(array.NullValueStr)
			continue
		}

		val, err := v.Value(i)
		if err != nil {
			fmt.Fprintf(o, "error: %v", err)
			continue
		}

		o.WriteString(val.String())
	}
	o.WriteString("]")
	return o.String()
}

func (v *VariantArray) Value(i int) (variant.Value, error) {
	v.initReader()
	if v.rdrErr != nil {
		return variant.Value{}, v.rdrErr
	}

	return v.rdr.Value(i)
}

func (v *VariantArray) Values() ([]variant.Value, error) {
	values := make([]variant.Value, v.Len())
	for i := range v.Len() {
		val, err := v.Value(i)
		if err != nil {
			return nil, fmt.Errorf("error getting value at index %d: %w", i, err)
		}
		values[i] = val
	}
	return values, nil
}

func (v *VariantArray) ValueStr(i int) string {
	if v.IsNull(i) {
		return array.NullValueStr
	}

	val, err := v.Value(i)
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}

	return val.String()
}

func (v *VariantArray) MarshalJSON() ([]byte, error) {
	values := make([]any, v.Len())
	for i := range v.Len() {
		if v.IsNull(i) {
			values[i] = nil
			continue
		}

		val, err := v.Value(i)
		if err != nil {
			values[i] = fmt.Sprintf("error: %v", err)
			continue
		}

		values[i] = val.Value()
	}
	return json.Marshal(values)
}

func (v *VariantArray) GetOneForMarshal(i int) any {
	if v.IsNull(i) {
		return nil
	}

	val, err := v.Value(i)
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}

	return val.Value()
}

type variantReader interface {
	IsNull(i int) bool
	Value(i int) (variant.Value, error)
}

type basicVariantReader struct {
	metadata arrow.TypedArray[[]byte]
	value    arrow.TypedArray[[]byte]
}

func (r *basicVariantReader) IsNull(i int) bool {
	if r.value.IsNull(i) {
		return true
	}

	// special case for null variant
	val := r.value.Value(i)
	return len(val) == 1 && val[0] == 0
}

func (r *basicVariantReader) Value(i int) (variant.Value, error) {
	if r.IsNull(i) {
		return variant.NullValue, nil
	}

	meta := r.metadata.Value(i)
	val := r.value.Value(i)

	return variant.New(meta, val)
}

func createPrimitiveVariantReader(arr arrow.Array) (typedValReader, error) {
	switch a := arr.(type) {
	case *array.Boolean:
		return asVariantReader[bool]{typedVal: a}, nil
	case *array.Int8:
		return asVariantReader[int8]{typedVal: a}, nil
	case *array.Uint8:
		return asVariantReader[uint8]{typedVal: a}, nil
	case *array.Int16:
		return asVariantReader[int16]{typedVal: a}, nil
	case *array.Uint16:
		return asVariantReader[uint16]{typedVal: a}, nil
	case *array.Int32:
		return asVariantReader[int32]{typedVal: a}, nil
	case *array.Uint32:
		return asVariantReader[uint32]{typedVal: a}, nil
	case *array.Int64:
		return asVariantReader[int64]{typedVal: a}, nil
	case *array.Float32:
		return asVariantReader[float32]{typedVal: a}, nil
	case *array.Float64:
		return asVariantReader[float64]{typedVal: a}, nil
	case array.StringLike:
		return asVariantReader[string]{typedVal: a}, nil
	case arrow.TypedArray[[]byte]:
		return asVariantReader[[]byte]{typedVal: a}, nil
	case *array.Date32:
		return asVariantReader[arrow.Date32]{typedVal: a}, nil
	case *array.Time64:
		if a.DataType().(*arrow.Time64Type).Unit != arrow.Microsecond {
			return nil, fmt.Errorf("%w: unsupported time64 unit %s for variant",
				arrow.ErrInvalid, a.DataType().(*arrow.Time64Type).Unit)
		}
		return asVariantReader[arrow.Time64]{typedVal: a}, nil
	case *array.Timestamp:
		var opt variant.AppendOpt
		dt := a.DataType().(*arrow.TimestampType)
		switch dt.Unit {
		case arrow.Microsecond:
		case arrow.Nanosecond:
			opt |= variant.OptTimestampNano
		default:
			return nil, fmt.Errorf("%w: unsupported timestamp unit %s for variant",
				arrow.ErrInvalid, a.DataType().(*arrow.TimestampType).Unit)
		}

		if dt.TimeZone == "UTC" {
			opt |= variant.OptTimestampUTC
		}

		return asVariantReader[arrow.Timestamp]{typedVal: a, opts: opt}, nil
	case *UUIDArray:
		return asVariantReader[uuid.UUID]{typedVal: a}, nil
	case *array.Decimal32:
		return asVariantReader[variant.DecimalValue[decimal.Decimal32]]{
			typedVal: decimal32Wrapper{
				Decimal32: a,
				scale:     uint8(a.DataType().(*arrow.Decimal32Type).Scale),
			},
		}, nil
	case *array.Decimal64:
		return asVariantReader[variant.DecimalValue[decimal.Decimal64]]{
			typedVal: decimal64Wrapper{
				Decimal64: a,
				scale:     uint8(a.DataType().(*arrow.Decimal64Type).Scale),
			},
		}, nil
	case *array.Decimal128:
		return asVariantReader[variant.DecimalValue[decimal.Decimal128]]{
			typedVal: decimal128Wrapper{
				Decimal128: a,
				scale:      uint8(a.DataType().(*arrow.Decimal128Type).Scale),
			},
		}, nil
	}

	return nil, fmt.Errorf("%w: unsupported primitive type %s for variant",
		arrow.ErrInvalid, arr.DataType().String())
}

type decimal32Wrapper struct {
	*array.Decimal32

	scale uint8
}

func (d decimal32Wrapper) Value(i int) variant.DecimalValue[decimal.Decimal32] {
	return variant.DecimalValue[decimal.Decimal32]{
		Value: d.Decimal32.Value(i),
		Scale: d.scale,
	}
}

type decimal64Wrapper struct {
	*array.Decimal64

	scale uint8
}

func (d decimal64Wrapper) Value(i int) variant.DecimalValue[decimal.Decimal64] {
	return variant.DecimalValue[decimal.Decimal64]{
		Value: d.Decimal64.Value(i),
		Scale: d.scale,
	}
}

type decimal128Wrapper struct {
	*array.Decimal128

	scale uint8
}

func (d decimal128Wrapper) Value(i int) variant.DecimalValue[decimal.Decimal128] {
	return variant.DecimalValue[decimal.Decimal128]{
		Value: d.Decimal128.Value(i),
		Scale: d.scale,
	}
}

type arrowVariantPrimitiveType interface {
	arrow.NumericType | bool | string | []byte | uuid.UUID |
		variant.DecimalValue[decimal.Decimal32] |
		variant.DecimalValue[decimal.Decimal64] |
		variant.DecimalValue[decimal.Decimal128]
}

type typedArr[T arrowVariantPrimitiveType] interface {
	arrow.Array
	Value(int) T
}

type asVariantReader[T arrowVariantPrimitiveType] struct {
	typedVal typedArr[T]

	opts variant.AppendOpt
}

func (vr asVariantReader[T]) IsNull(i int) bool {
	return vr.typedVal.IsNull(i)
}

func (vr asVariantReader[T]) Value(_ variant.Metadata, i int) (any, error) {
	if vr.typedVal.IsNull(i) {
		return nil, nil
	}

	return variant.Encode(vr.typedVal.Value(i), vr.opts)
}

func getReader(typedArr arrow.Array) (typedValReader, error) {
	switch arr := typedArr.(type) {
	case *array.Struct:
		fieldReaders := make(map[string]fieldReaderPair)
		fieldList := arr.DataType().(*arrow.StructType).Fields()
		for i := range arr.NumField() {
			child := arr.Field(i).(*array.Struct)
			childType := child.DataType().(*arrow.StructType)

			valueIdx, _ := childType.FieldIdx("value")
			var valueArr arrow.TypedArray[[]byte]
			if valueIdx != -1 {
				valueArr = child.Field(valueIdx).(arrow.TypedArray[[]byte])
			}

			typedValueIdx, exists := childType.FieldIdx("typed_value")
			if !exists {
				fieldReaders[fieldList[i].Name] = fieldReaderPair{
					values:   valueArr,
					typedVal: nil,
				}
				continue
			}

			typedRdr, err := getReader(child.Field(typedValueIdx))
			if err != nil {
				return nil, fmt.Errorf("error getting typed value reader for field %s: %w", fieldList[i].Name, err)
			}

			fieldReaders[fieldList[i].Name] = fieldReaderPair{
				values:   valueArr,
				typedVal: typedRdr,
			}
		}

		return &typedObjReader{
			objArr:    arr,
			fieldRdrs: fieldReaders,
		}, nil
	case array.ListLike:
		listValues := arr.ListValues().(*array.Struct)
		elemType := listValues.DataType().(*arrow.StructType)

		var valueArr arrow.TypedArray[[]byte]
		var typedRdr typedValReader

		valueIdx, _ := elemType.FieldIdx("value")
		if valueIdx != -1 {
			valueArr = listValues.Field(valueIdx).(arrow.TypedArray[[]byte])
		}

		typedValueIdx, _ := elemType.FieldIdx("typed_value")
		if typedValueIdx != -1 {
			var err error
			typedRdr, err = getReader(listValues.Field(typedValueIdx))
			if err != nil {
				return nil, fmt.Errorf("error getting typed value reader: %w", err)
			}
		}

		return &typedListReader{
			listArr:  arr,
			valueArr: valueArr,
			typedVal: typedRdr,
		}, nil
	default:
		return createPrimitiveVariantReader(arr)
	}
}

type typedPair struct {
	Value      []byte
	TypedValue any
}

func constructVariant(b *variant.Builder, meta variant.Metadata, value []byte, typedVal any) error {
	switch v := typedVal.(type) {
	case nil:
		if len(value) == 0 {
			b.AppendNull()
			return nil
		}

		return b.UnsafeAppendEncoded(value)
	case map[string]typedPair:
		fields := make([]variant.FieldEntry, 0, len(v))
		objstart := b.Offset()
		for k, pair := range v {
			if pair.TypedValue != nil || len(pair.Value) != 0 {
				fields = append(fields, b.NextField(objstart, k))
				if err := constructVariant(b, meta, pair.Value, pair.TypedValue); err != nil {
					return err
				}
			}
		}

		if len(value) > 0 {
			obj, err := variant.NewWithMetadata(meta, value)
			if err != nil {
				return err
			}

			objval, ok := obj.Value().(variant.ObjectValue)
			if !ok {
				return fmt.Errorf("%w: expected object value, got %T", arrow.ErrInvalid, obj.Value())
			}

			for key, field := range objval.Values() {
				fields = append(fields, b.NextField(objstart, key))
				if err := b.UnsafeAppendEncoded(field.Bytes()); err != nil {
					return fmt.Errorf("error appending field %s: %w", key, err)
				}
			}
		}

		return b.FinishObject(objstart, fields)
	case []typedPair:
		debug.Assert(len(value) == 0, "shredded array must not conflict with variant value")

		elems := make([]int, 0, len(v))
		arrstart := b.Offset()
		for _, pair := range v {
			elems = append(elems, b.NextElement(arrstart))
			if err := constructVariant(b, meta, pair.Value, pair.TypedValue); err != nil {
				return err
			}
		}

		return b.FinishArray(arrstart, elems)
	case []byte:
		if len(value) > 0 {
			return errors.New("invalid variant, conflicting value and typed_value")
		}
		return b.UnsafeAppendEncoded(v)
	default:
		return fmt.Errorf("%w: unsupported typed value type %T for variant", arrow.ErrInvalid, v)
	}
}

type typedValReader interface {
	Value(meta variant.Metadata, i int) (any, error)
	IsNull(i int) bool
}

type fieldReaderPair struct {
	values   arrow.TypedArray[[]byte]
	typedVal typedValReader
}

type typedObjReader struct {
	objArr    *array.Struct
	fieldRdrs map[string]fieldReaderPair
}

func (v *typedObjReader) IsNull(i int) bool {
	return v.objArr.IsNull(i)
}

func (v *typedObjReader) Value(meta variant.Metadata, i int) (any, error) {
	if v.objArr.IsNull(i) {
		return nil, nil
	}

	var err error
	result := make(map[string]typedPair)
	for name, rdr := range v.fieldRdrs {
		var typedValue any
		if rdr.typedVal != nil {
			typedValue, err = rdr.typedVal.Value(meta, i)
			if err != nil {
				return nil, fmt.Errorf("error reading typed value for field %s at index %d: %w", name, i, err)
			}
		}

		var val []byte
		if rdr.values != nil {
			val = rdr.values.Value(i)
		}

		result[name] = typedPair{
			Value:      val,
			TypedValue: typedValue,
		}
	}
	return result, nil
}

type typedListReader struct {
	listArr array.ListLike

	valueArr arrow.TypedArray[[]byte]
	typedVal typedValReader
}

func (v *typedListReader) IsNull(i int) bool {
	return v.listArr.IsNull(i)
}

func (v *typedListReader) Value(meta variant.Metadata, i int) (any, error) {
	if v.listArr.IsNull(i) {
		return nil, nil
	}

	start, end := v.listArr.ValueOffsets(i)
	if start == end {
		return []typedPair{}, nil
	}

	result := make([]typedPair, 0, end-start)
	for j := start; j < end; j++ {
		var val []byte
		if v.valueArr != nil {
			val = v.valueArr.Value(int(j))
		}

		typedValue, err := v.typedVal.Value(meta, int(j))
		if err != nil {
			return nil, fmt.Errorf("error reading typed value at index %d: %w", j, err)
		}

		result = append(result, typedPair{
			Value:      val,
			TypedValue: typedValue,
		})
	}

	return result, nil
}

type shreddedVariantReader struct {
	metadata arrow.TypedArray[[]byte]
	value    arrow.TypedArray[[]byte]

	typedValue typedValReader
}

func (v *shreddedVariantReader) IsNull(i int) bool {
	if !v.typedValue.IsNull(i) {
		return false
	}

	if v.value.IsNull(i) {
		return true
	}

	val := v.value.Value(i)
	return len(val) == 1 && val[0] == 0 // variant null
}

func (v *shreddedVariantReader) Value(i int) (variant.Value, error) {
	metaBytes := v.metadata.Value(i)
	meta, err := variant.NewMetadata(metaBytes)
	if err != nil {
		return variant.NullValue, fmt.Errorf("error reading metadata at index %d: %w", i, err)
	}

	b := variant.NewBuilderFromMeta(meta)
	b.SetAllowDuplicates(true)
	typed, err := v.typedValue.Value(meta, i)
	if err != nil {
		return variant.NullValue, fmt.Errorf("error reading typed value at index %d: %w", i, err)
	}

	var value []byte
	if v.value != nil {
		value = v.value.Value(i)
	}
	if err := constructVariant(b, meta, value, typed); err != nil {
		return variant.NullValue, fmt.Errorf("error constructing variant at index %d: %w", i, err)
	}
	return b.Build()
}

// VariantBuilder is an array builder for both shredded or non-shredded variant extension
// arrays. It allows you to append variant values, and will appropriately shred them
// if it is able to do so based on the underlying storage type.
type VariantBuilder struct {
	*array.ExtensionBuilder
	shreddedSchema shreddedSchema

	structBldr *array.StructBuilder
	metaBldr   array.BinaryLikeBuilder
	valueBldr  array.BinaryLikeBuilder
	typedBldr  shreddedBuilder
}

type binaryDictBuilderAdapter struct {
	*array.BinaryDictionaryBuilder
}

func (b *binaryDictBuilderAdapter) ReserveData(int) {}

func (b *binaryDictBuilderAdapter) AppendValues(v [][]byte, valids []bool) {
	if len(valids) == 0 {
		for _, val := range v {
			b.Append(val)
		}
		return
	}

	for i, valid := range valids {
		if !valid {
			b.AppendNull()
		} else {
			b.Append(v[i])
		}
	}
}

func (b *binaryDictBuilderAdapter) UnsafeAppend(v []byte) {
	b.Append(v)
}

func (b *binaryDictBuilderAdapter) Append(v []byte) {
	if err := b.BinaryDictionaryBuilder.Append(v); err != nil {
		panic(fmt.Sprintf("error appending value %s to binary dictionary builder: %v", string(v), err))
	}
}

// NewVariantBuilder creates a new VariantBuilder for the given variant type which may
// or may not be shredded.
func NewVariantBuilder(mem memory.Allocator, dt *VariantType) *VariantBuilder {
	shreddedSchema := getShreddedSchema(dt)
	bldr := array.NewExtensionBuilder(mem, dt)

	structBldr := bldr.StorageBuilder().(*array.StructBuilder)
	var typedBldr shreddedBuilder
	if shreddedSchema.typedIdx != -1 {
		typedBldr = createShreddedBuilder(shreddedSchema.typedSchema, structBldr.FieldBuilder(shreddedSchema.typedIdx))
	}

	var metaBldr array.BinaryLikeBuilder
	switch b := structBldr.FieldBuilder(shreddedSchema.metadataIdx).(type) {
	case *array.BinaryDictionaryBuilder:
		metaBldr = &binaryDictBuilderAdapter{BinaryDictionaryBuilder: b}
	case array.BinaryLikeBuilder:
		metaBldr = b
	}

	return &VariantBuilder{
		ExtensionBuilder: bldr,
		shreddedSchema:   shreddedSchema,
		structBldr:       structBldr,
		metaBldr:         metaBldr,
		valueBldr:        structBldr.FieldBuilder(shreddedSchema.variantIdx).(array.BinaryLikeBuilder),
		typedBldr:        typedBldr,
	}
}

func (b *VariantBuilder) Append(v variant.Value) {
	b.structBldr.Append(true)
	b.metaBldr.Append(v.Metadata().Bytes())
	if b.typedBldr == nil {
		b.valueBldr.Append(v.Bytes())
		return
	}

	residual := b.typedBldr.tryTyped(v)
	if len(residual) > 0 {
		b.valueBldr.Append(residual)
	} else {
		b.valueBldr.AppendNull()
	}
}

func (b *VariantBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *VariantBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()

	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("variant builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

func (b *VariantBuilder) UnmarshalOne(dec *json.Decoder) error {
	v, err := variant.Unmarshal(dec, false)
	if err != nil {
		return fmt.Errorf("error unmarshalling variant value: %w", err)
	}

	b.Append(v)
	return nil
}

func variantTypeFromArrow(dt arrow.DataType) variant.Type {
	switch dt.ID() {
	case arrow.BOOL:
		return variant.Bool
	case arrow.INT8:
		return variant.Int8
	case arrow.INT16, arrow.UINT8:
		return variant.Int16
	case arrow.INT32, arrow.UINT16:
		return variant.Int32
	case arrow.INT64, arrow.UINT32:
		return variant.Int64
	case arrow.FLOAT32:
		return variant.Float
	case arrow.FLOAT64:
		return variant.Double
	case arrow.STRING, arrow.LARGE_STRING, arrow.STRING_VIEW:
		return variant.String
	case arrow.BINARY, arrow.LARGE_BINARY, arrow.BINARY_VIEW:
		return variant.Binary
	case arrow.DATE32:
		return variant.Date
	case arrow.TIME64:
		if dt.(*arrow.Time64Type).Unit == arrow.Microsecond {
			return variant.Time
		}
	case arrow.TIMESTAMP:
		dt := dt.(*arrow.TimestampType)
		isUTC := dt.TimeZone == "" || dt.TimeZone == "UTC"
		switch dt.Unit {
		case arrow.Microsecond:
			if isUTC {
				return variant.TimestampMicros
			}
			return variant.TimestampMicrosNTZ
		case arrow.Nanosecond:
			if isUTC {
				return variant.TimestampNanos
			}
			return variant.TimestampNanosNTZ
		}
	case arrow.DECIMAL32:
		return variant.Decimal4
	case arrow.DECIMAL64:
		return variant.Decimal8
	case arrow.DECIMAL128:
		return variant.Decimal16
	case arrow.EXTENSION:
		extType, ok := dt.(arrow.ExtensionType)
		if !ok {
			break
		}

		switch extType.ExtensionName() {
		case "arrow.uuid":
			return variant.UUID
		case "arrow.json":
			return variant.String
		}
	}

	panic(fmt.Sprintf("unsupported arrow type %s for variant", dt.String()))
}

type variantSchema interface {
	Type() variant.Type
}

type objFieldSchema struct {
	fieldName string
	schema    variantSchema

	variantIdx int
	typedIdx   int
}

type shreddedObjSchema struct {
	fields    []objFieldSchema
	schemaMap map[string]int
}

func (shreddedObjSchema) Type() variant.Type {
	return variant.Object
}

type shreddedArraySchema struct {
	elemSchema variantSchema

	elemVariantIdx int
	elemTypedIdx   int
}

func (shreddedArraySchema) Type() variant.Type {
	return variant.Array
}

type shreddedPrimitiveSchema struct {
	typ variant.Type
}

func (s shreddedPrimitiveSchema) Type() variant.Type {
	return s.typ
}

type shreddedSchema struct {
	metadataIdx int
	variantIdx  int
	typedIdx    int

	typedSchema variantSchema
}

func getVariantSchema(dt arrow.DataType) variantSchema {
	switch dt := dt.(type) {
	case *arrow.StructType:
		fields := make([]objFieldSchema, 0, dt.NumFields())
		schemaMap := make(map[string]int)

		for i, f := range dt.Fields() {
			childType := f.Type.(*arrow.StructType)

			valueIdx, _ := childType.FieldIdx("value")
			typedValueIdx, _ := childType.FieldIdx("typed_value")

			fields = append(fields, objFieldSchema{
				fieldName:  f.Name,
				schema:     getVariantSchema(childType.Field(typedValueIdx).Type),
				variantIdx: valueIdx,
				typedIdx:   typedValueIdx,
			})

			schemaMap[f.Name] = i
		}

		return shreddedObjSchema{
			fields:    fields,
			schemaMap: schemaMap,
		}
	case arrow.ListLikeType:
		elemType := dt.Elem().(*arrow.StructType)

		valueIdx, _ := elemType.FieldIdx("value")
		typedValueIdx, _ := elemType.FieldIdx("typed_value")

		elemSchema := getVariantSchema(elemType.Field(typedValueIdx).Type)
		return shreddedArraySchema{
			elemSchema:     elemSchema,
			elemVariantIdx: valueIdx,
			elemTypedIdx:   typedValueIdx,
		}
	default:
		return shreddedPrimitiveSchema{typ: variantTypeFromArrow(dt)}
	}
}

func getShreddedSchema(dt *VariantType) shreddedSchema {
	st := dt.StorageType().(*arrow.StructType)

	var typedSchema variantSchema
	if dt.typedValueFieldIdx != -1 {
		typedSchema = getVariantSchema(st.Field(dt.typedValueFieldIdx).Type)
	}
	return shreddedSchema{
		metadataIdx: dt.metadataFieldIdx,
		variantIdx:  dt.valueFieldIdx,
		typedIdx:    dt.typedValueFieldIdx,
		typedSchema: typedSchema,
	}
}

type shreddedBuilder interface {
	AppendMissing()
	tryTyped(v variant.Value) (residual []byte)
}

type shreddedArrayBuilder struct {
	listBldr *array.ListBuilder
	elemBldr *array.StructBuilder

	valueBldr array.BinaryLikeBuilder
	typedBldr shreddedBuilder
}

func (s *shreddedArrayBuilder) AppendMissing() {
	s.listBldr.Append(true)
	s.elemBldr.Append(true)
	s.valueBldr.AppendNull()
	s.typedBldr.AppendMissing()
}

func (b *shreddedArrayBuilder) tryTyped(v variant.Value) (residual []byte) {
	if v.Type() != variant.Array {
		b.listBldr.AppendNull()
		return v.Bytes()
	}

	b.listBldr.Append(true)
	arr := v.Value().(variant.ArrayValue)
	if arr.Len() == 0 {
		b.listBldr.AppendEmptyValue()
		return nil
	}

	for val := range arr.Values() {
		b.elemBldr.Append(true)
		residual = b.typedBldr.tryTyped(val)
		if len(residual) > 0 {
			b.valueBldr.Append(residual)
		} else {
			b.valueBldr.AppendNull()
		}
	}

	return nil
}

type shreddedPrimitiveBuilder struct {
	typedBldr array.Builder
}

func (s *shreddedPrimitiveBuilder) AppendMissing() {
	s.typedBldr.AppendNull()
}

type typedBuilder[T arrow.ValueType] interface {
	Type() arrow.DataType
	Append(T)
}

func appendToTarget[T int8 | uint8 | int16 | uint16 | int32 | uint32 | int64](bldr typedBuilder[T], v int64) bool {
	if int64(T(v)) == v {
		bldr.Append(T(v))
		return true
	}

	return false
}

func appendNumericToTarget[T int8 | uint8 | int16 | uint16 | int32 | uint32 | int64](bldr typedBuilder[T], v variant.Value) bool {
	switch val := v.Value().(type) {
	case int8:
		return appendToTarget(bldr, int64(val))
	case int16:
		return appendToTarget(bldr, int64(val))
	case int32:
		return appendToTarget(bldr, int64(val))
	case int64:
		return appendToTarget(bldr, val)
	}

	return false
}

func decimalCanFit[T decimal.Decimal32 | decimal.Decimal64 | decimal.Decimal128](dt arrow.DecimalType, val variant.DecimalValue[T]) bool {
	if dt.GetScale() != int32(val.Scale) {
		return false
	}

	return val.Value.FitsInPrecision(dt.GetPrecision())
}

func (b *shreddedPrimitiveBuilder) tryTyped(v variant.Value) (residual []byte) {
	if v.Type() == variant.Null {
		b.typedBldr.AppendNull()
		return v.Bytes()
	}

	switch bldr := b.typedBldr.(type) {
	case *array.Int8Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Uint8Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Int16Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Uint16Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Int32Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Uint32Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Int64Builder:
		if appendNumericToTarget(bldr, v) {
			return nil
		}
	case *array.Float32Builder:
		switch v.Type() {
		case variant.Float:
			bldr.Append(v.Value().(float32))
			return nil
		case variant.Double:
			val := v.Value().(float64)
			if val >= -math.MaxFloat32 && val <= math.MaxFloat32 {
				bldr.Append(float32(val))
				return nil
			}
		}
	case *array.Float64Builder:
		switch v.Type() {
		case variant.Float:
			bldr.Append(float64(v.Value().(float32)))
			return nil
		case variant.Double:
			bldr.Append(v.Value().(float64))
			return nil
		}
	case *array.BooleanBuilder:
		if v.Type() == variant.Bool {
			bldr.Append(v.Value().(bool))
			return nil
		}
	case array.StringLikeBuilder:
		if v.Type() == variant.String {
			bldr.Append(v.Value().(string))
			return nil
		}
	case array.BinaryLikeBuilder:
		if v.Type() == variant.Binary {
			bldr.Append(v.Value().([]byte))
			return nil
		}
	case *array.Date32Builder:
		if v.Type() == variant.Date {
			bldr.Append(v.Value().(arrow.Date32))
			return nil
		}
	case *array.Time64Builder:
		if v.Type() == variant.Time && bldr.Type().(*arrow.Time64Type).Unit == arrow.Microsecond {
			bldr.Append(v.Value().(arrow.Time64))
			return nil
		}
	case *UUIDBuilder:
		if v.Type() == variant.UUID {
			bldr.Append(v.Value().(uuid.UUID))
			return nil
		}
	case *array.TimestampBuilder:
		tsType := bldr.Type().(*arrow.TimestampType)
		switch v.Type() {
		case variant.TimestampMicros:
			if tsType.TimeZone != "UTC" {
				break
			}

			switch tsType.Unit {
			case arrow.Microsecond:
				bldr.Append(v.Value().(arrow.Timestamp))
				return nil
			case arrow.Nanosecond:
				bldr.Append(v.Value().(arrow.Timestamp) * 1000)
				return nil
			}
		case variant.TimestampMicrosNTZ:
			if tsType.TimeZone != "" {
				break
			}

			switch tsType.Unit {
			case arrow.Microsecond:
				bldr.Append(v.Value().(arrow.Timestamp))
				return nil
			case arrow.Nanosecond:
				bldr.Append(v.Value().(arrow.Timestamp) * 1000)
				return nil
			}
		case variant.TimestampNanos:
			if tsType.TimeZone == "UTC" && tsType.Unit == arrow.Nanosecond {
				bldr.Append(v.Value().(arrow.Timestamp))
				return nil
			}
		case variant.TimestampNanosNTZ:
			if tsType.TimeZone == "" && tsType.Unit == arrow.Nanosecond {
				bldr.Append(v.Value().(arrow.Timestamp))
				return nil
			}
		}
	case *array.Decimal32Builder:
		dt := bldr.Type().(*arrow.Decimal32Type)
		switch val := v.Value().(type) {
		case variant.DecimalValue[decimal.Decimal32]:
			if decimalCanFit(dt, val) {
				bldr.Append(val.Value.(decimal.Decimal32))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal64]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal.Decimal32(val.Value.(decimal.Decimal64)))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal128]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal.Decimal32(val.Value.(decimal.Decimal128).LowBits()))
				return nil
			}
		}
	case *array.Decimal64Builder:
		dt := bldr.Type().(*arrow.Decimal64Type)
		switch val := v.Value().(type) {
		case variant.DecimalValue[decimal.Decimal32]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal.Decimal64(val.Value.(decimal.Decimal32)))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal64]:
			if decimalCanFit(dt, val) {
				bldr.Append(val.Value.(decimal.Decimal64))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal128]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal.Decimal64(val.Value.(decimal.Decimal128).LowBits()))
				return nil
			}
		}
	case *array.Decimal128Builder:
		dt := bldr.Type().(*arrow.Decimal128Type)
		switch val := v.Value().(type) {
		case variant.DecimalValue[decimal.Decimal32]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal128.FromI64(int64(val.Value.(decimal.Decimal32))))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal64]:
			if decimalCanFit(dt, val) {
				bldr.Append(decimal128.FromI64(int64(val.Value.(decimal.Decimal64))))
				return nil
			}
		case variant.DecimalValue[decimal.Decimal128]:
			if decimalCanFit(dt, val) {
				bldr.Append(val.Value.(decimal.Decimal128))
				return nil
			}
		}
	}

	b.typedBldr.AppendNull()
	return v.Bytes()
}

type shreddedFieldBuilder struct {
	structBldr *array.StructBuilder
	valueBldr  array.BinaryLikeBuilder
	typedBldr  shreddedBuilder
}

type shreddedObjBuilder struct {
	structBldr *array.StructBuilder

	fieldBuilders map[string]shreddedFieldBuilder
}

func (b *shreddedObjBuilder) AppendMissing() {
	b.structBldr.AppendValues([]bool{false})
	for _, fieldBldr := range b.fieldBuilders {
		fieldBldr.structBldr.Append(true)
		fieldBldr.valueBldr.AppendNull()
		fieldBldr.typedBldr.AppendMissing()
	}
}

func (b *shreddedObjBuilder) tryTyped(v variant.Value) (residual []byte) {
	if v.Type() != variant.Object {
		b.AppendMissing()
		return v.Bytes()
	}

	b.structBldr.Append(true)

	// create a variant builder for any field existing in 'v' but not in
	// the shreddeding schema
	varbuilder := variant.NewBuilderFromMeta(v.Metadata())
	obj := v.Value().(variant.ObjectValue)

	start := varbuilder.Offset()
	fields := make([]variant.FieldEntry, 0, obj.NumElements())
	fieldsFound := make(map[string]struct{})
	for key, val := range obj.Values() {
		fieldBldr, ok := b.fieldBuilders[key]
		if !ok {
			// field is not shredded, put it in the untyped value col
			fields = append(fields, varbuilder.NextField(start, key))
			if err := varbuilder.UnsafeAppendEncoded(val.Bytes()); err != nil {
				panic(fmt.Sprintf("error appending field %s: %v", key, err))
			}
		} else {
			fieldsFound[key] = struct{}{}
			fieldBldr.structBldr.Append(true)
			residual := fieldBldr.typedBldr.tryTyped(val)
			if len(residual) > 0 {
				fieldBldr.valueBldr.Append(residual)
			} else {
				fieldBldr.valueBldr.AppendNull()
			}
		}
	}

	if len(fieldsFound) < len(b.fieldBuilders) {
		// set missing fields appropriately
		for key, fieldBldr := range b.fieldBuilders {
			if _, found := fieldsFound[key]; !found {
				fieldBldr.structBldr.Append(true)
				fieldBldr.valueBldr.AppendNull()
				fieldBldr.typedBldr.AppendMissing()
			}
		}
	}

	if len(fields) > 0 {
		if err := varbuilder.FinishObject(start, fields); err != nil {
			panic(fmt.Sprintf("error finishing object: %v", err))
		}

		return varbuilder.BuildWithoutMeta()
	}

	return nil
}

func createShreddedBuilder(s variantSchema, typed array.Builder) shreddedBuilder {
	switch s := s.(type) {
	case shreddedObjSchema:
		stBldr := typed.(*array.StructBuilder)
		fieldBuilders := make(map[string]shreddedFieldBuilder)
		for i, field := range s.fields {
			fb := stBldr.FieldBuilder(i).(*array.StructBuilder)
			fieldBuilders[field.fieldName] = shreddedFieldBuilder{
				structBldr: fb,
				valueBldr:  fb.FieldBuilder(field.variantIdx).(array.BinaryLikeBuilder),
				typedBldr:  createShreddedBuilder(field.schema, fb.FieldBuilder(field.typedIdx)),
			}
		}
		return &shreddedObjBuilder{
			structBldr:    stBldr,
			fieldBuilders: fieldBuilders,
		}
	case shreddedArraySchema:
		listBldr := typed.(*array.ListBuilder)
		elemBldr := listBldr.ValueBuilder().(*array.StructBuilder)

		return &shreddedArrayBuilder{
			listBldr:  listBldr,
			elemBldr:  elemBldr,
			valueBldr: elemBldr.FieldBuilder(s.elemVariantIdx).(array.BinaryLikeBuilder),
			typedBldr: createShreddedBuilder(s.elemSchema, elemBldr.FieldBuilder(s.elemTypedIdx)),
		}
	case shreddedPrimitiveSchema:
		return &shreddedPrimitiveBuilder{typedBldr: typed}
	}

	// non-shredded
	return nil
}
