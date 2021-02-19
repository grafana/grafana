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

package tsdb

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"hash"
	"hash/crc32"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/tsdb/encoding"
	"github.com/prometheus/prometheus/tsdb/fileutil"
	"github.com/prometheus/prometheus/tsdb/record"
	"github.com/prometheus/prometheus/tsdb/tombstones"
	"github.com/prometheus/prometheus/tsdb/wal"
)

// WALEntryType indicates what data a WAL entry contains.
type WALEntryType uint8

const (
	// WALMagic is a 4 byte number every WAL segment file starts with.
	WALMagic = uint32(0x43AF00EF)

	// WALFormatDefault is the version flag for the default outer segment file format.
	WALFormatDefault = byte(1)
)

// Entry types in a segment file.
const (
	WALEntrySymbols WALEntryType = 1
	WALEntrySeries  WALEntryType = 2
	WALEntrySamples WALEntryType = 3
	WALEntryDeletes WALEntryType = 4
)

type walMetrics struct {
	fsyncDuration prometheus.Summary
	corruptions   prometheus.Counter
}

func newWalMetrics(wal *SegmentWAL, r prometheus.Registerer) *walMetrics {
	m := &walMetrics{}

	m.fsyncDuration = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "prometheus_tsdb_wal_fsync_duration_seconds",
		Help:       "Duration of WAL fsync.",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	})
	m.corruptions = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_wal_corruptions_total",
		Help: "Total number of WAL corruptions.",
	})

	if r != nil {
		r.MustRegister(
			m.fsyncDuration,
			m.corruptions,
		)
	}
	return m
}

// WAL is a write ahead log that can log new series labels and samples.
// It must be completely read before new entries are logged.
//
// DEPRECATED: use wal pkg combined with the record codex instead.
type WAL interface {
	Reader() WALReader
	LogSeries([]record.RefSeries) error
	LogSamples([]record.RefSample) error
	LogDeletes([]tombstones.Stone) error
	Truncate(mint int64, keep func(uint64) bool) error
	Close() error
}

// WALReader reads entries from a WAL.
type WALReader interface {
	Read(
		seriesf func([]record.RefSeries),
		samplesf func([]record.RefSample),
		deletesf func([]tombstones.Stone),
	) error
}

// segmentFile wraps a file object of a segment and tracks the highest timestamp
// it contains. During WAL truncating, all segments with no higher timestamp than
// the truncation threshold can be compacted.
type segmentFile struct {
	*os.File
	maxTime   int64  // highest tombstone or sample timestamp in segment
	minSeries uint64 // lowerst series ID in segment
}

func newSegmentFile(f *os.File) *segmentFile {
	return &segmentFile{
		File:      f,
		maxTime:   math.MinInt64,
		minSeries: math.MaxUint64,
	}
}

const (
	walSegmentSizeBytes = 256 * 1024 * 1024 // 256 MB
)

// The table gets initialized with sync.Once but may still cause a race
// with any other use of the crc32 package anywhere. Thus we initialize it
// before.
var castagnoliTable *crc32.Table

func init() {
	castagnoliTable = crc32.MakeTable(crc32.Castagnoli)
}

// newCRC32 initializes a CRC32 hash with a preconfigured polynomial, so the
// polynomial may be easily changed in one location at a later time, if necessary.
func newCRC32() hash.Hash32 {
	return crc32.New(castagnoliTable)
}

// SegmentWAL is a write ahead log for series data.
//
// DEPRECATED: use wal pkg combined with the record coders instead.
type SegmentWAL struct {
	mtx     sync.Mutex
	metrics *walMetrics

	dirFile *os.File
	files   []*segmentFile

	logger        log.Logger
	flushInterval time.Duration
	segmentSize   int64

	crc32 hash.Hash32
	cur   *bufio.Writer
	curN  int64

	stopc   chan struct{}
	donec   chan struct{}
	actorc  chan func() error // sequentialized background operations
	buffers sync.Pool
}

