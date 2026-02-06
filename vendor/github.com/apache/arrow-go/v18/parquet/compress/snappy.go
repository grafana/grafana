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

	"github.com/golang/snappy"
)

type snappyCodec struct{}

func (snappyCodec) Encode(dst, src []byte) []byte {
	return snappy.Encode(dst, src)
}

func (snappyCodec) EncodeLevel(dst, src []byte, _ int) []byte {
	return snappy.Encode(dst, src)
}

func (snappyCodec) Decode(dst, src []byte) []byte {
	dst, err := snappy.Decode(dst, src)
	if err != nil {
		panic(err)
	}
	return dst
}

func (snappyCodec) NewReader(r io.Reader) io.ReadCloser {
	return io.NopCloser(snappy.NewReader(r))
}

func (snappyCodec) CompressBound(len int64) int64 {
	return int64(snappy.MaxEncodedLen(int(len)))
}

func (snappyCodec) NewWriter(w io.Writer) io.WriteCloser {
	return snappy.NewBufferedWriter(w)
}

func (s snappyCodec) NewWriterLevel(w io.Writer, _ int) (io.WriteCloser, error) {
	return s.NewWriter(w), nil
}

func init() {
	RegisterCodec(Codecs.Snappy, snappyCodec{})
}
