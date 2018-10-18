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
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/oklog/ulid"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/tsdb/chunkenc"
	"github.com/prometheus/tsdb/chunks"
	"github.com/prometheus/tsdb/fileutil"
	"github.com/prometheus/tsdb/index"
	"github.com/prometheus/tsdb/labels"
)

// ExponentialBlockRanges returns the time ranges based on the stepSize.
func ExponentialBlockRanges(minSize int64, steps, stepSize int) []int64 {
	ranges := make([]int64, 0, steps)
	curRange := minSize
	for i := 0; i < steps; i++ {
		ranges = append(ranges, curRange)
		curRange = curRange * int64(stepSize)
	}

	return ranges
}

// Compactor provides compaction against an underlying storage
// of time series data.
type Compactor interface {
	// Plan returns a set of non-overlapping directories that can
	// be compacted concurrently.
	// Results returned when compactions are in progress are undefined.
	Plan(dir string) ([]string, error)

	// Write persists a Block into a directory.
	Write(dest string, b BlockReader, mint, maxt int64, parent *BlockMeta) (ulid.ULID, error)

	// Compact runs compaction against the provided directories. Must
	// only be called concurrently with results of Plan().
	Compact(dest string, dirs ...string) (ulid.ULID, error)
}

// LeveledCompactor implements the Compactor interface.
type LeveledCompactor struct {
	dir       string
	metrics   *compactorMetrics
	logger    log.Logger
	ranges    []int64
	chunkPool chunkenc.Pool
}

type compactorMetrics struct {
	ran          prometheus.Counter
	failed       prometheus.Counter
	duration     prometheus.Histogram
	chunkSize    prometheus.Histogram
	chunkSamples prometheus.Histogram
	chunkRange   prometheus.Histogram
}

func newCompactorMetrics(r prometheus.Registerer) *compactorMetrics {
	m := &compactorMetrics{}

	m.ran = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_compactions_total",
		Help: "Total number of compactions that were executed for the partition.",
	})
	m.failed = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_compactions_failed_total",
		Help: "Total number of compactions that failed for the partition.",
	})
	m.duration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "prometheus_tsdb_compaction_duration_seconds",
		Help:    "Duration of compaction runs",
		Buckets: prometheus.ExponentialBuckets(1, 2, 10),
	})
	m.chunkSize = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "prometheus_tsdb_compaction_chunk_size_bytes",
		Help:    "Final size of chunks on their first compaction",
		Buckets: prometheus.ExponentialBuckets(32, 1.5, 12),
	})
	m.chunkSamples = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "prometheus_tsdb_compaction_chunk_samples",
		Help:    "Final number of samples on their first compaction",
		Buckets: prometheus.ExponentialBuckets(4, 1.5, 12),
	})
	m.chunkRange = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "prometheus_tsdb_compaction_chunk_range_seconds",
		Help:    "Final time range of chunks on their first compaction",
		Buckets: prometheus.ExponentialBuckets(100, 4, 10),
	})

	if r != nil {
		r.MustRegister(
			m.ran,
			m.failed,
			m.duration,
			m.chunkRange,
			m.chunkSamples,
			m.chunkSize,
		)
	}
	return m
}

// NewLeveledCompactor returns a LeveledCompactor.
func NewLeveledCompactor(r prometheus.Registerer, l log.Logger, ranges []int64, pool chunkenc.Pool) (*LeveledCompactor, error) {
	if len(ranges) == 0 {
		return nil, errors.Errorf("at least one range must be provided")
	}
	if pool == nil {
		pool = chunkenc.NewPool()
	}
	return &LeveledCompactor{
		ranges:    ranges,
		chunkPool: pool,
		logger:    l,
		metrics:   newCompactorMetrics(r),
	}, nil
}

type dirMeta struct {
	dir  string
	meta *BlockMeta
}

