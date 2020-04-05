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

package ipc // import "github.com/apache/arrow/go/arrow/ipc"

import (
	"encoding/binary"
	"fmt"
	"io"
	"sort"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/flatbuf"
	"github.com/apache/arrow/go/arrow/memory"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/pkg/errors"
)

// Magic string identifying an Apache Arrow file.
var Magic = []byte("ARROW1")

const (
	currentMetadataVersion = MetadataV4
	minMetadataVersion     = MetadataV4

	kExtensionTypeKeyName = "arrow_extension_name"
	kExtensionDataKeyName = "arrow_extension_data"

	// ARROW-109: We set this number arbitrarily to help catch user mistakes. For
	// deeply nested schemas, it is expected the user will indicate explicitly the
	// maximum allowed recursion depth
	kMaxNestingDepth = 64
)

type startVecFunc func(b *flatbuffers.Builder, n int) flatbuffers.UOffsetT

type fieldMetadata struct {
	Len    int64
	Nulls  int64
	Offset int64
}

type bufferMetadata struct {
	Offset int64 // relative offset into the memory page to the starting byte of the buffer
	Len    int64 // absolute length in bytes of the buffer
}

type fileBlock struct {
	Offset int64
	Meta   int32
	Body   int64

	r io.ReaderAt
}

func fileBlocksToFB(b *flatbuffers.Builder, blocks []fileBlock, start startVecFunc) flatbuffers.UOffsetT {
	start(b, len(blocks))
	for i := len(blocks) - 1; i >= 0; i-- {
		blk := blocks[i]
		flatbuf.CreateBlock(b, blk.Offset, blk.Meta, blk.Body)
	}

	return b.EndVector(len(blocks))
}

func (blk fileBlock) NewMessage() (*Message, error) {
	var (
		err error
		buf []byte
		r   = blk.section()
	)

	buf = make([]byte, blk.Meta)
	_, err = io.ReadFull(r, buf)
	if err != nil {
		return nil, errors.Wrap(err, "arrow/ipc: could not read message metadata")
	}

	prefix := 0
	switch binary.LittleEndian.Uint32(buf) {
	case 0:
	case kIPCContToken:
		prefix = 8
	default:
		// ARROW-6314: backwards compatibility for reading old IPC
		// messages produced prior to version 0.15.0
		prefix = 4
	}

	meta := memory.NewBufferBytes(buf[prefix:]) // drop buf-size already known from blk.Meta

	buf = make([]byte, blk.Body)
	_, err = io.ReadFull(r, buf)
	if err != nil {
		return nil, errors.Wrap(err, "arrow/ipc: could not read message body")
	}
	body := memory.NewBufferBytes(buf)

	return NewMessage(meta, body), nil
}

func (blk fileBlock) section() io.Reader {
	return io.NewSectionReader(blk.r, blk.Offset, int64(blk.Meta)+blk.Body)
}

func unitFromFB(unit flatbuf.TimeUnit) arrow.TimeUnit {
	switch unit {
	case flatbuf.TimeUnitSECOND:
		return arrow.Second
	case flatbuf.TimeUnitMILLISECOND:
		return arrow.Millisecond
	case flatbuf.TimeUnitMICROSECOND:
		return arrow.Microsecond
	case flatbuf.TimeUnitNANOSECOND:
		return arrow.Nanosecond
	default:
		panic(errors.Errorf("arrow/ipc: invalid flatbuf.TimeUnit(%d) value", unit))
	}
}

func unitToFB(unit arrow.TimeUnit) flatbuf.TimeUnit {
	switch unit {
	case arrow.Second:
		return flatbuf.TimeUnitSECOND
	case arrow.Millisecond:
		return flatbuf.TimeUnitMILLISECOND
	case arrow.Microsecond:
		return flatbuf.TimeUnitMICROSECOND
	case arrow.Nanosecond:
		return flatbuf.TimeUnitNANOSECOND
	default:
		panic(errors.Errorf("arrow/ipc: invalid arrow.TimeUnit(%d) value", unit))
	}
}

// initFB is a helper function to handle flatbuffers' polymorphism.
func initFB(t interface {
	Table() flatbuffers.Table
	Init([]byte, flatbuffers.UOffsetT)
}, f func(tbl *flatbuffers.Table) bool) {
	tbl := t.Table()
	if !f(&tbl) {
		panic(errors.Errorf("arrow/ipc: could not initialize %T from flatbuffer", t))
	}
	t.Init(tbl.Bytes, tbl.Pos)
}

