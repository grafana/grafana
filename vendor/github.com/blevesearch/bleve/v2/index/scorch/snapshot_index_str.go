//  Copyright (c) 2024 Couchbase, Inc.
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
	"reflect"

	"github.com/blevesearch/bleve/v2/size"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

var reflectStaticSizeIndexSnapshotThesaurusTermReader int

func init() {
	var istr IndexSnapshotThesaurusTermReader
	reflectStaticSizeIndexSnapshotThesaurusTermReader = int(reflect.TypeOf(istr).Size())
}

type IndexSnapshotThesaurusTermReader struct {
	name          string
	snapshot      *IndexSnapshot
	thesauri      []segment.Thesaurus
	postings      []segment.SynonymsList
	iterators     []segment.SynonymsIterator
	segmentOffset int
}

func (i *IndexSnapshotThesaurusTermReader) Size() int {
	sizeInBytes := reflectStaticSizeIndexSnapshotThesaurusTermReader + size.SizeOfPtr +
		len(i.name) + size.SizeOfString

	for _, postings := range i.postings {
		if postings != nil {
			sizeInBytes += postings.Size()
		}
	}

	for _, iterator := range i.iterators {
		if iterator != nil {
			sizeInBytes += iterator.Size()
		}
	}

	return sizeInBytes
}

func (i *IndexSnapshotThesaurusTermReader) Next() (string, error) {
	// find the next hit
	for i.segmentOffset < len(i.iterators) {
		if i.iterators[i.segmentOffset] != nil {
			next, err := i.iterators[i.segmentOffset].Next()
			if err != nil {
				return "", err
			}
			if next != nil {
				synTerm := next.Term()
				return synTerm, nil
			}
		}
		i.segmentOffset++
	}
	return "", nil
}

func (i *IndexSnapshotThesaurusTermReader) Close() error {
	return nil
}