// Plan returns a list of compactable blocks in the provided directory.
func (c *LeveledCompactor) Plan(dir string) ([]string, error) {
	dirs, err := blockDirs(dir)
	if err != nil {
		return nil, err
	}
	if len(dirs) < 1 {
		return nil, nil
	}

	var dms []dirMeta
	for _, dir := range dirs {
		meta, err := readMetaFile(dir)
		if err != nil {
			return nil, err
		}
		dms = append(dms, dirMeta{dir, meta})
	}
	return c.plan(dms)
}

func (c *LeveledCompactor) plan(dms []dirMeta) ([]string, error) {
	sort.Slice(dms, func(i, j int) bool {
		return dms[i].meta.MinTime < dms[j].meta.MinTime
	})

	// We do not include a recently created block with max(minTime), so the block which was just created from WAL.
	// This gives users a window of a full block size to piece-wise backup new data without having to care about data overlap.
	dms = dms[:len(dms)-1]

	var res []string
	for _, dm := range c.selectDirs(dms) {
		res = append(res, dm.dir)
	}
	if len(res) > 0 {
		return res, nil
	}

	// Compact any blocks that have >5% tombstones.
	for i := len(dms) - 1; i >= 0; i-- {
		meta := dms[i].meta
		if meta.MaxTime-meta.MinTime < c.ranges[len(c.ranges)/2] {
			break
		}

		if float64(meta.Stats.NumTombstones)/float64(meta.Stats.NumSeries+1) > 0.05 {
			return []string{dms[i].dir}, nil
		}
	}

	return nil, nil
}

// selectDirs returns the dir metas that should be compacted into a single new block.
// If only a single block range is configured, the result is always nil.
func (c *LeveledCompactor) selectDirs(ds []dirMeta) []dirMeta {
	if len(c.ranges) < 2 || len(ds) < 1 {
		return nil
	}

	highTime := ds[len(ds)-1].meta.MinTime

	for _, iv := range c.ranges[1:] {
		parts := splitByRange(ds, iv)
		if len(parts) == 0 {
			continue
		}

	Outer:
		for _, p := range parts {
			// Do not select the range if it has a block whose compaction failed.
			for _, dm := range p {
				if dm.meta.Compaction.Failed {
					continue Outer
				}
			}

			mint := p[0].meta.MinTime
			maxt := p[len(p)-1].meta.MaxTime
			// Pick the range of blocks if it spans the full range (potentially with gaps)
			// or is before the most recent block.
			// This ensures we don't compact blocks prematurely when another one of the same
			// size still fits in the range.
			if (maxt-mint == iv || maxt <= highTime) && len(p) > 1 {
				return p
			}
		}
	}

	return nil
}

// splitByRange splits the directories by the time range. The range sequence starts at 0.
//
// For example, if we have blocks [0-10, 10-20, 50-60, 90-100] and the split range tr is 30
// it returns [0-10, 10-20], [50-60], [90-100].
func splitByRange(ds []dirMeta, tr int64) [][]dirMeta {
	var splitDirs [][]dirMeta

	for i := 0; i < len(ds); {
		var (
			group []dirMeta
			t0    int64
			m     = ds[i].meta
		)
		// Compute start of aligned time range of size tr closest to the current block's start.
		if m.MinTime >= 0 {
			t0 = tr * (m.MinTime / tr)
		} else {
			t0 = tr * ((m.MinTime - tr + 1) / tr)
		}
		// Skip blocks that don't fall into the range. This can happen via mis-alignment or
		// by being the multiple of the intended range.
		if ds[i].meta.MinTime < t0 || ds[i].meta.MaxTime > t0+tr {
			i++
			continue
		}

		// Add all dirs to the current group that are within [t0, t0+tr].
		for ; i < len(ds); i++ {
			// Either the block falls into the next range or doesn't fit at all (checked above).
			if ds[i].meta.MinTime < t0 || ds[i].meta.MaxTime > t0+tr {
				break
			}
			group = append(group, ds[i])
		}

		if len(group) > 0 {
			splitDirs = append(splitDirs, group)
		}
	}

	return splitDirs
}

