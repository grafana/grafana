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

package ipc

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"sort"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/endian"
	"github.com/apache/arrow-go/v18/arrow/internal/dictutils"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
	"github.com/apache/arrow-go/v18/arrow/memory"
	flatbuffers "github.com/google/flatbuffers/go"
)

// Magic string identifying an Apache Arrow file.
var Magic = []byte("ARROW1")

const (
	currentMetadataVersion = MetadataV5
	minMetadataVersion     = MetadataV4

	// constants for the extension type metadata keys for the type name and
	// any extension metadata to be passed to deserialize.
	ExtensionTypeKeyName     = "ARROW:extension:name"
	ExtensionMetadataKeyName = "ARROW:extension:metadata"

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
	offset int64
	meta   int32
	body   int64

	r   io.ReaderAt
	mem memory.Allocator
}

func (blk fileBlock) Offset() int64 { return blk.offset }
func (blk fileBlock) Meta() int32   { return blk.meta }
func (blk fileBlock) Body() int64   { return blk.body }

func fileBlocksToFB(b *flatbuffers.Builder, blocks []dataBlock, start startVecFunc) flatbuffers.UOffsetT {
	start(b, len(blocks))
	for i := len(blocks) - 1; i >= 0; i-- {
		blk := blocks[i]
		flatbuf.CreateBlock(b, blk.Offset(), blk.Meta(), blk.Body())
	}

	return b.EndVector(len(blocks))
}

func (blk fileBlock) NewMessage() (*Message, error) {
	var (
		err  error
		buf  []byte
		body *memory.Buffer
		meta *memory.Buffer
		r    = blk.section()
	)

	meta = memory.NewResizableBuffer(blk.mem)
	meta.Resize(int(blk.meta))
	defer meta.Release()

	buf = meta.Bytes()
	_, err = io.ReadFull(r, buf)
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not read message metadata: %w", err)
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

	// drop buf-size already known from blk.Meta
	meta = memory.SliceBuffer(meta, prefix, int(blk.meta)-prefix)
	defer meta.Release()

	body = memory.NewResizableBuffer(blk.mem)
	defer body.Release()
	body.Resize(int(blk.body))
	buf = body.Bytes()
	_, err = io.ReadFull(r, buf)
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not read message body: %w", err)
	}

	return NewMessage(meta, body), nil
}

func (blk fileBlock) section() io.Reader {
	return io.NewSectionReader(blk.r, blk.offset, int64(blk.meta)+blk.body)
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
		panic(fmt.Errorf("arrow/ipc: invalid flatbuf.TimeUnit(%d) value", unit))
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
		panic(fmt.Errorf("arrow/ipc: invalid arrow.TimeUnit(%d) value", unit))
	}
}

// initFB is a helper function to handle flatbuffers' polymorphism.
func initFB(t interface {
	Table() flatbuffers.Table
	Init([]byte, flatbuffers.UOffsetT)
}, f func(tbl *flatbuffers.Table) bool) {
	tbl := t.Table()
	if !f(&tbl) {
		panic(fmt.Errorf("arrow/ipc: could not initialize %T from flatbuffer", t))
	}
	t.Init(tbl.Bytes, tbl.Pos)
}

func fieldFromFB(field *flatbuf.Field, pos dictutils.FieldPos, memo *dictutils.Memo) (arrow.Field, error) {
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

	n := field.ChildrenLength()
	children := make([]arrow.Field, n)
	for i := range children {
		var childFB flatbuf.Field
		if !field.Children(&childFB, i) {
			return o, fmt.Errorf("arrow/ipc: could not load field child %d", i)

		}
		child, err := fieldFromFB(&childFB, pos.Child(int32(i)), memo)
		if err != nil {
			return o, fmt.Errorf("arrow/ipc: could not convert field child %d: %w", i, err)
		}
		children[i] = child
	}

	o.Type, err = typeFromFB(field, pos, children, &o.Metadata, memo)
	if err != nil {
		return o, fmt.Errorf("arrow/ipc: could not convert field type: %w", err)
	}

	return o, nil
}

