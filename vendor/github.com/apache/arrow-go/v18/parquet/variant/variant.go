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
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"maps"
	"slices"
	"strings"
	"time"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/google/uuid"
)

//go:generate go tool stringer -type=BasicType -linecomment -output=basic_type_stringer.go
//go:generate go tool stringer -type=PrimitiveType -linecomment -output=primitive_type_stringer.go

// BasicType represents the fundamental type category of a variant value.
type BasicType int

const (
	BasicUndefined   BasicType = iota - 1 // Unknown
	BasicPrimitive                        // Primitive
	BasicShortString                      // ShortString
	BasicObject                           // Object
	BasicArray                            // Array
)

func basicTypeFromHeader(hdr byte) BasicType {
	// because we're doing hdr & 0x3, it is impossible for the result
	// to be outside of the range of BasicType. Therefore, we don't
	// need to perform any checks. The value will always be [0,3]
	return BasicType(hdr & basicTypeMask)
}

// PrimitiveType represents specific primitive data types within the variant format.
type PrimitiveType int

const (
	PrimitiveInvalid            PrimitiveType = iota - 1 // Unknown
	PrimitiveNull                                        // Null
	PrimitiveBoolTrue                                    // BoolTrue
	PrimitiveBoolFalse                                   // BoolFalse
	PrimitiveInt8                                        // Int8
	PrimitiveInt16                                       // Int16
	PrimitiveInt32                                       // Int32
	PrimitiveInt64                                       // Int64
	PrimitiveDouble                                      // Double
	PrimitiveDecimal4                                    // Decimal32
	PrimitiveDecimal8                                    // Decimal64
	PrimitiveDecimal16                                   // Decimal128
	PrimitiveDate                                        // Date
	PrimitiveTimestampMicros                             // Timestamp(micros)
	PrimitiveTimestampMicrosNTZ                          // TimestampNTZ(micros)
	PrimitiveFloat                                       // Float
	PrimitiveBinary                                      // Binary
	PrimitiveString                                      // String
	PrimitiveTimeMicrosNTZ                               // TimeNTZ(micros)
	PrimitiveTimestampNanos                              // Timestamp(nanos)
	PrimitiveTimestampNanosNTZ                           // TimestampNTZ(nanos)
	PrimitiveUUID                                        // UUID
)

func primitiveTypeFromHeader(hdr byte) PrimitiveType {
	return PrimitiveType((hdr >> basicTypeBits) & typeInfoMask)
}

// Type represents the high-level variant data type.
// This is what applications typically use to identify the type of a variant value.
type Type int

const (
	Object Type = iota
	Array
	Null
	Bool
	Int8
	Int16
	Int32
	Int64
	String
	Double
	Decimal4
	Decimal8
	Decimal16
	Date
	TimestampMicros
	TimestampMicrosNTZ
	Float
	Binary
	Time
	TimestampNanos
	TimestampNanosNTZ
	UUID
)

const (
	versionMask        uint8 = 0x0F
	sortedStrMask      uint8 = 0b10000
	basicTypeMask      uint8 = 0x3
	basicTypeBits      uint8 = 2
	typeInfoMask       uint8 = 0x3F
	hdrSizeBytes             = 1
	minOffsetSizeBytes       = 1
	maxOffsetSizeBytes       = 4

	// mask is applied after shift
	offsetSizeMask       uint8 = 0b11
	offsetSizeBitShift   uint8 = 6
	supportedVersion           = 1
	maxShortStringSize         = 0x3F
	metadataMaxSizeLimit       = 128 * 1024 * 1024 // 128MB
)

var (
	// EmptyMetadataBytes contains a minimal valid metadata section with no dictionary entries.
	EmptyMetadataBytes = [3]byte{0x1, 0, 0}

	ErrInvalidMetadata = errors.New("invalid variant metadata")
)

// Metadata represents the dictionary part of a variant value, which stores
// the keys used in object values.
type Metadata struct {
	data []byte
	keys [][]byte
}

