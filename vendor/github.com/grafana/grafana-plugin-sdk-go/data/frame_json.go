package data

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"time"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	jsoniter "github.com/json-iterator/go"
	"github.com/mattetti/filebuffer"

	sdkjsoniter "github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
)

const simpleTypeString = "string"
const simpleTypeNumber = "number"
const simpleTypeBool = "boolean"
const simpleTypeTime = "time"
const simpleTypeEnum = "enum"
const simpleTypeOther = "other"

const jsonKeySchema = "schema"
const jsonKeyData = "data"

func init() { //nolint:gochecknoinits
	jsoniter.RegisterTypeEncoder("data.Frame", &dataFrameCodec{})
	jsoniter.RegisterTypeDecoder("data.Frame", &dataFrameCodec{})
}

type dataFrameCodec struct{}

func (codec *dataFrameCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*Frame)(ptr)
	return f.Fields == nil && f.RefID == "" && f.Meta == nil
}

func (codec *dataFrameCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	f := (*Frame)(ptr)
	writeDataFrame(f, stream, true, true)
}

func (codec *dataFrameCodec) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	frame := Frame{}
	err := readDataFrameJSON(&frame, iter)
	if err != nil {
		// keep existing iter error if it exists
		if iter.Error == nil {
			iter.Error = err
		}
		return
	}
	*((*Frame)(ptr)) = frame
}

// FrameInclude - custom type to hold Frame serialization options.
type FrameInclude int

// Known FrameInclude constants.
const (
	// IncludeAll serializes the entire Frame with both Schema and Data.
	IncludeAll FrameInclude = iota + 1
	// IncludeDataOnly only serializes data part of a frame.
	IncludeDataOnly
	// IncludeSchemaOnly only serializes schema part of a frame.
	IncludeSchemaOnly
)

// FrameJSONCache holds a byte representation of the schema separate from the data.
// Methods of FrameJSON are not goroutine-safe.
type FrameJSONCache struct {
	schema json.RawMessage
	data   json.RawMessage
}

// Bytes can return a subset of the cached frame json.  Note that requesting a section
// that was not serialized on creation will return an empty value
func (f *FrameJSONCache) Bytes(args FrameInclude) []byte {
	if f.schema != nil && (args == IncludeAll || args == IncludeSchemaOnly) {
		out := append([]byte(`{"`+jsonKeySchema+`":`), f.schema...)

		if f.data != nil && (args == IncludeAll || args == IncludeDataOnly) {
			out = append(out, `,"`+jsonKeyData+`":`...)
			out = append(out, f.data...)
		}
		return append(out, "}"...)
	}

	// only data
	if f.data != nil && (args == IncludeAll || args == IncludeDataOnly) {
		out := []byte(`{"` + jsonKeyData + `":`)
		out = append(out, f.data...)
		return append(out, []byte("}")...)
	}

	return []byte("{}")
}

// SameSchema checks if both structures have the same schema
func (f *FrameJSONCache) SameSchema(dst *FrameJSONCache) bool {
	if f == nil || dst == nil {
		return false
	}
	return bytes.Equal(f.schema, dst.schema)
}

// SetData updates the data bytes with new values
func (f *FrameJSONCache) setData(frame *Frame) error {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeDataFrameData(frame, stream)
	if stream.Error != nil {
		return stream.Error
	}

	buf := stream.Buffer()
	data := make([]byte, len(buf))
	copy(data, buf) // don't hold the internal jsoniter buffer
	f.data = data
	return nil
}

// SetSchema updates the schema bytes with new values
func (f *FrameJSONCache) setSchema(frame *Frame) error {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeDataFrameSchema(frame, stream)
	if stream.Error != nil {
		return stream.Error
	}

	buf := stream.Buffer()
	data := make([]byte, len(buf))
	copy(data, buf) // don't hold the internal jsoniter buffer
	f.schema = data
	return nil
}

// MarshalJSON marshals Frame to JSON.
func (f *FrameJSONCache) MarshalJSON() ([]byte, error) {
	return f.Bytes(IncludeAll), nil
}

// FrameToJSON creates an object that holds schema and data independently.  This is
// useful for explicit control between the data and schema.
// For standard json serialization use `json.Marshal(frame)`
//
// NOTE: the format should be considered experimental until grafana 8 is released.
func FrameToJSON(frame *Frame, include FrameInclude) ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	includeSchema := include == IncludeAll || include == IncludeSchemaOnly
	includeData := include == IncludeAll || include == IncludeDataOnly

	writeDataFrame(frame, stream, includeSchema, includeData)
	if stream.Error != nil {
		return nil, stream.Error
	}

	return append([]byte(nil), stream.Buffer()...), nil
}

