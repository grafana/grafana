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

// Package tsdb implements a time series storage for float64 sample data.
package tsdb

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/oklog/ulid"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/tsdb/chunkenc"
	"github.com/prometheus/tsdb/fileutil"
	"github.com/prometheus/tsdb/labels"
	"github.com/prometheus/tsdb/wal"
	"golang.org/x/sync/errgroup"
)

// DefaultOptions used for the DB. They are sane for setups using
// millisecond precision timestamps.
var DefaultOptions = &Options{
	WALFlushInterval:  5 * time.Second,
	RetentionDuration: 15 * 24 * 60 * 60 * 1000, // 15 days in milliseconds
	BlockRanges:       ExponentialBlockRanges(int64(2*time.Hour)/1e6, 3, 5),
	NoLockfile:        false,
}

// Options of the DB storage.
type Options struct {
	// The interval at which the write ahead log is flushed to disk.
	WALFlushInterval time.Duration

	// Duration of persisted data to keep.
	RetentionDuration uint64

	// The sizes of the Blocks.
	BlockRanges []int64

	// NoLockfile disables creation and consideration of a lock file.
	NoLockfile bool
}

// Appender allows appending a batch of data. It must be completed with a
// call to Commit or Rollback and must not be reused afterwards.
//
// Operations on the Appender interface are not goroutine-safe.
type Appender interface {
	// Add adds a sample pair for the given series. A reference number is
	// returned which can be used to add further samples in the same or later
	// transactions.
	// Returned reference numbers are ephemeral and may be rejected in calls
	// to AddFast() at any point. Adding the sample via Add() returns a new
	// reference number.
	// If the reference is 0 it must not be used for caching.
	Add(l labels.Labels, t int64, v float64) (uint64, error)

	// Add adds a sample pair for the referenced series. It is generally faster
	// than adding a sample by providing its full label set.
	AddFast(ref uint64, t int64, v float64) error

	// Commit submits the collected samples and purges the batch.
	Commit() error

	// Rollback rolls back all modifications made in the appender so far.
	Rollback() error
}

// DB handles reads and writes of time series falling into
// a hashed partition of a seriedb.
type DB struct {
	dir   string
	lockf fileutil.Releaser

	logger    log.Logger
	metrics   *dbMetrics
	opts      *Options
	chunkPool chunkenc.Pool
	compactor Compactor

	// Mutex for that must be held when modifying the general block layout.
	mtx    sync.RWMutex
	blocks []*Block

	head *Head

	compactc chan struct{}
	donec    chan struct{}
	stopc    chan struct{}

	// cmtx is used to control compactions and deletions.
	cmtx               sync.Mutex
	compactionsEnabled bool
}

type dbMetrics struct {
	loadedBlocks         prometheus.GaugeFunc
	symbolTableSize      prometheus.GaugeFunc
	reloads              prometheus.Counter
	reloadsFailed        prometheus.Counter
	compactionsTriggered prometheus.Counter
	cutoffs              prometheus.Counter
	cutoffsFailed        prometheus.Counter
	startTime            prometheus.GaugeFunc
	tombCleanTimer       prometheus.Histogram
}