func fieldFromFB(field *flatbuf.Field, memo *dictMemo) (arrow.Field, error) {
	var (
		err error
		o   arrow.Field
	)

	o.Name = string(field.Name())
	o.Nullable = field.Nullable()
	o.Metadata, err = metadataFromFB(field)
	if err != nil {
		return o, err
	}

	encoding := field.Dictionary(nil)
	switch encoding {
	case nil:
		n := field.ChildrenLength()
		children := make([]arrow.Field, n)
		for i := range children {
			var childFB flatbuf.Field
			if !field.Children(&childFB, i) {
				return o, errors.Errorf("arrow/ipc: could not load field child %d", i)
			}
			child, err := fieldFromFB(&childFB, memo)
			if err != nil {
				return o, errors.Wrapf(err, "arrow/ipc: could not convert field child %d", i)
			}
			children[i] = child
		}

		o.Type, err = typeFromFB(field, children, o.Metadata)
		if err != nil {
			return o, errors.Wrapf(err, "arrow/ipc: could not convert field type")
		}
	default:
		panic("not implemented") // FIXME(sbinet)
	}

	return o, nil
}

func fieldToFB(b *flatbuffers.Builder, field arrow.Field, memo *dictMemo) flatbuffers.UOffsetT {
	var visitor = fieldVisitor{b: b, memo: memo, meta: make(map[string]string)}
	return visitor.result(field)
}

type fieldVisitor struct {
	b      *flatbuffers.Builder
	memo   *dictMemo
	dtype  flatbuf.Type
	offset flatbuffers.UOffsetT
	kids   []flatbuffers.UOffsetT
	meta   map[string]string
}

