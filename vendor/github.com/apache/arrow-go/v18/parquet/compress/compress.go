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

// Package compress contains the interfaces and implementations for handling compression/decompression
// of parquet data at the column levels.
package compress

import (
	"compress/flate"
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
)

// Compression is an alias to the thrift compression codec enum type for easy use
type Compression parquet.CompressionCodec

func (c Compression) String() string {
	return parquet.CompressionCodec(c).String()
}

func (c Compression) MarshalText() ([]byte, error) {
	return parquet.CompressionCodec(c).MarshalText()
}

func (c *Compression) UnmarshalText(text []byte) error {
	return (*parquet.CompressionCodec)(c).UnmarshalText(text)
}

// DefaultCompressionLevel will use flate.DefaultCompression since many of the compression libraries
// use that to denote "use the default".
const DefaultCompressionLevel = flate.DefaultCompression

// Codecs is a useful struct to provide namespaced enum values to use for specifying the compression type to use
// which make for easy internal swapping between them and the thrift enum since they are initialized to the same
// constant values.
var Codecs = struct {
	Uncompressed Compression
	Snappy       Compression
	Gzip         Compression
	// LZO is unsupported in this library since LZO license is incompatible with Apache License
	Lzo    Compression
	Brotli Compression
	// LZ4 unsupported in this library due to problematic issues between the Hadoop LZ4 spec vs regular lz4
	// see: http://mail-archives.apache.org/mod_mbox/arrow-dev/202007.mbox/%3CCAAri41v24xuA8MGHLDvgSnE+7AAgOhiEukemW_oPNHMvfMmrWw@mail.gmail.com%3E
	Lz4    Compression
	Zstd   Compression
	Lz4Raw Compression
}{
	Uncompressed: Compression(parquet.CompressionCodec_UNCOMPRESSED),
	Snappy:       Compression(parquet.CompressionCodec_SNAPPY),
	Gzip:         Compression(parquet.CompressionCodec_GZIP),
	Lzo:          Compression(parquet.CompressionCodec_LZO),
	Brotli:       Compression(parquet.CompressionCodec_BROTLI),
	Lz4:          Compression(parquet.CompressionCodec_LZ4),
	Zstd:         Compression(parquet.CompressionCodec_ZSTD),
	Lz4Raw:       Compression(parquet.CompressionCodec_LZ4_RAW),
}

// Codec is an interface which is implemented for each compression type in order to make the interactions easy to
// implement. Most consumers won't be calling GetCodec directly.
type Codec interface {
	// Encode encodes a block of data given by src and returns the compressed block. dst should be either nil
	// or sized large enough to fit the compressed block (use CompressBound to allocate). dst and src should not
	// overlap since some of the compression types don't allow it.
	//
	// The returned slice will be one of the following:
	//	1. If dst was nil or dst was too small to fit the compressed data, it will be a newly allocated slice
	//	2. If dst was large enough to fit the compressed data (depending on the compression algorithm it might
	//		 be required to be at least CompressBound length) then it might be a slice of dst.
	Encode(dst, src []byte) []byte
	// EncodeLevel is like Encode, but specifies a particular encoding level instead of the default.
	EncodeLevel(dst, src []byte, level int) []byte
	// CompressBound returns the boundary of maximum size of compressed data under the chosen codec.
	CompressBound(int64) int64
	// Decode is for decoding a single block rather than a stream, like with Encode, dst must be either nil or
	// sized large enough to accommodate the uncompressed data and should not overlap with src.
	//
	// the returned slice *might* be a slice of dst.
	Decode(dst, src []byte) []byte
}

// StreamingCodec is an interface that may be implemented for compression codecs that expose a streaming API.
type StreamingCodec interface {
	// NewReader provides a reader that wraps a stream with compressed data to stream the uncompressed data
	NewReader(io.Reader) io.ReadCloser
	// NewWriter provides a wrapper around a write stream to compress data before writing it.
	NewWriter(io.Writer) io.WriteCloser
	// NewWriterLevel is like NewWriter but allows specifying the compression level
	NewWriterLevel(io.Writer, int) (io.WriteCloser, error)
}

var codecs = map[Compression]Codec{}

// RegisterCodec adds or overrides a codec implementation for a given compression algorithm.
// The intended use case is within the init() section of a package. For example,
//
//	// inside a custom codec package, say czstd
//
//	func init() {
//	    RegisterCodec(compress.Codecs.Zstd, czstdCodec{})
//	}
//
//	type czstdCodec struct{} // implementing Codec interface using CGO based ZSTD wrapper
//
// And user of the custom codec can import the above package like below,
//
//	package main
//
//	import _ "package/path/to/czstd"
func RegisterCodec(compression Compression, codec Codec) {
	codecs[compression] = codec
}

type nocodec struct{}

func (nocodec) NewReader(r io.Reader) io.ReadCloser {
	ret, ok := r.(io.ReadCloser)
	if !ok {
		return io.NopCloser(r)
	}
	return ret
}

func (nocodec) Decode(dst, src []byte) []byte {
	if dst != nil {
		copy(dst, src)
	}
	return dst
}

type writerNopCloser struct {
	io.Writer
}

func (writerNopCloser) Close() error {
	return nil
}

func (nocodec) Encode(dst, src []byte) []byte {
	copy(dst, src)
	return dst
}

func (nocodec) EncodeLevel(dst, src []byte, _ int) []byte {
	copy(dst, src)
	return dst
}

func (nocodec) NewWriter(w io.Writer) io.WriteCloser {
	ret, ok := w.(io.WriteCloser)
	if !ok {
		return writerNopCloser{w}
	}
	return ret
}

func (n nocodec) NewWriterLevel(w io.Writer, _ int) (io.WriteCloser, error) {
	return n.NewWriter(w), nil
}

func (nocodec) CompressBound(len int64) int64 { return len }

func init() {
	codecs[Codecs.Uncompressed] = nocodec{}
}

// GetCodec returns a Codec interface for the requested Compression type
func GetCodec(typ Compression) (Codec, error) {
	ret, ok := codecs[typ]
	if !ok {
		return nil, fmt.Errorf("compression for %s unimplemented", typ.String())
	}
	return ret, nil
}
