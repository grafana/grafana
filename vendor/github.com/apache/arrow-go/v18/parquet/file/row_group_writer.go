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
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"golang.org/x/xerrors"
)

// RowGroupWriter is the base interface for writing rowgroups, the actual writer
// will be either the SerialRowGroupWriter or the BufferedRowGroupWriter
type RowGroupWriter interface {
	// Returns the number of columns for this row group writer
	NumColumns() int
	// returns the current number of rows that have been written.
	// Returns an error if they are unequal between columns that have been written so far
	NumRows() (int, error)
	// The total compressed bytes so
	TotalCompressedBytes() int64
	// the total bytes written and flushed out
	TotalBytesWritten() int64
	// Closes any unclosed columnwriters, and closes the rowgroup, writing out
	// the metadata. subsequent calls have no effect
	// returns an error if columns contain unequal numbers of rows.
	Close() error
	// Buffered returns true if it's a BufferedRowGroupWriter and false for a
	// SerialRowGroupWriter
	Buffered() bool
}

// SerialRowGroupWriter expects each column to be written one after the other,
// data is flushed every time NextColumn is called and will panic if there is
// an unequal number of rows written per column.
type SerialRowGroupWriter interface {
	RowGroupWriter
	NextColumn() (ColumnChunkWriter, error)
	// returns the current column being built, if buffered it will equal NumColumns
	// if serialized then it will return which column is currently being written
	CurrentColumn() int
}

// BufferedRowGroupWriter allows writing to multiple columns simultaneously, data
// will not be flushed to the underlying writer until closing the RowGroupWriter.
//
// All columns must have equal numbers of rows before closing the row group or it will panic.
type BufferedRowGroupWriter interface {
	RowGroupWriter
	Column(i int) (ColumnChunkWriter, error)
}

type rowGroupWriter struct {
	sink                   utils.WriterTell
	metadata               *metadata.RowGroupMetaDataBuilder
	props                  *parquet.WriterProperties
	bytesWritten           int64
	compressedBytesWritten int64
	closed                 bool
	ordinal                int16
	nextColumnIdx          int
	nrows                  int
	buffered               bool
	fileEncryptor          encryption.FileEncryptor
	pageIndexBuilder       *metadata.PageIndexBuilder

	columnWriters []ColumnChunkWriter
	pager         PageWriter

	bloomFilters map[string]metadata.BloomFilterBuilder
}

func newRowGroupWriter(sink utils.WriterTell, rgMeta *metadata.RowGroupMetaDataBuilder, ordinal int16, props *parquet.WriterProperties, buffered bool, fileEncryptor encryption.FileEncryptor, pageIdxBldr *metadata.PageIndexBuilder) *rowGroupWriter {
	ret := &rowGroupWriter{
		sink:             sink,
		metadata:         rgMeta,
		props:            props,
		ordinal:          ordinal,
		buffered:         buffered,
		fileEncryptor:    fileEncryptor,
		pageIndexBuilder: pageIdxBldr,
		bloomFilters:     make(map[string]metadata.BloomFilterBuilder),
	}

	if buffered {
		ret.initColumns()
	} else {
		ret.columnWriters = []ColumnChunkWriter{nil}
	}
	return ret
}

func (rg *rowGroupWriter) Buffered() bool { return rg.buffered }

func (rg *rowGroupWriter) checkRowsWritten() error {
	if len(rg.columnWriters) == 0 {
		return nil
	}

	if !rg.buffered && rg.columnWriters[0] != nil {
		current := rg.columnWriters[0].RowsWritten()
		if rg.nrows == 0 {
			rg.nrows = current
		} else if rg.nrows != current {
			return xerrors.Errorf("row mismatch for unbuffered row group: %d, count expected: %d, actual: %d", rg.ordinal, current, rg.nrows)
		}
	} else if rg.buffered {
		current := rg.columnWriters[0].RowsWritten()
		for i, wr := range rg.columnWriters[1:] {
			if current != wr.RowsWritten() {
				return xerrors.Errorf("row mismatch for buffered row group: %d, column: %d, count expected: %d, actual: %d", rg.ordinal, i+1, current, wr.RowsWritten())
			}
		}
		rg.nrows = current
	}
	return nil
}

func (rg *rowGroupWriter) NumColumns() int { return rg.metadata.NumColumns() }
func (rg *rowGroupWriter) NumRows() (int, error) {
	err := rg.checkRowsWritten()
	return rg.nrows, err
}

