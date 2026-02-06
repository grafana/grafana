/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"bytes"
	"fmt"
	"hash/crc32"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/dgraph-io/badger/v4/table"
	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

type prefetchStatus uint8

const (
	prefetched prefetchStatus = iota + 1
)

// Item is returned during iteration. Both the Key() and Value() output is only valid until
// iterator.Next() is called.
type Item struct {
	key       []byte
	vptr      []byte
	val       []byte
	version   uint64
	expiresAt uint64

	slice *y.Slice // Used only during prefetching.
	next  *Item
	txn   *Txn

	err      error
	wg       sync.WaitGroup
	status   prefetchStatus
	meta     byte // We need to store meta to know about bitValuePointer.
	userMeta byte
}

// String returns a string representation of Item
func (item *Item) String() string {
	return fmt.Sprintf("key=%q, version=%d, meta=%x", item.Key(), item.Version(), item.meta)
}

// Key returns the key.
//
// Key is only valid as long as item is valid, or transaction is valid.  If you need to use it
// outside its validity, please use KeyCopy.
func (item *Item) Key() []byte {
	return item.key
}

// KeyCopy returns a copy of the key of the item, writing it to dst slice.
// If nil is passed, or capacity of dst isn't sufficient, a new slice would be allocated and
// returned.
func (item *Item) KeyCopy(dst []byte) []byte {
	return y.SafeCopy(dst, item.key)
}

// Version returns the commit timestamp of the item.
func (item *Item) Version() uint64 {
	return item.version
}

// Value retrieves the value of the item from the value log.
//
// This method must be called within a transaction. Calling it outside a
// transaction is considered undefined behavior. If an iterator is being used,
// then Item.Value() is defined in the current iteration only, because items are
// reused.
//
// If you need to use a value outside a transaction, please use Item.ValueCopy
// instead, or copy it yourself. Value might change once discard or commit is called.
// Use ValueCopy if you want to do a Set after Get.
func (item *Item) Value(fn func(val []byte) error) error {
	item.wg.Wait()
	if item.status == prefetched {
		if item.err == nil && fn != nil {
			if err := fn(item.val); err != nil {
				return err
			}
		}
		return item.err
	}
	buf, cb, err := item.yieldItemValue()
	defer runCallback(cb)
	if err != nil {
		return err
	}
	if fn != nil {
		return fn(buf)
	}
	return nil
}

// ValueCopy returns a copy of the value of the item from the value log, writing it to dst slice.
// If nil is passed, or capacity of dst isn't sufficient, a new slice would be allocated and
// returned. Tip: It might make sense to reuse the returned slice as dst argument for the next call.
//
// This function is useful in long running iterate/update transactions to avoid a write deadlock.
// See Github issue: https://github.com/hypermodeinc/badger/issues/315
func (item *Item) ValueCopy(dst []byte) ([]byte, error) {
	item.wg.Wait()
	if item.status == prefetched {
		return y.SafeCopy(dst, item.val), item.err
	}
	buf, cb, err := item.yieldItemValue()
	defer runCallback(cb)
	return y.SafeCopy(dst, buf), err
}

func (item *Item) hasValue() bool {
	if item.meta == 0 && item.vptr == nil {
		// key not found
		return false
	}
	return true
}

// IsDeletedOrExpired returns true if item contains deleted or expired value.
func (item *Item) IsDeletedOrExpired() bool {
	return isDeletedOrExpired(item.meta, item.expiresAt)
}

// DiscardEarlierVersions returns whether the item was created with the
// option to discard earlier versions of a key when multiple are available.
func (item *Item) DiscardEarlierVersions() bool {
	return item.meta&bitDiscardEarlierVersions > 0
}

