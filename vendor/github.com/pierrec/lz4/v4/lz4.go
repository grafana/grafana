// Package lz4 implements reading and writing lz4 compressed data.
//
// The package supports both the LZ4 stream format,
// as specified in http://fastcompression.blogspot.fr/2013/04/lz4-streaming-format-final.html,
// and the LZ4 block format, defined at
// http://fastcompression.blogspot.fr/2011/05/lz4-explained.html.
//
// See https://github.com/lz4/lz4 for the reference C implementation.
package lz4

import (
	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
)

func _() {
	// Safety checks for duplicated elements.
	var x [1]struct{}
	_ = x[lz4block.CompressionLevel(Fast)-lz4block.Fast]
	_ = x[Block64Kb-BlockSize(lz4block.Block64Kb)]
	_ = x[Block256Kb-BlockSize(lz4block.Block256Kb)]
	_ = x[Block1Mb-BlockSize(lz4block.Block1Mb)]
	_ = x[Block4Mb-BlockSize(lz4block.Block4Mb)]
}

// CompressBlockBound returns the maximum size of a given buffer of size n, when not compressible.
func CompressBlockBound(n int) int {
	return lz4block.CompressBlockBound(n)
}

// UncompressBlock uncompresses the source buffer into the destination one,
// and returns the uncompressed size.
//
// The destination buffer must be sized appropriately.
//
// An error is returned if the source data is invalid or the destination buffer is too small.
func UncompressBlock(src, dst []byte) (int, error) {
	return lz4block.UncompressBlock(src, dst, nil)
}

// UncompressBlockWithDict uncompresses the source buffer into the destination one using a
// dictionary, and returns the uncompressed size.
//
// The destination buffer must be sized appropriately.
//
// An error is returned if the source data is invalid or the destination buffer is too small.
func UncompressBlockWithDict(src, dst, dict []byte) (int, error) {
	return lz4block.UncompressBlock(src, dst, dict)
}

// A Compressor compresses data into the LZ4 block format.
// It uses a fast compression algorithm.
//
// A Compressor is not safe for concurrent use by multiple goroutines.
//
// Use a Writer to compress into the LZ4 stream format.
type Compressor struct{ c lz4block.Compressor }

// CompressBlock compresses the source buffer src into the destination dst.
//
// If compression is successful, the first return value is the size of the
// compressed data, which is always >0.
//
// If dst has length at least CompressBlockBound(len(src)), compression always
// succeeds. Otherwise, the first return value is zero. The error return is
// non-nil if the compressed data does not fit in dst, but it might fit in a
// larger buffer that is still smaller than CompressBlockBound(len(src)). The
// return value (0, nil) means the data is likely incompressible and a buffer
// of length CompressBlockBound(len(src)) should be passed in.
func (c *Compressor) CompressBlock(src, dst []byte) (int, error) {
	return c.c.CompressBlock(src, dst)
}

// CompressBlock compresses the source buffer into the destination one.
// This is the fast version of LZ4 compression and also the default one.
//
// The argument hashTable is scratch space for a hash table used by the
// compressor. If provided, it should have length at least 1<<16. If it is
// shorter (or nil), CompressBlock allocates its own hash table.
//
// The size of the compressed data is returned.
//
// If the destination buffer size is lower than CompressBlockBound and
// the compressed size is 0 and no error, then the data is incompressible.
//
// An error is returned if the destination buffer is too small.

// CompressBlock is equivalent to Compressor.CompressBlock.
// The final argument is ignored and should be set to nil.
//
// This function is deprecated. Use a Compressor instead.
func CompressBlock(src, dst []byte, _ []int) (int, error) {
	return lz4block.CompressBlock(src, dst)
}

// A CompressorHC compresses data into the LZ4 block format.
// Its compression ratio is potentially better than that of a Compressor,
// but it is also slower and requires more memory.
//
// A Compressor is not safe for concurrent use by multiple goroutines.
//
// Use a Writer to compress into the LZ4 stream format.
type CompressorHC struct {
	// Level is the maximum search depth for compression.
	// Values <= 0 mean no maximum.
	Level CompressionLevel
	c     lz4block.CompressorHC
}

// CompressBlock compresses the source buffer src into the destination dst.
//
// If compression is successful, the first return value is the size of the
// compressed data, which is always >0.
//
// If dst has length at least CompressBlockBound(len(src)), compression always
// succeeds. Otherwise, the first return value is zero. The error return is
// non-nil if the compressed data does not fit in dst, but it might fit in a
// larger buffer that is still smaller than CompressBlockBound(len(src)). The
// return value (0, nil) means the data is likely incompressible and a buffer
// of length CompressBlockBound(len(src)) should be passed in.
func (c *CompressorHC) CompressBlock(src, dst []byte) (int, error) {
	return c.c.CompressBlock(src, dst, lz4block.CompressionLevel(c.Level))
}

// CompressBlockHC is equivalent to CompressorHC.CompressBlock.
// The final two arguments are ignored and should be set to nil.
//
// This function is deprecated. Use a CompressorHC instead.
func CompressBlockHC(src, dst []byte, depth CompressionLevel, _, _ []int) (int, error) {
	return lz4block.CompressBlockHC(src, dst, lz4block.CompressionLevel(depth))
}

const (
	// ErrInvalidSourceShortBuffer is returned by UncompressBlock or CompressBLock when a compressed
	// block is corrupted or the destination buffer is not large enough for the uncompressed data.
	ErrInvalidSourceShortBuffer = lz4errors.ErrInvalidSourceShortBuffer
	// ErrInvalidFrame is returned when reading an invalid LZ4 archive.
	ErrInvalidFrame = lz4errors.ErrInvalidFrame
	// ErrInternalUnhandledState is an internal error.
	ErrInternalUnhandledState = lz4errors.ErrInternalUnhandledState
	// ErrInvalidHeaderChecksum is returned when reading a frame.
	ErrInvalidHeaderChecksum = lz4errors.ErrInvalidHeaderChecksum
	// ErrInvalidBlockChecksum is returned when reading a frame.
	ErrInvalidBlockChecksum = lz4errors.ErrInvalidBlockChecksum
	// ErrInvalidFrameChecksum is returned when reading a frame.
	ErrInvalidFrameChecksum = lz4errors.ErrInvalidFrameChecksum
	// ErrOptionInvalidCompressionLevel is returned when the supplied compression level is invalid.
	ErrOptionInvalidCompressionLevel = lz4errors.ErrOptionInvalidCompressionLevel
	// ErrOptionClosedOrError is returned when an option is applied to a closed or in error object.
	ErrOptionClosedOrError = lz4errors.ErrOptionClosedOrError
	// ErrOptionInvalidBlockSize is returned when
	ErrOptionInvalidBlockSize = lz4errors.ErrOptionInvalidBlockSize
	// ErrOptionNotApplicable is returned when trying to apply an option to an object not supporting it.
	ErrOptionNotApplicable = lz4errors.ErrOptionNotApplicable
	// ErrWriterNotClosed is returned when attempting to reset an unclosed writer.
	ErrWriterNotClosed = lz4errors.ErrWriterNotClosed
)