func newDBMetrics(db *DB, r prometheus.Registerer) *dbMetrics {
	m := &dbMetrics{}

	m.loadedBlocks = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "prometheus_tsdb_blocks_loaded",
		Help: "Number of currently loaded data blocks",
	}, func() float64 {
		db.mtx.RLock()
		defer db.mtx.RUnlock()
		return float64(len(db.blocks))
	})
	m.symbolTableSize = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "prometheus_tsdb_symbol_table_size_bytes",
		Help: "Size of symbol table on disk (in bytes)",
	}, func() float64 {
		db.mtx.RLock()
		blocks := db.blocks[:]
		db.mtx.RUnlock()
		symTblSize := uint64(0)
		for _, b := range blocks {
			symTblSize += b.GetSymbolTableSize()
		}
		return float64(symTblSize)
	})
	m.reloads = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_reloads_total",
		Help: "Number of times the database reloaded block data from disk.",
	})
	m.reloadsFailed = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_reloads_failures_total",
		Help: "Number of times the database failed to reload block data from disk.",
	})
	m.compactionsTriggered = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_compactions_triggered_total",
		Help: "Total number of triggered compactions for the partition.",
	})
	m.cutoffs = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_retention_cutoffs_total",
		Help: "Number of times the database cut off block data from disk.",
	})
	m.cutoffsFailed = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "prometheus_tsdb_retention_cutoffs_failures_total",
		Help: "Number of times the database failed to cut off block data from disk.",
	})
	m.startTime = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "prometheus_tsdb_lowest_timestamp",
		Help: "Lowest timestamp value stored in the database.",
	}, func() float64 {
		db.mtx.RLock()
		defer db.mtx.RUnlock()
		if len(db.blocks) == 0 {
			return float64(db.head.minTime)
		}
		return float64(db.blocks[0].meta.MinTime)
	})
	m.tombCleanTimer = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name: "prometheus_tsdb_tombstone_cleanup_seconds",
		Help: "The time taken to recompact blocks to remove tombstones.",
	})

	if r != nil {
		r.MustRegister(
			m.loadedBlocks,
			m.symbolTableSize,
			m.reloads,
			m.reloadsFailed,
			m.cutoffs,
			m.cutoffsFailed,
			m.compactionsTriggered,
			m.startTime,
			m.tombCleanTimer,
		)
	}
	return m
}

// Open returns a new DB in the given directory.
func Open(dir string, l log.Logger, r prometheus.Registerer, opts *Options) (db *DB, err error) {
	if err := os.MkdirAll(dir, 0777); err != nil {
		return nil, err
	}
	if l == nil {
		l = log.NewNopLogger()
	}
	if opts == nil {
		opts = DefaultOptions
	}
	// Fixup bad format written by Prometheus 2.1.
	if err := repairBadIndexVersion(l, dir); err != nil {
		return nil, err
	}
	// Migrate old WAL if one exists.
	if err := MigrateWAL(l, filepath.Join(dir, "wal")); err != nil {
		return nil, errors.Wrap(err, "migrate WAL")
	}

	db = &DB{
		dir:                dir,
		logger:             l,
		opts:               opts,
		compactc:           make(chan struct{}, 1),
		donec:              make(chan struct{}),
		stopc:              make(chan struct{}),
		compactionsEnabled: true,
		chunkPool:          chunkenc.NewPool(),
	}
	db.metrics = newDBMetrics(db, r)

	if !opts.NoLockfile {
		absdir, err := filepath.Abs(dir)
		if err != nil {
			return nil, err
		}
		lockf, _, err := fileutil.Flock(filepath.Join(absdir, "lock"))
		if err != nil {
			return nil, errors.Wrap(err, "lock DB directory")
		}
		db.lockf = lockf
	}

	db.compactor, err = NewLeveledCompactor(r, l, opts.BlockRanges, db.chunkPool)
	if err != nil {
		return nil, errors.Wrap(err, "create leveled compactor")
	}

	wlog, err := wal.New(l, r, filepath.Join(dir, "wal"))
	if err != nil {
		return nil, err
	}
	db.head, err = NewHead(r, l, wlog, opts.BlockRanges[0])
	if err != nil {
		return nil, err
	}
	if err := db.reload(); err != nil {
		return nil, err
	}
	if err := db.head.Init(); err != nil {
		return nil, errors.Wrap(err, "read WAL")
	}

	go db.run()

	return db, nil
}

// Dir returns the directory of the database.
func (db *DB) Dir() string {
	return db.dir
}

