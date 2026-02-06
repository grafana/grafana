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

package variant

import (
	"bytes"
	"cmp"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"slices"
	"strings"
	"time"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/google/uuid"
	"golang.org/x/exp/constraints"
)

// Builder is used to construct Variant values by appending data of various types.
// It manages an internal buffer for the value data and a dictionary for field keys.
type Builder struct {
	buf             bytes.Buffer
	dict            map[string]uint32
	dictKeys        [][]byte
	totalDictSize   int
	allowDuplicates bool
}

func NewBuilderFromMeta(m Metadata) *Builder {
	b := new(Builder)

	b.dictKeys = m.keys
	b.dict = make(map[string]uint32)
	for i, key := range m.keys {
		b.dict[string(key)] = uint32(i)
		b.totalDictSize += len(key)
	}

	return b
}

// SetAllowDuplicates controls whether duplicate keys are allowed in objects.
// When true, the last value for a key is used. When false, an error is returned
// if a duplicate key is detected.
func (b *Builder) SetAllowDuplicates(allow bool) {
	b.allowDuplicates = allow
}

// AddKey adds a key to the builder's dictionary and returns its ID.
// If the key already exists in the dictionary, its existing ID is returned.
func (b *Builder) AddKey(key string) (id uint32) {
	if b.dict == nil {
		b.dict = make(map[string]uint32)
		b.dictKeys = make([][]byte, 0, 16)
	}

	var ok bool
	if id, ok = b.dict[key]; ok {
		return id
	}

	id = uint32(len(b.dictKeys))
	b.dict[key] = id
	b.dictKeys = append(b.dictKeys, unsafe.Slice(unsafe.StringData(key), len(key)))
	b.totalDictSize += len(key)

	return id
}

// AppendOpt represents options for appending time-related values. These are only
// used when using the generic Append method that takes an interface{}.
type AppendOpt int16

const (
	// OptTimestampNano specifies that timestamps should use nanosecond precision,
	// otherwise microsecond precision is used.
	OptTimestampNano AppendOpt = 1 << iota
	// OptTimestampUTC specifies that timestamps should be in UTC timezone, otherwise
	// no time zone (NTZ) is used.
	OptTimestampUTC
	// OptTimeAsDate specifies that time.Time values should be encoded as dates
	OptTimeAsDate
	// OptTimeAsTime specifies that time.Time values should be encoded as a time value
	OptTimeAsTime
)

func extractFieldInfo(f reflect.StructField) (name string, o AppendOpt) {
	tag := f.Tag.Get("variant")
	if tag == "" {
		return f.Name, 0
	}

	parts := strings.Split(tag, ",")
	if len(parts) == 1 {
		return parts[0], 0
	}

	name = parts[0]
	if name == "" {
		name = f.Name
	}

	for _, opt := range parts[1:] {
		switch strings.ToLower(opt) {
		case "nanos":
			o |= OptTimestampNano
		case "utc":
			o |= OptTimestampUTC
		case "date":
			o |= OptTimeAsDate
		case "time":
			o |= OptTimeAsTime
		}
	}

	return name, o
}

// Append adds a value of any supported type to the builder.
//
// Any basic primitive type is supported, the AppendOpt options are used to control how
// timestamps are appended (e.g., as microseconds or nanoseconds and timezone). The options
// also control how a [time.Time] value is appended (e.g., as a date, timestamp, or time).
//
// Appending a value with type `[]any` will construct an array appropriately, appending
// each element. Calling with a map[string]any will construct an object, recursively calling
// Append for each value, propagating the options.
//
// For other types (arbitrary slices, arrays, maps and structs), reflection is used to determine
// the type and whether we can append it. A nil pointer will append a null, while a non-nil
// pointer will append the value that it points to.
//
// For structs, field tags can be used to control the field names and options. Only exported
// fields are considered, with the field name being used as the key. A struct tag of `variant`
// can be used with the following format and options:
//
//			type MyStruct struct {
//				Field1    string    `variant:"key"`           // Use "key" instead of "Field1" as the field name
//				Field2    time.Time `variant:"day,date"`      // Use "day" instead of "Field2" as the field name
//		                                                      // append this value as a "date" value
//	         Time      time.Time `variant:",time"`         // Use "Time" as the field name, append the value as
//		                                                      // a "time" value
//	         Field3    int       `variant:"-"`             // Ignore this field
//	         Timestamp time.Time `variant:"ts"`            // Use "ts" as the field name, append value as a
//		                                                      // timestamp(UTC=false,MICROS)
//			    Ts2       time.Time `variant:"ts2,nanos,utc"` // Use "ts2" as the field name, append value as a
//															  // timestamp(UTC=true,NANOS)
//			}
//
// There is only one case where options can conflict currently: If both [OptTimeAsDate] and
// [OptTimeAsTime] are set, then [OptTimeAsDate] will take precedence.
//
// Options specified in the struct tags will be OR'd with any options passed to the original call
// to Append. As a result, if a Struct field tag sets [OptTimeAsTime], but the call to Append
// passes [OptTimeAsDate], then the value will be appended as a date since that option takes
// precedence.
func (b *Builder) Append(v any, opts ...AppendOpt) error {
	var o AppendOpt
	for _, opt := range opts {
		o |= opt
	}

	return b.append(v, o)
}