// OpenSegmentWAL opens or creates a write ahead log in the given directory.
// The WAL must be read completely before new data is written.
func OpenSegmentWAL(dir string, logger log.Logger, flushInterval time.Duration, r prometheus.Registerer) (*SegmentWAL, error) {
	if err := os.MkdirAll(dir, 0777); err != nil {
		return nil, err
	}
	df, err := fileutil.OpenDir(dir)
	if err != nil {
		return nil, err
	}
	if logger == nil {
		logger = log.NewNopLogger()
	}

	w := &SegmentWAL{
		dirFile:       df,
		logger:        logger,
		flushInterval: flushInterval,
		donec:         make(chan struct{}),
		stopc:         make(chan struct{}),
		actorc:        make(chan func() error, 1),
		segmentSize:   walSegmentSizeBytes,
		crc32:         newCRC32(),
	}
	w.metrics = newWalMetrics(w, r)

	fns, err := sequenceFiles(w.dirFile.Name())
	if err != nil {
		return nil, err
	}

	for i, fn := range fns {
		f, err := w.openSegmentFile(fn)
		if err == nil {
			w.files = append(w.files, newSegmentFile(f))
			continue
		}
		level.Warn(logger).Log("msg", "Invalid segment file detected, truncating WAL", "err", err, "file", fn)

		for _, fn := range fns[i:] {
			if err := os.Remove(fn); err != nil {
				return w, errors.Wrap(err, "removing segment failed")
			}
		}
		break
	}

	go w.run(flushInterval)

	return w, nil
}

// repairingWALReader wraps a WAL reader and truncates its underlying SegmentWAL after the last
// valid entry if it encounters corruption.
type repairingWALReader struct {
	wal *SegmentWAL
	r   WALReader
}

func (r *repairingWALReader) Read(
	seriesf func([]record.RefSeries),
	samplesf func([]record.RefSample),
	deletesf func([]tombstones.Stone),
) error {
	err := r.r.Read(seriesf, samplesf, deletesf)
	if err == nil {
		return nil
	}
	cerr, ok := errors.Cause(err).(walCorruptionErr)
	if !ok {
		return err
	}
	r.wal.metrics.corruptions.Inc()
	return r.wal.truncate(cerr.err, cerr.file, cerr.lastOffset)
}

// truncate the WAL after the last valid entry.
func (w *SegmentWAL) truncate(err error, file int, lastOffset int64) error {
	level.Error(w.logger).Log("msg", "WAL corruption detected; truncating",
		"err", err, "file", w.files[file].Name(), "pos", lastOffset)

	// Close and delete all files after the current one.
	for _, f := range w.files[file+1:] {
		if err := f.Close(); err != nil {
			return err
		}
		if err := os.Remove(f.Name()); err != nil {
			return err
		}
	}
	w.mtx.Lock()
	defer w.mtx.Unlock()

	w.files = w.files[:file+1]

	// Seek the current file to the last valid offset where we continue writing from.
	_, err = w.files[file].Seek(lastOffset, io.SeekStart)
	return err
}

// Reader returns a new reader over the write ahead log data.
// It must be completely consumed before writing to the WAL.
func (w *SegmentWAL) Reader() WALReader {
	return &repairingWALReader{
		wal: w,
		r:   newWALReader(w.files, w.logger),
	}
}

func (w *SegmentWAL) getBuffer() *encoding.Encbuf {
	b := w.buffers.Get()
	if b == nil {
		return &encoding.Encbuf{B: make([]byte, 0, 64*1024)}
	}
	return b.(*encoding.Encbuf)
}

func (w *SegmentWAL) putBuffer(b *encoding.Encbuf) {
	b.Reset()
	w.buffers.Put(b)
}

