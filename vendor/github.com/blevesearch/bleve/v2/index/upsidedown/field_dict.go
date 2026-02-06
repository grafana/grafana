//  Copyright (c) 2014 Couchbase, Inc.
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

package upsidedown

import (
	"fmt"

	index "github.com/blevesearch/bleve_index_api"
	store "github.com/blevesearch/upsidedown_store_api"
)

type UpsideDownCouchFieldDict struct {
	indexReader *IndexReader
	iterator    store.KVIterator
	dictRow     *DictionaryRow
	dictEntry   *index.DictEntry
	field       uint16
}

func newUpsideDownCouchFieldDict(indexReader *IndexReader, field uint16, startTerm, endTerm []byte) (*UpsideDownCouchFieldDict, error) {

	startKey := NewDictionaryRow(startTerm, field, 0).Key()
	if endTerm == nil {
		endTerm = []byte{ByteSeparator}
	} else {
		endTerm = incrementBytes(endTerm)
	}
	endKey := NewDictionaryRow(endTerm, field, 0).Key()

	it := indexReader.kvreader.RangeIterator(startKey, endKey)

	return &UpsideDownCouchFieldDict{
		indexReader: indexReader,
		iterator:    it,
		dictRow:     &DictionaryRow{},   // Pre-alloced, reused row.
		dictEntry:   &index.DictEntry{}, // Pre-alloced, reused entry.
		field:       field,
	}, nil

}

func (r *UpsideDownCouchFieldDict) BytesRead() uint64 {
	return 0
}

func (r *UpsideDownCouchFieldDict) Next() (*index.DictEntry, error) {
	key, val, valid := r.iterator.Current()
	if !valid {
		return nil, nil
	}

	err := r.dictRow.parseDictionaryK(key)
	if err != nil {
		return nil, fmt.Errorf("unexpected error parsing dictionary row key: %v", err)
	}
	err = r.dictRow.parseDictionaryV(val)
	if err != nil {
		return nil, fmt.Errorf("unexpected error parsing dictionary row val: %v", err)
	}
	r.dictEntry.Term = string(r.dictRow.term)
	r.dictEntry.Count = r.dictRow.count
	// advance the iterator to the next term
	r.iterator.Next()
	return r.dictEntry, nil

}

func (r *UpsideDownCouchFieldDict) Cardinality() int {
	return 0
}

func (r *UpsideDownCouchFieldDict) Close() error {
	return r.iterator.Close()
}
