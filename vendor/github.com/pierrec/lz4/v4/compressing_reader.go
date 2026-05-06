package lz4

import (
	"errors"
	"io"

	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
	"github.com/pierrec/lz4/v4/internal/lz4stream"
)

type crState int

const (
	crStateInitial crState = iota
	crStateReading 
	crStateFlushing
	crStateDone
)

type CompressingReader struct {
	state crState
	src io.ReadCloser // source reader
	level lz4block.CompressionLevel // how hard to try
	frame *lz4stream.Frame // frame being built
	in []byte
	out ovWriter
	handler func(int)
}

// NewCompressingReader creates a reader which reads compressed data from
// raw stream. This makes it a logical opposite of a normal lz4.Reader.
// We require an io.ReadCloser as an underlying source for compatibility
// with Go's http.Request.
func NewCompressingReader(src io.ReadCloser) *CompressingReader {
	zrd := &CompressingReader {
		frame: lz4stream.NewFrame(),
	}

	_ = zrd.Apply(DefaultBlockSizeOption, DefaultChecksumOption, defaultOnBlockDone)
	zrd.Reset(src)

	return zrd
}

// Source exposes the underlying source stream for introspection and control.
func (zrd *CompressingReader) Source() io.ReadCloser {
	return zrd.src
}

// Close simply invokes the underlying stream Close method. This method is
// provided for the benefit of Go http client/server, which relies on Close
// for goroutine termination.
func (zrd *CompressingReader) Close() error {
	return zrd.src.Close()
}

// Apply applies useful options to the lz4 encoder.
func (zrd *CompressingReader) Apply(options ...Option) (err error) {
	if zrd.state != crStateInitial {
		return lz4errors.ErrOptionClosedOrError
	}

	zrd.Reset(zrd.src)

	for _, o := range options {
		if err = o(zrd); err != nil {
			return
		}
	}
	return
}

func (*CompressingReader) private() {}

func (zrd *CompressingReader) init() error {
	zrd.frame.InitW(&zrd.out, 1, false)
	size := zrd.frame.Descriptor.Flags.BlockSizeIndex()
	zrd.in = size.Get()
	return zrd.frame.Descriptor.Write(zrd.frame, &zrd.out)
}

// Read allows reading of lz4 compressed data
func (zrd *CompressingReader) Read(p []byte) (n int, err error) {
	defer func() {
		if err != nil {
			zrd.state = crStateDone
		}
	}()

	if !zrd.out.reset(p) {
		return len(p), nil
	}

	switch zrd.state {
	case crStateInitial:
		err = zrd.init()
		if err != nil {
			return
		}
		zrd.state = crStateReading
	case crStateDone:
		return 0, errors.New("This reader is done")
	case crStateFlushing:
		if zrd.out.dataPos > 0 {
			n = zrd.out.dataPos
			zrd.out.data = nil
			zrd.out.dataPos = 0
			return
		} else {
			zrd.state = crStateDone
			return 0, io.EOF
		}
	}

	for zrd.state == crStateReading {
		block := zrd.frame.Blocks.Block

		var rCount int
		rCount, err = io.ReadFull(zrd.src, zrd.in)
		switch err {
		case nil:
			err = block.Compress(
				zrd.frame, zrd.in[ : rCount], zrd.level,
			).Write(zrd.frame, &zrd.out)
			zrd.handler(len(block.Data))
			if err != nil {
				return
			}

			if zrd.out.dataPos == len(zrd.out.data) {
				n = zrd.out.dataPos
				zrd.out.dataPos = 0
				zrd.out.data = nil
				return
			}
		case io.EOF, io.ErrUnexpectedEOF: // read may be partial
			if rCount > 0 {
				err = block.Compress(
					zrd.frame, zrd.in[ : rCount], zrd.level,
				).Write(zrd.frame, &zrd.out)
				zrd.handler(len(block.Data))
				if err != nil {
					return
				}
			}

			err = zrd.frame.CloseW(&zrd.out, 1)
			if err != nil {
				return
			}
			zrd.state = crStateFlushing

			n = zrd.out.dataPos
			zrd.out.dataPos = 0
			zrd.out.data = nil
			return
		default:
			return
		}
	}

	err = lz4errors.ErrInternalUnhandledState
	return
}

// Reset makes the stream usable again; mostly handy to reuse lz4 encoder
// instances.
func (zrd *CompressingReader) Reset(src io.ReadCloser) {
	zrd.frame.Reset(1)
	zrd.state = crStateInitial
	zrd.src = src
	zrd.out.clear()
}

type ovWriter struct {
	data []byte
	ov []byte
	dataPos int
	ovPos int
}

func (wr *ovWriter) Write(p []byte) (n int, err error) {
	count := copy(wr.data[wr.dataPos : ], p)
	wr.dataPos += count

	if count < len(p) {
		wr.ov = append(wr.ov, p[count : ]...)
	}

	return len(p), nil
}

func (wr *ovWriter) reset(out []byte) bool {
	ovRem := len(wr.ov) - wr.ovPos

	if ovRem >= len(out) {
		wr.ovPos += copy(out, wr.ov[wr.ovPos : ])
		return false
	}

	if ovRem > 0 {
		copy(out, wr.ov[wr.ovPos : ])
		wr.ov = wr.ov[ : 0]
		wr.ovPos = 0
		wr.dataPos = ovRem
	} else if wr.ovPos > 0 {
		wr.ov = wr.ov[ : 0]
		wr.ovPos = 0
		wr.dataPos = 0
	}

	wr.data = out
	return true
}

func (wr *ovWriter) clear() {
	wr.data = nil
	wr.dataPos = 0
	wr.ov = wr.ov[ : 0]
	wr.ovPos = 0
}
