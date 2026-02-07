//  Copyright (c) 2017 Couchbase, Inc.
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

package scorch

import (
	"bytes"
	"reflect"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeIndexSnapshotDocIDReader int

func init() {
	var isdr IndexSnapshotDocIDReader
	reflectStaticSizeIndexSnapshotDocIDReader = int(reflect.TypeOf(isdr).Size())
}

type IndexSnapshotDocIDReader struct {
	snapshot      *IndexSnapshot
	iterators     []roaring.IntIterable
	segmentOffset int
}

func (i *IndexSnapshotDocIDReader) Size() int {
	return reflectStaticSizeIndexSnapshotDocIDReader + size.SizeOfPtr
}

func (i *IndexSnapshotDocIDReader) Next() (index.IndexInternalID, error) {
	for i.segmentOffset < len(i.iterators) {
		if !i.iterators[i.segmentOffset].HasNext() {
			i.segmentOffset++
			continue
		}
		next := i.iterators[i.segmentOffset].Next()
		// make segment number into global number by adding offset
		globalOffset := i.snapshot.offsets[i.segmentOffset]
		return docNumberToBytes(nil, uint64(next)+globalOffset), nil
	}
	return nil, nil
}

func (i *IndexSnapshotDocIDReader) Advance(ID index.IndexInternalID) (index.IndexInternalID, error) {
	// FIXME do something better
	next, err := i.Next()
	if err != nil {
		return nil, err
	}
	if next == nil {
		return nil, nil
	}
	for bytes.Compare(next, ID) < 0 {
		next, err = i.Next()
		if err != nil {
			return nil, err
		}
		if next == nil {
			break
		}
	}
	return next, nil
}

func (i *IndexSnapshotDocIDReader) Close() error {
	return nil
}
