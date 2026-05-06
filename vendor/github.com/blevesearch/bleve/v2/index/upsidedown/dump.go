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
	"bytes"
	"sort"

	"github.com/blevesearch/upsidedown_store_api"
)

// the functions in this file are only intended to be used by
// the bleve_dump utility and the debug http handlers
// if your application relies on them, you're doing something wrong
// they may change or be removed at any time

func dumpPrefix(kvreader store.KVReader, rv chan interface{}, prefix []byte) {
	start := prefix
	if start == nil {
		start = []byte{0}
	}
	it := kvreader.PrefixIterator(start)
	defer func() {
		cerr := it.Close()
		if cerr != nil {
			rv <- cerr
		}
	}()
	key, val, valid := it.Current()
	for valid {
		ck := make([]byte, len(key))
		copy(ck, key)
		cv := make([]byte, len(val))
		copy(cv, val)
		row, err := ParseFromKeyValue(ck, cv)
		if err != nil {
			rv <- err
			return
		}
		rv <- row

		it.Next()
		key, val, valid = it.Current()
	}
}

func dumpRange(kvreader store.KVReader, rv chan interface{}, start, end []byte) {
	it := kvreader.RangeIterator(start, end)
	defer func() {
		cerr := it.Close()
		if cerr != nil {
			rv <- cerr
		}
	}()
	key, val, valid := it.Current()
	for valid {
		ck := make([]byte, len(key))
		copy(ck, key)
		cv := make([]byte, len(val))
		copy(cv, val)
		row, err := ParseFromKeyValue(ck, cv)
		if err != nil {
			rv <- err
			return
		}
		rv <- row

		it.Next()
		key, val, valid = it.Current()
	}
}

func (i *IndexReader) DumpAll() chan interface{} {
	rv := make(chan interface{})
	go func() {
		defer close(rv)
		dumpRange(i.kvreader, rv, nil, nil)
	}()
	return rv
}

func (i *IndexReader) DumpFields() chan interface{} {
	rv := make(chan interface{})
	go func() {
		defer close(rv)
		dumpPrefix(i.kvreader, rv, []byte{'f'})
	}()
	return rv
}

type keyset [][]byte

func (k keyset) Len() int           { return len(k) }
func (k keyset) Swap(i, j int)      { k[i], k[j] = k[j], k[i] }
func (k keyset) Less(i, j int) bool { return bytes.Compare(k[i], k[j]) < 0 }

// DumpDoc returns all rows in the index related to this doc id
func (i *IndexReader) DumpDoc(id string) chan interface{} {
	idBytes := []byte(id)

	rv := make(chan interface{})

	go func() {
		defer close(rv)

		back, err := backIndexRowForDoc(i.kvreader, []byte(id))
		if err != nil {
			rv <- err
			return
		}

		// no such doc
		if back == nil {
			return
		}
		// build sorted list of term keys
		keys := make(keyset, 0)
		for _, entry := range back.termsEntries {
			for i := range entry.Terms {
				tfr := NewTermFrequencyRow([]byte(entry.Terms[i]), uint16(*entry.Field), idBytes, 0, 0)
				key := tfr.Key()
				keys = append(keys, key)
			}
		}
		sort.Sort(keys)

		// first add all the stored rows
		storedRowPrefix := NewStoredRow(idBytes, 0, []uint64{}, 'x', []byte{}).ScanPrefixForDoc()
		dumpPrefix(i.kvreader, rv, storedRowPrefix)

		// now walk term keys in order and add them as well
		if len(keys) > 0 {
			it := i.kvreader.RangeIterator(keys[0], nil)
			defer func() {
				cerr := it.Close()
				if cerr != nil {
					rv <- cerr
				}
			}()

			for _, key := range keys {
				it.Seek(key)
				rkey, rval, valid := it.Current()
				if !valid {
					break
				}
				rck := make([]byte, len(rkey))
				copy(rck, key)
				rcv := make([]byte, len(rval))
				copy(rcv, rval)
				row, err := ParseFromKeyValue(rck, rcv)
				if err != nil {
					rv <- err
					return
				}
				rv <- row
			}
		}
	}()

	return rv
}
