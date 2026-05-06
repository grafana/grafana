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
	var i int
	sizeOfInt = int(reflect.TypeOf(i).Size())
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())

	var pi postingsIterator
	reflectStaticSizeIndexSnapshotTermFieldReader = int(reflect.TypeOf(pi).Size())
	var pia postingsIteratorAll
	reflectStaticSizeIndexSnapshotDocIDReader = int(reflect.TypeOf(pia).Size())
	var is interface{} = Snapshot{}
	reflectStaticSizeIndexSnapshot = int(reflect.TypeOf(is).Size())
	var pib unadornedPostingsIteratorBitmap
	reflectStaticSizeUnadornedPostingsIteratorBitmap = int(reflect.TypeOf(pib).Size())
	var pi1h unadornedPostingsIterator1Hit
	reflectStaticSizeUnadornedPostingsIterator1Hit = int(reflect.TypeOf(pi1h).Size())
	var up unadornedPosting
	reflectStaticSizeUnadornedPosting = int(reflect.TypeOf(up).Size())
}

var sizeOfInt int
var sizeOfPtr int

var reflectStaticSizeIndexSnapshotTermFieldReader int
var reflectStaticSizeIndexSnapshotDocIDReader int
var reflectStaticSizeIndexSnapshot int
var reflectStaticSizeUnadornedPostingsIteratorBitmap int
var reflectStaticSizeUnadornedPostingsIterator1Hit int
var reflectStaticSizeUnadornedPosting int