func compactBlockMetas(uid ulid.ULID, blocks ...*BlockMeta) *BlockMeta {
	res := &BlockMeta{
		ULID:    uid,
		MinTime: blocks[0].MinTime,
		MaxTime: blocks[len(blocks)-1].MaxTime,
	}

	sources := map[ulid.ULID]struct{}{}

	for _, b := range blocks {
		if b.Compaction.Level > res.Compaction.Level {
			res.Compaction.Level = b.Compaction.Level
		}
		for _, s := range b.Compaction.Sources {
			sources[s] = struct{}{}
		}
		res.Compaction.Parents = append(res.Compaction.Parents, BlockDesc{
			ULID:    b.ULID,
			MinTime: b.MinTime,
			MaxTime: b.MaxTime,
		})
	}
	res.Compaction.Level++

	for s := range sources {
		res.Compaction.Sources = append(res.Compaction.Sources, s)
	}
	sort.Slice(res.Compaction.Sources, func(i, j int) bool {
		return res.Compaction.Sources[i].Compare(res.Compaction.Sources[j]) < 0
	})

	return res
}

// Compact creates a new block in the compactor's directory from the blocks in the
// provided directories.
func (c *LeveledCompactor) Compact(dest string, dirs ...string) (uid ulid.ULID, err error) {
	var (
		blocks []BlockReader
		bs     []*Block
		metas  []*BlockMeta
		uids   []string
	)

	for _, d := range dirs {
		b, err := OpenBlock(d, c.chunkPool)
		if err != nil {
			return uid, err
		}
		defer b.Close()

		meta, err := readMetaFile(d)
		if err != nil {
			return uid, err
		}

		metas = append(metas, meta)
		blocks = append(blocks, b)
		bs = append(bs, b)
		uids = append(uids, meta.ULID.String())
	}

	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	uid = ulid.MustNew(ulid.Now(), entropy)

	meta := compactBlockMetas(uid, metas...)
	err = c.write(dest, meta, blocks...)
	if err == nil {
		level.Info(c.logger).Log(
			"msg", "compact blocks",
			"count", len(blocks),
			"mint", meta.MinTime,
			"maxt", meta.MaxTime,
			"ulid", meta.ULID,
			"sources", fmt.Sprintf("%v", uids),
		)
		return uid, nil
	}

	var merr MultiError
	merr.Add(err)

	for _, b := range bs {
		if err := b.setCompactionFailed(); err != nil {
			merr.Add(errors.Wrapf(err, "setting compaction failed for block: %s", b.Dir()))
		}
	}

	return uid, merr
}

func (c *LeveledCompactor) Write(dest string, b BlockReader, mint, maxt int64, parent *BlockMeta) (ulid.ULID, error) {
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	uid := ulid.MustNew(ulid.Now(), entropy)

	meta := &BlockMeta{
		ULID:    uid,
		MinTime: mint,
		MaxTime: maxt,
	}
	meta.Compaction.Level = 1
	meta.Compaction.Sources = []ulid.ULID{uid}

	if parent != nil {
		meta.Compaction.Parents = []BlockDesc{
			{ULID: parent.ULID, MinTime: parent.MinTime, MaxTime: parent.MaxTime},
		}
	}

	err := c.write(dest, meta, b)
	if err != nil {
		return uid, err
	}

	level.Info(c.logger).Log("msg", "write block", "mint", meta.MinTime, "maxt", meta.MaxTime, "ulid", meta.ULID)
	return uid, nil
}

// instrumentedChunkWriter is used for level 1 compactions to record statistics
// about compacted chunks.
type instrumentedChunkWriter struct {
	ChunkWriter

	size    prometheus.Histogram
	samples prometheus.Histogram
	trange  prometheus.Histogram
}

func (w *instrumentedChunkWriter) WriteChunks(chunks ...chunks.Meta) error {
	for _, c := range chunks {
		w.size.Observe(float64(len(c.Chunk.Bytes())))
		w.samples.Observe(float64(c.Chunk.NumSamples()))
		w.trange.Observe(float64(c.MaxTime - c.MinTime))
	}
	return w.ChunkWriter.WriteChunks(chunks...)
}