func (item *Item) yieldItemValue() ([]byte, func(), error) {
	key := item.Key() // No need to copy.
	if !item.hasValue() {
		return nil, nil, nil
	}

	if item.slice == nil {
		item.slice = new(y.Slice)
	}

	if (item.meta & bitValuePointer) == 0 {
		val := item.slice.Resize(len(item.vptr))
		copy(val, item.vptr)
		return val, nil, nil
	}

	var vp valuePointer
	vp.Decode(item.vptr)
	db := item.txn.db
	result, cb, err := db.vlog.Read(vp, item.slice)
	if err != nil {
		db.opt.Errorf("Unable to read: Key: %v, Version : %v, meta: %v, userMeta: %v"+
			" Error: %v", key, item.version, item.meta, item.userMeta, err)
		var txn *Txn
		if db.opt.managedTxns {
			txn = db.NewTransactionAt(math.MaxUint64, false)
		} else {
			txn = db.NewTransaction(false)
		}
		defer txn.Discard()

		iopt := DefaultIteratorOptions
		iopt.AllVersions = true
		iopt.InternalAccess = true
		iopt.PrefetchValues = false

		it := txn.NewKeyIterator(item.Key(), iopt)
		defer it.Close()
		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			var vp valuePointer
			if item.meta&bitValuePointer > 0 {
				vp.Decode(item.vptr)
			}
			db.opt.Errorf("Key: %v, Version : %v, meta: %v, userMeta: %v valuePointer: %+v",
				item.Key(), item.version, item.meta, item.userMeta, vp)
		}
	}
	// Don't return error if we cannot read the value. Just log the error.
	return result, cb, nil
}

func runCallback(cb func()) {
	if cb != nil {
		cb()
	}
}

func (item *Item) prefetchValue() {
	val, cb, err := item.yieldItemValue()
	defer runCallback(cb)

	item.err = err
	item.status = prefetched
	if val == nil {
		return
	}
	buf := item.slice.Resize(len(val))
	copy(buf, val)
	item.val = buf
}

// EstimatedSize returns the approximate size of the key-value pair.
//
// This can be called while iterating through a store to quickly estimate the
// size of a range of key-value pairs (without fetching the corresponding
// values).
func (item *Item) EstimatedSize() int64 {
	if !item.hasValue() {
		return 0
	}
	if (item.meta & bitValuePointer) == 0 {
		return int64(len(item.key) + len(item.vptr))
	}
	var vp valuePointer
	vp.Decode(item.vptr)
	return int64(vp.Len) // includes key length.
}

// KeySize returns the size of the key.
// Exact size of the key is key + 8 bytes of timestamp
func (item *Item) KeySize() int64 {
	return int64(len(item.key))
}

// ValueSize returns the approximate size of the value.
//
// This can be called to quickly estimate the size of a value without fetching
// it.
func (item *Item) ValueSize() int64 {
	if !item.hasValue() {
		return 0
	}
	if (item.meta & bitValuePointer) == 0 {
		return int64(len(item.vptr))
	}
	var vp valuePointer
	vp.Decode(item.vptr)

	klen := int64(len(item.key) + 8) // 8 bytes for timestamp.
	// 6 bytes are for the approximate length of the header. Since header is encoded in varint, we
	// cannot find the exact length of header without fetching it.
	return int64(vp.Len) - klen - 6 - crc32.Size
}

// UserMeta returns the userMeta set by the user. Typically, this byte, optionally set by the user
// is used to interpret the value.
func (item *Item) UserMeta() byte {
	return item.userMeta
}

// ExpiresAt returns a Unix time value indicating when the item will be
// considered expired. 0 indicates that the item will never expire.
func (item *Item) ExpiresAt() uint64 {
	return item.expiresAt
}

// TODO: Switch this to use linked list container in Go.
type list struct {
	head *Item
	tail *Item
}

func (l *list) push(i *Item) {
	i.next = nil
	if l.tail == nil {
		l.head = i
		l.tail = i
		return
	}
	l.tail.next = i
	l.tail = i
}

func (l *list) pop() *Item {
	if l.head == nil {
		return nil
	}
	i := l.head
	if l.head == l.tail {
		l.tail = nil
		l.head = nil
	} else {
		l.head = i.next
	}
	i.next = nil
	return i
}

