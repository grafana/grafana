/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sync2

import (
	"time"
)

// Batcher delays concurrent operations for a configurable interval in order to
// batch them up or otherwise clock their operation to run concurrently.
//
// It is implemented as a channel of int32s. Each waiter blocks on the channel
// from which it gets a sequentially increasing batch ID when the timer elapses.
//
// Hence a waiter is delayed for at most the batch interval.
type Batcher struct {
	interval time.Duration
	queue    chan int
	waiters  AtomicInt32
	nextID   AtomicInt32
	after    func(time.Duration) <-chan time.Time
}

// NewBatcher returns a new Batcher
func NewBatcher(interval time.Duration) *Batcher {
	return &Batcher{
		interval: interval,
		queue:    make(chan int),
		waiters:  NewAtomicInt32(0),
		nextID:   NewAtomicInt32(0),
		after:    time.After,
	}
}

// newBatcherForTest returns a Batcher for testing where time.After can
// be replaced by a fake alternative.
func newBatcherForTest(interval time.Duration, after func(time.Duration) <-chan time.Time) *Batcher {
	return &Batcher{
		interval: interval,
		queue:    make(chan int),
		waiters:  NewAtomicInt32(0),
		nextID:   NewAtomicInt32(0),
		after:    after,
	}
}

// Wait adds a new waiter to the queue and blocks until the next batch
func (b *Batcher) Wait() int {
	numWaiters := b.waiters.Add(1)
	if numWaiters == 1 {
		b.newBatch()
	}
	return <-b.queue
}

// newBatch starts a new batch
func (b *Batcher) newBatch() {
	go func() {
		<-b.after(b.interval)

		id := b.nextID.Add(1)

		// Make sure to atomically reset the number of waiters to make
		// sure that all incoming requests either make it into the
		// current batch or the next one.
		waiters := b.waiters.Get()
		for !b.waiters.CompareAndSwap(waiters, 0) {
			waiters = b.waiters.Get()
		}

		for i := int32(0); i < waiters; i++ {
			b.queue <- int(id)
		}
	}()
}
