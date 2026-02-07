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

package boltdb

import (
	store "github.com/blevesearch/upsidedown_store_api"
	bolt "go.etcd.io/bbolt"
)

type Reader struct {
	store  *Store
	tx     *bolt.Tx
	bucket *bolt.Bucket
}

func (r *Reader) Get(key []byte) ([]byte, error) {
	var rv []byte
	v := r.bucket.Get(key)
	if v != nil {
		rv = make([]byte, len(v))
		copy(rv, v)
	}
	return rv, nil
}

func (r *Reader) MultiGet(keys [][]byte) ([][]byte, error) {
	return store.MultiGet(r, keys)
}

func (r *Reader) PrefixIterator(prefix []byte) store.KVIterator {
	cursor := r.bucket.Cursor()

	rv := &Iterator{
		store:  r.store,
		tx:     r.tx,
		cursor: cursor,
		prefix: prefix,
	}

	rv.Seek(prefix)
	return rv
}

func (r *Reader) RangeIterator(start, end []byte) store.KVIterator {
	cursor := r.bucket.Cursor()

	rv := &Iterator{
		store:  r.store,
		tx:     r.tx,
		cursor: cursor,
		start:  start,
		end:    end,
	}

	rv.Seek(start)
	return rv
}

func (r *Reader) Close() error {
	return r.tx.Rollback()
}
