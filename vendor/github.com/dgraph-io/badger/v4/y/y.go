/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

import (
	"bytes"
	"encoding/binary"
	stderrors "errors"
	"fmt"
	"hash/crc32"
	"io"
	"math"
	"os"
	"reflect"
	"strconv"
	"sync"
	"time"
	"unsafe"

	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/ristretto/v2/z"
)

var (
	// ErrEOF indicates an end of file when trying to read from a memory mapped file
	// and encountering the end of slice.
	ErrEOF = stderrors.New("ErrEOF: End of file")

	// ErrCommitAfterFinish indicates that write batch commit was called after
	// finish
	ErrCommitAfterFinish = stderrors.New("Batch commit not permitted after finish")
)

type Flags int

const (
	// Sync indicates that O_DSYNC should be set on the underlying file,
	// ensuring that data writes do not return until the data is flushed
	// to disk.
	Sync Flags = 1 << iota
	// ReadOnly opens the underlying file on a read-only basis.
	ReadOnly
)

var (
	// This is O_DSYNC (datasync) on platforms that support it -- see file_unix.go
	datasyncFileFlag = 0x0

	// CastagnoliCrcTable is a CRC32 polynomial table
	CastagnoliCrcTable = crc32.MakeTable(crc32.Castagnoli)
)

// OpenExistingFile opens an existing file, errors if it doesn't exist.
func OpenExistingFile(filename string, flags Flags) (*os.File, error) {
	openFlags := os.O_RDWR
	if flags&ReadOnly != 0 {
		openFlags = os.O_RDONLY
	}

	if flags&Sync != 0 {
		openFlags |= datasyncFileFlag
	}
	return os.OpenFile(filename, openFlags, 0)
}

// CreateSyncedFile creates a new file (using O_EXCL), errors if it already existed.
func CreateSyncedFile(filename string, sync bool) (*os.File, error) {
	flags := os.O_RDWR | os.O_CREATE | os.O_EXCL
	if sync {
		flags |= datasyncFileFlag
	}
	return os.OpenFile(filename, flags, 0600)
}

// OpenSyncedFile creates the file if one doesn't exist.
func OpenSyncedFile(filename string, sync bool) (*os.File, error) {
	flags := os.O_RDWR | os.O_CREATE
	if sync {
		flags |= datasyncFileFlag
	}
	return os.OpenFile(filename, flags, 0600)
}

// OpenTruncFile opens the file with O_RDWR | O_CREATE | O_TRUNC
func OpenTruncFile(filename string, sync bool) (*os.File, error) {
	flags := os.O_RDWR | os.O_CREATE | os.O_TRUNC
	if sync {
		flags |= datasyncFileFlag
	}
	return os.OpenFile(filename, flags, 0600)
}

// SafeCopy does append(a[:0], src...).
func SafeCopy(a, src []byte) []byte {
	return append(a[:0], src...)
}

// Copy copies a byte slice and returns the copied slice.
func Copy(a []byte) []byte {
	b := make([]byte, len(a))
	copy(b, a)
	return b
}

// KeyWithTs generates a new key by appending ts to key.
func KeyWithTs(key []byte, ts uint64) []byte {
	out := make([]byte, len(key)+8)
	copy(out, key)
	binary.BigEndian.PutUint64(out[len(key):], math.MaxUint64-ts)
	return out
}

// ParseTs parses the timestamp from the key bytes.
func ParseTs(key []byte) uint64 {
	if len(key) <= 8 {
		return 0
	}
	return math.MaxUint64 - binary.BigEndian.Uint64(key[len(key)-8:])
}

// CompareKeys checks the key without timestamp and checks the timestamp if keyNoTs
// is same.
// a<timestamp> would be sorted higher than aa<timestamp> if we use bytes.compare
// All keys should have timestamp.
func CompareKeys(key1, key2 []byte) int {
	if cmp := bytes.Compare(key1[:len(key1)-8], key2[:len(key2)-8]); cmp != 0 {
		return cmp
	}
	return bytes.Compare(key1[len(key1)-8:], key2[len(key2)-8:])
}

// ParseKey parses the actual key from the key bytes.
func ParseKey(key []byte) []byte {
	if key == nil {
		return nil
	}

	return key[:len(key)-8]
}

