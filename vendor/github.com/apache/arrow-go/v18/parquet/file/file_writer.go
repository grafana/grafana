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
	"encoding/binary"
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

// Writer is the primary interface for writing a parquet file
type Writer struct {
	sink             utils.WriteCloserTell
	open             bool
	footerFlushed    bool
	props            *parquet.WriterProperties
	rowGroups        int
	nrows            int
	metadata         metadata.FileMetaDataBuilder
	fileEncryptor    encryption.FileEncryptor
	rowGroupWriter   *rowGroupWriter
	pageIndexBuilder *metadata.PageIndexBuilder
	bloomFilters     *metadata.FileBloomFilterBuilder

	// The Schema of this writer
	Schema *schema.Schema
}

type writerConfig struct {
	props            *parquet.WriterProperties
	keyValueMetadata metadata.KeyValueMetadata
}

type WriteOption func(*writerConfig)

func WithWriterProps(props *parquet.WriterProperties) WriteOption {
	return func(c *writerConfig) {
		c.props = props
	}
}

func WithWriteMetadata(meta metadata.KeyValueMetadata) WriteOption {
	return func(c *writerConfig) {
		c.keyValueMetadata = meta
	}
}

// NewParquetWriter returns a Writer that writes to the provided WriteSeeker with the given schema.
//
// If props is nil, then the default Writer Properties will be used. If the key value metadata is not nil,
// it will be added to the file.
func NewParquetWriter(w io.Writer, sc *schema.GroupNode, opts ...WriteOption) *Writer {
	config := &writerConfig{}
	for _, o := range opts {
		o(config)
	}
	if config.props == nil {
		config.props = parquet.NewWriterProperties()
	}

	fileSchema := schema.NewSchema(sc)
	fw := &Writer{
		props:  config.props,
		sink:   &utils.TellWrapper{Writer: w},
		open:   true,
		Schema: fileSchema,
	}

	fw.metadata = *metadata.NewFileMetadataBuilder(fw.Schema, fw.props, config.keyValueMetadata)
	fw.startFile()
	return fw
}

// NumColumns returns the number of columns to write as defined by the schema.
func (fw *Writer) NumColumns() int { return fw.Schema.NumColumns() }

// NumRowGroups returns the current number of row groups that will be written for this file.
func (fw *Writer) NumRowGroups() int { return fw.rowGroups }

// NumRows returns the current number of rows that have be written
func (fw *Writer) NumRows() int { return fw.nrows }

// Properties returns the writer properties that are in use for this file.
func (fw *Writer) Properties() *parquet.WriterProperties { return fw.props }

// TotalBytesWritten returns the total number of bytes that have been written
// to the underlying sink so far.
func (fw *Writer) TotalBytesWritten() int64 { return fw.sink.Tell() }

// TotalCompressedBytes returns the total number of compressed bytes written
// for all row groups that have been fully closed, plus the current open row
// group (if any).
func (fw *Writer) TotalCompressedBytes() int64 {
	var total int64

	// Closed row groups: use the metadata builder snapshot.
	meta, err := fw.metadata.Snapshot()
	if err == nil {
		for i := 0; i < meta.NumRowGroups(); i++ {
			// This uses the TotalCompressedSize recorded in the row group metadata.
			total += meta.RowGroup(i).TotalCompressedSize()
		}
	}

	// Currently open row group, if any: add its live compressed bytes.
	if fw.rowGroupWriter != nil {
		total += fw.rowGroupWriter.TotalCompressedBytes()
	}

	return total
}

// AppendBufferedRowGroup appends a rowgroup to the file and returns a writer
// that buffers the row group in memory allowing writing multiple columns
// at once to the row group. Data is not flushed out until the row group
// is closed.
//
// When calling Close, all columns must have the same number of rows written.
func (fw *Writer) AppendBufferedRowGroup() BufferedRowGroupWriter {
	return fw.appendRowGroup(true)
}