func fieldToFB(b *flatbuffers.Builder, pos dictutils.FieldPos, field arrow.Field, memo *dictutils.Mapper) flatbuffers.UOffsetT {
	var visitor = fieldVisitor{b: b, memo: memo, pos: pos, meta: make(map[string]string)}
	return visitor.result(field)
}

type fieldVisitor struct {
	b      *flatbuffers.Builder
	memo   *dictutils.Mapper
	pos    dictutils.FieldPos
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

	case arrow.DecimalType:
		fv.dtype = flatbuf.TypeDecimal
		flatbuf.DecimalStart(fv.b)
		flatbuf.DecimalAddPrecision(fv.b, dt.GetPrecision())
		flatbuf.DecimalAddScale(fv.b, dt.GetScale())
		flatbuf.DecimalAddBitWidth(fv.b, int32(dt.BitWidth()))
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

	case *arrow.LargeBinaryType:
		fv.dtype = flatbuf.TypeLargeBinary
		flatbuf.LargeBinaryStart(fv.b)
		fv.offset = flatbuf.LargeBinaryEnd(fv.b)

	case *arrow.StringType:
		fv.dtype = flatbuf.TypeUtf8
		flatbuf.Utf8Start(fv.b)
		fv.offset = flatbuf.Utf8End(fv.b)

	case *arrow.LargeStringType:
		fv.dtype = flatbuf.TypeLargeUtf8
		flatbuf.LargeUtf8Start(fv.b)
		fv.offset = flatbuf.LargeUtf8End(fv.b)

	case *arrow.BinaryViewType:
		fv.dtype = flatbuf.TypeBinaryView
		flatbuf.BinaryViewStart(fv.b)
		fv.offset = flatbuf.BinaryViewEnd(fv.b)

	case *arrow.StringViewType:
		fv.dtype = flatbuf.TypeUtf8View
		flatbuf.Utf8ViewStart(fv.b)
		fv.offset = flatbuf.Utf8ViewEnd(fv.b)

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
		offsets := make([]flatbuffers.UOffsetT, dt.NumFields())
		for i, field := range dt.Fields() {
			offsets[i] = fieldToFB(fv.b, fv.pos.Child(int32(i)), field, fv.memo)
		}
		flatbuf.Struct_Start(fv.b)
		for i := len(offsets) - 1; i >= 0; i-- {
			fv.b.PrependUOffsetT(offsets[i])
		}
		fv.offset = flatbuf.Struct_End(fv.b)
		fv.kids = append(fv.kids, offsets...)

	case *arrow.ListType:
		fv.dtype = flatbuf.TypeList
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
		flatbuf.ListStart(fv.b)
		fv.offset = flatbuf.ListEnd(fv.b)

	case *arrow.LargeListType:
		fv.dtype = flatbuf.TypeLargeList
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
		flatbuf.LargeListStart(fv.b)
		fv.offset = flatbuf.LargeListEnd(fv.b)

	case *arrow.ListViewType:
		fv.dtype = flatbuf.TypeListView
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
		flatbuf.ListViewStart(fv.b)
		fv.offset = flatbuf.ListViewEnd(fv.b)

	case *arrow.LargeListViewType:
		fv.dtype = flatbuf.TypeLargeListView
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
		flatbuf.LargeListViewStart(fv.b)
		fv.offset = flatbuf.LargeListViewEnd(fv.b)

	case *arrow.FixedSizeListType:
		fv.dtype = flatbuf.TypeFixedSizeList
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
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

	case *arrow.MonthDayNanoIntervalType:
		fv.dtype = flatbuf.TypeInterval
		flatbuf.IntervalStart(fv.b)
		flatbuf.IntervalAddUnit(fv.b, flatbuf.IntervalUnitMONTH_DAY_NANO)
		fv.offset = flatbuf.IntervalEnd(fv.b)

	case *arrow.DurationType:
		fv.dtype = flatbuf.TypeDuration
		unit := unitToFB(dt.Unit)
		flatbuf.DurationStart(fv.b)
		flatbuf.DurationAddUnit(fv.b, unit)
		fv.offset = flatbuf.DurationEnd(fv.b)

	case *arrow.MapType:
		fv.dtype = flatbuf.TypeMap
		fv.kids = append(fv.kids, fieldToFB(fv.b, fv.pos.Child(0), dt.ElemField(), fv.memo))
		flatbuf.MapStart(fv.b)
		flatbuf.MapAddKeysSorted(fv.b, dt.KeysSorted)
		fv.offset = flatbuf.MapEnd(fv.b)

	case *arrow.RunEndEncodedType:
		fv.dtype = flatbuf.TypeRunEndEncoded
		var offsets [2]flatbuffers.UOffsetT
		offsets[0] = fieldToFB(fv.b, fv.pos.Child(0),
			arrow.Field{Name: "run_ends", Type: dt.RunEnds()}, fv.memo)
		offsets[1] = fieldToFB(fv.b, fv.pos.Child(1),
			arrow.Field{Name: "values", Type: dt.Encoded(), Nullable: true}, fv.memo)
		flatbuf.RunEndEncodedStart(fv.b)
		fv.b.PrependUOffsetT(offsets[1])
		fv.b.PrependUOffsetT(offsets[0])
		fv.offset = flatbuf.RunEndEncodedEnd(fv.b)
		fv.kids = append(fv.kids, offsets[0], offsets[1])

	case arrow.ExtensionType:
		field.Type = dt.StorageType()
		fv.visit(field)
		fv.meta[ExtensionTypeKeyName] = dt.ExtensionName()
		fv.meta[ExtensionMetadataKeyName] = string(dt.Serialize())

	case *arrow.DictionaryType:
		field.Type = dt.ValueType
		fv.visit(field)

	case arrow.UnionType:
		fv.dtype = flatbuf.TypeUnion
		offsets := make([]flatbuffers.UOffsetT, dt.NumFields())
		for i, field := range dt.Fields() {
			offsets[i] = fieldToFB(fv.b, fv.pos.Child(int32(i)), field, fv.memo)
		}

		codes := dt.TypeCodes()
		flatbuf.UnionStartTypeIdsVector(fv.b, len(codes))

		for i := len(codes) - 1; i >= 0; i-- {
			fv.b.PlaceInt32(int32(codes[i]))
		}
		fbTypeIDs := fv.b.EndVector(len(dt.TypeCodes()))
		flatbuf.UnionStart(fv.b)
		switch dt.Mode() {
		case arrow.SparseMode:
			flatbuf.UnionAddMode(fv.b, flatbuf.UnionModeSparse)
		case arrow.DenseMode:
			flatbuf.UnionAddMode(fv.b, flatbuf.UnionModeDense)
		default:
			panic("invalid union mode")
		}
		flatbuf.UnionAddTypeIds(fv.b, fbTypeIDs)
		fv.offset = flatbuf.UnionEnd(fv.b)
		fv.kids = append(fv.kids, offsets...)

	default:
		err := fmt.Errorf("arrow/ipc: invalid data type %v", dt)
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

	storageType := field.Type
	if storageType.ID() == arrow.EXTENSION {
		storageType = storageType.(arrow.ExtensionType).StorageType()
	}

	var dictFB flatbuffers.UOffsetT
	if storageType.ID() == arrow.DICTIONARY {
		idxType := field.Type.(*arrow.DictionaryType).IndexType.(arrow.FixedWidthDataType)

		dictID, err := fv.memo.GetFieldID(fv.pos.Path())
		if err != nil {
			panic(err)
		}
		var signed bool
		switch idxType.ID() {
		case arrow.UINT8, arrow.UINT16, arrow.UINT32, arrow.UINT64:
			signed = false
		case arrow.INT8, arrow.INT16, arrow.INT32, arrow.INT64:
			signed = true
		}
		indexTypeOffset := intToFB(fv.b, int32(idxType.BitWidth()), signed)
		flatbuf.DictionaryEncodingStart(fv.b)
		flatbuf.DictionaryEncodingAddId(fv.b, dictID)
		flatbuf.DictionaryEncodingAddIndexType(fv.b, indexTypeOffset)
		flatbuf.DictionaryEncodingAddIsOrdered(fv.b, field.Type.(*arrow.DictionaryType).Ordered)
		dictFB = flatbuf.DictionaryEncodingEnd(fv.b)
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

func typeFromFB(field *flatbuf.Field, pos dictutils.FieldPos, children []arrow.Field, md *arrow.Metadata, memo *dictutils.Memo) (arrow.DataType, error) {
	var data flatbuffers.Table
	if !field.Type(&data) {
		return nil, fmt.Errorf("arrow/ipc: could not load field type data")
	}

	dt, err := concreteTypeFromFB(field.TypeType(), data, children)
	if err != nil {
		return dt, err
	}

	var (
		dictID        = int64(-1)
		dictValueType arrow.DataType
		encoding      = field.Dictionary(nil)
	)
	if encoding != nil {
		var idt flatbuf.Int
		encoding.IndexType(&idt)
		idxType, err := intFromFB(idt)
		if err != nil {
			return nil, err
		}

		dictValueType = dt
		dt = &arrow.DictionaryType{IndexType: idxType, ValueType: dictValueType, Ordered: encoding.IsOrdered()}
		dictID = encoding.Id()

		if err = memo.Mapper.AddField(dictID, pos.Path()); err != nil {
			return dt, err
		}
		if err = memo.AddType(dictID, dictValueType); err != nil {
			return dt, err
		}

	}

	// look for extension metadata in custom metadata field.
	if md.Len() > 0 {
		i := md.FindKey(ExtensionTypeKeyName)
		if i < 0 {
			return dt, err
		}

		extType := arrow.GetExtensionType(md.Values()[i])
		if extType == nil {
			// if the extension type is unknown, we do not error here.
			// simply return the storage type.
			return dt, err
		}

		var (
			data    string
			dataIdx int
		)

		if dataIdx = md.FindKey(ExtensionMetadataKeyName); dataIdx >= 0 {
			data = md.Values()[dataIdx]
		}

		dt, err = extType.Deserialize(dt, data)
		if err != nil {
			return dt, err
		}

		mdkeys := md.Keys()
		mdvals := md.Values()
		if dataIdx < 0 {
			// if there was no extension metadata, just the name, we only have to
			// remove the extension name metadata key/value to ensure roundtrip
			// metadata consistency
			*md = arrow.NewMetadata(append(mdkeys[:i], mdkeys[i+1:]...), append(mdvals[:i], mdvals[i+1:]...))
		} else {
			// if there was extension metadata, we need to remove both the type name
			// and the extension metadata keys and values.
			newkeys := make([]string, 0, md.Len()-2)
			newvals := make([]string, 0, md.Len()-2)
			for j := range mdkeys {
				if j != i && j != dataIdx { // copy everything except the extension metadata keys/values
					newkeys = append(newkeys, mdkeys[j])
					newvals = append(newvals, mdvals[j])
				}
			}
			*md = arrow.NewMetadata(newkeys, newvals)
		}
	}

	return dt, err
}

func concreteTypeFromFB(typ flatbuf.Type, data flatbuffers.Table, children []arrow.Field) (arrow.DataType, error) {
	switch typ {
	case flatbuf.TypeNONE:
		return nil, fmt.Errorf("arrow/ipc: Type metadata cannot be none")

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

	case flatbuf.TypeLargeBinary:
		return arrow.BinaryTypes.LargeBinary, nil

	case flatbuf.TypeLargeUtf8:
		return arrow.BinaryTypes.LargeString, nil

	case flatbuf.TypeUtf8View:
		return arrow.BinaryTypes.StringView, nil

	case flatbuf.TypeBinaryView:
		return arrow.BinaryTypes.BinaryView, nil

	case flatbuf.TypeBool:
		return arrow.FixedWidthTypes.Boolean, nil

	case flatbuf.TypeList:
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: List must have exactly 1 child field (got=%d)", len(children))
		}
		dt := arrow.ListOfField(children[0])
		return dt, nil

	case flatbuf.TypeLargeList:
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: LargeList must have exactly 1 child field (got=%d)", len(children))
		}
		dt := arrow.LargeListOfField(children[0])
		return dt, nil

	case flatbuf.TypeListView:
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: ListView must have exactly 1 child field (got=%d)", len(children))
		}
		dt := arrow.ListViewOfField(children[0])
		return dt, nil

	case flatbuf.TypeLargeListView:
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: LargeListView must have exactly 1 child field (got=%d)", len(children))
		}
		dt := arrow.LargeListViewOfField(children[0])
		return dt, nil

	case flatbuf.TypeFixedSizeList:
		var dt flatbuf.FixedSizeList
		dt.Init(data.Bytes, data.Pos)
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: FixedSizeList must have exactly 1 child field (got=%d)", len(children))
		}
		ret := arrow.FixedSizeListOfField(dt.ListSize(), children[0])
		return ret, nil

	case flatbuf.TypeStruct_:
		return arrow.StructOf(children...), nil

	case flatbuf.TypeUnion:
		var dt flatbuf.Union
		dt.Init(data.Bytes, data.Pos)
		var (
			mode    arrow.UnionMode
			typeIDs []arrow.UnionTypeCode
		)

		switch dt.Mode() {
		case flatbuf.UnionModeSparse:
			mode = arrow.SparseMode
		case flatbuf.UnionModeDense:
			mode = arrow.DenseMode
		}

		typeIDLen := dt.TypeIdsLength()

		if typeIDLen == 0 {
			for i := range children {
				typeIDs = append(typeIDs, int8(i))
			}
		} else {
			for i := 0; i < typeIDLen; i++ {
				id := dt.TypeIds(i)
				code := arrow.UnionTypeCode(id)
				if int32(code) != id {
					return nil, errors.New("union type id out of bounds")
				}
				typeIDs = append(typeIDs, code)
			}
		}

		return arrow.UnionOf(mode, children, typeIDs), nil

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

	case flatbuf.TypeMap:
		if len(children) != 1 {
			return nil, fmt.Errorf("arrow/ipc: Map must have exactly 1 child field")
		}

		if children[0].Nullable || children[0].Type.ID() != arrow.STRUCT || len(children[0].Type.(*arrow.StructType).Fields()) != 2 {
			return nil, fmt.Errorf("arrow/ipc: Map's key-item pairs must be non-nullable structs")
		}

		pairType := children[0].Type.(*arrow.StructType)
		if pairType.Field(0).Nullable {
			return nil, fmt.Errorf("arrow/ipc: Map's keys must be non-nullable")
		}

		var dt flatbuf.Map
		dt.Init(data.Bytes, data.Pos)
		ret := arrow.MapOf(pairType.Field(0).Type, pairType.Field(1).Type)
		ret.SetItemNullable(pairType.Field(1).Nullable)
		ret.KeysSorted = dt.KeysSorted()
		return ret, nil

	case flatbuf.TypeRunEndEncoded:
		if len(children) != 2 {
			return nil, fmt.Errorf("%w: arrow/ipc: RunEndEncoded must have exactly 2 child fields", arrow.ErrInvalid)
		}
		switch children[0].Type.ID() {
		case arrow.INT16, arrow.INT32, arrow.INT64:
		default:
			return nil, fmt.Errorf("%w: arrow/ipc: run-end encoded run_ends field must be one of int16, int32, or int64 type", arrow.ErrInvalid)
		}
		return arrow.RunEndEncodedOf(children[0].Type, children[1].Type), nil

	default:
		panic(fmt.Errorf("arrow/ipc: type %v not implemented", flatbuf.EnumNamesType[typ]))
	}
}

