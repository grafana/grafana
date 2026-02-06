package lz4

import (
	"fmt"
	"reflect"
	"runtime"

	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
)

//go:generate go run golang.org/x/tools/cmd/stringer -type=BlockSize,CompressionLevel -output options_gen.go

type (
	applier interface {
		Apply(...Option) error
		private()
	}
	// Option defines the parameters to setup an LZ4 Writer or Reader.
	Option func(applier) error
)

// String returns a string representation of the option with its parameter(s).
func (o Option) String() string {
	return o(nil).Error()
}

// Default options.
var (
	DefaultBlockSizeOption = BlockSizeOption(Block4Mb)
	DefaultChecksumOption  = ChecksumOption(true)
	DefaultConcurrency     = ConcurrencyOption(1)
	defaultOnBlockDone     = OnBlockDoneOption(nil)
)

const (
	Block64Kb BlockSize = 1 << (16 + iota*2)
	Block256Kb
	Block1Mb
	Block4Mb
)

// BlockSizeIndex defines the size of the blocks to be compressed.
type BlockSize uint32

// BlockSizeOption defines the maximum size of compressed blocks (default=Block4Mb).
func BlockSizeOption(size BlockSize) Option {
	return func(a applier) error {
		switch w := a.(type) {
		case nil:
			s := fmt.Sprintf("BlockSizeOption(%s)", size)
			return lz4errors.Error(s)
		case *Writer:
			size := uint32(size)
			if !lz4block.IsValid(size) {
				return fmt.Errorf("%w: %d", lz4errors.ErrOptionInvalidBlockSize, size)
			}
			w.frame.Descriptor.Flags.BlockSizeIndexSet(lz4block.Index(size))
			return nil
		case *CompressingReader:
			size := uint32(size)
			if !lz4block.IsValid(size) {
				return fmt.Errorf("%w: %d", lz4errors.ErrOptionInvalidBlockSize, size)
			}
			w.frame.Descriptor.Flags.BlockSizeIndexSet(lz4block.Index(size))
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// BlockChecksumOption enables or disables block checksum (default=false).
func BlockChecksumOption(flag bool) Option {
	return func(a applier) error {
		switch w := a.(type) {
		case nil:
			s := fmt.Sprintf("BlockChecksumOption(%v)", flag)
			return lz4errors.Error(s)
		case *Writer:
			w.frame.Descriptor.Flags.BlockChecksumSet(flag)
			return nil
		case *CompressingReader:
			w.frame.Descriptor.Flags.BlockChecksumSet(flag)
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// ChecksumOption enables/disables all blocks or content checksum (default=true).
func ChecksumOption(flag bool) Option {
	return func(a applier) error {
		switch w := a.(type) {
		case nil:
			s := fmt.Sprintf("ChecksumOption(%v)", flag)
			return lz4errors.Error(s)
		case *Writer:
			w.frame.Descriptor.Flags.ContentChecksumSet(flag)
			return nil
		case *CompressingReader:
			w.frame.Descriptor.Flags.ContentChecksumSet(flag)
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// SizeOption sets the size of the original uncompressed data (default=0). It is useful to know the size of the
// whole uncompressed data stream.
func SizeOption(size uint64) Option {
	return func(a applier) error {
		switch w := a.(type) {
		case nil:
			s := fmt.Sprintf("SizeOption(%d)", size)
			return lz4errors.Error(s)
		case *Writer:
			w.frame.Descriptor.Flags.SizeSet(size > 0)
			w.frame.Descriptor.ContentSize = size
			return nil
		case *CompressingReader:
			w.frame.Descriptor.Flags.SizeSet(size > 0)
			w.frame.Descriptor.ContentSize = size
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// ConcurrencyOption sets the number of go routines used for compression.
// If n <= 0, then the output of runtime.GOMAXPROCS(0) is used.
func ConcurrencyOption(n int) Option {
	if n <= 0 {
		n = runtime.GOMAXPROCS(0)
	}
	return func(a applier) error {
		switch rw := a.(type) {
		case nil:
			s := fmt.Sprintf("ConcurrencyOption(%d)", n)
			return lz4errors.Error(s)
		case *Writer:
			rw.num = n
			return nil
		case *Reader:
			rw.num = n
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// CompressionLevel defines the level of compression to use. The higher the better, but slower, compression.
type CompressionLevel uint32

const (
	Fast   CompressionLevel = 0
	Level1 CompressionLevel = 1 << (8 + iota)
	Level2
	Level3
	Level4
	Level5
	Level6
	Level7
	Level8
	Level9
)

// CompressionLevelOption defines the compression level (default=Fast).
func CompressionLevelOption(level CompressionLevel) Option {
	return func(a applier) error {
		switch w := a.(type) {
		case nil:
			s := fmt.Sprintf("CompressionLevelOption(%s)", level)
			return lz4errors.Error(s)
		case *Writer:
			switch level {
			case Fast, Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9:
			default:
				return fmt.Errorf("%w: %d", lz4errors.ErrOptionInvalidCompressionLevel, level)
			}
			w.level = lz4block.CompressionLevel(level)
			return nil
		case *CompressingReader:
			switch level {
			case Fast, Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9:
			default:
				return fmt.Errorf("%w: %d", lz4errors.ErrOptionInvalidCompressionLevel, level)
			}
			w.level = lz4block.CompressionLevel(level)
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

func onBlockDone(int) {}

// OnBlockDoneOption is triggered when a block has been processed. For a Writer, it is when is has been compressed,
// for a Reader, it is when it has been uncompressed.
func OnBlockDoneOption(handler func(size int)) Option {
	if handler == nil {
		handler = onBlockDone
	}
	return func(a applier) error {
		switch rw := a.(type) {
		case nil:
			s := fmt.Sprintf("OnBlockDoneOption(%s)", reflect.TypeOf(handler).String())
			return lz4errors.Error(s)
		case *Writer:
			rw.handler = handler
			return nil
		case *Reader:
			rw.handler = handler
			return nil
		case *CompressingReader:
			rw.handler = handler
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}

// LegacyOption provides support for writing LZ4 frames in the legacy format.
//
// See https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md#legacy-frame.
//
// NB. compressed Linux kernel images use a tweaked LZ4 legacy format where
// the compressed stream is followed by the original (uncompressed) size of
// the kernel (https://events.static.linuxfound.org/sites/events/files/lcjpcojp13_klee.pdf).
// This is also supported as a special case.
func LegacyOption(legacy bool) Option {
	return func(a applier) error {
		switch rw := a.(type) {
		case nil:
			s := fmt.Sprintf("LegacyOption(%v)", legacy)
			return lz4errors.Error(s)
		case *Writer:
			rw.legacy = legacy
			return nil
		}
		return lz4errors.ErrOptionNotApplicable
	}
}