// NewMetadata creates a Metadata instance from a raw byte slice.
// It validates the metadata format and loads the key dictionary.
func NewMetadata(data []byte) (Metadata, error) {
	m := Metadata{data: data}
	if len(data) < hdrSizeBytes+minOffsetSizeBytes*2 {
		return m, fmt.Errorf("%w: too short: size=%d", ErrInvalidMetadata, len(data))
	}

	if m.Version() != supportedVersion {
		return m, fmt.Errorf("%w: unsupported version: %d", ErrInvalidMetadata, m.Version())
	}

	offsetSz := m.OffsetSize()
	return m, m.loadDictionary(offsetSz)
}

// Clone creates a deep copy of the metadata.
func (m *Metadata) Clone() Metadata {
	return Metadata{
		data: bytes.Clone(m.data),
		// shallow copy of the values, but the slice is copied
		// more efficient, and nothing should be mutating the keys
		// so it's probably safe, but something we should keep in mind
		keys: slices.Clone(m.keys),
	}
}

func (m *Metadata) loadDictionary(offsetSz uint8) error {
	if int(offsetSz+hdrSizeBytes) > len(m.data) {
		return fmt.Errorf("%w: too short for dictionary size", ErrInvalidMetadata)
	}

	dictSize := readLEU32(m.data[hdrSizeBytes : hdrSizeBytes+offsetSz])
	m.keys = make([][]byte, dictSize)

	if dictSize == 0 {
		return nil
	}

	// first offset is always 0
	offsetStart, offsetPos := uint32(0), hdrSizeBytes+offsetSz
	valuesStart := hdrSizeBytes + (dictSize+2)*uint32(offsetSz)
	if hdrSizeBytes+int(dictSize+1)*int(offsetSz) > len(m.data) {
		return fmt.Errorf("%w: offset out of range: %d > %d",
			ErrInvalidMetadata, (dictSize+hdrSizeBytes)*uint32(offsetSz), len(m.data))
	}

	for i := range dictSize {
		offsetPos += offsetSz
		end := readLEU32(m.data[offsetPos : offsetPos+offsetSz])

		keySize := end - offsetStart
		valStart := valuesStart + offsetStart
		if valStart+keySize > uint32(len(m.data)) {
			return fmt.Errorf("%w: string data out of range: %d + %d > %d",
				ErrInvalidMetadata, valStart, keySize, len(m.data))
		}
		m.keys[i] = m.data[valStart : valStart+keySize]
		offsetStart += keySize
	}

	return nil
}

// Bytes returns the raw byte representation of the metadata.
func (m Metadata) Bytes() []byte { return m.data }

// Version returns the metadata format version.
func (m Metadata) Version() uint8 { return m.data[0] & versionMask }

// SortedAndUnique returns whether the keys in the metadata dictionary are sorted and unique.
func (m Metadata) SortedAndUnique() bool { return m.data[0]&sortedStrMask != 0 }

// OffsetSize returns the size in bytes used to store offsets in the metadata.
func (m Metadata) OffsetSize() uint8 {
	return ((m.data[0] >> offsetSizeBitShift) & offsetSizeMask) + 1
}

// DictionarySize returns the number of keys in the metadata dictionary.
func (m Metadata) DictionarySize() uint32 { return uint32(len(m.keys)) }

// KeyAt returns the string key at the given dictionary ID.
// Returns an error if the ID is out of range.
func (m Metadata) KeyAt(id uint32) (string, error) {
	if id >= uint32(len(m.keys)) {
		return "", fmt.Errorf("invalid variant metadata: id out of range: %d >= %d",
			id, len(m.keys))
	}

	return unsafe.String(&m.keys[id][0], len(m.keys[id])), nil
}

// IdFor returns the dictionary IDs for the given key.
// If the metadata is sorted and unique, this performs a binary search.
// Otherwise, it performs a linear search.
//
// If the metadata is not sorted and unique, then it's possible that multiple
// IDs will be returned for the same key.
func (m Metadata) IdFor(key string) []uint32 {
	k := unsafe.Slice(unsafe.StringData(key), len(key))

	var ret []uint32
	if m.SortedAndUnique() {
		idx, found := slices.BinarySearchFunc(m.keys, k, bytes.Compare)
		if found {
			ret = append(ret, uint32(idx))
		}

		return ret
	}

	for i, kb := range m.keys {
		if bytes.Equal(kb, k) {
			ret = append(ret, uint32(i))
		}
	}

	return ret
}

