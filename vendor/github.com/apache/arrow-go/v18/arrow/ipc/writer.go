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
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"sync"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/internal/dictutils"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
)

type streamWriter struct {
	w   io.Writer
	pos int64
}

func (w *streamWriter) Start() error { return nil }
func (w *streamWriter) Close() error {
	_, err := w.Write(kEOS[:])
	return err
}

func (w *streamWriter) WritePayload(p Payload) error {
	_, err := writeIPCPayload(w, p)
	if err != nil {
		return err
	}
	return nil
}

func (w *streamWriter) Write(p []byte) (int, error) {
	n, err := w.w.Write(p)
	w.pos += int64(n)
	return n, err
}

func hasNestedDict(data arrow.ArrayData) bool {
	if data.DataType().ID() == arrow.DICTIONARY {
		return true
	}
	for _, c := range data.Children() {
		if hasNestedDict(c) {
			return true
		}
	}
	return false
}

// Writer is an Arrow stream writer.
type Writer struct {
	w io.Writer

	mem memory.Allocator
	pw  PayloadWriter

	started         bool
	schema          *arrow.Schema
	mapper          dictutils.Mapper
	codec           flatbuf.CompressionType
	compressNP      int
	compressors     []compressor
	minSpaceSavings *float64

	// map of the last written dictionaries by id
	// so we can avoid writing the same dictionary over and over
	lastWrittenDicts map[int64]arrow.Array
	emitDictDeltas   bool
}

// NewWriterWithPayloadWriter constructs a writer with the provided payload writer
// instead of the default stream payload writer. This makes the writer more
// reusable such as by the Arrow Flight writer.
func NewWriterWithPayloadWriter(pw PayloadWriter, opts ...Option) *Writer {
	cfg := newConfig(opts...)
	return &Writer{
		mem:             cfg.alloc,
		pw:              pw,
		schema:          cfg.schema,
		codec:           cfg.codec,
		compressNP:      cfg.compressNP,
		minSpaceSavings: cfg.minSpaceSavings,
		emitDictDeltas:  cfg.emitDictDeltas,
		compressors:     make([]compressor, cfg.compressNP),
	}
}

// NewWriter returns a writer that writes records to the provided output stream.
func NewWriter(w io.Writer, opts ...Option) *Writer {
	cfg := newConfig(opts...)
	return &Writer{
		w:              w,
		mem:            cfg.alloc,
		pw:             &streamWriter{w: w},
		schema:         cfg.schema,
		codec:          cfg.codec,
		emitDictDeltas: cfg.emitDictDeltas,
		compressNP:     cfg.compressNP,
		compressors:    make([]compressor, cfg.compressNP),
	}
}

func (w *Writer) Close() error {
	if !w.started {
		err := w.start()
		if err != nil {
			return err
		}
	}

	if w.pw == nil {
		return nil
	}

	err := w.pw.Close()
	if err != nil {
		return fmt.Errorf("arrow/ipc: could not close payload writer: %w", err)
	}
	w.pw = nil

	for _, d := range w.lastWrittenDicts {
		d.Release()
	}

	return nil
}

func (w *Writer) Write(rec arrow.Record) (err error) {
	defer func() {
		if pErr := recover(); pErr != nil {
			err = utils.FormatRecoveredError("arrow/ipc: unknown error while writing", pErr)
		}
	}()

	incomingSchema := rec.Schema()

	if !w.started {
		if w.schema == nil {
			w.schema = incomingSchema
		}
		err := w.start()
		if err != nil {
			return err
		}
	}

	if incomingSchema == nil || !incomingSchema.Equal(w.schema) {
		return errInconsistentSchema
	}

	const allow64b = true
	var (
		data = Payload{msg: MessageRecordBatch}
		enc  = newRecordEncoder(
			w.mem,
			0,
			kMaxNestingDepth,
			allow64b,
			w.codec,
			w.compressNP,
			w.minSpaceSavings,
			w.compressors,
		)
	)
	defer data.Release()

	err = writeDictionaryPayloads(w.mem, rec, false, w.emitDictDeltas, &w.mapper, w.lastWrittenDicts, w.pw, enc)
	if err != nil {
		return fmt.Errorf("arrow/ipc: failure writing dictionary batches: %w", err)
	}

	enc.reset()
	if err := enc.Encode(&data, rec); err != nil {
		return fmt.Errorf("arrow/ipc: could not encode record to payload: %w", err)
	}

	return w.pw.WritePayload(data)
}

