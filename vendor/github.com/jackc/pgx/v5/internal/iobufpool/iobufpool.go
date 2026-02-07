// Package iobufpool implements a global segregated-fit pool of buffers for IO.
//
// It uses *[]byte instead of []byte to avoid the sync.Pool allocation with Put. Unfortunately, using a pointer to avoid
// an allocation is purposely not documented. https://github.com/golang/go/issues/16323
package iobufpool

import "sync"

const minPoolExpOf2 = 8

var pools [18]*sync.Pool

func init() {
	for i := range pools {
		bufLen := 1 << (minPoolExpOf2 + i)
		pools[i] = &sync.Pool{
			New: func() any {
				buf := make([]byte, bufLen)
				return &buf
			},
		}
	}
}

// Get gets a []byte of len size with cap <= size*2.
func Get(size int) *[]byte {
	i := getPoolIdx(size)
	if i >= len(pools) {
		buf := make([]byte, size)
		return &buf
	}

	ptrBuf := (pools[i].Get().(*[]byte))
	*ptrBuf = (*ptrBuf)[:size]

	return ptrBuf
}

func getPoolIdx(size int) int {
	size--
	size >>= minPoolExpOf2
	i := 0
	for size > 0 {
		size >>= 1
		i++
	}

	return i
}

// Put returns buf to the pool.
func Put(buf *[]byte) {
	i := putPoolIdx(cap(*buf))
	if i < 0 {
		return
	}

	pools[i].Put(buf)
}

func putPoolIdx(size int) int {
	minPoolSize := 1 << minPoolExpOf2
	for i := range pools {
		if size == minPoolSize<<i {
			return i
		}
	}

	return -1
}
