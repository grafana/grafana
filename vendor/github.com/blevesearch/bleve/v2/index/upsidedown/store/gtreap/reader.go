//  Copyright (c) 2015 Couchbase, Inc.
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

// Package gtreap provides an in-memory implementation of the
// KVStore interfaces using the gtreap balanced-binary treap,
// copy-on-write data structure.
package gtreap

import (
	"github.com/blevesearch/upsidedown_store_api"

	"github.com/blevesearch/gtreap"
)

type Reader struct {
	t *gtreap.Treap
}

func (w *Reader) Get(k []byte) (v []byte, err error) {
	var rv []byte
	itm := w.t.Get(&Item{k: k})
	if itm != nil {
		rv = make([]byte, len(itm.(*Item).v))
		copy(rv, itm.(*Item).v)
		return rv, nil
	}
	return nil, nil
}

func (r *Reader) MultiGet(keys [][]byte) ([][]byte, error) {
	return store.MultiGet(r, keys)
}

func (w *Reader) PrefixIterator(k []byte) store.KVIterator {
	rv := Iterator{
		t:      w.t,
		prefix: k,
	}
	rv.restart(&Item{k: k})
	return &rv
}

func (w *Reader) RangeIterator(start, end []byte) store.KVIterator {
	rv := Iterator{
		t:     w.t,
		start: start,
		end:   end,
	}
	rv.restart(&Item{k: start})
	return &rv
}

func (w *Reader) Close() error {
	return nil
}