func writeDictionaryPayloads(mem memory.Allocator, batch arrow.Record, isFileFormat bool, emitDictDeltas bool, mapper *dictutils.Mapper, lastWrittenDicts map[int64]arrow.Array, pw PayloadWriter, encoder *recordEncoder) error {
	dictionaries, err := dictutils.CollectDictionaries(batch, mapper)
	if err != nil {
		return err
	}
	defer func() {
		for _, d := range dictionaries {
			d.Dict.Release()
		}
	}()

	eqopt := array.WithNaNsEqual(true)
	for _, pair := range dictionaries {
		encoder.reset()
		var (
			deltaStart int64
			enc        = dictEncoder{encoder}
		)
		lastDict, exists := lastWrittenDicts[pair.ID]
		if exists {
			if lastDict.Data() == pair.Dict.Data() {
				continue
			}
			newLen, lastLen := pair.Dict.Len(), lastDict.Len()
			if lastLen == newLen && array.ApproxEqual(lastDict, pair.Dict, eqopt) {
				// same dictionary by value
				// might cost CPU, but required for IPC file format
				continue
			}
			if isFileFormat {
				return errors.New("arrow/ipc: Dictionary replacement detected when writing IPC file format. Arrow IPC File only supports single dictionary per field")
			}

			if newLen > lastLen &&
				emitDictDeltas &&
				!hasNestedDict(pair.Dict.Data()) &&
				(array.SliceApproxEqual(lastDict, 0, int64(lastLen), pair.Dict, 0, int64(lastLen), eqopt)) {
				deltaStart = int64(lastLen)
			}
		}

		var data = Payload{msg: MessageDictionaryBatch}
		defer data.Release()

		dict := pair.Dict
		if deltaStart > 0 {
			dict = array.NewSlice(dict, deltaStart, int64(dict.Len()))
			defer dict.Release()
		}
		if err := enc.Encode(&data, pair.ID, deltaStart > 0, dict); err != nil {
			return err
		}

		if err := pw.WritePayload(data); err != nil {
			return err
		}

		lastWrittenDicts[pair.ID] = pair.Dict
		if lastDict != nil {
			lastDict.Release()
		}
		pair.Dict.Retain()
	}
	return nil
}

func (w *Writer) start() error {
	w.started = true

	w.mapper.ImportSchema(w.schema)
	w.lastWrittenDicts = make(map[int64]arrow.Array)

	// write out schema payloads
	ps := payloadFromSchema(w.schema, w.mem, &w.mapper)
	defer ps.Release()

	for _, data := range ps {
		err := w.pw.WritePayload(data)
		if err != nil {
			return err
		}
	}

	return nil
}

type dictEncoder struct {
	*recordEncoder
}

func (d *dictEncoder) encodeMetadata(p *Payload, isDelta bool, id, nrows int64) error {
	p.meta = writeDictionaryMessage(d.mem, id, isDelta, nrows, p.size, d.fields, d.meta, d.codec, d.variadicCounts)
	return nil
}

func (d *dictEncoder) Encode(p *Payload, id int64, isDelta bool, dict arrow.Array) error {
	d.start = 0
	defer func() {
		d.start = 0
	}()

	schema := arrow.NewSchema([]arrow.Field{{Name: "dictionary", Type: dict.DataType(), Nullable: true}}, nil)
	batch := array.NewRecord(schema, []arrow.Array{dict}, int64(dict.Len()))
	defer batch.Release()
	if err := d.encode(p, batch); err != nil {
		return err
	}

	return d.encodeMetadata(p, isDelta, id, batch.NumRows())
}

type recordEncoder struct {
	mem memory.Allocator

	fields         []fieldMetadata
	meta           []bufferMetadata
	variadicCounts []int64

	depth           int64
	start           int64
	allow64b        bool
	codec           flatbuf.CompressionType
	compressNP      int
	compressors     []compressor
	minSpaceSavings *float64
}

func newRecordEncoder(
	mem memory.Allocator,
	startOffset,
	maxDepth int64,
	allow64b bool,
	codec flatbuf.CompressionType,
	compressNP int,
	minSpaceSavings *float64,
	compressors []compressor,
) *recordEncoder {
	return &recordEncoder{
		mem:             mem,
		start:           startOffset,
		depth:           maxDepth,
		allow64b:        allow64b,
		codec:           codec,
		compressNP:      compressNP,
		compressors:     compressors,
		minSpaceSavings: minSpaceSavings,
	}
}

