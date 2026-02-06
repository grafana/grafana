// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019+ Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"runtime"
	"sync"
)

// ErrCantSeek is returned if the stream cannot be seeked.
type ErrCantSeek struct {
	Reason string
}

// Error returns the error as string.
func (e ErrCantSeek) Error() string {
	return fmt.Sprintf("s2: Can't seek because %s", e.Reason)
}

// NewReader returns a new Reader that decompresses from r, using the framing
// format described at
// https://github.com/google/snappy/blob/master/framing_format.txt with S2 changes.
func NewReader(r io.Reader, opts ...ReaderOption) *Reader {
	nr := Reader{
		r:        r,
		maxBlock: maxBlockSize,
	}
	for _, opt := range opts {
		if err := opt(&nr); err != nil {
			nr.err = err
			return &nr
		}
	}
	nr.maxBufSize = MaxEncodedLen(nr.maxBlock) + checksumSize
	if nr.lazyBuf > 0 {
		nr.buf = make([]byte, MaxEncodedLen(nr.lazyBuf)+checksumSize)
	} else {
		nr.buf = make([]byte, MaxEncodedLen(defaultBlockSize)+checksumSize)
	}
	nr.readHeader = nr.ignoreStreamID
	nr.paramsOK = true
	return &nr
}

// ReaderOption is an option for creating a decoder.
type ReaderOption func(*Reader) error

// ReaderMaxBlockSize allows to control allocations if the stream
// has been compressed with a smaller WriterBlockSize, or with the default 1MB.
// Blocks must be this size or smaller to decompress,
// otherwise the decoder will return ErrUnsupported.
//
// For streams compressed with Snappy this can safely be set to 64KB (64 << 10).
//
// Default is the maximum limit of 4MB.
func ReaderMaxBlockSize(blockSize int) ReaderOption {
	return func(r *Reader) error {
		if blockSize > maxBlockSize || blockSize <= 0 {
			return errors.New("s2: block size too large. Must be <= 4MB and > 0")
		}
		if r.lazyBuf == 0 && blockSize < defaultBlockSize {
			r.lazyBuf = blockSize
		}
		r.maxBlock = blockSize
		return nil
	}
}

// ReaderAllocBlock allows to control upfront stream allocations
// and not allocate for frames bigger than this initially.
// If frames bigger than this is seen a bigger buffer will be allocated.
//
// Default is 1MB, which is default output size.
func ReaderAllocBlock(blockSize int) ReaderOption {
	return func(r *Reader) error {
		if blockSize > maxBlockSize || blockSize < 1024 {
			return errors.New("s2: invalid ReaderAllocBlock. Must be <= 4MB and >= 1024")
		}
		r.lazyBuf = blockSize
		return nil
	}
}

// ReaderIgnoreStreamIdentifier will make the reader skip the expected
// stream identifier at the beginning of the stream.
// This can be used when serving a stream that has been forwarded to a specific point.
func ReaderIgnoreStreamIdentifier() ReaderOption {
	return func(r *Reader) error {
		r.ignoreStreamID = true
		return nil
	}
}

// ReaderSkippableCB will register a callback for chuncks with the specified ID.
// ID must be a Reserved skippable chunks ID, 0x80-0xfd (inclusive).
// For each chunk with the ID, the callback is called with the content.
// Any returned non-nil error will abort decompression.
// Only one callback per ID is supported, latest sent will be used.
// You can peek the stream, triggering the callback, by doing a Read with a 0
// byte buffer.
func ReaderSkippableCB(id uint8, fn func(r io.Reader) error) ReaderOption {
	return func(r *Reader) error {
		if id < 0x80 || id > 0xfd {
			return fmt.Errorf("ReaderSkippableCB: Invalid id provided, must be 0x80-0xfd (inclusive)")
		}
		r.skippableCB[id-0x80] = fn
		return nil
	}
}

// ReaderIgnoreCRC will make the reader skip CRC calculation and checks.
func ReaderIgnoreCRC() ReaderOption {
	return func(r *Reader) error {
		r.ignoreCRC = true
		return nil
	}
}

