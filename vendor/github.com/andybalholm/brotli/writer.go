package brotli

import (
	"errors"
	"io"

	"github.com/andybalholm/brotli/matchfinder"
)

const (
	BestSpeed          = 0
	BestCompression    = 11
	DefaultCompression = 6
)

// WriterOptions configures Writer.
type WriterOptions struct {
	// Quality controls the compression-speed vs compression-density trade-offs.
	// The higher the quality, the slower the compression. Range is 0 to 11.
	Quality int
	// LGWin is the base 2 logarithm of the sliding window size.
	// Range is 10 to 24. 0 indicates automatic configuration based on Quality.
	LGWin int
}

var (
	errEncode       = errors.New("brotli: encode error")
	errWriterClosed = errors.New("brotli: Writer is closed")
)

// Writes to the returned writer are compressed and written to dst.
// It is the caller's responsibility to call Close on the Writer when done.
// Writes may be buffered and not flushed until Close.
func NewWriter(dst io.Writer) *Writer {
	return NewWriterLevel(dst, DefaultCompression)
}

// NewWriterLevel is like NewWriter but specifies the compression level instead
// of assuming DefaultCompression.
// The compression level can be DefaultCompression or any integer value between
// BestSpeed and BestCompression inclusive.
func NewWriterLevel(dst io.Writer, level int) *Writer {
	return NewWriterOptions(dst, WriterOptions{
		Quality: level,
	})
}

// NewWriterOptions is like NewWriter but specifies WriterOptions
func NewWriterOptions(dst io.Writer, options WriterOptions) *Writer {
	w := new(Writer)
	w.options = options
	w.Reset(dst)
	return w
}

// Reset discards the Writer's state and makes it equivalent to the result of
// its original state from NewWriter or NewWriterLevel, but writing to dst
// instead. This permits reusing a Writer rather than allocating a new one.
func (w *Writer) Reset(dst io.Writer) {
	encoderInitState(w)
	w.params.quality = w.options.Quality
	if w.options.LGWin > 0 {
		w.params.lgwin = uint(w.options.LGWin)
	}
	w.dst = dst
	w.err = nil
}

func (w *Writer) writeChunk(p []byte, op int) (n int, err error) {
	if w.dst == nil {
		return 0, errWriterClosed
	}
	if w.err != nil {
		return 0, w.err
	}

	for {
		availableIn := uint(len(p))
		nextIn := p
		success := encoderCompressStream(w, op, &availableIn, &nextIn)
		bytesConsumed := len(p) - int(availableIn)
		p = p[bytesConsumed:]
		n += bytesConsumed
		if !success {
			return n, errEncode
		}

		if len(p) == 0 || w.err != nil {
			return n, w.err
		}
	}
}

// Flush outputs encoded data for all input provided to Write. The resulting
// output can be decoded to match all input before Flush, but the stream is
// not yet complete until after Close.
// Flush has a negative impact on compression.
func (w *Writer) Flush() error {
	_, err := w.writeChunk(nil, operationFlush)
	return err
}

// Close flushes remaining data to the decorated writer.
func (w *Writer) Close() error {
	// If stream is already closed, it is reported by `writeChunk`.
	_, err := w.writeChunk(nil, operationFinish)
	w.dst = nil
	return err
}

// Write implements io.Writer. Flush or Close must be called to ensure that the
// encoded bytes are actually flushed to the underlying Writer.
func (w *Writer) Write(p []byte) (n int, err error) {
	return w.writeChunk(p, operationProcess)
}

type nopCloser struct {
	io.Writer
}

func (nopCloser) Close() error { return nil }

// NewWriterV2 is like NewWriterLevel, but it uses the new implementation
// based on the matchfinder package. It currently supports up to level 9;
// if a higher level is specified, level 9 will be used.
func NewWriterV2(dst io.Writer, level int) *matchfinder.Writer {
	var mf matchfinder.MatchFinder
	if level < 2 {
		mf = matchfinder.M0{Lazy: level == 1}
	} else if level < 8 {
		hashLen := 6
		if level >= 6 {
			hashLen = 5
		}
		chainLen := 16
		switch level {
		case 2:
			chainLen = 0
		case 3:
			chainLen = 1
		case 4:
			chainLen = 2
		case 5:
			chainLen = 4
		case 6:
			chainLen = 8
		}
		mf = &matchfinder.M4{
			MaxDistance:     1 << 20,
			ChainLength:     chainLen,
			HashLen:         hashLen,
			DistanceBitCost: 66,
		}
	} else {
		chainLen := 32
		hashLen := 5
		if level == 8 {
			chainLen = 4
			hashLen = 6
		}
		mf = &matchfinder.Pathfinder{
			MaxDistance: 1 << 20,
			ChainLength: chainLen,
			HashLen:     hashLen,
		}
	}

	return &matchfinder.Writer{
		Dest:        dst,
		MatchFinder: mf,
		Encoder:     &Encoder{},
		BlockSize:   1 << 16,
	}
}