func intFromFB(data flatbuf.Int) (arrow.DataType, error) {
	bw := data.BitWidth()
	if bw > 64 {
		return nil, fmt.Errorf("arrow/ipc: integers with more than 64 bits not implemented (bits=%d)", bw)
	}
	if bw < 8 {
		return nil, fmt.Errorf("arrow/ipc: integers with less than 8 bits not implemented (bits=%d)", bw)
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
		return nil, fmt.Errorf("arrow/ipc: integers not in cstdint are not implemented")
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
		return nil, fmt.Errorf("arrow/ipc: floating point type with %d precision not implemented", p)
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
		panic(fmt.Errorf("arrow/ipc: invalid floating point precision %d-bits", bw))
	}
}

func decimalFromFB(data flatbuf.Decimal) (arrow.DataType, error) {
	switch data.BitWidth() {
	case 32:
		return &arrow.Decimal32Type{Precision: data.Precision(), Scale: data.Scale()}, nil
	case 64:
		return &arrow.Decimal64Type{Precision: data.Precision(), Scale: data.Scale()}, nil
	case 128:
		return &arrow.Decimal128Type{Precision: data.Precision(), Scale: data.Scale()}, nil
	case 256:
		return &arrow.Decimal256Type{Precision: data.Precision(), Scale: data.Scale()}, nil
	default:
		return nil, fmt.Errorf("arrow/ipc: invalid decimal bitwidth: %d", data.BitWidth())
	}
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
			return nil, fmt.Errorf("arrow/ipc: Time32 type with %v unit not implemented", unit)
		}
	case 64:
		switch unit {
		case arrow.Nanosecond:
			return arrow.FixedWidthTypes.Time64ns, nil
		case arrow.Microsecond:
			return arrow.FixedWidthTypes.Time64us, nil
		default:
			return nil, fmt.Errorf("arrow/ipc: Time64 type with %v unit not implemented", unit)
		}
	default:
		return nil, fmt.Errorf("arrow/ipc: Time type with %d bitwidth not implemented", bw)
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
	return nil, fmt.Errorf("arrow/ipc: Date type with %d unit not implemented", data.Unit())
}