func (fv *fieldVisitor) visit(field arrow.Field) {
	dt := field.Type
	switch dt := dt.(type) {
	case *arrow.NullType:
		fv.dtype = flatbuf.TypeNull
		flatbuf.NullStart(fv.b)
		fv.offset = flatbuf.NullEnd(fv.b)

	case *arrow.BooleanType:
		fv.dtype = flatbuf.TypeBool
		flatbuf.BoolStart(fv.b)
		fv.offset = flatbuf.BoolEnd(fv.b)

	case *arrow.Uint8Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), false)

	case *arrow.Uint16Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), false)

	case *arrow.Uint32Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), false)

	case *arrow.Uint64Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), false)

	case *arrow.Int8Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), true)

	case *arrow.Int16Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), true)

	case *arrow.Int32Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), true)

	case *arrow.Int64Type:
		fv.dtype = flatbuf.TypeInt
		fv.offset = intToFB(fv.b, int32(dt.BitWidth()), true)

	case *arrow.Float16Type:
		fv.dtype = flatbuf.TypeFloatingPoint
		fv.offset = floatToFB(fv.b, int32(dt.BitWidth()))

	case *arrow.Float32Type:
		fv.dtype = flatbuf.TypeFloatingPoint
		fv.offset = floatToFB(fv.b, int32(dt.BitWidth()))

	case *arrow.Float64Type:
		fv.dtype = flatbuf.TypeFloatingPoint
		fv.offset = floatToFB(fv.b, int32(dt.BitWidth()))

	case *arrow.Decimal128Type:
		fv.dtype = flatbuf.TypeDecimal
		flatbuf.DecimalStart(fv.b)
		flatbuf.DecimalAddPrecision(fv.b, dt.Precision)
		flatbuf.DecimalAddScale(fv.b, dt.Scale)
		fv.offset = flatbuf.DecimalEnd(fv.b)

	case *arrow.FixedSizeBinaryType:
		fv.dtype = flatbuf.TypeFixedSizeBinary
		flatbuf.FixedSizeBinaryStart(fv.b)
		flatbuf.FixedSizeBinaryAddByteWidth(fv.b, int32(dt.ByteWidth))
		fv.offset = flatbuf.FixedSizeBinaryEnd(fv.b)

	case *arrow.BinaryType:
		fv.dtype = flatbuf.TypeBinary
		flatbuf.BinaryStart(fv.b)
		fv.offset = flatbuf.BinaryEnd(fv.b)

	case *arrow.StringType:
		fv.dtype = flatbuf.TypeUtf8
		flatbuf.Utf8Start(fv.b)
		fv.offset = flatbuf.Utf8End(fv.b)

	case *arrow.Date32Type:
		fv.dtype = flatbuf.TypeDate
		flatbuf.DateStart(fv.b)
		flatbuf.DateAddUnit(fv.b, flatbuf.DateUnitDAY)
		fv.offset = flatbuf.DateEnd(fv.b)

	case *arrow.Date64Type:
		fv.dtype = flatbuf.TypeDate
		flatbuf.DateStart(fv.b)
		flatbuf.DateAddUnit(fv.b, flatbuf.DateUnitMILLISECOND)
		fv.offset = flatbuf.DateEnd(fv.b)

	case *arrow.Time32Type:
		fv.dtype = flatbuf.TypeTime
		flatbuf.TimeStart(fv.b)
		flatbuf.TimeAddUnit(fv.b, unitToFB(dt.Unit))
		flatbuf.TimeAddBitWidth(fv.b, 32)
		fv.offset = flatbuf.TimeEnd(fv.b)

	case *arrow.Time64Type:
		fv.dtype = flatbuf.TypeTime
		flatbuf.TimeStart(fv.b)
		flatbuf.TimeAddUnit(fv.b, unitToFB(dt.Unit))
		flatbuf.TimeAddBitWidth(fv.b, 64)
		fv.offset = flatbuf.TimeEnd(fv.b)

	case *arrow.TimestampType:
		fv.dtype = flatbuf.TypeTimestamp
		unit := unitToFB(dt.Unit)
		var tz flatbuffers.UOffsetT
		if dt.TimeZone != "" {
			tz = fv.b.CreateString(dt.TimeZone)
		}
		flatbuf.TimestampStart(fv.b)
		flatbuf.TimestampAddUnit(fv.b, unit)
		flatbuf.TimestampAddTimezone(fv.b, tz)
		fv.offset = flatbuf.TimestampEnd(fv.b)

	case *arrow.StructType:
		fv.dtype = flatbuf.TypeStruct_
		offsets := make([]flatbuffers.UOffsetT, len(dt.Fields()))
		for i, field := range dt.Fields() {
			offsets[i] = fieldToFB(fv.b, field, fv.memo)
		}
		flatbuf.Struct_Start(fv.b)
		for i := len(offsets) - 1; i >= 0; i-- {
			fv.b.PrependUOffsetT(offsets[i])
		}
		fv.offset = flatbuf.Struct_End(fv.b)
		fv.kids = append(fv.kids, offsets...)

	case *arrow.ListType:
		fv.dtype = flatbuf.TypeList
		fv.kids = append(fv.kids, fieldToFB(fv.b, arrow.Field{Name: "item", Type: dt.Elem(), Nullable: field.Nullable}, fv.memo))
		flatbuf.ListStart(fv.b)
		fv.offset = flatbuf.ListEnd(fv.b)

	case *arrow.FixedSizeListType:
		fv.dtype = flatbuf.TypeFixedSizeList
		fv.kids = append(fv.kids, fieldToFB(fv.b, arrow.Field{Name: "item", Type: dt.Elem(), Nullable: field.Nullable}, fv.memo))
		flatbuf.FixedSizeListStart(fv.b)
		flatbuf.FixedSizeListAddListSize(fv.b, dt.Len())
		fv.offset = flatbuf.FixedSizeListEnd(fv.b)

	case *arrow.MonthIntervalType:
		fv.dtype = flatbuf.TypeInterval
		flatbuf.IntervalStart(fv.b)
		flatbuf.IntervalAddUnit(fv.b, flatbuf.IntervalUnitYEAR_MONTH)
		fv.offset = flatbuf.IntervalEnd(fv.b)

	case *arrow.DayTimeIntervalType:
		fv.dtype = flatbuf.TypeInterval
		flatbuf.IntervalStart(fv.b)
		flatbuf.IntervalAddUnit(fv.b, flatbuf.IntervalUnitDAY_TIME)
		fv.offset = flatbuf.IntervalEnd(fv.b)

	case *arrow.DurationType:
		fv.dtype = flatbuf.TypeDuration
		unit := unitToFB(dt.Unit)
		flatbuf.DurationStart(fv.b)
		flatbuf.DurationAddUnit(fv.b, unit)
		fv.offset = flatbuf.DurationEnd(fv.b)

	default:
		err := errors.Errorf("arrow/ipc: invalid data type %v", dt)
		panic(err) // FIXME(sbinet): implement all data-types.
	}
}