// Reader is an io.Reader that can read Snappy-compressed bytes.
type Reader struct {
	r           io.Reader
	err         error
	decoded     []byte
	buf         []byte
	skippableCB [0xff - 0x80]func(r io.Reader) error
	blockStart  int64 // Uncompressed offset at start of current.
	index       *Index

	// decoded[i:j] contains decoded bytes that have not yet been passed on.
	i, j int
	// maximum block size allowed.
	maxBlock int
	// maximum expected buffer size.
	maxBufSize int
	// alloc a buffer this size if > 0.
	lazyBuf        int
	readHeader     bool
	paramsOK       bool
	snappyFrame    bool
	ignoreStreamID bool
	ignoreCRC      bool
}

// GetBufferCapacity returns the capacity of the internal buffer.
// This might be useful to know when reusing the same reader in combination
// with the lazy buffer option.
func (r *Reader) GetBufferCapacity() int {
	return cap(r.buf)
}

// ensureBufferSize will ensure that the buffer can take at least n bytes.
// If false is returned the buffer exceeds maximum allowed size.
func (r *Reader) ensureBufferSize(n int) bool {
	if n > r.maxBufSize {
		r.err = ErrCorrupt
		return false
	}
	if cap(r.buf) >= n {
		return true
	}
	// Realloc buffer.
	r.buf = make([]byte, n)
	return true
}

// Reset discards any buffered data, resets all state, and switches the Snappy
// reader to read from r. This permits reusing a Reader rather than allocating
// a new one.
func (r *Reader) Reset(reader io.Reader) {
	if !r.paramsOK {
		return
	}
	r.index = nil
	r.r = reader
	r.err = nil
	r.i = 0
	r.j = 0
	r.blockStart = 0
	r.readHeader = r.ignoreStreamID
}

func (r *Reader) readFull(p []byte, allowEOF bool) (ok bool) {
	if _, r.err = io.ReadFull(r.r, p); r.err != nil {
		if r.err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
			r.err = ErrCorrupt
		}
		return false
	}
	return true
}

// skippable will skip n bytes.
// If the supplied reader supports seeking that is used.
// tmp is used as a temporary buffer for reading.
// The supplied slice does not need to be the size of the read.
func (r *Reader) skippable(tmp []byte, n int, allowEOF bool, id uint8) (ok bool) {
	if id < 0x80 {
		r.err = fmt.Errorf("internal error: skippable id < 0x80")
		return false
	}
	if fn := r.skippableCB[id-0x80]; fn != nil {
		rd := io.LimitReader(r.r, int64(n))
		r.err = fn(rd)
		if r.err != nil {
			return false
		}
		_, r.err = io.CopyBuffer(ioutil.Discard, rd, tmp)
		return r.err == nil
	}
	if rs, ok := r.r.(io.ReadSeeker); ok {
		_, err := rs.Seek(int64(n), io.SeekCurrent)
		if err == nil {
			return true
		}
		if err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
			r.err = ErrCorrupt
			return false
		}
	}
	for n > 0 {
		if n < len(tmp) {
			tmp = tmp[:n]
		}
		if _, r.err = io.ReadFull(r.r, tmp); r.err != nil {
			if r.err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
				r.err = ErrCorrupt
			}
			return false
		}
		n -= len(tmp)
	}
	return true
}