// AppendRowGroup appends a row group to the file and returns a writer
// that writes columns to the row group in serial via calling NextColumn.
//
// When calling NextColumn, the same number of rows need to have been written
// to each column before moving on. Otherwise the rowgroup writer will panic.
func (fw *Writer) AppendRowGroup() SerialRowGroupWriter {
	return fw.appendRowGroup(false)
}

func (fw *Writer) appendRowGroup(buffered bool) *rowGroupWriter {
	if fw.rowGroupWriter != nil {
		fw.nrows += fw.rowGroupWriter.nrows
		fw.rowGroupWriter.Close()
	}
	fw.rowGroups++
	fw.footerFlushed = false
	rgMeta := fw.metadata.AppendRowGroup()
	if fw.pageIndexBuilder != nil {
		fw.pageIndexBuilder.AppendRowGroup()
	}

	fw.rowGroupWriter = newRowGroupWriter(fw.sink, rgMeta, int16(fw.rowGroups)-1,
		fw.props, buffered, fw.fileEncryptor, fw.pageIndexBuilder)
	fw.bloomFilters.AppendRowGroup(rgMeta, fw.rowGroupWriter.bloomFilters)
	return fw.rowGroupWriter
}

func (fw *Writer) startFile() {
	encryptionProps := fw.props.FileEncryptionProperties()
	magic := magicBytes
	if encryptionProps != nil {
		// check that all columns in columnEncryptionProperties exist in the schema
		encryptedCols := encryptionProps.EncryptedColumns()
		// if columnEncryptionProperties is empty, every column in the file schema will be encrypted with the footer key
		if len(encryptedCols) != 0 {
			colPaths := make(map[string]bool)
			for i := 0; i < fw.Schema.NumColumns(); i++ {
				colPaths[fw.Schema.Column(i).Path()] = true
			}
			for k := range encryptedCols {
				if _, ok := colPaths[k]; !ok {
					panic("encrypted column " + k + " not found in file schema")
				}
			}
		}

		fw.fileEncryptor = encryption.NewFileEncryptor(encryptionProps, fw.props.Allocator())
		fw.metadata.SetFileEncryptor(fw.fileEncryptor)
		if encryptionProps.EncryptedFooter() {
			magic = magicEBytes
		}
	}

	fw.bloomFilters = &metadata.FileBloomFilterBuilder{
		Schema:    fw.Schema,
		Encryptor: fw.fileEncryptor,
	}

	n, err := fw.sink.Write(magic)
	if n != 4 || err != nil {
		panic("failed to write magic number")
	}

	if fw.props.PageIndexEnabled() {
		fw.pageIndexBuilder = &metadata.PageIndexBuilder{
			Schema:    fw.Schema,
			Encryptor: fw.fileEncryptor,
		}
	}
}

func (fw *Writer) writePageIndex() {
	if fw.pageIndexBuilder != nil {
		// serialize page index after all row groups have been written and report
		// location to the file metadata
		fw.pageIndexBuilder.Finish()
		var pageIndexLocation metadata.PageIndexLocation
		fw.pageIndexBuilder.WriteTo(fw.sink, &pageIndexLocation)
		fw.metadata.SetPageIndexLocation(pageIndexLocation)
	}
}

// AppendKeyValueMetadata appends a key/value pair to the existing key/value metadata
func (fw *Writer) AppendKeyValueMetadata(key string, value string) error {
	return fw.metadata.AppendKeyValueMetadata(key, value)
}

// Close closes any open row group writer and writes the file footer. Subsequent
// calls to close will have no effect.
func (fw *Writer) Close() (err error) {
	if fw.open {
		// if any functions here panic, we set open to be false so
		// that this doesn't get called again
		fw.open = false

		defer func() {
			fw.closeEncryptor()
			ierr := fw.sink.Close()
			if err != nil {
				if ierr != nil {
					err = fmt.Errorf("error on close:%w, %s", err, ierr)
				}
				return
			}

			err = ierr
		}()

		err = fw.FlushWithFooter()
	}
	return nil
}

