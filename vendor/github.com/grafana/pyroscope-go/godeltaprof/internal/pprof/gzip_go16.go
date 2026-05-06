//go:build go1.16 && !go1.17
// +build go1.16,!go1.17

package pprof

import (
	"compress/gzip"
	"io"
)

type gzipWriter struct {
	*gzip.Writer
}

func newGzipWriter(w io.Writer) gzipWriter {
	zw, _ := gzip.NewWriterLevel(w, gzip.BestSpeed)
	return gzipWriter{zw}
}