// IteratorOptions is used to set options when iterating over Badger key-value
// stores.
//
// This package provides DefaultIteratorOptions which contains options that
// should work for most applications. Consider using that as a starting point
// before customizing it for your own needs.
type IteratorOptions struct {
	// PrefetchSize is the number of KV pairs to prefetch while iterating.
	// Valid only if PrefetchValues is true.
	PrefetchSize int
	// PrefetchValues Indicates whether we should prefetch values during
	// iteration and store them.
	PrefetchValues bool
	Reverse        bool // Direction of iteration. False is forward, true is backward.
	AllVersions    bool // Fetch all valid versions of the same key.
	InternalAccess bool // Used to allow internal access to badger keys.

	// The following option is used to narrow down the SSTables that iterator
	// picks up. If Prefix is specified, only tables which could have this
	// prefix are picked based on their range of keys.
	prefixIsKey bool   // If set, use the prefix for bloom filter lookup.
	Prefix      []byte // Only iterate over this given prefix.
	SinceTs     uint64 // Only read data that has version > SinceTs.
}

func (opt *IteratorOptions) compareToPrefix(key []byte) int {
	// We should compare key without timestamp. For example key - a[TS] might be > "aa" prefix.
	key = y.ParseKey(key)
	if len(key) > len(opt.Prefix) {
		key = key[:len(opt.Prefix)]
	}
	return bytes.Compare(key, opt.Prefix)
}

func (opt *IteratorOptions) pickTable(t table.TableInterface) bool {
	// Ignore this table if its max version is less than the sinceTs.
	if t.MaxVersion() < opt.SinceTs {
		return false
	}
	if len(opt.Prefix) == 0 {
		return true
	}
	if opt.compareToPrefix(t.Smallest()) > 0 {
		return false
	}
	if opt.compareToPrefix(t.Biggest()) < 0 {
		return false
	}
	// Bloom filter lookup would only work if opt.Prefix does NOT have the read
	// timestamp as part of the key.
	if opt.prefixIsKey && t.DoesNotHave(y.Hash(opt.Prefix)) {
		return false
	}
	return true
}

// pickTables picks the necessary table for the iterator. This function also assumes
// that the tables are sorted in the right order.
func (opt *IteratorOptions) pickTables(all []*table.Table) []*table.Table {
	filterTables := func(tables []*table.Table) []*table.Table {
		if opt.SinceTs > 0 {
			tmp := tables[:0]
			for _, t := range tables {
				if t.MaxVersion() < opt.SinceTs {
					continue
				}
				tmp = append(tmp, t)
			}
			tables = tmp
		}
		return tables
	}

	if len(opt.Prefix) == 0 {
		out := make([]*table.Table, len(all))
		copy(out, all)
		return filterTables(out)
	}
	sIdx := sort.Search(len(all), func(i int) bool {
		// table.Biggest >= opt.prefix
		// if opt.Prefix < table.Biggest, then surely it is not in any of the preceding tables.
		return opt.compareToPrefix(all[i].Biggest()) >= 0
	})
	if sIdx == len(all) {
		// Not found.
		return []*table.Table{}
	}

	filtered := all[sIdx:]
	if !opt.prefixIsKey {
		eIdx := sort.Search(len(filtered), func(i int) bool {
			return opt.compareToPrefix(filtered[i].Smallest()) > 0
		})
		out := make([]*table.Table, len(filtered[:eIdx]))
		copy(out, filtered[:eIdx])
		return filterTables(out)
	}

	// opt.prefixIsKey == true. This code is optimizing for opt.prefixIsKey part.
	var out []*table.Table
	hash := y.Hash(opt.Prefix)
	for _, t := range filtered {
		// When we encounter the first table whose smallest key is higher than opt.Prefix, we can
		// stop. This is an IMPORTANT optimization, just considering how often we call
		// NewKeyIterator.
		if opt.compareToPrefix(t.Smallest()) > 0 {
			// if table.Smallest > opt.Prefix, then this and all tables after this can be ignored.
			break
		}
		// opt.Prefix is actually the key. So, we can run bloom filter checks
		// as well.
		if t.DoesNotHave(hash) {
			continue
		}
		out = append(out, t)
	}
	return filterTables(out)
}

