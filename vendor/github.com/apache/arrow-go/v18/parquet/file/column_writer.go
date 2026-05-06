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

package file

import (
	"bytes"
	"encoding/binary"
	"io"
	"strconv"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

//go:generate go run ../../arrow/_tools/tmpl/main.go -i -data=../internal/encoding/physical_types.tmpldata column_writer_types.gen.go.tmpl

// ColumnChunkWriter is the base interface for all columnwriters. To directly write
// data to the column, you need to assert it to the correctly typed ColumnChunkWriter
// instance, such as Int32ColumnWriter.
type ColumnChunkWriter interface {
	// Close ends this column and returns the number of bytes written
	Close() error
	// Type returns the underlying physical parquet type for this column
	Type() parquet.Type
	// Descr returns the column information for this writer
	Descr() *schema.Column
	// RowsWritten returns the number of rows that have so far been written with this writer
	RowsWritten() int
	// TotalCompressedBytes returns the number of bytes, after compression, that have been written so far
	TotalCompressedBytes() int64
	// TotalBytesWritten includes the bytes for writing dictionary pages, while TotalCompressedBytes is
	// just the data and page headers
	TotalBytesWritten() int64
	// Properties returns the current WriterProperties in use for this writer
	Properties() *parquet.WriterProperties
	// CurrentEncoder returns the current encoder that is being used
	// to encode new data written to this column
	CurrentEncoder() encoding.TypedEncoder
	// FallbackToPlain forces a dictionary encoded column writer to
	// fallback to plain encoding, first flushing out any data it has
	// and then changing the encoder to use plain encoding from
	// here on out.
	//
	// This is automatically called if the dictionary reaches the
	// limit in the write properties or under specific conditions.
	//
	// Has no effect if the column is not currently dictionary encoded.
	FallbackToPlain()
	// PageStatistics returns the current page statistics for this
	// column writer. May be nil if stats are not enabled.
	PageStatistics() metadata.TypedStatistics
	// WriteDictIndices writes an arrow array of dictionary indices
	// to this column. This should only be called by pqarrow or
	// if you *really* know what you're doing.
	WriteDictIndices(arrow.Array, []int16, []int16) error

	LevelInfo() LevelInfo
	SetBitsBuffer(*memory.Buffer)
	HasBitsBuffer() bool

	GetBloomFilter() metadata.BloomFilterBuilder
}

func computeLevelInfo(descr *schema.Column) (info LevelInfo) {
	info.DefLevel = descr.MaxDefinitionLevel()
	info.RepLevel = descr.MaxRepetitionLevel()

	minSpacedDefLevel := descr.MaxDefinitionLevel()
	n := descr.SchemaNode()
	for n != nil && n.RepetitionType() != parquet.Repetitions.Repeated {
		if n.RepetitionType() == parquet.Repetitions.Optional {
			minSpacedDefLevel--
		}
		n = n.Parent()
	}
	info.RepeatedAncestorDefLevel = minSpacedDefLevel
	return
}

type columnWriter struct {
	metaData *metadata.ColumnChunkMetaDataBuilder
	descr    *schema.Column

	// scratch buffer if validity bits need to be recalculated
	bitsBuffer *memory.Buffer
	levelInfo  LevelInfo
	pager      PageWriter
	hasDict    bool
	encoding   parquet.Encoding
	props      *parquet.WriterProperties
	defEncoder encoding.LevelEncoder
	repEncoder encoding.LevelEncoder
	mem        memory.Allocator

	pageStatistics  metadata.TypedStatistics
	chunkStatistics metadata.TypedStatistics
	bloomFilter     metadata.BloomFilterBuilder

	// total number of values stored in the current data page. this is the maximum
	// of the number of encoded def levels or encoded values. for
	// non-repeated, required columns, this is equal to the number of encoded
	// values. For repeated or optional values, there may be fewer data values
	// than levels, and this tells you how many encoded levels there are in that case
	numBufferedValues int64

	// total number of rows stored in the current data page. This may be larger
	// than numBufferedValues when writing a column with repeated values. This is
	// the number of rows written since the last time we flushed a page.
	numBufferedRows int

	// the total number of stored values in the current page. for repeated or optional
	// values. this number may be lower than numBuffered
	numDataValues int64

	rowsWritten       int
	totalBytesWritten int64
	// records the current number of compressed bytes in a column
	totalCompressedBytes int64
	closed               bool
	fallbackToNonDict    bool

	pages []DataPage

	defLevelSink *encoding.PooledBufferWriter
	repLevelSink *encoding.PooledBufferWriter

	uncompressedData bytes.Buffer
	compressedTemp   *bytes.Buffer

	currentEncoder encoding.TypedEncoder
}

func newColumnWriterBase(metaData *metadata.ColumnChunkMetaDataBuilder, pager PageWriter, useDict bool, enc parquet.Encoding, props *parquet.WriterProperties) columnWriter {
	ret := columnWriter{
		metaData:     metaData,
		descr:        metaData.Descr(),
		levelInfo:    computeLevelInfo(metaData.Descr()),
		pager:        pager,
		hasDict:      useDict,
		encoding:     enc,
		props:        props,
		mem:          props.Allocator(),
		defLevelSink: encoding.NewPooledBufferWriter(0),
		repLevelSink: encoding.NewPooledBufferWriter(0),
	}
	if pager.HasCompressor() {
		ret.compressedTemp = new(bytes.Buffer)
	}
	if props.StatisticsEnabledFor(ret.descr.Path()) && ret.descr.SortOrder() != schema.SortUNKNOWN {
		ret.pageStatistics = metadata.NewStatistics(ret.descr, props.Allocator())
		ret.chunkStatistics = metadata.NewStatistics(ret.descr, props.Allocator())
	}

	ret.defEncoder.Init(parquet.Encodings.RLE, ret.descr.MaxDefinitionLevel(), ret.defLevelSink)
	ret.repEncoder.Init(parquet.Encodings.RLE, ret.descr.MaxRepetitionLevel(), ret.repLevelSink)

	ret.reset()

	ret.initBloomFilter()
	return ret
}

func (w *columnWriter) CurrentEncoder() encoding.TypedEncoder    { return w.currentEncoder }
func (w *columnWriter) HasBitsBuffer() bool                      { return w.bitsBuffer != nil }
func (w *columnWriter) SetBitsBuffer(buf *memory.Buffer)         { w.bitsBuffer = buf }
func (w *columnWriter) PageStatistics() metadata.TypedStatistics { return w.pageStatistics }
func (w *columnWriter) LevelInfo() LevelInfo                     { return w.levelInfo }

func (w *columnWriter) Type() parquet.Type {
	return w.descr.PhysicalType()
}

func (w *columnWriter) Descr() *schema.Column {
	return w.descr
}

func (w *columnWriter) Properties() *parquet.WriterProperties {
	return w.props
}

func (w *columnWriter) TotalCompressedBytes() int64 {
	return w.totalCompressedBytes
}

func (w *columnWriter) TotalBytesWritten() int64 {
	bufferedPagesBytes := int64(0)
	for _, p := range w.pages {
		bufferedPagesBytes += int64(len(p.Data()))
	}

	return w.totalBytesWritten + bufferedPagesBytes
}

func (w *columnWriter) RowsWritten() int {
	return w.rowsWritten + w.numBufferedRows
}

func (w *columnWriter) WriteDataPage(page DataPage) error {
	written, err := w.pager.WriteDataPage(page)
	w.totalBytesWritten += written
	return err
}

func (w *columnWriter) WriteDefinitionLevels(levels []int16) {
	w.defEncoder.EncodeNoFlush(levels)
}

func (w *columnWriter) WriteRepetitionLevels(levels []int16) {
	w.repEncoder.EncodeNoFlush(levels)
}

func (w *columnWriter) reset() {
	w.defLevelSink.Reset(0)
	w.repLevelSink.Reset(0)

	if w.props.DataPageVersion() == parquet.DataPageV1 {
		// offset the buffers to make room to record the number of levels at the
		// beginning of each after we've encoded them with RLE
		if w.descr.MaxDefinitionLevel() > 0 {
			w.defLevelSink.SetOffset(arrow.Uint32SizeBytes)
		}
		if w.descr.MaxRepetitionLevel() > 0 {
			w.repLevelSink.SetOffset(arrow.Uint32SizeBytes)
		}
	}

	w.defEncoder.Reset(w.descr.MaxDefinitionLevel())
	w.repEncoder.Reset(w.descr.MaxRepetitionLevel())
}

func (w *columnWriter) concatBuffers(defLevelsSize, repLevelsSize int32, values []byte, wr io.Writer) {
	wr.Write(w.repLevelSink.Bytes()[:repLevelsSize])
	wr.Write(w.defLevelSink.Bytes()[:defLevelsSize])
	wr.Write(values)
}

func (w *columnWriter) EstimatedBufferedValueBytes() int64 {
	return w.currentEncoder.EstimatedDataEncodedSize()
}

func (w *columnWriter) commitWriteAndCheckPageLimit(numLevels, numValues int64) error {
	w.numBufferedValues += numLevels
	w.numDataValues += numValues

	enc := w.currentEncoder.EstimatedDataEncodedSize()
	if enc >= w.props.DataPageSize() {
		return w.FlushCurrentPage()
	}
	return nil
}

func (w *columnWriter) FlushCurrentPage() error {
	var (
		defLevelsRLESize int32 = 0
		repLevelsRLESize int32 = 0
	)

	values, err := w.currentEncoder.FlushValues()
	if err != nil {
		return err
	}
	defer values.Release()

	isV1DataPage := w.props.DataPageVersion() == parquet.DataPageV1
	if w.descr.MaxDefinitionLevel() > 0 {
		w.defEncoder.Flush()
		w.defLevelSink.SetOffset(0)
		sz := w.defEncoder.Len()
		if isV1DataPage {
			sz += arrow.Uint32SizeBytes
			binary.LittleEndian.PutUint32(w.defLevelSink.Bytes(), uint32(w.defEncoder.Len()))
		}
		defLevelsRLESize = int32(sz)
	}

	if w.descr.MaxRepetitionLevel() > 0 {
		w.repEncoder.Flush()
		w.repLevelSink.SetOffset(0)
		if isV1DataPage {
			binary.LittleEndian.PutUint32(w.repLevelSink.Bytes(), uint32(w.repEncoder.Len()))
		}
		repLevelsRLESize = int32(w.repLevelSink.Len())
	}

	uncompressed := defLevelsRLESize + repLevelsRLESize + int32(values.Len())
	if isV1DataPage {
		err = w.buildDataPageV1(defLevelsRLESize, repLevelsRLESize, uncompressed, values.Bytes())
	} else {
		err = w.buildDataPageV2(defLevelsRLESize, repLevelsRLESize, uncompressed, values.Bytes())
	}

	w.reset()
	w.rowsWritten += w.numBufferedRows
	w.numBufferedValues, w.numDataValues, w.numBufferedRows = 0, 0, 0
	return err
}

func (w *columnWriter) buildDataPageV1(defLevelsRLESize, repLevelsRLESize, uncompressed int32, values []byte) error {
	w.uncompressedData.Reset()
	w.uncompressedData.Grow(int(uncompressed))
	w.concatBuffers(defLevelsRLESize, repLevelsRLESize, values, &w.uncompressedData)

	pageStats, err := w.getPageStatistics()
	if err != nil {
		return err
	}
	pageStats.ApplyStatSizeLimits(int(w.props.MaxStatsSizeFor(w.descr.Path())))
	pageStats.Signed = schema.SortSIGNED == w.descr.SortOrder()
	w.resetPageStatistics()

	var data []byte
	if w.pager.HasCompressor() {
		w.compressedTemp.Reset()
		data = w.pager.Compress(w.compressedTemp, w.uncompressedData.Bytes())
	} else {
		data = w.uncompressedData.Bytes()
	}

	firstRowIndex := int64(w.rowsWritten)

	// write the page to sink eagerly if there's no dictionary or if dictionary encoding has fallen back
	if w.hasDict && !w.fallbackToNonDict {
		pageSlice := make([]byte, len(data))
		copy(pageSlice, data)
		page := NewDataPageV1WithConfig(memory.NewBufferBytes(pageSlice), parquet.Encodings.RLE, parquet.Encodings.RLE, DataPageConfig{
			Num:              int32(w.numBufferedValues),
			Encoding:         w.encoding,
			UncompressedSize: uncompressed,
			Stats:            pageStats,
			FirstRowIndex:    firstRowIndex,
		})
		w.totalCompressedBytes += int64(page.buf.Len()) // + size of Pageheader
		w.pages = append(w.pages, page)
	} else {
		w.totalCompressedBytes += int64(len(data))
		dp := NewDataPageV1WithConfig(memory.NewBufferBytes(data), parquet.Encodings.RLE, parquet.Encodings.RLE, DataPageConfig{
			Num:              int32(w.numBufferedValues),
			Encoding:         w.encoding,
			UncompressedSize: uncompressed,
			Stats:            pageStats,
			FirstRowIndex:    firstRowIndex,
		})
		defer dp.Release()
		return w.WriteDataPage(dp)
	}
	return nil
}

func (w *columnWriter) buildDataPageV2(defLevelsRLESize, repLevelsRLESize, uncompressed int32, values []byte) error {
	var data []byte
	if w.pager.HasCompressor() {
		w.compressedTemp.Reset()
		data = w.pager.Compress(w.compressedTemp, values)
	} else {
		data = values
	}

	// concatenate uncompressed levels and the possibly compressed values
	var combined bytes.Buffer
	combined.Grow(int(defLevelsRLESize + repLevelsRLESize + int32(len(data))))
	w.concatBuffers(defLevelsRLESize, repLevelsRLESize, data, &combined)

	pageStats, err := w.getPageStatistics()
	if err != nil {
		return err
	}
	pageStats.ApplyStatSizeLimits(int(w.props.MaxStatsSizeFor(w.descr.Path())))
	pageStats.Signed = schema.SortSIGNED == w.descr.SortOrder()
	w.resetPageStatistics()

	numValues := int32(w.numBufferedValues)
	numRows := int32(w.numBufferedRows)
	nullCount := int32(pageStats.NullCount)
	defLevelsByteLen := int32(defLevelsRLESize)
	repLevelsByteLen := int32(repLevelsRLESize)
	firstRowIndex := int64(w.rowsWritten)

	page := NewDataPageV2WithConfig(memory.NewBufferBytes(combined.Bytes()), nullCount, numRows, defLevelsByteLen, repLevelsByteLen,
		w.pager.HasCompressor(), DataPageConfig{
			Num:              numValues,
			Encoding:         w.encoding,
			UncompressedSize: uncompressed,
			Stats:            pageStats,
			FirstRowIndex:    firstRowIndex,
		})
	if w.hasDict && !w.fallbackToNonDict {
		w.totalCompressedBytes += int64(page.buf.Len()) // + sizeof pageheader
		w.pages = append(w.pages, page)
	} else {
		w.totalCompressedBytes += int64(combined.Len())
		defer page.Release()
		return w.WriteDataPage(page)
	}
	return nil
}

func (w *columnWriter) FlushBufferedDataPages() (err error) {
	if w.numBufferedValues > 0 {
		if err = w.FlushCurrentPage(); err != nil {
			return err
		}
	}

	for i, p := range w.pages {
		defer p.Release()
		if err = w.WriteDataPage(p); err != nil {
			// To keep pages in consistent state,
			// remove the pages that will be released using above defer call.
			w.pages = w.pages[i+1:]
			return err
		}
	}
	w.pages = w.pages[:0]
	return
}

func (w *columnWriter) writeLevels(numValues int64, defLevels, repLevels []int16) int64 {
	toWrite := int64(0)
	maxDefLevel := w.descr.MaxDefinitionLevel()

	// if the field is required and non-repeated, no definition levels
	if defLevels != nil && maxDefLevel > 0 {
		for _, v := range defLevels[:numValues] {
			debug.Assert(v <= maxDefLevel, "columnwriter: invalid definition level "+
				strconv.Itoa(int(v))+" for column "+w.descr.Path())
			if v == maxDefLevel {
				toWrite++
			}
		}
		w.WriteDefinitionLevels(defLevels[:numValues])
	} else {
		toWrite = numValues
	}

	if repLevels != nil && w.descr.MaxRepetitionLevel() > 0 {
		// a row could include more than one value
		//count the occasions where we start a new row
		for _, v := range repLevels[:numValues] {
			if v == 0 {
				w.numBufferedRows++
			}
		}

		w.WriteRepetitionLevels(repLevels[:numValues])
	} else {
		// each value is exactly 1 row
		w.numBufferedRows += int(numValues)
	}
	return toWrite
}

func (w *columnWriter) writeLevelsSpaced(numLevels int64, defLevels, repLevels []int16) {
	if w.descr.MaxDefinitionLevel() > 0 {
		w.WriteDefinitionLevels(defLevels[:numLevels])
	}

	if w.descr.MaxRepetitionLevel() > 0 {
		for _, v := range repLevels {
			if v == 0 {
				w.numBufferedRows++
			}
		}
		w.WriteRepetitionLevels(repLevels[:numLevels])
	} else {
		w.numBufferedRows += int(numLevels)
	}
}

func (w *columnWriter) WriteDictionaryPage() error {
	dictEncoder := w.currentEncoder.(encoding.DictEncoder)
	buffer := memory.NewResizableBuffer(w.mem)
	buffer.Resize(dictEncoder.DictEncodedSize())
	dictEncoder.WriteDict(buffer.Bytes())
	defer buffer.Release()

	page := NewDictionaryPage(buffer, int32(dictEncoder.NumEntries()), w.props.DictionaryPageEncoding())
	written, err := w.pager.WriteDictionaryPage(page)
	w.totalBytesWritten += written
	return err
}

type batchWriteInfo struct {
	batchNum  int64
	nullCount int64
}

func (b batchWriteInfo) numSpaced() int64 { return b.batchNum + b.nullCount }

// this will always update the three output params
// outValsToWrite, outSpacedValsToWrite, and NullCount. Additionally
// it will update the validity bitmap if required (i.e. if at least one
// level of nullable structs directly precede the leaf node)
func (w *columnWriter) maybeCalculateValidityBits(defLevels []int16, batchSize int64) (out batchWriteInfo) {
	if w.bitsBuffer == nil {
		if w.levelInfo.DefLevel == 0 {
			// in this case def levels should be null and we only
			// need to output counts which will always be equal to
			// the batch size passed in (max def level == 0 indicates
			// there cannot be repeated or null fields)
			out.batchNum = batchSize
			out.nullCount = 0
		} else {
			var (
				toWrite       int64
				spacedToWrite int64
			)
			for i := int64(0); i < batchSize; i++ {
				if defLevels[i] == w.levelInfo.DefLevel {
					toWrite++
				}
				if defLevels[i] >= w.levelInfo.RepeatedAncestorDefLevel {
					spacedToWrite++
				}
			}
			out.batchNum += toWrite
			out.nullCount = spacedToWrite - toWrite
		}
		return
	}

	// shrink to fit possible causes another allocation
	newBitmapSize := bitutil.BytesForBits(batchSize)
	if newBitmapSize != int64(w.bitsBuffer.Len()) {
		w.bitsBuffer.ResizeNoShrink(int(newBitmapSize))
	}

	io := ValidityBitmapInputOutput{
		ValidBits:      w.bitsBuffer.Bytes(),
		ReadUpperBound: batchSize,
	}
	DefLevelsToBitmap(defLevels[:batchSize], w.levelInfo, &io)
	out.batchNum = io.Read - io.NullCount
	out.nullCount = io.NullCount
	return
}

func (w *columnWriter) getPageStatistics() (enc metadata.EncodedStatistics, err error) {
	if w.pageStatistics != nil {
		enc, err = w.pageStatistics.Encode()
	}
	return
}

func (w *columnWriter) getChunkStatistics() (enc metadata.EncodedStatistics, err error) {
	if w.chunkStatistics != nil {
		enc, err = w.chunkStatistics.Encode()
	}
	return
}

func (w *columnWriter) resetPageStatistics() {
	if w.chunkStatistics != nil {
		w.chunkStatistics.Merge(w.pageStatistics)
		w.pageStatistics.Reset()
	}
}

func (w *columnWriter) Close() (err error) {
	if !w.closed {
		w.closed = true
		if w.hasDict && !w.fallbackToNonDict {
			if err = w.WriteDictionaryPage(); err != nil {
				return err
			}
		}

		if err = w.FlushBufferedDataPages(); err != nil {
			return err
		}

		// ensure we release and reset everything even if we
		// error out from the chunk statistics handling
		defer func() {
			w.defLevelSink.Reset(0)
			w.repLevelSink.Reset(0)
			if w.bitsBuffer != nil {
				w.bitsBuffer.Release()
				w.bitsBuffer = nil
			}

			w.currentEncoder.Release()
			w.currentEncoder = nil
		}()

		var chunkStats metadata.EncodedStatistics
		chunkStats, err = w.getChunkStatistics()
		if err != nil {
			return err
		}

		chunkStats.ApplyStatSizeLimits(int(w.props.MaxStatsSizeFor(w.descr.Path())))
		chunkStats.Signed = schema.SortSIGNED == w.descr.SortOrder()

		if w.rowsWritten > 0 && chunkStats.IsSet() {
			w.metaData.SetStats(chunkStats)
		}
		err = w.pager.Close(w.hasDict, w.fallbackToNonDict)
	}
	return err
}

func (w *columnWriter) doBatches(total int64, repLevels []int16, action func(offset, batch int64)) {
	batchSize := w.props.WriteBatchSize()
	// if we're writing V1 data pages, have no replevels or the max replevel is 0 then just
	// use the regular doBatches function
	if w.props.DataPageVersion() == parquet.DataPageV1 || repLevels == nil || w.descr.MaxRepetitionLevel() == 0 {
		doBatches(total, batchSize, action)
		return
	}

	// if we get here that means we have repetition levels to write and we're writing
	// V2 data pages. since we check whether to flush after each batch we write
	// if we ensure all the batches begin and end on row boundaries we can avoid
	// complex logic inside of our flushing or batch writing functions.
	// the WriteBatch function recovers from panics so we can just panic here on a failure
	// and it'll get caught by the WriteBatch functions above it
	if int64(len(repLevels)) < total {
		// if we're writing repLevels there has to be at least enough in the slice
		// to write the total number that we're being asked to write
		panic("columnwriter: not enough repetition levels for batch to write")
	}

	if repLevels[0] != 0 {
		panic("columnwriter: batch writing for V2 data pages must start at a row boundary")
	}

	// loop by batchSize, but make sure we're ending/starting each batch on a row boundary
	var (
		batchStart, batch int64
	)
	for batchStart = 0; batchStart+batchSize < int64(len(repLevels)); batchStart += batch {
		// check one past the last value of the batch for if it's a new row
		// if it's not, shrink the batch and feel back to the beginning of a
		// previous row boundary to end on
		batch = batchSize
		for ; repLevels[batchStart+batch] != 0; batch-- {
		}
		// batchStart <--> batch now begins and ends on a row boundary!
		action(batchStart, batch)
	}
	action(batchStart, int64(len(repLevels))-batchStart)
}

func doBatches(total, batchSize int64, action func(offset, batch int64)) {
	numBatches := total / batchSize
	for i := int64(0); i < numBatches; i++ {
		action(i*batchSize, batchSize)
	}
	if total%batchSize > 0 {
		action(numBatches*batchSize, total%batchSize)
	}
}

func levelSliceOrNil(rep []int16, offset, batch int64) []int16 {
	if rep == nil {
		return nil
	}
	return rep[offset : batch+offset]
}

//lint:ignore U1000 maybeReplaceValidity
func (w *columnWriter) maybeReplaceValidity(values arrow.Array, newNullCount int64) arrow.Array {
	if w.bitsBuffer == nil {
		values.Retain()
		return values
	}

	if len(values.Data().Buffers()) == 0 {
		values.Retain()
		return values
	}

	buffers := make([]*memory.Buffer, len(values.Data().Buffers()))
	copy(buffers, values.Data().Buffers())
	// bitsBuffer should already be the offset slice of the validity bits
	// we want so we don't need to manually slice the validity buffer
	buffers[0] = w.bitsBuffer

	if values.Data().Offset() > 0 {
		data := values.Data()
		elemSize := data.DataType().(arrow.FixedWidthDataType).Bytes()
		start := data.Offset() * elemSize
		end := start + data.Len()*elemSize
		buffers[1] = memory.NewBufferBytes(data.Buffers()[1].Bytes()[start:end])
	}

	data := array.NewData(values.DataType(), values.Len(), buffers, nil, int(newNullCount), 0)
	defer data.Release()
	return array.MakeFromData(data)
}

func (w *columnWriter) initBloomFilter() {
	path := w.descr.Path()
	if !w.props.BloomFilterEnabledFor(path) {
		return
	}

	maxFilterBytes := w.props.MaxBloomFilterBytes()
	ndv := w.props.BloomFilterNDVFor(path)
	fpp := w.props.BloomFilterFPPFor(path)
	// if user specified the column NDV, we can construct the bloom filter for it
	if ndv > 0 {
		w.bloomFilter = metadata.NewBloomFilterFromNDVAndFPP(uint32(ndv), fpp, maxFilterBytes, w.mem)
	} else if w.props.AdaptiveBloomFilterEnabledFor(path) {
		numCandidates := w.props.BloomFilterCandidatesFor(path)
		// construct adaptive bloom filter writer
		w.bloomFilter = metadata.NewAdaptiveBlockSplitBloomFilter(uint32(maxFilterBytes), numCandidates, fpp, w.descr, w.mem)
	} else {
		// construct a bloom filter using the max size
		w.bloomFilter = metadata.NewBloomFilter(uint32(maxFilterBytes), uint32(maxFilterBytes), w.mem)
	}
}

func (w *columnWriter) GetBloomFilter() metadata.BloomFilterBuilder {
	return w.bloomFilter
}
