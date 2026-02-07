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
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"golang.org/x/xerrors"
)

const (
	footerSize uint32 = 8
)

var (
	magicBytes                  = []byte("PAR1")
	magicEBytes                 = []byte("PARE")
	errInconsistentFileMetadata = xerrors.New("parquet: file is smaller than indicated metadata size")
)

// Reader is the main interface for reading a parquet file
type Reader struct {
	r                 parquet.ReaderAtSeeker
	props             *parquet.ReaderProperties
	metadata          *metadata.FileMetaData
	fileDecryptor     encryption.FileDecryptor
	pageIndexReader   *metadata.PageIndexReader
	bloomFilterReader *metadata.BloomFilterReader

	bufferPool sync.Pool
}

type ReadOption func(*Reader)

// WithReadProps specifies a specific reader properties instance to use, rather
// than using the default ReaderProperties.
func WithReadProps(props *parquet.ReaderProperties) ReadOption {
	return func(r *Reader) {
		r.props = props
	}
}

// WithMetadata allows providing a specific FileMetaData object rather than reading
// the file metadata from the file itself.
func WithMetadata(m *metadata.FileMetaData) ReadOption {
	return func(r *Reader) {
		r.metadata = m
	}
}

// OpenParquetFile will return a Reader for the given parquet file on the local file system.
//
// Optionally the file can be memory mapped for faster reading. If no read properties are provided
// then the default ReaderProperties will be used. The WithMetadata option can be used to provide
// a FileMetaData object rather than reading the file metadata from the file.
func OpenParquetFile(filename string, memoryMap bool, opts ...ReadOption) (*Reader, error) {
	var source parquet.ReaderAtSeeker

	var err error
	if memoryMap {
		source, err = mmapOpen(filename)
		if err != nil {
			return nil, err
		}
	} else {
		source, err = os.Open(filename)
		if err != nil {
			return nil, err
		}
	}
	return NewParquetReader(source, opts...)
}

// NewParquetReader returns a FileReader instance that reads a parquet file which can be read from r.
// This reader needs to support Read, ReadAt and Seeking.
//
// If no read properties are provided then the default ReaderProperties will be used. The WithMetadata
// option can be used to provide a FileMetaData object rather than reading the file metadata from the file.
func NewParquetReader(r parquet.ReaderAtSeeker, opts ...ReadOption) (*Reader, error) {
	f := &Reader{r: r}
	for _, o := range opts {
		o(f)
	}

	if f.props == nil {
		f.props = parquet.NewReaderProperties(memory.NewGoAllocator())
	}

	f.bufferPool = sync.Pool{
		New: func() interface{} {
			buf := memory.NewResizableBuffer(f.props.Allocator())
			runtime.SetFinalizer(buf, func(obj *memory.Buffer) {
				obj.Release()
			})
			return buf
		},
	}

	if f.metadata == nil {
		if err := f.parseMetaData(); err != nil {
			return nil, err
		}
	}

	f.pageIndexReader = &metadata.PageIndexReader{
		Input:        f.r,
		Props:        f.props,
		FileMetadata: f.metadata,
		Decryptor:    f.fileDecryptor,
	}

	return f, nil
}

// BufferPool returns the internal buffer pool being utilized by this reader.
// This is primarily for use by the pqarrow.FileReader or anything that builds
// on top of the Reader and constructs their own ColumnReaders (like the
// RecordReader)
func (f *Reader) BufferPool() *sync.Pool {
	return &f.bufferPool
}

// Close will close the current reader, and if the underlying reader being used
// is an `io.Closer` then Close will be called on it too.
func (f *Reader) Close() error {
	if r, ok := f.r.(io.Closer); ok {
		return r.Close()
	}
	return nil
}

// MetaData returns the underlying FileMetadata object
func (f *Reader) MetaData() *metadata.FileMetaData { return f.metadata }