func (db *DB) run() {
	defer close(db.donec)

	backoff := time.Duration(0)

	for {
		select {
		case <-db.stopc:
			return
		case <-time.After(backoff):
		}

		select {
		case <-time.After(1 * time.Minute):
			select {
			case db.compactc <- struct{}{}:
			default:
			}
		case <-db.compactc:
			db.metrics.compactionsTriggered.Inc()

			err := db.compact()
			if err != nil {
				level.Error(db.logger).Log("msg", "compaction failed", "err", err)
				backoff = exponential(backoff, 1*time.Second, 1*time.Minute)
			} else {
				backoff = 0
			}

		case <-db.stopc:
			return
		}
	}
}

func (db *DB) beyondRetention(meta *BlockMeta) bool {
	if db.opts.RetentionDuration == 0 {
		return false
	}

	db.mtx.RLock()
	blocks := db.blocks[:]
	db.mtx.RUnlock()

	if len(blocks) == 0 {
		return false
	}

	last := blocks[len(db.blocks)-1]
	mint := last.Meta().MaxTime - int64(db.opts.RetentionDuration)

	return meta.MaxTime < mint
}

// Appender opens a new appender against the database.
func (db *DB) Appender() Appender {
	return dbAppender{db: db, Appender: db.head.Appender()}
}

// dbAppender wraps the DB's head appender and triggers compactions on commit
// if necessary.
type dbAppender struct {
	Appender
	db *DB
}

func (a dbAppender) Commit() error {
	err := a.Appender.Commit()

	// We could just run this check every few minutes practically. But for benchmarks
	// and high frequency use cases this is the safer way.
	if a.db.head.MaxTime()-a.db.head.MinTime() > a.db.head.chunkRange/2*3 {
		select {
		case a.db.compactc <- struct{}{}:
		default:
		}
	}
	return err
}

// Compact data if possible. After successful compaction blocks are reloaded
// which will also trigger blocks to be deleted that fall out of the retention
// window.
// If no blocks are compacted, the retention window state doesn't change. Thus,
// this is sufficient to reliably delete old data.
// Old blocks are only deleted on reload based on the new block's parent information.
// See DB.reload documentation for further information.
func (db *DB) compact() (err error) {
	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	if !db.compactionsEnabled {
		return nil
	}

	// Check whether we have pending head blocks that are ready to be persisted.
	// They have the highest priority.
	for {
		select {
		case <-db.stopc:
			return nil
		default:
		}
		// The head has a compactable range if 1.5 level 0 ranges are between the oldest
		// and newest timestamp. The 0.5 acts as a buffer of the appendable window.
		if db.head.MaxTime()-db.head.MinTime() <= db.opts.BlockRanges[0]/2*3 {
			break
		}
		mint, maxt := rangeForTimestamp(db.head.MinTime(), db.opts.BlockRanges[0])

		// Wrap head into a range that bounds all reads to it.
		head := &rangeHead{
			head: db.head,
			mint: mint,
			// We remove 1 millisecond from maxt because block
			// intervals are half-open: [b.MinTime, b.MaxTime). But
			// chunk intervals are closed: [c.MinTime, c.MaxTime];
			// so in order to make sure that overlaps are evaluated
			// consistently, we explicitly remove the last value
			// from the block interval here.
			maxt: maxt - 1,
		}
		if _, err = db.compactor.Write(db.dir, head, mint, maxt, nil); err != nil {
			return errors.Wrap(err, "persist head block")
		}

		runtime.GC()

		if err := db.reload(); err != nil {
			return errors.Wrap(err, "reload blocks")
		}
		runtime.GC()
	}

	// Check for compactions of multiple blocks.
	for {
		plan, err := db.compactor.Plan(db.dir)
		if err != nil {
			return errors.Wrap(err, "plan compaction")
		}
		if len(plan) == 0 {
			break
		}

		select {
		case <-db.stopc:
			return nil
		default:
		}

		if _, err := db.compactor.Compact(db.dir, plan...); err != nil {
			return errors.Wrapf(err, "compact %s", plan)
		}
		runtime.GC()

		if err := db.reload(); err != nil {
			return errors.Wrap(err, "reload blocks")
		}
		runtime.GC()
	}

	return nil
}

