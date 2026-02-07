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
	"bytes"
	"io"

	"github.com/andybalholm/brotli"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
)

type brotliCodec struct{}

func (brotliCodec) NewReader(r io.Reader) io.ReadCloser {
	return io.NopCloser(brotli.NewReader(r))
}

func (b brotliCodec) EncodeLevel(dst, src []byte, level int) []byte {
	if level == DefaultCompressionLevel {
		level = brotli.DefaultCompression
	}

	maxlen := int(b.CompressBound(int64(len(src))))
	if dst == nil || cap(dst) < maxlen {
		dst = make([]byte, 0, maxlen)
	}
	buf := bytes.NewBuffer(dst[:0])
	w := brotli.NewWriterLevel(buf, level)
	_, err := w.Write(src)
	if err != nil {
		panic(err)
	}
	if err := w.Close(); err != nil {
		panic(err)
	}
	return buf.Bytes()
}

func (b brotliCodec) Encode(dst, src []byte) []byte {
	return b.EncodeLevel(dst, src, brotli.DefaultCompression)
}

func (brotliCodec) Decode(dst, src []byte) []byte {
	rdr := brotli.NewReader(bytes.NewReader(src))
	if dst != nil {
		var (
			sofar       = 0
			n           = -1
			err   error = nil
		)
		for n != 0 && err == nil {
			n, err = rdr.Read(dst[sofar:])
			sofar += n
		}
		if err != nil && err != io.EOF {
			panic(err)
		}
		return dst[:sofar]
	}

	dst, err := io.ReadAll(rdr)
	if err != nil {
		panic(err)
	}

	return dst
}

// taken from brotli/enc/encode.c:1426
// BrotliEncoderMaxCompressedSize
func (brotliCodec) CompressBound(len int64) int64 {
	// [window bits / empty metadata] + N * [uncompressed] + [last empty]
	debug.Assert(len > 0, "brotli compressbound should be > 0")
	nlarge := len >> 14
	overhead := 2 + (4 * nlarge) + 3 + 1
	result := len + overhead
	if len == 0 {
		return 2
	}
	if result < len {
		return 0
	}
	return len
}

func (brotliCodec) NewWriter(w io.Writer) io.WriteCloser {
	return brotli.NewWriter(w)
}

func (brotliCodec) NewWriterLevel(w io.Writer, level int) (io.WriteCloser, error) {
	if level == DefaultCompressionLevel {
		level = brotli.DefaultCompression
	}
	return brotli.NewWriterLevel(w, level), nil
}

func init() {
	RegisterCodec(Codecs.Brotli, brotliCodec{})
}