func (b *Builder) append(v any, o AppendOpt) error {
	switch v := v.(type) {
	case nil:
		return b.AppendNull()
	case bool:
		return b.AppendBool(v)
	case int8:
		return b.AppendInt(int64(v))
	case uint8:
		return b.AppendInt(int64(v))
	case int16:
		return b.AppendInt(int64(v))
	case uint16:
		return b.AppendInt(int64(v))
	case int32:
		return b.AppendInt(int64(v))
	case uint32:
		return b.AppendInt(int64(v))
	case int64:
		return b.AppendInt(v)
	case int:
		return b.AppendInt(int64(v))
	case uint:
		return b.AppendInt(int64(v))
	case float32:
		return b.AppendFloat32(v)
	case float64:
		return b.AppendFloat64(v)
	case arrow.Date32:
		return b.AppendDate(v)
	case arrow.Time64:
		return b.AppendTimeMicro(v)
	case arrow.Timestamp:
		return b.AppendTimestamp(v, o&OptTimestampNano == 0, o&OptTimestampUTC != 0)
	case []byte:
		return b.AppendBinary(v)
	case string:
		return b.AppendString(v)
	case uuid.UUID:
		return b.AppendUUID(v)
	case time.Time:
		switch {
		case o&OptTimeAsDate != 0:
			return b.AppendDate(arrow.Date32FromTime(v))
		case o&OptTimeAsTime != 0:
			t := v.Sub(v.Truncate(24 * time.Hour))
			return b.AppendTimeMicro(arrow.Time64(t.Microseconds()))
		default:
			unit := arrow.Microsecond
			if o&OptTimestampNano != 0 {
				unit = arrow.Nanosecond
			}

			if o&OptTimestampUTC != 0 {
				v = v.UTC()
			}

			t, err := arrow.TimestampFromTime(v, unit)
			if err != nil {
				return err
			}

			return b.AppendTimestamp(t, o&OptTimestampNano == 0, o&OptTimestampUTC != 0)
		}
	case DecimalValue[decimal.Decimal32]:
		return b.AppendDecimal4(v.Scale, v.Value.(decimal.Decimal32))
	case DecimalValue[decimal.Decimal64]:
		return b.AppendDecimal8(v.Scale, v.Value.(decimal.Decimal64))
	case DecimalValue[decimal.Decimal128]:
		return b.AppendDecimal16(v.Scale, v.Value.(decimal.Decimal128))
	case []any:
		start, offsets := b.Offset(), make([]int, 0, len(v))
		for _, item := range v {
			offsets = append(offsets, b.NextElement(start))
			if err := b.append(item, o); err != nil {
				return err
			}
		}
		return b.FinishArray(start, offsets)
	case map[string]any:
		start, fields := b.Offset(), make([]FieldEntry, 0, len(v))
		for key, item := range v {
			fields = append(fields, b.NextField(start, key))
			if err := b.append(item, o); err != nil {
				return err
			}
		}
		return b.FinishObject(start, fields)
	default:
		// attempt to use reflection before we give up!
		val := reflect.ValueOf(v)
		switch val.Kind() {
		case reflect.Pointer, reflect.Interface:
			if val.IsNil() {
				return b.AppendNull()
			}
			return b.append(val.Elem().Interface(), o)
		case reflect.Array, reflect.Slice:
			start, offsets := b.Offset(), make([]int, 0, val.Len())
			for _, item := range val.Seq2() {
				offsets = append(offsets, b.NextElement(start))
				if err := b.append(item.Interface(), o); err != nil {
					return err
				}
			}
			return b.FinishArray(start, offsets)
		case reflect.Map:
			if val.Type().Key().Kind() != reflect.String {
				return fmt.Errorf("unsupported map key type: %s", val.Type().Key())
			}

			start, fields := b.Offset(), make([]FieldEntry, 0, val.Len())
			for k, v := range val.Seq2() {
				fields = append(fields, b.NextField(start, k.String()))
				if err := b.append(v.Interface(), o); err != nil {
					return err
				}
			}
			return b.FinishObject(start, fields)
		case reflect.Struct:
			start, fields := b.Offset(), make([]FieldEntry, 0, val.NumField())

			typ := val.Type()
			for i := range typ.NumField() {
				f := typ.Field(i)
				if !f.IsExported() {
					continue
				}

				name, opt := extractFieldInfo(f)
				if name == "-" {
					continue
				}

				fields = append(fields, b.NextField(start, name))
				if err := b.append(val.Field(i).Interface(), o|opt); err != nil {
					return err
				}
			}
			return b.FinishObject(start, fields)
		}
	}
	return fmt.Errorf("cannot append unsupported type to variant: %T", v)
}

