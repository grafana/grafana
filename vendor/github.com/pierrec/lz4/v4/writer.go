package lz4

import (
	"io"

	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
	"github.com/pierrec/lz4/v4/internal/lz4stream"
)

var writerStates = []aState{
	noState:     newState,
	newState:    writeState,
	writeState:  closedState,
	closedState: newState,
	errorState:  newState,
}

// NewWriter returns a new LZ4 frame encoder.
func NewWriter(w io.Writer) *Writer {
	zw := &Writer{frame: lz4stream.NewFrame()}
	zw.state.init(writerStates)
	_ = zw.Apply(DefaultBlockSizeOption, DefaultChecksumOption, DefaultConcurrency, defaultOnBlockDone)
	zw.Reset(w)
	return zw
}

// Writer allows writing an LZ4 stream.
type Writer struct {
	state   _State
	src     io.Writer                 // destination writer
	level   lz4block.CompressionLevel // how hard to try
	num     int                       // concurrency level
	frame   *lz4stream.Frame          // frame being built
	data    []byte                    // pending data
	idx     int                       // size of pending data
	handler func(int)
	legacy  bool
}

func (*Writer) private() {}

func (w *Writer) Apply(options ...Option) (err error) {
	defer w.state.check(&err)
	switch w.state.state {
	case newState:
	case errorState:
		return w.state.err
	default:
		return lz4errors.ErrOptionClosedOrError
	}
	w.Reset(w.src)
	for _, o := range options {
		if err = o(w); err != nil {
			return
		}
	}
	return
}

func (w *Writer) isNotConcurrent() bool {
	return w.num == 1
}

// init sets up the Writer when in newState. It does not change the Writer state.
func (w *Writer) init() error {
	w.frame.InitW(w.src, w.num, w.legacy)
	size := w.frame.Descriptor.Flags.BlockSizeIndex()
	w.data = size.Get()
	w.idx = 0
	return w.frame.Descriptor.Write(w.frame, w.src)
}

func (w *Writer) Write(buf []byte) (n int, err error) {
	defer w.state.check(&err)
	switch w.state.state {
	case writeState:
	case closedState, errorState:
		return 0, w.state.err
	case newState:
		if err = w.init(); w.state.next(err) {
			return
		}
	default:
		return 0, w.state.fail()
	}

	zn := len(w.data)
	for len(buf) > 0 {
		if w.isNotConcurrent() && w.idx == 0 && len(buf) >= zn {
			// Avoid a copy as there is enough data for a block.
			if err = w.write(buf[:zn], false); err != nil {
				return
			}
			n += zn
			buf = buf[zn:]
			continue
		}
		// Accumulate the data to be compressed.
		m := copy(w.data[w.idx:], buf)
		n += m
		w.idx += m
		buf = buf[m:]

		if w.idx < len(w.data) {
			// Buffer not filled.
			return
		}

		// Buffer full.
		if err = w.write(w.data, true); err != nil {
			return
		}
		if !w.isNotConcurrent() {
			size := w.frame.Descriptor.Flags.BlockSizeIndex()
			w.data = size.Get()
		}
		w.idx = 0
	}
	return
}

func (w *Writer) write(data []byte, safe bool) error {
	if w.isNotConcurrent() {
		block := w.frame.Blocks.Block
		err := block.Compress(w.frame, data, w.level).Write(w.frame, w.src)
		w.handler(len(block.Data))
		return err
	}
	c := make(chan *lz4stream.FrameDataBlock)
	w.frame.Blocks.Blocks <- c
	go func(c chan *lz4stream.FrameDataBlock, data []byte, safe bool) {
		b := lz4stream.NewFrameDataBlock(w.frame)
		c <- b.Compress(w.frame, data, w.level)
		<-c
		w.handler(len(b.Data))
		b.Close(w.frame)
		if safe {
			// safe to put it back as the last usage of it was FrameDataBlock.Write() called before c is closed
			lz4block.Put(data)
		}
	}(c, data, safe)

	return nil
}

// Flush any buffered data to the underlying writer immediately.
func (w *Writer) Flush() (err error) {
	switch w.state.state {
	case writeState:
	case errorState:
		return w.state.err
	case newState:
		if err = w.init(); w.state.next(err) {
			return
		}
	default:
		return nil
	}

	if w.idx > 0 {
		// Flush pending data, disable w.data freeing as it is done later on.
		if err = w.write(w.data[:w.idx], false); err != nil {
			return err
		}
		w.idx = 0
	}
	return nil
}

// Close closes the Writer, flushing any unwritten data to the underlying writer
// without closing it.
func (w *Writer) Close() error {
	if err := w.Flush(); err != nil {
		return err
	}
	err := w.frame.CloseW(w.src, w.num)
	// It is now safe to free the buffer.
	if w.data != nil {
		lz4block.Put(w.data)
		w.data = nil
	}
	return err
}

// Reset clears the state of the Writer w such that it is equivalent to its
// initial state from NewWriter, but instead writing to writer.
// Reset keeps the previous options unless overwritten by the supplied ones.
// No access to writer is performed.
//
// w.Close must be called before Reset or pending data may be dropped.
func (w *Writer) Reset(writer io.Writer) {
	w.frame.Reset(w.num)
	w.state.reset()
	w.src = writer
}

// ReadFrom efficiently reads from r and compressed into the Writer destination.
func (w *Writer) ReadFrom(r io.Reader) (n int64, err error) {
	switch w.state.state {
	case closedState, errorState:
		return 0, w.state.err
	case newState:
		if err = w.init(); w.state.next(err) {
			return
		}
	default:
		return 0, w.state.fail()
	}
	defer w.state.check(&err)

	size := w.frame.Descriptor.Flags.BlockSizeIndex()
	var done bool
	var rn int
	data := size.Get()
	if w.isNotConcurrent() {
		// Keep the same buffer for the whole process.
		defer lz4block.Put(data)
	}
	for !done {
		rn, err = io.ReadFull(r, data)
		switch err {
		case nil:
		case io.EOF, io.ErrUnexpectedEOF: // read may be partial
			done = true
		default:
			return
		}
		n += int64(rn)
		err = w.write(data[:rn], true)
		if err != nil {
			return
		}
		w.handler(rn)
		if !done && !w.isNotConcurrent() {
			// The buffer will be returned automatically by go routines (safe=true)
			// so get a new one fo the next round.
			data = size.Get()
		}
	}
	return
}
