/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package table

import (
	"bytes"
	"fmt"
	"io"
	"sort"

	"github.com/dgraph-io/badger/v4/fb"
	"github.com/dgraph-io/badger/v4/y"
)

type blockIterator struct {
	data         []byte
	idx          int // Idx of the entry inside a block
	err          error
	baseKey      []byte
	key          []byte
	val          []byte
	entryOffsets []uint32
	block        *Block

	tableID uint64
	blockID int
	// prevOverlap stores the overlap of the previous key with the base key.
	// This avoids unnecessary copy of base key when the overlap is same for multiple keys.
	prevOverlap uint16
}

func (itr *blockIterator) setBlock(b *Block) {
	// Decrement the ref for the old block. If the old block was compressed, we
	// might be able to reuse it.
	itr.block.decrRef()

	itr.block = b
	itr.err = nil
	itr.idx = 0
	itr.baseKey = itr.baseKey[:0]
	itr.prevOverlap = 0
	itr.key = itr.key[:0]
	itr.val = itr.val[:0]
	// Drop the index from the block. We don't need it anymore.
	itr.data = b.data[:b.entriesIndexStart]
	itr.entryOffsets = b.entryOffsets
}

// setIdx sets the iterator to the entry at index i and set it's key and value.
func (itr *blockIterator) setIdx(i int) {
	itr.idx = i
	if i >= len(itr.entryOffsets) || i < 0 {
		itr.err = io.EOF
		return
	}
	itr.err = nil
	startOffset := int(itr.entryOffsets[i])

	// Set base key.
	if len(itr.baseKey) == 0 {
		var baseHeader header
		baseHeader.Decode(itr.data)
		itr.baseKey = itr.data[headerSize : headerSize+baseHeader.diff]
	}

	var endOffset int
	// idx points to the last entry in the block.
	if itr.idx+1 == len(itr.entryOffsets) {
		endOffset = len(itr.data)
	} else {
		// idx point to some entry other than the last one in the block.
		// EndOffset of the current entry is the start offset of the next entry.
		endOffset = int(itr.entryOffsets[itr.idx+1])
	}
	defer func() {
		if r := recover(); r != nil {
			var debugBuf bytes.Buffer
			fmt.Fprintf(&debugBuf, "==== Recovered====\n")
			fmt.Fprintf(&debugBuf, "Table ID: %d\nBlock ID: %d\nEntry Idx: %d\nData len: %d\n"+
				"StartOffset: %d\nEndOffset: %d\nEntryOffsets len: %d\nEntryOffsets: %v\n",
				itr.tableID, itr.blockID, itr.idx, len(itr.data), startOffset, endOffset,
				len(itr.entryOffsets), itr.entryOffsets)
			panic(debugBuf.String())
		}
	}()

	entryData := itr.data[startOffset:endOffset]
	var h header
	h.Decode(entryData)
	// Header contains the length of key overlap and difference compared to the base key. If the key
	// before this one had the same or better key overlap, we can avoid copying that part into
	// itr.key. But, if the overlap was lesser, we could copy over just that portion.
	if h.overlap > itr.prevOverlap {
		itr.key = append(itr.key[:itr.prevOverlap], itr.baseKey[itr.prevOverlap:h.overlap]...)
	}
	itr.prevOverlap = h.overlap
	valueOff := headerSize + h.diff
	diffKey := entryData[headerSize:valueOff]
	itr.key = append(itr.key[:h.overlap], diffKey...)
	itr.val = entryData[valueOff:]
}

func (itr *blockIterator) Valid() bool {
	return itr != nil && itr.err == nil
}

func (itr *blockIterator) Error() error {
	return itr.err
}

func (itr *blockIterator) Close() {
	itr.block.decrRef()
}

var (
	origin  = 0
	current = 1
)