// AppendNull appends a null value to the builder.
func (b *Builder) AppendNull() error {
	return b.buf.WriteByte(primitiveHeader(PrimitiveNull))
}

// AppendBool appends a boolean value to the builder.
func (b *Builder) AppendBool(v bool) error {
	var t PrimitiveType
	if v {
		t = PrimitiveBoolTrue
	} else {
		t = PrimitiveBoolFalse
	}

	return b.buf.WriteByte(primitiveHeader(t))
}

type primitiveNumeric interface {
	int8 | int16 | int32 | int64 | float32 | float64 |
		arrow.Date32 | arrow.Time64
}

type buffer interface {
	io.Writer
	io.ByteWriter
}

func writeBinary[T string | []byte](w buffer, v T) error {
	var t PrimitiveType
	switch any(v).(type) {
	case string:
		t = PrimitiveString
	case []byte:
		t = PrimitiveBinary
	}

	if err := w.WriteByte(primitiveHeader(t)); err != nil {
		return err
	}

	if err := binary.Write(w, binary.LittleEndian, uint32(len(v))); err != nil {
		return err
	}

	_, err := w.Write([]byte(v))
	return err
}

func writeNumeric[T primitiveNumeric](w buffer, v T) error {
	var t PrimitiveType
	switch any(v).(type) {
	case int8:
		t = PrimitiveInt8
	case int16:
		t = PrimitiveInt16
	case int32:
		t = PrimitiveInt32
	case int64:
		t = PrimitiveInt64
	case float32:
		t = PrimitiveFloat
	case float64:
		t = PrimitiveDouble
	case arrow.Date32:
		t = PrimitiveDate
	case arrow.Time64:
		t = PrimitiveTimeMicrosNTZ
	}

	if err := w.WriteByte(primitiveHeader(t)); err != nil {
		return err
	}

	return binary.Write(w, binary.LittleEndian, v)
}

// AppendInt appends an integer value to the builder, using the smallest
// possible integer representation based on the value's range.
func (b *Builder) AppendInt(v int64) error {
	b.buf.Grow(9)
	switch {
	case v >= math.MinInt8 && v <= math.MaxInt8:
		return writeNumeric(&b.buf, int8(v))
	case v >= math.MinInt16 && v <= math.MaxInt16:
		return writeNumeric(&b.buf, int16(v))
	case v >= math.MinInt32 && v <= math.MaxInt32:
		return writeNumeric(&b.buf, int32(v))
	default:
		return writeNumeric(&b.buf, v)
	}
}

// AppendFloat32 appends a 32-bit floating point value to the builder.
func (b *Builder) AppendFloat32(v float32) error {
	b.buf.Grow(5)
	return writeNumeric(&b.buf, v)
}

// AppendFloat64 appends a 64-bit floating point value to the builder.
func (b *Builder) AppendFloat64(v float64) error {
	b.buf.Grow(9)
	return writeNumeric(&b.buf, v)
}