// write creates a new block that is the union of the provided blocks into dir.
// It cleans up all files of the old blocks after completing successfully.
func (c *LeveledCompactor) write(dest string, meta *BlockMeta, blocks ...BlockReader) (err error) {
	dir := filepath.Join(dest, meta.ULID.String())
	tmp := dir + ".tmp"

	defer func(t time.Time) {
		if err != nil {
			c.metrics.failed.Inc()
			// TODO(gouthamve): Handle error how?
			if err := os.RemoveAll(tmp); err != nil {
				level.Error(c.logger).Log("msg", "removed tmp folder after failed compaction", "err", err.Error())
			}
		}
		c.metrics.ran.Inc()
		c.metrics.duration.Observe(time.Since(t).Seconds())
	}(time.Now())

	if err = os.RemoveAll(tmp); err != nil {
		return err
	}

	if err = os.MkdirAll(tmp, 0777); err != nil {
		return err
	}

	// Populate chunk and index files into temporary directory with
	// data of all blocks.
	var chunkw ChunkWriter

	chunkw, err = chunks.NewWriter(chunkDir(tmp))
	if err != nil {
		return errors.Wrap(err, "open chunk writer")
	}
	defer chunkw.Close()
	// Record written chunk sizes on level 1 compactions.
	if meta.Compaction.Level == 1 {
		chunkw = &instrumentedChunkWriter{
			ChunkWriter: chunkw,
			size:        c.metrics.chunkSize,
			samples:     c.metrics.chunkSamples,
			trange:      c.metrics.chunkRange,
		}
	}

	indexw, err := index.NewWriter(filepath.Join(tmp, indexFilename))
	if err != nil {
		return errors.Wrap(err, "open index writer")
	}
	defer indexw.Close()

	if err := c.populateBlock(blocks, meta, indexw, chunkw); err != nil {
		return errors.Wrap(err, "write compaction")
	}

	if err = writeMetaFile(tmp, meta); err != nil {
		return errors.Wrap(err, "write merged meta")
	}

	// We are explicitly closing them here to check for error even
	// though these are covered under defer. This is because in Windows,
	// you cannot delete these unless they are closed and the defer is to
	// make sure they are closed if the function exits due to an error above.
	if err = chunkw.Close(); err != nil {
		return errors.Wrap(err, "close chunk writer")
	}
	if err = indexw.Close(); err != nil {
		return errors.Wrap(err, "close index writer")
	}

	// Create an empty tombstones file.
	if err := writeTombstoneFile(tmp, NewMemTombstones()); err != nil {
		return errors.Wrap(err, "write new tombstones file")
	}

	df, err := fileutil.OpenDir(tmp)
	if err != nil {
		return errors.Wrap(err, "open temporary block dir")
	}
	defer func() {
		if df != nil {
			df.Close()
		}
	}()

	if err := fileutil.Fsync(df); err != nil {
		return errors.Wrap(err, "sync temporary dir file")
	}

	// Close temp dir before rename block dir (for windows platform).
	if err = df.Close(); err != nil {
		return errors.Wrap(err, "close temporary dir")
	}
	df = nil

	// Block successfully written, make visible and remove old ones.
	if err := renameFile(tmp, dir); err != nil {
		return errors.Wrap(err, "rename block dir")
	}

	return nil
}