func intervalFromFB(data flatbuf.Interval) (arrow.DataType, error) {
	switch data.Unit() {
	case flatbuf.IntervalUnitYEAR_MONTH:
		return arrow.FixedWidthTypes.MonthInterval, nil
	case flatbuf.IntervalUnitDAY_TIME:
		return arrow.FixedWidthTypes.DayTimeInterval, nil
	case flatbuf.IntervalUnitMONTH_DAY_NANO:
		return arrow.FixedWidthTypes.MonthDayNanoInterval, nil
	}
	return nil, fmt.Errorf("arrow/ipc: Interval type with %d unit not implemented", data.Unit())
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
	return nil, fmt.Errorf("arrow/ipc: Duration type with %d unit not implemented", data.Unit())
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
			return arrow.Metadata{}, fmt.Errorf("arrow/ipc: could not read key-value %d from flatbuffer", i)
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

func schemaFromFB(schema *flatbuf.Schema, memo *dictutils.Memo) (*arrow.Schema, error) {
	var (
		err    error
		fields = make([]arrow.Field, schema.FieldsLength())
		pos    = dictutils.NewFieldPos()
	)

	for i := range fields {
		var field flatbuf.Field
		if !schema.Fields(&field, i) {
			return nil, fmt.Errorf("arrow/ipc: could not read field %d from schema", i)
		}

		fields[i], err = fieldFromFB(&field, pos.Child(int32(i)), memo)
		if err != nil {
			return nil, fmt.Errorf("arrow/ipc: could not convert field %d from flatbuf: %w", i, err)
		}
	}

	md, err := metadataFromFB(schema)
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not convert schema metadata from flatbuf: %w", err)
	}

	return arrow.NewSchemaWithEndian(fields, &md, endian.Endianness(schema.Endianness())), nil
}