// FrameToJSON creates an object that holds schema and data independently.  This is
// useful for explicit control between the data and schema.
// For standard json serialization use `json.Marshal(frame)`
//
// NOTE: the format should be considered experimental until grafana 8 is released.
func FrameToJSONCache(frame *Frame) (FrameJSONCache, error) {
	wrap := FrameJSONCache{}

	err := wrap.setSchema(frame)
	if err != nil {
		return wrap, err
	}

	err = wrap.setData(frame)
	if err != nil {
		return wrap, err
	}

	return wrap, nil
}

type frameSchema struct {
	Name   string         `json:"name,omitempty"`
	Fields []*schemaField `json:"fields,omitempty"`
	RefID  string         `json:"refId,omitempty"`
	Meta   *FrameMeta     `json:"meta,omitempty"`
}

type fieldTypeInfo struct {
	Frame    FieldType `json:"frame,omitempty"`
	Nullable bool      `json:"nullable,omitempty"`
}

// has vector... but without length
type schemaField struct {
	Field
	TypeInfo fieldTypeInfo `json:"typeInfo,omitempty"`
}

func readDataFrameJSON(frame *Frame, iter *jsoniter.Iterator) error {
	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case jsonKeySchema:
			schema := frameSchema{}
			iter.ReadVal(&schema)
			frame.Name = schema.Name
			frame.RefID = schema.RefID
			frame.Meta = schema.Meta

			// Create a new field for each object
			for _, f := range schema.Fields {
				ft := f.TypeInfo.Frame
				if f.TypeInfo.Nullable {
					ft = ft.NullableType()
				}
				tmp := NewFieldFromFieldType(ft, 0)
				tmp.Name = f.Name
				tmp.Labels = f.Labels
				tmp.Config = f.Config
				frame.Fields = append(frame.Fields, tmp)
			}

		case jsonKeyData:
			err := readFrameData(iter, frame)
			if err != nil {
				return err
			}

		default:
			iter.ReportError("bind l1", "unexpected field: "+l1Field)
		}
	}
	return iter.Error
}

func readDataFramesJSON(frames *Frames, iter *jsoniter.Iterator) error {
	for iter.ReadArray() {
		frame := &Frame{}
		iter.ReadVal(frame)
		if iter.Error != nil {
			return iter.Error
		}
		*frames = append(*frames, frame)
	}
	return nil
}

func readFrameData(iter *jsoniter.Iterator, frame *Frame) error {
	var readValues, readNanos bool
	nanos := make([][]int64, len(frame.Fields))
	for l2Field := iter.ReadObject(); l2Field != ""; l2Field = iter.ReadObject() {
		switch l2Field {
		case "values":
			if !iter.ReadArray() {
				continue // empty fields
			}
			var fieldIndex int
			// Load the first field with a generic interface.
			// The length of the first will be assumed for the other fields
			// and can have a specialized parser
			if frame.Fields == nil {
				return errors.New("fields is nil, malformed key order or frame without schema")
			}

			field := frame.Fields[0]
			vec, err := jsonValuesToVector(iter, field.Type())
			if err != nil {
				return err
			}
			field.vector = vec
			size := vec.Len()

			addNanos := func() {
				if readNanos {
					if nanos[fieldIndex] != nil {
						for i := 0; i < size; i++ {
							t, ok := field.ConcreteAt(i)
							if !ok {
								continue
							}
							field.Set(i, t.(time.Time).Add(time.Nanosecond*time.Duration(nanos[fieldIndex][i])))
						}
					}
				}
			}

			addNanos()
			fieldIndex++
			for iter.ReadArray() {
				field = frame.Fields[fieldIndex]
				vec, err = readVector(iter, field.Type(), size)
				if err != nil {
					return err
				}

				field.vector = vec
				addNanos()
				fieldIndex++
			}
			readValues = true

		case "entities":
			fieldIndex := 0
			for iter.ReadArray() {
				t := iter.WhatIsNext()
				if t == sdkjsoniter.ObjectValue {
					for l3Field := iter.ReadObject(); l3Field != ""; l3Field = iter.ReadObject() {
						field := frame.Fields[fieldIndex]
						replace := getReplacementValue(l3Field, field.Type())
						for iter.ReadArray() {
							idx := iter.ReadInt()
							field.vector.SetConcrete(idx, replace)
						}
					}
				} else {
					iter.ReadAny() // skip nils
				}
				fieldIndex++
			}

		case "nanos":
			fieldIndex := 0
			for iter.ReadArray() {
				field := frame.Fields[fieldIndex]

				t := iter.WhatIsNext()
				if t == sdkjsoniter.ArrayValue {
					for idx := 0; iter.ReadArray(); idx++ {
						ns := iter.ReadInt64()
						if readValues {
							t, ok := field.vector.ConcreteAt(idx)
							if !ok {
								continue
							}
							tWithNS := t.(time.Time).Add(time.Nanosecond * time.Duration(ns))
							field.vector.SetConcrete(idx, tWithNS)
							continue
						}
						if idx == 0 {
							nanos[fieldIndex] = append(nanos[fieldIndex], ns)
						}
					}
				} else {
					iter.ReadAny() // skip nils
				}
				fieldIndex++
			}

			readNanos = true
		}
	}
	return nil
}