// parseMetaData handles parsing the metadata from the opened file.
func (f *Reader) parseMetaData() error {
	footerOffset, err := f.r.Seek(0, io.SeekEnd)
	if err != nil {
		return fmt.Errorf("parquet: could not retrieve footer offset: %w", err)
	}

	if footerOffset <= int64(footerSize) {
		return fmt.Errorf("parquet: file too small (size=%d)", footerOffset)
	}

	buf := make([]byte, footerSize)
	// backup 8 bytes to read the footer size (first four bytes) and the magic bytes (last 4 bytes)
	n, err := f.r.ReadAt(buf, footerOffset-int64(footerSize))
	if err != nil && err != io.EOF {
		return fmt.Errorf("parquet: could not read footer: %w", err)
	}
	if n != len(buf) {
		return fmt.Errorf("parquet: could not read %d bytes from end of file", len(buf))
	}

	size := int64(binary.LittleEndian.Uint32(buf[:4]))
	if size < 0 || size+int64(footerSize) > footerOffset {
		return errInconsistentFileMetadata
	}

	fileDecryptProps := f.props.FileDecryptProps

	switch {
	case bytes.Equal(buf[4:], magicBytes): // non-encrypted metadata
		buf = make([]byte, size)
		if _, err := f.r.ReadAt(buf, footerOffset-int64(footerSize)-size); err != nil {
			return fmt.Errorf("parquet: could not read footer: %w", err)
		}

		f.metadata, err = metadata.NewFileMetaData(buf, nil)
		if err != nil {
			return fmt.Errorf("parquet: could not read footer: %w", err)
		}
		f.metadata.SetSourceFileSize(footerOffset)

		if !f.metadata.IsSetEncryptionAlgorithm() {
			if fileDecryptProps != nil && !fileDecryptProps.PlaintextFilesAllowed() {
				return fmt.Errorf("parquet: applying decryption properties on plaintext file")
			}
		} else {
			if err := f.parseMetaDataEncryptedFilePlaintextFooter(fileDecryptProps, buf); err != nil {
				return err
			}
		}
	case bytes.Equal(buf[4:], magicEBytes): // encrypted metadata
		buf = make([]byte, size)
		if _, err := f.r.ReadAt(buf, footerOffset-int64(footerSize)-size); err != nil {
			return fmt.Errorf("parquet: could not read footer: %w", err)
		}

		if fileDecryptProps == nil {
			return xerrors.New("could not read encrypted metadata, no decryption found in reader's properties")
		}

		fileCryptoMetadata, err := metadata.NewFileCryptoMetaData(buf)
		if err != nil {
			return err
		}
		algo := fileCryptoMetadata.EncryptionAlgorithm()
		fileAad, err := f.handleAadPrefix(fileDecryptProps, &algo)
		if err != nil {
			return err
		}
		f.fileDecryptor = encryption.NewFileDecryptor(fileDecryptProps, fileAad, algo.Algo, string(fileCryptoMetadata.KeyMetadata()), f.props.Allocator())

		f.metadata, err = metadata.NewFileMetaData(buf[fileCryptoMetadata.Len():], f.fileDecryptor)
		if err != nil {
			return fmt.Errorf("parquet: could not read footer: %w", err)
		}
		f.metadata.SetSourceFileSize(footerOffset)
	default:
		return fmt.Errorf("parquet: magic bytes not found in footer. Either the file is corrupted or this isn't a parquet file")
	}

	return nil
}