func schemaToFB(b *flatbuffers.Builder, schema *arrow.Schema, memo *dictutils.Mapper) flatbuffers.UOffsetT {
	fields := make([]flatbuffers.UOffsetT, schema.NumFields())
	pos := dictutils.NewFieldPos()
	for i := 0; i < schema.NumFields(); i++ {
		fields[i] = fieldToFB(b, pos.Child(int32(i)), schema.Field(i), memo)
	}

	flatbuf.SchemaStartFieldsVector(b, len(fields))
	for i := len(fields) - 1; i >= 0; i-- {
		b.PrependUOffsetT(fields[i])
	}
	fieldsFB := b.EndVector(len(fields))

	metaFB := metadataToFB(b, schema.Metadata(), flatbuf.SchemaStartCustomMetadataVector)

	flatbuf.SchemaStart(b)
	flatbuf.SchemaAddEndianness(b, flatbuf.Endianness(schema.Endianness()))
	flatbuf.SchemaAddFields(b, fieldsFB)
	flatbuf.SchemaAddCustomMetadata(b, metaFB)
	offset := flatbuf.SchemaEnd(b)

	return offset
}

// payloadFromSchema returns a slice of payloads corresponding to the given schema.
// Callers of payloadFromSchema will need to call Release after use.
func payloadFromSchema(schema *arrow.Schema, mem memory.Allocator, memo *dictutils.Mapper) payloads {
	ps := make(payloads, 1)
	ps[0].msg = MessageSchema
	ps[0].meta = writeSchemaMessage(schema, mem, memo)

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
	flatbuf.MessageAddVersion(b, flatbuf.MetadataVersion(currentMetadataVersion))
	flatbuf.MessageAddHeaderType(b, hdrType)
	flatbuf.MessageAddHeader(b, hdr)
	flatbuf.MessageAddBodyLength(b, bodyLen)
	msg := flatbuf.MessageEnd(b)
	b.Finish(msg)

	return writeFBBuilder(b, mem)
}