// SameKey checks for key equality ignoring the version timestamp suffix.
func SameKey(src, dst []byte) bool {
	if len(src) != len(dst) {
		return false
	}
	return bytes.Equal(ParseKey(src), ParseKey(dst))
}

// Slice holds a reusable buf, will reallocate if you request a larger size than ever before.
// One problem is with n distinct sizes in random order it'll reallocate log(n) times.
type Slice struct {
	buf []byte
}

// Resize reuses the Slice's buffer (or makes a new one) and returns a slice in that buffer of
// length sz.
func (s *Slice) Resize(sz int) []byte {
	if cap(s.buf) < sz {
		s.buf = make([]byte, sz)
	}
	return s.buf[0:sz]
}

// FixedDuration returns a string representation of the given duration with the
// hours, minutes, and seconds.
func FixedDuration(d time.Duration) string {
	str := fmt.Sprintf("%02ds", int(d.Seconds())%60)
	if d >= time.Minute {
		str = fmt.Sprintf("%02dm", int(d.Minutes())%60) + str
	}
	if d >= time.Hour {
		str = fmt.Sprintf("%02dh", int(d.Hours())) + str
	}
	return str
}

// Throttle allows a limited number of workers to run at a time. It also
// provides a mechanism to check for errors encountered by workers and wait for
// them to finish.
type Throttle struct {
	once      sync.Once
	wg        sync.WaitGroup
	ch        chan struct{}
	errCh     chan error
	finishErr error
}

// NewThrottle creates a new throttle with a max number of workers.
func NewThrottle(max int) *Throttle {
	return &Throttle{
		ch:    make(chan struct{}, max),
		errCh: make(chan error, max),
	}
}

// Do should be called by workers before they start working. It blocks if there
// are already maximum number of workers working. If it detects an error from
// previously Done workers, it would return it.
func (t *Throttle) Do() error {
	for {
		select {
		case t.ch <- struct{}{}:
			t.wg.Add(1)
			return nil
		case err := <-t.errCh:
			if err != nil {
				return err
			}
		}
	}
}

// Done should be called by workers when they finish working. They can also
// pass the error status of work done.
func (t *Throttle) Done(err error) {
	if err != nil {
		t.errCh <- err
	}
	select {
	case <-t.ch:
	default:
		panic("Throttle Do Done mismatch")
	}
	t.wg.Done()
}

// Finish waits until all workers have finished working. It would return any error passed by Done.
// If Finish is called multiple time, it will wait for workers to finish only once(first time).
// From next calls, it will return same error as found on first call.
func (t *Throttle) Finish() error {
	t.once.Do(func() {
		t.wg.Wait()
		close(t.ch)
		close(t.errCh)
		for err := range t.errCh {
			if err != nil {
				t.finishErr = err
				return
			}
		}
	})

	return t.finishErr
}

// U16ToBytes converts the given Uint16 to bytes
func U16ToBytes(v uint16) []byte {
	var uBuf [2]byte
	binary.BigEndian.PutUint16(uBuf[:], v)
	return uBuf[:]
}

// BytesToU16 converts the given byte slice to uint16
func BytesToU16(b []byte) uint16 {
	return binary.BigEndian.Uint16(b)
}

// U32ToBytes converts the given Uint32 to bytes
func U32ToBytes(v uint32) []byte {
	var uBuf [4]byte
	binary.BigEndian.PutUint32(uBuf[:], v)
	return uBuf[:]
}

// BytesToU32 converts the given byte slice to uint32
func BytesToU32(b []byte) uint32 {
	return binary.BigEndian.Uint32(b)
}

// U32SliceToBytes converts the given Uint32 slice to byte slice
func U32SliceToBytes(u32s []uint32) []byte {
	if len(u32s) == 0 {
		return nil
	}
	var b []byte
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&b))
	hdr.Len = len(u32s) * 4
	hdr.Cap = hdr.Len
	hdr.Data = uintptr(unsafe.Pointer(&u32s[0]))
	return b
}

// BytesToU32Slice converts the given byte slice to uint32 slice
func BytesToU32Slice(b []byte) []uint32 {
	if len(b) == 0 {
		return nil
	}
	var u32s []uint32
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&u32s))
	hdr.Len = len(b) / 4
	hdr.Cap = hdr.Len
	hdr.Data = uintptr(unsafe.Pointer(&b[0]))
	return u32s
}

