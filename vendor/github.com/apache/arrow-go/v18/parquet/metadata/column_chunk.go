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

package metadata

import (
	"bytes"
	"context"
	"io"
	"reflect"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/compress"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/thrift"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

// PageEncodingStats is used for counting the number of pages of specific
// types with the given internal encoding.
type PageEncodingStats struct {
	Encoding parquet.Encoding
	PageType format.PageType
}

type statvalues struct {
	*format.Statistics
}

func (s *statvalues) GetMin() []byte { return s.GetMinValue() }
func (s *statvalues) GetMax() []byte { return s.GetMaxValue() }
func (s *statvalues) IsSetMin() bool { return s.IsSetMinValue() }
func (s *statvalues) IsSetMax() bool { return s.IsSetMaxValue() }

func makeColumnStats(metadata *format.ColumnMetaData, descr *schema.Column, mem memory.Allocator) TypedStatistics {
	if descr.ColumnOrder() == parquet.ColumnOrders.TypeDefinedOrder {
		return NewStatisticsFromEncoded(descr, mem,
			metadata.NumValues-metadata.Statistics.GetNullCount(),
			&statvalues{metadata.Statistics})
	}
	return NewStatisticsFromEncoded(descr, mem,
		metadata.NumValues-metadata.Statistics.GetNullCount(),
		metadata.Statistics)
}

type IndexLocation struct {
	// file offset of the given index, in bytes
	Offset int64
	// length of the given index, in bytes
	Length int32
}

// ColumnChunkMetaData is a proxy around format.ColumnChunkMetaData
// containing all of the information and metadata for a given column chunk
// and it's associated Column
type ColumnChunkMetaData struct {
	column        *format.ColumnChunk
	columnMeta    *format.ColumnMetaData
	decryptedMeta format.ColumnMetaData
	descr         *schema.Column
	writerVersion *AppVersion
	encodings     []parquet.Encoding
	encodingStats []format.PageEncodingStats
	possibleStats TypedStatistics
	mem           memory.Allocator
}

// NewColumnChunkMetaData creates an instance of the metadata from a column chunk and descriptor
//
// this is primarily used internally or between the subpackages. ColumnChunkMetaDataBuilder should
// be used by consumers instead of using this directly.
func NewColumnChunkMetaData(column *format.ColumnChunk, descr *schema.Column, writerVersion *AppVersion, rowGroupOrdinal, columnOrdinal int16, fileDecryptor encryption.FileDecryptor) (*ColumnChunkMetaData, error) {
	c := &ColumnChunkMetaData{
		column:        column,
		columnMeta:    column.GetMetaData(),
		descr:         descr,
		writerVersion: writerVersion,
		mem:           memory.DefaultAllocator,
	}
	if column.IsSetCryptoMetadata() {
		ccmd := column.CryptoMetadata

		if ccmd.IsSetENCRYPTION_WITH_COLUMN_KEY() {
			if fileDecryptor != nil && fileDecryptor.Properties() != nil {
				// should decrypt metadata
				path := parquet.ColumnPath(ccmd.ENCRYPTION_WITH_COLUMN_KEY.GetPathInSchema())
				keyMetadata := ccmd.ENCRYPTION_WITH_COLUMN_KEY.GetKeyMetadata()
				aadColumnMetadata := encryption.CreateModuleAad(fileDecryptor.FileAad(), encryption.ColumnMetaModule, rowGroupOrdinal, columnOrdinal, -1)
				decryptor := fileDecryptor.GetColumnMetaDecryptor(path.String(), string(keyMetadata), aadColumnMetadata)
				thrift.DeserializeThrift(&c.decryptedMeta, decryptor.Decrypt(column.GetEncryptedColumnMetadata()))
				c.columnMeta = &c.decryptedMeta
			} else {
				return nil, xerrors.New("cannot decrypt column metadata. file decryption not setup correctly")
			}
		}
	}
	for _, enc := range c.columnMeta.Encodings {
		c.encodings = append(c.encodings, parquet.Encoding(enc))
	}
	for _, enc := range c.columnMeta.EncodingStats {
		c.encodingStats = append(c.encodingStats, *enc)
	}
	return c, nil
}

// CryptoMetadata returns the cryptographic metadata for how this column was
// encrypted and how to decrypt it.
func (c *ColumnChunkMetaData) CryptoMetadata() *format.ColumnCryptoMetaData {
	return c.column.GetCryptoMetadata()
}

// FileOffset is the location in the file where the column data begins
func (c *ColumnChunkMetaData) FileOffset() int64 { return c.column.FileOffset }

// FilePath gives the name of the parquet file if provided in the metadata
func (c *ColumnChunkMetaData) FilePath() string { return c.column.GetFilePath() }

// Type is the physical storage type used in the parquet file for this column chunk.
func (c *ColumnChunkMetaData) Type() parquet.Type { return parquet.Type(c.columnMeta.Type) }

// NumValues is the number of values stored in just this chunk including nulls.
func (c *ColumnChunkMetaData) NumValues() int64 { return c.columnMeta.NumValues }

// PathInSchema is the full path to this column from the root of the schema including
// any nested columns
func (c *ColumnChunkMetaData) PathInSchema() parquet.ColumnPath {
	return c.columnMeta.GetPathInSchema()
}

// Compression provides the type of compression used for this particular chunk.
func (c *ColumnChunkMetaData) Compression() compress.Compression {
	return compress.Compression(c.columnMeta.Codec)
}

// Encodings returns the list of different encodings used in this chunk
func (c *ColumnChunkMetaData) Encodings() []parquet.Encoding { return c.encodings }

// EncodingStats connects the order of encodings based on the list of pages and types
func (c *ColumnChunkMetaData) EncodingStats() []PageEncodingStats {
	ret := make([]PageEncodingStats, len(c.encodingStats))
	for idx := range ret {
		ret[idx].Encoding = parquet.Encoding(c.encodingStats[idx].Encoding)
		ret[idx].PageType = c.encodingStats[idx].PageType
	}
	return ret
}

// HasDictionaryPage returns true if there is a dictionary page offset set in
// this metadata.
func (c *ColumnChunkMetaData) HasDictionaryPage() bool {
	return c.columnMeta.IsSetDictionaryPageOffset()
}

// DictionaryPageOffset returns the location in the file where the dictionary page starts
func (c *ColumnChunkMetaData) DictionaryPageOffset() int64 {
	return c.columnMeta.GetDictionaryPageOffset()
}

// DataPageOffset returns the location in the file where the data pages begin for this column
func (c *ColumnChunkMetaData) DataPageOffset() int64 { return c.columnMeta.GetDataPageOffset() }

// HasIndexPage returns true if the offset for the index page is set in the metadata
func (c *ColumnChunkMetaData) HasIndexPage() bool { return c.columnMeta.IsSetIndexPageOffset() }

// IndexPageOffset is the location in the file where the index page starts.
func (c *ColumnChunkMetaData) IndexPageOffset() int64 { return c.columnMeta.GetIndexPageOffset() }

func (c *ColumnChunkMetaData) GetColumnIndexLocation() *IndexLocation {
	if c.column.IsSetColumnIndexOffset() {
		return &IndexLocation{
			Offset: c.column.GetColumnIndexOffset(),
			Length: c.column.GetColumnIndexLength(),
		}
	}
	return nil
}

func (c *ColumnChunkMetaData) GetOffsetIndexLocation() *IndexLocation {
	if c.column.IsSetOffsetIndexOffset() {
		return &IndexLocation{
			Offset: c.column.GetOffsetIndexOffset(),
			Length: c.column.GetOffsetIndexLength(),
		}
	}
	return nil
}

// TotalCompressedSize will be equal to TotalUncompressedSize if the data is not compressed.
// Otherwise this will be the size of the actual data in the file.
func (c *ColumnChunkMetaData) TotalCompressedSize() int64 {
	return c.columnMeta.GetTotalCompressedSize()
}

// TotalUncompressedSize is the total size of the raw data after uncompressing the chunk
func (c *ColumnChunkMetaData) TotalUncompressedSize() int64 {
	return c.columnMeta.GetTotalUncompressedSize()
}

// BloomFilterOffset is the byte offset from the beginning of the file to the bloom
// filter data.
func (c *ColumnChunkMetaData) BloomFilterOffset() int64 {
	return c.columnMeta.GetBloomFilterOffset()
}

// BloomFilterLength is the length of the serialized bloomfilter including the
// serialized bloom filter header. This was only added in 2.10 so it may not exist,
// returning 0 in that case.
func (c *ColumnChunkMetaData) BloomFilterLength() int32 {
	return c.columnMeta.GetBloomFilterLength()
}

// StatsSet returns true only if there are statistics set in the metadata and the column
// descriptor has a sort order that is not SortUnknown
//
// It also checks the writer version to ensure that it was not written by a version
// of parquet which is known to have incorrect stat computations.
func (c *ColumnChunkMetaData) StatsSet() (bool, error) {
	if !c.columnMeta.IsSetStatistics() || c.descr.SortOrder() == schema.SortUNKNOWN {
		return false, nil
	}

	if c.possibleStats == nil {
		c.possibleStats = makeColumnStats(c.columnMeta, c.descr, c.mem)
	}

	encoded, err := c.possibleStats.Encode()
	if err != nil {
		return false, err
	}

	return c.writerVersion.HasCorrectStatistics(c.Type(), c.descr.LogicalType(), encoded, c.descr.SortOrder()), nil
}

func (c *ColumnChunkMetaData) Equals(other *ColumnChunkMetaData) bool {
	return reflect.DeepEqual(c.columnMeta, other.columnMeta)
}

// Statistics can return nil if there are no stats in this metadata
func (c *ColumnChunkMetaData) Statistics() (TypedStatistics, error) {
	ok, err := c.StatsSet()
	if err != nil {
		return nil, err
	}

	if ok {
		return c.possibleStats, nil
	}
	return nil, nil
}

// ColumnChunkMetaDataBuilder is used during writing to construct metadata
// for a given column chunk while writing, providing a proxy around constructing
// the actual thrift object.
type ColumnChunkMetaDataBuilder struct {
	chunk  *format.ColumnChunk
	props  *parquet.WriterProperties
	column *schema.Column

	compressedSize   int64
	uncompressedSize int64
	fileOffset       int64
}

func NewColumnChunkMetaDataBuilder(props *parquet.WriterProperties, column *schema.Column) *ColumnChunkMetaDataBuilder {
	return NewColumnChunkMetaDataBuilderWithContents(props, column, format.NewColumnChunk())
}

// NewColumnChunkMetaDataBuilderWithContents will construct a builder and start it with the provided
// column chunk information rather than with an empty column chunk.
func NewColumnChunkMetaDataBuilderWithContents(props *parquet.WriterProperties, column *schema.Column, chunk *format.ColumnChunk) *ColumnChunkMetaDataBuilder {
	b := &ColumnChunkMetaDataBuilder{
		props:  props,
		column: column,
		chunk:  chunk,
	}
	b.init(chunk)
	return b
}

// Contents returns the underlying thrift ColumnChunk object so that it can be used
// for constructing or duplicating column metadata
func (c *ColumnChunkMetaDataBuilder) Contents() *format.ColumnChunk { return c.chunk }

func (c *ColumnChunkMetaDataBuilder) init(chunk *format.ColumnChunk) {
	c.chunk = chunk
	if !c.chunk.IsSetMetaData() {
		c.chunk.MetaData = format.NewColumnMetaData()
	}
	c.chunk.MetaData.Type = format.Type(c.column.PhysicalType())
	c.chunk.MetaData.PathInSchema = schema.ColumnPathFromNode(c.column.SchemaNode())
	c.chunk.MetaData.Codec = format.CompressionCodec(c.props.CompressionFor(c.column.Path()))
}

func (c *ColumnChunkMetaDataBuilder) SetFilePath(val string) {
	c.chunk.FilePath = &val
}

// Descr returns the associated column descriptor for this column chunk
func (c *ColumnChunkMetaDataBuilder) Descr() *schema.Column { return c.column }

func (c *ColumnChunkMetaDataBuilder) TotalCompressedSize() int64 {
	// if this column is encrypted, after Finish is called, the MetaData
	// field is set to nil and we store the compressed size so return that
	if c.chunk.MetaData == nil {
		return c.compressedSize
	}
	return c.chunk.MetaData.GetTotalCompressedSize()
}

func (c *ColumnChunkMetaDataBuilder) TotalUncompressedSize() int64 {
	// if this column is encrypted, after Finish is called, the MetaData
	// field is set to nil and we store the compressed size so return that
	if c.chunk.MetaData == nil {
		return c.uncompressedSize
	}
	return c.chunk.MetaData.GetTotalUncompressedSize()
}

func (c *ColumnChunkMetaDataBuilder) SetStats(val EncodedStatistics) {
	c.chunk.MetaData.Statistics = val.ToThrift()
}

// ChunkMetaInfo is a helper struct for passing the offset and size information
// for finishing the building of column chunk metadata
type ChunkMetaInfo struct {
	NumValues        int64
	DictPageOffset   int64
	IndexPageOffset  int64
	DataPageOffset   int64
	CompressedSize   int64
	UncompressedSize int64
}

// EncodingStats is a helper struct for passing the encoding stat information
// for finishing up metadata for a column chunk.
type EncodingStats struct {
	DictEncodingStats map[parquet.Encoding]int32
	DataEncodingStats map[parquet.Encoding]int32
}

// Finish finalizes the metadata with the given offsets,
// flushes any compression that needs to be done.
// Encryption will be performed by calling PopulateCryptoData
// after this function is called.
func (c *ColumnChunkMetaDataBuilder) Finish(info ChunkMetaInfo, hasDict, dictFallback bool, encStats EncodingStats) error {
	if info.DictPageOffset > 0 {
		c.chunk.MetaData.DictionaryPageOffset = &info.DictPageOffset
		c.fileOffset = info.DictPageOffset
	} else {
		c.fileOffset = info.DataPageOffset
	}

	c.chunk.MetaData.NumValues = info.NumValues
	if info.IndexPageOffset >= 0 {
		c.chunk.MetaData.IndexPageOffset = &info.IndexPageOffset
	}

	c.chunk.MetaData.DataPageOffset = info.DataPageOffset
	c.chunk.MetaData.TotalUncompressedSize = info.UncompressedSize
	c.chunk.MetaData.TotalCompressedSize = info.CompressedSize

	// no matter the configuration, the maximum number of thrift encodings we'll
	// populate is going to be 3:
	// 	1. potential dictionary index encoding
	//	2. page encoding
	//	3. RLE for repetition and definition levels
	// so let's preallocate a capacity of 3 but initialize the slice at 0 len
	const maxEncodings = 3

	thriftEncodings := make([]format.Encoding, 0, maxEncodings)
	if hasDict {
		thriftEncodings = append(thriftEncodings, format.Encoding(c.props.DictionaryIndexEncoding()))
		if c.props.Version() == parquet.V1_0 {
			thriftEncodings = append(thriftEncodings, format.Encoding_PLAIN)
		} else {
			thriftEncodings = append(thriftEncodings, format.Encoding(c.props.DictionaryPageEncoding()))
		}
	} else { // no dictionary
		thriftEncodings = append(thriftEncodings, format.Encoding(c.props.EncodingFor(c.column.Path())))
	}

	thriftEncodings = append(thriftEncodings, format.Encoding(parquet.Encodings.RLE))
	// Only PLAIN encoding is supported for fallback in V1
	// TODO(zeroshade): Use user specified encoding for V2
	if dictFallback {
		thriftEncodings = append(thriftEncodings, format.Encoding_PLAIN)
	}
	c.chunk.MetaData.Encodings = thriftEncodings

	thriftEncodingStats := make([]*format.PageEncodingStats, 0, len(encStats.DictEncodingStats)+len(encStats.DataEncodingStats))
	for k, v := range encStats.DictEncodingStats {
		thriftEncodingStats = append(thriftEncodingStats, &format.PageEncodingStats{
			PageType: format.PageType_DICTIONARY_PAGE,
			Encoding: format.Encoding(k),
			Count:    v,
		})
	}
	for k, v := range encStats.DataEncodingStats {
		thriftEncodingStats = append(thriftEncodingStats, &format.PageEncodingStats{
			PageType: format.PageType_DATA_PAGE,
			Encoding: format.Encoding(k),
			Count:    v,
		})
	}
	c.chunk.MetaData.EncodingStats = thriftEncodingStats

	return nil
}

func (c *ColumnChunkMetaDataBuilder) PopulateCryptoData(encryptor encryption.Encryptor) error {
	encryptProps := c.props.ColumnEncryptionProperties(c.column.Path())
	if encryptProps != nil && encryptProps.IsEncrypted() {
		ccmd := format.NewColumnCryptoMetaData()
		if encryptProps.IsEncryptedWithFooterKey() {
			ccmd.ENCRYPTION_WITH_FOOTER_KEY = format.NewEncryptionWithFooterKey()
		} else {
			ccmd.ENCRYPTION_WITH_COLUMN_KEY = &format.EncryptionWithColumnKey{
				KeyMetadata:  []byte(encryptProps.KeyMetadata()),
				PathInSchema: c.column.ColumnPath(),
			}
		}
		c.chunk.CryptoMetadata = ccmd

		encryptedFooter := c.props.FileEncryptionProperties().EncryptedFooter()
		encryptMetadata := !encryptedFooter || !encryptProps.IsEncryptedWithFooterKey()
		if encryptMetadata {
			// Serialize and encrypt ColumnMetadata separately
			// Thrift-serialize the ColumnMetaData structure,
			// encrypt it with the column key, and write to encrypted_column_metadata
			serializer := thrift.NewThriftSerializer()
			data, err := serializer.Write(context.Background(), c.chunk.MetaData)
			if err != nil {
				return err
			}
			var buf bytes.Buffer
			encryptor.Encrypt(&buf, data)
			c.chunk.EncryptedColumnMetadata = buf.Bytes()

			if encryptedFooter {
				c.compressedSize = c.chunk.MetaData.GetTotalCompressedSize()
				c.uncompressedSize = c.chunk.MetaData.GetTotalUncompressedSize()
				c.chunk.MetaData = nil
			} else {
				// Keep redacted metadata version for old readers
				c.chunk.MetaData.Statistics = nil
				c.chunk.MetaData.EncodingStats = nil
			}
		}
	}
	return nil
}

// WriteTo will always return 0 as the int64 since the thrift writer library
// does not return the number of bytes written, we only use the signature
// of (int64, error) in order to match the standard WriteTo interfaces.
func (c *ColumnChunkMetaDataBuilder) WriteTo(w io.Writer) (int64, error) {
	return 0, thrift.SerializeThriftStream(c.chunk, w)
}

type PageIndexLocation struct {
	ColIndexLocation, OffsetIndexLocation map[uint64][]*IndexLocation
}