// DecimalValue represents a decimal number with a specified scale.
// The generic parameter T can be any supported variant decimal type (Decimal32, Decimal64, Decimal128).
type DecimalValue[T decimal.DecimalTypes] struct {
	Scale uint8
	Value decimal.Num[T]
}

// MarshalJSON implements the json.Marshaler interface for DecimalValue.
func (v DecimalValue[T]) MarshalJSON() ([]byte, error) {
	return []byte(v.Value.ToString(int32(v.Scale))), nil
}

// ArrayValue represents an array of variant values.
type ArrayValue struct {
	value []byte
	meta  Metadata

	numElements uint32
	dataStart   uint32
	offsetSize  uint8
	offsetStart uint8
}

// MarshalJSON implements the json.Marshaler interface for ArrayValue.
func (v ArrayValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(slices.Collect(v.Values()))
}

// Len returns the number of elements in the array.
func (v ArrayValue) Len() uint32 { return v.numElements }

// Values returns an iterator for the elements in the array, allowing
// for lazy evaluation of the offsets (for the situation where not all elements
// are iterated).
func (v ArrayValue) Values() iter.Seq[Value] {
	return func(yield func(Value) bool) {
		for i := range v.numElements {
			idx := uint32(v.offsetStart) + i*uint32(v.offsetSize)
			offset := readLEU32(v.value[idx : idx+uint32(v.offsetSize)])

			val := v.value[v.dataStart+offset:]
			sz := valueSize(val)
			val = val[:sz] // trim to actual size

			if !yield(Value{value: val, meta: v.meta}) {
				return
			}
		}
	}
}

// Value returns the Value at the specified index.
// Returns an error if the index is out of range.
func (v ArrayValue) Value(i uint32) (Value, error) {
	if i >= v.numElements {
		return Value{}, fmt.Errorf("%w: invalid array value: index out of range: %d >= %d",
			arrow.ErrIndex, i, v.numElements)
	}

	idx := uint32(v.offsetStart) + i*uint32(v.offsetSize)
	offset := readLEU32(v.value[idx : idx+uint32(v.offsetSize)])

	return Value{meta: v.meta, value: v.value[v.dataStart+offset:]}, nil
}

// ObjectValue represents an object (map/dictionary) of key-value pairs.
type ObjectValue struct {
	value []byte
	meta  Metadata

	numElements uint32
	offsetStart uint32
	dataStart   uint32
	idSize      uint8
	offsetSize  uint8
	idStart     uint8
}

// ObjectField represents a key-value pair in an object.
type ObjectField struct {
	Key   string
	Value Value
}

// NumElements returns the number of fields in the object.
func (v ObjectValue) NumElements() uint32 { return v.numElements }

// ValueByKey returns the field with the specified key.
// Returns arrow.ErrNotFound if the key doesn't exist.
func (v ObjectValue) ValueByKey(key string) (ObjectField, error) {
	n := v.numElements

	// if total list size is smaller than threshold, linear search will
	// likely be faster than a binary search
	const binarySearchThreshold = 32
	if n < binarySearchThreshold {
		for i := range n {
			idx := uint32(v.idStart) + i*uint32(v.idSize)
			id := readLEU32(v.value[idx : idx+uint32(v.idSize)])
			k, err := v.meta.KeyAt(id)
			if err != nil {
				return ObjectField{}, fmt.Errorf("invalid object value: fieldID at idx %d is not in metadata", idx)
			}
			if k == key {
				idx := uint32(v.offsetStart) + uint32(v.offsetSize)*i
				offset := readLEU32(v.value[idx : idx+uint32(v.offsetSize)])
				return ObjectField{
					Key:   key,
					Value: Value{value: v.value[v.dataStart+offset:], meta: v.meta}}, nil
			}
		}
		return ObjectField{}, arrow.ErrNotFound
	}

	i, j := uint32(0), n
	for i < j {
		mid := (i + j) >> 1
		idx := uint32(v.idStart) + mid*uint32(v.idSize)
		id := readLEU32(v.value[idx : idx+uint32(v.idSize)])
		k, err := v.meta.KeyAt(id)
		if err != nil {
			return ObjectField{}, fmt.Errorf("invalid object value: fieldID at idx %d is not in metadata", idx)
		}

		switch strings.Compare(k, key) {
		case -1:
			i = mid + 1
		case 0:
			idx := uint32(v.offsetStart) + uint32(v.offsetSize)*mid
			offset := readLEU32(v.value[idx : idx+uint32(v.offsetSize)])

			return ObjectField{
				Key:   key,
				Value: Value{value: v.value[v.dataStart+offset:], meta: v.meta}}, nil
		case 1:
			j = mid - 1
		}
	}

	return ObjectField{}, arrow.ErrNotFound
}

