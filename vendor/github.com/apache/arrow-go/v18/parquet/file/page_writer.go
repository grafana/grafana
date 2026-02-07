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
	"fmt"
	"math"
	"sync"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/compress"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/thrift"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	libthrift "github.com/apache/thrift/lib/go/thrift"
	"golang.org/x/xerrors"
)

// PageWriter is the interface for both serialized and buffered page writers
type PageWriter interface {
	// Closes the current page, flushing any buffered data pages/dictionary pages
	// based on the input parameters. Subsequent calls have no effect.
	Close(hasDict, fallback bool) error
	// Write the provided datapage out to the underlying writer
	WriteDataPage(page DataPage) (int64, error)
	// Write the provided dictionary page out to the underlying writer
	WriteDictionaryPage(page *DictionaryPage) (int64, error)
	// returns true if there is a configured compressor for the data
	HasCompressor() bool
	// use the configured compressor and writer properties to compress the data in src
	// using the buffer buf. Returns the slice of the compressed bytes which may be
	// the bytes in the provided buffer
	Compress(buf *bytes.Buffer, src []byte) []byte
	// Allow reuse of the pagewriter object by resetting it using these values instead
	// of having to create a new object.
	Reset(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rgOrdinal, columnOrdinal int16, metaEncryptor, dataEncryptor encryption.Encryptor) error

	SetIndexBuilders(metadata.ColumnIndexBuilder, *metadata.OffsetIndexBuilder)
}

type serializedPageWriter struct {
	mem      memory.Allocator
	metaData *metadata.ColumnChunkMetaDataBuilder
	sink     utils.WriterTell

	nvalues           int64
	dictPageOffset    int64
	dataPageOffset    int64
	totalUncompressed int64
	totalCompressed   int64
	pageOrdinal       int16
	rgOrdinal         int16
	columnOrdinal     int16

	compressLevel int
	compressor    compress.Codec
	metaEncryptor encryption.Encryptor
	dataEncryptor encryption.Encryptor
	encryptionBuf bytes.Buffer

	dataPageAAD       []byte
	dataPageHeaderAAD []byte

	dictEncodingStats map[parquet.Encoding]int32
	dataEncodingStats map[parquet.Encoding]int32

	columnIndexBuilder metadata.ColumnIndexBuilder
	offsetIndexBuilder *metadata.OffsetIndexBuilder
	thriftSerializer   *thrift.Serializer
}

func createSerializedPageWriter(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rowGroupOrdinal, columnChunkOrdinal int16, mem memory.Allocator, metaEncryptor, dataEncryptor encryption.Encryptor) (PageWriter, error) {
	var (
		compressor compress.Codec
		err        error
	)
	if codec != compress.Codecs.Uncompressed {
		compressor, err = compress.GetCodec(codec)
		if err != nil {
			return nil, err
		}
	}

	pgwriter := &serializedPageWriter{
		sink:              sink,
		compressor:        compressor,
		compressLevel:     compressionLevel,
		metaData:          metadata,
		rgOrdinal:         rowGroupOrdinal,
		columnOrdinal:     columnChunkOrdinal,
		mem:               mem,
		metaEncryptor:     metaEncryptor,
		dataEncryptor:     dataEncryptor,
		dictEncodingStats: make(map[parquet.Encoding]int32),
		dataEncodingStats: make(map[parquet.Encoding]int32),
		thriftSerializer:  thrift.NewThriftSerializer(),
	}
	if metaEncryptor != nil || dataEncryptor != nil {
		pgwriter.initEncryption()
	}
	return pgwriter, nil
}

// NewPageWriter returns a page writer using either the buffered or serialized implementations
func NewPageWriter(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rowGroupOrdinal, columnChunkOrdinal int16, mem memory.Allocator, buffered bool, metaEncryptor, dataEncryptor encryption.Encryptor) (PageWriter, error) {
	if buffered {
		return newBufferedPageWriter(sink, codec, compressionLevel, metadata, rowGroupOrdinal, columnChunkOrdinal, mem, metaEncryptor, dataEncryptor)
	}
	return createSerializedPageWriter(sink, codec, compressionLevel, metadata, rowGroupOrdinal, columnChunkOrdinal, mem, metaEncryptor, dataEncryptor)
}

