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

package parquet

import (
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// ReaderProperties are used to define how the file reader will handle buffering and allocating buffers
type ReaderProperties struct {
	alloc memory.Allocator
	// Default buffer size to utilize when reading chunks, when reading page
	// headers or other metadata, this buffer may be increased if necessary
	// to read in the necessary metadata. The value here is simply the default
	// initial BufferSize when reading a new chunk.
	BufferSize int64
	// create with NewFileDecryptionProperties if dealing with an encrypted file
	FileDecryptProps *FileDecryptionProperties
	// If this is set to true, then the reader will use SectionReader to
	// just use the read stream when reading data. Otherwise we will buffer
	// the data we're going to read into memory first and then read that buffer.
	//
	// When accessing data from IO sources with higher latency, like S3, setting this
	// to false may improve performance by reading the entire row group at once rather
	// than sending multiple smaller IO requests. For IO streams with low latency, setting
	// this to true can optimize memory usage for the reader. Additionally, this can decrease
	// the amount of data retrieved when only needs to access small portions of the parquet file.
	BufferedStreamEnabled bool
}

type BufferedReader interface {
	Peek(int) ([]byte, error)
	Discard(int) (int, error)
	Outer() utils.Reader
	BufferSize() int
	Reset(utils.Reader)
	io.Reader
}

// NewReaderProperties returns the default Reader Properties using the provided allocator.
//
// If nil is passed for the allocator, then memory.DefaultAllocator will be used.
func NewReaderProperties(alloc memory.Allocator) *ReaderProperties {
	if alloc == nil {
		alloc = memory.DefaultAllocator
	}
	return &ReaderProperties{alloc, DefaultBufSize, nil, false}
}

// Allocator returns the allocator that the properties were initialized with
func (r *ReaderProperties) Allocator() memory.Allocator { return r.alloc }

// GetStream returns a section of the underlying reader based on whether or not BufferedStream is enabled.
//
// If BufferedStreamEnabled is true, it creates an io.SectionReader, otherwise it will read the entire section
// into a buffer in memory and return a bytes.NewReader for that buffer.
func (r *ReaderProperties) GetStream(source io.ReaderAt, start, nbytes int64) (BufferedReader, error) {
	if r.BufferedStreamEnabled {
		return utils.NewBufferedReader(io.NewSectionReader(source, start, nbytes), int(r.BufferSize)), nil
	}

	data := make([]byte, nbytes)
	n, err := source.ReadAt(data, start)
	if err != nil {
		return nil, fmt.Errorf("parquet: tried reading from file, but got error: %w", err)
	}
	if n != int(nbytes) {
		return nil, fmt.Errorf("parquet: tried reading %d bytes starting at position %d from file but only got %d", nbytes, start, n)
	}

	return utils.NewByteReader(data), nil
}