// FileMetadata returns the current state of the FileMetadata that would be written
// if this file were to be closed. If the file has already been closed, then this
// will return the FileMetaData which was written to the file.
func (fw *Writer) FileMetadata() (*metadata.FileMetaData, error) {
	return fw.metadata.Snapshot()
}

// FlushWithFooter closes any open row group writer and writes the file footer, leaving
// the writer open for additional row groups.  Additional footers written by later
// calls to FlushWithFooter or Close will be cumulative, so that only the last footer
// written need ever be read by a reader.
func (fw *Writer) FlushWithFooter() error {
	if !fw.footerFlushed {
		if fw.rowGroupWriter != nil {
			fw.nrows += fw.rowGroupWriter.nrows
			fw.rowGroupWriter.Close()
		}
		fw.rowGroupWriter = nil
		if err := fw.bloomFilters.WriteTo(fw.sink); err != nil {
			return err
		}

		fw.writePageIndex()

		fileMetadata, err := fw.metadata.Snapshot()
		if err != nil {
			return err
		}

		fileEncryptProps := fw.props.FileEncryptionProperties()
		if fileEncryptProps == nil { // non encrypted file
			if _, err = writeFileMetadata(fileMetadata, fw.sink); err != nil {
				return err
			}
		} else {
			if err := fw.flushEncryptedFile(fileMetadata, fileEncryptProps); err != nil {
				return err
			}
		}

		fw.footerFlushed = true
	}
	return nil
}

func (fw *Writer) flushEncryptedFile(fileMetadata *metadata.FileMetaData, props *parquet.FileEncryptionProperties) error {
	// encrypted file with encrypted footer
	if props.EncryptedFooter() {
		footerLen := int64(0)

		cryptoMetadata := fw.metadata.GetFileCryptoMetaData()
		n, err := writeFileCryptoMetadata(cryptoMetadata, fw.sink)
		if err != nil {
			return err
		}

		footerLen += n
		footerEncryptor := fw.fileEncryptor.GetFooterEncryptor()
		n, err = writeEncryptedFileMetadata(fileMetadata, fw.sink, footerEncryptor, true)
		if err != nil {
			return err
		}
		footerLen += n

		if err = binary.Write(fw.sink, binary.LittleEndian, uint32(footerLen)); err != nil {
			return err
		}
		if _, err = fw.sink.Write(magicEBytes); err != nil {
			return err
		}
	} else {
		footerSigningEncryptor := fw.fileEncryptor.GetFooterSigningEncryptor()
		if _, err := writeEncryptedFileMetadata(fileMetadata, fw.sink, footerSigningEncryptor, false); err != nil {
			return err
		}
	}
	return nil
}

func (fw *Writer) closeEncryptor() {
	if fw.fileEncryptor != nil {
		fw.fileEncryptor.WipeOutEncryptionKeys()
	}
}

func writeFileMetadata(fileMetadata *metadata.FileMetaData, w io.Writer) (n int64, err error) {
	n, err = fileMetadata.WriteTo(w, nil)
	if err != nil {
		return
	}

	if err = binary.Write(w, binary.LittleEndian, uint32(n)); err != nil {
		return
	}
	if _, err = w.Write(magicBytes); err != nil {
		return
	}
	return n + int64(4+len(magicBytes)), nil
}

func writeEncryptedFileMetadata(fileMetadata *metadata.FileMetaData, w io.Writer, encryptor encryption.Encryptor, encryptFooter bool) (n int64, err error) {
	n, err = fileMetadata.WriteTo(w, encryptor)
	if encryptFooter {
		return
	}
	if err != nil {
		return
	}
	if err = binary.Write(w, binary.LittleEndian, uint32(n)); err != nil {
		return
	}
	if _, err = w.Write(magicBytes); err != nil {
		return
	}
	return n + int64(4+len(magicBytes)), nil
}

func writeFileCryptoMetadata(crypto *metadata.FileCryptoMetadata, w io.Writer) (int64, error) {
	return crypto.WriteTo(w)
}
