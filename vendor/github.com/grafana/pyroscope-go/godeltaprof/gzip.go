package godeltaprof

import (
	"io"

	"github.com/klauspost/compress/gzip"
)

type gz struct {
	w *gzip.Writer
}

func (g *gz) get(w io.Writer) *gzip.Writer {
	if g.w == nil {
		zw, _ := gzip.NewWriterLevel(w, gzip.BestSpeed)
		g.w = zw
	}
	g.w.Reset(w)

	return g.w
}