// Read satisfies the io.Reader interface.
func (r *Reader) Read(p []byte) (int, error) {
	if r.err != nil {
		return 0, r.err
	}
	for {
		if r.i < r.j {
			n := copy(p, r.decoded[r.i:r.j])
			r.i += n
			return n, nil
		}
		if !r.readFull(r.buf[:4], true) {
			return 0, r.err
		}
		chunkType := r.buf[0]
		if !r.readHeader {
			if chunkType != chunkTypeStreamIdentifier {
				r.err = ErrCorrupt
				return 0, r.err
			}
			r.readHeader = true
		}
		chunkLen := int(r.buf[1]) | int(r.buf[2])<<8 | int(r.buf[3])<<16

		// The chunk types are specified at
		// https://github.com/google/snappy/blob/master/framing_format.txt
		switch chunkType {
		case chunkTypeCompressedData:
			r.blockStart += int64(r.j)
			// Section 4.2. Compressed data (chunk type 0x00).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return 0, r.err
			}
			buf := r.buf[:chunkLen]
			if !r.readFull(buf, false) {
				return 0, r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			buf = buf[checksumSize:]

			n, err := DecodedLen(buf)
			if err != nil {
				r.err = err
				return 0, r.err
			}
			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}

			if n > len(r.decoded) {
				if n > r.maxBlock {
					r.err = ErrCorrupt
					return 0, r.err
				}
				r.decoded = make([]byte, n)
			}
			if _, err := Decode(r.decoded, buf); err != nil {
				r.err = err
				return 0, r.err
			}
			if !r.ignoreCRC && crc(r.decoded[:n]) != checksum {
				r.err = ErrCRC
				return 0, r.err
			}
			r.i, r.j = 0, n
			continue

		case chunkTypeUncompressedData:
			r.blockStart += int64(r.j)
			// Section 4.3. Uncompressed data (chunk type 0x01).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return 0, r.err
			}
			buf := r.buf[:checksumSize]
			if !r.readFull(buf, false) {
				return 0, r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			// Read directly into r.decoded instead of via r.buf.
			n := chunkLen - checksumSize
			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if n > len(r.decoded) {
				if n > r.maxBlock {
					r.err = ErrCorrupt
					return 0, r.err
				}
				r.decoded = make([]byte, n)
			}
			if !r.readFull(r.decoded[:n], false) {
				return 0, r.err
			}
			if !r.ignoreCRC && crc(r.decoded[:n]) != checksum {
				r.err = ErrCRC
				return 0, r.err
			}
			r.i, r.j = 0, n
			continue

		case chunkTypeStreamIdentifier:
			// Section 4.1. Stream identifier (chunk type 0xff).
			if chunkLen != len(magicBody) {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.readFull(r.buf[:len(magicBody)], false) {
				return 0, r.err
			}
			if string(r.buf[:len(magicBody)]) != magicBody {
				if string(r.buf[:len(magicBody)]) != magicBodySnappy {
					r.err = ErrCorrupt
					return 0, r.err
				} else {
					r.snappyFrame = true
				}
			} else {
				r.snappyFrame = false
			}
			continue
		}

		if chunkType <= 0x7f {
			// Section 4.5. Reserved unskippable chunks (chunk types 0x02-0x7f).
			// fmt.Printf("ERR chunktype: 0x%x\n", chunkType)
			r.err = ErrUnsupported
			return 0, r.err
		}
		// Section 4.4 Padding (chunk type 0xfe).
		// Section 4.6. Reserved skippable chunks (chunk types 0x80-0xfd).
		if chunkLen > maxChunkSize {
			// fmt.Printf("ERR chunkLen: 0x%x\n", chunkLen)
			r.err = ErrUnsupported
			return 0, r.err
		}

		// fmt.Printf("skippable: ID: 0x%x, len: 0x%x\n", chunkType, chunkLen)
		if !r.skippable(r.buf, chunkLen, false, chunkType) {
			return 0, r.err
		}
	}
}

