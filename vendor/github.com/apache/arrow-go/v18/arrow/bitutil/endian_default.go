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

//go:build !s390x
// +build !s390x

package bitutil

import (
	"unsafe"
)

var toFromLEFunc = func(in uint64) uint64 { return in }

func getLSB(v uint64) byte {
	return (*[8]byte)(unsafe.Pointer(&v))[0]
}

func setLSB(v *uint64, b byte) {
	(*[8]byte)(unsafe.Pointer(v))[0] = b
}
