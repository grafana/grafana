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

//go:build go1.18 && !noasm

package kernels

import (
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"golang.org/x/sys/cpu"
)

//go:noescape
func _cast_type_numeric_neon(itype, otype int, in, out unsafe.Pointer, len int)

func castNumericNeon(itype, otype arrow.Type, in, out []byte, len int) {
	_cast_type_numeric_neon(int(itype), int(otype), unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len)
}

func init() {
	if cpu.ARM64.HasASIMD {
		castNumericUnsafe = castNumericNeon
	} else {
		castNumericUnsafe = castNumericGo
	}
}