func writeSchemaMessage(schema *arrow.Schema, mem memory.Allocator, dict *dictutils.Mapper) *memory.Buffer {
	b := flatbuffers.NewBuilder(1024)
	schemaFB := schemaToFB(b, schema, dict)
	return writeMessageFB(b, mem, flatbuf.MessageHeaderSchema, schemaFB, 0)
}

func writeFileFooter(schema *arrow.Schema, dicts, recs []dataBlock, w io.Writer) error {
	var (
		b    = flatbuffers.NewBuilder(1024)
		memo dictutils.Mapper
	)
	memo.ImportSchema(schema)

	schemaFB := schemaToFB(b, schema, &memo)
	dictsFB := fileBlocksToFB(b, dicts, flatbuf.FooterStartDictionariesVector)
	recsFB := fileBlocksToFB(b, recs, flatbuf.FooterStartRecordBatchesVector)

	flatbuf.FooterStart(b)
	flatbuf.FooterAddVersion(b, flatbuf.MetadataVersion(currentMetadataVersion))
	flatbuf.FooterAddSchema(b, schemaFB)
	flatbuf.FooterAddDictionaries(b, dictsFB)
	flatbuf.FooterAddRecordBatches(b, recsFB)
	footer := flatbuf.FooterEnd(b)

	b.Finish(footer)

	_, err := w.Write(b.FinishedBytes())
	return err
}