func (fv *fieldVisitor) result(field arrow.Field) flatbuffers.UOffsetT {
	nameFB := fv.b.CreateString(field.Name)

	fv.visit(field)

	flatbuf.FieldStartChildrenVector(fv.b, len(fv.kids))
	for i := len(fv.kids) - 1; i >= 0; i-- {
		fv.b.PrependUOffsetT(fv.kids[i])
	}
	kidsFB := fv.b.EndVector(len(fv.kids))

	var dictFB flatbuffers.UOffsetT
	if field.Type.ID() == arrow.DICTIONARY {
		panic("not implemented") // FIXME(sbinet)
	}

	var (
		metaFB flatbuffers.UOffsetT
		kvs    []flatbuffers.UOffsetT
	)
	for i, k := range field.Metadata.Keys() {
		v := field.Metadata.Values()[i]
		kk := fv.b.CreateString(k)
		vv := fv.b.CreateString(v)
		flatbuf.KeyValueStart(fv.b)
		flatbuf.KeyValueAddKey(fv.b, kk)
		flatbuf.KeyValueAddValue(fv.b, vv)
		kvs = append(kvs, flatbuf.KeyValueEnd(fv.b))
	}
	{
		keys := make([]string, 0, len(fv.meta))
		for k := range fv.meta {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			v := fv.meta[k]
			kk := fv.b.CreateString(k)
			vv := fv.b.CreateString(v)
			flatbuf.KeyValueStart(fv.b)
			flatbuf.KeyValueAddKey(fv.b, kk)
			flatbuf.KeyValueAddValue(fv.b, vv)
			kvs = append(kvs, flatbuf.KeyValueEnd(fv.b))
		}
	}
	if len(kvs) > 0 {
		flatbuf.FieldStartCustomMetadataVector(fv.b, len(kvs))
		for i := len(kvs) - 1; i >= 0; i-- {
			fv.b.PrependUOffsetT(kvs[i])
		}
		metaFB = fv.b.EndVector(len(kvs))
	}

	flatbuf.FieldStart(fv.b)
	flatbuf.FieldAddName(fv.b, nameFB)
	flatbuf.FieldAddNullable(fv.b, field.Nullable)
	flatbuf.FieldAddTypeType(fv.b, fv.dtype)
	flatbuf.FieldAddType(fv.b, fv.offset)
	flatbuf.FieldAddDictionary(fv.b, dictFB)
	flatbuf.FieldAddChildren(fv.b, kidsFB)
	flatbuf.FieldAddCustomMetadata(fv.b, metaFB)

	offset := flatbuf.FieldEnd(fv.b)

	return offset
}

func fieldFromFBDict(field *flatbuf.Field) (arrow.Field, error) {
	var (
		o = arrow.Field{
			Name:     string(field.Name()),
			Nullable: field.Nullable(),
		}
		err  error
		memo = newMemo()
	)

	// any DictionaryEncoding set is ignored here.

	kids := make([]arrow.Field, field.ChildrenLength())
	for i := range kids {
		var kid flatbuf.Field
		if !field.Children(&kid, i) {
			return o, errors.Errorf("arrow/ipc: could not load field child %d", i)
		}
		kids[i], err = fieldFromFB(&kid, &memo)
		if err != nil {
			return o, errors.Wrap(err, "arrow/ipc: field from dict")
		}
	}

	meta, err := metadataFromFB(field)
	if err != nil {
		return o, errors.Wrap(err, "arrow/ipc: metadata for field from dict")
	}

	o.Type, err = typeFromFB(field, kids, meta)
	if err != nil {
		return o, errors.Wrap(err, "arrow/ipc: type for field from dict")
	}

	return o, nil
}

func typeFromFB(field *flatbuf.Field, children []arrow.Field, md arrow.Metadata) (arrow.DataType, error) {
	var data flatbuffers.Table
	if !field.Type(&data) {
		return nil, errors.Errorf("arrow/ipc: could not load field type data")
	}

	dt, err := concreteTypeFromFB(field.TypeType(), data, children)
	if err != nil {
		return dt, err
	}

	// look for extension metadata in custom metadata field.
	if md.Len() > 0 {
		i := md.FindKey(kExtensionTypeKeyName)
		if i < 0 {
			return dt, err
		}

		panic("not implemented") // FIXME(sbinet)
	}

	return dt, err
}

func concreteTypeFromFB(typ flatbuf.Type, data flatbuffers.Table, children []arrow.Field) (arrow.DataType, error) {
	var (
		dt  arrow.DataType
		err error
	)

	switch typ {
	case flatbuf.TypeNONE:
		return nil, errors.Errorf("arrow/ipc: Type metadata cannot be none")

	case flatbuf.TypeNull:
		return arrow.Null, nil

	case flatbuf.TypeInt:
		var dt flatbuf.Int
		dt.Init(data.Bytes, data.Pos)
		return intFromFB(dt)

	case flatbuf.TypeFloatingPoint:
		var dt flatbuf.FloatingPoint
		dt.Init(data.Bytes, data.Pos)
		return floatFromFB(dt)

	case flatbuf.TypeDecimal:
		var dt flatbuf.Decimal
		dt.Init(data.Bytes, data.Pos)
		return decimalFromFB(dt)

	case flatbuf.TypeBinary:
		return arrow.BinaryTypes.Binary, nil

	case flatbuf.TypeFixedSizeBinary:
		var dt flatbuf.FixedSizeBinary
		dt.Init(data.Bytes, data.Pos)
		return &arrow.FixedSizeBinaryType{ByteWidth: int(dt.ByteWidth())}, nil

	case flatbuf.TypeUtf8:
		return arrow.BinaryTypes.String, nil

	case flatbuf.TypeBool:
		return arrow.FixedWidthTypes.Boolean, nil

	case flatbuf.TypeList:
		if len(children) != 1 {
			return nil, errors.Errorf("arrow/ipc: List must have exactly 1 child field (got=%d)", len(children))
		}
		return arrow.ListOf(children[0].Type), nil

	case flatbuf.TypeFixedSizeList:
		var dt flatbuf.FixedSizeList
		dt.Init(data.Bytes, data.Pos)
		if len(children) != 1 {
			return nil, errors.Errorf("arrow/ipc: FixedSizeList must have exactly 1 child field (got=%d)", len(children))
		}
		return arrow.FixedSizeListOf(dt.ListSize(), children[0].Type), nil

	case flatbuf.TypeStruct_:
		return arrow.StructOf(children...), nil

	case flatbuf.TypeTime:
		var dt flatbuf.Time
		dt.Init(data.Bytes, data.Pos)
		return timeFromFB(dt)

	case flatbuf.TypeTimestamp:
		var dt flatbuf.Timestamp
		dt.Init(data.Bytes, data.Pos)
		return timestampFromFB(dt)

	case flatbuf.TypeDate:
		var dt flatbuf.Date
		dt.Init(data.Bytes, data.Pos)
		return dateFromFB(dt)

	case flatbuf.TypeInterval:
		var dt flatbuf.Interval
		dt.Init(data.Bytes, data.Pos)
		return intervalFromFB(dt)

	case flatbuf.TypeDuration:
		var dt flatbuf.Duration
		dt.Init(data.Bytes, data.Pos)
		return durationFromFB(dt)

	default:
		// FIXME(sbinet): implement all the other types.
		panic(fmt.Errorf("arrow/ipc: type %v not implemented", flatbuf.EnumNamesType[typ]))
	}

	return dt, err
}

