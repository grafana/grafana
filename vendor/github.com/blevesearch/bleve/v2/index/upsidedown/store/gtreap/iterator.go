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
	"bytes"
	"sync"

	"github.com/blevesearch/gtreap"
)

type Iterator struct {
	t *gtreap.Treap

	m        sync.Mutex
	cancelCh chan struct{}
	nextCh   chan *Item
	curr     *Item
	currOk   bool

	prefix []byte
	start  []byte
	end    []byte
}

func (w *Iterator) Seek(k []byte) {
	if w.start != nil && bytes.Compare(k, w.start) < 0 {
		k = w.start
	}
	if w.prefix != nil && !bytes.HasPrefix(k, w.prefix) {
		if bytes.Compare(k, w.prefix) < 0 {
			k = w.prefix
		} else {
			var end []byte
			for i := len(w.prefix) - 1; i >= 0; i-- {
				c := w.prefix[i]
				if c < 0xff {
					end = make([]byte, i+1)
					copy(end, w.prefix)
					end[i] = c + 1
					break
				}
			}
			k = end
		}
	}
	w.restart(&Item{k: k})
}

func (w *Iterator) restart(start *Item) *Iterator {
	cancelCh := make(chan struct{})
	nextCh := make(chan *Item, 1)

	w.m.Lock()
	if w.cancelCh != nil {
		close(w.cancelCh)
	}
	w.cancelCh = cancelCh
	w.nextCh = nextCh
	w.curr = nil
	w.currOk = false
	w.m.Unlock()

	go func() {
		if start != nil {
			w.t.VisitAscend(start, func(itm gtreap.Item) bool {
				select {
				case <-cancelCh:
					return false
				case nextCh <- itm.(*Item):
					return true
				}
			})
		}
		close(nextCh)
	}()

	w.Next()

	return w
}

func (w *Iterator) Next() {
	w.m.Lock()
	nextCh := w.nextCh
	w.m.Unlock()
	w.curr, w.currOk = <-nextCh
}

func (w *Iterator) Current() ([]byte, []byte, bool) {
	w.m.Lock()
	defer w.m.Unlock()
	if !w.currOk || w.curr == nil {
		return nil, nil, false
	}
	if w.prefix != nil && !bytes.HasPrefix(w.curr.k, w.prefix) {
		return nil, nil, false
	} else if w.end != nil && bytes.Compare(w.curr.k, w.end) >= 0 {
		return nil, nil, false
	}
	return w.curr.k, w.curr.v, w.currOk
}

func (w *Iterator) Key() []byte {
	k, _, ok := w.Current()
	if !ok {
		return nil
	}
	return k
}

func (w *Iterator) Value() []byte {
	_, v, ok := w.Current()
	if !ok {
		return nil
	}
	return v
}

func (w *Iterator) Valid() bool {
	_, _, ok := w.Current()
	return ok
}

func (w *Iterator) Close() error {
	w.m.Lock()
	if w.cancelCh != nil {
		close(w.cancelCh)
	}
	w.cancelCh = nil
	w.nextCh = nil
	w.curr = nil
	w.currOk = false
	w.m.Unlock()

	return nil
}