// AppendDate appends a date value to the builder.
func (b *Builder) AppendDate(v arrow.Date32) error {
	b.buf.Grow(5)
	return writeNumeric(&b.buf, v)
}

// AppendTimeMicro appends a time value with microsecond precision to the builder.
func (b *Builder) AppendTimeMicro(v arrow.Time64) error {
	b.buf.Grow(9)
	return writeNumeric(&b.buf, v)
}

// AppendTimestamp appends a timestamp value to the builder.
// The useMicros parameter controls whether microsecond or nanosecond precision is used.
// The useUTC parameter controls whether the timestamp is in UTC timezone or has no time zone (NTZ).
func (b *Builder) AppendTimestamp(v arrow.Timestamp, useMicros, useUTC bool) error {
	b.buf.Grow(9)
	var t PrimitiveType
	if useMicros {
		t = PrimitiveTimestampMicrosNTZ
	} else {
		t = PrimitiveTimestampNanosNTZ
	}

	if useUTC {
		t--
	}

	if err := b.buf.WriteByte(primitiveHeader(t)); err != nil {
		return err
	}

	return binary.Write(&b.buf, binary.LittleEndian, v)
}

// AppendBinary appends a binary value to the builder.
func (b *Builder) AppendBinary(v []byte) error {
	b.buf.Grow(5 + len(v))
	return writeBinary(&b.buf, v)
}

// AppendString appends a string value to the builder.
// Small strings are encoded using the short string representation if small enough.
func (b *Builder) AppendString(v string) error {
	if len(v) > maxShortStringSize {
		b.buf.Grow(5 + len(v))
		return writeBinary(&b.buf, v)
	}

	b.buf.Grow(1 + len(v))
	if err := b.buf.WriteByte(shortStrHeader(len(v))); err != nil {
		return err
	}

	_, err := b.buf.WriteString(v)
	return err
}

// AppendUUID appends a UUID value to the builder.
func (b *Builder) AppendUUID(v uuid.UUID) error {
	b.buf.Grow(17)
	if err := b.buf.WriteByte(primitiveHeader(PrimitiveUUID)); err != nil {
		return err
	}

	m, _ := v.MarshalBinary()
	_, err := b.buf.Write(m)
	return err
}

// AppendDecimal4 appends a 4-byte decimal value with the specified scale to the builder.
func (b *Builder) AppendDecimal4(scale uint8, v decimal.Decimal32) error {
	b.buf.Grow(6)
	if err := b.buf.WriteByte(primitiveHeader(PrimitiveDecimal4)); err != nil {
		return err
	}

	if err := b.buf.WriteByte(scale); err != nil {
		return err
	}

	return binary.Write(&b.buf, binary.LittleEndian, int32(v))
}

// AppendDecimal8 appends a 8-byte decimal value with the specified scale to the builder.
func (b *Builder) AppendDecimal8(scale uint8, v decimal.Decimal64) error {
	b.buf.Grow(10)
	return errors.Join(
		b.buf.WriteByte(primitiveHeader(PrimitiveDecimal8)),
		b.buf.WriteByte(scale),
		binary.Write(&b.buf, binary.LittleEndian, int64(v)),
	)
}

// AppendDecimal16 appends a 16-byte decimal value with the specified scale to the builder.
func (b *Builder) AppendDecimal16(scale uint8, v decimal.Decimal128) error {
	b.buf.Grow(18)
	return errors.Join(
		b.buf.WriteByte(primitiveHeader(PrimitiveDecimal16)),
		b.buf.WriteByte(scale),
		binary.Write(&b.buf, binary.LittleEndian, v.LowBits()),
		binary.Write(&b.buf, binary.LittleEndian, v.HighBits()),
	)
}

// Offset returns the current offset in the builder's buffer. Generally used for
// grabbing a starting point for building an array or object.
func (b *Builder) Offset() int {
	return b.buf.Len()
}