func intFromFB(data flatbuf.Int) (arrow.DataType, error) {
	bw := data.BitWidth()
	if bw > 64 {
		return nil, errors.Errorf("arrow/ipc: integers with more than 64 bits not implemented (bits=%d)", bw)
	}
	if bw < 8 {
		return nil, errors.Errorf("arrow/ipc: integers with less than 8 bits not implemented (bits=%d)", bw)
	}

	switch bw {
	case 8:
		if !data.IsSigned() {
			return arrow.PrimitiveTypes.Uint8, nil
		}
		return arrow.PrimitiveTypes.Int8, nil

	case 16:
		if !data.IsSigned() {
			return arrow.PrimitiveTypes.Uint16, nil
		}
		return arrow.PrimitiveTypes.Int16, nil

	case 32:
		if !data.IsSigned() {
			return arrow.PrimitiveTypes.Uint32, nil
		}
		return arrow.PrimitiveTypes.Int32, nil

	case 64:
		if !data.IsSigned() {
			return arrow.PrimitiveTypes.Uint64, nil
		}
		return arrow.PrimitiveTypes.Int64, nil
	default:
		return nil, errors.Errorf("arrow/ipc: integers not in cstdint are not implemented")
	}
}

func intToFB(b *flatbuffers.Builder, bw int32, isSigned bool) flatbuffers.UOffsetT {
	flatbuf.IntStart(b)
	flatbuf.IntAddBitWidth(b, bw)
	flatbuf.IntAddIsSigned(b, isSigned)
	return flatbuf.IntEnd(b)
}

func floatFromFB(data flatbuf.FloatingPoint) (arrow.DataType, error) {
	switch p := data.Precision(); p {
	case flatbuf.PrecisionHALF:
		return arrow.FixedWidthTypes.Float16, nil
	case flatbuf.PrecisionSINGLE:
		return arrow.PrimitiveTypes.Float32, nil
	case flatbuf.PrecisionDOUBLE:
		return arrow.PrimitiveTypes.Float64, nil
	default:
		return nil, errors.Errorf("arrow/ipc: floating point type with %d precision not implemented", p)
	}
}

func floatToFB(b *flatbuffers.Builder, bw int32) flatbuffers.UOffsetT {
	switch bw {
	case 16:
		flatbuf.FloatingPointStart(b)
		flatbuf.FloatingPointAddPrecision(b, flatbuf.PrecisionHALF)
		return flatbuf.FloatingPointEnd(b)
	case 32:
		flatbuf.FloatingPointStart(b)
		flatbuf.FloatingPointAddPrecision(b, flatbuf.PrecisionSINGLE)
		return flatbuf.FloatingPointEnd(b)
	case 64:
		flatbuf.FloatingPointStart(b)
		flatbuf.FloatingPointAddPrecision(b, flatbuf.PrecisionDOUBLE)
		return flatbuf.FloatingPointEnd(b)
	default:
		panic(errors.Errorf("arrow/ipc: invalid floating point precision %d-bits", bw))
	}
}

func decimalFromFB(data flatbuf.Decimal) (arrow.DataType, error) {
	return &arrow.Decimal128Type{Precision: data.Precision(), Scale: data.Scale()}, nil
}