func (w *recordEncoder) shouldCompress(uncompressed, compressed int) bool {
	debug.Assert(uncompressed > 0, "uncompressed size is 0")
	if w.minSpaceSavings == nil {
		return true
	}

	savings := 1.0 - float64(compressed)/float64(uncompressed)
	return savings >= *w.minSpaceSavings
}

func (w *recordEncoder) reset() {
	w.start = 0
	w.fields = make([]fieldMetadata, 0)
}

func (w *recordEncoder) getCompressor(id int) compressor {
	if w.compressors[id] == nil {
		w.compressors[id] = getCompressor(w.codec)
	}
	return w.compressors[id]
}

func (w *recordEncoder) compressBodyBuffers(p *Payload) error {
	compress := func(idx int, codec compressor) error {
		if p.body[idx] == nil || p.body[idx].Len() == 0 {
			return nil
		}

		buf := memory.NewResizableBuffer(w.mem)
		buf.Reserve(codec.MaxCompressedLen(p.body[idx].Len()) + arrow.Int64SizeBytes)

		binary.LittleEndian.PutUint64(buf.Buf(), uint64(p.body[idx].Len()))
		bw := &bufferWriter{buf: buf, pos: arrow.Int64SizeBytes}
		codec.Reset(bw)

		n, err := codec.Write(p.body[idx].Bytes())
		if err != nil {
			return err
		}
		if err := codec.Close(); err != nil {
			return err
		}

		finalLen := bw.pos
		compressedLen := bw.pos - arrow.Int64SizeBytes
		if !w.shouldCompress(n, compressedLen) {
			n = copy(buf.Buf()[arrow.Int64SizeBytes:], p.body[idx].Bytes())
			// size of -1 indicates to the reader that the body
			// doesn't need to be decompressed
			var noprefix int64 = -1
			binary.LittleEndian.PutUint64(buf.Buf(), uint64(noprefix))
			finalLen = n + arrow.Int64SizeBytes
		}
		bw.buf.Resize(finalLen)
		p.body[idx].Release()
		p.body[idx] = buf
		return nil
	}

	if w.compressNP <= 1 {
		codec := w.getCompressor(0)
		for idx := range p.body {
			if err := compress(idx, codec); err != nil {
				return err
			}
		}
		return nil
	}

	var (
		wg          sync.WaitGroup
		ch          = make(chan int)
		errch       = make(chan error)
		ctx, cancel = context.WithCancel(context.Background())
	)
	defer cancel()

	for workerID := 0; workerID < w.compressNP; workerID++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			codec := w.getCompressor(id)
			for {
				select {
				case idx, ok := <-ch:
					if !ok {
						// we're done, channel is closed!
						return
					}

					if err := compress(idx, codec); err != nil {
						errch <- err
						cancel()
						return
					}
				case <-ctx.Done():
					// cancelled, return early
					return
				}
			}
		}(workerID)
	}

	for idx := range p.body {
		ch <- idx
	}

	close(ch)
	wg.Wait()
	close(errch)

	return <-errch
}

func (w *recordEncoder) encode(p *Payload, rec arrow.Record) error {
	// perform depth-first traversal of the row-batch
	for i, col := range rec.Columns() {
		err := w.visit(p, col)
		if err != nil {
			return fmt.Errorf("arrow/ipc: could not encode column %d (%q): %w", i, rec.ColumnName(i), err)
		}
	}

	if w.codec != -1 {
		if w.minSpaceSavings != nil {
			pct := *w.minSpaceSavings
			if pct < 0 || pct > 1 {
				p.Release()
				return fmt.Errorf("%w: minSpaceSavings not in range [0,1]. Provided %.05f",
					arrow.ErrInvalid, pct)
			}
		}
		w.compressBodyBuffers(p)
	}

	// position for the start of a buffer relative to the passed frame of reference.
	// may be 0 or some other position in an address space.
	offset := w.start
	w.meta = make([]bufferMetadata, len(p.body))

	// construct the metadata for the record batch header
	for i, buf := range p.body {
		var (
			size    int64
			padding int64
		)
		// the buffer might be null if we are handling zero row lengths.
		if buf != nil {
			size = int64(buf.Len())
			padding = bitutil.CeilByte64(size) - size
		}
		w.meta[i] = bufferMetadata{
			Offset: offset,
			// even though we add padding, we need the Len to be correct
			// so that decompressing works properly.
			Len: size,
		}
		offset += size + padding
	}

	p.size = offset - w.start
	if !bitutil.IsMultipleOf8(p.size) {
		panic("not aligned")
	}

	return nil
}