func (db *DB) getBlock(id ulid.ULID) (*Block, bool) {
	for _, b := range db.blocks {
		if b.Meta().ULID == id {
			return b, true
		}
	}
	return nil, false
}

// reload on-disk blocks and trigger head truncation if new blocks appeared. It takes
// a list of block directories which should be deleted during reload.
// Blocks that are obsolete due to replacement or retention will be deleted.
func (db *DB) reload() (err error) {
	defer func() {
		if err != nil {
			db.metrics.reloadsFailed.Inc()
		}
		db.metrics.reloads.Inc()
	}()

	dirs, err := blockDirs(db.dir)
	if err != nil {
		return errors.Wrap(err, "find blocks")
	}
	// We delete old blocks that have been superseded by new ones by gathering all parents
	// from existing blocks. Those parents all have newer replacements and can be safely deleted
	// after we loaded the other blocks.
	// This makes us resilient against the process crashing towards the end of a compaction.
	// Creation of a new block and deletion of its parents cannot happen atomically. By creating
	// blocks with their parents, we can pick up the deletion where it left off during a crash.
	var (
		blocks     []*Block
		corrupted  = map[ulid.ULID]error{}
		opened     = map[ulid.ULID]struct{}{}
		deleteable = map[ulid.ULID]struct{}{}
	)
	for _, dir := range dirs {
		meta, err := readMetaFile(dir)
		if err != nil {
			// The block was potentially in the middle of being deleted during a crash.
			// Skip it since we may delete it properly further down again.
			level.Warn(db.logger).Log("msg", "read meta information", "err", err, "dir", dir)

			ulid, err2 := ulid.Parse(filepath.Base(dir))
			if err2 != nil {
				level.Error(db.logger).Log("msg", "not a block dir", "dir", dir)
				continue
			}
			corrupted[ulid] = err
			continue
		}
		if db.beyondRetention(meta) {
			deleteable[meta.ULID] = struct{}{}
			continue
		}
		for _, b := range meta.Compaction.Parents {
			deleteable[b.ULID] = struct{}{}
		}
	}
	// Blocks we failed to open should all be those we are want to delete anyway.
	for c, err := range corrupted {
		if _, ok := deleteable[c]; !ok {
			return errors.Wrapf(err, "unexpected corrupted block %s", c)
		}
	}
	// Load new blocks into memory.
	for _, dir := range dirs {
		meta, err := readMetaFile(dir)
		if err != nil {
			return errors.Wrapf(err, "read meta information %s", dir)
		}
		// Don't load blocks that are scheduled for deletion.
		if _, ok := deleteable[meta.ULID]; ok {
			continue
		}
		// See if we already have the block in memory or open it otherwise.
		b, ok := db.getBlock(meta.ULID)
		if !ok {
			b, err = OpenBlock(dir, db.chunkPool)
			if err != nil {
				return errors.Wrapf(err, "open block %s", dir)
			}
		}
		blocks = append(blocks, b)
		opened[meta.ULID] = struct{}{}
	}
	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].Meta().MinTime < blocks[j].Meta().MinTime
	})
	if err := validateBlockSequence(blocks); err != nil {
		return errors.Wrap(err, "invalid block sequence")
	}

	// Swap in new blocks first for subsequently created readers to be seen.
	// Then close previous blocks, which may block for pending readers to complete.
	db.mtx.Lock()
	oldBlocks := db.blocks
	db.blocks = blocks
	db.mtx.Unlock()

	// Drop old blocks from memory.
	for _, b := range oldBlocks {
		if _, ok := opened[b.Meta().ULID]; ok {
			continue
		}
		if err := b.Close(); err != nil {
			level.Warn(db.logger).Log("msg", "closing block failed", "err", err)
		}
	}
	// Delete all obsolete blocks. None of them are opened any longer.
	for ulid := range deleteable {
		if err := os.RemoveAll(filepath.Join(db.dir, ulid.String())); err != nil {
			return errors.Wrapf(err, "delete obsolete block %s", ulid)
		}
	}

	// Garbage collect data in the head if the most recent persisted block
	// covers data of its current time range.
	if len(blocks) == 0 {
		return nil
	}
	maxt := blocks[len(blocks)-1].Meta().MaxTime

	return errors.Wrap(db.head.Truncate(maxt), "head truncate failed")
}

