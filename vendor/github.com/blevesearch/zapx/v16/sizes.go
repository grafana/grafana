//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package zap

import (
	"reflect"
)

func init() {
	var b bool
	SizeOfBool = int(reflect.TypeOf(b).Size())
	var f32 float32
	SizeOfFloat32 = int(reflect.TypeOf(f32).Size())
	var f64 float64
	SizeOfFloat64 = int(reflect.TypeOf(f64).Size())
	var i int
	SizeOfInt = int(reflect.TypeOf(i).Size())
	var m map[int]int
	SizeOfMap = int(reflect.TypeOf(m).Size())
	var ptr *int
	SizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var slice []int
	SizeOfSlice = int(reflect.TypeOf(slice).Size())
	var str string
	SizeOfString = int(reflect.TypeOf(str).Size())
	var u8 uint8
	SizeOfUint8 = int(reflect.TypeOf(u8).Size())
	var u16 uint16
	SizeOfUint16 = int(reflect.TypeOf(u16).Size())
	var u32 uint32
	SizeOfUint32 = int(reflect.TypeOf(u32).Size())
	var u64 uint64
	SizeOfUint64 = int(reflect.TypeOf(u64).Size())
}

var SizeOfBool int
var SizeOfFloat32 int
var SizeOfFloat64 int
var SizeOfInt int
var SizeOfMap int
var SizeOfPtr int
var SizeOfSlice int
var SizeOfString int
var SizeOfUint8 int
var SizeOfUint16 int
var SizeOfUint32 int
var SizeOfUint64 int