func timeFromFB(data flatbuf.Time) (arrow.DataType, error) {
	bw := data.BitWidth()
	unit := unitFromFB(data.Unit())

	switch bw {
	case 32:
		switch unit {
		case arrow.Millisecond:
			return arrow.FixedWidthTypes.Time32ms, nil
		case arrow.Second:
			return arrow.FixedWidthTypes.Time32s, nil
		default:
			return nil, errors.Errorf("arrow/ipc: Time32 type with %v unit not implemented", unit)
		}
	case 64:
		switch unit {
		case arrow.Nanosecond:
			return arrow.FixedWidthTypes.Time64ns, nil
		case arrow.Microsecond:
			return arrow.FixedWidthTypes.Time64us, nil
		default:
			return nil, errors.Errorf("arrow/ipc: Time64 type with %v unit not implemented", unit)
		}
	default:
		return nil, errors.Errorf("arrow/ipc: Time type with %d bitwidth not implemented", bw)
	}
}

func timestampFromFB(data flatbuf.Timestamp) (arrow.DataType, error) {
	unit := unitFromFB(data.Unit())
	tz := string(data.Timezone())
	return &arrow.TimestampType{Unit: unit, TimeZone: tz}, nil
}

func dateFromFB(data flatbuf.Date) (arrow.DataType, error) {
	switch data.Unit() {
	case flatbuf.DateUnitDAY:
		return arrow.FixedWidthTypes.Date32, nil
	case flatbuf.DateUnitMILLISECOND:
		return arrow.FixedWidthTypes.Date64, nil
	}
	return nil, errors.Errorf("arrow/ipc: Date type with %d unit not implemented", data.Unit())
}

func intervalFromFB(data flatbuf.Interval) (arrow.DataType, error) {
	switch data.Unit() {
	case flatbuf.IntervalUnitYEAR_MONTH:
		return arrow.FixedWidthTypes.MonthInterval, nil
	case flatbuf.IntervalUnitDAY_TIME:
		return arrow.FixedWidthTypes.DayTimeInterval, nil
	}
	return nil, errors.Errorf("arrow/ipc: Interval type with %d unit not implemented", data.Unit())
}

func durationFromFB(data flatbuf.Duration) (arrow.DataType, error) {
	switch data.Unit() {
	case flatbuf.TimeUnitSECOND:
		return arrow.FixedWidthTypes.Duration_s, nil
	case flatbuf.TimeUnitMILLISECOND:
		return arrow.FixedWidthTypes.Duration_ms, nil
	case flatbuf.TimeUnitMICROSECOND:
		return arrow.FixedWidthTypes.Duration_us, nil
	case flatbuf.TimeUnitNANOSECOND:
		return arrow.FixedWidthTypes.Duration_ns, nil
	}
	return nil, errors.Errorf("arrow/ipc: Duration type with %d unit not implemented", data.Unit())
}

type customMetadataer interface {
	CustomMetadataLength() int
	CustomMetadata(*flatbuf.KeyValue, int) bool
}

func metadataFromFB(md customMetadataer) (arrow.Metadata, error) {
	var (
		keys = make([]string, md.CustomMetadataLength())
		vals = make([]string, md.CustomMetadataLength())
	)

	for i := range keys {
		var kv flatbuf.KeyValue
		if !md.CustomMetadata(&kv, i) {
			return arrow.Metadata{}, errors.Errorf("arrow/ipc: could not read key-value %d from flatbuffer", i)
		}
		keys[i] = string(kv.Key())
		vals[i] = string(kv.Value())
	}

	return arrow.NewMetadata(keys, vals), nil
}

func metadataToFB(b *flatbuffers.Builder, meta arrow.Metadata, start startVecFunc) flatbuffers.UOffsetT {
	if meta.Len() == 0 {
		return 0
	}

	n := meta.Len()
	kvs := make([]flatbuffers.UOffsetT, n)
	for i := range kvs {
		k := b.CreateString(meta.Keys()[i])
		v := b.CreateString(meta.Values()[i])
		flatbuf.KeyValueStart(b)
		flatbuf.KeyValueAddKey(b, k)
		flatbuf.KeyValueAddValue(b, v)
		kvs[i] = flatbuf.KeyValueEnd(b)
	}

	start(b, n)
	for i := n - 1; i >= 0; i-- {
		b.PrependUOffsetT(kvs[i])
	}
	return b.EndVector(n)
}

func schemaFromFB(schema *flatbuf.Schema, memo *dictMemo) (*arrow.Schema, error) {
	var (
		err    error
		fields = make([]arrow.Field, schema.FieldsLength())
	)

	for i := range fields {
		var field flatbuf.Field
		if !schema.Fields(&field, i) {
			return nil, errors.Errorf("arrow/ipc: could not read field %d from schema", i)
		}

		fields[i], err = fieldFromFB(&field, memo)
		if err != nil {
			return nil, errors.Wrapf(err, "arrow/ipc: could not convert field %d from flatbuf", i)
		}
	}

	md, err := metadataFromFB(schema)
	if err != nil {
		return nil, errors.Wrapf(err, "arrow/ipc: could not convert schema metadata from flatbuf")
	}

	return arrow.NewSchema(fields, &md), nil
}

