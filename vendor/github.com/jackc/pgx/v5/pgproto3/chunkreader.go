package pgproto3

import (
	"io"

	"github.com/jackc/pgx/v5/internal/iobufpool"
)

// chunkReader is a io.Reader wrapper that minimizes IO reads and memory allocations. It allocates memory in chunks and
// will read as much as will fit in the current buffer in a single call regardless of how large a read is actually
// requested. The memory returned via Next is only valid until the next call to Next.
//
// This is roughly equivalent to a bufio.Reader that only uses Peek and Discard to never copy bytes.
type chunkReader struct {
	r io.Reader

	buf    *[]byte
	rp, wp int // buf read position and write position

	minBufSize int
}

// newChunkReader creates and returns a new chunkReader for r with default configuration. If minBufSize is <= 0 it uses
// a default value.
func newChunkReader(r io.Reader, minBufSize int) *chunkReader {
	if minBufSize <= 0 {
		// By historical reasons Postgres currently has 8KB send buffer inside,
		// so here we want to have at least the same size buffer.
		// @see https://github.com/postgres/postgres/blob/249d64999615802752940e017ee5166e726bc7cd/src/backend/libpq/pqcomm.c#L134
		// @see https://www.postgresql.org/message-id/0cdc5485-cb3c-5e16-4a46-e3b2f7a41322%40ya.ru
		//
		// In addition, testing has found no benefit of any larger buffer.
		minBufSize = 8192
	}

	return &chunkReader{
		r:          r,
		minBufSize: minBufSize,
		buf:        iobufpool.Get(minBufSize),
	}
}

// Next returns buf filled with the next n bytes. buf is only valid until next call of Next. If an error occurs, buf
// will be nil.
func (r *chunkReader) Next(n int) (buf []byte, err error) {
	// Reset the buffer if it is empty
	if r.rp == r.wp {
		if len(*r.buf) != r.minBufSize {
			iobufpool.Put(r.buf)
			r.buf = iobufpool.Get(r.minBufSize)
		}
		r.rp = 0
		r.wp = 0
	}

	// n bytes already in buf
	if (r.wp - r.rp) >= n {
		buf = (*r.buf)[r.rp : r.rp+n : r.rp+n]
		r.rp += n
		return buf, err
	}

	// buf is smaller than requested number of bytes
	if len(*r.buf) < n {
		bigBuf := iobufpool.Get(n)
		r.wp = copy((*bigBuf), (*r.buf)[r.rp:r.wp])
		r.rp = 0
		iobufpool.Put(r.buf)
		r.buf = bigBuf
	}

	// buf is large enough, but need to shift filled area to start to make enough contiguous space
	minReadCount := n - (r.wp - r.rp)
	if (len(*r.buf) - r.wp) < minReadCount {
		r.wp = copy((*r.buf), (*r.buf)[r.rp:r.wp])
		r.rp = 0
	}

	// Read at least the required number of bytes from the underlying io.Reader
	readBytesCount, err := io.ReadAtLeast(r.r, (*r.buf)[r.wp:], minReadCount)
	r.wp += readBytesCount
	// fmt.Println("read", n)
	if err != nil {
		return nil, err
	}

	buf = (*r.buf)[r.rp : r.rp+n : r.rp+n]
	r.rp += n
	return buf, nil
}
