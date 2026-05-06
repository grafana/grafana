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
	"fmt"
	"io"

	"github.com/klauspost/compress/gzip"
)

type gzipCodec struct{}

func (gzipCodec) NewReader(r io.Reader) io.ReadCloser {
	ret, err := gzip.NewReader(r)
	if err != nil {
		panic(fmt.Errorf("codec: gzip: %w", err))
	}
	return ret
}

func (gzipCodec) Decode(dst, src []byte) []byte {
	rdr, err := gzip.NewReader(bytes.NewReader(src))
	if err != nil {
		panic(err)
	}

	if dst != nil {
		n, err := io.ReadFull(rdr, dst)
		if err != nil {
			panic(err)
		}
		return dst[:n]
	}

	dst, err = io.ReadAll(rdr)
	if err != nil {
		panic(err)
	}

	return dst
}

func (g gzipCodec) EncodeLevel(dst, src []byte, level int) []byte {
	maxlen := int(g.CompressBound(int64(len(src))))
	if dst == nil || cap(dst) < maxlen {
		dst = make([]byte, 0, maxlen)
	}
	buf := bytes.NewBuffer(dst[:0])
	w, err := gzip.NewWriterLevel(buf, level)
	if err != nil {
		panic(err)
	}
	_, err = w.Write(src)
	if err != nil {
		panic(err)
	}
	if err := w.Close(); err != nil {
		panic(err)
	}
	return buf.Bytes()
}

func (g gzipCodec) Encode(dst, src []byte) []byte {
	return g.EncodeLevel(dst, src, DefaultCompressionLevel)
}

func (gzipCodec) CompressBound(len int64) int64 {
	return len + ((len + 7) >> 3) + ((len + 63) >> 6) + 5
}

func (gzipCodec) NewWriter(w io.Writer) io.WriteCloser {
	return gzip.NewWriter(w)
}

func (gzipCodec) NewWriterLevel(w io.Writer, level int) (io.WriteCloser, error) {
	return gzip.NewWriterLevel(w, level)
}

func init() {
	RegisterCodec(Codecs.Gzip, gzipCodec{})
}