// validateBlockSequence returns error if given block meta files indicate that some blocks overlaps within sequence.
func validateBlockSequence(bs []*Block) error {
	if len(bs) <= 1 {
		return nil
	}

	var metas []BlockMeta
	for _, b := range bs {
		metas = append(metas, b.meta)
	}

	overlaps := OverlappingBlocks(metas)
	if len(overlaps) > 0 {
		return errors.Errorf("block time ranges overlap: %s", overlaps)
	}

	return nil
}

// TimeRange specifies minTime and maxTime range.
type TimeRange struct {
	Min, Max int64
}

// Overlaps contains overlapping blocks aggregated by overlapping range.
type Overlaps map[TimeRange][]BlockMeta

// String returns human readable string form of overlapped blocks.
func (o Overlaps) String() string {
	var res []string
	for r, overlaps := range o {
		var groups []string
		for _, m := range overlaps {
			groups = append(groups, fmt.Sprintf(
				"<ulid: %s, mint: %d, maxt: %d, range: %s>",
				m.ULID.String(),
				m.MinTime,
				m.MaxTime,
				(time.Duration((m.MaxTime-m.MinTime)/1000)*time.Second).String(),
			))
		}
		res = append(res, fmt.Sprintf(
			"[mint: %d, maxt: %d, range: %s, blocks: %d]: %s",
			r.Min, r.Max,
			(time.Duration((r.Max-r.Min)/1000)*time.Second).String(),
			len(overlaps),
			strings.Join(groups, ", ")),
		)
	}
	return strings.Join(res, "\n")
}

// OverlappingBlocks returns all overlapping blocks from given meta files.
func OverlappingBlocks(bm []BlockMeta) Overlaps {
	if len(bm) <= 1 {
		return nil
	}
	var (
		overlaps [][]BlockMeta

		// pending contains not ended blocks in regards to "current" timestamp.
		pending = []BlockMeta{bm[0]}
		// continuousPending helps to aggregate same overlaps to single group.
		continuousPending = true
	)

	// We have here blocks sorted by minTime. We iterate over each block and treat its minTime as our "current" timestamp.
	// We check if any of the pending block finished (blocks that we have seen before, but their maxTime was still ahead current
	// timestamp). If not, it means they overlap with our current block. In the same time current block is assumed pending.
	for _, b := range bm[1:] {
		var newPending []BlockMeta

		for _, p := range pending {
			// "b.MinTime" is our current time.
			if b.MinTime >= p.MaxTime {
				continuousPending = false
				continue
			}

			// "p" overlaps with "b" and "p" is still pending.
			newPending = append(newPending, p)
		}

		// Our block "b" is now pending.
		pending = append(newPending, b)
		if len(newPending) == 0 {
			// No overlaps.
			continue
		}

		if continuousPending && len(overlaps) > 0 {
			overlaps[len(overlaps)-1] = append(overlaps[len(overlaps)-1], b)
			continue
		}
		overlaps = append(overlaps, append(newPending, b))
		// Start new pendings.
		continuousPending = true
	}

	// Fetch the critical overlapped time range foreach overlap groups.
	overlapGroups := Overlaps{}
	for _, overlap := range overlaps {

		minRange := TimeRange{Min: 0, Max: math.MaxInt64}
		for _, b := range overlap {
			if minRange.Max > b.MaxTime {
				minRange.Max = b.MaxTime
			}

			if minRange.Min < b.MinTime {
				minRange.Min = b.MinTime
			}
		}
		overlapGroups[minRange] = overlap
	}

	return overlapGroups
}