// DecodeConcurrent will decode the full stream to w.
// This function should not be combined with reading, seeking or other operations.
// Up to 'concurrent' goroutines will be used.
// If <= 0, runtime.NumCPU will be used.
// On success the number of bytes decompressed nil and is returned.
// This is mainly intended for bigger streams.
func (r *Reader) DecodeConcurrent(w io.Writer, concurrent int) (written int64, err error) {
	if r.i > 0 || r.j > 0 || r.blockStart > 0 {
		return 0, errors.New("DecodeConcurrent called after ")
	}
	if concurrent <= 0 {
		concurrent = runtime.NumCPU()
	}

	// Write to output
	var errMu sync.Mutex
	var aErr error
	setErr := func(e error) (ok bool) {
		errMu.Lock()
		defer errMu.Unlock()
		if e == nil {
			return aErr == nil
		}
		if aErr == nil {
			aErr = e
		}
		return false
	}
	hasErr := func() (ok bool) {
		errMu.Lock()
		v := aErr != nil
		errMu.Unlock()
		return v
	}

	var aWritten int64
	toRead := make(chan []byte, concurrent)
	writtenBlocks := make(chan []byte, concurrent)
	queue := make(chan chan []byte, concurrent)
	reUse := make(chan chan []byte, concurrent)
	for i := 0; i < concurrent; i++ {
		toRead <- make([]byte, 0, r.maxBufSize)
		writtenBlocks <- make([]byte, 0, r.maxBufSize)
		reUse <- make(chan []byte, 1)
	}
	// Writer
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for toWrite := range queue {
			entry := <-toWrite
			reUse <- toWrite
			if hasErr() || entry == nil {
				if entry != nil {
					writtenBlocks <- entry
				}
				continue
			}
			if hasErr() {
				writtenBlocks <- entry
				continue
			}
			n, err := w.Write(entry)
			want := len(entry)
			writtenBlocks <- entry
			if err != nil {
				setErr(err)
				continue
			}
			if n != want {
				setErr(io.ErrShortWrite)
				continue
			}
			aWritten += int64(n)
		}
	}()

	defer func() {
		if r.err != nil {
			setErr(r.err)
		} else if err != nil {
			setErr(err)
		}
		close(queue)
		wg.Wait()
		if err == nil {
			err = aErr
		}
		written = aWritten
	}()

	// Reader
	for !hasErr() {
		if !r.readFull(r.buf[:4], true) {
			if r.err == io.EOF {
				r.err = nil
			}
			return 0, r.err
		}
		chunkType := r.buf[0]
		if !r.readHeader {
			if chunkType != chunkTypeStreamIdentifier {
				r.err = ErrCorrupt
				return 0, r.err
			}
			r.readHeader = true
		}
		chunkLen := int(r.buf[1]) | int(r.buf[2])<<8 | int(r.buf[3])<<16

		// The chunk types are specified at
		// https://github.com/google/snappy/blob/master/framing_format.txt
		switch chunkType {
		case chunkTypeCompressedData:
			r.blockStart += int64(r.j)
			// Section 4.2. Compressed data (chunk type 0x00).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if chunkLen > r.maxBufSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			orgBuf := <-toRead
			buf := orgBuf[:chunkLen]

			if !r.readFull(buf, false) {
				return 0, r.err
			}

			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			buf = buf[checksumSize:]

			n, err := DecodedLen(buf)
			if err != nil {
				r.err = err
				return 0, r.err
			}
			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}

			if n > r.maxBlock {
				r.err = ErrCorrupt
				return 0, r.err
			}
			wg.Add(1)

			decoded := <-writtenBlocks
			entry := <-reUse
			queue <- entry
			go func() {
				defer wg.Done()
				decoded = decoded[:n]
				_, err := Decode(decoded, buf)
				toRead <- orgBuf
				if err != nil {
					writtenBlocks <- decoded
					setErr(err)
					entry <- nil
					return
				}
				if !r.ignoreCRC && crc(decoded) != checksum {
					writtenBlocks <- decoded
					setErr(ErrCRC)
					entry <- nil
					return
				}
				entry <- decoded
			}()
			continue

		case chunkTypeUncompressedData:

			// Section 4.3. Uncompressed data (chunk type 0x01).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if chunkLen > r.maxBufSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			// Grab write buffer
			orgBuf := <-writtenBlocks
			buf := orgBuf[:checksumSize]
			if !r.readFull(buf, false) {
				return 0, r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			// Read content.
			n := chunkLen - checksumSize

			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if n > r.maxBlock {
				r.err = ErrCorrupt
				return 0, r.err
			}
			// Read uncompressed
			buf = orgBuf[:n]
			if !r.readFull(buf, false) {
				return 0, r.err
			}

			if !r.ignoreCRC && crc(buf) != checksum {
				r.err = ErrCRC
				return 0, r.err
			}
			entry := <-reUse
			queue <- entry
			entry <- buf
			continue

		case chunkTypeStreamIdentifier:
			// Section 4.1. Stream identifier (chunk type 0xff).
			if chunkLen != len(magicBody) {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.readFull(r.buf[:len(magicBody)], false) {
				return 0, r.err
			}
			if string(r.buf[:len(magicBody)]) != magicBody {
				if string(r.buf[:len(magicBody)]) != magicBodySnappy {
					r.err = ErrCorrupt
					return 0, r.err
				} else {
					r.snappyFrame = true
				}
			} else {
				r.snappyFrame = false
			}
			continue
		}

		if chunkType <= 0x7f {
			// Section 4.5. Reserved unskippable chunks (chunk types 0x02-0x7f).
			// fmt.Printf("ERR chunktype: 0x%x\n", chunkType)
			r.err = ErrUnsupported
			return 0, r.err
		}
		// Section 4.4 Padding (chunk type 0xfe).
		// Section 4.6. Reserved skippable chunks (chunk types 0x80-0xfd).
		if chunkLen > maxChunkSize {
			// fmt.Printf("ERR chunkLen: 0x%x\n", chunkLen)
			r.err = ErrUnsupported
			return 0, r.err
		}

		// fmt.Printf("skippable: ID: 0x%x, len: 0x%x\n", chunkType, chunkLen)
		if !r.skippable(r.buf, chunkLen, false, chunkType) {
			return 0, r.err
		}
	}
	return 0, r.err
}

