// Copyright 2021-2024 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package connect

import (
	"bytes"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
)

const (
	compressionGzip     = "gzip"
	compressionIdentity = "identity"
)

// A Decompressor is a reusable wrapper that decompresses an underlying data
// source. The standard library's [*gzip.Reader] implements Decompressor.
type Decompressor interface {
	io.Reader

	// Close closes the Decompressor, but not the underlying data source. It may
	// return an error if the Decompressor wasn't read to EOF.
	Close() error

	// Reset discards the Decompressor's internal state, if any, and prepares it
	// to read from a new source of compressed data.
	Reset(io.Reader) error
}

// A Compressor is a reusable wrapper that compresses data written to an
// underlying sink. The standard library's [*gzip.Writer] implements Compressor.
type Compressor interface {
	io.Writer

	// Close flushes any buffered data to the underlying sink, then closes the
	// Compressor. It must not close the underlying sink.
	Close() error

	// Reset discards the Compressor's internal state, if any, and prepares it to
	// write compressed data to a new sink.
	Reset(io.Writer)
}

type compressionPool struct {
	decompressors sync.Pool
	compressors   sync.Pool
}

func newCompressionPool(
	newDecompressor func() Decompressor,
	newCompressor func() Compressor,
) *compressionPool {
	if newDecompressor == nil && newCompressor == nil {
		return nil
	}
	return &compressionPool{
		decompressors: sync.Pool{
			New: func() any { return newDecompressor() },
		},
		compressors: sync.Pool{
			New: func() any { return newCompressor() },
		},
	}
}

func (c *compressionPool) Decompress(dst *bytes.Buffer, src *bytes.Buffer, readMaxBytes int64) *Error {
	decompressor, err := c.getDecompressor(src)
	if err != nil {
		return errorf(CodeInvalidArgument, "get decompressor: %w", err)
	}
	reader := io.Reader(decompressor)
	if readMaxBytes > 0 && readMaxBytes < math.MaxInt64 {
		reader = io.LimitReader(decompressor, readMaxBytes+1)
	}
	bytesRead, err := dst.ReadFrom(reader)
	if err != nil {
		_ = c.putDecompressor(decompressor)
		err = wrapIfContextError(err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeInvalidArgument, "decompress: %w", err)
	}
	if readMaxBytes > 0 && bytesRead > readMaxBytes {
		discardedBytes, err := io.Copy(io.Discard, decompressor)
		_ = c.putDecompressor(decompressor)
		if err != nil {
			return errorf(CodeResourceExhausted, "message is larger than configured max %d - unable to determine message size: %w", readMaxBytes, err)
		}
		return errorf(CodeResourceExhausted, "message size %d is larger than configured max %d", bytesRead+discardedBytes, readMaxBytes)
	}
	if err := c.putDecompressor(decompressor); err != nil {
		return errorf(CodeUnknown, "recycle decompressor: %w", err)
	}
	return nil
}

func (c *compressionPool) Compress(dst *bytes.Buffer, src *bytes.Buffer) *Error {
	compressor, err := c.getCompressor(dst)
	if err != nil {
		return errorf(CodeUnknown, "get compressor: %w", err)
	}
	if _, err := src.WriteTo(compressor); err != nil {
		_ = c.putCompressor(compressor)
		err = wrapIfContextError(err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeInternal, "compress: %w", err)
	}
	if err := c.putCompressor(compressor); err != nil {
		return errorf(CodeInternal, "recycle compressor: %w", err)
	}
	return nil
}

func (c *compressionPool) getDecompressor(reader io.Reader) (Decompressor, error) {
	decompressor, ok := c.decompressors.Get().(Decompressor)
	if !ok {
		return nil, errors.New("expected Decompressor, got incorrect type from pool")
	}
	return decompressor, decompressor.Reset(reader)
}

func (c *compressionPool) putDecompressor(decompressor Decompressor) error {
	if err := decompressor.Close(); err != nil {
		return err
	}
	// While it's in the pool, we don't want the decompressor to retain a
	// reference to the underlying reader. However, most decompressors attempt to
	// read some header data from the new data source when Reset; since we don't
	// know the compression format, we can't provide a valid header. Since we
	// also reset the decompressor when it's pulled out of the pool, we can
	// ignore errors here.
	_ = decompressor.Reset(http.NoBody)
	c.decompressors.Put(decompressor)
	return nil
}

func (c *compressionPool) getCompressor(writer io.Writer) (Compressor, error) {
	compressor, ok := c.compressors.Get().(Compressor)
	if !ok {
		return nil, errors.New("expected Compressor, got incorrect type from pool")
	}
	compressor.Reset(writer)
	return compressor, nil
}

func (c *compressionPool) putCompressor(compressor Compressor) error {
	if err := compressor.Close(); err != nil {
		return err
	}
	compressor.Reset(io.Discard) // don't keep references
	c.compressors.Put(compressor)
	return nil
}

// readOnlyCompressionPools is a read-only interface to a map of named
// compressionPools.
type readOnlyCompressionPools interface {
	Get(string) *compressionPool
	Contains(string) bool
	// Wordy, but clarifies how this is different from readOnlyCodecs.Names().
	CommaSeparatedNames() string
}

func newReadOnlyCompressionPools(
	nameToPool map[string]*compressionPool,
	reversedNames []string,
) readOnlyCompressionPools {
	// Client and handler configs keep compression names in registration order,
	// but we want the last registered to be the most preferred.
	names := make([]string, 0, len(reversedNames))
	seen := make(map[string]struct{}, len(reversedNames))
	for i := len(reversedNames) - 1; i >= 0; i-- {
		name := reversedNames[i]
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	return &namedCompressionPools{
		nameToPool:          nameToPool,
		commaSeparatedNames: strings.Join(names, ","),
	}
}

type namedCompressionPools struct {
	nameToPool          map[string]*compressionPool
	commaSeparatedNames string
}

func (m *namedCompressionPools) Get(name string) *compressionPool {
	if name == "" || name == compressionIdentity {
		return nil
	}
	return m.nameToPool[name]
}

func (m *namedCompressionPools) Contains(name string) bool {
	_, ok := m.nameToPool[name]
	return ok
}

func (m *namedCompressionPools) CommaSeparatedNames() string {
	return m.commaSeparatedNames
}
