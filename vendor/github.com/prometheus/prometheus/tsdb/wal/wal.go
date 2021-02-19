// Copyright 2017 The Prometheus Authors

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package wal

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/golang/snappy"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/prometheus/tsdb/fileutil"
)

const (
	DefaultSegmentSize = 128 * 1024 * 1024 // 128 MB
	pageSize           = 32 * 1024         // 32KB
	recordHeaderSize   = 7
)

// The table gets initialized with sync.Once but may still cause a race
// with any other use of the crc32 package anywhere. Thus we initialize it
// before.
var castagnoliTable = crc32.MakeTable(crc32.Castagnoli)

// page is an in memory buffer used to batch disk writes.
// Records bigger than the page size are split and flushed separately.
// A flush is triggered when a single records doesn't fit the page size or
// when the next record can't fit in the remaining free page space.
type page struct {
	alloc   int
	flushed int
	buf     [pageSize]byte
}

func (p *page) remaining() int {
	return pageSize - p.alloc
}

func (p *page) full() bool {
	return pageSize-p.alloc < recordHeaderSize
}

func (p *page) reset() {
	for i := range p.buf {
		p.buf[i] = 0
	}
	p.alloc = 0
	p.flushed = 0
}

// Segment represents a segment file.
type Segment struct {
	*os.File
	dir string
	i   int
}

// Index returns the index of the segment.
func (s *Segment) Index() int {
	return s.i
}

// Dir returns the directory of the segment.
func (s *Segment) Dir() string {
	return s.dir
}

// CorruptionErr is an error that's returned when corruption is encountered.
type CorruptionErr struct {
	Dir     string
	Segment int
	Offset  int64
	Err     error
}

func (e *CorruptionErr) Error() string {
	if e.Segment < 0 {
		return fmt.Sprintf("corruption after %d bytes: %s", e.Offset, e.Err)
	}
	return fmt.Sprintf("corruption in segment %s at %d: %s", SegmentName(e.Dir, e.Segment), e.Offset, e.Err)
}

// OpenWriteSegment opens segment k in dir. The returned segment is ready for new appends.
func OpenWriteSegment(logger log.Logger, dir string, k int) (*Segment, error) {
	segName := SegmentName(dir, k)
	f, err := os.OpenFile(segName, os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return nil, err
	}
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	// If the last page is torn, fill it with zeros.
	// In case it was torn after all records were written successfully, this
	// will just pad the page and everything will be fine.
	// If it was torn mid-record, a full read (which the caller should do anyway
	// to ensure integrity) will detect it as a corruption by the end.
	if d := stat.Size() % pageSize; d != 0 {
		level.Warn(logger).Log("msg", "Last page of the wal is torn, filling it with zeros", "segment", segName)
		if _, err := f.Write(make([]byte, pageSize-d)); err != nil {
			f.Close()
			return nil, errors.Wrap(err, "zero-pad torn page")
		}
	}
	return &Segment{File: f, i: k, dir: dir}, nil
}

// CreateSegment creates a new segment k in dir.
func CreateSegment(dir string, k int) (*Segment, error) {
	f, err := os.OpenFile(SegmentName(dir, k), os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		return nil, err
	}
	return &Segment{File: f, i: k, dir: dir}, nil
}

// OpenReadSegment opens the segment with the given filename.
func OpenReadSegment(fn string) (*Segment, error) {
	k, err := strconv.Atoi(filepath.Base(fn))
	if err != nil {
		return nil, errors.New("not a valid filename")
	}
	f, err := os.Open(fn)
	if err != nil {
		return nil, err
	}
	return &Segment{File: f, i: k, dir: filepath.Dir(fn)}, nil
}

// WAL is a write ahead log that stores records in segment files.
// It must be read from start to end once before logging new data.
// If an error occurs during read, the repair procedure must be called
// before it's safe to do further writes.
//
// Segments are written to in pages of 32KB, with records possibly split
// across page boundaries.
// Records are never split across segments to allow full segments to be
// safely truncated. It also ensures that torn writes never corrupt records
// beyond the most recent segment.
type WAL struct {
	dir         string
	logger      log.Logger
	segmentSize int
	mtx         sync.RWMutex
	segment     *Segment // Active segment.
	donePages   int      // Pages written to the segment.
	page        *page    // Active page.
	stopc       chan chan struct{}
	actorc      chan func()
	closed      bool // To allow calling Close() more than once without blocking.
	compress    bool
	snappyBuf   []byte

	metrics *walMetrics
}