func schemaToFB(b *flatbuffers.Builder, schema *arrow.Schema, memo *dictMemo) flatbuffers.UOffsetT {
	fields := make([]flatbuffers.UOffsetT, len(schema.Fields()))
	for i, field := range schema.Fields() {
		fields[i] = fieldToFB(b, field, memo)
	}

	flatbuf.SchemaStartFieldsVector(b, len(fields))
	for i := len(fields) - 1; i >= 0; i-- {
		b.PrependUOffsetT(fields[i])
	}
	fieldsFB := b.EndVector(len(fields))

	metaFB := metadataToFB(b, schema.Metadata(), flatbuf.SchemaStartCustomMetadataVector)

	flatbuf.SchemaStart(b)
	flatbuf.SchemaAddEndianness(b, flatbuf.EndiannessLittle)
	flatbuf.SchemaAddFields(b, fieldsFB)
	flatbuf.SchemaAddCustomMetadata(b, metaFB)
	offset := flatbuf.SchemaEnd(b)

	return offset
}

func dictTypesFromFB(schema *flatbuf.Schema) (dictTypeMap, error) {
	var (
		err    error
		fields = make(dictTypeMap, schema.FieldsLength())
	)
	for i := 0; i < schema.FieldsLength(); i++ {
		var field flatbuf.Field
		if !schema.Fields(&field, i) {
			return nil, errors.Errorf("arrow/ipc: could not load field %d from schema", i)
		}
		fields, err = visitField(&field, fields)
		if err != nil {
			return nil, errors.Wrapf(err, "arrow/ipc: could not visit field %d from schema", i)
		}
	}
	return fields, err
}

func visitField(field *flatbuf.Field, dict dictTypeMap) (dictTypeMap, error) {
	var err error
	meta := field.Dictionary(nil)
	switch meta {
	case nil:
		// field is not dictionary encoded.
		// => visit children.
		for i := 0; i < field.ChildrenLength(); i++ {
			var child flatbuf.Field
			if !field.Children(&child, i) {
				return nil, errors.Errorf("arrow/ipc: could not visit child %d from field", i)
			}
			dict, err = visitField(&child, dict)
			if err != nil {
				return nil, err
			}
		}
	default:
		// field is dictionary encoded.
		// construct the data type for the dictionary: no descendants can be dict-encoded.
		dfield, err := fieldFromFBDict(field)
		if err != nil {
			return nil, errors.Wrap(err, "arrow/ipc: could not create data type for dictionary")
		}
		dict[meta.Id()] = dfield
	}
	return dict, err
}

// payloadsFromSchema returns a slice of payloads corresponding to the given schema.
// Callers of payloadsFromSchema will need to call Release after use.
func payloadsFromSchema(schema *arrow.Schema, mem memory.Allocator, memo *dictMemo) payloads {
	dict := newMemo()

	ps := make(payloads, 1, dict.Len()+1)
	ps[0].msg = MessageSchema
	ps[0].meta = writeSchemaMessage(schema, mem, &dict)

	// append dictionaries.
	if dict.Len() > 0 {
		panic("payloads-from-schema: not-implemented")
		//		for id, arr := range dict.id2dict {
		//			// GetSchemaPayloads: writer.cc:535
		//		}
	}

	if memo != nil {
		*memo = dict
	}

	return ps
}

func writeFBBuilder(b *flatbuffers.Builder, mem memory.Allocator) *memory.Buffer {
	raw := b.FinishedBytes()
	buf := memory.NewResizableBuffer(mem)
	buf.Resize(len(raw))
	copy(buf.Bytes(), raw)
	return buf
}

func writeMessageFB(b *flatbuffers.Builder, mem memory.Allocator, hdrType flatbuf.MessageHeader, hdr flatbuffers.UOffsetT, bodyLen int64) *memory.Buffer {

	flatbuf.MessageStart(b)
	flatbuf.MessageAddVersion(b, int16(currentMetadataVersion))
	flatbuf.MessageAddHeaderType(b, hdrType)
	flatbuf.MessageAddHeader(b, hdr)
	flatbuf.MessageAddBodyLength(b, bodyLen)
	msg := flatbuf.MessageEnd(b)
	b.Finish(msg)

	return writeFBBuilder(b, mem)
}

func writeSchemaMessage(schema *arrow.Schema, mem memory.Allocator, dict *dictMemo) *memory.Buffer {
	b := flatbuffers.NewBuilder(1024)
	schemaFB := schemaToFB(b, schema, dict)
	return writeMessageFB(b, mem, flatbuf.MessageHeaderSchema, schemaFB, 0)
}

