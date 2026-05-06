/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"google.golang.org/protobuf/proto"

	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

// WriteBatch holds the necessary info to perform batched writes.
type WriteBatch struct {
	sync.Mutex
	txn      *Txn
	db       *DB
	throttle *y.Throttle
	err      atomic.Value

	isManaged bool
	commitTs  uint64
	finished  bool
}

// NewWriteBatch creates a new WriteBatch. This provides a way to conveniently do a lot of writes,
// batching them up as tightly as possible in a single transaction and using callbacks to avoid
// waiting for them to commit, thus achieving good performance. This API hides away the logic of
// creating and committing transactions. Due to the nature of SSI guaratees provided by Badger,
// blind writes can never encounter transaction conflicts (ErrConflict).
func (db *DB) NewWriteBatch() *WriteBatch {
	if db.opt.managedTxns {
		panic("cannot use NewWriteBatch in managed mode. Use NewWriteBatchAt instead")
	}
	return db.newWriteBatch(false)
}

func (db *DB) newWriteBatch(isManaged bool) *WriteBatch {
	return &WriteBatch{
		db:        db,
		isManaged: isManaged,
		txn:       db.newTransaction(true, isManaged),
		throttle:  y.NewThrottle(16),
	}
}

// SetMaxPendingTxns sets a limit on maximum number of pending transactions while writing batches.
// This function should be called before using WriteBatch. Default value of MaxPendingTxns is
// 16 to minimise memory usage.
func (wb *WriteBatch) SetMaxPendingTxns(max int) {
	wb.throttle = y.NewThrottle(max)
}

// Cancel function must be called if there's a chance that Flush might not get
// called. If neither Flush or Cancel is called, the transaction oracle would
// never get a chance to clear out the row commit timestamp map, thus causing an
// unbounded memory consumption. Typically, you can call Cancel as a defer
// statement right after NewWriteBatch is called.
//
// Note that any committed writes would still go through despite calling Cancel.
func (wb *WriteBatch) Cancel() {
	wb.Lock()
	defer wb.Unlock()
	wb.finished = true
	if err := wb.throttle.Finish(); err != nil {
		wb.db.opt.Errorf("WatchBatch.Cancel error while finishing: %v", err)
	}
	wb.txn.Discard()
}

func (wb *WriteBatch) callback(err error) {
	// sync.WaitGroup is thread-safe, so it doesn't need to be run inside wb.Lock.
	defer wb.throttle.Done(err)
	if err == nil {
		return
	}
	if err := wb.Error(); err != nil {
		return
	}
	wb.err.Store(err)
}

func (wb *WriteBatch) writeKV(kv *pb.KV) error {
	e := Entry{Key: kv.Key, Value: kv.Value}
	if len(kv.UserMeta) > 0 {
		e.UserMeta = kv.UserMeta[0]
	}
	y.AssertTrue(kv.Version != 0)
	e.version = kv.Version
	return wb.handleEntry(&e)
}

func (wb *WriteBatch) Write(buf *z.Buffer) error {
	wb.Lock()
	defer wb.Unlock()

	err := buf.SliceIterate(func(s []byte) error {
		kv := &pb.KV{}
		if err := proto.Unmarshal(s, kv); err != nil {
			return err
		}
		return wb.writeKV(kv)
	})
	return err
}

func (wb *WriteBatch) WriteList(kvList *pb.KVList) error {
	wb.Lock()
	defer wb.Unlock()
	for _, kv := range kvList.Kv {
		if err := wb.writeKV(kv); err != nil {
			return err
		}
	}
	return nil
}

// SetEntryAt is the equivalent of Txn.SetEntry but it also allows setting version for the entry.
// SetEntryAt can be used only in managed mode.
func (wb *WriteBatch) SetEntryAt(e *Entry, ts uint64) error {
	if !wb.db.opt.managedTxns {
		return errors.New("SetEntryAt can only be used in managed mode. Use SetEntry instead")
	}
	e.version = ts
	return wb.SetEntry(e)
}

// Should be called with lock acquired.
func (wb *WriteBatch) handleEntry(e *Entry) error {
	if err := wb.txn.SetEntry(e); err != ErrTxnTooBig {
		return err
	}
	// Txn has reached it's zenith. Commit now.
	if cerr := wb.commit(); cerr != nil {
		return cerr
	}
	// This time the error must not be ErrTxnTooBig, otherwise, we make the
	// error permanent.
	if err := wb.txn.SetEntry(e); err != nil {
		wb.err.Store(err)
		return err
	}
	return nil
}

// SetEntry is the equivalent of Txn.SetEntry.
func (wb *WriteBatch) SetEntry(e *Entry) error {
	wb.Lock()
	defer wb.Unlock()
	return wb.handleEntry(e)
}

// Set is equivalent of Txn.Set().
func (wb *WriteBatch) Set(k, v []byte) error {
	e := &Entry{Key: k, Value: v}
	return wb.SetEntry(e)
}

// DeleteAt is equivalent of Txn.Delete but accepts a delete timestamp.
func (wb *WriteBatch) DeleteAt(k []byte, ts uint64) error {
	e := Entry{Key: k, meta: bitDelete, version: ts}
	return wb.SetEntry(&e)
}

// Delete is equivalent of Txn.Delete.
func (wb *WriteBatch) Delete(k []byte) error {
	wb.Lock()
	defer wb.Unlock()

	if err := wb.txn.Delete(k); err != ErrTxnTooBig {
		return err
	}
	if err := wb.commit(); err != nil {
		return err
	}
	if err := wb.txn.Delete(k); err != nil {
		wb.err.Store(err)
		return err
	}
	return nil
}

// Caller to commit must hold a write lock.
func (wb *WriteBatch) commit() error {
	if err := wb.Error(); err != nil {
		return err
	}
	if wb.finished {
		return y.ErrCommitAfterFinish
	}
	if err := wb.throttle.Do(); err != nil {
		wb.err.Store(err)
		return err
	}
	wb.txn.CommitWith(wb.callback)
	wb.txn = wb.db.newTransaction(true, wb.isManaged)
	wb.txn.commitTs = wb.commitTs
	return wb.Error()
}

// Flush must be called at the end to ensure that any pending writes get committed to Badger. Flush
// returns any error stored by WriteBatch.
func (wb *WriteBatch) Flush() error {
	wb.Lock()
	err := wb.commit()
	if err != nil {
		wb.Unlock()
		return err
	}
	wb.finished = true
	wb.txn.Discard()
	wb.Unlock()

	if err := wb.throttle.Finish(); err != nil {
		if wb.Error() != nil {
			return fmt.Errorf("wb.err: %w err: %w", wb.Error(), err)
		}
		return err
	}

	return wb.Error()
}

// Error returns any errors encountered so far. No commits would be run once an error is detected.
func (wb *WriteBatch) Error() error {
	// If the interface conversion fails, the err will be nil.
	err, _ := wb.err.Load().(error)
	return err
}
