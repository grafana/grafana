/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	stderrors "errors"
	"sync"
	"time"

	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

// MergeOperator represents a Badger merge operator.
type MergeOperator struct {
	sync.RWMutex
	f      MergeFunc
	db     *DB
	key    []byte
	closer *z.Closer
}

// MergeFunc accepts two byte slices, one representing an existing value, and
// another representing a new value that needs to be ‘merged’ into it. MergeFunc
// contains the logic to perform the ‘merge’ and return an updated value.
// MergeFunc could perform operations like integer addition, list appends etc.
// Note that the ordering of the operands is maintained.
type MergeFunc func(existingVal, newVal []byte) []byte

// GetMergeOperator creates a new MergeOperator for a given key and returns a
// pointer to it. It also fires off a goroutine that performs a compaction using
// the merge function that runs periodically, as specified by dur.
func (db *DB) GetMergeOperator(key []byte,
	f MergeFunc, dur time.Duration) *MergeOperator {
	op := &MergeOperator{
		f:      f,
		db:     db,
		key:    key,
		closer: z.NewCloser(1),
	}

	go op.runCompactions(dur)
	return op
}

var errNoMerge = stderrors.New("No need for merge")

func (op *MergeOperator) iterateAndMerge() (newVal []byte, latest uint64, err error) {
	txn := op.db.NewTransaction(false)
	defer txn.Discard()
	opt := DefaultIteratorOptions
	opt.AllVersions = true
	it := txn.NewKeyIterator(op.key, opt)
	defer it.Close()

	var numVersions int
	for it.Rewind(); it.Valid(); it.Next() {
		item := it.Item()
		if item.IsDeletedOrExpired() {
			break
		}
		numVersions++
		if numVersions == 1 {
			// This should be the newVal, considering this is the latest version.
			newVal, err = item.ValueCopy(newVal)
			if err != nil {
				return nil, 0, err
			}
			latest = item.Version()
		} else {
			if err := item.Value(func(oldVal []byte) error {
				// The merge should always be on the newVal considering it has the merge result of
				// the latest version. The value read should be the oldVal.
				newVal = op.f(oldVal, newVal)
				return nil
			}); err != nil {
				return nil, 0, err
			}
		}
		if item.DiscardEarlierVersions() {
			break
		}
	}
	if numVersions == 0 {
		return nil, latest, ErrKeyNotFound
	} else if numVersions == 1 {
		return newVal, latest, errNoMerge
	}
	return newVal, latest, nil
}

func (op *MergeOperator) compact() error {
	op.Lock()
	defer op.Unlock()
	val, version, err := op.iterateAndMerge()
	if err == ErrKeyNotFound || err == errNoMerge {
		return nil
	} else if err != nil {
		return err
	}
	entries := []*Entry{
		{
			Key:   y.KeyWithTs(op.key, version),
			Value: val,
			meta:  bitDiscardEarlierVersions,
		},
	}
	// Write value back to the DB. It is important that we do not set the bitMergeEntry bit
	// here. When compaction happens, all the older merged entries will be removed.
	return op.db.batchSetAsync(entries, func(err error) {
		if err != nil {
			op.db.opt.Errorf("failed to insert the result of merge compaction: %s", err)
		}
	})
}

func (op *MergeOperator) runCompactions(dur time.Duration) {
	ticker := time.NewTicker(dur)
	defer op.closer.Done()
	var stop bool
	for {
		select {
		case <-op.closer.HasBeenClosed():
			stop = true
		case <-ticker.C: // wait for tick
		}
		if err := op.compact(); err != nil {
			op.db.opt.Errorf("failure while running merge operation: %s", err)
		}
		if stop {
			ticker.Stop()
			break
		}
	}
}

// Add records a value in Badger which will eventually be merged by a background
// routine into the values that were recorded by previous invocations to Add().
func (op *MergeOperator) Add(val []byte) error {
	return op.db.Update(func(txn *Txn) error {
		return txn.SetEntry(NewEntry(op.key, val).withMergeBit())
	})
}

// Get returns the latest value for the merge operator, which is derived by
// applying the merge function to all the values added so far.
//
// If Add has not been called even once, Get will return ErrKeyNotFound.
func (op *MergeOperator) Get() ([]byte, error) {
	op.RLock()
	defer op.RUnlock()
	var existing []byte
	err := op.db.View(func(txn *Txn) (err error) {
		existing, _, err = op.iterateAndMerge()
		return err
	})
	if err == errNoMerge {
		return existing, nil
	}
	return existing, err
}

// Stop waits for any pending merge to complete and then stops the background
// goroutine.
func (op *MergeOperator) Stop() {
	op.closer.SignalAndWait()
}
