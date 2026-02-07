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

//go:build s390x

package encoding

import (
	"bytes"
	"encoding/binary"

	"github.com/apache/arrow-go/v18/parquet"
)

func writeLE[T fixedLenTypes](enc *encoder, in []T) {
	var z T
	switch any(z).(type) {
	case parquet.Int96:
		enc.append(getBytes(in))
	default:
		binary.Write(enc.sink, binary.LittleEndian, in)
	}
}

func copyFrom[T fixedLenTypes](dst []T, src []byte) {
	var z T
	switch any(z).(type) {
	case parquet.Int96:
		copy(dst, fromBytes[T](src))
	default:
		r := bytes.NewReader(src)
		binary.Read(r, binary.LittleEndian, dst)
	}
}
