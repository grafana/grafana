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

package search

import (
	"reflect"
)

func init() {
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())
	var slice []int
	sizeOfSlice = int(reflect.TypeOf(slice).Size())
	var e Explanation
	reflectStaticSizeExplanation = int(reflect.TypeOf(e).Size())
	var dm DocumentMatch
	reflectStaticSizeDocumentMatch = int(reflect.TypeOf(dm).Size())
	var sc Context
	reflectStaticSizeSearchContext = int(reflect.TypeOf(sc).Size())
	var l Location
	reflectStaticSizeLocation = int(reflect.TypeOf(l).Size())
	var dmp DocumentMatchPool
	reflectStaticSizeDocumentMatchPool = int(reflect.TypeOf(dmp).Size())
}

var sizeOfPtr int
var sizeOfString int
var sizeOfSlice int

var reflectStaticSizeExplanation int
var reflectStaticSizeDocumentMatch int
var reflectStaticSizeSearchContext int
var reflectStaticSizeLocation int
var reflectStaticSizeDocumentMatchPool int