func getReplacementValue(key string, ft FieldType) interface{} {
	v := math.NaN()
	if key == "Inf" {
		v = math.Inf(1)
	} else if key == "NegInf" {
		v = math.Inf(-1)
	}
	if ft == FieldTypeFloat32 || ft == FieldTypeNullableFloat32 {
		return float32(v)
	}
	return v
}

func float64FromJSON(v interface{}) (float64, error) {
	fV, ok := v.(float64)
	if ok {
		return fV, nil
	}
	iV, ok := v.(int64)
	if ok {
		fV = float64(iV)
		return fV, nil
	}
	iiV, ok := v.(int)
	if ok {
		fV = float64(iiV)
		return fV, nil
	}
	sV, ok := v.(string)
	if ok {
		return strconv.ParseFloat(sV, 64)
	}

	return 0, fmt.Errorf("unable to convert float64 in json [%T]", v)
}

func int64FromJSON(v interface{}) (int64, error) {
	iV, ok := v.(int64)
	if ok {
		return iV, nil
	}
	sV, ok := v.(string)
	if ok {
		return strconv.ParseInt(sV, 0, 64)
	}
	fV, ok := v.(float64)
	if ok {
		return int64(fV), nil
	}

	return 0, fmt.Errorf("unable to convert int64 in json [%T]", v)
}

// in this path, we do not yet know the length and must discover it from the array
// nolint:gocyclo
func jsonValuesToVector(iter *jsoniter.Iterator, ft FieldType) (vector, error) {
	itere := sdkjsoniter.NewIterator(iter)
	// we handle Uint64 differently because the regular method for unmarshalling to []any does not work for uint64 correctly
	// due to jsoniter parsing logic that automatically converts all numbers to float64.
	// We can't use readUint64VectorJSON here because the size of the array is not known and the function requires the length parameter
	switch ft {
	case FieldTypeUint64:
		parseUint64 := func(s string) (uint64, error) {
			return strconv.ParseUint(s, 0, 64)
		}
		u, err := readArrayOfNumbers[uint64](itere, parseUint64, itere.ReadUint64)
		if err != nil {
			return nil, err
		}
		return newUint64VectorWithValues(u), nil

	case FieldTypeNullableUint64:
		parseUint64 := func(s string) (*uint64, error) {
			u, err := strconv.ParseUint(s, 0, 64)
			if err != nil {
				return nil, err
			}
			return &u, nil
		}
		u, err := readArrayOfNumbers[*uint64](itere, parseUint64, itere.ReadUint64Pointer)
		if err != nil {
			return nil, err
		}
		return newNullableUint64VectorWithValues(u), nil

	case FieldTypeInt64:
		vals := newInt64Vector(0)
		for iter.ReadArray() {
			v := iter.ReadInt64()
			vals.Append(v)
		}
		return vals, nil

	case FieldTypeNullableInt64:
		vals := newNullableInt64Vector(0)
		for iter.ReadArray() {
			t := iter.WhatIsNext()
			if t == sdkjsoniter.NilValue {
				iter.ReadNil()
				vals.Append(nil)
			} else {
				v := iter.ReadInt64()
				vals.Append(&v)
			}
		}
		return vals, nil

	case FieldTypeJSON, FieldTypeNullableJSON:
		vals := newJsonRawMessageVector(0)
		for iter.ReadArray() {
			var v json.RawMessage
			t := iter.WhatIsNext()
			if t == sdkjsoniter.NilValue {
				iter.ReadNil()
			} else {
				iter.ReadVal(&v)
			}
			vals.Append(v)
		}

		// Convert this to the pointer flavor
		if ft == FieldTypeNullableJSON {
			size := vals.Len()
			nullable := newNullableJsonRawMessageVector(size)
			for i := 0; i < size; i++ {
				v := vals.At(i).(json.RawMessage)
				nullable.Set(i, &v)
			}
			return nullable, nil
		}

		return vals, nil
	}

	// if it's not uint64 field, handle the array the old way
	convert := func(v interface{}) (interface{}, error) {
		return v, nil
	}

	switch ft.NonNullableType() {
	case FieldTypeTime:
		convert = func(v interface{}) (interface{}, error) {
			fV, ok := v.(float64)
			if !ok {
				return nil, fmt.Errorf("error reading time")
			}
			return time.Unix(0, int64(fV)*int64(time.Millisecond)).UTC(), nil
		}

	case FieldTypeUint8:
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return uint8(iV), err
		}

	case FieldTypeUint16: // enums and uint16 share the same backings
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return uint16(iV), err
		}

	case FieldTypeEnum: // enums and uint16 share the same backings
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return EnumItemIndex(iV), err
		}

	case FieldTypeUint32:
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return uint32(iV), err
		}
	case FieldTypeInt8:
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return int8(iV), err
		}

	case FieldTypeInt16:
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return int16(iV), err
		}

	case FieldTypeInt32:
		convert = func(v interface{}) (interface{}, error) {
			iV, err := int64FromJSON(v)
			return int32(iV), err
		}

	case FieldTypeFloat32:
		convert = func(v interface{}) (interface{}, error) {
			fV, err := float64FromJSON(v)
			return float32(fV), err
		}

	case FieldTypeFloat64:
		convert = func(v interface{}) (interface{}, error) {
			return float64FromJSON(v)
		}

	case FieldTypeString:
		convert = func(v interface{}) (interface{}, error) {
			str, ok := v.(string)
			if ok {
				return str, nil
			}
			return fmt.Sprintf("%v", v), nil
		}

	case FieldTypeBool:
		convert = func(v interface{}) (interface{}, error) {
			val := v.(bool)
			return val, nil
		}

	case FieldTypeJSON:
		convert = func(v interface{}) (interface{}, error) {
			r, ok := v.(json.RawMessage)
			if ok {
				return r, nil
			}
			return nil, fmt.Errorf("unable to convert to json.RawMessage")
		}
	}

	arr := make([]interface{}, 0)
	err := itere.ReadVal(&arr)
	if err != nil {
		return nil, err
	}
	f := NewFieldFromFieldType(ft, len(arr))
	for i, v := range arr {
		if v != nil {
			norm, err := convert(v)
			if err != nil {
				return nil, err
			}
			f.vector.SetConcrete(i, norm) // will be pointer for nullable types
		}
	}
	return f.vector, nil
}

