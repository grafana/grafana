package internal

import (
	"sync"
)

var (
	// ByteInputAdapterPool shared pool
	ByteInputAdapterPool = sync.Pool{
		New: func() interface{} {
			return &ByteInputAdapter{}
		},
	}

	// ByteBufferPool shared pool
	ByteBufferPool = sync.Pool{
		New: func() interface{} {
			return &ByteBuffer{}
		},
	}
)