// NextElement returns the offset of the next element relative to the start position.
// Use when building arrays to track element positions. The following creates a variant
// equivalent to `[5, 10]`.
//
//	var b variant.Builder
//	start, offsets := b.Offset(), make([]int, 0)
//	offsets = append(offsets, b.NextElement(start))
//	b.Append(5)
//	offsets = append(offsets, b.NextElement(start))
//	b.Append(10)
//	b.FinishArray(start, offsets)
//
// The value returned by this is equivalent to `b.Offset() - start`, as offsets are all
// relative to the start position. This allows for creating nested arrays, the following
// creates a variant equivalent to `[5, [10, 20], 30]`.
//
//	var b variant.Builder
//	start, offsets := b.Offset(), make([]int, 0)
//	offsets = append(offsets, b.NextElement(start))
//	b.Append(5)
//	offsets = append(offsets, b.NextElement(start))
//
//	nestedStart, nestedOffsets := b.Offset(), make([]int, 0)
//	nestedOffsets = append(nestedOffsets, b.NextElement(nestedStart))
//	b.Append(10)
//	nestedOffsets = append(nestedOffsets, b.NextElement(nestedStart))
//	b.Append(20)
//	b.FinishArray(nestedStart, nestedOffsets)
//
//	offsets = append(offsets, b.NextElement(start))
//	b.Append(30)
//	b.FinishArray(start, offsets)
func (b *Builder) NextElement(start int) int {
	return b.Offset() - start
}

// FinishArray finalizes an array value in the builder.
// The start parameter is the offset where the array begins.
// The offsets parameter contains the offsets of each element in the array. See [Builder.NextElement]
// for examples of how to use this.
func (b *Builder) FinishArray(start int, offsets []int) error {
	var (
		dataSize, sz = b.buf.Len() - start, len(offsets)
		isLarge      = sz > math.MaxUint8
		sizeBytes    = 1
	)

	if isLarge {
		sizeBytes = 4
	}

	if dataSize < 0 {
		return errors.New("invalid array size")
	}

	offsetSize := intSize(dataSize)
	headerSize := 1 + sizeBytes + (sz+1)*int(offsetSize)

	// shift the just written data to make room for the header section
	b.buf.Grow(headerSize)
	av := b.buf.AvailableBuffer()
	if _, err := b.buf.Write(av[:headerSize]); err != nil {
		return err
	}

	bs := b.buf.Bytes()
	copy(bs[start+headerSize:], bs[start:start+dataSize])

	// populate the header
	bs[start] = arrayHeader(isLarge, offsetSize)
	writeOffset(bs[start+1:], sz, uint8(sizeBytes))

	offsetsStart := start + 1 + sizeBytes
	for i, off := range offsets {
		writeOffset(bs[offsetsStart+i*int(offsetSize):], off, offsetSize)
	}
	writeOffset(bs[offsetsStart+sz*int(offsetSize):], dataSize, offsetSize)

	return nil
}

// FieldEntry represents a field in an object, with its key, ID, and offset.
// Usually constructed by using [Builder.NextField] and then passed to [Builder.FinishObject].
type FieldEntry struct {
	Key    string
	ID     uint32
	Offset int
}

// NextField creates a new field entry for an object with the given key.
// The start parameter is the offset where the object begins. The following example would
// construct a variant equivalent to `{"key1": 5, "key2": 10}`.
//
//	var b variant.Builder
//	start, fields := b.Offset(), make([]variant.FieldEntry, 0)
//	fields = append(fields, b.NextField(start, "key1"))
//	b.Append(5)
//	fields = append(fields, b.NextField(start, "key2"))
//	b.Append(10)
//	b.FinishObject(start, fields)
//
// This allows for creating nested objects, the following example would create a variant
// equivalent to `{"key1": 5, "key2": {"key3": 10, "key4": 20}, "key5": 30}`.
//
//	var b variant.Builder
//	start, fields := b.Offset(), make([]variant.FieldEntry, 0)
//	fields = append(fields, b.NextField(start, "key1"))
//	b.Append(5)
//	fields = append(fields, b.NextField(start, "key2"))
//	nestedStart, nestedFields := b.Offset(), make([]variant.FieldEntry, 0)
//	nestedFields = append(nestedFields, b.NextField(nestedStart, "key3"))
//	b.Append(10)
//	nestedFields = append(nestedFields, b.NextField(nestedStart, "key4"))
//	b.Append(20)
//	b.FinishObject(nestedStart, nestedFields)
//	fields = append(fields, b.NextField(start, "key5"))
//	b.Append(30)
//	b.FinishObject(start, fields)
//
// The offset value returned by this is equivalent to `b.Offset() - start`, as offsets are all
// relative to the start position. The key provided will be passed to the [Builder.AddKey] method
// to ensure that the key is added to the dictionary and an ID is assigned. It will re-use existing
// IDs if the key already exists in the dictionary.
func (b *Builder) NextField(start int, key string) FieldEntry {
	id := b.AddKey(key)
	return FieldEntry{
		Key:    key,
		ID:     id,
		Offset: b.Offset() - start,
	}
}