func readArrayOfNumbers[T any](iter *sdkjsoniter.Iterator, parse func(string) (T, error), reader func() (T, error)) ([]T, error) {
	var def T
	var result []T
	for {
		next, err := iter.ReadArray()
		if err != nil {
			return nil, err
		}
		if !next {
			break
		}
		nextType, err := iter.WhatIsNext()
		if err != nil {
			return nil, err
		}
		switch nextType {
		case sdkjsoniter.StringValue:
			str, err := iter.ReadString()
			if err != nil {
				return nil, err
			}
			u, err := parse(str)
			if err != nil {
				return nil, iter.ReportError(fmt.Sprintf("readArrayOfNumbers[%T]", def), "cannot parse string")
			}
			result = append(result, u)
		case sdkjsoniter.NilValue:
			_, err := iter.ReadNil()
			if err != nil {
				return nil, err
			}
			// add T's default value. For reference type it will be nil, for value types the default value such as 0, false, ""
			// This is the same logic as in `read<Type>VectorJSON`
			result = append(result, def)
		default: // read as a number, if it is not expected field type, there will be error.
			u, err := reader()
			if err != nil {
				return nil, err
			}
			result = append(result, u)
		}
	}
	return result, nil
}

// nolint:gocyclo
func readVector(iter *jsoniter.Iterator, ft FieldType, size int) (vector, error) {
	switch ft {
	// Manual
	case FieldTypeTime:
		return readTimeVectorJSON(iter, false, size)
	case FieldTypeNullableTime:
		return readTimeVectorJSON(iter, true, size)
	case FieldTypeJSON:
		return readJSONVectorJSON(iter, false, size)
	case FieldTypeNullableJSON:
		return readJSONVectorJSON(iter, true, size)

	// Generated
	case FieldTypeUint8:
		return readUint8VectorJSON(iter, size)
	case FieldTypeNullableUint8:
		return readNullableUint8VectorJSON(iter, size)
	case FieldTypeUint16:
		return readUint16VectorJSON(iter, size)
	case FieldTypeNullableUint16:
		return readNullableUint16VectorJSON(iter, size)
	case FieldTypeUint32:
		return readUint32VectorJSON(iter, size)
	case FieldTypeNullableUint32:
		return readNullableUint32VectorJSON(iter, size)
	case FieldTypeUint64:
		return readUint64VectorJSON(iter, size)
	case FieldTypeNullableUint64:
		return readNullableUint64VectorJSON(iter, size)
	case FieldTypeInt8:
		return readInt8VectorJSON(iter, size)
	case FieldTypeNullableInt8:
		return readNullableInt8VectorJSON(iter, size)
	case FieldTypeInt16:
		return readInt16VectorJSON(iter, size)
	case FieldTypeNullableInt16:
		return readNullableInt16VectorJSON(iter, size)
	case FieldTypeInt32:
		return readInt32VectorJSON(iter, size)
	case FieldTypeNullableInt32:
		return readNullableInt32VectorJSON(iter, size)
	case FieldTypeInt64:
		return readInt64VectorJSON(iter, size)
	case FieldTypeNullableInt64:
		return readNullableInt64VectorJSON(iter, size)
	case FieldTypeFloat32:
		return readFloat32VectorJSON(iter, size)
	case FieldTypeNullableFloat32:
		return readNullableFloat32VectorJSON(iter, size)
	case FieldTypeFloat64:
		return readFloat64VectorJSON(iter, size)
	case FieldTypeNullableFloat64:
		return readNullableFloat64VectorJSON(iter, size)
	case FieldTypeString:
		return readStringVectorJSON(iter, size)
	case FieldTypeNullableString:
		return readNullableStringVectorJSON(iter, size)
	case FieldTypeBool:
		return readBoolVectorJSON(iter, size)
	case FieldTypeNullableBool:
		return readNullableBoolVectorJSON(iter, size)
	case FieldTypeEnum:
		return readEnumVectorJSON(iter, size)
	case FieldTypeNullableEnum:
		return readNullableEnumVectorJSON(iter, size)
	}
	return nil, fmt.Errorf("unsuppoted type: %s", ft.ItemTypeString())
}

