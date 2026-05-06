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
	enc, _ := zstd.NewWriter(nil, zstd.WithZeroFrames(true), zstd.WithEncoderLevel(compressLevel))
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