// DefaultIteratorOptions contains default options when iterating over Badger key-value stores.
var DefaultIteratorOptions = IteratorOptions{
	PrefetchValues: true,
	PrefetchSize:   100,
	Reverse:        false,
	AllVersions:    false,
}

// Iterator helps iterating over the KV pairs in a lexicographically sorted order.
type Iterator struct {
	iitr   y.Iterator
	txn    *Txn
	readTs uint64

	opt   IteratorOptions
	item  *Item
	data  list
	waste list

	lastKey []byte // Used to skip over multiple versions of the same key.

	closed  bool
	scanned int // Used to estimate the size of data scanned by iterator.

	// ThreadId is an optional value that can be set to identify which goroutine created
	// the iterator. It can be used, for example, to uniquely identify each of the
	// iterators created by the stream interface
	ThreadId int

	Alloc *z.Allocator
}

// NewIterator returns a new iterator. Depending upon the options, either only keys, or both
// key-value pairs would be fetched. The keys are returned in lexicographically sorted order.
// Using prefetch is recommended if you're doing a long running iteration, for performance.
//
// Multiple Iterators:
// For a read-only txn, multiple iterators can be running simultaneously. However, for a read-write
// txn, iterators have the nuance of being a snapshot of the writes for the transaction at the time
// iterator was created. If writes are performed after an iterator is created, then that iterator
// will not be able to see those writes. Only writes performed before an iterator was created can be
// viewed.
func (txn *Txn) NewIterator(opt IteratorOptions) *Iterator {
	if txn.discarded {
		panic(ErrDiscardedTxn)
	}
	if txn.db.IsClosed() {
		panic(ErrDBClosed)
	}

	y.NumIteratorsCreatedAdd(txn.db.opt.MetricsEnabled, 1)

	// Keep track of the number of active iterators.
	txn.numIterators.Add(1)

	// TODO: If Prefix is set, only pick those memtables which have keys with the prefix.
	tables, decr := txn.db.getMemTables()
	defer decr()
	txn.db.vlog.incrIteratorCount()
	var iters []y.Iterator
	if itr := txn.newPendingWritesIterator(opt.Reverse); itr != nil {
		iters = append(iters, itr)
	}
	for i := 0; i < len(tables); i++ {
		iters = append(iters, tables[i].sl.NewUniIterator(opt.Reverse))
	}
	iters = txn.db.lc.appendIterators(iters, &opt) // This will increment references.
	res := &Iterator{
		txn:    txn,
		iitr:   table.NewMergeIterator(iters, opt.Reverse),
		opt:    opt,
		readTs: txn.readTs,
	}
	return res
}

// NewKeyIterator is just like NewIterator, but allows the user to iterate over all versions of a
// single key. Internally, it sets the Prefix option in provided opt, and uses that prefix to
// additionally run bloom filter lookups before picking tables from the LSM tree.
func (txn *Txn) NewKeyIterator(key []byte, opt IteratorOptions) *Iterator {
	if len(opt.Prefix) > 0 {
		panic("opt.Prefix should be nil for NewKeyIterator.")
	}
	opt.Prefix = key // This key must be without the timestamp.
	opt.prefixIsKey = true
	opt.AllVersions = true
	return txn.NewIterator(opt)
}

func (it *Iterator) newItem() *Item {
	item := it.waste.pop()
	if item == nil {
		item = &Item{slice: new(y.Slice), txn: it.txn}
	}
	return item
}

// Item returns pointer to the current key-value pair.
// This item is only valid until it.Next() gets called.
func (it *Iterator) Item() *Item {
	tx := it.txn
	tx.addReadKey(it.item.Key())
	return it.item
}