// seek brings us to the first block element that is >= input key.
func (itr *blockIterator) seek(key []byte, whence int) {
	itr.err = nil
	startIndex := 0 // This tells from which index we should start binary search.

	switch whence {
	case origin:
		// We don't need to do anything. startIndex is already at 0
	case current:
		startIndex = itr.idx
	}

	foundEntryIdx := sort.Search(len(itr.entryOffsets), func(idx int) bool {
		// If idx is less than start index then just return false.
		if idx < startIndex {
			return false
		}
		itr.setIdx(idx)
		return y.CompareKeys(itr.key, key) >= 0
	})
	itr.setIdx(foundEntryIdx)
}

// seekToFirst brings us to the first element.
func (itr *blockIterator) seekToFirst() {
	itr.setIdx(0)
}

// seekToLast brings us to the last element.
func (itr *blockIterator) seekToLast() {
	itr.setIdx(len(itr.entryOffsets) - 1)
}

func (itr *blockIterator) next() {
	itr.setIdx(itr.idx + 1)
}

func (itr *blockIterator) prev() {
	itr.setIdx(itr.idx - 1)
}

// Iterator is an iterator for a Table.
type Iterator struct {
	t    *Table
	bpos int
	bi   blockIterator
	err  error

	// Internally, Iterator is bidirectional. However, we only expose the
	// unidirectional functionality for now.
	opt int // Valid options are REVERSED and NOCACHE.
}

// NewIterator returns a new iterator of the Table
func (t *Table) NewIterator(opt int) *Iterator {
	t.IncrRef() // Important.
	ti := &Iterator{t: t, opt: opt}
	return ti
}

// Close closes the iterator (and it must be called).
func (itr *Iterator) Close() error {
	itr.bi.Close()
	return itr.t.DecrRef()
}

func (itr *Iterator) reset() {
	itr.bpos = 0
	itr.err = nil
}

// Valid follows the y.Iterator interface
func (itr *Iterator) Valid() bool {
	return itr.err == nil
}

func (itr *Iterator) useCache() bool {
	return itr.opt&NOCACHE == 0
}

func (itr *Iterator) seekToFirst() {
	numBlocks := itr.t.offsetsLength()
	if numBlocks == 0 {
		itr.err = io.EOF
		return
	}
	itr.bpos = 0
	block, err := itr.t.block(itr.bpos, itr.useCache())
	if err != nil {
		itr.err = err
		return
	}
	itr.bi.tableID = itr.t.id
	itr.bi.blockID = itr.bpos
	itr.bi.setBlock(block)
	itr.bi.seekToFirst()
	itr.err = itr.bi.Error()
}

func (itr *Iterator) seekToLast() {
	numBlocks := itr.t.offsetsLength()
	if numBlocks == 0 {
		itr.err = io.EOF
		return
	}
	itr.bpos = numBlocks - 1
	block, err := itr.t.block(itr.bpos, itr.useCache())
	if err != nil {
		itr.err = err
		return
	}
	itr.bi.tableID = itr.t.id
	itr.bi.blockID = itr.bpos
	itr.bi.setBlock(block)
	itr.bi.seekToLast()
	itr.err = itr.bi.Error()
}

func (itr *Iterator) seekHelper(blockIdx int, key []byte) {
	itr.bpos = blockIdx
	block, err := itr.t.block(blockIdx, itr.useCache())
	if err != nil {
		itr.err = err
		return
	}
	itr.bi.tableID = itr.t.id
	itr.bi.blockID = itr.bpos
	itr.bi.setBlock(block)
	itr.bi.seek(key, origin)
	itr.err = itr.bi.Error()
}