func (pw *serializedPageWriter) SetIndexBuilders(colIdxBldr metadata.ColumnIndexBuilder, offsetIdxBldr *metadata.OffsetIndexBuilder) {
	pw.columnIndexBuilder = colIdxBldr
	pw.offsetIndexBuilder = offsetIdxBldr
}

// Reset allows reusing the pagewriter object instead of creating a new one.
func (pw *serializedPageWriter) Reset(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rowGroupOrdinal, columnChunkOrdinal int16, metaEncryptor, dataEncryptor encryption.Encryptor) error {
	var (
		compressor compress.Codec
		err        error
	)
	if codec != compress.Codecs.Uncompressed {
		compressor, err = compress.GetCodec(codec)
		if err != nil {
			return err
		}
	}

	pw.sink = sink
	pw.compressor = compressor
	pw.compressLevel = compressionLevel
	pw.metaData = metadata
	pw.rgOrdinal = rowGroupOrdinal
	pw.columnOrdinal = columnChunkOrdinal
	pw.metaEncryptor = metaEncryptor
	pw.dataEncryptor = dataEncryptor
	pw.dictEncodingStats = make(map[parquet.Encoding]int32)
	pw.dataEncodingStats = make(map[parquet.Encoding]int32)

	pw.nvalues = 0
	pw.dictPageOffset = 0
	pw.dataPageOffset = 0
	pw.totalUncompressed = 0
	pw.totalCompressed = 0
	pw.pageOrdinal = 0

	if metaEncryptor != nil || dataEncryptor != nil {
		pw.initEncryption()
	}

	pw.columnIndexBuilder, pw.offsetIndexBuilder = nil, nil

	return nil
}

func (pw *serializedPageWriter) initEncryption() {
	if pw.dataEncryptor != nil {
		pw.dataPageAAD = []byte(encryption.CreateModuleAad(pw.dataEncryptor.FileAad(), encryption.DataPageModule, pw.rgOrdinal, pw.columnOrdinal, -1))
	}
	if pw.metaEncryptor != nil {
		pw.dataPageHeaderAAD = []byte(encryption.CreateModuleAad(pw.metaEncryptor.FileAad(), encryption.DataPageHeaderModule, pw.rgOrdinal, pw.columnOrdinal, -1))
	}
}

func (pw *serializedPageWriter) updateEncryption(moduleType int8) error {
	switch moduleType {
	case encryption.ColumnMetaModule:
		pw.metaEncryptor.UpdateAad(encryption.CreateModuleAad(pw.metaEncryptor.FileAad(), moduleType, pw.rgOrdinal, pw.columnOrdinal, -1))
	case encryption.DataPageModule:
		encryption.QuickUpdatePageAad(pw.dataPageAAD, pw.pageOrdinal)
		pw.dataEncryptor.UpdateAad(string(pw.dataPageAAD))
	case encryption.DataPageHeaderModule:
		encryption.QuickUpdatePageAad(pw.dataPageHeaderAAD, pw.pageOrdinal)
		pw.metaEncryptor.UpdateAad(string(pw.dataPageHeaderAAD))
	case encryption.DictPageHeaderModule:
		pw.metaEncryptor.UpdateAad(encryption.CreateModuleAad(pw.metaEncryptor.FileAad(), moduleType, pw.rgOrdinal, pw.columnOrdinal, -1))
	case encryption.DictPageModule:
		pw.dataEncryptor.UpdateAad(encryption.CreateModuleAad(pw.dataEncryptor.FileAad(), moduleType, pw.rgOrdinal, pw.columnOrdinal, -1))
	default:
		return xerrors.New("unknown module type in updateencryption")
	}
	return nil
}

func (pw *serializedPageWriter) Close(hasDict, fallback bool) error {
	if pw.metaEncryptor != nil {
		pw.updateEncryption(encryption.ColumnMetaModule)
	}

	chunkInfo := metadata.ChunkMetaInfo{
		NumValues:        pw.nvalues,
		DictPageOffset:   pw.dictPageOffset,
		IndexPageOffset:  -1,
		DataPageOffset:   pw.dataPageOffset,
		CompressedSize:   pw.totalCompressed,
		UncompressedSize: pw.totalUncompressed,
	}
	encodingStats := metadata.EncodingStats{
		DictEncodingStats: pw.dictEncodingStats,
		DataEncodingStats: pw.dataEncodingStats,
	}
	pw.FinishPageIndexes(0)
	pw.metaData.Finish(chunkInfo, hasDict, fallback, encodingStats)
	_, err := pw.metaData.WriteTo(pw.sink)
	return err
}