func (db *DB) String() string {
	return "HEAD"
}

// Blocks returns the databases persisted blocks.
func (db *DB) Blocks() []*Block {
	db.mtx.RLock()
	defer db.mtx.RUnlock()

	return db.blocks
}

// Head returns the databases's head.
func (db *DB) Head() *Head {
	return db.head
}

// Close the partition.
func (db *DB) Close() error {
	close(db.stopc)
	<-db.donec

	db.mtx.Lock()
	defer db.mtx.Unlock()

	var g errgroup.Group

	// blocks also contains all head blocks.
	for _, pb := range db.blocks {
		g.Go(pb.Close)
	}

	var merr MultiError

	merr.Add(g.Wait())

	if db.lockf != nil {
		merr.Add(db.lockf.Release())
	}
	merr.Add(db.head.Close())
	return merr.Err()
}

// DisableCompactions disables compactions.
func (db *DB) DisableCompactions() {
	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	db.compactionsEnabled = false
	level.Info(db.logger).Log("msg", "compactions disabled")
}

// EnableCompactions enables compactions.
func (db *DB) EnableCompactions() {
	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	db.compactionsEnabled = true
	level.Info(db.logger).Log("msg", "compactions enabled")
}

// Snapshot writes the current data to the directory. If withHead is set to true it
// will create a new block containing all data that's currently in the memory buffer/WAL.
func (db *DB) Snapshot(dir string, withHead bool) error {
	if dir == db.dir {
		return errors.Errorf("cannot snapshot into base directory")
	}
	if _, err := ulid.Parse(dir); err == nil {
		return errors.Errorf("dir must not be a valid ULID")
	}

	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	db.mtx.RLock()
	defer db.mtx.RUnlock()

	for _, b := range db.blocks {
		level.Info(db.logger).Log("msg", "snapshotting block", "block", b)

		if err := b.Snapshot(dir); err != nil {
			return errors.Wrapf(err, "error snapshotting block: %s", b.Dir())
		}
	}
	if !withHead {
		return nil
	}
	_, err := db.compactor.Write(dir, db.head, db.head.MinTime(), db.head.MaxTime(), nil)
	return errors.Wrap(err, "snapshot head block")
}

// Querier returns a new querier over the data partition for the given time range.
// A goroutine must not handle more than one open Querier.
func (db *DB) Querier(mint, maxt int64) (Querier, error) {
	var blocks []BlockReader

	db.mtx.RLock()
	defer db.mtx.RUnlock()

	for _, b := range db.blocks {
		if b.OverlapsClosedInterval(mint, maxt) {
			blocks = append(blocks, b)
		}
	}
	if maxt >= db.head.MinTime() {
		blocks = append(blocks, db.head)
	}

	sq := &querier{
		blocks: make([]Querier, 0, len(blocks)),
	}
	for _, b := range blocks {
		q, err := NewBlockQuerier(b, mint, maxt)
		if err == nil {
			sq.blocks = append(sq.blocks, q)
			continue
		}
		// If we fail, all previously opened queriers must be closed.
		for _, q := range sq.blocks {
			q.Close()
		}
		return nil, errors.Wrapf(err, "open querier for block %s", b)
	}
	return sq, nil
}

func rangeForTimestamp(t int64, width int64) (mint, maxt int64) {
	mint = (t / width) * width
	return mint, mint + width
}

// Delete implements deletion of metrics. It only has atomicity guarantees on a per-block basis.
func (db *DB) Delete(mint, maxt int64, ms ...labels.Matcher) error {
	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	var g errgroup.Group

	db.mtx.RLock()
	defer db.mtx.RUnlock()

	for _, b := range db.blocks {
		if b.OverlapsClosedInterval(mint, maxt) {
			g.Go(func(b *Block) func() error {
				return func() error { return b.Delete(mint, maxt, ms...) }
			}(b))
		}
	}
	g.Go(func() error {
		return db.head.Delete(mint, maxt, ms...)
	})
	return g.Wait()
}