// Truncate deletes the values prior to mint and the series which the keep function
// does not indicate to preserve.
func (w *SegmentWAL) Truncate(mint int64, keep func(uint64) bool) error {
	// The last segment is always active.
	if len(w.files) < 2 {
		return nil
	}
	var candidates []*segmentFile

	// All files have to be traversed as there could be two segments for a block
	// with first block having times (10000, 20000) and SECOND one having (0, 10000).
	for _, sf := range w.files[:len(w.files)-1] {
		if sf.maxTime >= mint {
			break
		}
		// Past WAL files are closed. We have to reopen them for another read.
		f, err := w.openSegmentFile(sf.Name())
		if err != nil {
			return errors.Wrap(err, "open old WAL segment for read")
		}
		candidates = append(candidates, &segmentFile{
			File:      f,
			minSeries: sf.minSeries,
			maxTime:   sf.maxTime,
		})
	}
	if len(candidates) == 0 {
		return nil
	}

	r := newWALReader(candidates, w.logger)

	// Create a new tmp file.
	f, err := w.createSegmentFile(filepath.Join(w.dirFile.Name(), "compact.tmp"))
	if err != nil {
		return errors.Wrap(err, "create compaction segment")
	}
	defer func() {
		if err := os.RemoveAll(f.Name()); err != nil {
			level.Error(w.logger).Log("msg", "remove tmp file", "err", err.Error())
		}
	}()

	var (
		csf          = newSegmentFile(f)
		crc32        = newCRC32()
		decSeries    = []record.RefSeries{}
		activeSeries = []record.RefSeries{}
	)

	for r.next() {
		rt, flag, byt := r.at()

		if rt != WALEntrySeries {
			continue
		}
		decSeries = decSeries[:0]
		activeSeries = activeSeries[:0]

		err := r.decodeSeries(flag, byt, &decSeries)
		if err != nil {
			return errors.Wrap(err, "decode samples while truncating")
		}
		for _, s := range decSeries {
			if keep(s.Ref) {
				activeSeries = append(activeSeries, s)
			}
		}

		buf := w.getBuffer()
		flag = w.encodeSeries(buf, activeSeries)

		_, err = w.writeTo(csf, crc32, WALEntrySeries, flag, buf.Get())
		w.putBuffer(buf)

		if err != nil {
			return errors.Wrap(err, "write to compaction segment")
		}
	}
	if r.Err() != nil {
		return errors.Wrap(r.Err(), "read candidate WAL files")
	}

	off, err := csf.Seek(0, io.SeekCurrent)
	if err != nil {
		return err
	}
	if err := csf.Truncate(off); err != nil {
		return err
	}
	if err := csf.Sync(); err != nil {
		return nil
	}
	if err := csf.Close(); err != nil {
		return nil
	}

	_ = candidates[0].Close() // need close before remove on platform windows
	if err := fileutil.Replace(csf.Name(), candidates[0].Name()); err != nil {
		return errors.Wrap(err, "rename compaction segment")
	}
	for _, f := range candidates[1:] {
		f.Close() // need close before remove on platform windows
		if err := os.RemoveAll(f.Name()); err != nil {
			return errors.Wrap(err, "delete WAL segment file")
		}
	}
	if err := w.dirFile.Sync(); err != nil {
		return err
	}

	// The file object of csf still holds the name before rename. Recreate it so
	// subsequent truncations do not look at a non-existent file name.
	csf.File, err = w.openSegmentFile(candidates[0].Name())
	if err != nil {
		return err
	}
	// We don't need it to be open.
	if err := csf.Close(); err != nil {
		return err
	}

	w.mtx.Lock()
	w.files = append([]*segmentFile{csf}, w.files[len(candidates):]...)
	w.mtx.Unlock()

	return nil
}

// LogSeries writes a batch of new series labels to the log.
// The series have to be ordered.
func (w *SegmentWAL) LogSeries(series []record.RefSeries) error {
	buf := w.getBuffer()

	flag := w.encodeSeries(buf, series)

	w.mtx.Lock()
	defer w.mtx.Unlock()

	err := w.write(WALEntrySeries, flag, buf.Get())

	w.putBuffer(buf)

	if err != nil {
		return errors.Wrap(err, "log series")
	}

	tf := w.head()

	for _, s := range series {
		if tf.minSeries > s.Ref {
			tf.minSeries = s.Ref
		}
	}
	return nil
}

// LogSamples writes a batch of new samples to the log.
func (w *SegmentWAL) LogSamples(samples []record.RefSample) error {
	buf := w.getBuffer()

	flag := w.encodeSamples(buf, samples)

	w.mtx.Lock()
	defer w.mtx.Unlock()

	err := w.write(WALEntrySamples, flag, buf.Get())

	w.putBuffer(buf)

	if err != nil {
		return errors.Wrap(err, "log series")
	}
	tf := w.head()

	for _, s := range samples {
		if tf.maxTime < s.T {
			tf.maxTime = s.T
		}
	}
	return nil
}

// LogDeletes write a batch of new deletes to the log.
func (w *SegmentWAL) LogDeletes(stones []tombstones.Stone) error {
	buf := w.getBuffer()

	flag := w.encodeDeletes(buf, stones)

	w.mtx.Lock()
	defer w.mtx.Unlock()

	err := w.write(WALEntryDeletes, flag, buf.Get())

	w.putBuffer(buf)

	if err != nil {
		return errors.Wrap(err, "log series")
	}
	tf := w.head()

	for _, s := range stones {
		for _, iv := range s.Intervals {
			if tf.maxTime < iv.Maxt {
				tf.maxTime = iv.Maxt
			}
		}
	}
	return nil
}

