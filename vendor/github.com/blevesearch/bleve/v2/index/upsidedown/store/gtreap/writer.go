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
	"fmt"
	"math/rand"

	"github.com/blevesearch/upsidedown_store_api"
)

type Writer struct {
	s *Store
}

func (w *Writer) NewBatch() store.KVBatch {
	return store.NewEmulatedBatch(w.s.mo)
}

func (w *Writer) NewBatchEx(options store.KVBatchOptions) ([]byte, store.KVBatch, error) {
	return make([]byte, options.TotalBytes), w.NewBatch(), nil
}

func (w *Writer) ExecuteBatch(batch store.KVBatch) error {

	emulatedBatch, ok := batch.(*store.EmulatedBatch)
	if !ok {
		return fmt.Errorf("wrong type of batch")
	}

	w.s.m.Lock()
	for k, mergeOps := range emulatedBatch.Merger.Merges {
		kb := []byte(k)
		var existingVal []byte
		existingItem := w.s.t.Get(&Item{k: kb})
		if existingItem != nil {
			existingVal = w.s.t.Get(&Item{k: kb}).(*Item).v
		}
		mergedVal, fullMergeOk := w.s.mo.FullMerge(kb, existingVal, mergeOps)
		if !fullMergeOk {
			return fmt.Errorf("merge operator returned failure")
		}
		w.s.t = w.s.t.Upsert(&Item{k: kb, v: mergedVal}, rand.Int())
	}

	for _, op := range emulatedBatch.Ops {
		if op.V != nil {
			w.s.t = w.s.t.Upsert(&Item{k: op.K, v: op.V}, rand.Int())
		} else {
			w.s.t = w.s.t.Delete(&Item{k: op.K})
		}
	}
	w.s.m.Unlock()

	return nil
}

func (w *Writer) Close() error {
	w.s = nil
	return nil
}