func writeRecordMessage(mem memory.Allocator, size, bodyLength int64, fields []fieldMetadata, meta []bufferMetadata, codec flatbuf.CompressionType, variadicCounts []int64) *memory.Buffer {
	b := flatbuffers.NewBuilder(0)
	recFB := recordToFB(b, size, bodyLength, fields, meta, codec, variadicCounts)
	return writeMessageFB(b, mem, flatbuf.MessageHeaderRecordBatch, recFB, bodyLength)
}

func writeDictionaryMessage(mem memory.Allocator, id int64, isDelta bool, size, bodyLength int64, fields []fieldMetadata, meta []bufferMetadata, codec flatbuf.CompressionType, variadicCounts []int64) *memory.Buffer {
	b := flatbuffers.NewBuilder(0)
	recFB := recordToFB(b, size, bodyLength, fields, meta, codec, variadicCounts)

	flatbuf.DictionaryBatchStart(b)
	flatbuf.DictionaryBatchAddId(b, id)
	flatbuf.DictionaryBatchAddData(b, recFB)
	flatbuf.DictionaryBatchAddIsDelta(b, isDelta)
	dictFB := flatbuf.DictionaryBatchEnd(b)
	return writeMessageFB(b, mem, flatbuf.MessageHeaderDictionaryBatch, dictFB, bodyLength)
}