// Valid returns false when iteration is done.
func (it *Iterator) Valid() bool {
	if it.item == nil {
		return false
	}
	if it.opt.prefixIsKey {
		return bytes.Equal(it.item.key, it.opt.Prefix)
	}
	return bytes.HasPrefix(it.item.key, it.opt.Prefix)
}

// ValidForPrefix returns false when iteration is done
// or when the current key is not prefixed by the specified prefix.
func (it *Iterator) ValidForPrefix(prefix []byte) bool {
	return it.Valid() && bytes.HasPrefix(it.item.key, prefix)
}

// Close would close the iterator. It is important to call this when you're done with iteration.
func (it *Iterator) Close() {
	if it.closed {
		return
	}
	it.closed = true
	if it.iitr == nil {
		it.txn.numIterators.Add(-1)
		return
	}

	it.iitr.Close()
	// It is important to wait for the fill goroutines to finish. Otherwise, we might leave zombie
	// goroutines behind, which are waiting to acquire file read locks after DB has been closed.
	waitFor := func(l list) {
		item := l.pop()
		for item != nil {
			item.wg.Wait()
			item = l.pop()
		}
	}
	waitFor(it.waste)
	waitFor(it.data)

	// TODO: We could handle this error.
	_ = it.txn.db.vlog.decrIteratorCount()
	it.txn.numIterators.Add(-1)
}

// Next would advance the iterator by one. Always check it.Valid() after a Next()
// to ensure you have access to a valid it.Item().
func (it *Iterator) Next() {
	if it.iitr == nil {
		return
	}
	// Reuse current item
	it.item.wg.Wait() // Just cleaner to wait before pushing to avoid doing ref counting.
	it.scanned += len(it.item.key) + len(it.item.val) + len(it.item.vptr) + 2
	it.waste.push(it.item)

	// Set next item to current
	it.item = it.data.pop()
	for it.iitr.Valid() && hasPrefix(it) {
		if it.parseItem() {
			// parseItem calls one extra next.
			// This is used to deal with the complexity of reverse iteration.
			break
		}
	}
}

func isDeletedOrExpired(meta byte, expiresAt uint64) bool {
	if meta&bitDelete > 0 {
		return true
	}
	if expiresAt == 0 {
		return false
	}
	return expiresAt <= uint64(time.Now().Unix())
}

// parseItem is a complex function because it needs to handle both forward and reverse iteration
// implementation. We store keys such that their versions are sorted in descending order. This makes
// forward iteration efficient, but revese iteration complicated. This tradeoff is better because
// forward iteration is more common than reverse. It returns true, if either the iterator is invalid
// or it has pushed an item into it.data list, else it returns false.
//
// This function advances the iterator.
func (it *Iterator) parseItem() bool {
	mi := it.iitr
	key := mi.Key()

	setItem := func(item *Item) {
		if it.item == nil {
			it.item = item
		} else {
			it.data.push(item)
		}
	}

	isInternalKey := bytes.HasPrefix(key, badgerPrefix)
	// Skip badger keys.
	if !it.opt.InternalAccess && isInternalKey {
		mi.Next()
		return false
	}

	// Skip any versions which are beyond the readTs.
	version := y.ParseTs(key)
	// Ignore everything that is above the readTs and below or at the sinceTs.
	if version > it.readTs || (it.opt.SinceTs > 0 && version <= it.opt.SinceTs) {
		mi.Next()
		return false
	}

	// Skip banned keys only if it does not have badger internal prefix.
	if !isInternalKey && it.txn.db.isBanned(key) != nil {
		mi.Next()
		return false
	}

	if it.opt.AllVersions {
		// Return deleted or expired values also, otherwise user can't figure out
		// whether the key was deleted.
		item := it.newItem()
		it.fill(item)
		setItem(item)
		mi.Next()
		return true
	}

	// If iterating in forward direction, then just checking the last key against current key would
	// be sufficient.
	if !it.opt.Reverse {
		if y.SameKey(it.lastKey, key) {
			mi.Next()
			return false
		}
		// Only track in forward direction.
		// We should update lastKey as soon as we find a different key in our snapshot.
		// Consider keys: a 5, b 7 (del), b 5. When iterating, lastKey = a.
		// Then we see b 7, which is deleted. If we don't store lastKey = b, we'll then return b 5,
		// which is wrong. Therefore, update lastKey here.
		it.lastKey = y.SafeCopy(it.lastKey, mi.Key())
	}

FILL:
	// If deleted, advance and return.
	vs := mi.Value()
	if isDeletedOrExpired(vs.Meta, vs.ExpiresAt) {
		mi.Next()
		return false
	}

	item := it.newItem()
	it.fill(item)
	// fill item based on current cursor position. All Next calls have returned, so reaching here
	// means no Next was called.

	mi.Next()                           // Advance but no fill item yet.
	if !it.opt.Reverse || !mi.Valid() { // Forward direction, or invalid.
		setItem(item)
		return true
	}

	// Reverse direction.
	nextTs := y.ParseTs(mi.Key())
	mik := y.ParseKey(mi.Key())
	if nextTs <= it.readTs && bytes.Equal(mik, item.key) {
		// This is a valid potential candidate.
		goto FILL
	}
	// Ignore the next candidate. Return the current one.
	setItem(item)
	return true
}

