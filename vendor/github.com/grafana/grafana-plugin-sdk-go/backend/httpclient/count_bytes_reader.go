package httpclient

import (
	"io"
)

type CloseCallbackFunc func(bytesRead int64)

// CountBytesReader counts the total amount of bytes read from the underlying reader.
//
// The provided callback func will be called before the underlying reader is closed.
func CountBytesReader(reader io.ReadCloser, callback CloseCallbackFunc) io.ReadCloser {
	if reader == nil {
		panic("reader cannot be nil")
	}

	if callback == nil {
		panic("callback cannot be nil")
	}

	return &countBytesReader{reader: reader, callback: callback}
}

type countBytesReader struct {
	reader   io.ReadCloser
	callback CloseCallbackFunc
	counter  int64
}

func (r *countBytesReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.counter += int64(n)
	return n, err
}

func (r *countBytesReader) Close() error {
	r.callback(r.counter)
	return r.reader.Close()
}