func (f *Reader) handleAadPrefix(fileDecrypt *parquet.FileDecryptionProperties, algo *parquet.Algorithm) (string, error) {
	aadPrefixInProps := fileDecrypt.AadPrefix()
	aadPrefix := []byte(aadPrefixInProps)
	fileHasAadPrefix := len(algo.Aad.AadPrefix) > 0
	aadPrefixInFile := algo.Aad.AadPrefix

	if algo.Aad.SupplyAadPrefix && aadPrefixInProps == "" {
		return "", xerrors.New("AAD Prefix used for file encryption but not stored in file and not supplied in decryption props")
	}

	if fileHasAadPrefix {
		if aadPrefixInProps != "" {
			if aadPrefixInProps != string(aadPrefixInFile) {
				return "", xerrors.New("AAD prefix in file and in properties but not the same")
			}
		}
		aadPrefix = aadPrefixInFile
		if fileDecrypt.Verifier != nil {
			fileDecrypt.Verifier.Verify(string(aadPrefix))
		}
	} else {
		if !algo.Aad.SupplyAadPrefix && aadPrefixInProps != "" {
			return "", xerrors.New("AAD Prefix set in decryptionproperties but was not used for file encryption")
		}
		if fileDecrypt.Verifier != nil {
			return "", xerrors.New("AAD Prefix Verifier is set but AAD Prefix not found in file")
		}
	}
	return string(append(aadPrefix, algo.Aad.AadFileUnique...)), nil
}

func (f *Reader) parseMetaDataEncryptedFilePlaintextFooter(decryptProps *parquet.FileDecryptionProperties, data []byte) error {
	if decryptProps != nil {
		algo := f.metadata.EncryptionAlgorithm()
		fileAad, err := f.handleAadPrefix(decryptProps, &algo)
		if err != nil {
			return err
		}
		f.fileDecryptor = encryption.NewFileDecryptor(decryptProps, fileAad, algo.Algo, string(f.metadata.GetFooterSigningKeyMetadata()), f.props.Allocator())
		// set the InternalFileDecryptor in the metadata as well, as it's used
		// for signature verification and for ColumnChunkMetaData creation.
		f.metadata.FileDecryptor = f.fileDecryptor
		if decryptProps.PlaintextFooterIntegrity() {
			if len(data)-f.metadata.Size() != encryption.GcmTagLength+encryption.NonceLength {
				return xerrors.New("failed reading metadata for encryption signature")
			}

			if !f.metadata.VerifySignature(data[f.metadata.Size():]) {
				return xerrors.New("parquet crypto signature verification failed")
			}
		}
	}
	return nil
}

// WriterVersion returns the Application Version that was written in the file
// metadata
func (f *Reader) WriterVersion() *metadata.AppVersion {
	return f.metadata.WriterVersion()
}

// NumRows returns the total number of rows in this parquet file.
func (f *Reader) NumRows() int64 {
	return f.metadata.GetNumRows()
}

// NumRowGroups returns the total number of row groups in this file.
func (f *Reader) NumRowGroups() int {
	return len(f.metadata.GetRowGroups())
}

// RowGroup returns a reader for the desired (0-based) row group
func (f *Reader) RowGroup(i int) *RowGroupReader {
	rg := f.metadata.RowGroups[i]

	return &RowGroupReader{
		fileMetadata:    f.metadata,
		rgMetadata:      metadata.NewRowGroupMetaData(rg, f.metadata.Schema, f.WriterVersion(), f.fileDecryptor),
		props:           f.props,
		r:               f.r,
		fileDecryptor:   f.fileDecryptor,
		bufferPool:      &f.bufferPool,
		pageIndexReader: f.pageIndexReader,
		// don't pre-emptively initialize the row group page index reader
		// do it on demand, but ensure that it is goroutine safe.
		rgPageIndexReader: sync.OnceValues(func() (*metadata.RowGroupPageIndexReader, error) {
			return f.pageIndexReader.RowGroup(i)
		}),
	}
}

func (f *Reader) GetPageIndexReader() *metadata.PageIndexReader {
	return f.pageIndexReader
}

func (f *Reader) GetBloomFilterReader() *metadata.BloomFilterReader {
	if f.bloomFilterReader == nil {
		f.bloomFilterReader = &metadata.BloomFilterReader{
			Input:         f.r,
			FileMetadata:  f.metadata,
			Props:         f.props,
			FileDecryptor: f.fileDecryptor,
			BufferPool:    &f.bufferPool,
		}
	}
	return f.bloomFilterReader
}