// This returns the type name that is used in javascript
func getTypeScriptTypeString(t FieldType) (string, bool) {
	if t.Time() {
		return simpleTypeTime, true
	}
	if t.Numeric() {
		return simpleTypeNumber, true
	}
	switch t {
	case FieldTypeBool, FieldTypeNullableBool:
		return simpleTypeBool, true
	case FieldTypeString, FieldTypeNullableString:
		return simpleTypeString, true
	case FieldTypeEnum, FieldTypeNullableEnum:
		return simpleTypeEnum, true
	case FieldTypeJSON, FieldTypeNullableJSON:
		return simpleTypeOther, true
	}
	return "", false
}

func getFieldTypeForArrow(t arrow.DataType, tsType string) FieldType {
	switch t.ID() {
	case arrow.TIMESTAMP:
		return FieldTypeTime
	case arrow.UINT8:
		return FieldTypeUint8
	case arrow.UINT16:
		if tsType == simpleTypeEnum {
			return FieldTypeEnum
		}
		return FieldTypeUint16
	case arrow.UINT32:
		return FieldTypeUint32
	case arrow.UINT64:
		return FieldTypeUint64
	case arrow.INT8:
		return FieldTypeInt8
	case arrow.INT16:
		return FieldTypeInt16
	case arrow.INT32:
		return FieldTypeInt32
	case arrow.INT64:
		return FieldTypeInt64
	case arrow.FLOAT32:
		return FieldTypeFloat32
	case arrow.FLOAT64:
		return FieldTypeFloat64
	case arrow.STRING:
		return FieldTypeString
	case arrow.BOOL:
		return FieldTypeBool
	case arrow.BINARY:
		return FieldTypeJSON
	}
	return FieldTypeUnknown
}

// export interface FieldValueEntityLookup {
// 	NaN?: number[];
// 	Undef?: number[]; // Missing because of absence or join
// 	Inf?: number[];
// 	NegInf?: number[];
//   }

type fieldEntityLookup struct {
	NaN    []int `json:"NaN,omitempty"`
	Inf    []int `json:"Inf,omitempty"`
	NegInf []int `json:"NegInf,omitempty"`
}

const (
	entityNaN         = "NaN"
	entityPositiveInf = "+Inf"
	entityNegativeInf = "-Inf"
)

func (f *fieldEntityLookup) add(str string, idx int) {
	switch str {
	case entityPositiveInf:
		f.Inf = append(f.Inf, idx)
	case entityNegativeInf:
		f.NegInf = append(f.NegInf, idx)
	case entityNaN:
		f.NaN = append(f.NaN, idx)
	}
}

func isSpecialEntity(v float64) (string, bool) {
	switch {
	case math.IsNaN(v):
		return entityNaN, true
	case math.IsInf(v, 1):
		return entityPositiveInf, true
	case math.IsInf(v, -1):
		return entityNegativeInf, true
	default:
		return "", false
	}
}