// FieldAt returns the field at the specified index.
// Returns an error if the index is out of range.
func (v ObjectValue) FieldAt(i uint32) (ObjectField, error) {
	if i >= v.numElements {
		return ObjectField{}, fmt.Errorf("%w: invalid object value: index out of range: %d >= %d",
			arrow.ErrIndex, i, v.numElements)
	}

	idx := uint32(v.idStart) + i*uint32(v.idSize)
	id := readLEU32(v.value[idx : idx+uint32(v.idSize)])
	k, err := v.meta.KeyAt(id)
	if err != nil {
		return ObjectField{}, fmt.Errorf("invalid object value: fieldID at idx %d is not in metadata", idx)
	}

	offsetIdx := uint32(v.offsetStart) + i*uint32(v.offsetSize)
	offset := readLEU32(v.value[offsetIdx : offsetIdx+uint32(v.offsetSize)])

	return ObjectField{
		Key:   k,
		Value: Value{value: v.value[v.dataStart+offset:], meta: v.meta}}, nil
}

// Values returns an iterator over all key-value pairs in the object.
func (v ObjectValue) Values() iter.Seq2[string, Value] {
	return func(yield func(string, Value) bool) {
		for i := range v.numElements {
			idx := uint32(v.idStart) + i*uint32(v.idSize)
			id := readLEU32(v.value[idx : idx+uint32(v.idSize)])
			k, err := v.meta.KeyAt(id)
			if err != nil {
				return
			}

			offsetIdx := uint32(v.offsetStart) + i*uint32(v.offsetSize)
			offset := readLEU32(v.value[offsetIdx : offsetIdx+uint32(v.offsetSize)])

			value := v.value[v.dataStart+offset:]
			sz := valueSize(value)
			if !yield(k, Value{value: value[:sz], meta: v.meta}) {
				return
			}
		}
	}
}

// MarshalJSON implements the json.Marshaler interface for ObjectValue.
func (v ObjectValue) MarshalJSON() ([]byte, error) {
	// for now we'll use a naive approach and just build a map
	// then marshal it. This is not the most efficient way to do this
	// but it is the simplest and most straightforward.
	mapping := make(map[string]Value)
	maps.Insert(mapping, v.Values())
	return json.Marshal(mapping)
}

var NullValue = Value{meta: Metadata{data: EmptyMetadataBytes[:]}, value: []byte{0}}

// Value represents a variant value of any type.
type Value struct {
	value []byte
	meta  Metadata
}

// NewWithMetadata creates a Value with the provided metadata and value bytes.
func NewWithMetadata(meta Metadata, value []byte) (Value, error) {
	if len(value) == 0 {
		return Value{}, errors.New("invalid variant value: empty")
	}

	return Value{value: value, meta: meta}, nil
}

// New creates a Value by parsing both the metadata and value bytes.
func New(meta, value []byte) (Value, error) {
	m, err := NewMetadata(meta)
	if err != nil {
		return Value{}, err
	}

	return NewWithMetadata(m, value)
}

func (v Value) String() string {
	b, _ := json.Marshal(v)
	return string(b)
}

// Bytes returns the raw byte representation of the value (excluding metadata).
func (v Value) Bytes() []byte { return v.value }

// Clone creates a deep copy of the value including its metadata.
func (v Value) Clone() Value {
	return Value{
		meta:  v.meta.Clone(),
		value: bytes.Clone(v.value),
	}
}

// Metadata returns the metadata associated with the value.
func (v Value) Metadata() Metadata { return v.meta }