func recordToFB(b *flatbuffers.Builder, size, bodyLength int64, fields []fieldMetadata, meta []bufferMetadata, codec flatbuf.CompressionType, variadicCounts []int64) flatbuffers.UOffsetT {
	fieldsFB := writeFieldNodes(b, fields, flatbuf.RecordBatchStartNodesVector)
	metaFB := writeBuffers(b, meta, flatbuf.RecordBatchStartBuffersVector)
	var bodyCompressFB flatbuffers.UOffsetT
	if codec != -1 {
		bodyCompressFB = writeBodyCompression(b, codec)
	}

	var vcFB *flatbuffers.UOffsetT
	if len(variadicCounts) > 0 {
		flatbuf.RecordBatchStartVariadicBufferCountsVector(b, len(variadicCounts))
		for i := len(variadicCounts) - 1; i >= 0; i-- {
			b.PrependInt64(variadicCounts[i])
		}
		vcFBVal := b.EndVector(len(variadicCounts))
		vcFB = &vcFBVal
	}

	flatbuf.RecordBatchStart(b)
	flatbuf.RecordBatchAddLength(b, size)
	flatbuf.RecordBatchAddNodes(b, fieldsFB)
	flatbuf.RecordBatchAddBuffers(b, metaFB)
	if vcFB != nil {
		flatbuf.RecordBatchAddVariadicBufferCounts(b, *vcFB)
	}

	if codec != -1 {
		flatbuf.RecordBatchAddCompression(b, bodyCompressFB)
	}

	return flatbuf.RecordBatchEnd(b)
}

func writeFieldNodes(b *flatbuffers.Builder, fields []fieldMetadata, start startVecFunc) flatbuffers.UOffsetT {

	start(b, len(fields))
	for i := len(fields) - 1; i >= 0; i-- {
		field := fields[i]
		if field.Offset != 0 {
			panic(fmt.Errorf("arrow/ipc: field metadata for IPC must have offset 0"))
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

func writeBodyCompression(b *flatbuffers.Builder, codec flatbuf.CompressionType) flatbuffers.UOffsetT {
	flatbuf.BodyCompressionStart(b)
	flatbuf.BodyCompressionAddCodec(b, codec)
	flatbuf.BodyCompressionAddMethod(b, flatbuf.BodyCompressionMethodBUFFER)
	return flatbuf.BodyCompressionEnd(b)
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
		return 0, fmt.Errorf("arrow/ipc: could not write continuation bit indicator: %w", err)
	}

	// the returned message size includes the length prefix, the flatbuffer, + padding
	n = int(paddedMsgLen)

	// write the flatbuffer size prefix, including padding
	sizeFB := paddedMsgLen - 8
	binary.LittleEndian.PutUint32(tmp, uint32(sizeFB))
	_, err = w.Write(tmp)
	if err != nil {
		return n, fmt.Errorf("arrow/ipc: could not write message flatbuffer size prefix: %w", err)
	}

	// write the flatbuffer
	_, err = w.Write(msg.Bytes())
	if err != nil {
		return n, fmt.Errorf("arrow/ipc: could not write message flatbuffer: %w", err)
	}

	// write any padding
	padding := paddedMsgLen - int32(msg.Len()) - 8
	if padding > 0 {
		_, err = w.Write(paddingBytes[:padding])
		if err != nil {
			return n, fmt.Errorf("arrow/ipc: could not write message padding bytes: %w", err)
		}
	}

	return n, err
}
