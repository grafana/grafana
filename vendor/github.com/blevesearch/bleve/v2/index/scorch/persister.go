//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package scorch

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	bolt "go.etcd.io/bbolt"
)

const persister = "persister"

// DefaultPersisterNapTimeMSec is kept to zero as this helps in direct
// persistence of segments with the default safe batch option.
// If the default safe batch option results in high number of
// files on disk, then users may initialise this configuration parameter
// with higher values so that the persister will nap a bit within it's
// work loop to favour better in-memory merging of segments to result
// in fewer segment files on disk. But that may come with an indexing
// performance overhead.
// Unsafe batch users are advised to override this to higher value
// for better performance especially with high data density.
var DefaultPersisterNapTimeMSec int = 0 // ms

// DefaultPersisterNapUnderNumFiles helps in controlling the pace of
// persister. At times of a slow merger progress with heavy file merging
// operations, its better to pace down the persister for letting the merger
// to catch up within a range defined by this parameter.
// Fewer files on disk (as per the merge plan) would result in keeping the
// file handle usage under limit, faster disk merger and a healthier index.
// Its been observed that such a loosely sync'ed introducer-persister-merger
// trio results in better overall performance.
var DefaultPersisterNapUnderNumFiles int = 1000

var DefaultMemoryPressurePauseThreshold uint64 = math.MaxUint64

type persisterOptions struct {
	// PersisterNapTimeMSec controls the wait/delay injected into
	// persistence workloop to improve the chances for
	// a healthier and heavier in-memory merging
	PersisterNapTimeMSec int

	// PersisterNapTimeMSec > 0, and the number of files is less than
	// PersisterNapUnderNumFiles, then the persister will sleep
	// PersisterNapTimeMSec amount of time to improve the chances for
	// a healthier and heavier in-memory merging
	PersisterNapUnderNumFiles int

	// MemoryPressurePauseThreshold let persister to have a better leeway
	// for prudently performing the memory merge of segments on a memory
	// pressure situation. Here the config value is an upper threshold
	// for the number of paused application threads. The default value would
	// be a very high number to always favour the merging of memory segments.
	MemoryPressurePauseThreshold uint64

	// NumPersisterWorkers decides the number of parallel workers that will
	// perform the in-memory merge of segments followed by a flush operation.
	NumPersisterWorkers int

	// MaxSizeInMemoryMerge is the maximum size of data that a single persister
	// worker is allowed to work on
	MaxSizeInMemoryMergePerWorker int
}

type notificationChan chan struct{}

func (s *Scorch) persisterLoop() {
	defer func() {
		if r := recover(); r != nil {
			s.fireAsyncError(NewScorchError(
				persister,
				fmt.Sprintf("panic: %v, path: %s", r, s.path),
				ErrAsyncPanic,
			))
		}

		s.asyncTasks.Done()
	}()

	var persistWatchers []*epochWatcher
	var lastPersistedEpoch, lastMergedEpoch uint64
	var ew *epochWatcher

	var unpersistedCallbacks []index.BatchCallback

	po, err := s.parsePersisterOptions()
	if err != nil {
		s.fireAsyncError(NewScorchError(
			persister,
			fmt.Sprintf("persisterOptions json parsing err: %v", err),
			ErrOptionsParse,
		))
		return
	}

OUTER:
	for {
		atomic.AddUint64(&s.stats.TotPersistLoopBeg, 1)

		select {
		case <-s.closeCh:
			break OUTER
		case ew = <-s.persisterNotifier:
			persistWatchers = append(persistWatchers, ew)
		default:
		}
		if ew != nil && ew.epoch > lastMergedEpoch {
			lastMergedEpoch = ew.epoch
		}
		lastMergedEpoch, persistWatchers = s.pausePersisterForMergerCatchUp(lastPersistedEpoch,
			lastMergedEpoch, persistWatchers, po)

		var ourSnapshot *IndexSnapshot
		var ourPersisted []chan error
		var ourPersistedCallbacks []index.BatchCallback

		// check to see if there is a new snapshot to persist
		s.rootLock.Lock()
		if s.root != nil && s.root.epoch > lastPersistedEpoch {
			ourSnapshot = s.root
			ourSnapshot.AddRef()
			ourPersisted = s.rootPersisted
			s.rootPersisted = nil
			ourPersistedCallbacks = s.persistedCallbacks
			s.persistedCallbacks = nil
			atomic.StoreUint64(&s.iStats.persistSnapshotSize, uint64(ourSnapshot.Size()))
			atomic.StoreUint64(&s.iStats.persistEpoch, ourSnapshot.epoch)
		}
		s.rootLock.Unlock()

		if ourSnapshot != nil {
			startTime := time.Now()

			err := s.persistSnapshot(ourSnapshot, po)
			for _, ch := range ourPersisted {
				if err != nil {
					ch <- err
				}
				close(ch)
			}
			if err != nil {
				atomic.StoreUint64(&s.iStats.persistEpoch, 0)
				if err == segment.ErrClosed {
					// index has been closed
					_ = ourSnapshot.DecRef()
					break OUTER
				}

				// save this current snapshot's persistedCallbacks, to invoke during
				// the retry attempt
				unpersistedCallbacks = append(unpersistedCallbacks, ourPersistedCallbacks...)

				s.fireAsyncError(NewScorchError(
					persister,
					fmt.Sprintf("got err persisting snapshot: %v", err),
					ErrPersist,
				))
				_ = ourSnapshot.DecRef()
				atomic.AddUint64(&s.stats.TotPersistLoopErr, 1)
				continue OUTER
			}

			if unpersistedCallbacks != nil {
				// in the event of this being a retry attempt for persisting a snapshot
				// that had earlier failed, prepend the persistedCallbacks associated
				// with earlier segment(s) to the latest persistedCallbacks
				ourPersistedCallbacks = append(unpersistedCallbacks, ourPersistedCallbacks...)
				unpersistedCallbacks = nil
			}

			for i := range ourPersistedCallbacks {
				ourPersistedCallbacks[i](err)
			}

			atomic.StoreUint64(&s.stats.LastPersistedEpoch, ourSnapshot.epoch)

			lastPersistedEpoch = ourSnapshot.epoch
			for _, ew := range persistWatchers {
				close(ew.notifyCh)
			}

			persistWatchers = nil
			_ = ourSnapshot.DecRef()

			changed := false
			s.rootLock.RLock()
			if s.root != nil && s.root.epoch != lastPersistedEpoch {
				changed = true
			}
			s.rootLock.RUnlock()

			s.fireEvent(EventKindPersisterProgress, time.Since(startTime))

			if changed {
				atomic.AddUint64(&s.stats.TotPersistLoopProgress, 1)
				continue OUTER
			}
		}

		// tell the introducer we're waiting for changes
		w := &epochWatcher{
			epoch:    lastPersistedEpoch,
			notifyCh: make(notificationChan, 1),
		}

		select {
		case <-s.closeCh:
			break OUTER
		case s.introducerNotifier <- w:
		}

		if ok := s.fireEvent(EventKindPurgerCheck, 0); ok {
			s.removeOldData() // might as well cleanup while waiting
		}

		atomic.AddUint64(&s.stats.TotPersistLoopWait, 1)

		select {
		case <-s.closeCh:
			break OUTER
		case <-w.notifyCh:
			// woken up, next loop should pick up work
			atomic.AddUint64(&s.stats.TotPersistLoopWaitNotified, 1)
		case ew = <-s.persisterNotifier:
			// if the watchers are already caught up then let them wait,
			// else let them continue to do the catch up
			persistWatchers = append(persistWatchers, ew)
		}

		atomic.AddUint64(&s.stats.TotPersistLoopEnd, 1)
	}
}

