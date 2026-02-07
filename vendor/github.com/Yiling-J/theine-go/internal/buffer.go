// Copyright (c) 2024 Yiling-J. All rights reserved.
// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package internal

import (
	"runtime"
	"sync/atomic"
	"unsafe"

	"github.com/Yiling-J/theine-go/internal/xruntime"
)

const (
	// The maximum number of elements per buffer.
	capacity = 16
	mask     = uint64(capacity - 1)
)

func castToPointer[K comparable, V any](ptr unsafe.Pointer) *ReadBufItem[K, V] {
	return (*ReadBufItem[K, V])(ptr)
}

// PolicyBuffers is the set of buffers returned by the lossy buffer.
type PolicyBuffers[K comparable, V any] struct {
	Returned []ReadBufItem[K, V]
}

// Buffer is a circular ring buffer stores the elements being transferred by the producers to the consumer.
// The monotonically increasing count of reads and writes allow indexing sequentially to the next
// element location based upon a power-of-two sizing.
//
// The producers race to read the counts, check if there is available capacity, and if so then try
// once to CAS to the next write count. If the increment is successful then the producer lazily
// publishes the element. The producer does not retry or block when unsuccessful due to a failed
// CAS or the buffer being full.
//
// The consumer reads the counts and takes the available elements. The clearing of the elements
// and the next read count are lazily set.
//
// This implementation is striped to further increase concurrency.
type Buffer[K comparable, V any] struct {
	head atomic.Uint64
	// headPadding
	_    [xruntime.CacheLineSize - unsafe.Sizeof(atomic.Uint64{})]byte
	tail atomic.Uint64
	// tailPadding
	_        [xruntime.CacheLineSize - unsafe.Sizeof(atomic.Uint64{})]byte
	returned unsafe.Pointer
	// returnedPadding
	_             [xruntime.CacheLineSize - 8]byte
	policyBuffers unsafe.Pointer
	// returnedSlicePadding
	_      [xruntime.CacheLineSize - 8]byte
	buffer [capacity]unsafe.Pointer
}

// New creates a new lossy Buffer.
func NewBuffer[K comparable, V any]() *Buffer[K, V] {
	pb := &PolicyBuffers[K, V]{
		Returned: make([]ReadBufItem[K, V], 0, capacity),
	}
	b := &Buffer[K, V]{
		policyBuffers: unsafe.Pointer(pb),
	}
	b.returned = b.policyBuffers
	return b
}

// Add lazily publishes the item to the consumer.
//
// item may be lost due to contention.
func (b *Buffer[K, V]) Add(n ReadBufItem[K, V]) *PolicyBuffers[K, V] {
	head := b.head.Load()
	tail := b.tail.Load()
	size := tail - head
	if size >= capacity {
		// full buffer
		return nil
	}
	if b.tail.CompareAndSwap(tail, tail+1) {
		// success
		index := int(tail & mask)
		atomic.StorePointer(&b.buffer[index], unsafe.Pointer(&ReadBufItem[K, V]{
			entry: n.entry,
			hash:  n.hash,
		}))
		if size == capacity-1 {
			// try return new buffer
			if !atomic.CompareAndSwapPointer(&b.returned, b.policyBuffers, nil) {
				// somebody already get buffer
				return nil
			}

			pb := (*PolicyBuffers[K, V])(b.policyBuffers)
			for i := 0; i < capacity; i++ {
				index := int(head & mask)
				v := atomic.LoadPointer(&b.buffer[index])
				if v != nil {
					// published
					pb.Returned = append(pb.Returned, *castToPointer[K, V](v))
					// release
					atomic.StorePointer(&b.buffer[index], nil)
				}
				head++
			}

			b.head.Store(head)
			return pb
		}
	}

	// failed
	return nil
}

// Load all items in buffer, used in test only to update policy proactive proactively
func (b *Buffer[K, V]) items() []ReadBufItem[K, V] {
	head := b.head.Load()
	returned := []ReadBufItem[K, V]{}
	// try return new buffer
	for _, pt := range b.buffer {
		// #nosec G601
		v := atomic.LoadPointer(&pt)
		if v != nil {
			returned = append(returned, *castToPointer[K, V](v))
		}
		head++
	}

	return returned
}

// Free returns the processed buffer back and also clears it.
func (b *Buffer[K, V]) Free() {
	pb := (*PolicyBuffers[K, V])(b.policyBuffers)
	for i := 0; i < len(pb.Returned); i++ {
		pb.Returned[i].entry = nil
		pb.Returned[i].hash = 0
	}
	pb.Returned = pb.Returned[:0]
	atomic.StorePointer(&b.returned, b.policyBuffers)
}

// Clear clears the lossy Buffer and returns it to the default state.
func (b *Buffer[K, V]) Clear() {
	for !atomic.CompareAndSwapPointer(&b.returned, b.policyBuffers, nil) {
		runtime.Gosched()
	}
	for i := 0; i < capacity; i++ {
		atomic.StorePointer(&b.buffer[i], nil)
	}
	b.Free()
	b.tail.Store(0)
	b.head.Store(0)
}