// U64ToBytes converts the given Uint64 to bytes
func U64ToBytes(v uint64) []byte {
	var uBuf [8]byte
	binary.BigEndian.PutUint64(uBuf[:], v)
	return uBuf[:]
}

// BytesToU64 converts the given byte slice to uint64
func BytesToU64(b []byte) uint64 {
	return binary.BigEndian.Uint64(b)
}

// U64SliceToBytes converts the given Uint64 slice to byte slice
func U64SliceToBytes(u64s []uint64) []byte {
	if len(u64s) == 0 {
		return nil
	}
	var b []byte
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&b))
	hdr.Len = len(u64s) * 8
	hdr.Cap = hdr.Len
	hdr.Data = uintptr(unsafe.Pointer(&u64s[0]))
	return b
}

// BytesToU64Slice converts the given byte slice to uint64 slice
func BytesToU64Slice(b []byte) []uint64 {
	if len(b) == 0 {
		return nil
	}
	var u64s []uint64
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&u64s))
	hdr.Len = len(b) / 8
	hdr.Cap = hdr.Len
	hdr.Data = uintptr(unsafe.Pointer(&b[0]))
	return u64s
}

// page struct contains one underlying buffer.
type page struct {
	buf []byte
}

// PageBuffer consists of many pages. A page is a wrapper over []byte. PageBuffer can act as a
// replacement of bytes.Buffer. Instead of having single underlying buffer, it has multiple
// underlying buffers. Hence it avoids any copy during relocation(as happens in bytes.Buffer).
// PageBuffer allocates memory in pages. Once a page is full, it will allocate page with double the
// size of previous page. Its function are not thread safe.
type PageBuffer struct {
	pages []*page

	length       int // Length of PageBuffer.
	nextPageSize int // Size of next page to be allocated.
}

// NewPageBuffer returns a new PageBuffer with first page having size pageSize.
func NewPageBuffer(pageSize int) *PageBuffer {
	b := &PageBuffer{}
	b.pages = append(b.pages, &page{buf: make([]byte, 0, pageSize)})
	b.nextPageSize = pageSize * 2
	return b
}

// Write writes data to PageBuffer b. It returns number of bytes written and any error encountered.
func (b *PageBuffer) Write(data []byte) (int, error) {
	dataLen := len(data)
	for {
		cp := b.pages[len(b.pages)-1] // Current page.

		n := copy(cp.buf[len(cp.buf):cap(cp.buf)], data)
		cp.buf = cp.buf[:len(cp.buf)+n]
		b.length += n

		if len(data) == n {
			break
		}
		data = data[n:]

		b.pages = append(b.pages, &page{buf: make([]byte, 0, b.nextPageSize)})
		b.nextPageSize *= 2
	}

	return dataLen, nil
}

// WriteByte writes data byte to PageBuffer and returns any encountered error.
func (b *PageBuffer) WriteByte(data byte) error {
	_, err := b.Write([]byte{data})
	return err
}

// Len returns length of PageBuffer.
func (b *PageBuffer) Len() int {
	return b.length
}

// pageForOffset returns pageIdx and startIdx for the offset.
func (b *PageBuffer) pageForOffset(offset int) (int, int) {
	AssertTrue(offset < b.length)

	var pageIdx, startIdx, sizeNow int
	for i := 0; i < len(b.pages); i++ {
		cp := b.pages[i]

		if sizeNow+len(cp.buf)-1 < offset {
			sizeNow += len(cp.buf)
		} else {
			pageIdx = i
			startIdx = offset - sizeNow
			break
		}
	}

	return pageIdx, startIdx
}

// Truncate truncates PageBuffer to length n.
func (b *PageBuffer) Truncate(n int) {
	pageIdx, startIdx := b.pageForOffset(n)
	// For simplicity of the code reject extra pages. These pages can be kept.
	b.pages = b.pages[:pageIdx+1]
	cp := b.pages[len(b.pages)-1]
	cp.buf = cp.buf[:startIdx]
	b.length = n
}

// Bytes returns whole Buffer data as single []byte.
func (b *PageBuffer) Bytes() []byte {
	buf := make([]byte, b.length)
	written := 0
	for i := 0; i < len(b.pages); i++ {
		written += copy(buf[written:], b.pages[i].buf)
	}

	return buf
}