func notifyMergeWatchers(lastPersistedEpoch uint64,
	persistWatchers []*epochWatcher,
) []*epochWatcher {
	var watchersNext []*epochWatcher
	for _, w := range persistWatchers {
		if w.epoch < lastPersistedEpoch {
			close(w.notifyCh)
		} else {
			watchersNext = append(watchersNext, w)
		}
	}
	return watchersNext
}

func (s *Scorch) pausePersisterForMergerCatchUp(lastPersistedEpoch uint64,
	lastMergedEpoch uint64, persistWatchers []*epochWatcher,
	po *persisterOptions,
) (uint64, []*epochWatcher) {
	// First, let the watchers proceed if they lag behind
	persistWatchers = notifyMergeWatchers(lastPersistedEpoch, persistWatchers)

	// Check the merger lag by counting the segment files on disk,
	numFilesOnDisk, _, _ := s.diskFileStats(nil)

	// On finding fewer files on disk, persister takes a short pause
	// for sufficient in-memory segments to pile up for the next
	// memory merge cum persist loop.
	if numFilesOnDisk < uint64(po.PersisterNapUnderNumFiles) &&
		po.PersisterNapTimeMSec > 0 && s.NumEventsBlocking() == 0 {
		select {
		case <-s.closeCh:
		case <-time.After(time.Millisecond * time.Duration(po.PersisterNapTimeMSec)):
			atomic.AddUint64(&s.stats.TotPersisterNapPauseCompleted, 1)

		case ew := <-s.persisterNotifier:
			// unblock the merger in meantime
			persistWatchers = append(persistWatchers, ew)
			lastMergedEpoch = ew.epoch
			persistWatchers = notifyMergeWatchers(lastPersistedEpoch, persistWatchers)
			atomic.AddUint64(&s.stats.TotPersisterMergerNapBreak, 1)
		}
		return lastMergedEpoch, persistWatchers
	}

	// Finding too many files on disk could be due to two reasons.
	// 1. Too many older snapshots awaiting the clean up.
	// 2. The merger could be lagging behind on merging the disk files.
	if numFilesOnDisk > uint64(po.PersisterNapUnderNumFiles) {
		if ok := s.fireEvent(EventKindPurgerCheck, 0); ok {
			s.removeOldData()
		}
		numFilesOnDisk, _, _ = s.diskFileStats(nil)
	}

	// Persister pause until the merger catches up to reduce the segment
	// file count under the threshold.
	// But if there is memory pressure, then skip this sleep maneuvers.
OUTER:
	for po.PersisterNapUnderNumFiles > 0 &&
		numFilesOnDisk >= uint64(po.PersisterNapUnderNumFiles) &&
		lastMergedEpoch < lastPersistedEpoch {
		atomic.AddUint64(&s.stats.TotPersisterSlowMergerPause, 1)

		select {
		case <-s.closeCh:
			break OUTER
		case ew := <-s.persisterNotifier:
			persistWatchers = append(persistWatchers, ew)
			lastMergedEpoch = ew.epoch
		}

		atomic.AddUint64(&s.stats.TotPersisterSlowMergerResume, 1)

		// let the watchers proceed if they lag behind
		persistWatchers = notifyMergeWatchers(lastPersistedEpoch, persistWatchers)

		numFilesOnDisk, _, _ = s.diskFileStats(nil)
	}

	return lastMergedEpoch, persistWatchers
}

func (s *Scorch) parsePersisterOptions() (*persisterOptions, error) {
	po := persisterOptions{
		PersisterNapTimeMSec:          DefaultPersisterNapTimeMSec,
		PersisterNapUnderNumFiles:     DefaultPersisterNapUnderNumFiles,
		MemoryPressurePauseThreshold:  DefaultMemoryPressurePauseThreshold,
		NumPersisterWorkers:           DefaultNumPersisterWorkers,
		MaxSizeInMemoryMergePerWorker: DefaultMaxSizeInMemoryMergePerWorker,
	}
	if v, ok := s.config["scorchPersisterOptions"]; ok {
		b, err := util.MarshalJSON(v)
		if err != nil {
			return &po, err
		}

		err = util.UnmarshalJSON(b, &po)
		if err != nil {
			return &po, err
		}
	}
	return &po, nil
}

