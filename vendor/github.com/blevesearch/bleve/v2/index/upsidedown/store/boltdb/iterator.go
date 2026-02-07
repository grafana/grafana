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
	"bytes"

	bolt "go.etcd.io/bbolt"
)

type Iterator struct {
	store  *Store
	tx     *bolt.Tx
	cursor *bolt.Cursor
	prefix []byte
	start  []byte
	end    []byte
	valid  bool
	key    []byte
	val    []byte
}

func (i *Iterator) updateValid() {
	i.valid = (i.key != nil)
	if i.valid {
		if i.prefix != nil {
			i.valid = bytes.HasPrefix(i.key, i.prefix)
		} else if i.end != nil {
			i.valid = bytes.Compare(i.key, i.end) < 0
		}
	}
}

func (i *Iterator) Seek(k []byte) {
	if i.start != nil && bytes.Compare(k, i.start) < 0 {
		k = i.start
	}
	if i.prefix != nil && !bytes.HasPrefix(k, i.prefix) {
		if bytes.Compare(k, i.prefix) < 0 {
			k = i.prefix
		} else {
			i.valid = false
			return
		}
	}
	i.key, i.val = i.cursor.Seek(k)
	i.updateValid()
}

func (i *Iterator) Next() {
	i.key, i.val = i.cursor.Next()
	i.updateValid()
}

func (i *Iterator) Current() ([]byte, []byte, bool) {
	return i.key, i.val, i.valid
}

func (i *Iterator) Key() []byte {
	return i.key
}

func (i *Iterator) Value() []byte {
	return i.val
}

func (i *Iterator) Valid() bool {
	return i.valid
}

func (i *Iterator) Close() error {
	return nil
}
