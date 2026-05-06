package lz4

import (
	"bytes"
	"io"

	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
	"github.com/pierrec/lz4/v4/internal/lz4stream"
)

var readerStates = []aState{
	noState:     newState,
	errorState:  newState,
	newState:    readState,
	readState:   closedState,
	closedState: newState,
}

// NewReader returns a new LZ4 frame decoder.
func NewReader(r io.Reader) *Reader {
	return newReader(r, false)
}

func newReader(r io.Reader, legacy bool) *Reader {
	zr := &Reader{frame: lz4stream.NewFrame()}
	zr.state.init(readerStates)
	_ = zr.Apply(DefaultConcurrency, defaultOnBlockDone)
	zr.Reset(r)
	return zr
}

// Reader allows reading an LZ4 stream.
type Reader struct {
	state   _State
	src     io.Reader        // source reader
	num     int              // concurrency level
	frame   *lz4stream.Frame // frame being read
	data    []byte           // block buffer allocated in non concurrent mode
	reads   chan []byte      // pending data
	idx     int              // size of pending data
	handler func(int)
	cum     uint32
	dict    []byte
}

func (*Reader) private() {}

func (r *Reader) Apply(options ...Option) (err error) {
	defer r.state.check(&err)
	switch r.state.state {
	case newState:
	case errorState:
		return r.state.err
	default:
		return lz4errors.ErrOptionClosedOrError
	}
	for _, o := range options {
		if err = o(r); err != nil {
			return
		}
	}
	return
}

// Size returns the size of the underlying uncompressed data, if set in the stream.
func (r *Reader) Size() int {
	switch r.state.state {
	case readState, closedState:
		if r.frame.Descriptor.Flags.Size() {
			return int(r.frame.Descriptor.ContentSize)
		}
	}
	return 0
}

func (r *Reader) isNotConcurrent() bool {
	return r.num == 1
}

func (r *Reader) init() error {
	err := r.frame.ParseHeaders(r.src)
	if err != nil {
		return err
	}
	if !r.frame.Descriptor.Flags.BlockIndependence() {
		// We can't decompress dependent blocks concurrently.
		// Instead of throwing an error to the user, silently drop concurrency
		r.num = 1
	}
	data, err := r.frame.InitR(r.src, r.num)
	if err != nil {
		return err
	}
	r.reads = data
	r.idx = 0
	size := r.frame.Descriptor.Flags.BlockSizeIndex()
	r.data = size.Get()
	r.cum = 0
	return nil
}

func (r *Reader) Read(buf []byte) (n int, err error) {
	defer r.state.check(&err)
	switch r.state.state {
	case readState:
	case closedState, errorState:
		return 0, r.state.err
	case newState:
		// First initialization.
		if err = r.init(); r.state.next(err) {
			return
		}
	default:
		return 0, r.state.fail()
	}
	for len(buf) > 0 {
		var bn int
		if r.idx == 0 {
			if r.isNotConcurrent() {
				bn, err = r.read(buf)
			} else {
				lz4block.Put(r.data)
				r.data = <-r.reads
				if len(r.data) == 0 {
					// No uncompressed data: something went wrong or we are done.
					err = r.frame.Blocks.ErrorR()
				}
			}
			switch err {
			case nil:
			case io.EOF:
				if er := r.frame.CloseR(r.src); er != nil {
					err = er
				}
				lz4block.Put(r.data)
				r.data = nil
				return
			default:
				return
			}
		}
		if bn == 0 {
			// Fill buf with buffered data.
			bn = copy(buf, r.data[r.idx:])
			r.idx += bn
			if r.idx == len(r.data) {
				// All data read, get ready for the next Read.
				r.idx = 0
			}
		}
		buf = buf[bn:]
		n += bn
		r.handler(bn)
	}
	return
}

// read uncompresses the next block as follow:
// - if buf has enough room, the block is uncompressed into it directly
//   and the lenght of used space is returned
// - else, the uncompress data is stored in r.data and 0 is returned
func (r *Reader) read(buf []byte) (int, error) {
	block := r.frame.Blocks.Block
	_, err := block.Read(r.frame, r.src, r.cum)
	if err != nil {
		return 0, err
	}
	var direct bool
	dst := r.data[:cap(r.data)]
	if len(buf) >= len(dst) {
		// Uncompress directly into buf.
		direct = true
		dst = buf
	}
	dst, err = block.Uncompress(r.frame, dst, r.dict, true)
	if err != nil {
		return 0, err
	}
	if !r.frame.Descriptor.Flags.BlockIndependence() {
		if len(r.dict)+len(dst) > 128*1024 {
			preserveSize := 64*1024 - len(dst)
			if preserveSize < 0 {
				preserveSize = 0
			}
			r.dict = r.dict[len(r.dict)-preserveSize:]
		}
		r.dict = append(r.dict, dst...)
	}
	r.cum += uint32(len(dst))
	if direct {
		return len(dst), nil
	}
	r.data = dst
	return 0, nil
}

// Reset clears the state of the Reader r such that it is equivalent to its
// initial state from NewReader, but instead reading from reader.
// No access to reader is performed.
func (r *Reader) Reset(reader io.Reader) {
	if r.data != nil {
		lz4block.Put(r.data)
		r.data = nil
	}
	r.frame.Reset(r.num)
	r.state.reset()
	r.src = reader
	r.reads = nil
}

// WriteTo efficiently uncompresses the data from the Reader underlying source to w.
func (r *Reader) WriteTo(w io.Writer) (n int64, err error) {
	switch r.state.state {
	case closedState, errorState:
		return 0, r.state.err
	case newState:
		if err = r.init(); r.state.next(err) {
			return
		}
	default:
		return 0, r.state.fail()
	}
	defer r.state.nextd(&err)

	var data []byte
	if r.isNotConcurrent() {
		size := r.frame.Descriptor.Flags.BlockSizeIndex()
		data = size.Get()
		defer lz4block.Put(data)
	}
	for {
		var bn int
		var dst []byte
		if r.isNotConcurrent() {
			bn, err = r.read(data)
			dst = data[:bn]
		} else {
			lz4block.Put(dst)
			dst = <-r.reads
			bn = len(dst)
			if bn == 0 {
				// No uncompressed data: something went wrong or we are done.
				err = r.frame.Blocks.ErrorR()
			}
		}
		switch err {
		case nil:
		case io.EOF:
			err = r.frame.CloseR(r.src)
			return
		default:
			return
		}
		r.handler(bn)
		bn, err = w.Write(dst)
		n += int64(bn)
		if err != nil {
			return
		}
	}
}

// ValidFrameHeader returns a bool indicating if the given bytes slice matches a LZ4 header.
func ValidFrameHeader(in []byte) (bool, error) {
	f := lz4stream.NewFrame()
	err := f.ParseHeaders(bytes.NewReader(in))
	if err == nil {
		return true, nil
	}
	if err == lz4errors.ErrInvalidFrame {
		return false, nil
	}
	return false, err
}