func (w *recordEncoder) visit(p *Payload, arr arrow.Array) error {
	if w.depth <= 0 {
		return errMaxRecursion
	}

	if !w.allow64b && arr.Len() > math.MaxInt32 {
		return errBigArray
	}

	if arr.DataType().ID() == arrow.EXTENSION {
		arr := arr.(array.ExtensionArray)
		err := w.visit(p, arr.Storage())
		if err != nil {
			return fmt.Errorf("failed visiting storage of for array %T: %w", arr, err)
		}
		return nil
	}

	if arr.DataType().ID() == arrow.DICTIONARY {
		arr := arr.(*array.Dictionary)
		return w.visit(p, arr.Indices())
	}

	// add all common elements
	w.fields = append(w.fields, fieldMetadata{
		Len:    int64(arr.Len()),
		Nulls:  int64(arr.NullN()),
		Offset: 0,
	})

	if arr.DataType().ID() == arrow.NULL {
		return nil
	}

	if internal.HasValidityBitmap(arr.DataType().ID(), flatbuf.MetadataVersion(currentMetadataVersion)) {
		switch arr.NullN() {
		case 0:
			// there are no null values, drop the null bitmap
			p.body = append(p.body, nil)
		default:
			data := arr.Data()
			var bitmap *memory.Buffer
			if data.NullN() == data.Len() {
				// every value is null, just use a new zero-initialized bitmap to avoid the expense of copying
				bitmap = memory.NewResizableBuffer(w.mem)
				minLength := paddedLength(bitutil.BytesForBits(int64(data.Len())), kArrowAlignment)
				bitmap.Resize(int(minLength))
			} else {
				// otherwise truncate and copy the bits
				bitmap = newTruncatedBitmap(w.mem, int64(data.Offset()), int64(data.Len()), data.Buffers()[0])
			}
			p.body = append(p.body, bitmap)
		}
	}

	switch dtype := arr.DataType().(type) {
	case *arrow.NullType:
		// ok. NullArrays are completely empty.

	case *arrow.BooleanType:
		var (
			data = arr.Data()
			bitm *memory.Buffer
		)

		if data.Len() != 0 {
			bitm = newTruncatedBitmap(w.mem, int64(data.Offset()), int64(data.Len()), data.Buffers()[1])
		}
		p.body = append(p.body, bitm)

	case arrow.FixedWidthDataType:
		data := arr.Data()
		values := data.Buffers()[1]
		arrLen := int64(arr.Len())
		typeWidth := int64(dtype.BitWidth() / 8)
		minLength := paddedLength(arrLen*typeWidth, kArrowAlignment)

		switch {
		case needTruncate(int64(data.Offset()), values, minLength):
			// non-zero offset: slice the buffer
			offset := int64(data.Offset()) * typeWidth
			// send padding if available
			len := min(bitutil.CeilByte64(arrLen*typeWidth), int64(values.Len())-offset)
			values = memory.NewBufferBytes(values.Bytes()[offset : offset+len])
		default:
			if values != nil {
				values.Retain()
			}
		}
		p.body = append(p.body, values)

	case *arrow.BinaryType, *arrow.LargeBinaryType, *arrow.StringType, *arrow.LargeStringType:
		arr := arr.(array.BinaryLike)
		voffsets := w.getZeroBasedValueOffsets(arr)
		data := arr.Data()
		values := data.Buffers()[2]

		var totalDataBytes int64
		if voffsets != nil {
			totalDataBytes = int64(len(arr.ValueBytes()))
		}

		switch {
		case needTruncate(int64(data.Offset()), values, totalDataBytes):
			// slice data buffer to include the range we need now.
			var (
				beg int64 = 0
				len       = min(paddedLength(totalDataBytes, kArrowAlignment), int64(totalDataBytes))
			)
			if arr.Len() > 0 {
				beg = arr.ValueOffset64(0)
			}

			values = memory.NewBufferBytes(data.Buffers()[2].Bytes()[beg : beg+len])
		default:
			if values != nil {
				values.Retain()
			}
		}
		p.body = append(p.body, voffsets)
		p.body = append(p.body, values)

	case arrow.BinaryViewDataType:
		data := arr.Data()
		values := data.Buffers()[1]
		arrLen := int64(arr.Len())
		typeWidth := int64(arrow.ViewHeaderSizeBytes)
		minLength := paddedLength(arrLen*typeWidth, kArrowAlignment)

		switch {
		case needTruncate(int64(data.Offset()), values, minLength):
			// non-zero offset: slice the buffer
			offset := data.Offset() * int(typeWidth)
			// send padding if available
			len := int(min(bitutil.CeilByte64(arrLen*typeWidth), int64(values.Len()-offset)))
			values = memory.SliceBuffer(values, offset, len)
		default:
			if values != nil {
				values.Retain()
			}
		}
		p.body = append(p.body, values)

		w.variadicCounts = append(w.variadicCounts, int64(len(data.Buffers())-2))
		for _, b := range data.Buffers()[2:] {
			b.Retain()
			p.body = append(p.body, b)
		}

	case *arrow.StructType:
		w.depth--
		arr := arr.(*array.Struct)
		for i := 0; i < arr.NumField(); i++ {
			err := w.visit(p, arr.Field(i))
			if err != nil {
				return fmt.Errorf("could not visit field %d of struct-array: %w", i, err)
			}
		}
		w.depth++

	case *arrow.SparseUnionType:
		offset, length := arr.Data().Offset(), arr.Len()
		arr := arr.(*array.SparseUnion)
		typeCodes := getTruncatedBuffer(int64(offset), int64(length), int32(unsafe.Sizeof(arrow.UnionTypeCode(0))), arr.TypeCodes())
		p.body = append(p.body, typeCodes)

		w.depth--
		for i := 0; i < arr.NumFields(); i++ {
			err := w.visit(p, arr.Field(i))
			if err != nil {
				return fmt.Errorf("could not visit field %d of sparse union array: %w", i, err)
			}
		}
		w.depth++
	case *arrow.DenseUnionType:
		offset, length := arr.Data().Offset(), arr.Len()
		arr := arr.(*array.DenseUnion)
		typeCodes := getTruncatedBuffer(int64(offset), int64(length), int32(unsafe.Sizeof(arrow.UnionTypeCode(0))), arr.TypeCodes())
		p.body = append(p.body, typeCodes)

		w.depth--
		dt := arr.UnionType()

		// union type codes are not necessarily 0-indexed
		maxCode := dt.MaxTypeCode()

		// allocate an array of child offsets. Set all to -1 to indicate we
		// haven't observed a first occurrence of a particular child yet
		offsets := make([]int32, maxCode+1)
		lengths := make([]int32, maxCode+1)
		offsets[0], lengths[0] = -1, 0
		for i := 1; i < len(offsets); i *= 2 {
			copy(offsets[i:], offsets[:i])
			copy(lengths[i:], lengths[:i])
		}

		var valueOffsets *memory.Buffer
		if offset != 0 {
			valueOffsets = w.rebaseDenseUnionValueOffsets(arr, offsets, lengths)
		} else {
			valueOffsets = getTruncatedBuffer(int64(offset), int64(length), int32(arrow.Int32SizeBytes), arr.ValueOffsets())
		}
		p.body = append(p.body, valueOffsets)

		// visit children and slice accordingly
		for i := range dt.Fields() {
			child := arr.Field(i)
			// for sliced unions it's tricky to know how much to truncate
			// the children. For now we'll truncate the children to be
			// no longer than the parent union.

			if offset != 0 {
				code := dt.TypeCodes()[i]
				childOffset := offsets[code]
				childLen := lengths[code]

				if childOffset > 0 {
					child = array.NewSlice(child, int64(childOffset), int64(childOffset+childLen))
					defer child.Release()
				} else if childLen < int32(child.Len()) {
					child = array.NewSlice(child, 0, int64(childLen))
					defer child.Release()
				}
			}
			if err := w.visit(p, child); err != nil {
				return fmt.Errorf("could not visit field %d of dense union array: %w", i, err)
			}
		}
		w.depth++
	case *arrow.MapType, *arrow.ListType, *arrow.LargeListType:
		arr := arr.(array.ListLike)
		voffsets := w.getZeroBasedValueOffsets(arr)
		p.body = append(p.body, voffsets)

		w.depth--
		var (
			values        = arr.ListValues()
			mustRelease   = false
			values_offset int64
			values_end    int64
		)
		defer func() {
			if mustRelease {
				values.Release()
			}
		}()

		if arr.Len() > 0 && voffsets != nil {
			values_offset, _ = arr.ValueOffsets(0)
			_, values_end = arr.ValueOffsets(arr.Len() - 1)
		}

		if arr.Len() != 0 || values_end < int64(values.Len()) {
			// must also slice the values
			values = array.NewSlice(values, values_offset, values_end)
			mustRelease = true
		}
		err := w.visit(p, values)

		if err != nil {
			return fmt.Errorf("could not visit list element for array %T: %w", arr, err)
		}
		w.depth++

	case *arrow.ListViewType, *arrow.LargeListViewType:
		arr := arr.(array.VarLenListLike)

		voffsets, minOffset, maxEnd := w.getZeroBasedListViewOffsets(arr)
		vsizes := w.getListViewSizes(arr)

		p.body = append(p.body, voffsets)
		p.body = append(p.body, vsizes)

		w.depth--
		var (
			values = arr.ListValues()
		)

		if minOffset != 0 || maxEnd < int64(values.Len()) {
			values = array.NewSlice(values, minOffset, maxEnd)
			defer values.Release()
		}
		err := w.visit(p, values)

		if err != nil {
			return fmt.Errorf("could not visit list element for array %T: %w", arr, err)
		}
		w.depth++

	case *arrow.FixedSizeListType:
		arr := arr.(*array.FixedSizeList)

		w.depth--

		size := int64(arr.DataType().(*arrow.FixedSizeListType).Len())
		beg := int64(arr.Offset()) * size
		end := int64(arr.Offset()+arr.Len()) * size

		values := array.NewSlice(arr.ListValues(), beg, end)
		defer values.Release()

		err := w.visit(p, values)

		if err != nil {
			return fmt.Errorf("could not visit list element for array %T: %w", arr, err)
		}
		w.depth++

	case *arrow.RunEndEncodedType:
		arr := arr.(*array.RunEndEncoded)
		w.depth--
		child := arr.LogicalRunEndsArray(w.mem)
		defer child.Release()
		if err := w.visit(p, child); err != nil {
			return err
		}
		child = arr.LogicalValuesArray()
		defer child.Release()
		if err := w.visit(p, child); err != nil {
			return err
		}
		w.depth++

	default:
		panic(fmt.Errorf("arrow/ipc: unknown array %T (dtype=%T)", arr, dtype))
	}

	return nil
}