func (s *Scorch) persistSnapshot(snapshot *IndexSnapshot,
	po *persisterOptions,
) error {
	// Perform in-memory segment merging only when the memory pressure is
	// below the configured threshold, else the persister performs the
	// direct persistence of segments.
	if s.NumEventsBlocking() < po.MemoryPressurePauseThreshold {
		persisted, err := s.persistSnapshotMaybeMerge(snapshot, po)
		if err != nil {
			return err
		}
		if persisted {
			return nil
		}
	}

	return s.persistSnapshotDirect(snapshot, nil)
}

// DefaultMinSegmentsForInMemoryMerge represents the default number of
// in-memory zap segments that persistSnapshotMaybeMerge() needs to
// see in an IndexSnapshot before it decides to merge and persist
// those segments
var DefaultMinSegmentsForInMemoryMerge = 2

type flushable struct {
	segments []segment.Segment
	drops    []*roaring.Bitmap
	sbIdxs   []int
	totDocs  uint64
}

// number workers which parallelly perform an in-memory merge of the segments
// followed by a flush operation.
var DefaultNumPersisterWorkers = 1

// maximum size of data that a single worker is allowed to perform the in-memory
// merge operation.
var DefaultMaxSizeInMemoryMergePerWorker = 0

func legacyFlushBehaviour(maxSizeInMemoryMergePerWorker, numPersisterWorkers int) bool {
	// DefaultMaxSizeInMemoryMergePerWorker = 0 is a special value to preserve the legacy
	// one-shot in-memory merge + flush behaviour.
	return maxSizeInMemoryMergePerWorker == 0 && numPersisterWorkers == 1
}

// persistSnapshotMaybeMerge examines the snapshot and might merge and
// persist the in-memory zap segments if there are enough of them
func (s *Scorch) persistSnapshotMaybeMerge(snapshot *IndexSnapshot, po *persisterOptions) (
	bool, error) {
	// collect the in-memory zap segments (SegmentBase instances)
	var sbs []segment.Segment
	var sbsDrops []*roaring.Bitmap
	var sbsIndexes []int
	var oldSegIdxs []int

	flushSet := make([]*flushable, 0)
	var totSize int
	var numSegsToFlushOut int
	var totDocs uint64

	// legacy behaviour of merge + flush of all in-memory segments in one-shot
	if legacyFlushBehaviour(po.MaxSizeInMemoryMergePerWorker, po.NumPersisterWorkers) {
		val := &flushable{
			segments: make([]segment.Segment, 0),
			drops:    make([]*roaring.Bitmap, 0),
			sbIdxs:   make([]int, 0),
			totDocs:  totDocs,
		}
		for i, snapshot := range snapshot.segment {
			if _, ok := snapshot.segment.(segment.PersistedSegment); !ok {
				val.segments = append(val.segments, snapshot.segment)
				val.drops = append(val.drops, snapshot.deleted)
				val.sbIdxs = append(val.sbIdxs, i)
				oldSegIdxs = append(oldSegIdxs, i)
				val.totDocs += snapshot.segment.Count()
				numSegsToFlushOut++
			}
		}

		flushSet = append(flushSet, val)
	} else {
		// constructs a flushSet where each flushable object contains a set of segments
		// to be merged and flushed out to disk.
		for i, snapshot := range snapshot.segment {
			if totSize >= po.MaxSizeInMemoryMergePerWorker &&
				len(sbs) >= DefaultMinSegmentsForInMemoryMerge {
				numSegsToFlushOut += len(sbs)
				val := &flushable{
					segments: slices.Clone(sbs),
					drops:    slices.Clone(sbsDrops),
					sbIdxs:   slices.Clone(sbsIndexes),
					totDocs:  totDocs,
				}
				flushSet = append(flushSet, val)
				oldSegIdxs = append(oldSegIdxs, sbsIndexes...)

				sbs, sbsDrops, sbsIndexes = sbs[:0], sbsDrops[:0], sbsIndexes[:0]
				totSize, totDocs = 0, 0
			}

			if len(flushSet) >= int(po.NumPersisterWorkers) {
				break
			}

			if _, ok := snapshot.segment.(segment.PersistedSegment); !ok {
				sbs = append(sbs, snapshot.segment)
				sbsDrops = append(sbsDrops, snapshot.deleted)
				sbsIndexes = append(sbsIndexes, i)
				totDocs += snapshot.segment.Count()
				totSize += snapshot.segment.Size()
			}
		}
		// if there were too few segments just merge them all as part of a single worker
		if len(flushSet) < po.NumPersisterWorkers {
			numSegsToFlushOut += len(sbs)
			val := &flushable{
				segments: slices.Clone(sbs),
				drops:    slices.Clone(sbsDrops),
				sbIdxs:   slices.Clone(sbsIndexes),
				totDocs:  totDocs,
			}
			flushSet = append(flushSet, val)
			oldSegIdxs = append(oldSegIdxs, sbsIndexes...)
		}
	}

	if numSegsToFlushOut < DefaultMinSegmentsForInMemoryMerge {
		return false, nil
	}

	// the newSnapshot at this point would contain the newly created file segments
	// and updated with the root.
	newSnapshot, newSegmentIDs, err := s.mergeAndPersistInMemorySegments(snapshot, flushSet)
	if err != nil {
		return false, err
	}

	if newSnapshot == nil {
		return false, nil
	}

	defer func() {
		_ = newSnapshot.DecRef()
	}()

	mergedSegmentIDs := map[uint64]struct{}{}
	for _, idx := range oldSegIdxs {
		mergedSegmentIDs[snapshot.segment[idx].id] = struct{}{}
	}

	newMergedSegmentIDs := make(map[uint64]struct{}, len(newSegmentIDs))
	for _, id := range newSegmentIDs {
		newMergedSegmentIDs[id] = struct{}{}
	}

	// construct a snapshot that's logically equivalent to the input
	// snapshot, but with merged segments replaced by the new segment
	equiv := &IndexSnapshot{
		parent:   snapshot.parent,
		segment:  make([]*SegmentSnapshot, 0, len(snapshot.segment)),
		internal: snapshot.internal,
		epoch:    snapshot.epoch,
		creator:  "persistSnapshotMaybeMerge",
	}

	// to track which segments haven't participated in the in-memory merge
	// they won't be flushed out to the disk yet, but in the next cycle will be
	// merged in-memory and then flushed out - this is to keep the number of
	// on-disk files in limit.
	exclude := make(map[uint64]struct{})

	// copy to the equiv the segments that weren't replaced
	for _, segment := range snapshot.segment {
		if _, wasMerged := mergedSegmentIDs[segment.id]; !wasMerged {
			equiv.segment = append(equiv.segment, segment)
			exclude[segment.id] = struct{}{}
		}
	}

	// append to the equiv the newly merged segments
	for _, segment := range newSnapshot.segment {
		if _, ok := newMergedSegmentIDs[segment.id]; ok {
			equiv.segment = append(equiv.segment, &SegmentSnapshot{
				id:      segment.id,
				segment: segment.segment,
				deleted: nil, // nil since merging handled deletions
				stats:   nil,
			})
		}
	}

	err = s.persistSnapshotDirect(equiv, exclude)
	if err != nil {
		return false, err
	}

	return true, nil
}