// FinishObject finalizes an object value in the builder.
// The start parameter is the offset where the object begins.
// The fields parameter contains the entries for each field in the object. See [Builder.NextField]
// for examples of how to use this.
//
// The fields are sorted by key before finalizing the object. If duplicate keys are found,
// the last value for a key is kept if [Builder.SetAllowDuplicates] is set to true. If false,
// an error is returned.
func (b *Builder) FinishObject(start int, fields []FieldEntry) error {
	slices.SortFunc(fields, func(a, b FieldEntry) int {
		return cmp.Compare(a.Key, b.Key)
	})

	sz := len(fields)
	var maxID uint32
	if sz > 0 {
		maxID = fields[0].ID
	}

	// if a duplicate key is found, one of two things happens:
	// - if allowDuplicates is true, then the field with the greatest
	//    offset value (the last appended field) is kept.
	// - if allowDuplicates is false, then an error is returned
	if b.allowDuplicates {
		distinctPos := 0
		// maintain a list of distinct keys in-place
		for i := 1; i < sz; i++ {
			maxID = max(maxID, fields[i].ID)
			if fields[i].ID == fields[i-1].ID {
				// found a duplicate key. keep the
				// field with a greater offset
				if fields[distinctPos].Offset < fields[i].Offset {
					fields[distinctPos].Offset = fields[i].Offset
				}
			} else {
				// found distinct key, add field to the list
				distinctPos++
				fields[distinctPos] = fields[i]
			}
		}

		if distinctPos+1 < len(fields) {
			sz = distinctPos + 1
			// resize fields to size
			fields = fields[:sz]
			// sort the fields by offsets so that we can move the value
			// data of each field to the new offset without overwriting the
			// fields after it.
			slices.SortFunc(fields, func(a, b FieldEntry) int {
				return cmp.Compare(a.Offset, b.Offset)
			})

			buf := b.buf.Bytes()
			curOffset := 0
			for i := range sz {
				oldOffset := fields[i].Offset
				fieldSize := valueSize(buf[start+oldOffset:])
				copy(buf[start+curOffset:], buf[start+oldOffset:start+oldOffset+fieldSize])
				fields[i].Offset = curOffset
				curOffset += fieldSize
			}
			b.buf.Truncate(start + curOffset)
			// change back to sort order by field keys to meet variant spec
			slices.SortFunc(fields, func(a, b FieldEntry) int {
				return cmp.Compare(a.Key, b.Key)
			})
		}
	} else {
		for i := 1; i < sz; i++ {
			maxID = max(maxID, fields[i].ID)
			if fields[i].Key == fields[i-1].Key {
				return fmt.Errorf("disallowed duplicate key found: %s", fields[i].Key)
			}
		}
	}

	var (
		dataSize  = b.buf.Len() - start
		isLarge   = sz > math.MaxUint8
		sizeBytes = 1
	)

	if isLarge {
		sizeBytes = 4
	}

	if dataSize < 0 {
		return errors.New("invalid object size")
	}

	idSize, offsetSize := intSize(int(maxID)), intSize(dataSize)
	headerSize := 1 + sizeBytes + sz*int(idSize) + (sz+1)*int(offsetSize)
	// shift the just written data to make room for the header section
	b.buf.Grow(headerSize)
	av := b.buf.AvailableBuffer()
	if _, err := b.buf.Write(av[:headerSize]); err != nil {
		return err
	}

	bs := b.buf.Bytes()
	copy(bs[start+headerSize:], bs[start:start+dataSize])

	// populate the header
	bs[start] = objectHeader(isLarge, idSize, offsetSize)
	writeOffset(bs[start+1:], sz, uint8(sizeBytes))

	idStart := start + 1 + sizeBytes
	offsetStart := idStart + sz*int(idSize)
	for i, field := range fields {
		writeOffset(bs[idStart+i*int(idSize):], int(field.ID), idSize)
		writeOffset(bs[offsetStart+i*int(offsetSize):], field.Offset, offsetSize)
	}
	writeOffset(bs[offsetStart+sz*int(offsetSize):], dataSize, offsetSize)
	return nil
}

