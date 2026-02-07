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

package index

import (
	"reflect"
)

func init() {
	var m map[int]int
	sizeOfMap = int(reflect.TypeOf(m).Size())
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())
	var u64 uint64
	sizeOfUint64 = int(reflect.TypeOf(u64).Size())
}

var sizeOfMap int
var sizeOfPtr int
var sizeOfString int
var sizeOfUint64 int