// openSegmentFile opens the given segment file and consumes and validates header.
func (w *SegmentWAL) openSegmentFile(name string) (*os.File, error) {
	// We must open all files in read/write mode as we may have to truncate along
	// the way and any file may become the head.
	f, err := os.OpenFile(name, os.O_RDWR, 0666)
	if err != nil {
		return nil, err
	}
	metab := make([]byte, 8)

	// If there is an error, we need close f for platform windows before gc.
	// Otherwise, file op may fail.
	hasError := true
	defer func() {
		if hasError {
			f.Close()
		}
	}()

	if n, err := f.Read(metab); err != nil {
		return nil, errors.Wrapf(err, "validate meta %q", f.Name())
	} else if n != 8 {
		return nil, errors.Errorf("invalid header size %d in %q", n, f.Name())
	}

	if m := binary.BigEndian.Uint32(metab[:4]); m != WALMagic {
		return nil, errors.Errorf("invalid magic header %x in %q", m, f.Name())
	}
	if metab[4] != WALFormatDefault {
		return nil, errors.Errorf("unknown WAL segment format %d in %q", metab[4], f.Name())
	}
	hasError = false
	return f, nil
}

// createSegmentFile creates a new segment file with the given name. It preallocates
// the standard segment size if possible and writes the header.
func (w *SegmentWAL) createSegmentFile(name string) (*os.File, error) {
	f, err := os.Create(name)
	if err != nil {
		return nil, err
	}
	if err = fileutil.Preallocate(f, w.segmentSize, true); err != nil {
		return nil, err
	}
	// Write header metadata for new file.
	metab := make([]byte, 8)
	binary.BigEndian.PutUint32(metab[:4], WALMagic)
	metab[4] = WALFormatDefault

	if _, err := f.Write(metab); err != nil {
		return nil, err
	}
	return f, err
}

// cut finishes the currently active segments and opens the next one.
// The encoder is reset to point to the new segment.
func (w *SegmentWAL) cut() error {
	// Sync current head to disk and close.
	if hf := w.head(); hf != nil {
		if err := w.flush(); err != nil {
			return err
		}
		// Finish last segment asynchronously to not block the WAL moving along
		// in the new segment.
		go func() {
			w.actorc <- func() error {
				off, err := hf.Seek(0, io.SeekCurrent)
				if err != nil {
					return errors.Wrapf(err, "finish old segment %s", hf.Name())
				}
				if err := hf.Truncate(off); err != nil {
					return errors.Wrapf(err, "finish old segment %s", hf.Name())
				}
				if err := hf.Sync(); err != nil {
					return errors.Wrapf(err, "finish old segment %s", hf.Name())
				}
				if err := hf.Close(); err != nil {
					return errors.Wrapf(err, "finish old segment %s", hf.Name())
				}
				return nil
			}
		}()
	}

	p, _, err := nextSequenceFile(w.dirFile.Name())
	if err != nil {
		return err
	}
	f, err := w.createSegmentFile(p)
	if err != nil {
		return err
	}

	go func() {
		w.actorc <- func() error {
			return errors.Wrap(w.dirFile.Sync(), "sync WAL directory")
		}
	}()

	w.files = append(w.files, newSegmentFile(f))

	// TODO(gouthamve): make the buffer size a constant.
	w.cur = bufio.NewWriterSize(f, 8*1024*1024)
	w.curN = 8

	return nil
}

func (w *SegmentWAL) head() *segmentFile {
	if len(w.files) == 0 {
		return nil
	}
	return w.files[len(w.files)-1]
}

// Sync flushes the changes to disk.
func (w *SegmentWAL) Sync() error {
	var head *segmentFile
	var err error

	// Flush the writer and retrieve the reference to the head segment under mutex lock.
	func() {
		w.mtx.Lock()
		defer w.mtx.Unlock()
		if err = w.flush(); err != nil {
			return
		}
		head = w.head()
	}()
	if err != nil {
		return errors.Wrap(err, "flush buffer")
	}
	if head != nil {
		// But only fsync the head segment after releasing the mutex as it will block on disk I/O.
		start := time.Now()
		err := fileutil.Fdatasync(head.File)
		w.metrics.fsyncDuration.Observe(time.Since(start).Seconds())
		return err
	}
	return nil
}

func (w *SegmentWAL) sync() error {
	if err := w.flush(); err != nil {
		return err
	}
	if w.head() == nil {
		return nil
	}

	start := time.Now()
	err := fileutil.Fdatasync(w.head().File)
	w.metrics.fsyncDuration.Observe(time.Since(start).Seconds())
	return err
}

func (w *SegmentWAL) flush() error {
	if w.cur == nil {
		return nil
	}
	return w.cur.Flush()
}