func writeDataFrame(frame *Frame, stream *jsoniter.Stream, includeSchema bool, includeData bool) {
	stream.WriteObjectStart()
	if includeSchema {
		stream.WriteObjectField(jsonKeySchema)
		writeDataFrameSchema(frame, stream)
	}

	if includeData {
		if includeSchema {
			stream.WriteMore()
		}

		stream.WriteObjectField(jsonKeyData)
		writeDataFrameData(frame, stream)
	}
	stream.WriteObjectEnd()
}

func writeDataFrameSchema(frame *Frame, stream *jsoniter.Stream) {
	started := false
	stream.WriteObjectStart()

	if len(frame.Name) > 0 {
		stream.WriteObjectField("name")
		stream.WriteString(frame.Name)
		started = true
	}

	if len(frame.RefID) > 0 {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("refId")
		stream.WriteString(frame.RefID)
		started = true
	}

	if frame.Meta != nil {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("meta")
		stream.WriteVal(frame.Meta)
		started = true
	}

	if started {
		stream.WriteMore()
	}
	stream.WriteObjectField("fields")
	stream.WriteArrayStart()
	for i, f := range frame.Fields {
		if i > 0 {
			stream.WriteMore()
		}
		started = false
		stream.WriteObjectStart()
		if len(f.Name) > 0 {
			stream.WriteObjectField("name")
			stream.WriteString(f.Name)
			started = true
		}

		t, ok := getTypeScriptTypeString(f.Type())
		if ok {
			if started {
				stream.WriteMore()
			}
			stream.WriteObjectField("type")
			stream.WriteString(t)
			started = true
		}

		ft := f.Type()
		nnt := ft.NonNullableType()
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("typeInfo")
		stream.WriteObjectStart()
		stream.WriteObjectField("frame")
		stream.WriteString(nnt.ItemTypeString())
		if ft.Nullable() {
			stream.WriteMore()
			stream.WriteObjectField("nullable")
			stream.WriteBool(true)
		}
		stream.WriteObjectEnd()
		started = true

		if f.Labels != nil {
			if started {
				stream.WriteMore()
			}
			stream.WriteObjectField("labels")
			stream.WriteVal(f.Labels)
			started = true
		}

		if f.Config != nil {
			if started {
				stream.WriteMore()
			}
			stream.WriteObjectField("config")
			stream.WriteVal(f.Config)
		}

		stream.WriteObjectEnd()
	}
	stream.WriteArrayEnd()

	stream.WriteObjectEnd()
}

func writeDataFrameData(frame *Frame, stream *jsoniter.Stream) {
	rowCount, err := frame.RowLen()
	if err != nil {
		stream.Error = err
		return
	}

	stream.WriteObjectStart()

	entities := make([]*fieldEntityLookup, len(frame.Fields))
	entityCount := 0

	nanos := make([][]int64, len(frame.Fields))
	nsOffSetCount := 0

	stream.WriteObjectField("values")
	stream.WriteArrayStart()
	for fidx, f := range frame.Fields {
		if fidx > 0 {
			stream.WriteMore()
		}
		isTime := f.Type().Time()
		nsTime := make([]int64, rowCount)
		var hasNSTime bool
		isFloat := f.Type() == FieldTypeFloat64 || f.Type() == FieldTypeNullableFloat64 ||
			f.Type() == FieldTypeFloat32 || f.Type() == FieldTypeNullableFloat32

		stream.WriteArrayStart()
		for i := 0; i < rowCount; i++ {
			if i > 0 {
				stream.WriteRaw(",")
			}
			if v, ok := f.ConcreteAt(i); ok {
				switch {
				case isTime:
					t := v.(time.Time)
					stream.WriteVal(t.UnixMilli())
					msRes := t.Truncate(time.Millisecond)
					ns := t.Sub(msRes).Nanoseconds()
					if ns != 0 {
						hasNSTime = true
						nsTime[i] = ns
					}
				case isFloat:
					// For float and nullable float we check whether a value is a special
					// entity (NaN, -Inf, +Inf) not supported by JSON spec, we then encode this
					// information into a separate field to restore on a consumer side (setting
					// null to the entity position in data). Since we are using f.ConcreteAt
					// above the value is always float64 or float32 types, and never a *float64
					// or *float32.
					var f64 float64
					switch vt := v.(type) {
					case float64:
						f64 = vt
					case float32:
						f64 = float64(vt)
					default:
						stream.Error = fmt.Errorf("unsupported float type: %T", v)
						return
					}
					if entityType, found := isSpecialEntity(f64); found {
						if entities[fidx] == nil {
							entities[fidx] = &fieldEntityLookup{}
						}
						entities[fidx].add(entityType, i)
						entityCount++
						stream.WriteNil()
					} else {
						stream.WriteVal(v)
					}
				default:
					stream.WriteVal(v)
				}
			} else {
				stream.WriteNil()
			}
		}
		stream.WriteArrayEnd()
		if hasNSTime {
			nanos[fidx] = nsTime
			nsOffSetCount++
		}
	}
	stream.WriteArrayEnd()

	if entityCount > 0 {
		stream.WriteMore()
		stream.WriteObjectField("entities")
		stream.WriteVal(entities)
	}

	if nsOffSetCount > 0 {
		stream.WriteMore()
		stream.WriteObjectField("nanos")
		stream.WriteVal(nanos)
	}

	stream.WriteObjectEnd()
}

