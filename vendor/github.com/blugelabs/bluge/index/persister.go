//  Copyright (c) 2020 Couchbase, Inc.
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

package index

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

func (s *Writer) persisterLoop(merges chan *segmentMerge, persists chan *persistIntroduction,
	introducerNotifier, persisterNotifier watcherChan, lastPersistedEpoch uint64) {
	defer s.asyncTasks.Done()

	var persistWatchers epochWatchers
	var lastMergedEpoch uint64
	var ew *epochWatcher

	var unpersistedCallbacks []func(error)

	// tell the introducer we're waiting for changes after the initial epoch
	introducerEpochWatcher, err := introducerNotifier.NotifyUsAfter(0, s.closeCh)
	if err != nil {
		return
	}

OUTER:
	for {
		atomic.AddUint64(&s.stats.TotPersistLoopBeg, 1)
		atomic.AddUint64(&s.stats.TotPersistLoopWait, 1)

		select {
		case <-s.closeCh:
			break OUTER
		case ew = <-persisterNotifier:
			persistWatchers.Add(ew)
			lastMergedEpoch = ew.epoch
		case <-introducerEpochWatcher.notifyCh:
			// woken up, next loop should pick up work
			atomic.AddUint64(&s.stats.TotPersistLoopWaitNotified, 1)

			lastMergedEpoch, persistWatchers = s.pausePersisterForMergerCatchUp(persisterNotifier, lastPersistedEpoch,
				lastMergedEpoch, persistWatchers)

			var ourSnapshot *Snapshot
			var ourPersisted []chan error
			var ourPersistedCallbacks []func(error)

			// check to see if there is a new snapshot to persist
			s.rootLock.Lock()
			if s.root != nil && s.root.epoch > lastPersistedEpoch {
				ourSnapshot = s.root
				ourSnapshot.addRef()
				ourPersisted = s.rootPersisted
				s.rootPersisted = nil
				ourPersistedCallbacks = s.persistedCallbacks
				s.persistedCallbacks = nil
				atomic.StoreUint64(&s.stats.persistSnapshotSize, uint64(ourSnapshot.Size()))
				atomic.StoreUint64(&s.stats.persistEpoch, ourSnapshot.epoch)
			}
			s.rootLock.Unlock()

			if ourSnapshot != nil {
				startTime := time.Now()

				err = s.persistSnapshot(merges, persists, ourSnapshot)
				for _, ch := range ourPersisted {
					if err != nil {
						ch <- err
					}
					close(ch)
				}
				if err != nil {
					atomic.StoreUint64(&s.stats.persistEpoch, 0)
					if err == segment.ErrClosed {
						// index has been closed
						_ = ourSnapshot.Close()
						break OUTER
					}

					// save this current snapshot's persistedCallbacks, to invoke during
					// the retry attempt
					unpersistedCallbacks = append(unpersistedCallbacks, ourPersistedCallbacks...)

					s.fireAsyncError(fmt.Errorf("got err persisting snapshot: %v", err))
					_ = ourSnapshot.Close()
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
				_ = ourSnapshot.Close()

				s.fireEvent(EventKindPersisterProgress, time.Since(startTime))

				if s.currentEpoch() != lastPersistedEpoch {
					atomic.AddUint64(&s.stats.TotPersistLoopProgress, 1)
					continue OUTER
				}
			}

			// tell the introducer we're waiting for changes after lastPersistedEpoch
			introducerEpochWatcher, err = introducerNotifier.NotifyUsAfter(lastPersistedEpoch, s.closeCh)
			if err != nil {
				break OUTER
			}

			err = s.deletionPolicy.Cleanup(s.directory) // might as well cleanup while waiting
			if err != nil {
				s.config.AsyncError(err)
			}
		}

		atomic.AddUint64(&s.stats.TotPersistLoopEnd, 1)
	}
}

func (s *Writer) pausePersisterForMergerCatchUp(persisterNotifier watcherChan,
	lastPersistedEpoch, lastMergedEpoch uint64, persistWatchers epochWatchers) (uint64, epochWatchers) {
	// First, let the watchers proceed if they lag behind
	persistWatchers.NotifySatisfiedWatchers(lastPersistedEpoch)

	// Check the merger lag by counting the segment files on disk,
	numFilesOnDisk, _ := s.directory.Stats()

	// On finding fewer files on disk, persister takes a short pause
	// for sufficient in-memory segments to pile up for the next
	// memory merge cum persist loop.
	if numFilesOnDisk < uint64(s.config.PersisterNapUnderNumFiles) &&
		s.config.PersisterNapTimeMSec > 0 && s.numEventsBlocking() == 0 {
		select {
		case <-s.closeCh:
		case <-time.After(time.Millisecond * time.Duration(s.config.PersisterNapTimeMSec)):
			atomic.AddUint64(&s.stats.TotPersisterNapPauseCompleted, 1)

		case ew := <-persisterNotifier:
			// unblock the merger in meantime
			persistWatchers.Add(ew)
			lastMergedEpoch = ew.epoch
			persistWatchers.NotifySatisfiedWatchers(lastPersistedEpoch)
			atomic.AddUint64(&s.stats.TotPersisterMergerNapBreak, 1)
		}
		return lastMergedEpoch, persistWatchers
	}

	// Finding too many files on disk could be due to two reasons.
	// 1. Too many older snapshots awaiting the clean up.
	// 2. The merger could be lagging behind on merging the disk files.
	if numFilesOnDisk > uint64(s.config.PersisterNapUnderNumFiles) {
		err := s.deletionPolicy.Cleanup(s.directory)
		if err != nil {
			s.config.AsyncError(err)
		}
		numFilesOnDisk, _ = s.directory.Stats()
	}

	// Persister pause until the merger catches up to reduce the segment
	// file count under the threshold.
	// But if there is memory pressure, then skip this sleep maneuvers.
OUTER:
	for s.config.PersisterNapUnderNumFiles > 0 &&
		numFilesOnDisk >= uint64(s.config.PersisterNapUnderNumFiles) &&
		lastMergedEpoch < lastPersistedEpoch {
		atomic.AddUint64(&s.stats.TotPersisterSlowMergerPause, 1)

		select {
		case <-s.closeCh:
			break OUTER
		case ew := <-persisterNotifier:
			persistWatchers.Add(ew)
			lastMergedEpoch = ew.epoch
		}

		atomic.AddUint64(&s.stats.TotPersisterSlowMergerResume, 1)

		// let the watchers proceed if they lag behind
		persistWatchers.NotifySatisfiedWatchers(lastPersistedEpoch)

		numFilesOnDisk, _ = s.directory.Stats()
	}

	return lastMergedEpoch, persistWatchers
}

func (s *Writer) persistSnapshot(merges chan *segmentMerge, persists chan *persistIntroduction, snapshot *Snapshot) error {
	// Perform in-memory segment merging only when the memory pressure is
	// below the configured threshold, else the persister performs the
	// direct persistence of segments.
	if s.numEventsBlocking() < s.config.MemoryPressurePauseThreshold {
		persisted, err := s.persistSnapshotMaybeMerge(merges, persists, snapshot)
		if err != nil {
			return err
		}
		if persisted {
			return nil
		}
	}

	return s.persistSnapshotDirect(persists, snapshot)
}

// persistSnapshotMaybeMerge examines the snapshot and might merge and
// persist the in-memory zap segments if there are enough of them
func (s *Writer) persistSnapshotMaybeMerge(merges chan *segmentMerge, persists chan *persistIntroduction, snapshot *Snapshot) (
	bool, error) {
	// collect the in-memory zap segments (SegmentBase instances)
	var sbs []segment.Segment
	var sbsDrops []*roaring.Bitmap
	var sbsIndexes []int

	for i, segmentSnapshot := range snapshot.segment {
		if !segmentSnapshot.segment.Persisted() {
			sbs = append(sbs, segmentSnapshot.segment.Segment)
			sbsDrops = append(sbsDrops, segmentSnapshot.deleted)
			sbsIndexes = append(sbsIndexes, i)
		}
	}

	if len(sbs) < s.config.MinSegmentsForInMemoryMerge {
		return false, nil
	}

	newSnapshot, newSegmentID, err := s.mergeSegmentBases(
		merges, snapshot, sbs, sbsDrops, sbsIndexes)
	if err != nil {
		return false, err
	}
	if newSnapshot == nil {
		return false, nil
	}

	defer func() {
		_ = newSnapshot.Close()
	}()

	mergedSegmentIDs := map[uint64]struct{}{}
	for _, idx := range sbsIndexes {
		mergedSegmentIDs[snapshot.segment[idx].id] = struct{}{}
	}

	// construct a snapshot that's logically equivalent to the input
	// snapshot, but with merged segments replaced by the new segment
	equiv := &Snapshot{
		parent:  snapshot.parent,
		segment: make([]*segmentSnapshot, 0, len(snapshot.segment)),
		epoch:   snapshot.epoch,
		creator: "persistSnapshotMaybeMerge",
	}

	// copy to the equiv the segments that weren't replaced
	for _, segment := range snapshot.segment {
		if _, wasMerged := mergedSegmentIDs[segment.id]; !wasMerged {
			equiv.segment = append(equiv.segment, segment)
		}
	}

	// append to the equiv the new segment
	for _, segment := range newSnapshot.segment {
		if segment.id == newSegmentID {
			equiv.segment = append(equiv.segment, &segmentSnapshot{
				id:      newSegmentID,
				segment: segment.segment,
				deleted: nil, // nil since merging handled deletions
			})
			break
		}
	}

	err = s.persistSnapshotDirect(persists, equiv)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (s *Writer) persistSnapshotDirect(persists chan *persistIntroduction, snapshot *Snapshot) (err error) {
	// first ensure that each segment in this snapshot has been persisted
	var newSegmentIds []uint64
	for _, segmentSnapshot := range snapshot.segment {
		if !segmentSnapshot.segment.Persisted() {
			err = s.directory.Persist(ItemKindSegment, segmentSnapshot.id, segmentSnapshot.segment.Segment, s.closeCh)
			if err != nil {
				return fmt.Errorf("error persisting segment: %v", err)
			}
			newSegmentIds = append(newSegmentIds, segmentSnapshot.id)
		}
	}

	if len(newSegmentIds) > 0 {
		err = s.prepareIntroducePersist(persists, newSegmentIds)
		if err != nil {
			return err
		}
	}

	err = s.directory.Persist(ItemKindSnapshot, snapshot.epoch, snapshot, s.closeCh)
	if err != nil {
		return err
	}

	s.deletionPolicy.Commit(snapshot)

	return nil
}

func (s *Writer) prepareIntroducePersist(persists chan *persistIntroduction, newSegmentIds []uint64) error {
	// now try to open all the new snapshots
	newSegments := make(map[uint64]*segmentWrapper)
	defer func() {
		for _, s := range newSegments {
			if s != nil {
				// cleanup segments that were opened but not
				// swapped into the new root
				_ = s.Close()
			}
		}
	}()
	var err error
	for _, segmentID := range newSegmentIds {
		newSegments[segmentID], err = s.loadSegment(segmentID, s.segPlugin)
		if err != nil {
			return fmt.Errorf("error opening new segment %d, %v", segmentID, err)
		}
	}

	persist := &persistIntroduction{
		persisted: newSegments,
		applied:   make(notificationChan),
	}

	select {
	case <-s.closeCh:
		return segment.ErrClosed
	case persists <- persist:
	}

	select {
	case <-s.closeCh:
		return segment.ErrClosed
	case <-persist.applied:
	}

	return nil
}