// BasicType returns the fundamental type category of the value.
func (v Value) BasicType() BasicType {
	return basicTypeFromHeader(v.value[0])
}

// Type returns the specific data type of the value.
func (v Value) Type() Type {
	switch t := v.BasicType(); t {
	case BasicPrimitive:
		switch primType := primitiveTypeFromHeader(v.value[0]); primType {
		case PrimitiveNull:
			return Null
		case PrimitiveBoolTrue, PrimitiveBoolFalse:
			return Bool
		case PrimitiveInt8:
			return Int8
		case PrimitiveInt16:
			return Int16
		case PrimitiveInt32:
			return Int32
		case PrimitiveInt64:
			return Int64
		case PrimitiveDouble:
			return Double
		case PrimitiveDecimal4:
			return Decimal4
		case PrimitiveDecimal8:
			return Decimal8
		case PrimitiveDecimal16:
			return Decimal16
		case PrimitiveDate:
			return Date
		case PrimitiveTimestampMicros:
			return TimestampMicros
		case PrimitiveTimestampMicrosNTZ:
			return TimestampMicrosNTZ
		case PrimitiveFloat:
			return Float
		case PrimitiveBinary:
			return Binary
		case PrimitiveString:
			return String
		case PrimitiveTimeMicrosNTZ:
			return Time
		case PrimitiveTimestampNanos:
			return TimestampNanos
		case PrimitiveTimestampNanosNTZ:
			return TimestampNanosNTZ
		case PrimitiveUUID:
			return UUID
		default:
			panic(fmt.Errorf("invalid primitive type found: %d", primType))
		}
	case BasicShortString:
		return String
	case BasicObject:
		return Object
	case BasicArray:
		return Array
	default:
		panic(fmt.Errorf("invalid basic type found: %d", t))
	}
}