type walMetrics struct {
	fsyncDuration   prometheus.Summary
	pageFlushes     prometheus.Counter
	pageCompletions prometheus.Counter
	truncateFail    prometheus.Counter
	truncateTotal   prometheus.Counter
	currentSegment  prometheus.Gauge
	writesFailed    prometheus.Counter
}

func newWALMetrics(r prometheus.Registerer) *walMetrics {
	m := &walMetrics{}

	m.fsyncDuration = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "prometheus_tsdb_wal_fsync_duration_seconds",
		Help:       "Duration of WAL fsync.",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	})
	m.pageFlushes = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_page_flushes_total",
		Help: "Total number of page flushes.",
	})
	m.pageCompletions = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_completed_pages_total",
		Help: "Total number of completed pages.",
	})
	m.truncateFail = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_truncations_failed_total",
		Help: "Total number of WAL truncations that failed.",
	})
	m.truncateTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_truncations_total",
		Help: "Total number of WAL truncations attempted.",
	})
	m.currentSegment = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "prometheus_tsdb_wal_segment_current",
		Help: "WAL segment index that TSDB is currently writing to.",
	})
	m.writesFailed = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_writes_failed_total",
		Help: "Total number of WAL writes that failed.",
	})

	if r != nil {
		r.MustRegister(
			m.fsyncDuration,
			m.pageFlushes,
			m.pageCompletions,
			m.truncateFail,
			m.truncateTotal,
			m.currentSegment,
			m.writesFailed,
		)
	}

	return m
}

// New returns a new WAL over the given directory.
func New(logger log.Logger, reg prometheus.Registerer, dir string, compress bool) (*WAL, error) {
	return NewSize(logger, reg, dir, DefaultSegmentSize, compress)
}

// NewSize returns a new WAL over the given directory.
// New segments are created with the specified size.
func NewSize(logger log.Logger, reg prometheus.Registerer, dir string, segmentSize int, compress bool) (*WAL, error) {
	if segmentSize%pageSize != 0 {
		return nil, errors.New("invalid segment size")
	}
	if err := os.MkdirAll(dir, 0777); err != nil {
		return nil, errors.Wrap(err, "create dir")
	}
	if logger == nil {
		logger = log.NewNopLogger()
	}
	w := &WAL{
		dir:         dir,
		logger:      logger,
		segmentSize: segmentSize,
		page:        &page{},
		actorc:      make(chan func(), 100),
		stopc:       make(chan chan struct{}),
		compress:    compress,
	}
	w.metrics = newWALMetrics(reg)

	_, last, err := Segments(w.Dir())
	if err != nil {
		return nil, errors.Wrap(err, "get segment range")
	}

	// Index of the Segment we want to open and write to.
	writeSegmentIndex := 0
	// If some segments already exist create one with a higher index than the last segment.
	if last != -1 {
		writeSegmentIndex = last + 1
	}

	segment, err := CreateSegment(w.Dir(), writeSegmentIndex)
	if err != nil {
		return nil, err
	}

	if err := w.setSegment(segment); err != nil {
		return nil, err
	}

	go w.run()

	return w, nil
}

// Open an existing WAL.
func Open(logger log.Logger, dir string) (*WAL, error) {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	w := &WAL{
		dir:    dir,
		logger: logger,
	}

	return w, nil
}

// CompressionEnabled returns if compression is enabled on this WAL.
func (w *WAL) CompressionEnabled() bool {
	return w.compress
}

// Dir returns the directory of the WAL.
func (w *WAL) Dir() string {
	return w.dir
}

func (w *WAL) run() {
Loop:
	for {
		select {
		case f := <-w.actorc:
			f()
		case donec := <-w.stopc:
			close(w.actorc)
			defer close(donec)
			break Loop
		}
	}
	// Drain and process any remaining functions.
	for f := range w.actorc {
		f()
	}
}