// seekFrom brings us to a key that is >= input key.
func (itr *Iterator) seekFrom(key []byte, whence int) {
	itr.err = nil
	switch whence {
	case origin:
		itr.reset()
	case current:
	}

	var ko fb.BlockOffset
	idx := sort.Search(itr.t.offsetsLength(), func(idx int) bool {
		// Offsets should never return false since we're iterating within the OffsetsLength.
		y.AssertTrue(itr.t.offsets(&ko, idx))
		return y.CompareKeys(ko.KeyBytes(), key) > 0
	})
	if idx == 0 {
		// The smallest key in our table is already strictly > key. We can return that.
		// This is like a SeekToFirst.
		itr.seekHelper(0, key)
		return
	}

	// block[idx].smallest is > key.
	// Since idx>0, we know block[idx-1].smallest is <= key.
	// There are two cases.
	// 1) Everything in block[idx-1] is strictly < key. In this case, we should go to the first
	//    element of block[idx].
	// 2) Some element in block[idx-1] is >= key. We should go to that element.
	itr.seekHelper(idx-1, key)
	if itr.err == io.EOF {
		// Case 1. Need to visit block[idx].
		if idx == itr.t.offsetsLength() {
			// If idx == len(itr.t.blockIndex), then input key is greater than ANY element of table.
			// There's nothing we can do. Valid() should return false as we seek to end of table.
			return
		}
		// Since block[idx].smallest is > key. This is essentially a block[idx].SeekToFirst.
		itr.seekHelper(idx, key)
	}
	// Case 2: No need to do anything. We already did the seek in block[idx-1].
}

// seek will reset iterator and seek to >= key.
func (itr *Iterator) seek(key []byte) {
	itr.seekFrom(key, origin)
}

// seekForPrev will reset iterator and seek to <= key.
func (itr *Iterator) seekForPrev(key []byte) {
	// TODO: Optimize this. We shouldn't have to take a Prev step.
	itr.seekFrom(key, origin)
	if !bytes.Equal(itr.Key(), key) {
		itr.prev()
	}
}

func (itr *Iterator) next() {
	itr.err = nil

	if itr.bpos >= itr.t.offsetsLength() {
		itr.err = io.EOF
		return
	}

	if len(itr.bi.data) == 0 {
		block, err := itr.t.block(itr.bpos, itr.useCache())
		if err != nil {
			itr.err = err
			return
		}
		itr.bi.tableID = itr.t.id
		itr.bi.blockID = itr.bpos
		itr.bi.setBlock(block)
		itr.bi.seekToFirst()
		itr.err = itr.bi.Error()
		return
	}

	itr.bi.next()
	if !itr.bi.Valid() {
		itr.bpos++
		itr.bi.data = nil
		itr.next()
		return
	}
}

func (itr *Iterator) prev() {
	itr.err = nil
	if itr.bpos < 0 {
		itr.err = io.EOF
		return
	}

	if len(itr.bi.data) == 0 {
		block, err := itr.t.block(itr.bpos, itr.useCache())
		if err != nil {
			itr.err = err
			return
		}
		itr.bi.tableID = itr.t.id
		itr.bi.blockID = itr.bpos
		itr.bi.setBlock(block)
		itr.bi.seekToLast()
		itr.err = itr.bi.Error()
		return
	}

	itr.bi.prev()
	if !itr.bi.Valid() {
		itr.bpos--
		itr.bi.data = nil
		itr.prev()
		return
	}
}

// Key follows the y.Iterator interface.
// Returns the key with timestamp.
func (itr *Iterator) Key() []byte {
	return itr.bi.key
}

// Value follows the y.Iterator interface
func (itr *Iterator) Value() (ret y.ValueStruct) {
	ret.Decode(itr.bi.val)
	return
}

// ValueCopy copies the current value and returns it as decoded
// ValueStruct.
func (itr *Iterator) ValueCopy() (ret y.ValueStruct) {
	dst := y.Copy(itr.bi.val)
	ret.Decode(dst)
	return
}

// Next follows the y.Iterator interface
func (itr *Iterator) Next() {
	if itr.opt&REVERSED == 0 {
		itr.next()
	} else {
		itr.prev()
	}
}

// Rewind follows the y.Iterator interface
func (itr *Iterator) Rewind() {
	if itr.opt&REVERSED == 0 {
		itr.seekToFirst()
	} else {
		itr.seekToLast()
	}
}

// Seek follows the y.Iterator interface
func (itr *Iterator) Seek(key []byte) {
	if itr.opt&REVERSED == 0 {
		itr.seek(key)
	} else {
		itr.seekForPrev(key)
	}
}

var (
	REVERSED int = 2
	NOCACHE  int = 4
)