func writeDataFrames(frames *Frames, stream *jsoniter.Stream) {
	if frames == nil {
		return
	}
	stream.WriteArrayStart()
	for _, frame := range *frames {
		stream.WriteVal(frame)
	}
	stream.WriteArrayEnd()
}

// ArrowBufferToJSON writes a frame to JSON
// NOTE: the format should be considered experimental until grafana 8 is released.
func ArrowBufferToJSON(b []byte, include FrameInclude) ([]byte, error) {
	fB := filebuffer.New(b)
	fR, err := ipc.NewFileReader(fB)
	if err != nil {
		return nil, err
	}
	defer func() { _ = fR.Close() }()

	record, err := fR.Read()
	if errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("no records found")
	}
	if err != nil {
		return nil, err
	}
	// TODO?? multiple records in one file?

	return ArrowToJSON(record, include)
}

// ArrowToJSON writes a frame to JSON
// NOTE: the format should be considered experimental until grafana 8 is released.
func ArrowToJSON(record arrow.Record, include FrameInclude) ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	started := false
	stream.WriteObjectStart()
	if include == IncludeAll || include == IncludeSchemaOnly {
		stream.WriteObjectField("schema")
		writeArrowSchema(stream, record)
		started = true
	}
	if include == IncludeAll || include == IncludeDataOnly {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("data")
		err := writeArrowData(stream, record)
		if err != nil {
			return nil, err
		}
	}

	stream.WriteObjectEnd()

	if stream.Error != nil {
		return nil, stream.Error
	}
	return append([]byte(nil), stream.Buffer()...), nil
}

func writeArrowSchema(stream *jsoniter.Stream, record arrow.Record) {
	started := false
	metaData := record.Schema().Metadata()

	stream.WriteObjectStart()

	name, _ := getMDKey(metadataKeyName, metaData) // No need to check ok, zero value ("") is returned
	refID, _ := getMDKey(metadataKeyRefID, metaData)

	if len(name) > 0 {
		stream.WriteObjectField("name")
		stream.WriteString(name)
		started = true
	}

	if len(refID) > 0 {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("refId")
		stream.WriteString(refID)
		started = true
	}

	if metaAsString, ok := getMDKey("meta", metaData); ok {
		if started {
			stream.WriteMore()
		}
		stream.WriteObjectField("meta")
		stream.WriteRaw(metaAsString)
		started = true
	}

	if started {
		stream.WriteMore()
	}
	stream.WriteObjectField("fields")
	stream.WriteArrayStart()
	for i, f := range record.Schema().Fields() {
		if i > 0 {
			stream.WriteMore()
		}
		started = false
		stream.WriteObjectStart()
		if len(f.Name) > 0 {
			stream.WriteObjectField("name")
			stream.WriteString(f.Name)
			started = true
		}

		tsType, ok := getMDKey(metadataKeyTSType, f.Metadata)
		ft := getFieldTypeForArrow(f.Type, tsType)
		if !ok {
			tsType, ok = getTypeScriptTypeString(ft)
		}

		if ok {
			if started {
				stream.WriteMore()
			}
			stream.WriteObjectField("type")
			stream.WriteString(tsType)

			nnt := ft.NonNullableType()
			stream.WriteMore()
			stream.WriteObjectField("typeInfo")
			stream.WriteObjectStart()
			stream.WriteObjectField("frame")
			stream.WriteString(nnt.ItemTypeString())
			if f.Nullable {
				stream.WriteMore()
				stream.WriteObjectField("nullable")
				stream.WriteBool(true)
			}
			stream.WriteObjectEnd()
		}

		if labelsAsString, ok := getMDKey("labels", f.Metadata); ok {
			stream.WriteMore()
			stream.WriteObjectField("labels")
			stream.WriteRaw(labelsAsString)
		}
		if labelsAsString, ok := getMDKey("config", f.Metadata); ok {
			stream.WriteMore()
			stream.WriteObjectField("config")
			stream.WriteRaw(labelsAsString)
		}

		stream.WriteObjectEnd()
	}
	stream.WriteArrayEnd()

	stream.WriteObjectEnd()
}