func (w *recordEncoder) getZeroBasedValueOffsets(arr arrow.Array) *memory.Buffer {
	data := arr.Data()
	voffsets := data.Buffers()[1]
	offsetTraits := arr.DataType().(arrow.OffsetsDataType).OffsetTypeTraits()
	offsetBytesNeeded := offsetTraits.BytesRequired(data.Len() + 1)

	if voffsets == nil || voffsets.Len() == 0 {
		return nil
	}

	dataTypeWidth := arr.DataType().Layout().Buffers[1].ByteWidth

	// if we have a non-zero offset, then the value offsets do not start at
	// zero. we must a) create a new offsets array with shifted offsets and
	// b) slice the values array accordingly
	hasNonZeroOffset := data.Offset() != 0

	// or if there are more value offsets than values (the array has been sliced)
	// we need to trim off the trailing offsets
	hasMoreOffsetsThanValues := offsetBytesNeeded < voffsets.Len()

	// or if the offsets do not start from the zero index, we need to shift them
	// and slice the values array
	var firstOffset int64
	if dataTypeWidth == 8 {
		firstOffset = arrow.Int64Traits.CastFromBytes(voffsets.Bytes())[0]
	} else {
		firstOffset = int64(arrow.Int32Traits.CastFromBytes(voffsets.Bytes())[0])
	}
	offsetsDoNotStartFromZero := firstOffset != 0

	// determine whether the offsets array should be shifted
	needsTruncateAndShift := hasNonZeroOffset || hasMoreOffsetsThanValues || offsetsDoNotStartFromZero

	if needsTruncateAndShift {
		shiftedOffsets := memory.NewResizableBuffer(w.mem)
		shiftedOffsets.Resize(offsetBytesNeeded)

		switch dataTypeWidth {
		case 8:
			dest := arrow.Int64Traits.CastFromBytes(shiftedOffsets.Bytes())
			offsets := arrow.Int64Traits.CastFromBytes(voffsets.Bytes())[data.Offset() : data.Offset()+data.Len()+1]

			startOffset := offsets[0]
			for i, o := range offsets {
				dest[i] = o - startOffset
			}

		default:
			debug.Assert(arr.DataType().Layout().Buffers[1].ByteWidth == 4, "invalid offset bytewidth")
			dest := arrow.Int32Traits.CastFromBytes(shiftedOffsets.Bytes())
			offsets := arrow.Int32Traits.CastFromBytes(voffsets.Bytes())[data.Offset() : data.Offset()+data.Len()+1]

			startOffset := offsets[0]
			for i, o := range offsets {
				dest[i] = o - startOffset
			}
		}

		voffsets = shiftedOffsets
	} else {
		voffsets.Retain()
	}

	return voffsets
}