func (pw *serializedPageWriter) Compress(buf *bytes.Buffer, src []byte) []byte {
	maxCompressed := pw.compressor.CompressBound(int64(len(src)))
	buf.Grow(int(maxCompressed))
	return pw.compressor.EncodeLevel(buf.Bytes(), src, pw.compressLevel)
}

var dataPageV1HeaderPool = sync.Pool{
	New: func() interface{} { return format.NewDataPageHeader() },
}

func (pw *serializedPageWriter) setDataPageHeader(pageHdr *format.PageHeader, page *DataPageV1) {
	pageHdr.Type = format.PageType_DATA_PAGE
	hdr := dataPageV1HeaderPool.Get().(*format.DataPageHeader)
	hdr.NumValues = page.nvals
	hdr.Encoding = page.encoding
	hdr.DefinitionLevelEncoding = page.defLvlEncoding
	hdr.RepetitionLevelEncoding = page.repLvlEncoding
	if pw.columnIndexBuilder == nil {
		hdr.Statistics = page.statistics.ToThrift()
	} else {
		hdr.Statistics = nil
	}
	pageHdr.DataPageHeader = hdr
	pageHdr.DataPageHeaderV2 = nil
	pageHdr.DictionaryPageHeader = nil
}

var dataPageV2HeaderPool = sync.Pool{
	New: func() interface{} { return format.NewDataPageHeaderV2() },
}

func (pw *serializedPageWriter) setDataPageV2Header(pageHdr *format.PageHeader, page *DataPageV2) {
	pageHdr.Type = format.PageType_DATA_PAGE_V2
	hdr := dataPageV2HeaderPool.Get().(*format.DataPageHeaderV2)
	hdr.NumValues = page.nvals
	hdr.NumNulls = page.nulls
	hdr.NumRows = page.nrows
	hdr.Encoding = page.encoding
	hdr.DefinitionLevelsByteLength = page.defLvlByteLen
	hdr.RepetitionLevelsByteLength = page.repLvlByteLen
	hdr.IsCompressed = page.compressed
	if pw.columnIndexBuilder == nil {
		hdr.Statistics = page.statistics.ToThrift()
	} else {
		hdr.Statistics = nil
	}
	pageHdr.DataPageHeaderV2 = hdr
	pageHdr.DataPageHeader = nil
	pageHdr.DictionaryPageHeader = nil
}

func (pw *serializedPageWriter) HasCompressor() bool          { return pw.compressor != nil }
func (pw *serializedPageWriter) NumValues() int64             { return pw.nvalues }
func (pw *serializedPageWriter) DictionaryPageOffset() int64  { return pw.dictPageOffset }
func (pw *serializedPageWriter) DataPageoffset() int64        { return pw.dataPageOffset }
func (pw *serializedPageWriter) TotalCompressedSize() int64   { return pw.totalCompressed }
func (pw *serializedPageWriter) TotalUncompressedSize() int64 { return pw.totalUncompressed }