// ConcatIterator concatenates the sequences defined by several iterators.  (It only works with
// TableIterators, probably just because it's faster to not be so generic.)
type ConcatIterator struct {
	idx     int // Which iterator is active now.
	cur     *Iterator
	iters   []*Iterator // Corresponds to tables.
	tables  []*Table    // Disregarding reversed, this is in ascending order.
	options int         // Valid options are REVERSED and NOCACHE.
}

// NewConcatIterator creates a new concatenated iterator
func NewConcatIterator(tbls []*Table, opt int) *ConcatIterator {
	iters := make([]*Iterator, len(tbls))
	for i := 0; i < len(tbls); i++ {
		// Increment the reference count. Since, we're not creating the iterator right now.
		// Here, We'll hold the reference of the tables, till the lifecycle of the iterator.
		tbls[i].IncrRef()

		// Save cycles by not initializing the iterators until needed.
		// iters[i] = tbls[i].NewIterator(reversed)
	}
	return &ConcatIterator{
		options: opt,
		iters:   iters,
		tables:  tbls,
		idx:     -1, // Not really necessary because s.it.Valid()=false, but good to have.
	}
}

func (s *ConcatIterator) setIdx(idx int) {
	s.idx = idx
	if idx < 0 || idx >= len(s.iters) {
		s.cur = nil
		return
	}
	if s.iters[idx] == nil {
		s.iters[idx] = s.tables[idx].NewIterator(s.options)
	}
	s.cur = s.iters[s.idx]
}

// Rewind implements y.Interface
func (s *ConcatIterator) Rewind() {
	if len(s.iters) == 0 {
		return
	}
	if s.options&REVERSED == 0 {
		s.setIdx(0)
	} else {
		s.setIdx(len(s.iters) - 1)
	}
	s.cur.Rewind()
}

// Valid implements y.Interface
func (s *ConcatIterator) Valid() bool {
	return s.cur != nil && s.cur.Valid()
}

// Key implements y.Interface
func (s *ConcatIterator) Key() []byte {
	return s.cur.Key()
}

// Value implements y.Interface
func (s *ConcatIterator) Value() y.ValueStruct {
	return s.cur.Value()
}

// Seek brings us to element >= key if reversed is false. Otherwise, <= key.
func (s *ConcatIterator) Seek(key []byte) {
	var idx int
	if s.options&REVERSED == 0 {
		idx = sort.Search(len(s.tables), func(i int) bool {
			return y.CompareKeys(s.tables[i].Biggest(), key) >= 0
		})
	} else {
		n := len(s.tables)
		idx = n - 1 - sort.Search(n, func(i int) bool {
			return y.CompareKeys(s.tables[n-1-i].Smallest(), key) <= 0
		})
	}
	if idx >= len(s.tables) || idx < 0 {
		s.setIdx(-1)
		return
	}
	// For reversed=false, we know s.tables[i-1].Biggest() < key. Thus, the
	// previous table cannot possibly contain key.
	s.setIdx(idx)
	s.cur.Seek(key)
}

// Next advances our concat iterator.
func (s *ConcatIterator) Next() {
	s.cur.Next()
	if s.cur.Valid() {
		// Nothing to do. Just stay with the current table.
		return
	}
	for { // In case there are empty tables.
		if s.options&REVERSED == 0 {
			s.setIdx(s.idx + 1)
		} else {
			s.setIdx(s.idx - 1)
		}
		if s.cur == nil {
			// End of list. Valid will become false.
			return
		}
		s.cur.Rewind()
		if s.cur.Valid() {
			break
		}
	}
}

// Close implements y.Interface.
func (s *ConcatIterator) Close() error {
	for _, t := range s.tables {
		// DeReference the tables while closing the iterator.
		if err := t.DecrRef(); err != nil {
			return err
		}
	}
	for _, it := range s.iters {
		if it == nil {
			continue
		}
		if err := it.Close(); err != nil {
			return y.Wrap(err, "ConcatIterator")
		}
	}
	return nil
}
