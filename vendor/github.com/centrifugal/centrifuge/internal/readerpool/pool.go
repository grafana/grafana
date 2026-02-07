package readerpool

import (
	"bytes"
	"strings"
	"sync"
)

var stringReaderPool sync.Pool

// GetStringReader from pool.
func GetStringReader(data string) *strings.Reader {
	r := bytesReaderPool.Get()
	if r == nil {
		return strings.NewReader(data)
	}
	reader := r.(*strings.Reader)
	reader.Reset(data)
	return reader
}

// PutStringReader to pool.
func PutStringReader(reader *strings.Reader) {
	reader.Reset("")
	stringReaderPool.Put(reader)
}

var bytesReaderPool sync.Pool

// GetBytesReader from pool.
func GetBytesReader(data []byte) *bytes.Reader {
	r := bytesReaderPool.Get()
	if r == nil {
		return bytes.NewReader(data)
	}
	reader := r.(*bytes.Reader)
	reader.Reset(data)
	return reader
}

// PutBytesReader to pool.
func PutBytesReader(reader *bytes.Reader) {
	reader.Reset(nil)
	bytesReaderPool.Put(reader)
}