// populateBlock fills the index and chunk writers with new data gathered as the union
// of the provided blocks. It returns meta information for the new block.
func (c *LeveledCompactor) populateBlock(blocks []BlockReader, meta *BlockMeta, indexw IndexWriter, chunkw ChunkWriter) error {
	if len(blocks) == 0 {
		return errors.New("cannot populate block from no readers")
	}

	var (
		set        ChunkSeriesSet
		allSymbols = make(map[string]struct{}, 1<<16)
		closers    = []io.Closer{}
	)
	defer func() { closeAll(closers...) }()

	for i, b := range blocks {
		indexr, err := b.Index()
		if err != nil {
			return errors.Wrapf(err, "open index reader for block %s", b)
		}
		closers = append(closers, indexr)

		chunkr, err := b.Chunks()
		if err != nil {
			return errors.Wrapf(err, "open chunk reader for block %s", b)
		}
		closers = append(closers, chunkr)

		tombsr, err := b.Tombstones()
		if err != nil {
			return errors.Wrapf(err, "open tombstone reader for block %s", b)
		}
		closers = append(closers, tombsr)

		symbols, err := indexr.Symbols()
		if err != nil {
			return errors.Wrap(err, "read symbols")
		}
		for s := range symbols {
			allSymbols[s] = struct{}{}
		}

		all, err := indexr.Postings(index.AllPostingsKey())
		if err != nil {
			return err
		}
		all = indexr.SortedPostings(all)

		s := newCompactionSeriesSet(indexr, chunkr, tombsr, all)

		if i == 0 {
			set = s
			continue
		}
		set, err = newCompactionMerger(set, s)
		if err != nil {
			return err
		}
	}

	// We fully rebuild the postings list index from merged series.
	var (
		postings = index.NewMemPostings()
		values   = map[string]stringset{}
		i        = uint64(0)
	)

	if err := indexw.AddSymbols(allSymbols); err != nil {
		return errors.Wrap(err, "add symbols")
	}

	for set.Next() {
		lset, chks, dranges := set.At() // The chunks here are not fully deleted.

		// Skip the series with all deleted chunks.
		if len(chks) == 0 {
			continue
		}

		for i, chk := range chks {
			if chk.MinTime < meta.MinTime || chk.MaxTime > meta.MaxTime {
				return errors.Errorf("found chunk with minTime: %d maxTime: %d outside of compacted minTime: %d maxTime: %d",
					chk.MinTime, chk.MaxTime, meta.MinTime, meta.MaxTime)
			}

			if len(dranges) > 0 {
				// Re-encode the chunk to not have deleted values.
				if !chk.OverlapsClosedInterval(dranges[0].Mint, dranges[len(dranges)-1].Maxt) {
					continue
				}
				newChunk := chunkenc.NewXORChunk()
				app, err := newChunk.Appender()
				if err != nil {
					return err
				}

				it := &deletedIterator{it: chk.Chunk.Iterator(), intervals: dranges}
				for it.Next() {
					ts, v := it.At()
					app.Append(ts, v)
				}

				chks[i].Chunk = newChunk
			}
		}

		if err := chunkw.WriteChunks(chks...); err != nil {
			return errors.Wrap(err, "write chunks")
		}

		if err := indexw.AddSeries(i, lset, chks...); err != nil {
			return errors.Wrap(err, "add series")
		}

		meta.Stats.NumChunks += uint64(len(chks))
		meta.Stats.NumSeries++
		for _, chk := range chks {
			meta.Stats.NumSamples += uint64(chk.Chunk.NumSamples())
		}

		for _, chk := range chks {
			if err := c.chunkPool.Put(chk.Chunk); err != nil {
				return errors.Wrap(err, "put chunk")
			}
		}

		for _, l := range lset {
			valset, ok := values[l.Name]
			if !ok {
				valset = stringset{}
				values[l.Name] = valset
			}
			valset.set(l.Value)
		}
		postings.Add(i, lset)

		i++
	}
	if set.Err() != nil {
		return errors.Wrap(set.Err(), "iterate compaction set")
	}

	s := make([]string, 0, 256)
	for n, v := range values {
		s = s[:0]

		for x := range v {
			s = append(s, x)
		}
		if err := indexw.WriteLabelIndex([]string{n}, s); err != nil {
			return errors.Wrap(err, "write label index")
		}
	}

	for _, l := range postings.SortedKeys() {
		if err := indexw.WritePostings(l.Name, l.Value, postings.Get(l.Name, l.Value)); err != nil {
			return errors.Wrap(err, "write postings")
		}
	}
	return nil
}

type compactionSeriesSet struct {
	p          index.Postings
	index      IndexReader
	chunks     ChunkReader
	tombstones TombstoneReader

	l         labels.Labels
	c         []chunks.Meta
	intervals Intervals
	err       error
}

func newCompactionSeriesSet(i IndexReader, c ChunkReader, t TombstoneReader, p index.Postings) *compactionSeriesSet {
	return &compactionSeriesSet{
		index:      i,
		chunks:     c,
		tombstones: t,
		p:          p,
	}
}