func (it *Iterator) fill(item *Item) {
	vs := it.iitr.Value()
	item.meta = vs.Meta
	item.userMeta = vs.UserMeta
	item.expiresAt = vs.ExpiresAt

	item.version = y.ParseTs(it.iitr.Key())
	item.key = y.SafeCopy(item.key, y.ParseKey(it.iitr.Key()))

	item.vptr = y.SafeCopy(item.vptr, vs.Value)
	item.val = nil
	if it.opt.PrefetchValues {
		item.wg.Add(1)
		go func() {
			// FIXME we are not handling errors here.
			item.prefetchValue()
			item.wg.Done()
		}()
	}
}

func hasPrefix(it *Iterator) bool {
	// We shouldn't check prefix in case the iterator is going in reverse. Since in reverse we expect
	// people to append items to the end of prefix.
	if !it.opt.Reverse && len(it.opt.Prefix) > 0 {
		return bytes.HasPrefix(y.ParseKey(it.iitr.Key()), it.opt.Prefix)
	}
	return true
}

func (it *Iterator) prefetch() {
	prefetchSize := 2
	if it.opt.PrefetchValues && it.opt.PrefetchSize > 1 {
		prefetchSize = it.opt.PrefetchSize
	}

	i := it.iitr
	var count int
	it.item = nil
	for i.Valid() && hasPrefix(it) {
		if !it.parseItem() {
			continue
		}
		count++
		if count == prefetchSize {
			break
		}
	}
}

// Seek would seek to the provided key if present. If absent, it would seek to the next
// smallest key greater than the provided key if iterating in the forward direction.
// Behavior would be reversed if iterating backwards.
func (it *Iterator) Seek(key []byte) {
	if it.iitr == nil {
		return
	}
	if len(key) > 0 {
		it.txn.addReadKey(key)
	}
	for i := it.data.pop(); i != nil; i = it.data.pop() {
		i.wg.Wait()
		it.waste.push(i)
	}

	it.lastKey = it.lastKey[:0]
	if len(key) == 0 {
		key = it.opt.Prefix
	}
	if len(key) == 0 {
		it.iitr.Rewind()
		it.prefetch()
		return
	}

	if !it.opt.Reverse {
		key = y.KeyWithTs(key, it.txn.readTs)
	} else {
		key = y.KeyWithTs(key, 0)
	}
	it.iitr.Seek(key)
	it.prefetch()
}

// Rewind would rewind the iterator cursor all the way to zero-th position, which would be the
// smallest key if iterating forward, and largest if iterating backward. It does not keep track of
// whether the cursor started with a Seek().
func (it *Iterator) Rewind() {
	it.Seek(nil)
}