// Repair attempts to repair the WAL based on the error.
// It discards all data after the corruption.
func (w *WAL) Repair(origErr error) error {
	// We could probably have a mode that only discards torn records right around
	// the corruption to preserve as data much as possible.
	// But that's not generally applicable if the records have any kind of causality.
	// Maybe as an extra mode in the future if mid-WAL corruptions become
	// a frequent concern.
	err := errors.Cause(origErr) // So that we can pick up errors even if wrapped.

	cerr, ok := err.(*CorruptionErr)
	if !ok {
		return errors.Wrap(origErr, "cannot handle error")
	}
	if cerr.Segment < 0 {
		return errors.New("corruption error does not specify position")
	}
	level.Warn(w.logger).Log("msg", "Starting corruption repair",
		"segment", cerr.Segment, "offset", cerr.Offset)

	// All segments behind the corruption can no longer be used.
	segs, err := listSegments(w.Dir())
	if err != nil {
		return errors.Wrap(err, "list segments")
	}
	level.Warn(w.logger).Log("msg", "Deleting all segments newer than corrupted segment", "segment", cerr.Segment)

	for _, s := range segs {
		if w.segment.i == s.index {
			// The active segment needs to be removed,
			// close it first (Windows!). Can be closed safely
			// as we set the current segment to repaired file
			// below.
			if err := w.segment.Close(); err != nil {
				return errors.Wrap(err, "close active segment")
			}
		}
		if s.index <= cerr.Segment {
			continue
		}
		if err := os.Remove(filepath.Join(w.Dir(), s.name)); err != nil {
			return errors.Wrapf(err, "delete segment:%v", s.index)
		}
	}
	// Regardless of the corruption offset, no record reaches into the previous segment.
	// So we can safely repair the WAL by removing the segment and re-inserting all
	// its records up to the corruption.
	level.Warn(w.logger).Log("msg", "Rewrite corrupted segment", "segment", cerr.Segment)

	fn := SegmentName(w.Dir(), cerr.Segment)
	tmpfn := fn + ".repair"

	if err := fileutil.Rename(fn, tmpfn); err != nil {
		return err
	}
	// Create a clean segment and make it the active one.
	s, err := CreateSegment(w.Dir(), cerr.Segment)
	if err != nil {
		return err
	}
	if err := w.setSegment(s); err != nil {
		return err
	}

	f, err := os.Open(tmpfn)
	if err != nil {
		return errors.Wrap(err, "open segment")
	}
	defer f.Close()

	r := NewReader(bufio.NewReader(f))

	for r.Next() {
		// Add records only up to the where the error was.
		if r.Offset() >= cerr.Offset {
			break
		}
		if err := w.Log(r.Record()); err != nil {
			return errors.Wrap(err, "insert record")
		}
	}
	// We expect an error here from r.Err(), so nothing to handle.

	// We need to pad to the end of the last page in the repaired segment
	if err := w.flushPage(true); err != nil {
		return errors.Wrap(err, "flush page in repair")
	}

	// We explicitly close even when there is a defer for Windows to be
	// able to delete it. The defer is in place to close it in-case there
	// are errors above.
	if err := f.Close(); err != nil {
		return errors.Wrap(err, "close corrupted file")
	}
	if err := os.Remove(tmpfn); err != nil {
		return errors.Wrap(err, "delete corrupted segment")
	}

	// Explicitly close the segment we just repaired to avoid issues with Windows.
	s.Close()

	// We always want to start writing to a new Segment rather than an existing
	// Segment, which is handled by NewSize, but earlier in Repair we're deleting
	// all segments that come after the corrupted Segment. Recreate a new Segment here.
	s, err = CreateSegment(w.Dir(), cerr.Segment+1)
	if err != nil {
		return err
	}
	if err := w.setSegment(s); err != nil {
		return err
	}
	return nil
}

// SegmentName builds a segment name for the directory.
func SegmentName(dir string, i int) string {
	return filepath.Join(dir, fmt.Sprintf("%08d", i))
}