func (c *compactionSeriesSet) Next() bool {
	if !c.p.Next() {
		return false
	}
	var err error

	c.intervals, err = c.tombstones.Get(c.p.At())
	if err != nil {
		c.err = errors.Wrap(err, "get tombstones")
		return false
	}

	if err = c.index.Series(c.p.At(), &c.l, &c.c); err != nil {
		c.err = errors.Wrapf(err, "get series %d", c.p.At())
		return false
	}

	// Remove completely deleted chunks.
	if len(c.intervals) > 0 {
		chks := make([]chunks.Meta, 0, len(c.c))
		for _, chk := range c.c {
			if !(Interval{chk.MinTime, chk.MaxTime}.isSubrange(c.intervals)) {
				chks = append(chks, chk)
			}
		}

		c.c = chks
	}

	for i := range c.c {
		chk := &c.c[i]

		chk.Chunk, err = c.chunks.Chunk(chk.Ref)
		if err != nil {
			c.err = errors.Wrapf(err, "chunk %d not found", chk.Ref)
			return false
		}
	}

	return true
}

func (c *compactionSeriesSet) Err() error {
	if c.err != nil {
		return c.err
	}
	return c.p.Err()
}

func (c *compactionSeriesSet) At() (labels.Labels, []chunks.Meta, Intervals) {
	return c.l, c.c, c.intervals
}

type compactionMerger struct {
	a, b ChunkSeriesSet

	aok, bok  bool
	l         labels.Labels
	c         []chunks.Meta
	intervals Intervals
}

func newCompactionMerger(a, b ChunkSeriesSet) (*compactionMerger, error) {
	c := &compactionMerger{
		a: a,
		b: b,
	}
	// Initialize first elements of both sets as Next() needs
	// one element look-ahead.
	c.aok = c.a.Next()
	c.bok = c.b.Next()

	return c, c.Err()
}

func (c *compactionMerger) compare() int {
	if !c.aok {
		return 1
	}
	if !c.bok {
		return -1
	}
	a, _, _ := c.a.At()
	b, _, _ := c.b.At()
	return labels.Compare(a, b)
}

func (c *compactionMerger) Next() bool {
	if !c.aok && !c.bok || c.Err() != nil {
		return false
	}
	// While advancing child iterators the memory used for labels and chunks
	// may be reused. When picking a series we have to store the result.
	var lset labels.Labels
	var chks []chunks.Meta

	d := c.compare()
	if d > 0 {
		lset, chks, c.intervals = c.b.At()
		c.l = append(c.l[:0], lset...)
		c.c = append(c.c[:0], chks...)

		c.bok = c.b.Next()
	} else if d < 0 {
		lset, chks, c.intervals = c.a.At()
		c.l = append(c.l[:0], lset...)
		c.c = append(c.c[:0], chks...)

		c.aok = c.a.Next()
	} else {
		// Both sets contain the current series. Chain them into a single one.
		l, ca, ra := c.a.At()
		_, cb, rb := c.b.At()

		for _, r := range rb {
			ra = ra.add(r)
		}

		c.l = append(c.l[:0], l...)
		c.c = append(append(c.c[:0], ca...), cb...)
		c.intervals = ra

		c.aok = c.a.Next()
		c.bok = c.b.Next()
	}

	return true
}

func (c *compactionMerger) Err() error {
	if c.a.Err() != nil {
		return c.a.Err()
	}
	return c.b.Err()
}

func (c *compactionMerger) At() (labels.Labels, []chunks.Meta, Intervals) {
	return c.l, c.c, c.intervals
}

func renameFile(from, to string) error {
	if err := os.RemoveAll(to); err != nil {
		return err
	}
	if err := os.Rename(from, to); err != nil {
		return err
	}

	// Directory was renamed; sync parent dir to persist rename.
	pdir, err := fileutil.OpenDir(filepath.Dir(to))
	if err != nil {
		return err
	}

	if err = fileutil.Fsync(pdir); err != nil {
		pdir.Close()
		return err
	}
	return pdir.Close()
}