// Skip will skip n bytes forward in the decompressed output.
// For larger skips this consumes less CPU and is faster than reading output and discarding it.
// CRC is not checked on skipped blocks.
// io.ErrUnexpectedEOF is returned if the stream ends before all bytes have been skipped.
// If a decoding error is encountered subsequent calls to Read will also fail.
func (r *Reader) Skip(n int64) error {
	if n < 0 {
		return errors.New("attempted negative skip")
	}
	if r.err != nil {
		return r.err
	}

	for n > 0 {
		if r.i < r.j {
			// Skip in buffer.
			// decoded[i:j] contains decoded bytes that have not yet been passed on.
			left := int64(r.j - r.i)
			if left >= n {
				tmp := int64(r.i) + n
				if tmp > math.MaxInt32 {
					return errors.New("s2: internal overflow in skip")
				}
				r.i = int(tmp)
				return nil
			}
			n -= int64(r.j - r.i)
			r.i = r.j
		}

		// Buffer empty; read blocks until we have content.
		if !r.readFull(r.buf[:4], true) {
			if r.err == io.EOF {
				r.err = io.ErrUnexpectedEOF
			}
			return r.err
		}
		chunkType := r.buf[0]
		if !r.readHeader {
			if chunkType != chunkTypeStreamIdentifier {
				r.err = ErrCorrupt
				return r.err
			}
			r.readHeader = true
		}
		chunkLen := int(r.buf[1]) | int(r.buf[2])<<8 | int(r.buf[3])<<16

		// The chunk types are specified at
		// https://github.com/google/snappy/blob/master/framing_format.txt
		switch chunkType {
		case chunkTypeCompressedData:
			r.blockStart += int64(r.j)
			// Section 4.2. Compressed data (chunk type 0x00).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return r.err
			}
			buf := r.buf[:chunkLen]
			if !r.readFull(buf, false) {
				return r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			buf = buf[checksumSize:]

			dLen, err := DecodedLen(buf)
			if err != nil {
				r.err = err
				return r.err
			}
			if dLen > r.maxBlock {
				r.err = ErrCorrupt
				return r.err
			}
			// Check if destination is within this block
			if int64(dLen) > n {
				if len(r.decoded) < dLen {
					r.decoded = make([]byte, dLen)
				}
				if _, err := Decode(r.decoded, buf); err != nil {
					r.err = err
					return r.err
				}
				if crc(r.decoded[:dLen]) != checksum {
					r.err = ErrCorrupt
					return r.err
				}
			} else {
				// Skip block completely
				n -= int64(dLen)
				r.blockStart += int64(dLen)
				dLen = 0
			}
			r.i, r.j = 0, dLen
			continue
		case chunkTypeUncompressedData:
			r.blockStart += int64(r.j)
			// Section 4.3. Uncompressed data (chunk type 0x01).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err != nil {
					r.err = ErrUnsupported
				}
				return r.err
			}
			buf := r.buf[:checksumSize]
			if !r.readFull(buf, false) {
				return r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			// Read directly into r.decoded instead of via r.buf.
			n2 := chunkLen - checksumSize
			if n2 > len(r.decoded) {
				if n2 > r.maxBlock {
					r.err = ErrCorrupt
					return r.err
				}
				r.decoded = make([]byte, n2)
			}
			if !r.readFull(r.decoded[:n2], false) {
				return r.err
			}
			if int64(n2) < n {
				if crc(r.decoded[:n2]) != checksum {
					r.err = ErrCorrupt
					return r.err
				}
			}
			r.i, r.j = 0, n2
			continue
		case chunkTypeStreamIdentifier:
			// Section 4.1. Stream identifier (chunk type 0xff).
			if chunkLen != len(magicBody) {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.readFull(r.buf[:len(magicBody)], false) {
				return r.err
			}
			if string(r.buf[:len(magicBody)]) != magicBody {
				if string(r.buf[:len(magicBody)]) != magicBodySnappy {
					r.err = ErrCorrupt
					return r.err
				}
			}

			continue
		}

		if chunkType <= 0x7f {
			// Section 4.5. Reserved unskippable chunks (chunk types 0x02-0x7f).
			r.err = ErrUnsupported
			return r.err
		}
		if chunkLen > maxChunkSize {
			r.err = ErrUnsupported
			return r.err
		}
		// Section 4.4 Padding (chunk type 0xfe).
		// Section 4.6. Reserved skippable chunks (chunk types 0x80-0xfd).
		if !r.skippable(r.buf, chunkLen, false, chunkType) {
			return r.err
		}
	}
	return nil
}

