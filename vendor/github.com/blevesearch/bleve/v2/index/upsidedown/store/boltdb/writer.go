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
	"fmt"

	store "github.com/blevesearch/upsidedown_store_api"
)

type Writer struct {
	store *Store
}

func (w *Writer) NewBatch() store.KVBatch {
	return store.NewEmulatedBatch(w.store.mo)
}

func (w *Writer) NewBatchEx(options store.KVBatchOptions) ([]byte, store.KVBatch, error) {
	return make([]byte, options.TotalBytes), w.NewBatch(), nil
}

func (w *Writer) ExecuteBatch(batch store.KVBatch) (err error) {

	emulatedBatch, ok := batch.(*store.EmulatedBatch)
	if !ok {
		return fmt.Errorf("wrong type of batch")
	}

	tx, err := w.store.db.Begin(true)
	if err != nil {
		return
	}
	// defer function to ensure that once started,
	// we either Commit tx or Rollback
	defer func() {
		// if nothing went wrong, commit
		if err == nil {
			// careful to catch error here too
			err = tx.Commit()
		} else {
			// caller should see error that caused abort,
			// not success or failure of Rollback itself
			_ = tx.Rollback()
		}
	}()

	bucket := tx.Bucket([]byte(w.store.bucket))
	bucket.FillPercent = w.store.fillPercent

	for k, mergeOps := range emulatedBatch.Merger.Merges {
		kb := []byte(k)
		existingVal := bucket.Get(kb)
		mergedVal, fullMergeOk := w.store.mo.FullMerge(kb, existingVal, mergeOps)
		if !fullMergeOk {
			err = fmt.Errorf("merge operator returned failure")
			return
		}
		err = bucket.Put(kb, mergedVal)
		if err != nil {
			return
		}
	}

	for _, op := range emulatedBatch.Ops {
		if op.V != nil {
			err = bucket.Put(op.K, op.V)
			if err != nil {
				return
			}
		} else {
			err = bucket.Delete(op.K)
			if err != nil {
				return
			}
		}
	}
	return
}

func (w *Writer) Close() error {
	return nil
}