func copyToDirectory(srcPath string, d index.Directory) (int64, error) {
	if d == nil {
		return 0, nil
	}

	dest, err := d.GetWriter(filepath.Join("store", filepath.Base(srcPath)))
	if err != nil {
		return 0, fmt.Errorf("GetWriter err: %v", err)
	}

	sourceFileStat, err := os.Stat(srcPath)
	if err != nil {
		return 0, err
	}

	if !sourceFileStat.Mode().IsRegular() {
		return 0, fmt.Errorf("%s is not a regular file", srcPath)
	}

	source, err := os.Open(srcPath)
	if err != nil {
		return 0, err
	}
	defer source.Close()
	defer dest.Close()
	return io.Copy(dest, source)
}

func persistToDirectory(seg segment.UnpersistedSegment, d index.Directory,
	path string,
) error {
	if d == nil {
		return seg.Persist(path)
	}

	sg, ok := seg.(io.WriterTo)
	if !ok {
		return fmt.Errorf("no io.WriterTo segment implementation found")
	}

	w, err := d.GetWriter(filepath.Join("store", filepath.Base(path)))
	if err != nil {
		return err
	}

	_, err = sg.WriteTo(w)
	w.Close()

	return err
}

func prepareBoltSnapshot(snapshot *IndexSnapshot, tx *bolt.Tx, path string,
	segPlugin SegmentPlugin, exclude map[uint64]struct{}, d index.Directory) (
	[]string, map[uint64]string, error) {
	snapshotsBucket, err := tx.CreateBucketIfNotExists(util.BoltSnapshotsBucket)
	if err != nil {
		return nil, nil, err
	}
	newSnapshotKey := encodeUvarintAscending(nil, snapshot.epoch)
	snapshotBucket, err := snapshotsBucket.CreateBucketIfNotExists(newSnapshotKey)
	if err != nil {
		return nil, nil, err
	}

	// persist meta values
	metaBucket, err := snapshotBucket.CreateBucketIfNotExists(util.BoltMetaDataKey)
	if err != nil {
		return nil, nil, err
	}
	err = metaBucket.Put(util.BoltMetaDataSegmentTypeKey, []byte(segPlugin.Type()))
	if err != nil {
		return nil, nil, err
	}
	buf := make([]byte, binary.MaxVarintLen32)
	binary.BigEndian.PutUint32(buf, segPlugin.Version())
	err = metaBucket.Put(util.BoltMetaDataSegmentVersionKey, buf)
	if err != nil {
		return nil, nil, err
	}

	// Storing the timestamp at which the current indexSnapshot
	// was persisted, useful when you want to spread the
	// numSnapshotsToKeep reasonably better than consecutive
	// epochs.
	currTimeStamp := time.Now()
	timeStampBinary, err := currTimeStamp.MarshalText()
	if err != nil {
		return nil, nil, err
	}
	err = metaBucket.Put(util.BoltMetaDataTimeStamp, timeStampBinary)
	if err != nil {
		return nil, nil, err
	}

	// persist internal values
	internalBucket, err := snapshotBucket.CreateBucketIfNotExists(util.BoltInternalKey)
	if err != nil {
		return nil, nil, err
	}
	// TODO optimize writing these in order?
	for k, v := range snapshot.internal {
		err = internalBucket.Put([]byte(k), v)
		if err != nil {
			return nil, nil, err
		}
	}

	if snapshot.parent != nil {
		val := make([]byte, 8)
		bytesWritten := atomic.LoadUint64(&snapshot.parent.stats.TotBytesWrittenAtIndexTime)
		binary.LittleEndian.PutUint64(val, bytesWritten)
		err = internalBucket.Put(util.TotBytesWrittenKey, val)
		if err != nil {
			return nil, nil, err
		}
	}

	filenames := make([]string, 0, len(snapshot.segment))
	newSegmentPaths := make(map[uint64]string, len(snapshot.segment))

	// first ensure that each segment in this snapshot has been persisted
	for _, segmentSnapshot := range snapshot.segment {
		snapshotSegmentKey := encodeUvarintAscending(nil, segmentSnapshot.id)
		snapshotSegmentBucket, err := snapshotBucket.CreateBucketIfNotExists(snapshotSegmentKey)
		if err != nil {
			return nil, nil, err
		}
		switch seg := segmentSnapshot.segment.(type) {
		case segment.PersistedSegment:
			segPath := seg.Path()
			_, err = copyToDirectory(segPath, d)
			if err != nil {
				return nil, nil, fmt.Errorf("segment: %s copy err: %v", segPath, err)
			}
			filename := filepath.Base(segPath)
			err = snapshotSegmentBucket.Put(util.BoltPathKey, []byte(filename))
			if err != nil {
				return nil, nil, err
			}
			filenames = append(filenames, filename)
		case segment.UnpersistedSegment:
			// need to persist this to disk if its not part of exclude list (which
			// restricts which in-memory segment to be persisted to disk)
			if _, ok := exclude[segmentSnapshot.id]; !ok {
				filename := zapFileName(segmentSnapshot.id)
				path := filepath.Join(path, filename)
				err := persistToDirectory(seg, d, path)
				if err != nil {
					return nil, nil, fmt.Errorf("segment: %s persist err: %v", path, err)
				}
				newSegmentPaths[segmentSnapshot.id] = path
				err = snapshotSegmentBucket.Put(util.BoltPathKey, []byte(filename))
				if err != nil {
					return nil, nil, err
				}
				filenames = append(filenames, filename)
			}
		default:
			return nil, nil, fmt.Errorf("unknown segment type: %T", seg)
		}
		// store current deleted bits
		var roaringBuf bytes.Buffer
		if segmentSnapshot.deleted != nil {
			_, err = segmentSnapshot.deleted.WriteTo(&roaringBuf)
			if err != nil {
				return nil, nil, fmt.Errorf("error persisting roaring bytes: %v", err)
			}
			err = snapshotSegmentBucket.Put(util.BoltDeletedKey, roaringBuf.Bytes())
			if err != nil {
				return nil, nil, err
			}
		}

		// store segment stats
		if segmentSnapshot.stats != nil {
			b, err := json.Marshal(segmentSnapshot.stats.Fetch())
			if err != nil {
				return nil, nil, err
			}
			err = snapshotSegmentBucket.Put(util.BoltStatsKey, b)
			if err != nil {
				return nil, nil, err
			}
		}

		// store updated field info
		if segmentSnapshot.updatedFields != nil {
			b, err := json.Marshal(segmentSnapshot.updatedFields)
			if err != nil {
				return nil, nil, err
			}
			err = snapshotSegmentBucket.Put(util.BoltUpdatedFieldsKey, b)
			if err != nil {
				return nil, nil, err
			}
		}
	}

	return filenames, newSegmentPaths, nil
}