// NextSegment creates the next segment and closes the previous one.
func (w *WAL) NextSegment() error {
	w.mtx.Lock()
	defer w.mtx.Unlock()
	return w.nextSegment()
}

// nextSegment creates the next segment and closes the previous one.
func (w *WAL) nextSegment() error {
	// Only flush the current page if it actually holds data.
	if w.page.alloc > 0 {
		if err := w.flushPage(true); err != nil {
			return err
		}
	}
	next, err := CreateSegment(w.Dir(), w.segment.Index()+1)
	if err != nil {
		return errors.Wrap(err, "create new segment file")
	}
	prev := w.segment
	if err := w.setSegment(next); err != nil {
		return err
	}

	// Don't block further writes by fsyncing the last segment.
	w.actorc <- func() {
		if err := w.fsync(prev); err != nil {
			level.Error(w.logger).Log("msg", "sync previous segment", "err", err)
		}
		if err := prev.Close(); err != nil {
			level.Error(w.logger).Log("msg", "close previous segment", "err", err)
		}
	}
	return nil
}

func (w *WAL) setSegment(segment *Segment) error {
	w.segment = segment

	// Correctly initialize donePages.
	stat, err := segment.Stat()
	if err != nil {
		return err
	}
	w.donePages = int(stat.Size() / pageSize)
	w.metrics.currentSegment.Set(float64(segment.Index()))
	return nil
}

// flushPage writes the new contents of the page to disk. If no more records will fit into
// the page, the remaining bytes will be set to zero and a new page will be started.
// If clear is true, this is enforced regardless of how many bytes are left in the page.
func (w *WAL) flushPage(clear bool) error {
	w.metrics.pageFlushes.Inc()

	p := w.page
	clear = clear || p.full()

	// No more data will fit into the page or an implicit clear.
	// Enqueue and clear it.
	if clear {
		p.alloc = pageSize // Write till end of page.
	}
	n, err := w.segment.Write(p.buf[p.flushed:p.alloc])
	if err != nil {
		return err
	}
	p.flushed += n

	// We flushed an entire page, prepare a new one.
	if clear {
		p.reset()
		w.donePages++
		w.metrics.pageCompletions.Inc()
	}
	return nil
}

// First Byte of header format:
// [ 4 bits unallocated] [1 bit snappy compression flag] [ 3 bit record type ]
const (
	snappyMask  = 1 << 3
	recTypeMask = snappyMask - 1
)

type recType uint8

const (
	recPageTerm recType = 0 // Rest of page is empty.
	recFull     recType = 1 // Full record.
	recFirst    recType = 2 // First fragment of a record.
	recMiddle   recType = 3 // Middle fragments of a record.
	recLast     recType = 4 // Final fragment of a record.
)

func recTypeFromHeader(header byte) recType {
	return recType(header & recTypeMask)
}

func (t recType) String() string {
	switch t {
	case recPageTerm:
		return "zero"
	case recFull:
		return "full"
	case recFirst:
		return "first"
	case recMiddle:
		return "middle"
	case recLast:
		return "last"
	default:
		return "<invalid>"
	}
}

func (w *WAL) pagesPerSegment() int {
	return w.segmentSize / pageSize
}

// Log writes the records into the log.
// Multiple records can be passed at once to reduce writes and increase throughput.
func (w *WAL) Log(recs ...[]byte) error {
	w.mtx.Lock()
	defer w.mtx.Unlock()
	// Callers could just implement their own list record format but adding
	// a bit of extra logic here frees them from that overhead.
	for i, r := range recs {
		if err := w.log(r, i == len(recs)-1); err != nil {
			w.metrics.writesFailed.Inc()
			return err
		}
	}
	return nil
}