func (pw *serializedPageWriter) WriteDictionaryPage(page *DictionaryPage) (int64, error) {
	uncompressed := len(page.Data())

	var data []byte
	if pw.HasCompressor() {
		var buffer bytes.Buffer
		data = pw.Compress(&buffer, page.Data())
		// data = buffer.Bytes()
	} else {
		data = page.Data()
	}

	dictPageHeader := &format.DictionaryPageHeader{
		NumValues: page.NumValues(),
		Encoding:  page.Encoding(),
		IsSorted:  libthrift.BoolPtr(page.IsSorted()),
	}

	if pw.dataEncryptor != nil {
		pw.updateEncryption(encryption.DictPageModule)
		pw.encryptionBuf.Reset()
		pw.encryptionBuf.Grow(pw.dataEncryptor.CiphertextSizeDelta() + len(data))
		pw.dataEncryptor.Encrypt(&pw.encryptionBuf, data)
		data = pw.encryptionBuf.Bytes()
	}

	pageHdr := pageHeaderPool.Get().(*format.PageHeader)
	defer pageHeaderPool.Put(pageHdr)
	pageHdr.Type = format.PageType_DICTIONARY_PAGE
	pageHdr.UncompressedPageSize = int32(uncompressed)
	pageHdr.CompressedPageSize = int32(len(data))
	pageHdr.DictionaryPageHeader = dictPageHeader
	pageHdr.DataPageHeader = nil
	pageHdr.DataPageHeaderV2 = nil

	startPos := pw.sink.Tell()
	if pw.dictPageOffset == 0 {
		pw.dictPageOffset = int64(startPos)
	}

	if pw.metaEncryptor != nil {
		if err := pw.updateEncryption(encryption.DictPageHeaderModule); err != nil {
			return 0, err
		}
	}
	headerSize, err := pw.thriftSerializer.Serialize(pageHdr, pw.sink, pw.metaEncryptor)
	if err != nil {
		return 0, err
	}
	written, err := pw.sink.Write(data)
	if err != nil {
		return 0, err
	}

	written += headerSize

	pw.totalUncompressed += int64(uncompressed + headerSize)
	pw.totalCompressed = int64(written)
	pw.dictEncodingStats[parquet.Encoding(page.encoding)]++
	return int64(written), nil
}

var pageHeaderPool = sync.Pool{
	New: func() interface{} {
		return format.NewPageHeader()
	},
}

func (pw *serializedPageWriter) WriteDataPage(page DataPage) (int64, error) {
	uncompressed := page.UncompressedSize()
	data := page.Data()

	if pw.dataEncryptor != nil {
		if err := pw.updateEncryption(encryption.DataPageModule); err != nil {
			return 0, err
		}
		pw.encryptionBuf.Reset()
		pw.encryptionBuf.Grow(pw.dataEncryptor.CiphertextSizeDelta() + len(data))
		pw.dataEncryptor.Encrypt(&pw.encryptionBuf, data)
		data = pw.encryptionBuf.Bytes()
	}

	pageHdr := pageHeaderPool.Get().(*format.PageHeader)
	defer pageHeaderPool.Put(pageHdr)
	pageHdr.UncompressedPageSize = uncompressed
	pageHdr.CompressedPageSize = int32(len(data))

	switch dpage := page.(type) {
	case *DataPageV1:
		pw.setDataPageHeader(pageHdr, dpage)
		defer dataPageV1HeaderPool.Put(pageHdr.DataPageHeader)
	case *DataPageV2:
		pw.setDataPageV2Header(pageHdr, dpage)
		defer dataPageV2HeaderPool.Put(pageHdr.DataPageHeaderV2)
	default:
		return 0, xerrors.New("parquet: unexpected page type")
	}

	startPos := pw.sink.Tell()
	if pw.pageOrdinal == 0 {
		pw.dataPageOffset = int64(startPos)
	}

	if pw.metaEncryptor != nil {
		if err := pw.updateEncryption(encryption.DataPageHeaderModule); err != nil {
			return 0, err
		}
	}
	headerSize, err := pw.thriftSerializer.Serialize(pageHdr, pw.sink, pw.metaEncryptor)
	if err != nil {
		return 0, err
	}
	written, err := pw.sink.Write(data)
	if err != nil {
		return int64(written), err
	}
	written += headerSize

	// collect page index
	if pw.columnIndexBuilder != nil {
		stats := page.Statistics()
		pw.columnIndexBuilder.AddPage(&stats)
	}

	if pw.offsetIndexBuilder != nil {
		if written > math.MaxInt32 {
			return int64(written), fmt.Errorf("parquet: compressed page size %d overflows INT32_MAX", written)
		}

		if page.FirstRowIndex() == -1 {
			return int64(written), fmt.Errorf("parquet: first row index is not set in data page for offset index")
		}

		// startPos is a relative offset in the buffered mode, it should be
		// adjusted via OffsetIndexBuilder.Finish after BufferedPageWriter
		// has flushed all data pages
		if err = pw.offsetIndexBuilder.AddPage(startPos, page.FirstRowIndex(), int32(written)); err != nil {
			return int64(written), err
		}
	}

	pw.totalUncompressed += int64(uncompressed) + int64(headerSize)
	pw.totalCompressed += int64(written)
	pw.nvalues += int64(page.NumValues())
	pw.dataEncodingStats[parquet.Encoding(page.Encoding())]++
	pw.pageOrdinal++
	return int64(written), nil
}