// UnsafeAppendEncoded is a special case where we directly append a pre-encoded variant
// value. Its keys must already be in the dictionary and v must already be
// a properly encoded variant value. No checking is performed here currently, so
// be careful as this can easily lead to an invalid variant result.
func (b *Builder) UnsafeAppendEncoded(v []byte) error {
	// this is a special case where we append a pre-encoded value.
	// the value must be a valid variant value, so it must start with
	// a primitive header byte.
	_, err := b.buf.Write(v)
	return err
}

// Reset truncates the builder's buffer and clears the dictionary while re-using the
// underlying storage where possible. This allows for reusing the builder while keeping
// the total memory usage low. The caveat to this is that any variant value returned
// by calling [Builder.Build] must be cloned with [Value.Clone] before calling this
// method. Otherwise, the byte slice used by the value will be invalidated upon calling
// this method.
//
// For trivial cases where the builder is not reused, this method never needs to be called,
// and the variant built by the builder gets to avoid having to copy the buffer, just referring
// to it directly.
func (b *Builder) Reset() {
	b.buf.Reset()
	b.dict = make(map[string]uint32)
	for i := range b.dictKeys {
		b.dictKeys[i] = nil
	}
	b.dictKeys = b.dictKeys[:0]
}

// BuildWithoutMeta returns just the raw variant bytes that were built without
// constructing metadata at all. This is useful for the case where we're building
// the remainder of a shredded variant and don't need to re-construct the metadata
// for the result.
func (b *Builder) BuildWithoutMeta() []byte {
	return b.buf.Bytes()
}

// Build creates a Variant Value from the builder's current state.
// The returned Value includes both the value data and the metadata (dictionary).
//
// Importantly, the value data is the returned variant value is not copied here. This will
// return the raw buffer data owned by the builder's buffer. If you wish to reuse a builder,
// then the [Value.Clone] method must be called on the returned value to copy the data before
// calling [Builder.Reset]. This enables trivial cases that don't reuse the builder to avoid
// performing this copy.
func (b *Builder) Build() (Value, error) {
	nkeys := len(b.dictKeys)

	// determine the number of bytes required per offset entry.
	// the largest offset is the one-past-the-end value, the total size.
	// It's very unlikely that the number of keys could be larger, but
	// incorporate that into the calculation in case of pathological data.
	maxSize := max(b.totalDictSize, nkeys)
	if maxSize > metadataMaxSizeLimit {
		return Value{}, fmt.Errorf("metadata size too large: %d", maxSize)
	}

	offsetSize := intSize(int(maxSize))
	offsetStart := 1 + offsetSize
	stringStart := int(offsetStart) + (nkeys+1)*int(offsetSize)
	metadataSize := stringStart + b.totalDictSize

	if metadataSize > metadataMaxSizeLimit {
		return Value{}, fmt.Errorf("metadata size too large: %d", metadataSize)
	}

	meta := make([]byte, metadataSize)

	meta[0] = supportedVersion | ((offsetSize - 1) << 6)
	if nkeys > 0 && slices.IsSortedFunc(b.dictKeys, bytes.Compare) {
		meta[0] |= 1 << 4
	}
	writeOffset(meta[1:], nkeys, offsetSize)

	curOffset := 0
	for i, k := range b.dictKeys {
		writeOffset(meta[int(offsetStart)+i*int(offsetSize):], curOffset, offsetSize)
		curOffset += copy(meta[stringStart+curOffset:], k)
	}
	writeOffset(meta[int(offsetStart)+nkeys*int(offsetSize):], curOffset, offsetSize)

	return Value{
		value: b.buf.Bytes(),
		meta: Metadata{
			data: meta,
			keys: b.dictKeys,
		},
	}, nil
}

type variantPrimitiveType interface {
	constraints.Integer | constraints.Float | string | []byte |
		arrow.Date32 | arrow.Time64 | arrow.Timestamp | bool |
		uuid.UUID | DecimalValue[decimal.Decimal32] | time.Time |
		DecimalValue[decimal.Decimal64] | DecimalValue[decimal.Decimal128]
}