// WriteTo writes whole buffer to w. It returns number of bytes written and any error encountered.
func (b *PageBuffer) WriteTo(w io.Writer) (int64, error) {
	written := int64(0)
	for i := 0; i < len(b.pages); i++ {
		n, err := w.Write(b.pages[i].buf)
		written += int64(n)
		if err != nil {
			return written, err
		}
	}

	return written, nil
}

// NewReaderAt returns a reader which starts reading from offset in page buffer.
func (b *PageBuffer) NewReaderAt(offset int) *PageBufferReader {
	pageIdx, startIdx := b.pageForOffset(offset)

	return &PageBufferReader{
		buf:      b,
		pageIdx:  pageIdx,
		startIdx: startIdx,
	}
}

// PageBufferReader is a reader for PageBuffer.
type PageBufferReader struct {
	buf      *PageBuffer // Underlying page buffer.
	pageIdx  int         // Idx of page from where it will start reading.
	startIdx int         // Idx inside page - buf.pages[pageIdx] from where it will start reading.
}

// Read reads upto len(p) bytes. It returns number of bytes read and any error encountered.
func (r *PageBufferReader) Read(p []byte) (int, error) {
	// Check if there is enough to Read.
	pc := len(r.buf.pages)

	read := 0
	for r.pageIdx < pc && read < len(p) {
		cp := r.buf.pages[r.pageIdx] // Current Page.
		endIdx := len(cp.buf)        // Last Idx up to which we can read from this page.

		n := copy(p[read:], cp.buf[r.startIdx:endIdx])
		read += n
		r.startIdx += n

		// Instead of len(cp.buf), we comparing with cap(cp.buf). This ensures that we move to next
		// page only when we have read all data. Reading from last page is an edge case. We don't
		// want to move to next page until last page is full to its capacity.
		if r.startIdx >= cap(cp.buf) {
			// We should move to next page.
			r.pageIdx++
			r.startIdx = 0
			continue
		}

		// When last page in not full to its capacity and we have read all data up to its
		// length, just break out of the loop.
		if r.pageIdx == pc-1 {
			break
		}
	}

	if read == 0 && len(p) > 0 {
		return read, io.EOF
	}

	return read, nil
}

const kvsz = int(unsafe.Sizeof(pb.KV{}))

func NewKV(alloc *z.Allocator) *pb.KV {
	if alloc == nil {
		return &pb.KV{}
	}
	b := alloc.AllocateAligned(kvsz)
	return (*pb.KV)(unsafe.Pointer(&b[0]))
}

// IBytesToString converts size in bytes to human readable format.
// The code is taken from humanize library and changed to provide
// value upto custom decimal precision.
// IBytesToString(12312412, 1) -> 11.7 MiB
func IBytesToString(size uint64, precision int) string {
	sizes := []string{"B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"}
	base := float64(1024)
	if size < 10 {
		return fmt.Sprintf("%d B", size)
	}
	e := math.Floor(math.Log(float64(size)) / math.Log(base))
	suffix := sizes[int(e)]
	val := float64(size) / math.Pow(base, e)
	f := "%." + strconv.Itoa(precision) + "f %s"

	return fmt.Sprintf(f, val, suffix)
}

type RateMonitor struct {
	start       time.Time
	lastSent    uint64
	lastCapture time.Time
	rates       []float64
	idx         int
}

func NewRateMonitor(numSamples int) *RateMonitor {
	return &RateMonitor{
		start: time.Now(),
		rates: make([]float64, numSamples),
	}
}

const minRate = 0.0001

// Capture captures the current number of sent bytes. This number should be monotonically
// increasing.
func (rm *RateMonitor) Capture(sent uint64) {
	diff := sent - rm.lastSent
	dur := time.Since(rm.lastCapture)
	rm.lastCapture, rm.lastSent = time.Now(), sent

	rate := float64(diff) / dur.Seconds()
	if rate < minRate {
		rate = minRate
	}
	rm.rates[rm.idx] = rate
	rm.idx = (rm.idx + 1) % len(rm.rates)
}

// Rate returns the average rate of transmission smoothed out by the number of samples.
func (rm *RateMonitor) Rate() uint64 {
	var total float64
	var den float64
	for _, r := range rm.rates {
		if r < minRate {
			// Ignore this. We always set minRate, so this is a zero.
			// Typically at the start of the rate monitor, we'd have zeros.
			continue
		}
		total += r
		den += 1.0
	}
	if den < minRate {
		return 0
	}
	return uint64(total / den)
}