func (w *SegmentWAL) run(interval time.Duration) {
	var tick <-chan time.Time

	if interval > 0 {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		tick = ticker.C
	}
	defer close(w.donec)

	for {
		// Processing all enqueued operations has precedence over shutdown and
		// background syncs.
		select {
		case f := <-w.actorc:
			if err := f(); err != nil {
				level.Error(w.logger).Log("msg", "operation failed", "err", err)
			}
			continue
		default:
		}
		select {
		case <-w.stopc:
			return
		case f := <-w.actorc:
			if err := f(); err != nil {
				level.Error(w.logger).Log("msg", "operation failed", "err", err)
			}
		case <-tick:
			if err := w.Sync(); err != nil {
				level.Error(w.logger).Log("msg", "sync failed", "err", err)
			}
		}
	}
}

// Close syncs all data and closes the underlying resources.
func (w *SegmentWAL) Close() error {
	// Make sure you can call Close() multiple times.
	select {
	case <-w.stopc:
		return nil // Already closed.
	default:
	}

	close(w.stopc)
	<-w.donec

	w.mtx.Lock()
	defer w.mtx.Unlock()

	if err := w.sync(); err != nil {
		return err
	}
	// On opening, a WAL must be fully consumed once. Afterwards
	// only the current segment will still be open.
	if hf := w.head(); hf != nil {
		if err := hf.Close(); err != nil {
			return errors.Wrapf(err, "closing WAL head %s", hf.Name())
		}
	}

	return errors.Wrapf(w.dirFile.Close(), "closing WAL dir %s", w.dirFile.Name())
}

func (w *SegmentWAL) write(t WALEntryType, flag uint8, buf []byte) error {
	// Cut to the next segment if the entry exceeds the file size unless it would also
	// exceed the size of a new segment.
	// TODO(gouthamve): Add a test for this case where the commit is greater than segmentSize.
	var (
		sz    = int64(len(buf)) + 6
		newsz = w.curN + sz
	)
	// XXX(fabxc): this currently cuts a new file whenever the WAL was newly opened.
	// Probably fine in general but may yield a lot of short files in some cases.
	if w.cur == nil || w.curN > w.segmentSize || newsz > w.segmentSize && sz <= w.segmentSize {
		if err := w.cut(); err != nil {
			return err
		}
	}
	n, err := w.writeTo(w.cur, w.crc32, t, flag, buf)

	w.curN += int64(n)

	return err
}

func (w *SegmentWAL) writeTo(wr io.Writer, crc32 hash.Hash, t WALEntryType, flag uint8, buf []byte) (int, error) {
	if len(buf) == 0 {
		return 0, nil
	}
	crc32.Reset()
	wr = io.MultiWriter(crc32, wr)

	var b [6]byte
	b[0] = byte(t)
	b[1] = flag

	binary.BigEndian.PutUint32(b[2:], uint32(len(buf)))

	n1, err := wr.Write(b[:])
	if err != nil {
		return n1, err
	}
	n2, err := wr.Write(buf)
	if err != nil {
		return n1 + n2, err
	}
	n3, err := wr.Write(crc32.Sum(b[:0]))

	return n1 + n2 + n3, err
}

const (
	walSeriesSimple  = 1
	walSamplesSimple = 1
	walDeletesSimple = 1
)

func (w *SegmentWAL) encodeSeries(buf *encoding.Encbuf, series []record.RefSeries) uint8 {
	for _, s := range series {
		buf.PutBE64(s.Ref)
		buf.PutUvarint(len(s.Labels))

		for _, l := range s.Labels {
			buf.PutUvarintStr(l.Name)
			buf.PutUvarintStr(l.Value)
		}
	}
	return walSeriesSimple
}

func (w *SegmentWAL) encodeSamples(buf *encoding.Encbuf, samples []record.RefSample) uint8 {
	if len(samples) == 0 {
		return walSamplesSimple
	}
	// Store base timestamp and base reference number of first sample.
	// All samples encode their timestamp and ref as delta to those.
	//
	// TODO(fabxc): optimize for all samples having the same timestamp.
	first := samples[0]

	buf.PutBE64(first.Ref)
	buf.PutBE64int64(first.T)

	for _, s := range samples {
		buf.PutVarint64(int64(s.Ref) - int64(first.Ref))
		buf.PutVarint64(s.T - first.T)
		buf.PutBE64(math.Float64bits(s.V))
	}
	return walSamplesSimple
}

