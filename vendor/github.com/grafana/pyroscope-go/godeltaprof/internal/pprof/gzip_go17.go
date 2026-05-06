//go:build go1.17
// +build go1.17

package pprof

import (
	"io"

	"github.com/klauspost/compress/gzip"
)

type gzipWriter struct {
	*gzip.Writer
}

func newGzipWriter(w io.Writer) gzipWriter {
	zw, _ := gzip.NewWriterLevel(w, gzip.BestSpeed)
	return gzipWriter{zw}
}
