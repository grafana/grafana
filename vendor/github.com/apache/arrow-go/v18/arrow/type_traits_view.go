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

package arrow

import (
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/endian"
)

var ViewHeaderTraits viewHeaderTraits

const (
	ViewHeaderSizeBytes = int(unsafe.Sizeof(ViewHeader{}))
)

type viewHeaderTraits struct{}

func (viewHeaderTraits) BytesRequired(n int) int { return ViewHeaderSizeBytes * n }

func (viewHeaderTraits) PutValue(b []byte, v ViewHeader) {
	endian.Native.PutUint32(b, uint32(v.size))
	copy(b[4:], v.data[:])
}

func (viewHeaderTraits) CastFromBytes(b []byte) (res []ViewHeader) {
	return GetData[ViewHeader](b)
}

func (viewHeaderTraits) CastToBytes(b []ViewHeader) (res []byte) {
	return GetBytes(b)
}

func (viewHeaderTraits) Copy(dst, src []ViewHeader) { copy(dst, src) }