func (s *Scorch) persistSnapshotDirect(snapshot *IndexSnapshot, exclude map[uint64]struct{}) (err error) {
	// start a write transaction
	tx, err := s.rootBolt.Begin(true)
	if err != nil {
		return err
	}
	// defer rollback on error
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	filenames, newSegmentPaths, err := prepareBoltSnapshot(snapshot, tx, s.path, s.segPlugin, exclude, nil)
	if err != nil {
		return err
	}

	// we need to swap in a new root only when we've persisted 1 or
	// more segments -- whereby the new root would have 1-for-1
	// replacements of in-memory segments with file-based segments
	//
	// other cases like updates to internal values only, and/or when
	// there are only deletions, are already covered and persisted by
	// the newly populated boltdb snapshotBucket above
	if len(newSegmentPaths) > 0 {
		// now try to open all the new snapshots
		newSegments := make(map[uint64]segment.Segment, len(newSegmentPaths))
		defer func() {
			for _, s := range newSegments {
				if s != nil {
					// cleanup segments that were opened but not
					// swapped into the new root
					_ = s.Close()
				}
			}
		}()
		for segmentID, path := range newSegmentPaths {
			newSegments[segmentID], err = s.segPlugin.Open(path)
			if err != nil {
				return fmt.Errorf("error opening new segment at %s, %v", path, err)
			}
		}

		persist := &persistIntroduction{
			persisted: newSegments,
			applied:   make(notificationChan),
		}

		select {
		case <-s.closeCh:
			return segment.ErrClosed
		case s.persists <- persist:
		}

		select {
		case <-s.closeCh:
			return segment.ErrClosed
		case <-persist.applied:
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	err = s.rootBolt.Sync()
	if err != nil {
		return err
	}

	// allow files to become eligible for removal after commit, such
	// as file segments from snapshots that came from the merger
	s.rootLock.Lock()
	for _, filename := range filenames {
		delete(s.ineligibleForRemoval, filename)
	}
	s.rootLock.Unlock()

	return nil
}

func zapFileName(epoch uint64) string {
	return fmt.Sprintf("%012x.zap", epoch)
}

// bolt snapshot code

func (s *Scorch) loadFromBolt() error {
	err := s.rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		foundRoot := false
		c := snapshots.Cursor()
		for k, _ := c.Last(); k != nil; k, _ = c.Prev() {
			_, snapshotEpoch, err := decodeUvarintAscending(k)
			if err != nil {
				log.Printf("unable to parse segment epoch %x, continuing", k)
				continue
			}
			if foundRoot {
				s.AddEligibleForRemoval(snapshotEpoch)
				continue
			}
			snapshot := snapshots.Bucket(k)
			if snapshot == nil {
				log.Printf("snapshot key, but bucket missing %x, continuing", k)
				s.AddEligibleForRemoval(snapshotEpoch)
				continue
			}
			indexSnapshot, err := s.loadSnapshot(snapshot)
			if err != nil {
				log.Printf("unable to load snapshot, %v, continuing", err)
				s.AddEligibleForRemoval(snapshotEpoch)
				continue
			}
			indexSnapshot.epoch = snapshotEpoch
			// set the nextSegmentID
			s.nextSegmentID, err = s.maxSegmentIDOnDisk()
			if err != nil {
				return err
			}
			s.nextSegmentID++
			s.rootLock.Lock()
			s.nextSnapshotEpoch = snapshotEpoch + 1
			rootPrev := s.root
			s.root = indexSnapshot
			s.rootLock.Unlock()

			if rootPrev != nil {
				_ = rootPrev.DecRef()
			}

			foundRoot = true
		}
		return nil
	})
	if err != nil {
		return err
	}

	persistedSnapshots, err := s.rootBoltSnapshotMetaData()
	if err != nil {
		return err
	}
	s.checkPoints = persistedSnapshots
	return nil
}

// LoadSnapshot loads the segment with the specified epoch
// NOTE: this is currently ONLY intended to be used by the command-line tool
func (s *Scorch) LoadSnapshot(epoch uint64) (rv *IndexSnapshot, err error) {
	err = s.rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		snapshotKey := encodeUvarintAscending(nil, epoch)
		snapshot := snapshots.Bucket(snapshotKey)
		if snapshot == nil {
			return fmt.Errorf("snapshot with epoch: %v - doesn't exist", epoch)
		}
		rv, err = s.loadSnapshot(snapshot)
		return err
	})
	if err != nil {
		return nil, err
	}
	return rv, nil
}