func getZeroBasedListViewOffsets[OffsetT int32 | int64](mem memory.Allocator, arr array.VarLenListLike) (valueOffsets *memory.Buffer, minOffset, maxEnd OffsetT) {
	requiredBytes := int(unsafe.Sizeof(minOffset)) * arr.Len()
	if arr.Data().Offset() == 0 {
		// slice offsets to used extent, in case we have truncated slice
		minOffset, maxEnd = 0, OffsetT(arr.ListValues().Len())
		valueOffsets = arr.Data().Buffers()[1]
		if valueOffsets.Len() > requiredBytes {
			valueOffsets = memory.SliceBuffer(valueOffsets, 0, requiredBytes)
		} else {
			valueOffsets.Retain()
		}
		return
	}

	// non-zero offset, it's likely that the smallest offset is not zero
	// we must a) create a new offsets array with shifted offsets and
	// b) slice the values array accordingly

	valueOffsets = memory.NewResizableBuffer(mem)
	valueOffsets.Resize(requiredBytes)
	if arr.Len() > 0 {
		// max value of int32/int64 based on type
		minOffset = (^OffsetT(0)) << ((8 * unsafe.Sizeof(minOffset)) - 1)
		for i := 0; i < arr.Len(); i++ {
			start, end := arr.ValueOffsets(i)
			minOffset = utils.Min(minOffset, OffsetT(start))
			maxEnd = utils.Max(maxEnd, OffsetT(end))
		}
	}

	offsets := arrow.GetData[OffsetT](arr.Data().Buffers()[1].Bytes())[arr.Data().Offset():]
	destOffset := arrow.GetData[OffsetT](valueOffsets.Bytes())
	for i := 0; i < arr.Len(); i++ {
		destOffset[i] = offsets[i] - minOffset
	}
	return
}