// log writes rec to the log and forces a flush of the current page if:
// - the final record of a batch
// - the record is bigger than the page size
// - the current page is full.
func (w *WAL) log(rec []byte, final bool) error {
	// When the last page flush failed the page will remain full.
	// When the page is full, need to flush it before trying to add more records to it.
	if w.page.full() {
		if err := w.flushPage(true); err != nil {
			return err
		}
	}
	// If the record is too big to fit within the active page in the current
	// segment, terminate the active segment and advance to the next one.
	// This ensures that records do not cross segment boundaries.
	left := w.page.remaining() - recordHeaderSize                                   // Free space in the active page.
	left += (pageSize - recordHeaderSize) * (w.pagesPerSegment() - w.donePages - 1) // Free pages in the active segment.

	if len(rec) > left {
		if err := w.nextSegment(); err != nil {
			return err
		}
	}

	compressed := false
	if w.compress && len(rec) > 0 {
		// The snappy library uses `len` to calculate if we need a new buffer.
		// In order to allocate as few buffers as possible make the length
		// equal to the capacity.
		w.snappyBuf = w.snappyBuf[:cap(w.snappyBuf)]
		w.snappyBuf = snappy.Encode(w.snappyBuf, rec)
		if len(w.snappyBuf) < len(rec) {
			rec = w.snappyBuf
			compressed = true
		}
	}

	// Populate as many pages as necessary to fit the record.
	// Be careful to always do one pass to ensure we write zero-length records.
	for i := 0; i == 0 || len(rec) > 0; i++ {
		p := w.page

		// Find how much of the record we can fit into the page.
		var (
			l    = min(len(rec), (pageSize-p.alloc)-recordHeaderSize)
			part = rec[:l]
			buf  = p.buf[p.alloc:]
			typ  recType
		)

		switch {
		case i == 0 && len(part) == len(rec):
			typ = recFull
		case len(part) == len(rec):
			typ = recLast
		case i == 0:
			typ = recFirst
		default:
			typ = recMiddle
		}
		if compressed {
			typ |= snappyMask
		}

		buf[0] = byte(typ)
		crc := crc32.Checksum(part, castagnoliTable)
		binary.BigEndian.PutUint16(buf[1:], uint16(len(part)))
		binary.BigEndian.PutUint32(buf[3:], crc)

		copy(buf[recordHeaderSize:], part)
		p.alloc += len(part) + recordHeaderSize

		if w.page.full() {
			if err := w.flushPage(true); err != nil {
				return err
			}
		}
		rec = rec[l:]
	}

	// If it's the final record of the batch and the page is not empty, flush it.
	if final && w.page.alloc > 0 {
		if err := w.flushPage(false); err != nil {
			return err
		}
	}

	return nil
}

// Truncate drops all segments before i.
func (w *WAL) Truncate(i int) (err error) {
	w.metrics.truncateTotal.Inc()
	defer func() {
		if err != nil {
			w.metrics.truncateFail.Inc()
		}
	}()
	refs, err := listSegments(w.Dir())
	if err != nil {
		return err
	}
	for _, r := range refs {
		if r.index >= i {
			break
		}
		if err = os.Remove(filepath.Join(w.Dir(), r.name)); err != nil {
			return err
		}
	}
	return nil
}

func (w *WAL) fsync(f *Segment) error {
	start := time.Now()
	err := f.File.Sync()
	w.metrics.fsyncDuration.Observe(time.Since(start).Seconds())
	return err
}

// Close flushes all writes and closes active segment.
func (w *WAL) Close() (err error) {
	w.mtx.Lock()
	defer w.mtx.Unlock()

	if w.closed {
		return errors.New("wal already closed")
	}

	if w.segment == nil {
		w.closed = true
		return nil
	}

	// Flush the last page and zero out all its remaining size.
	// We must not flush an empty page as it would falsely signal
	// the segment is done if we start writing to it again after opening.
	if w.page.alloc > 0 {
		if err := w.flushPage(true); err != nil {
			return err
		}
	}

	donec := make(chan struct{})
	w.stopc <- donec
	<-donec

	if err = w.fsync(w.segment); err != nil {
		level.Error(w.logger).Log("msg", "sync previous segment", "err", err)
	}
	if err := w.segment.Close(); err != nil {
		level.Error(w.logger).Log("msg", "close previous segment", "err", err)
	}
	w.closed = true
	return nil
}

// Segments returns the range [first, n] of currently existing segments.
// If no segments are found, first and n are -1.
func Segments(walDir string) (first, last int, err error) {
	refs, err := listSegments(walDir)
	if err != nil {
		return 0, 0, err
	}
	if len(refs) == 0 {
		return -1, -1, nil
	}
	return refs[0].index, refs[len(refs)-1].index, nil
}

