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

package ice

import (
	"reflect"
)

func init() {
	var ptr *int
	sizeOfPtr = int(reflect.TypeOf(ptr).Size())
	var str string
	sizeOfString = int(reflect.TypeOf(str).Size())
	var u16 uint16
	sizeOfUint16 = int(reflect.TypeOf(u16).Size())
	var u32 uint32
	sizeOfUint32 = int(reflect.TypeOf(u32).Size())
	var u64 uint64
	sizeOfUint64 = int(reflect.TypeOf(u64).Size())
	reflectStaticSizeSegment = int(reflect.TypeOf(Segment{}).Size())
	var md metaData
	reflectStaticSizeMetaData = int(reflect.TypeOf(md).Size())
	var dvi docValueReader
	reflectStaticSizedocValueReader = int(reflect.TypeOf(dvi).Size())
	var pl PostingsList
	reflectStaticSizePostingsList = int(reflect.TypeOf(pl).Size())
	var pi PostingsIterator
	reflectStaticSizePostingsIterator = int(reflect.TypeOf(pi).Size())
	var p Posting
	reflectStaticSizePosting = int(reflect.TypeOf(p).Size())
	var l Location
	reflectStaticSizeLocation = int(reflect.TypeOf(l).Size())
}

var sizeOfPtr int
var sizeOfString int
var sizeOfUint16 int
var sizeOfUint32 int
var sizeOfUint64 int
var reflectStaticSizeSegment int
var reflectStaticSizeMetaData int
var reflectStaticSizedocValueReader int
var reflectStaticSizePostingsList int
var reflectStaticSizePostingsIterator int
var reflectStaticSizePosting int
var reflectStaticSizeLocation int
