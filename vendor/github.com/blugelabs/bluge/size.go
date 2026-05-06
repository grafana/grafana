//  Copyright (c) 2020 The Bluge Authors.
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

package bluge

import (
	"reflect"

	"github.com/blugelabs/bluge/search"
)

var documentMatchEmptySize int
var searchContextEmptySize int
var reflectStaticSizeBaseField int
var sizeOfSlice int
var sizeOfString int
var sizeOfPtr int
var sizeOfBool int

func init() {
	var dm search.DocumentMatch
	documentMatchEmptySize = dm.Size()
	var sc search.Context
	searchContextEmptySize = sc.Size()
	var f TermField
	reflectStaticSizeBaseField = int(reflect.TypeOf(f).Size())
	var slice []int
	sizeOfSlice = int(reflect.TypeOf(slice).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var b bool
	sizeOfBool = int(reflect.TypeOf(b).Size())
}