func getListViewSizes[OffsetT int32 | int64](arr array.VarLenListLike) *memory.Buffer {
	var z OffsetT
	requiredBytes := int(unsafe.Sizeof(z)) * arr.Len()
	sizes := arr.Data().Buffers()[2]

	if arr.Data().Offset() != 0 || sizes.Len() > requiredBytes {
		// slice offsets to used extent, in case we have truncated slice
		offsetBytes := arr.Data().Offset() * int(unsafe.Sizeof(z))
		sizes = memory.SliceBuffer(sizes, offsetBytes, requiredBytes)
	} else {
		sizes.Retain()
	}
	return sizes
}

func (w *recordEncoder) getZeroBasedListViewOffsets(arr array.VarLenListLike) (*memory.Buffer, int64, int64) {
	if arr.Len() == 0 {
		return nil, 0, 0
	}

	var (
		outOffsets     *memory.Buffer
		minOff, maxEnd int64
	)

	switch v := arr.(type) {
	case *array.ListView:
		voffsets, outOff, outEnd := getZeroBasedListViewOffsets[int32](w.mem, v)
		outOffsets = voffsets
		minOff, maxEnd = int64(outOff), int64(outEnd)
	case *array.LargeListView:
		outOffsets, minOff, maxEnd = getZeroBasedListViewOffsets[int64](w.mem, v)
	}
	return outOffsets, minOff, maxEnd
}