func (w *SegmentWAL) encodeDeletes(buf *encoding.Encbuf, stones []tombstones.Stone) uint8 {
	for _, s := range stones {
		for _, iv := range s.Intervals {
			buf.PutBE64(s.Ref)
			buf.PutVarint64(iv.Mint)
			buf.PutVarint64(iv.Maxt)
		}
	}
	return walDeletesSimple
}

// walReader decodes and emits write ahead log entries.
type walReader struct {
	logger log.Logger

	files []*segmentFile
	cur   int
	buf   []byte
	crc32 hash.Hash32

	curType    WALEntryType
	curFlag    byte
	curBuf     []byte
	lastOffset int64 // offset after last successfully read entry

	err error
}

func newWALReader(files []*segmentFile, l log.Logger) *walReader {
	if l == nil {
		l = log.NewNopLogger()
	}
	return &walReader{
		logger: l,
		files:  files,
		buf:    make([]byte, 0, 128*4096),
		crc32:  newCRC32(),
	}
}

// Err returns the last error the reader encountered.
func (r *walReader) Err() error {
	return r.err
}

func (r *walReader) Read(
	seriesf func([]record.RefSeries),
	samplesf func([]record.RefSample),
	deletesf func([]tombstones.Stone),
) error {
	// Concurrency for replaying the WAL is very limited. We at least split out decoding and
	// processing into separate threads.
	// Historically, the processing is the bottleneck with reading and decoding using only
	// 15% of the CPU.
	var (
		seriesPool sync.Pool
		samplePool sync.Pool
		deletePool sync.Pool
	)
	donec := make(chan struct{})
	datac := make(chan interface{}, 100)

	go func() {
		defer close(donec)

		for x := range datac {
			switch v := x.(type) {
			case []record.RefSeries:
				if seriesf != nil {
					seriesf(v)
				}
				//lint:ignore SA6002 safe to ignore and actually fixing it has some performance penalty.
				seriesPool.Put(v[:0])
			case []record.RefSample:
				if samplesf != nil {
					samplesf(v)
				}
				//lint:ignore SA6002 safe to ignore and actually fixing it has some performance penalty.
				samplePool.Put(v[:0])
			case []tombstones.Stone:
				if deletesf != nil {
					deletesf(v)
				}
				//lint:ignore SA6002 safe to ignore and actually fixing it has some performance penalty.
				deletePool.Put(v[:0])
			default:
				level.Error(r.logger).Log("msg", "unexpected data type")
			}
		}
	}()

	var err error

	for r.next() {
		et, flag, b := r.at()

		// In decoding below we never return a walCorruptionErr for now.
		// Those should generally be caught by entry decoding before.
		switch et {
		case WALEntrySeries:
			var series []record.RefSeries
			if v := seriesPool.Get(); v == nil {
				series = make([]record.RefSeries, 0, 512)
			} else {
				series = v.([]record.RefSeries)
			}

			err = r.decodeSeries(flag, b, &series)
			if err != nil {
				err = errors.Wrap(err, "decode series entry")
				break
			}
			datac <- series

			cf := r.current()
			for _, s := range series {
				if cf.minSeries > s.Ref {
					cf.minSeries = s.Ref
				}
			}
		case WALEntrySamples:
			var samples []record.RefSample
			if v := samplePool.Get(); v == nil {
				samples = make([]record.RefSample, 0, 512)
			} else {
				samples = v.([]record.RefSample)
			}

			err = r.decodeSamples(flag, b, &samples)
			if err != nil {
				err = errors.Wrap(err, "decode samples entry")
				break
			}
			datac <- samples

			// Update the times for the WAL segment file.
			cf := r.current()
			for _, s := range samples {
				if cf.maxTime < s.T {
					cf.maxTime = s.T
				}
			}
		case WALEntryDeletes:
			var deletes []tombstones.Stone
			if v := deletePool.Get(); v == nil {
				deletes = make([]tombstones.Stone, 0, 512)
			} else {
				deletes = v.([]tombstones.Stone)
			}

			err = r.decodeDeletes(flag, b, &deletes)
			if err != nil {
				err = errors.Wrap(err, "decode delete entry")
				break
			}
			datac <- deletes

			// Update the times for the WAL segment file.
			cf := r.current()
			for _, s := range deletes {
				for _, iv := range s.Intervals {
					if cf.maxTime < iv.Maxt {
						cf.maxTime = iv.Maxt
					}
				}
			}
		}
	}
	close(datac)
	<-donec

	if err != nil {
		return err
	}
	if r.Err() != nil {
		return errors.Wrap(r.Err(), "read entry")
	}
	return nil
}