func writeFileFooter(schema *arrow.Schema, dicts, recs []fileBlock, w io.Writer) error {
	var (
		b    = flatbuffers.NewBuilder(1024)
		memo = newMemo()
	)

	schemaFB := schemaToFB(b, schema, &memo)
	dictsFB := fileBlocksToFB(b, dicts, flatbuf.FooterStartDictionariesVector)
	recsFB := fileBlocksToFB(b, recs, flatbuf.FooterStartRecordBatchesVector)

	flatbuf.FooterStart(b)
	flatbuf.FooterAddVersion(b, int16(currentMetadataVersion))
	flatbuf.FooterAddSchema(b, schemaFB)
	flatbuf.FooterAddDictionaries(b, dictsFB)
	flatbuf.FooterAddRecordBatches(b, recsFB)
	footer := flatbuf.FooterEnd(b)

	b.Finish(footer)

	_, err := w.Write(b.FinishedBytes())
	return err
}

func writeRecordMessage(mem memory.Allocator, size, bodyLength int64, fields []fieldMetadata, meta []bufferMetadata) *memory.Buffer {
	b := flatbuffers.NewBuilder(0)
	recFB := recordToFB(b, size, bodyLength, fields, meta)
	return writeMessageFB(b, mem, flatbuf.MessageHeaderRecordBatch, recFB, bodyLength)
}

func recordToFB(b *flatbuffers.Builder, size, bodyLength int64, fields []fieldMetadata, meta []bufferMetadata) flatbuffers.UOffsetT {
	fieldsFB := writeFieldNodes(b, fields, flatbuf.RecordBatchStartNodesVector)
	metaFB := writeBuffers(b, meta, flatbuf.RecordBatchStartBuffersVector)

	flatbuf.RecordBatchStart(b)
	flatbuf.RecordBatchAddLength(b, size)
	flatbuf.RecordBatchAddNodes(b, fieldsFB)
	flatbuf.RecordBatchAddBuffers(b, metaFB)
	return flatbuf.RecordBatchEnd(b)
}

func writeFieldNodes(b *flatbuffers.Builder, fields []fieldMetadata, start startVecFunc) flatbuffers.UOffsetT {

	start(b, len(fields))
	for i := len(fields) - 1; i >= 0; i-- {
		field := fields[i]
		if field.Offset != 0 {
			panic(errors.Errorf("arrow/ipc: field metadata for IPC must have offset 0"))
		}
		flatbuf.CreateFieldNode(b, field.Len, field.Nulls)
	}

	return b.EndVector(len(fields))
}

func writeBuffers(b *flatbuffers.Builder, buffers []bufferMetadata, start startVecFunc) flatbuffers.UOffsetT {
	start(b, len(buffers))
	for i := len(buffers) - 1; i >= 0; i-- {
		buffer := buffers[i]
		flatbuf.CreateBuffer(b, buffer.Offset, buffer.Len)
	}
	return b.EndVector(len(buffers))
}

func writeMessage(msg *memory.Buffer, alignment int32, w io.Writer) (int, error) {
	var (
		n   int
		err error
	)

	// ARROW-3212: we do not make any assumption on whether the output stream is aligned or not.
	paddedMsgLen := int32(msg.Len()) + 8
	remainder := paddedMsgLen % alignment
	if remainder != 0 {
		paddedMsgLen += alignment - remainder
	}

	tmp := make([]byte, 4)

	// write continuation indicator, to address 8-byte alignment requirement from FlatBuffers.
	binary.LittleEndian.PutUint32(tmp, kIPCContToken)
	_, err = w.Write(tmp)
	if err != nil {
		return 0, errors.Wrap(err, "arrow/ipc: could not write continuation bit indicator")
	}

	// the returned message size includes the length prefix, the flatbuffer, + padding
	n = int(paddedMsgLen)

	// write the flatbuffer size prefix, including padding
	sizeFB := paddedMsgLen - 8
	binary.LittleEndian.PutUint32(tmp, uint32(sizeFB))
	_, err = w.Write(tmp)
	if err != nil {
		return n, errors.Wrap(err, "arrow/ipc: could not write message flatbuffer size prefix")
	}

	// write the flatbuffer
	_, err = w.Write(msg.Bytes())
	if err != nil {
		return n, errors.Wrap(err, "arrow/ipc: could not write message flatbuffer")
	}

	// write any padding
	padding := paddedMsgLen - int32(msg.Len()) - 8
	if padding > 0 {
		_, err = w.Write(paddingBytes[:padding])
		if err != nil {
			return n, errors.Wrap(err, "arrow/ipc: could not write message padding bytes")
		}
	}

	return n, err
}