func (s *Scorch) loadSnapshot(snapshot *bolt.Bucket) (*IndexSnapshot, error) {
	rv := &IndexSnapshot{
		parent:   s,
		internal: make(map[string][]byte),
		refs:     1,
		creator:  "loadSnapshot",
	}
	// first we look for the meta-data bucket, this will tell us
	// which segment type/version was used for this snapshot
	// all operations for this scorch will use this type/version
	metaBucket := snapshot.Bucket(util.BoltMetaDataKey)
	if metaBucket == nil {
		_ = rv.DecRef()
		return nil, fmt.Errorf("meta-data bucket missing")
	}
	segmentType := string(metaBucket.Get(util.BoltMetaDataSegmentTypeKey))
	segmentVersion := binary.BigEndian.Uint32(
		metaBucket.Get(util.BoltMetaDataSegmentVersionKey))
	err := s.loadSegmentPlugin(segmentType, segmentVersion)
	if err != nil {
		_ = rv.DecRef()
		return nil, fmt.Errorf(
			"unable to load correct segment wrapper: %v", err)
	}
	var running uint64
	c := snapshot.Cursor()
	for k, _ := c.First(); k != nil; k, _ = c.Next() {
		if k[0] == util.BoltInternalKey[0] {
			internalBucket := snapshot.Bucket(k)
			if internalBucket == nil {
				_ = rv.DecRef()
				return nil, fmt.Errorf("internal bucket missing")
			}
			err := internalBucket.ForEach(func(key []byte, val []byte) error {
				copiedVal := append([]byte(nil), val...)
				rv.internal[string(key)] = copiedVal
				return nil
			})
			if err != nil {
				_ = rv.DecRef()
				return nil, err
			}
		} else if k[0] != util.BoltMetaDataKey[0] {
			segmentBucket := snapshot.Bucket(k)
			if segmentBucket == nil {
				_ = rv.DecRef()
				return nil, fmt.Errorf("segment key, but bucket missing %x", k)
			}
			segmentSnapshot, err := s.loadSegment(segmentBucket)
			if err != nil {
				_ = rv.DecRef()
				return nil, fmt.Errorf("failed to load segment: %v", err)
			}
			_, segmentSnapshot.id, err = decodeUvarintAscending(k)
			if err != nil {
				_ = rv.DecRef()
				return nil, fmt.Errorf("failed to decode segment id: %v", err)
			}
			rv.segment = append(rv.segment, segmentSnapshot)
			rv.offsets = append(rv.offsets, running)
			// Merge all segment level updated field info for use during queries
			if segmentSnapshot.updatedFields != nil {
				rv.MergeUpdateFieldsInfo(segmentSnapshot.updatedFields)
			}
			running += segmentSnapshot.segment.Count()
		}
	}
	return rv, nil
}

func (s *Scorch) loadSegment(segmentBucket *bolt.Bucket) (*SegmentSnapshot, error) {
	pathBytes := segmentBucket.Get(util.BoltPathKey)
	if pathBytes == nil {
		return nil, fmt.Errorf("segment path missing")
	}
	segmentPath := s.path + string(os.PathSeparator) + string(pathBytes)
	seg, err := s.segPlugin.Open(segmentPath)
	if err != nil {
		return nil, fmt.Errorf("error opening bolt segment: %v", err)
	}

	rv := &SegmentSnapshot{
		segment:    seg,
		cachedDocs: &cachedDocs{cache: nil},
		cachedMeta: &cachedMeta{meta: nil},
	}
	deletedBytes := segmentBucket.Get(util.BoltDeletedKey)
	if deletedBytes != nil {
		deletedBitmap := roaring.NewBitmap()
		r := bytes.NewReader(deletedBytes)
		_, err := deletedBitmap.ReadFrom(r)
		if err != nil {
			_ = seg.Close()
			return nil, fmt.Errorf("error reading deleted bytes: %v", err)
		}
		if !deletedBitmap.IsEmpty() {
			rv.deleted = deletedBitmap
		}
	}
	statBytes := segmentBucket.Get(util.BoltStatsKey)
	if statBytes != nil {
		var statsMap map[string]map[string]uint64

		err := json.Unmarshal(statBytes, &statsMap)
		stats := &fieldStats{statMap: statsMap}
		if err != nil {
			_ = seg.Close()
			return nil, fmt.Errorf("error reading stat bytes: %v", err)
		}
		rv.stats = stats
	}
	updatedFieldBytes := segmentBucket.Get(util.BoltUpdatedFieldsKey)
	if updatedFieldBytes != nil {
		var updatedFields map[string]*index.UpdateFieldInfo

		err := json.Unmarshal(updatedFieldBytes, &updatedFields)
		if err != nil {
			_ = seg.Close()
			return nil, fmt.Errorf("error reading updated field bytes: %v", err)
		}
		rv.updatedFields = updatedFields
		// Set the value within the segment base for use during merge
		rv.UpdateFieldsInfo(rv.updatedFields)
	}

	return rv, nil
}

func (s *Scorch) removeOldData() {
	removed, err := s.removeOldBoltSnapshots()
	if err != nil {
		s.fireAsyncError(NewScorchError(
			persister,
			fmt.Sprintf("got err removing old bolt snapshots: %v", err),
			ErrCleanup,
		))
	}
	atomic.AddUint64(&s.stats.TotSnapshotsRemovedFromMetaStore, uint64(removed))

	err = s.removeOldZapFiles()
	if err != nil {
		s.fireAsyncError(NewScorchError(
			persister,
			fmt.Sprintf("got err removing old zap files: %v", err),
			ErrCleanup,
		))
	}
}

// NumSnapshotsToKeep represents how many recent, old snapshots to
// keep around per Scorch instance.  Useful for apps that require
// rollback'ability.
var NumSnapshotsToKeep = 1