func (w *recordEncoder) getListViewSizes(arr array.VarLenListLike) *memory.Buffer {
	if arr.Len() == 0 {
		return nil
	}

	switch v := arr.(type) {
	case *array.ListView:
		return getListViewSizes[int32](v)
	case *array.LargeListView:
		return getListViewSizes[int64](v)
	}
	return nil
}

func (w *recordEncoder) rebaseDenseUnionValueOffsets(arr *array.DenseUnion, offsets, lengths []int32) *memory.Buffer {
	// this case sucks. Because the offsets are different for each
	// child array, when we have a sliced array, we need to re-base
	// the value offsets for each array! ew.
	unshiftedOffsets := arr.RawValueOffsets()
	codes := arr.RawTypeCodes()

	shiftedOffsetsBuf := memory.NewResizableBuffer(w.mem)
	shiftedOffsetsBuf.Resize(arrow.Int32Traits.BytesRequired(arr.Len()))
	shiftedOffsets := arrow.Int32Traits.CastFromBytes(shiftedOffsetsBuf.Bytes())

	// compute shifted offsets by subtracting child offset
	for i, c := range codes {
		if offsets[c] == -1 {
			// offsets are guaranteed to be increasing according to the spec
			// so the first offset we find for a child is the initial offset
			// and will become the "0" for this child.
			offsets[c] = unshiftedOffsets[i]
			shiftedOffsets[i] = 0
		} else {
			shiftedOffsets[i] = unshiftedOffsets[i] - offsets[c]
		}
		lengths[c] = max(lengths[c], shiftedOffsets[i]+1)
	}
	return shiftedOffsetsBuf
}

func (w *recordEncoder) Encode(p *Payload, rec arrow.Record) error {
	if err := w.encode(p, rec); err != nil {
		return err
	}
	return w.encodeMetadata(p, rec.NumRows())
}

func (w *recordEncoder) encodeMetadata(p *Payload, nrows int64) error {
	p.meta = writeRecordMessage(w.mem, nrows, p.size, w.fields, w.meta, w.codec, w.variadicCounts)
	return nil
}

func newTruncatedBitmap(mem memory.Allocator, offset, length int64, input *memory.Buffer) *memory.Buffer {
	if input == nil {
		return nil
	}

	minLength := paddedLength(bitutil.BytesForBits(length), kArrowAlignment)
	switch {
	case offset != 0 || minLength < int64(input.Len()):
		// with a sliced array / non-zero offset, we must copy the bitmap
		buf := memory.NewResizableBuffer(mem)
		buf.Resize(int(minLength))
		bitutil.CopyBitmap(input.Bytes(), int(offset), int(length), buf.Bytes(), 0)
		return buf
	default:
		input.Retain()
		return input
	}
}

func getTruncatedBuffer(offset, length int64, byteWidth int32, buf *memory.Buffer) *memory.Buffer {
	if buf == nil {
		return buf
	}

	paddedLen := paddedLength(length*int64(byteWidth), kArrowAlignment)
	if offset != 0 || paddedLen < int64(buf.Len()) {
		return memory.SliceBuffer(buf, int(offset*int64(byteWidth)), int(min(paddedLen, int64(buf.Len()))))
	}
	buf.Retain()
	return buf
}

func needTruncate(offset int64, buf *memory.Buffer, minLength int64) bool {
	if buf == nil {
		return false
	}
	return offset != 0 || minLength < int64(buf.Len())
}

// GetRecordBatchPayload produces the ipc payload for a given record batch.
// The resulting payload itself must be released by the caller via the Release
// method after it is no longer needed.
func GetRecordBatchPayload(batch arrow.Record, opts ...Option) (Payload, error) {
	cfg := newConfig(opts...)
	var (
		data = Payload{msg: MessageRecordBatch}
		enc  = newRecordEncoder(
			cfg.alloc,
			0,
			kMaxNestingDepth,
			true,
			cfg.codec,
			cfg.compressNP,
			cfg.minSpaceSavings,
			make([]compressor, cfg.compressNP),
		)
	)

	err := enc.Encode(&data, batch)
	if err != nil {
		return Payload{}, err
	}

	return data, nil
}

// GetSchemaPayload produces the ipc payload for a given schema.
func GetSchemaPayload(schema *arrow.Schema, mem memory.Allocator) Payload {
	var mapper dictutils.Mapper
	mapper.ImportSchema(schema)
	ps := payloadFromSchema(schema, mem, &mapper)
	return ps[0]
}