// ReadSeeker provides random or forward seeking in compressed content.
// See Reader.ReadSeeker
type ReadSeeker struct {
	*Reader
	readAtMu sync.Mutex
}

// ReadSeeker will return an io.ReadSeeker and io.ReaderAt
// compatible version of the reader.
// If 'random' is specified the returned io.Seeker can be used for
// random seeking, otherwise only forward seeking is supported.
// Enabling random seeking requires the original input to support
// the io.Seeker interface.
// A custom index can be specified which will be used if supplied.
// When using a custom index, it will not be read from the input stream.
// The ReadAt position will affect regular reads and the current position of Seek.
// So using Read after ReadAt will continue from where the ReadAt stopped.
// No functions should be used concurrently.
// The returned ReadSeeker contains a shallow reference to the existing Reader,
// meaning changes performed to one is reflected in the other.
func (r *Reader) ReadSeeker(random bool, index []byte) (*ReadSeeker, error) {
	// Read index if provided.
	if len(index) != 0 {
		if r.index == nil {
			r.index = &Index{}
		}
		if _, err := r.index.Load(index); err != nil {
			return nil, ErrCantSeek{Reason: "loading index returned: " + err.Error()}
		}
	}

	// Check if input is seekable
	rs, ok := r.r.(io.ReadSeeker)
	if !ok {
		if !random {
			return &ReadSeeker{Reader: r}, nil
		}
		return nil, ErrCantSeek{Reason: "input stream isn't seekable"}
	}

	if r.index != nil {
		// Seekable and index, ok...
		return &ReadSeeker{Reader: r}, nil
	}

	// Load from stream.
	r.index = &Index{}

	// Read current position.
	pos, err := rs.Seek(0, io.SeekCurrent)
	if err != nil {
		return nil, ErrCantSeek{Reason: "seeking input returned: " + err.Error()}
	}
	err = r.index.LoadStream(rs)
	if err != nil {
		if err == ErrUnsupported {
			// If we don't require random seeking, reset input and return.
			if !random {
				_, err = rs.Seek(pos, io.SeekStart)
				if err != nil {
					return nil, ErrCantSeek{Reason: "resetting stream returned: " + err.Error()}
				}
				r.index = nil
				return &ReadSeeker{Reader: r}, nil
			}
			return nil, ErrCantSeek{Reason: "input stream does not contain an index"}
		}
		return nil, ErrCantSeek{Reason: "reading index returned: " + err.Error()}
	}

	// reset position.
	_, err = rs.Seek(pos, io.SeekStart)
	if err != nil {
		return nil, ErrCantSeek{Reason: "seeking input returned: " + err.Error()}
	}
	return &ReadSeeker{Reader: r}, nil
}

