package vfsgen

import (
	"io"
)

// stringWriter writes given bytes to underlying io.Writer as a Go interpreted string literal value,
// not including double quotes. It tracks the total number of bytes written.
type stringWriter struct {
	io.Writer
	N int64 // Total bytes written.
}

func (sw *stringWriter) Write(p []byte) (n int, err error) {
	const hex = "0123456789abcdef"
	buf := []byte{'\\', 'x', 0, 0}
	for _, b := range p {
		buf[2], buf[3] = hex[b/16], hex[b%16]
		_, err = sw.Writer.Write(buf)
		if err != nil {
			return n, err
		}
		n++
		sw.N++
	}
	return n, nil
}