// Value returns the Go value representation of the variant.
// The returned type depends on the variant type:
//   - Null: nil
//   - Bool: bool
//   - Int8/16/32/64: corresponding int type
//   - Float/Double: float32/float64
//   - String: string
//   - Binary: []byte
//   - Decimal: DecimalValue
//   - Date: arrow.Date32
//   - Time: arrow.Time64
//   - Timestamp: arrow.Timestamp
//   - UUID: uuid.UUID
//   - Object: ObjectValue
//   - Array: ArrayValue
func (v Value) Value() any {
	switch t := v.BasicType(); t {
	case BasicPrimitive:
		switch primType := primitiveTypeFromHeader(v.value[0]); primType {
		case PrimitiveNull:
			return nil
		case PrimitiveBoolTrue:
			return true
		case PrimitiveBoolFalse:
			return false
		case PrimitiveInt8:
			return readExact[int8](v.value[1:])
		case PrimitiveInt16:
			return readExact[int16](v.value[1:])
		case PrimitiveInt32:
			return readExact[int32](v.value[1:])
		case PrimitiveInt64:
			return readExact[int64](v.value[1:])
		case PrimitiveDouble:
			return readExact[float64](v.value[1:])
		case PrimitiveFloat:
			return readExact[float32](v.value[1:])
		case PrimitiveDate:
			return arrow.Date32(readExact[int32](v.value[1:]))
		case PrimitiveTimestampMicros, PrimitiveTimestampMicrosNTZ,
			PrimitiveTimestampNanos, PrimitiveTimestampNanosNTZ:
			return arrow.Timestamp(readExact[int64](v.value[1:]))
		case PrimitiveTimeMicrosNTZ:
			return arrow.Time64(readExact[int64](v.value[1:]))
		case PrimitiveUUID:
			debug.Assert(len(v.value[1:]) == 16, "invalid UUID length")
			return uuid.Must(uuid.FromBytes(v.value[1:]))
		case PrimitiveBinary:
			sz := binary.LittleEndian.Uint32(v.value[1:5])
			return v.value[5 : 5+sz]
		case PrimitiveString:
			sz := binary.LittleEndian.Uint32(v.value[1:5])
			return unsafe.String(&v.value[5], sz)
		case PrimitiveDecimal4:
			scale := uint8(v.value[1])
			val := decimal.Decimal32(readExact[int32](v.value[2:]))
			return DecimalValue[decimal.Decimal32]{Scale: scale, Value: val}
		case PrimitiveDecimal8:
			scale := uint8(v.value[1])
			val := decimal.Decimal64(readExact[int64](v.value[2:]))
			return DecimalValue[decimal.Decimal64]{Scale: scale, Value: val}
		case PrimitiveDecimal16:
			scale := uint8(v.value[1])
			lowBits := readLEU64(v.value[2:10])
			highBits := readExact[int64](v.value[10:])
			return DecimalValue[decimal.Decimal128]{
				Scale: scale,
				Value: decimal128.New(highBits, lowBits),
			}
		}
	case BasicShortString:
		sz := int(v.value[0] >> 2)
		if sz > 0 {
			return unsafe.String(&v.value[1], sz)
		}
		return ""
	case BasicObject:
		valueHdr := (v.value[0] >> basicTypeBits)
		fieldOffsetSz := (valueHdr & 0b11) + 1
		fieldIdSz := ((valueHdr >> 2) & 0b11) + 1
		isLarge := ((valueHdr >> 4) & 0b1) == 1

		var nelemSize uint8 = 1
		if isLarge {
			nelemSize = 4
		}

		debug.Assert(len(v.value) >= int(1+nelemSize), "invalid object value: too short")
		numElements := readLEU32(v.value[1 : 1+nelemSize])
		idStart := uint32(1 + nelemSize)
		offsetStart := idStart + numElements*uint32(fieldIdSz)
		dataStart := offsetStart + (numElements+1)*uint32(fieldOffsetSz)

		debug.Assert(dataStart <= uint32(len(v.value)), "invalid object value: dataStart out of range")
		return ObjectValue{
			value:       v.value,
			meta:        v.meta,
			numElements: numElements,
			offsetStart: offsetStart,
			dataStart:   dataStart,
			idSize:      fieldIdSz,
			offsetSize:  fieldOffsetSz,
			idStart:     uint8(idStart),
		}
	case BasicArray:
		valueHdr := (v.value[0] >> basicTypeBits)
		fieldOffsetSz := (valueHdr & 0b11) + 1
		isLarge := (valueHdr & 0b1) == 1

		var (
			sz                     int
			offsetStart, dataStart int
		)

		if isLarge {
			sz, offsetStart = int(readLEU32(v.value[1:5])), 5
		} else {
			sz, offsetStart = int(v.value[1]), 2
		}

		dataStart = offsetStart + (sz+1)*int(fieldOffsetSz)
		debug.Assert(dataStart <= len(v.value), "invalid array value: dataStart out of range")
		return ArrayValue{
			value:       v.value,
			meta:        v.meta,
			numElements: uint32(sz),
			dataStart:   uint32(dataStart),
			offsetSize:  fieldOffsetSz,
			offsetStart: uint8(offsetStart),
		}
	}

	debug.Assert(false, "unsupported type")
	return nil
}

// MarshalJSON implements the json.Marshaler interface for Value.
func (v Value) MarshalJSON() ([]byte, error) {
	result := v.Value()
	switch t := result.(type) {
	case arrow.Date32:
		result = t.FormattedString()
	case arrow.Timestamp:
		switch primType := primitiveTypeFromHeader(v.value[0]); primType {
		case PrimitiveTimestampMicros:
			result = t.ToTime(arrow.Microsecond).Format("2006-01-02 15:04:05.999999Z0700")
		case PrimitiveTimestampMicrosNTZ:
			result = t.ToTime(arrow.Microsecond).In(time.Local).Format("2006-01-02 15:04:05.999999Z0700")
		case PrimitiveTimestampNanos:
			result = t.ToTime(arrow.Nanosecond).Format("2006-01-02 15:04:05.999999999Z0700")
		case PrimitiveTimestampNanosNTZ:
			result = t.ToTime(arrow.Nanosecond).In(time.Local).Format("2006-01-02 15:04:05.999999999Z0700")
		}
	case arrow.Time64:
		result = t.ToTime(arrow.Microsecond).In(time.Local).Format("15:04:05.999999Z0700")
	}

	return json.Marshal(result)
}