// Seek allows seeking in compressed data.
func (r *ReadSeeker) Seek(offset int64, whence int) (int64, error) {
	if r.err != nil {
		if !errors.Is(r.err, io.EOF) {
			return 0, r.err
		}
		// Reset on EOF
		r.err = nil
	}

	// Calculate absolute offset.
	absOffset := offset

	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		absOffset = r.blockStart + int64(r.i) + offset
	case io.SeekEnd:
		if r.index == nil {
			return 0, ErrUnsupported
		}
		absOffset = r.index.TotalUncompressed + offset
	default:
		r.err = ErrUnsupported
		return 0, r.err
	}

	if absOffset < 0 {
		return 0, errors.New("seek before start of file")
	}

	if !r.readHeader {
		// Make sure we read the header.
		_, r.err = r.Read([]byte{})
		if r.err != nil {
			return 0, r.err
		}
	}

	// If we are inside current block no need to seek.
	// This includes no offset changes.
	if absOffset >= r.blockStart && absOffset < r.blockStart+int64(r.j) {
		r.i = int(absOffset - r.blockStart)
		return r.blockStart + int64(r.i), nil
	}

	rs, ok := r.r.(io.ReadSeeker)
	if r.index == nil || !ok {
		currOffset := r.blockStart + int64(r.i)
		if absOffset >= currOffset {
			err := r.Skip(absOffset - currOffset)
			return r.blockStart + int64(r.i), err
		}
		return 0, ErrUnsupported
	}

	// We can seek and we have an index.
	c, u, err := r.index.Find(absOffset)
	if err != nil {
		return r.blockStart + int64(r.i), err
	}

	// Seek to next block
	_, err = rs.Seek(c, io.SeekStart)
	if err != nil {
		return 0, err
	}

	r.i = r.j                     // Remove rest of current block.
	r.blockStart = u - int64(r.j) // Adjust current block start for accounting.
	if u < absOffset {
		// Forward inside block
		return absOffset, r.Skip(absOffset - u)
	}
	if u > absOffset {
		return 0, fmt.Errorf("s2 seek: (internal error) u (%d) > absOffset (%d)", u, absOffset)
	}
	return absOffset, nil
}

// ReadAt reads len(p) bytes into p starting at offset off in the
// underlying input source. It returns the number of bytes
// read (0 <= n <= len(p)) and any error encountered.
//
// When ReadAt returns n < len(p), it returns a non-nil error
// explaining why more bytes were not returned. In this respect,
// ReadAt is stricter than Read.
//
// Even if ReadAt returns n < len(p), it may use all of p as scratch
// space during the call. If some data is available but not len(p) bytes,
// ReadAt blocks until either all the data is available or an error occurs.
// In this respect ReadAt is different from Read.
//
// If the n = len(p) bytes returned by ReadAt are at the end of the
// input source, ReadAt may return either err == EOF or err == nil.
//
// If ReadAt is reading from an input source with a seek offset,
// ReadAt should not affect nor be affected by the underlying
// seek offset.
//
// Clients of ReadAt can execute parallel ReadAt calls on the
// same input source. This is however not recommended.
func (r *ReadSeeker) ReadAt(p []byte, offset int64) (int, error) {
	r.readAtMu.Lock()
	defer r.readAtMu.Unlock()
	_, err := r.Seek(offset, io.SeekStart)
	if err != nil {
		return 0, err
	}
	n := 0
	for n < len(p) {
		n2, err := r.Read(p[n:])
		if err != nil {
			// This will include io.EOF
			return n + n2, err
		}
		n += n2
	}
	return n, nil
}

// ReadByte satisfies the io.ByteReader interface.
func (r *Reader) ReadByte() (byte, error) {
	if r.err != nil {
		return 0, r.err
	}
	if r.i < r.j {
		c := r.decoded[r.i]
		r.i++
		return c, nil
	}
	var tmp [1]byte
	for range 10 {
		n, err := r.Read(tmp[:])
		if err != nil {
			return 0, err
		}
		if n == 1 {
			return tmp[0], nil
		}
	}
	return 0, io.ErrNoProgress
}

// SkippableCB will register a callback for chunks with the specified ID.
// ID must be a Reserved skippable chunks ID, 0x80-0xfd (inclusive).
// For each chunk with the ID, the callback is called with the content.
// Any returned non-nil error will abort decompression.
// Only one callback per ID is supported, latest sent will be used.
// Sending a nil function will disable previous callbacks.
// You can peek the stream, triggering the callback, by doing a Read with a 0
// byte buffer.
func (r *Reader) SkippableCB(id uint8, fn func(r io.Reader) error) error {
	if id < 0x80 || id >= chunkTypePadding {
		return fmt.Errorf("ReaderSkippableCB: Invalid id provided, must be 0x80-0xfe (inclusive)")
	}
	r.skippableCB[id-0x80] = fn
	return nil
}