func (r *walReader) at() (WALEntryType, byte, []byte) {
	return r.curType, r.curFlag, r.curBuf
}

// next returns decodes the next entry pair and returns true
// if it was successful.
func (r *walReader) next() bool {
	if r.cur >= len(r.files) {
		return false
	}
	cf := r.files[r.cur]

	// Remember the offset after the last correctly read entry. If the next one
	// is corrupted, this is where we can safely truncate.
	r.lastOffset, r.err = cf.Seek(0, io.SeekCurrent)
	if r.err != nil {
		return false
	}

	et, flag, b, err := r.entry(cf)
	// If we reached the end of the reader, advance to the next one
	// and close.
	// Do not close on the last one as it will still be appended to.
	if err == io.EOF {
		if r.cur == len(r.files)-1 {
			return false
		}
		// Current reader completed, close and move to the next one.
		if err := cf.Close(); err != nil {
			r.err = err
			return false
		}
		r.cur++
		return r.next()
	}
	if err != nil {
		r.err = err
		return false
	}

	r.curType = et
	r.curFlag = flag
	r.curBuf = b
	return r.err == nil
}

func (r *walReader) current() *segmentFile {
	return r.files[r.cur]
}

// walCorruptionErr is a type wrapper for errors that indicate WAL corruption
// and trigger a truncation.
type walCorruptionErr struct {
	err        error
	file       int
	lastOffset int64
}

func (e walCorruptionErr) Error() string {
	return fmt.Sprintf("%s <file: %d, lastOffset: %d>", e.err, e.file, e.lastOffset)
}

func (r *walReader) corruptionErr(s string, args ...interface{}) error {
	return walCorruptionErr{
		err:        errors.Errorf(s, args...),
		file:       r.cur,
		lastOffset: r.lastOffset,
	}
}

func (r *walReader) entry(cr io.Reader) (WALEntryType, byte, []byte, error) {
	r.crc32.Reset()
	tr := io.TeeReader(cr, r.crc32)

	b := make([]byte, 6)
	if n, err := tr.Read(b); err != nil {
		return 0, 0, nil, err
	} else if n != 6 {
		return 0, 0, nil, r.corruptionErr("invalid entry header size %d", n)
	}

	var (
		etype  = WALEntryType(b[0])
		flag   = b[1]
		length = int(binary.BigEndian.Uint32(b[2:]))
	)
	// Exit if we reached pre-allocated space.
	if etype == 0 {
		return 0, 0, nil, io.EOF
	}
	if etype != WALEntrySeries && etype != WALEntrySamples && etype != WALEntryDeletes {
		return 0, 0, nil, r.corruptionErr("invalid entry type %d", etype)
	}

	if length > len(r.buf) {
		r.buf = make([]byte, length)
	}
	buf := r.buf[:length]

	if n, err := tr.Read(buf); err != nil {
		return 0, 0, nil, err
	} else if n != length {
		return 0, 0, nil, r.corruptionErr("invalid entry body size %d", n)
	}

	if n, err := cr.Read(b[:4]); err != nil {
		return 0, 0, nil, err
	} else if n != 4 {
		return 0, 0, nil, r.corruptionErr("invalid checksum length %d", n)
	}
	if exp, has := binary.BigEndian.Uint32(b[:4]), r.crc32.Sum32(); has != exp {
		return 0, 0, nil, r.corruptionErr("unexpected CRC32 checksum %x, want %x", has, exp)
	}

	return etype, flag, buf, nil
}

func (r *walReader) decodeSeries(flag byte, b []byte, res *[]record.RefSeries) error {
	dec := encoding.Decbuf{B: b}

	for len(dec.B) > 0 && dec.Err() == nil {
		ref := dec.Be64()

		lset := make(labels.Labels, dec.Uvarint())

		for i := range lset {
			lset[i].Name = dec.UvarintStr()
			lset[i].Value = dec.UvarintStr()
		}
		sort.Sort(lset)

		*res = append(*res, record.RefSeries{
			Ref:    ref,
			Labels: lset,
		})
	}
	if dec.Err() != nil {
		return dec.Err()
	}
	if len(dec.B) > 0 {
		return errors.Errorf("unexpected %d bytes left in entry", len(dec.B))
	}
	return nil
}

