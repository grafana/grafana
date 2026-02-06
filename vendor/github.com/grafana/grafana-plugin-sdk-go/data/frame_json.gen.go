//nolint:unused,unparam
package data

import (
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	jsoniter "github.com/json-iterator/go"
)

func writeArrowDataBinary(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewBinaryData(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteRaw(string(v.Value(i)))
	}
	stream.WriteArrayEnd()
	return entities
}

// -------------------------------------------------------------
// The rest of this file is generated from frame_json_test.go
// -------------------------------------------------------------

func writeArrowDataUint8(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewUint8Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteUint8(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readUint8VectorJSON(iter *jsoniter.Iterator, size int) (*uint8Vector, error) {
	arr := newUint8Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readUint8VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint8()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableUint8VectorJSON(iter *jsoniter.Iterator, size int) (*nullableUint8Vector, error) {
	arr := newNullableUint8Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableUint8VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint8()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableUint8VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataUint16(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewUint16Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteUint16(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readUint16VectorJSON(iter *jsoniter.Iterator, size int) (*uint16Vector, error) {
	arr := newUint16Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readUint16VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint16()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableUint16VectorJSON(iter *jsoniter.Iterator, size int) (*nullableUint16Vector, error) {
	arr := newNullableUint16Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableUint16VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint16()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableUint16VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataUint32(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewUint32Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteUint32(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readUint32VectorJSON(iter *jsoniter.Iterator, size int) (*uint32Vector, error) {
	arr := newUint32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readUint32VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint32()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableUint32VectorJSON(iter *jsoniter.Iterator, size int) (*nullableUint32Vector, error) {
	arr := newNullableUint32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableUint32VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint32()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableUint32VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataUint64(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewUint64Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteUint64(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readUint64VectorJSON(iter *jsoniter.Iterator, size int) (*uint64Vector, error) {
	arr := newUint64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readUint64VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint64()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableUint64VectorJSON(iter *jsoniter.Iterator, size int) (*nullableUint64Vector, error) {
	arr := newNullableUint64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableUint64VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint64()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableUint64VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataInt8(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewInt8Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteInt8(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readInt8VectorJSON(iter *jsoniter.Iterator, size int) (*int8Vector, error) {
	arr := newInt8Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readInt8VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt8()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableInt8VectorJSON(iter *jsoniter.Iterator, size int) (*nullableInt8Vector, error) {
	arr := newNullableInt8Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableInt8VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt8()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableInt8VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataInt16(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewInt16Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteInt16(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readInt16VectorJSON(iter *jsoniter.Iterator, size int) (*int16Vector, error) {
	arr := newInt16Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readInt16VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt16()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableInt16VectorJSON(iter *jsoniter.Iterator, size int) (*nullableInt16Vector, error) {
	arr := newNullableInt16Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableInt16VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt16()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableInt16VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataInt32(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewInt32Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteInt32(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readInt32VectorJSON(iter *jsoniter.Iterator, size int) (*int32Vector, error) {
	arr := newInt32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readInt32VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt32()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableInt32VectorJSON(iter *jsoniter.Iterator, size int) (*nullableInt32Vector, error) {
	arr := newNullableInt32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableInt32VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt32()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableInt32VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataInt64(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewInt64Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteInt64(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readInt64VectorJSON(iter *jsoniter.Iterator, size int) (*int64Vector, error) {
	arr := newInt64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readInt64VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt64()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableInt64VectorJSON(iter *jsoniter.Iterator, size int) (*nullableInt64Vector, error) {
	arr := newNullableInt64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableInt64VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadInt64()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableInt64VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataFloat32(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewFloat32Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		val := v.Value(i)
		f64 := float64(val)
		if entityType, found := isSpecialEntity(f64); found {
			if entities == nil {
				entities = &fieldEntityLookup{}
			}
			entities.add(entityType, i)
			stream.WriteNil()
		} else {
			stream.WriteFloat32(val)
		}
	}
	stream.WriteArrayEnd()
	return entities
}

func readFloat32VectorJSON(iter *jsoniter.Iterator, size int) (*float32Vector, error) {
	arr := newFloat32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readFloat32VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadFloat32()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableFloat32VectorJSON(iter *jsoniter.Iterator, size int) (*nullableFloat32Vector, error) {
	arr := newNullableFloat32Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableFloat32VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadFloat32()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableFloat32VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataFloat64(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewFloat64Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		val := v.Value(i)
		f64 := float64(val)
		if entityType, found := isSpecialEntity(f64); found {
			if entities == nil {
				entities = &fieldEntityLookup{}
			}
			entities.add(entityType, i)
			stream.WriteNil()
		} else {
			stream.WriteFloat64(val)
		}
	}
	stream.WriteArrayEnd()
	return entities
}

func readFloat64VectorJSON(iter *jsoniter.Iterator, size int) (*float64Vector, error) {
	arr := newFloat64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readFloat64VectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadFloat64()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableFloat64VectorJSON(iter *jsoniter.Iterator, size int) (*nullableFloat64Vector, error) {
	arr := newNullableFloat64Vector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableFloat64VectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadFloat64()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableFloat64VectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataString(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewStringData(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteString(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readStringVectorJSON(iter *jsoniter.Iterator, size int) (*stringVector, error) {
	arr := newStringVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readStringVectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadString()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableStringVectorJSON(iter *jsoniter.Iterator, size int) (*nullableStringVector, error) {
	arr := newNullableStringVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableStringVectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadString()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableStringVectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataBool(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewBooleanData(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteBool(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readBoolVectorJSON(iter *jsoniter.Iterator, size int) (*boolVector, error) {
	arr := newBoolVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readBoolVectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadBool()
			arr.Set(i, v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableBoolVectorJSON(iter *jsoniter.Iterator, size int) (*nullableBoolVector, error) {
	arr := newNullableBoolVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableBoolVectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadBool()
			arr.Set(i, &v)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableBoolVectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func writeArrowDataEnum(stream *jsoniter.Stream, col arrow.Array) *fieldEntityLookup {
	var entities *fieldEntityLookup
	count := col.Len()

	v := array.NewUint16Data(col.Data())
	stream.WriteArrayStart()
	for i := 0; i < count; i++ {
		if i > 0 {
			stream.WriteRaw(",")
		}
		if col.IsNull(i) {
			stream.WriteNil()
			continue
		}
		stream.WriteUint16(v.Value(i))
	}
	stream.WriteArrayEnd()
	return entities
}

func readEnumVectorJSON(iter *jsoniter.Iterator, size int) (*enumVector, error) {
	arr := newEnumVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readEnumVectorJSON", "expected array")
			return nil, iter.Error
		}

		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint16()
			arr.Set(i, EnumItemIndex(v))
		}
	}

	if iter.ReadArray() {
		iter.ReportError("read", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}

func readNullableEnumVectorJSON(iter *jsoniter.Iterator, size int) (*nullableEnumVector, error) {
	arr := newNullableEnumVector(size)
	for i := 0; i < size; i++ {
		if !iter.ReadArray() {
			iter.ReportError("readNullableEnumVectorJSON", "expected array")
			return nil, iter.Error
		}
		t := iter.WhatIsNext()
		if t == jsoniter.NilValue {
			iter.ReadNil()
		} else {
			v := iter.ReadUint16()
			eII := EnumItemIndex(v)
			arr.Set(i, &eII)
		}
	}

	if iter.ReadArray() {
		iter.ReportError("readNullableEnumVectorJSON", "expected close array")
		return nil, iter.Error
	}
	return arr, nil
}
