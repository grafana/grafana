// Copyright 2020 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package tsdb

import (
	"sync"
)

// isolationState holds the isolation information.
type isolationState struct {
	// We will ignore all appends above the max, or that are incomplete.
	maxAppendID       uint64
	incompleteAppends map[uint64]struct{}
	lowWatermark      uint64 // Lowest of incompleteAppends/maxAppendID.
	isolation         *isolation

	// Doubly linked list of active reads.
	next *isolationState
	prev *isolationState
}

// Close closes the state.
func (i *isolationState) Close() {
	i.isolation.readMtx.Lock()
	defer i.isolation.readMtx.Unlock()
	i.next.prev = i.prev
	i.prev.next = i.next
}

type isolationAppender struct {
	appendID uint64
	prev     *isolationAppender
	next     *isolationAppender
}

// isolation is the global isolation state.
type isolation struct {
	// Mutex for accessing lastAppendID and appendsOpen.
	appendMtx sync.RWMutex
	// Which appends are currently in progress.
	appendsOpen map[uint64]*isolationAppender
	// New appenders with higher appendID are added to the end. First element keeps lastAppendId.
	// appendsOpenList.next points to the first element and appendsOpenList.prev points to the last element.
	// If there are no appenders, both point back to appendsOpenList.
	appendsOpenList *isolationAppender
	// Pool of reusable *isolationAppender to save on allocations.
	appendersPool sync.Pool

	// Mutex for accessing readsOpen.
	// If taking both appendMtx and readMtx, take appendMtx first.
	readMtx sync.RWMutex
	// All current in use isolationStates. This is a doubly-linked list.
	readsOpen *isolationState
}

func newIsolation() *isolation {
	isoState := &isolationState{}
	isoState.next = isoState
	isoState.prev = isoState

	appender := &isolationAppender{}
	appender.next = appender
	appender.prev = appender

	return &isolation{
		appendsOpen:     map[uint64]*isolationAppender{},
		appendsOpenList: appender,
		readsOpen:       isoState,
		appendersPool:   sync.Pool{New: func() interface{} { return &isolationAppender{} }},
	}
}

// lowWatermark returns the appendID below which we no longer need to track
// which appends were from which appendID.
func (i *isolation) lowWatermark() uint64 {
	i.appendMtx.RLock() // Take appendMtx first.
	defer i.appendMtx.RUnlock()
	i.readMtx.RLock()
	defer i.readMtx.RUnlock()
	if i.readsOpen.prev != i.readsOpen {
		return i.readsOpen.prev.lowWatermark
	}

	// Lowest appendID from appenders, or lastAppendId.
	return i.appendsOpenList.next.appendID
}

// State returns an object used to control isolation
// between a query and appends. Must be closed when complete.
func (i *isolation) State() *isolationState {
	i.appendMtx.RLock() // Take append mutex before read mutex.
	defer i.appendMtx.RUnlock()
	isoState := &isolationState{
		maxAppendID:       i.appendsOpenList.appendID,
		lowWatermark:      i.appendsOpenList.next.appendID, // Lowest appendID from appenders, or lastAppendId.
		incompleteAppends: make(map[uint64]struct{}, len(i.appendsOpen)),
		isolation:         i,
	}
	for k := range i.appendsOpen {
		isoState.incompleteAppends[k] = struct{}{}
	}

	i.readMtx.Lock()
	defer i.readMtx.Unlock()
	isoState.prev = i.readsOpen
	isoState.next = i.readsOpen.next
	i.readsOpen.next.prev = isoState
	i.readsOpen.next = isoState
	return isoState
}

// newAppendID increments the transaction counter and returns a new transaction
// ID. The first ID returned is 1.
func (i *isolation) newAppendID() uint64 {
	i.appendMtx.Lock()
	defer i.appendMtx.Unlock()

	// Last used appendID is stored in head element.
	i.appendsOpenList.appendID++

	app := i.appendersPool.Get().(*isolationAppender)
	app.appendID = i.appendsOpenList.appendID
	app.prev = i.appendsOpenList.prev
	app.next = i.appendsOpenList

	i.appendsOpenList.prev.next = app
	i.appendsOpenList.prev = app

	i.appendsOpen[app.appendID] = app
	return app.appendID
}

func (i *isolation) lastAppendID() uint64 {
	i.appendMtx.RLock()
	defer i.appendMtx.RUnlock()

	return i.appendsOpenList.appendID
}

func (i *isolation) closeAppend(appendID uint64) {
	i.appendMtx.Lock()
	defer i.appendMtx.Unlock()

	app := i.appendsOpen[appendID]
	if app != nil {
		app.prev.next = app.next
		app.next.prev = app.prev

		delete(i.appendsOpen, appendID)

		// Clear all fields, and return to the pool.
		*app = isolationAppender{}
		i.appendersPool.Put(app)
	}
}

// The transactionID ring buffer.
type txRing struct {
	txIDs     []uint64
	txIDFirst int // Position of the first id in the ring.
	txIDCount int // How many ids in the ring.
}

func newTxRing(cap int) *txRing {
	return &txRing{
		txIDs: make([]uint64, cap),
	}
}

func (txr *txRing) add(appendID uint64) {
	if txr.txIDCount == len(txr.txIDs) {
		// Ring buffer is full, expand by doubling.
		newRing := make([]uint64, txr.txIDCount*2)
		idx := copy(newRing[:], txr.txIDs[txr.txIDFirst:])
		copy(newRing[idx:], txr.txIDs[:txr.txIDFirst])
		txr.txIDs = newRing
		txr.txIDFirst = 0
	}

	txr.txIDs[(txr.txIDFirst+txr.txIDCount)%len(txr.txIDs)] = appendID
	txr.txIDCount++
}

func (txr *txRing) cleanupAppendIDsBelow(bound uint64) {
	pos := txr.txIDFirst

	for txr.txIDCount > 0 {
		if txr.txIDs[pos] < bound {
			txr.txIDFirst++
			txr.txIDCount--
		} else {
			break
		}

		pos++
		if pos == len(txr.txIDs) {
			pos = 0
		}
	}

	txr.txIDFirst %= len(txr.txIDs)
}

func (txr *txRing) iterator() *txRingIterator {
	return &txRingIterator{
		pos: txr.txIDFirst,
		ids: txr.txIDs,
	}
}

// txRingIterator lets you iterate over the ring. It doesn't terminate,
// it DOESN'T terminate.
type txRingIterator struct {
	ids []uint64

	pos int
}

func (it *txRingIterator) At() uint64 {
	return it.ids[it.pos]
}

func (it *txRingIterator) Next() {
	it.pos++
	if it.pos == len(it.ids) {
		it.pos = 0
	}
}
