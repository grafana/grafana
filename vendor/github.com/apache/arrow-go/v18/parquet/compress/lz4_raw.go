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
	"sync"

	"github.com/pierrec/lz4/v4"
)

// lz4.Compressor is not goroutine-safe, so we use a pool to amortize the cost
// of allocating a new one for each call to Encode().
var compressorPool = sync.Pool{New: func() interface{} { return new(lz4.Compressor) }}

func compressBlock(src, dst []byte) (int, error) {
	c := compressorPool.Get().(*lz4.Compressor)
	defer compressorPool.Put(c)
	return c.CompressBlock(src, dst)
}

type lz4RawCodec struct{}

func (c lz4RawCodec) Encode(dst, src []byte) []byte {
	n, err := compressBlock(src, dst[:cap(dst)])
	if err != nil {
		panic(err)
	}

	return dst[:n]
}

func (c lz4RawCodec) EncodeLevel(dst, src []byte, _ int) []byte {
	// the lz4 block implementation does not allow level to be set
	return c.Encode(dst, src)
}

func (lz4RawCodec) Decode(dst, src []byte) []byte {
	n, err := lz4.UncompressBlock(src, dst)
	if err != nil {
		panic(err)
	}

	return dst[:n]
}

func (c lz4RawCodec) CompressBound(len int64) int64 {
	return int64(lz4.CompressBlockBound(int(len)))
}

func init() {
	RegisterCodec(Codecs.Lz4Raw, lz4RawCodec{})
}