// RollbackSamplingInterval controls how far back we are looking
// in the history to get the rollback points.
// For example, a value of 10 minutes ensures that the
// protected snapshots (NumSnapshotsToKeep = 3) are:
//
//	the very latest snapshot(ie the current one),
//	the snapshot that was persisted 10 minutes before the current one,
//	the snapshot that was persisted 20 minutes before the current one
//
// By default however, the timeseries way of protecting snapshots is
// disabled, and we protect the latest three contiguous snapshots
var RollbackSamplingInterval = 0 * time.Minute

// Controls what portion of the earlier rollback points to retain during
// a infrequent/sparse mutation scenario
var RollbackRetentionFactor = float64(0.5)

func getTimeSeriesSnapshots(maxDataPoints int, interval time.Duration,
	snapshots []*snapshotMetaData,
) (int, map[uint64]time.Time) {
	if interval == 0 {
		return len(snapshots), map[uint64]time.Time{}
	}
	// the map containing the time series snapshots, i.e the timeseries of snapshots
	// each of which is separated by rollbackSamplingInterval
	rv := make(map[uint64]time.Time)
	// the last point in the "time series", i.e. the timeseries of snapshots
	// each of which is separated by rollbackSamplingInterval
	ptr := len(snapshots) - 1
	rv[snapshots[ptr].epoch] = snapshots[ptr].timeStamp
	numSnapshotsProtected := 1

	// traverse the list in reverse order, older timestamps to newer ones.
	for i := ptr - 1; i >= 0; i-- {
		// If we find a timeStamp which is the next datapoint in our
		// timeseries of snapshots, and newer by RollbackSamplingInterval duration
		// (comparison in terms of minutes), which is the interval of our time
		// series. In this case, add the epoch rv
		if snapshots[i].timeStamp.Sub(snapshots[ptr].timeStamp).Minutes() >
			interval.Minutes() {
			if _, ok := rv[snapshots[i+1].epoch]; !ok {
				rv[snapshots[i+1].epoch] = snapshots[i+1].timeStamp
				ptr = i + 1
				numSnapshotsProtected++
			}
		} else if snapshots[i].timeStamp.Sub(snapshots[ptr].timeStamp).Minutes() ==
			interval.Minutes() {
			if _, ok := rv[snapshots[i].epoch]; !ok {
				rv[snapshots[i].epoch] = snapshots[i].timeStamp
				ptr = i
				numSnapshotsProtected++
			}
		}

		if numSnapshotsProtected >= maxDataPoints {
			break
		}
	}
	return ptr, rv
}

// getProtectedSnapshots aims to fetch the epochs keep based on a timestamp basis.
// It tries to get NumSnapshotsToKeep snapshots, each of which are separated
// by a time duration of RollbackSamplingInterval.
func getProtectedSnapshots(rollbackSamplingInterval time.Duration,
	numSnapshotsToKeep int,
	persistedSnapshots []*snapshotMetaData,
) map[uint64]time.Time {
	// keep numSnapshotsToKeep - 1 worth of time series snapshots, because we always
	// must preserve the very latest snapshot in bolt as well to avoid accidental
	// deletes of bolt entries and cleanups by the purger code.
	lastPoint, protectedEpochs := getTimeSeriesSnapshots(numSnapshotsToKeep-1,
		rollbackSamplingInterval, persistedSnapshots)
	if len(protectedEpochs) < numSnapshotsToKeep {
		numSnapshotsNeeded := numSnapshotsToKeep - len(protectedEpochs)
		// we protected the contiguous snapshots from the last point in time series
		for i := 0; i < numSnapshotsNeeded && i < lastPoint; i++ {
			protectedEpochs[persistedSnapshots[i].epoch] = persistedSnapshots[i].timeStamp
		}
	}

	return protectedEpochs
}

func newCheckPoints(snapshots map[uint64]time.Time) []*snapshotMetaData {
	rv := make([]*snapshotMetaData, 0)

	keys := make([]uint64, 0, len(snapshots))
	for k := range snapshots {
		keys = append(keys, k)
	}

	sort.SliceStable(keys, func(i, j int) bool {
		return snapshots[keys[i]].Sub(snapshots[keys[j]]) > 0
	})

	for _, key := range keys {
		rv = append(rv, &snapshotMetaData{
			epoch:     key,
			timeStamp: snapshots[key],
		})
	}

	return rv
}