// Encode is a convenience function that produces the encoded bytes for a primitive
// variant value. At the moment this is just delegating to the [Builder.Append] method,
// but in the future it will be optimized to avoid the extra overhead and reduce allocations.
func Encode[T variantPrimitiveType](v T, opt ...AppendOpt) ([]byte, error) {
	out, err := Of(v, opt...)
	if err != nil {
		return nil, fmt.Errorf("failed to encode variant value: %w", err)
	}
	return out.value, nil
}

func Of[T variantPrimitiveType](v T, opt ...AppendOpt) (Value, error) {
	var b Builder
	if err := b.Append(v, opt...); err != nil {
		return Value{}, fmt.Errorf("failed to append value: %w", err)
	}

	val, err := b.Build()
	if err != nil {
		return Value{}, fmt.Errorf("failed to build variant value: %w", err)
	}

	return val, nil
}

func ParseJSON(data string, allowDuplicateKeys bool) (Value, error) {
	var b Builder
	b.SetAllowDuplicates(allowDuplicateKeys)

	dec := json.NewDecoder(strings.NewReader(data))
	dec.UseNumber() // to handle JSON numbers as json.Number

	if err := b.buildJSON(dec); err != nil {
		return Value{}, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return b.Build()
}

func ParseJSONBytes(data []byte, allowDuplicateKeys bool) (Value, error) {
	var b Builder
	b.SetAllowDuplicates(allowDuplicateKeys)

	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber() // to handle JSON numbers as json.Number

	if err := b.buildJSON(dec); err != nil {
		return Value{}, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return b.Build()
}

func Unmarshal(dec *json.Decoder, allowDuplicateKeys bool) (Value, error) {
	var b Builder
	b.SetAllowDuplicates(allowDuplicateKeys)

	if err := b.buildJSON(dec); err != nil {
		return Value{}, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return b.Build()
}

func (b *Builder) buildJSON(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return fmt.Errorf("unexpected end of JSON input")
		}
		return fmt.Errorf("failed to decode JSON token: %w", err)
	}

	switch v := tok.(type) {
	case json.Delim:
		switch v {
		case '{':
			start, fields := b.Offset(), make([]FieldEntry, 0)
			for dec.More() {
				key, err := dec.Token()
				if err != nil {
					if errors.Is(err, io.EOF) {
						return fmt.Errorf("unexpected end of JSON input")
					}
					return fmt.Errorf("failed to decode JSON key: %w", err)
				}

				switch key := key.(type) {
				case string:
					fields = append(fields, b.NextField(start, key))
					if err := b.buildJSON(dec); err != nil {
						return err
					}
				default:
					return fmt.Errorf("expected string key in JSON object, got %T", key)
				}
			}
			tok, err = dec.Token()
			if err != nil {
				return fmt.Errorf("failed to decode JSON object end: %w", err)
			}
			if tok != json.Delim('}') {
				return fmt.Errorf("expected end of JSON object, got %v", tok)
			}
			return b.FinishObject(start, fields)
		case '[':
			start, offsets := b.Offset(), make([]int, 0)
			for dec.More() {
				offsets = append(offsets, b.NextElement(start))
				if err := b.buildJSON(dec); err != nil {
					return err
				}
			}
			tok, err = dec.Token()
			if err != nil {
				return fmt.Errorf("failed to decode JSON array end: %w", err)
			}
			if tok != json.Delim(']') {
				return fmt.Errorf("expected end of JSON array, got %v", tok)
			}
			return b.FinishArray(start, offsets)
		default:
			return fmt.Errorf("unexpected JSON delimiter: %v", v)
		}
	case float64:
		return b.AppendFloat64(v)
	case string:
		return b.AppendString(v)
	case bool:
		return b.AppendBool(v)
	case nil:
		return b.AppendNull()
	case json.Number:
		num, err := v.Int64()
		if err == nil {
			return b.AppendInt(num)
		}

		if !b.tryParseDecimal(v.String()) {
			fnum, err := v.Float64()
			if err == nil {
				return b.AppendFloat64(fnum)
			}
			return fmt.Errorf("failed to parse JSON number: %w", err)
		}

		return nil
	default:
		return fmt.Errorf("unexpected JSON token type: %T", v)
	}
}

func (b *Builder) tryParseDecimal(input string) bool {
	prec, scale, err := decimal.PrecScaleFromString(input)
	if err != nil {
		return false
	}

	n, err := decimal.Decimal128FromString(input, prec, scale)
	if err != nil {
		return false
	}

	return b.AppendDecimal16(uint8(scale), n) == nil
}
