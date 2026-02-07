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

package compress

import (
	"io"
	"sync"

	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/klauspost/compress/zstd"
)

type zstdCodec struct{}

type zstdcloser struct {
	*zstd.Decoder
}

var (
	enc         *zstd.Encoder
	dec         *zstd.Decoder
	initEncoder sync.Once
	initDecoder sync.Once
)

// zstdEncoderPool manages a pool of zstd encoders for different compression levels
// to avoid the expensive encoder initialization on every compression operation.
type zstdEncoderPool struct {
	pools map[zstd.EncoderLevel]*sync.Pool
	mu    sync.RWMutex
}

var globalEncoderPool = &zstdEncoderPool{
	pools: make(map[zstd.EncoderLevel]*sync.Pool),
}

// getEncoderFromPool retrieves an encoder from the pool for the specified compression level,
// creating a new pool for that level if it doesn't exist.
func (p *zstdEncoderPool) getEncoderFromPool(level zstd.EncoderLevel) *zstd.Encoder {
	// Fast path: try to get pool without lock
	p.mu.RLock()
	pool, ok := p.pools[level]
	p.mu.RUnlock()

	if !ok {
		// Slow path: create new pool for this level
		p.mu.Lock()
		// Double-check after acquiring write lock
		pool, ok = p.pools[level]
		if !ok {
			pool = &sync.Pool{
				New: func() interface{} {
					enc, _ := zstd.NewWriter(nil, zstd.WithZeroFrames(true), zstd.WithEncoderLevel(level))
					return enc
				},
			}
			p.pools[level] = pool
		}
		p.mu.Unlock()
	}

	return pool.Get().(*zstd.Encoder)
}

// putEncoderToPool returns an encoder to the pool after use.
func (p *zstdEncoderPool) putEncoderToPool(enc *zstd.Encoder, level zstd.EncoderLevel) {
	p.mu.RLock()
	pool, ok := p.pools[level]
	p.mu.RUnlock()

	if ok {
		// Reset encoder state before returning to pool to prevent memory leaks
		// and ensure clean state for next use
		enc.Reset(nil)
		pool.Put(enc)
	}
}

func getencoder() *zstd.Encoder {
	initEncoder.Do(func() {
		enc, _ = zstd.NewWriter(nil, zstd.WithZeroFrames(true))
	})
	return enc
}

func getdecoder() *zstd.Decoder {
	initDecoder.Do(func() {
		dec, _ = zstd.NewReader(nil)
	})
	return dec
}

func (zstdCodec) Decode(dst, src []byte) []byte {
	dst, err := getdecoder().DecodeAll(src, dst[:0])
	if err != nil {
		panic(err)
	}
	return dst
}

func (z *zstdcloser) Close() error {
	z.Decoder.Close()
	return nil
}

func (zstdCodec) NewReader(r io.Reader) io.ReadCloser {
	ret, _ := zstd.NewReader(r)
	return &zstdcloser{ret}
}

func (zstdCodec) NewWriter(w io.Writer) io.WriteCloser {
	ret, _ := zstd.NewWriter(w)
	return ret
}

func (zstdCodec) NewWriterLevel(w io.Writer, level int) (io.WriteCloser, error) {
	var compressLevel zstd.EncoderLevel
	if level == DefaultCompressionLevel {
		compressLevel = zstd.SpeedDefault
	} else {
		compressLevel = zstd.EncoderLevelFromZstd(level)
	}
	return zstd.NewWriter(w, zstd.WithEncoderLevel(compressLevel))
}

func (z zstdCodec) Encode(dst, src []byte) []byte {
	return getencoder().EncodeAll(src, dst[:0])
}

func (z zstdCodec) EncodeLevel(dst, src []byte, level int) []byte {
	compressLevel := zstd.EncoderLevelFromZstd(level)
	if level == DefaultCompressionLevel {
		compressLevel = zstd.SpeedDefault
	}

	// Get encoder from pool
	enc := globalEncoderPool.getEncoderFromPool(compressLevel)
	defer globalEncoderPool.putEncoderToPool(enc, compressLevel)

	return enc.EncodeAll(src, dst[:0])
}

// from zstd.h, ZSTD_COMPRESSBOUND
func (zstdCodec) CompressBound(len int64) int64 {
	debug.Assert(len > 0, "len for zstd CompressBound should be > 0")
	extra := ((128 << 10) - len) >> 11
	if len >= (128 << 10) {
		extra = 0
	}
	return len + (len >> 8) + extra
}

func init() {
	RegisterCodec(Codecs.Zstd, zstdCodec{})
}