type segmentRef struct {
	name  string
	index int
}

func listSegments(dir string) (refs []segmentRef, err error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		fn := f.Name()
		k, err := strconv.Atoi(fn)
		if err != nil {
			continue
		}
		refs = append(refs, segmentRef{name: fn, index: k})
	}
	sort.Slice(refs, func(i, j int) bool {
		return refs[i].index < refs[j].index
	})
	for i := 0; i < len(refs)-1; i++ {
		if refs[i].index+1 != refs[i+1].index {
			return nil, errors.New("segments are not sequential")
		}
	}
	return refs, nil
}

// SegmentRange groups segments by the directory and the first and last index it includes.
type SegmentRange struct {
	Dir         string
	First, Last int
}

// NewSegmentsReader returns a new reader over all segments in the directory.
func NewSegmentsReader(dir string) (io.ReadCloser, error) {
	return NewSegmentsRangeReader(SegmentRange{dir, -1, -1})
}

// NewSegmentsRangeReader returns a new reader over the given WAL segment ranges.
// If first or last are -1, the range is open on the respective end.
func NewSegmentsRangeReader(sr ...SegmentRange) (io.ReadCloser, error) {
	var segs []*Segment

	for _, sgmRange := range sr {
		refs, err := listSegments(sgmRange.Dir)
		if err != nil {
			return nil, errors.Wrapf(err, "list segment in dir:%v", sgmRange.Dir)
		}

		for _, r := range refs {
			if sgmRange.First >= 0 && r.index < sgmRange.First {
				continue
			}
			if sgmRange.Last >= 0 && r.index > sgmRange.Last {
				break
			}
			s, err := OpenReadSegment(filepath.Join(sgmRange.Dir, r.name))
			if err != nil {
				return nil, errors.Wrapf(err, "open segment:%v in dir:%v", r.name, sgmRange.Dir)
			}
			segs = append(segs, s)
		}
	}
	return NewSegmentBufReader(segs...), nil
}

// segmentBufReader is a buffered reader that reads in multiples of pages.
// The main purpose is that we are able to track segment and offset for
// corruption reporting.  We have to be careful not to increment curr too
// early, as it is used by Reader.Err() to tell Repair which segment is corrupt.
// As such we pad the end of non-page align segments with zeros.
type segmentBufReader struct {
	buf  *bufio.Reader
	segs []*Segment
	cur  int // Index into segs.
	off  int // Offset of read data into current segment.
}

// nolint:golint // TODO: Consider exporting segmentBufReader
func NewSegmentBufReader(segs ...*Segment) *segmentBufReader {
	return &segmentBufReader{
		buf:  bufio.NewReaderSize(segs[0], 16*pageSize),
		segs: segs,
	}
}

func (r *segmentBufReader) Close() (err error) {
	for _, s := range r.segs {
		if e := s.Close(); e != nil {
			err = e
		}
	}
	return err
}

// Read implements io.Reader.
func (r *segmentBufReader) Read(b []byte) (n int, err error) {
	n, err = r.buf.Read(b)
	r.off += n

	// If we succeeded, or hit a non-EOF, we can stop.
	if err == nil || err != io.EOF {
		return n, err
	}

	// We hit EOF; fake out zero padding at the end of short segments, so we
	// don't increment curr too early and report the wrong segment as corrupt.
	if r.off%pageSize != 0 {
		i := 0
		for ; n+i < len(b) && (r.off+i)%pageSize != 0; i++ {
			b[n+i] = 0
		}

		// Return early, even if we didn't fill b.
		r.off += i
		return n + i, nil
	}

	// There is no more deta left in the curr segment and there are no more
	// segments left.  Return EOF.
	if r.cur+1 >= len(r.segs) {
		return n, io.EOF
	}

	// Move to next segment.
	r.cur++
	r.off = 0
	r.buf.Reset(r.segs[r.cur])
	return n, nil
}

// Computing size of the WAL.
// We do this by adding the sizes of all the files under the WAL dir.
func (w *WAL) Size() (int64, error) {
	return fileutil.DirSize(w.Dir())
}