// Removes enough snapshots from the rootBolt so that the
// s.eligibleForRemoval stays under the NumSnapshotsToKeep policy.
func (s *Scorch) removeOldBoltSnapshots() (numRemoved int, err error) {
	persistedSnapshots, err := s.rootBoltSnapshotMetaData()
	if err != nil {
		return 0, err
	}

	if len(persistedSnapshots) <= s.numSnapshotsToKeep {
		// we need to keep everything
		return 0, nil
	}

	protectedSnapshots := getProtectedSnapshots(s.rollbackSamplingInterval,
		s.numSnapshotsToKeep, persistedSnapshots)

	var epochsToRemove []uint64
	var newEligible []uint64
	s.rootLock.Lock()
	for _, epoch := range s.eligibleForRemoval {
		if _, ok := protectedSnapshots[epoch]; ok {
			// protected
			newEligible = append(newEligible, epoch)
		} else {
			epochsToRemove = append(epochsToRemove, epoch)
		}
	}
	s.eligibleForRemoval = newEligible
	s.rootLock.Unlock()
	s.checkPoints = newCheckPoints(protectedSnapshots)

	if len(epochsToRemove) == 0 {
		return 0, nil
	}

	tx, err := s.rootBolt.Begin(true)
	if err != nil {
		return 0, err
	}
	defer func() {
		if err == nil {
			err = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		if err == nil {
			err = s.rootBolt.Sync()
		}
	}()

	snapshots := tx.Bucket(util.BoltSnapshotsBucket)
	if snapshots == nil {
		return 0, nil
	}

	for _, epochToRemove := range epochsToRemove {
		k := encodeUvarintAscending(nil, epochToRemove)
		err = snapshots.DeleteBucket(k)
		if err == bolt.ErrBucketNotFound {
			err = nil
		}
		if err == nil {
			numRemoved++
		}
	}

	return numRemoved, err
}

func (s *Scorch) maxSegmentIDOnDisk() (uint64, error) {
	files, err := os.ReadDir(s.path)
	if err != nil {
		return 0, err
	}

	var rv uint64
	for _, f := range files {
		fname := f.Name()
		if filepath.Ext(fname) == ".zap" {
			prefix := strings.TrimSuffix(fname, ".zap")
			id, err2 := strconv.ParseUint(prefix, 16, 64)
			if err2 != nil {
				return 0, err2
			}
			if id > rv {
				rv = id
			}
		}
	}
	return rv, err
}

// Removes any *.zap files which aren't listed in the rootBolt.
func (s *Scorch) removeOldZapFiles() error {
	liveFileNames, err := s.loadZapFileNames()
	if err != nil {
		return err
	}

	files, err := os.ReadDir(s.path)
	if err != nil {
		return err
	}

	s.rootLock.RLock()

	for _, f := range files {
		fname := f.Name()
		if filepath.Ext(fname) == ".zap" {
			if _, exists := liveFileNames[fname]; !exists && !s.ineligibleForRemoval[fname] && (s.copyScheduled[fname] <= 0) {
				err := os.Remove(s.path + string(os.PathSeparator) + fname)
				if err != nil {
					log.Printf("got err removing file: %s, err: %v", fname, err)
				}
			}
		}
	}

	s.rootLock.RUnlock()

	return nil
}

// In sparse mutation scenario, it can so happen that all protected
// snapshots are older than the numSnapshotsToKeep * rollbackSamplingInterval
// duration. This results in all of them being purged from the boltDB
// and the next iteration of the removeOldData() would end up protecting
// latest contiguous snapshot which is a poor pattern in the rollback checkpoints.
// Hence we try to retain at most retentionFactor portion worth of old snapshots
// in such a scenario using the following function
func getBoundaryCheckPoint(retentionFactor float64,
	checkPoints []*snapshotMetaData, timeStamp time.Time,
) time.Time {
	if checkPoints != nil {
		boundary := checkPoints[int(math.Floor(float64(len(checkPoints))*
			retentionFactor))]
		if timeStamp.Sub(boundary.timeStamp) > 0 {
			// return the extended boundary which will dictate the older snapshots
			// to be retained
			return boundary.timeStamp
		}
	}

	return timeStamp
}

type snapshotMetaData struct {
	epoch     uint64
	timeStamp time.Time
}

func (s *Scorch) rootBoltSnapshotMetaData() ([]*snapshotMetaData, error) {
	var rv []*snapshotMetaData
	currTime := time.Now()
	// including the very latest snapshot there should be n snapshots, so the
	// very last one would be tc - (n-1) * d
	// for eg for n = 3 the checkpoints preserved should be tc, tc - d, tc - 2d
	expirationDuration := time.Duration(s.numSnapshotsToKeep-1) * s.rollbackSamplingInterval

	err := s.rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		sc := snapshots.Cursor()
		var found bool
		// traversal order - latest -> oldest epoch
		for sk, _ := sc.Last(); sk != nil; sk, _ = sc.Prev() {
			_, snapshotEpoch, err := decodeUvarintAscending(sk)
			if err != nil {
				continue
			}

			if expirationDuration == 0 {
				rv = append(rv, &snapshotMetaData{
					epoch: snapshotEpoch,
				})
				continue
			}

			snapshot := snapshots.Bucket(sk)
			if snapshot == nil {
				continue
			}
			metaBucket := snapshot.Bucket(util.BoltMetaDataKey)
			if metaBucket == nil {
				continue
			}
			timeStampBytes := metaBucket.Get(util.BoltMetaDataTimeStamp)
			var timeStamp time.Time
			err = timeStamp.UnmarshalText(timeStampBytes)
			if err != nil {
				continue
			}
			// Don't keep snapshots older than
			// expiration duration (numSnapshotsToKeep *
			// rollbackSamplingInterval, by default)
			if currTime.Sub(timeStamp) <= expirationDuration {
				rv = append(rv, &snapshotMetaData{
					epoch:     snapshotEpoch,
					timeStamp: timeStamp,
				})
			} else {
				if !found {
					found = true
					boundary := getBoundaryCheckPoint(s.rollbackRetentionFactor,
						s.checkPoints, timeStamp)
					expirationDuration = currTime.Sub(boundary)
					continue
				}
				k := encodeUvarintAscending(nil, snapshotEpoch)
				err = snapshots.DeleteBucket(k)
				if err == bolt.ErrBucketNotFound {
					err = nil
				}
			}
		}
		return nil
	})
	return rv, err
}

func (s *Scorch) RootBoltSnapshotEpochs() ([]uint64, error) {
	var rv []uint64
	err := s.rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		sc := snapshots.Cursor()
		for sk, _ := sc.Last(); sk != nil; sk, _ = sc.Prev() {
			_, snapshotEpoch, err := decodeUvarintAscending(sk)
			if err != nil {
				continue
			}
			rv = append(rv, snapshotEpoch)
		}
		return nil
	})
	return rv, err
}

// Returns the *.zap file names that are listed in the rootBolt.
func (s *Scorch) loadZapFileNames() (map[string]struct{}, error) {
	rv := map[string]struct{}{}
	err := s.rootBolt.View(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}
		sc := snapshots.Cursor()
		for sk, _ := sc.First(); sk != nil; sk, _ = sc.Next() {
			snapshot := snapshots.Bucket(sk)
			if snapshot == nil {
				continue
			}
			segc := snapshot.Cursor()
			for segk, _ := segc.First(); segk != nil; segk, _ = segc.Next() {
				if segk[0] == util.BoltInternalKey[0] {
					continue
				}
				segmentBucket := snapshot.Bucket(segk)
				if segmentBucket == nil {
					continue
				}
				pathBytes := segmentBucket.Get(util.BoltPathKey)
				if pathBytes == nil {
					continue
				}
				pathString := string(pathBytes)
				rv[string(pathString)] = struct{}{}
			}
		}
		return nil
	})

	return rv, err
}