func (r *walReader) decodeSamples(flag byte, b []byte, res *[]record.RefSample) error {
	if len(b) == 0 {
		return nil
	}
	dec := encoding.Decbuf{B: b}

	var (
		baseRef  = dec.Be64()
		baseTime = dec.Be64int64()
	)

	for len(dec.B) > 0 && dec.Err() == nil {
		dref := dec.Varint64()
		dtime := dec.Varint64()
		val := dec.Be64()

		*res = append(*res, record.RefSample{
			Ref: uint64(int64(baseRef) + dref),
			T:   baseTime + dtime,
			V:   math.Float64frombits(val),
		})
	}

	if dec.Err() != nil {
		return errors.Wrapf(dec.Err(), "decode error after %d samples", len(*res))
	}
	if len(dec.B) > 0 {
		return errors.Errorf("unexpected %d bytes left in entry", len(dec.B))
	}
	return nil
}

func (r *walReader) decodeDeletes(flag byte, b []byte, res *[]tombstones.Stone) error {
	dec := &encoding.Decbuf{B: b}

	for dec.Len() > 0 && dec.Err() == nil {
		*res = append(*res, tombstones.Stone{
			Ref: dec.Be64(),
			Intervals: tombstones.Intervals{
				{Mint: dec.Varint64(), Maxt: dec.Varint64()},
			},
		})
	}
	if dec.Err() != nil {
		return dec.Err()
	}
	if len(dec.B) > 0 {
		return errors.Errorf("unexpected %d bytes left in entry", len(dec.B))
	}
	return nil
}

func deprecatedWALExists(logger log.Logger, dir string) (bool, error) {
	// Detect whether we still have the old WAL.
	fns, err := sequenceFiles(dir)
	if err != nil && !os.IsNotExist(err) {
		return false, errors.Wrap(err, "list sequence files")
	}
	if len(fns) == 0 {
		return false, nil // No WAL at all yet.
	}
	// Check header of first segment to see whether we are still dealing with an
	// old WAL.
	f, err := os.Open(fns[0])
	if err != nil {
		return false, errors.Wrap(err, "check first existing segment")
	}
	defer f.Close()

	var hdr [4]byte
	if _, err := f.Read(hdr[:]); err != nil && err != io.EOF {
		return false, errors.Wrap(err, "read header from first segment")
	}
	// If we cannot read the magic header for segments of the old WAL, abort.
	// Either it's migrated already or there's a corruption issue with which
	// we cannot deal here anyway. Subsequent attempts to open the WAL will error in that case.
	if binary.BigEndian.Uint32(hdr[:]) != WALMagic {
		return false, nil
	}
	return true, nil
}

// MigrateWAL rewrites the deprecated write ahead log into the new format.
func MigrateWAL(logger log.Logger, dir string) (err error) {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	if exists, err := deprecatedWALExists(logger, dir); err != nil || !exists {
		return err
	}
	level.Info(logger).Log("msg", "Migrating WAL format")

	tmpdir := dir + ".tmp"
	if err := os.RemoveAll(tmpdir); err != nil {
		return errors.Wrap(err, "cleanup replacement dir")
	}
	repl, err := wal.New(logger, nil, tmpdir, false)
	if err != nil {
		return errors.Wrap(err, "open new WAL")
	}

	// It should've already been closed as part of the previous finalization.
	// Do it once again in case of prior errors.
	defer func() {
		if err != nil {
			repl.Close()
		}
	}()

	w, err := OpenSegmentWAL(dir, logger, time.Minute, nil)
	if err != nil {
		return errors.Wrap(err, "open old WAL")
	}
	defer w.Close()

	rdr := w.Reader()

	var (
		enc record.Encoder
		b   []byte
	)
	decErr := rdr.Read(
		func(s []record.RefSeries) {
			if err != nil {
				return
			}
			err = repl.Log(enc.Series(s, b[:0]))
		},
		func(s []record.RefSample) {
			if err != nil {
				return
			}
			err = repl.Log(enc.Samples(s, b[:0]))
		},
		func(s []tombstones.Stone) {
			if err != nil {
				return
			}
			err = repl.Log(enc.Tombstones(s, b[:0]))
		},
	)
	if decErr != nil {
		return errors.Wrap(err, "decode old entries")
	}
	if err != nil {
		return errors.Wrap(err, "write new entries")
	}
	// We explicitly close even when there is a defer for Windows to be
	// able to delete it. The defer is in place to close it in-case there
	// are errors above.
	if err := w.Close(); err != nil {
		return errors.Wrap(err, "close old WAL")
	}
	if err := repl.Close(); err != nil {
		return errors.Wrap(err, "close new WAL")
	}
	if err := fileutil.Replace(tmpdir, dir); err != nil {
		return errors.Wrap(err, "replace old WAL")
	}
	return nil
}