func (rg *rowGroupWriter) NextColumn() (ColumnChunkWriter, error) {
	if rg.buffered {
		panic("next column is not supported when a rowgroup is written by size")
	}
	if rg.columnWriters[0] != nil {
		if err := rg.checkRowsWritten(); err != nil {
			return nil, err
		}
	}

	// throw an error if more columns are being written
	colMeta := rg.metadata.NextColumnChunk()
	if rg.columnWriters[0] != nil {
		if err := rg.columnWriters[0].Close(); err != nil {
			return nil, err
		}
		rg.bytesWritten += rg.columnWriters[0].TotalBytesWritten()
		rg.compressedBytesWritten += rg.columnWriters[0].TotalCompressedBytes()
	}
	rg.nextColumnIdx++

	path := colMeta.Descr().Path()
	var (
		columnOrdinal = rg.nextColumnIdx - 1
		metaEncryptor encryption.Encryptor
		dataEncryptor encryption.Encryptor
		colIdxBldr    metadata.ColumnIndexBuilder
		offsetIdxBldr *metadata.OffsetIndexBuilder
	)
	if rg.fileEncryptor != nil {
		metaEncryptor = rg.fileEncryptor.GetColumnMetaEncryptor(path)
		dataEncryptor = rg.fileEncryptor.GetColumnDataEncryptor(path)
	}
	if rg.pageIndexBuilder != nil && rg.props.PageIndexEnabledFor(path) {
		var err error
		if colIdxBldr, err = rg.pageIndexBuilder.GetColumnIndexBuilder(columnOrdinal); err != nil {
			return nil, err
		}
		if offsetIdxBldr, err = rg.pageIndexBuilder.GetOffsetIndexBuilder(columnOrdinal); err != nil {
			return nil, err
		}
	}

	if rg.pager == nil {
		var err error
		rg.pager, err = NewPageWriter(rg.sink, rg.props.CompressionFor(path), rg.props.CompressionLevelFor(path), colMeta, rg.ordinal, int16(columnOrdinal), rg.props.Allocator(), false, metaEncryptor, dataEncryptor)
		if err != nil {
			return nil, err
		}
		rg.pager.SetIndexBuilders(colIdxBldr, offsetIdxBldr)
	} else {
		rg.pager.Reset(rg.sink, rg.props.CompressionFor(path), rg.props.CompressionLevelFor(path), colMeta, rg.ordinal, int16(columnOrdinal), metaEncryptor, dataEncryptor)
		rg.pager.SetIndexBuilders(colIdxBldr, offsetIdxBldr)
	}

	rg.columnWriters[0] = NewColumnChunkWriter(colMeta, rg.pager, rg.props)
	rg.bloomFilters[path] = rg.columnWriters[0].GetBloomFilter()
	return rg.columnWriters[0], nil
}

func (rg *rowGroupWriter) Column(i int) (ColumnChunkWriter, error) {
	if !rg.buffered {
		panic("column is only supported when a bufferedrowgroup is being written")
	}

	if i >= 0 && i < len(rg.columnWriters) {
		return rg.columnWriters[i], nil
	}
	return nil, xerrors.Errorf("invalid column number requested: %d", i)
}

func (rg *rowGroupWriter) CurrentColumn() int { return rg.metadata.CurrentColumn() }
func (rg *rowGroupWriter) TotalCompressedBytes() int64 {
	total := int64(0)
	for _, wr := range rg.columnWriters {
		if wr != nil {
			total += wr.TotalCompressedBytes()
		}
	}
	return total + rg.compressedBytesWritten
}

func (rg *rowGroupWriter) TotalBytesWritten() int64 {
	total := int64(0)
	for _, wr := range rg.columnWriters {
		if wr != nil {
			total += wr.TotalBytesWritten()
		}
	}
	return total + rg.bytesWritten
}

func (rg *rowGroupWriter) Close() error {
	if !rg.closed {
		rg.closed = true
		if err := rg.checkRowsWritten(); err != nil {
			return err
		}

		for _, wr := range rg.columnWriters {
			if wr != nil {
				if err := wr.Close(); err != nil {
					return err
				}
				rg.bytesWritten += wr.TotalBytesWritten()
				rg.compressedBytesWritten += wr.TotalCompressedBytes()
			}
		}

		rg.columnWriters = nil
		rg.metadata.SetNumRows(rg.nrows)
		rg.metadata.Finish(rg.bytesWritten, rg.ordinal)
	}
	return nil
}

func (rg *rowGroupWriter) initColumns() error {
	if rg.columnWriters == nil {
		rg.columnWriters = make([]ColumnChunkWriter, 0, rg.NumColumns())
	}
	for i := 0; i < rg.NumColumns(); i++ {
		colMeta := rg.metadata.NextColumnChunk()
		path := colMeta.Descr().Path()
		var (
			metaEncryptor encryption.Encryptor
			dataEncryptor encryption.Encryptor
			colIdxBldr    metadata.ColumnIndexBuilder
			offsetIdxBldr *metadata.OffsetIndexBuilder
		)
		if rg.fileEncryptor != nil {
			metaEncryptor = rg.fileEncryptor.GetColumnMetaEncryptor(path)
			dataEncryptor = rg.fileEncryptor.GetColumnDataEncryptor(path)
		}
		if rg.pageIndexBuilder != nil && rg.props.PageIndexEnabledFor(path) {
			var err error
			if colIdxBldr, err = rg.pageIndexBuilder.GetColumnIndexBuilder(rg.nextColumnIdx); err != nil {
				return err
			}
			if offsetIdxBldr, err = rg.pageIndexBuilder.GetOffsetIndexBuilder(rg.nextColumnIdx); err != nil {
				return err
			}
		}

		pager, err := NewPageWriter(rg.sink, rg.props.CompressionFor(path), rg.props.CompressionLevelFor(path), colMeta, rg.ordinal, int16(rg.nextColumnIdx), rg.props.Allocator(), rg.buffered, metaEncryptor, dataEncryptor)
		if err != nil {
			return err
		}
		pager.SetIndexBuilders(colIdxBldr, offsetIdxBldr)

		rg.nextColumnIdx++
		cw := NewColumnChunkWriter(colMeta, pager, rg.props)
		rg.columnWriters = append(rg.columnWriters, cw)
		rg.bloomFilters[path] = cw.GetBloomFilter()
	}
	return nil
}
