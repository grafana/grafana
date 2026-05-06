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
	"io"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/arrio"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

const (
	errNotArrowFile             = errString("arrow/ipc: not an Arrow file")
	errInconsistentFileMetadata = errString("arrow/ipc: file is smaller than indicated metadata size")
	errInconsistentSchema       = errString("arrow/ipc: tried to write record batch with different schema")
	errMaxRecursion             = errString("arrow/ipc: max recursion depth reached")
	errBigArray                 = errString("arrow/ipc: array larger than 2^31-1 in length")

	kArrowAlignment    = 64 // buffers are padded to 64b boundaries (for SIMD)
	kTensorAlignment   = 64 // tensors are padded to 64b boundaries
	kArrowIPCAlignment = 8  // align on 8b boundaries in IPC
)

var (
	paddingBytes  [kArrowAlignment]byte
	kEOS                 = [8]byte{0xFF, 0xFF, 0xFF, 0xFF, 0, 0, 0, 0} // end of stream message
	kIPCContToken uint32 = 0xFFFFFFFF                                  // 32b continuation indicator for FlatBuffers 8b alignment
)

func paddedLength(nbytes int64, alignment int32) int64 {
	align := int64(alignment)
	return ((nbytes + align - 1) / align) * align
}

type errString string

func (s errString) Error() string {
	return string(s)
}

type ReadAtSeeker interface {
	io.Reader
	io.Seeker
	io.ReaderAt
}

type config struct {
	alloc  memory.Allocator
	schema *arrow.Schema
	footer struct {
		offset int64
	}
	codec              flatbuf.CompressionType
	compressNP         int
	ensureNativeEndian bool
	noAutoSchema       bool
	emitDictDeltas     bool
	minSpaceSavings    *float64
}

func newConfig(opts ...Option) *config {
	cfg := &config{
		alloc:              memory.NewGoAllocator(),
		codec:              -1, // uncompressed
		ensureNativeEndian: true,
		compressNP:         1,
	}

	for _, opt := range opts {
		opt(cfg)
	}

	return cfg
}

// Option is a functional option to configure opening or creating Arrow files
// and streams.
type Option func(*config)

// WithFooterOffset specifies the Arrow footer position in bytes.
func WithFooterOffset(offset int64) Option {
	return func(cfg *config) {
		cfg.footer.offset = offset
	}
}

// WithAllocator specifies the Arrow memory allocator used while building records.
func WithAllocator(mem memory.Allocator) Option {
	return func(cfg *config) {
		cfg.alloc = mem
	}
}

// WithSchema specifies the Arrow schema to be used for reading or writing.
func WithSchema(schema *arrow.Schema) Option {
	return func(cfg *config) {
		cfg.schema = schema
	}
}

// WithLZ4 tells the writer to use LZ4 Frame compression on the data
// buffers before writing. Requires >= Arrow 1.0.0 to read/decompress
func WithLZ4() Option {
	return func(cfg *config) {
		cfg.codec = flatbuf.CompressionTypeLZ4_FRAME
	}
}

// WithZstd tells the writer to use ZSTD compression on the data
// buffers before writing. Requires >= Arrow 1.0.0 to read/decompress
func WithZstd() Option {
	return func(cfg *config) {
		cfg.codec = flatbuf.CompressionTypeZSTD
	}
}

// WithCompressConcurrency specifies a number of goroutines to spin up for
// concurrent compression of the body buffers when writing compress IPC records.
// If n <= 1 then compression will be done serially without goroutine
// parallelization. Default is 1.
func WithCompressConcurrency(n int) Option {
	return func(cfg *config) {
		if n <= 0 {
			n = 1
		}
		cfg.compressNP = n
	}
}

// WithEnsureNativeEndian specifies whether or not to automatically byte-swap
// buffers with endian-sensitive data if the schema's endianness is not the
// platform-native endianness. This includes all numeric types, temporal types,
// decimal types, as well as the offset buffers of variable-sized binary and
// list-like types.
//
// This is only relevant to ipc Reader objects, not to writers. This defaults
// to true.
func WithEnsureNativeEndian(v bool) Option {
	return func(cfg *config) {
		cfg.ensureNativeEndian = v
	}
}

// WithDelayedReadSchema alters the ipc.Reader behavior to delay attempting
// to read the schema from the stream until the first call to Next instead
// of immediately attempting to read a schema from the stream when created.
func WithDelayReadSchema(v bool) Option {
	return func(cfg *config) {
		cfg.noAutoSchema = v
	}
}

// WithDictionaryDeltas specifies whether or not to emit dictionary deltas.
func WithDictionaryDeltas(v bool) Option {
	return func(cfg *config) {
		cfg.emitDictDeltas = v
	}
}

// WithMinSpaceSavings specifies a percentage of space savings for
// compression to be applied to buffers.
//
// Space savings is calculated as (1.0 - compressedSize / uncompressedSize).
//
// For example, if minSpaceSavings = 0.1, a 100-byte body buffer won't
// undergo compression if its expected compressed size exceeds 90 bytes.
// If this option is unset, compression will be used indiscriminately. If
// no codec was supplied, this option is ignored.
//
// Values outside of the range [0,1] are handled as errors.
//
// Note that enabling this option may result in unreadable data for Arrow
// Go and C++ versions prior to 12.0.0.
func WithMinSpaceSavings(savings float64) Option {
	return func(cfg *config) {
		cfg.minSpaceSavings = &savings
	}
}

var (
	_ arrio.Reader = (*Reader)(nil)
	_ arrio.Writer = (*Writer)(nil)
	_ arrio.Reader = (*FileReader)(nil)
	_ arrio.Writer = (*FileWriter)(nil)

	_ arrio.ReaderAt = (*FileReader)(nil)
)
