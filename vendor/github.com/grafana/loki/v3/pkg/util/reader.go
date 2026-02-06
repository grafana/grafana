package util

import (
	"io"
)

type sizeReader struct {
	size int64
	r    io.Reader
}

type SizeReader interface {
	io.Reader
	Size() int64
}

// NewSizeReader returns an io.Reader that will have the number of bytes
// read from r available.
func NewSizeReader(r io.Reader) SizeReader {
	return &sizeReader{r: r}
}

func (v *sizeReader) Read(p []byte) (int, error) {
	n, err := v.r.Read(p)
	v.size += int64(n)
	return n, err
}

func (v *sizeReader) Size() int64 {
	return v.size
}