// CleanTombstones re-writes any blocks with tombstones.
func (db *DB) CleanTombstones() (err error) {
	db.cmtx.Lock()
	defer db.cmtx.Unlock()

	start := time.Now()
	defer db.metrics.tombCleanTimer.Observe(time.Since(start).Seconds())

	newUIDs := []ulid.ULID{}
	defer func() {
		// If any error is caused, we need to delete all the new directory created.
		if err != nil {
			for _, uid := range newUIDs {
				dir := filepath.Join(db.Dir(), uid.String())
				if err := os.RemoveAll(dir); err != nil {
					level.Error(db.logger).Log("msg", "failed to delete block after failed `CleanTombstones`", "dir", dir, "err", err)
				}
			}
		}
	}()

	db.mtx.RLock()
	blocks := db.blocks[:]
	db.mtx.RUnlock()

	for _, b := range blocks {
		if uid, er := b.CleanTombstones(db.Dir(), db.compactor); er != nil {
			err = errors.Wrapf(er, "clean tombstones: %s", b.Dir())
			return err
		} else if uid != nil { // New block was created.
			newUIDs = append(newUIDs, *uid)
		}
	}
	return errors.Wrap(db.reload(), "reload blocks")
}

func isBlockDir(fi os.FileInfo) bool {
	if !fi.IsDir() {
		return false
	}
	_, err := ulid.Parse(fi.Name())
	return err == nil
}

func blockDirs(dir string) ([]string, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var dirs []string

	for _, fi := range files {
		if isBlockDir(fi) {
			dirs = append(dirs, filepath.Join(dir, fi.Name()))
		}
	}
	return dirs, nil
}

func sequenceFiles(dir string) ([]string, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var res []string

	for _, fi := range files {
		if _, err := strconv.ParseUint(fi.Name(), 10, 64); err != nil {
			continue
		}
		res = append(res, filepath.Join(dir, fi.Name()))
	}
	return res, nil
}

func nextSequenceFile(dir string) (string, int, error) {
	names, err := fileutil.ReadDir(dir)
	if err != nil {
		return "", 0, err
	}

	i := uint64(0)
	for _, n := range names {
		j, err := strconv.ParseUint(n, 10, 64)
		if err != nil {
			continue
		}
		i = j
	}
	return filepath.Join(dir, fmt.Sprintf("%0.6d", i+1)), int(i + 1), nil
}

// The MultiError type implements the error interface, and contains the
// Errors used to construct it.
type MultiError []error

// Returns a concatenated string of the contained errors
func (es MultiError) Error() string {
	var buf bytes.Buffer

	if len(es) > 1 {
		fmt.Fprintf(&buf, "%d errors: ", len(es))
	}

	for i, err := range es {
		if i != 0 {
			buf.WriteString("; ")
		}
		buf.WriteString(err.Error())
	}

	return buf.String()
}

// Add adds the error to the error list if it is not nil.
func (es *MultiError) Add(err error) {
	if err == nil {
		return
	}
	if merr, ok := err.(MultiError); ok {
		*es = append(*es, merr...)
	} else {
		*es = append(*es, err)
	}
}

// Err returns the error list as an error or nil if it is empty.
func (es MultiError) Err() error {
	if len(es) == 0 {
		return nil
	}
	return es
}

func closeAll(cs ...io.Closer) error {
	var merr MultiError

	for _, c := range cs {
		merr.Add(c.Close())
	}
	return merr.Err()
}

func exponential(d, min, max time.Duration) time.Duration {
	d *= 2
	if d < min {
		d = min
	}
	if d > max {
		d = max
	}
	return d
}
