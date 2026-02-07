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
	"fmt"
	"sync"

	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"golang.org/x/xerrors"
)

const (
	maxDictHeaderSize int64 = 100
)

// RowGroupReader is the primary interface for reading a single row group
type RowGroupReader struct {
	r             parquet.ReaderAtSeeker
	fileMetadata  *metadata.FileMetaData
	rgMetadata    *metadata.RowGroupMetaData
	props         *parquet.ReaderProperties
	fileDecryptor encryption.FileDecryptor

	pageIndexReader   *metadata.PageIndexReader
	rgPageIndexReader func() (*metadata.RowGroupPageIndexReader, error)
	bufferPool        *sync.Pool
}

// MetaData returns the metadata of the current Row Group
func (r *RowGroupReader) MetaData() *metadata.RowGroupMetaData { return r.rgMetadata }

// NumColumns returns the number of columns of data as defined in the metadata of this row group
func (r *RowGroupReader) NumColumns() int { return r.rgMetadata.NumColumns() }

// NumRows returns the number of rows in just this row group
func (r *RowGroupReader) NumRows() int64 { return r.rgMetadata.NumRows() }

// ByteSize returns the full byte size of this row group as defined in its metadata
func (r *RowGroupReader) ByteSize() int64 { return r.rgMetadata.TotalByteSize() }

// Column returns a column reader for the requested (0-indexed) column
//
// panics if passed a column not in the range [0, NumColumns)
func (r *RowGroupReader) Column(i int) (ColumnChunkReader, error) {
	if i >= r.NumColumns() || i < 0 {
		return nil, fmt.Errorf("parquet: trying to read column index %d but row group metadata only has %d columns", i, r.rgMetadata.NumColumns())
	}

	descr := r.fileMetadata.Schema.Column(i)
	pageRdr, err := r.GetColumnPageReader(i)
	if err != nil {
		return nil, fmt.Errorf("parquet: unable to initialize page reader: %w", err)
	}
	return newTypedColumnChunkReader(columnChunkReader{
		descr:      descr,
		rdr:        pageRdr,
		mem:        r.props.Allocator(),
		bufferPool: r.bufferPool,
		decoders:   make(map[format.Encoding]encoding.TypedDecoder),
	}), nil
}

func (r *RowGroupReader) GetColumnPageReader(i int) (PageReader, error) {
	col, err := r.rgMetadata.ColumnChunk(i)
	if err != nil {
		return nil, err
	}

	rgIdxRdr, err := r.rgPageIndexReader()
	if err != nil {
		return nil, err
	}

	colStart := col.DataPageOffset()
	if col.HasDictionaryPage() && col.DictionaryPageOffset() > 0 && colStart > col.DictionaryPageOffset() {
		colStart = col.DictionaryPageOffset()
	}

	colLen := col.TotalCompressedSize()
	// PARQUET-816 workaround for old files created by older parquet-mr
	if r.fileMetadata.WriterVersion().LessThan(metadata.Parquet816FixedVersion) {
		sourceSz := r.fileMetadata.GetSourceFileSize()
		// The Parquet MR writer had a bug in 1.2.8 and below where it didn't include the
		// dictionary page header size in total_compressed_size and total_uncompressed_size
		// (see IMPALA-694). We add padding to compensate.
		if colStart < 0 || colLen < 0 {
			return nil, fmt.Errorf("invalid column chunk metadata, offset (%d) and length (%d) should both be positive", colStart, colLen)
		}
		if colStart > sourceSz || colLen > sourceSz {
			return nil, fmt.Errorf("invalid column chunk metadata, offset (%d) and length (%d) must both be less than total source size (%d)", colStart, colLen, sourceSz)
		}
		bytesRemain := sourceSz - (colStart + colLen)
		padding := utils.Min(maxDictHeaderSize, bytesRemain)
		colLen += padding
	}

	stream, err := r.props.GetStream(r.r, colStart, colLen)
	if err != nil {
		return nil, err
	}

	cryptoMetadata := col.CryptoMetadata()
	if cryptoMetadata == nil {
		pr := &serializedPageReader{
			r:                 stream,
			chunk:             col,
			colIdx:            i,
			pgIndexReader:     rgIdxRdr,
			maxPageHeaderSize: defaultMaxPageHeaderSize,
			nrows:             col.NumValues(),
			mem:               r.props.Allocator(),
		}
		return pr, pr.init(col.Compression(), nil)
	}

	if r.fileDecryptor == nil {
		return nil, xerrors.New("column in rowgroup is encrypted, but no file decryptor")
	}

	const encryptedRowGroupsLimit = 32767
	if i > encryptedRowGroupsLimit {
		return nil, xerrors.New("encrypted files cannot contain more than 32767 column chunks")
	}

	if cryptoMetadata.IsSetENCRYPTION_WITH_FOOTER_KEY() {
		ctx := CryptoContext{
			StartDecryptWithDictionaryPage: col.HasDictionaryPage(),
			RowGroupOrdinal:                r.rgMetadata.Ordinal(),
			ColumnOrdinal:                  int16(i),
			MetaDecryptor:                  r.fileDecryptor.GetFooterDecryptorForColumnMeta(""),
			DataDecryptor:                  r.fileDecryptor.GetFooterDecryptorForColumnData(""),
		}
		pr := &serializedPageReader{
			r:                 stream,
			chunk:             col,
			colIdx:            i,
			pgIndexReader:     rgIdxRdr,
			maxPageHeaderSize: defaultMaxPageHeaderSize,
			nrows:             col.NumValues(),
			mem:               r.props.Allocator(),
			cryptoCtx:         ctx,
		}
		return pr, pr.init(col.Compression(), &ctx)
	}

	// column encrypted with it's own key
	columnKeyMeta := cryptoMetadata.GetENCRYPTION_WITH_COLUMN_KEY().KeyMetadata
	columnPath := cryptoMetadata.GetENCRYPTION_WITH_COLUMN_KEY().PathInSchema

	ctx := CryptoContext{
		StartDecryptWithDictionaryPage: col.HasDictionaryPage(),
		RowGroupOrdinal:                r.rgMetadata.Ordinal(),
		ColumnOrdinal:                  int16(i),
		MetaDecryptor:                  r.fileDecryptor.GetColumnMetaDecryptor(parquet.ColumnPath(columnPath).String(), string(columnKeyMeta), ""),
		DataDecryptor:                  r.fileDecryptor.GetColumnDataDecryptor(parquet.ColumnPath(columnPath).String(), string(columnKeyMeta), ""),
	}
	pr := &serializedPageReader{
		r:                 stream,
		chunk:             col,
		colIdx:            i,
		pgIndexReader:     rgIdxRdr,
		maxPageHeaderSize: defaultMaxPageHeaderSize,
		nrows:             col.NumValues(),
		mem:               r.props.Allocator(),
		cryptoCtx:         ctx,
	}
	return pr, pr.init(col.Compression(), &ctx)
}
