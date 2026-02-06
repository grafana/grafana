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

//go:build !noasm
// +build !noasm

package utils

import (
	"bytes"
	"io"
	"sync"
	"unsafe"
)

var bufferPool = sync.Pool{New: func() interface{} { return &bytes.Buffer{} }}

//go:noescape
func _unpack32_neon(in, out unsafe.Pointer, batchSize, nbits int) (num int)

func unpack32NEON(in io.Reader, out []uint32, nbits int) int {
	batch := len(out) / 32 * 32
	n := batch * nbits / 8
	if n <= 0 {
		return 0
	}

	buffer := bufferPool.Get().(*bytes.Buffer)
	defer bufferPool.Put(buffer)
	buffer.Reset()
	buffer.Grow(n)
	io.CopyN(buffer, in, int64(n))

	var (
		input  = unsafe.Pointer(&buffer.Bytes()[0])
		output = unsafe.Pointer(&out[0])
	)

	return _unpack32_neon(input, output, len(out), nbits)
}