func writeArrowData(stream *jsoniter.Stream, record arrow.Record) error {
	fieldCount := len(record.Schema().Fields())

	stream.WriteObjectStart()

	entities := make([]*fieldEntityLookup, fieldCount)
	nanos := make([][]int64, fieldCount)
	var hasNano bool
	entityCount := 0

	stream.WriteObjectField("values")
	stream.WriteArrayStart()
	for fidx := 0; fidx < fieldCount; fidx++ {
		if fidx > 0 {
			stream.WriteMore()
		}
		col := record.Column(fidx)
		var ent *fieldEntityLookup

		switch col.DataType().ID() {
		case arrow.TIMESTAMP:
			nanoOffset := writeArrowDataTIMESTAMP(stream, col)
			if nanoOffset != nil {
				nanos[fidx] = nanoOffset
				hasNano = true
			}

		case arrow.UINT8:
			ent = writeArrowDataUint8(stream, col)
		case arrow.UINT16:
			ent = writeArrowDataUint16(stream, col)
		case arrow.UINT32:
			ent = writeArrowDataUint32(stream, col)
		case arrow.UINT64:
			ent = writeArrowDataUint64(stream, col)
		case arrow.INT8:
			ent = writeArrowDataInt8(stream, col)
		case arrow.INT16:
			ent = writeArrowDataInt16(stream, col)
		case arrow.INT32:
			ent = writeArrowDataInt32(stream, col)
		case arrow.INT64:
			ent = writeArrowDataInt64(stream, col)
		case arrow.FLOAT32:
			ent = writeArrowDataFloat32(stream, col)
		case arrow.FLOAT64:
			ent = writeArrowDataFloat64(stream, col)
		case arrow.STRING:
			ent = writeArrowDataString(stream, col)
		case arrow.BOOL:
			ent = writeArrowDataBool(stream, col)
		case arrow.BINARY:
			ent = writeArrowDataBinary(stream, col)
		default:
			return fmt.Errorf("unsupported arrow type %s for JSON", col.DataType().ID())
		}

		if ent != nil {
			entities[fidx] = ent
			entityCount++
		}
	}
	stream.WriteArrayEnd()

	if entityCount > 0 {
		stream.WriteMore()
		stream.WriteObjectField("entities")
		stream.WriteVal(entities)
	}

	if hasNano {
		stream.WriteMore()
		stream.WriteObjectField("nanos")
		stream.WriteVal(nanos)
	}

	stream.WriteObjectEnd()
	return nil
}

// Custom timestamp extraction... assumes nanoseconds for everything now
func writeArrowDataTIMESTAMP(stream *jsoniter.Stream, col arrow.Array) []int64 {
	count := col.Len()
	var hasNSTime bool
	nsTime := make([]int64, count)
	v := array.NewTimestampData(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		ns := v.Value(i)
		ms := int64(ns) / int64(time.Millisecond) // nanosecond assumption
		stream.WriteInt64(ms)

		nsOffSet := int64(ns) - ms*int64(1e6)
		if nsOffSet != 0 {
			hasNSTime = true
			nsTime[i] = nsOffSet
		}

		if stream.Error != nil { // ???
			stream.Error = nil
			stream.WriteNil()
		}
	}
	stream.WriteArrayEnd()
	if hasNSTime {
		return nsTime
	}
	return nil
}

func readTimeVectorJSON(iter *jsoniter.Iterator, nullable bool, size int) (vector, error) {
	var arr vector
	if nullable {
		arr = newNullableTimeTimeVector(size)
	} else {
		arr = newTimeTimeVector(size)
	}

	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readUint8VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == sdkjsoniter.NilValue {
			iter.ReadNil()
		} else {
			ms := iter.ReadInt64()

			tv := time.Unix(ms/int64(1e+3), (ms%int64(1e+3))*int64(1e+6)).UTC()
			arr.SetConcrete(i, tv)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readJSONVectorJSON(iter *jsoniter.Iterator, nullable bool, size int) (vector, error) {
	var arr vector
	if nullable {
		arr = newNullableJsonRawMessageVector(size)
	} else {
		arr = newJsonRawMessageVector(size)
	}

	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readJSONVectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == sdkjsoniter.NilValue {
			iter.ReadNil()
		} else {
			var v json.RawMessage
			iter.ReadVal(&v)
			arr.SetConcrete(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}