func (pw *serializedPageWriter) FinishPageIndexes(finalPos int64) {
	if pw.columnIndexBuilder != nil {
		pw.columnIndexBuilder.Finish()
	}
	if pw.offsetIndexBuilder != nil {
		pw.offsetIndexBuilder.Finish(finalPos)
	}
}

type bufferedPageWriter struct {
	finalSink          utils.WriterTell
	inMemSink          *encoding.BufferWriter
	metadata           *metadata.ColumnChunkMetaDataBuilder
	pager              *serializedPageWriter
	hasDictionaryPages bool
}

func newBufferedPageWriter(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rgOrdinal, columnOrdinal int16, mem memory.Allocator, metaEncryptor, dataEncryptor encryption.Encryptor) (PageWriter, error) {
	wr := &bufferedPageWriter{
		finalSink:          sink,
		metadata:           metadata,
		hasDictionaryPages: false,
		inMemSink:          encoding.NewBufferWriter(0, mem),
	}
	pager, err := createSerializedPageWriter(wr.inMemSink, codec, compressionLevel, metadata, rgOrdinal, columnOrdinal, mem, metaEncryptor, dataEncryptor)
	if err != nil {
		return nil, err
	}
	wr.pager = pager.(*serializedPageWriter)
	return wr, nil
}

func (bw *bufferedPageWriter) SetIndexBuilders(colIdxBldr metadata.ColumnIndexBuilder, offsetIdxBldr *metadata.OffsetIndexBuilder) {
	bw.pager.SetIndexBuilders(colIdxBldr, offsetIdxBldr)
}

func (bw *bufferedPageWriter) Reset(sink utils.WriterTell, codec compress.Compression, compressionLevel int, metadata *metadata.ColumnChunkMetaDataBuilder, rgOrdinal, columnOrdinal int16, metaEncryptor, dataEncryptor encryption.Encryptor) error {
	bw.finalSink = sink
	bw.metadata = metadata
	bw.hasDictionaryPages = false
	bw.inMemSink.Reset(0)

	return bw.pager.Reset(bw.inMemSink, codec, compressionLevel, metadata, rgOrdinal, columnOrdinal, metaEncryptor, dataEncryptor)
}

func (bw *bufferedPageWriter) WriteDictionaryPage(page *DictionaryPage) (int64, error) {
	bw.hasDictionaryPages = true
	return bw.pager.WriteDictionaryPage(page)
}

func (bw *bufferedPageWriter) Close(hasDict, fallback bool) error {
	if bw.pager.metaEncryptor != nil {
		bw.pager.updateEncryption(encryption.ColumnMetaModule)
	}

	position := bw.finalSink.Tell()
	dictOffset := int64(0)
	if bw.hasDictionaryPages {
		dictOffset = bw.pager.DictionaryPageOffset() + position
	}

	chunkInfo := metadata.ChunkMetaInfo{
		NumValues:        bw.pager.NumValues(),
		DictPageOffset:   dictOffset,
		IndexPageOffset:  -1,
		DataPageOffset:   bw.pager.DataPageoffset() + position,
		CompressedSize:   bw.pager.TotalCompressedSize(),
		UncompressedSize: bw.pager.TotalUncompressedSize(),
	}
	encodingStats := metadata.EncodingStats{
		DictEncodingStats: bw.pager.dictEncodingStats,
		DataEncodingStats: bw.pager.dataEncodingStats,
	}
	bw.metadata.Finish(chunkInfo, hasDict, fallback, encodingStats)
	bw.pager.FinishPageIndexes(position)

	bw.metadata.WriteTo(bw.inMemSink)

	buf := bw.inMemSink.Finish()
	defer buf.Release()
	_, err := bw.finalSink.Write(buf.Bytes())
	return err
}

func (bw *bufferedPageWriter) WriteDataPage(page DataPage) (int64, error) {
	return bw.pager.WriteDataPage(page)
}

func (bw *bufferedPageWriter) HasCompressor() bool {
	return bw.pager.HasCompressor()
}

func (bw *bufferedPageWriter) Compress(buf *bytes.Buffer, src []byte) []byte {
	return bw.pager.Compress(buf, src)
}
