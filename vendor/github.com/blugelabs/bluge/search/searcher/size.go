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

package searcher

import (
	"reflect"
)

func init() {
	var i int
	sizeOfInt = int(reflect.TypeOf(i).Size())
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var slice []int
	sizeOfSlice = int(reflect.TypeOf(slice).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())

	var bs BooleanSearcher
	reflectStaticSizeBooleanSearcher = int(reflect.TypeOf(bs).Size())
	var cs ConjunctionSearcher
	reflectStaticSizeConjunctionSearcher = int(reflect.TypeOf(cs).Size())
	var dhs DisjunctionHeapSearcher
	reflectStaticSizeDisjunctionHeapSearcher = int(reflect.TypeOf(dhs).Size())
	var sc searcherCurr
	reflectStaticSizeSearcherCurr = int(reflect.TypeOf(sc).Size())
	var ds DisjunctionSliceSearcher
	reflectStaticSizeDisjunctionSliceSearcher = int(reflect.TypeOf(ds).Size())
	var fs FilteringSearcher
	reflectStaticSizeFilteringSearcher = int(reflect.TypeOf(fs).Size())
	var mas MatchAllSearcher
	reflectStaticSizeMatchAllSearcher = int(reflect.TypeOf(mas).Size())
	var mns MatchNoneSearcher
	reflectStaticSizeMatchNoneSearcher = int(reflect.TypeOf(mns).Size())
	var ps PhraseSearcher
	reflectStaticSizePhraseSearcher = int(reflect.TypeOf(ps).Size())
	var ts TermSearcher
	reflectStaticSizeTermSearcher = int(reflect.TypeOf(ts).Size())
}

var sizeOfInt int
var sizeOfPtr int
var sizeOfSlice int
var sizeOfString int

var reflectStaticSizeBooleanSearcher int
var reflectStaticSizeConjunctionSearcher int
var reflectStaticSizeDisjunctionHeapSearcher int
var reflectStaticSizeSearcherCurr int
var reflectStaticSizeDisjunctionSliceSearcher int
var reflectStaticSizeFilteringSearcher int
var reflectStaticSizeMatchAllSearcher int
var reflectStaticSizeMatchNoneSearcher int
var reflectStaticSizePhraseSearcher int
var reflectStaticSizeTermSearcher int
