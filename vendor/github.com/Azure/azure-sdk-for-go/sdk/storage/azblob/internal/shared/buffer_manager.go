//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package shared

type BufferManager[T ~[]byte] interface {
	// Acquire returns the channel that contains the pool of buffers.
	Acquire() <-chan T

	// Release releases the buffer back to the pool for reuse/cleanup.
	Release(T)

	// Grow grows the number of buffers, up to the predefined max.
	// It returns the total number of buffers or an error.
	// No error is returned if the number of buffers has reached max.
	// This is called only from the reading goroutine.
	Grow() (int, error)

	// Free cleans up all buffers.
	Free()
}

// mmbPool implements the bufferManager interface.
// it uses anonymous memory mapped files for buffers.
// don't use this type directly, use newMMBPool() instead.
type mmbPool struct {
	buffers chan Mmb
	count   int
	max     int
	size    int64
}

func NewMMBPool(maxBuffers int, bufferSize int64) BufferManager[Mmb] {
	return &mmbPool{
		buffers: make(chan Mmb, maxBuffers),
		max:     maxBuffers,
		size:    bufferSize,
	}
}

func (pool *mmbPool) Acquire() <-chan Mmb {
	return pool.buffers
}

func (pool *mmbPool) Grow() (int, error) {
	if pool.count < pool.max {
		buffer, err := NewMMB(pool.size)
		if err != nil {
			return 0, err
		}
		pool.buffers <- buffer
		pool.count++
	}
	return pool.count, nil
}

func (pool *mmbPool) Release(buffer Mmb) {
	pool.buffers <- buffer
}

func (pool *mmbPool) Free() {
	for i := 0; i < pool.count; i++ {
		buffer := <-pool.buffers
		buffer.Delete()
	}
	pool.count = 0
}
