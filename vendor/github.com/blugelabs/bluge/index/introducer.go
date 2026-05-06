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

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/RoaringBitmap/roaring"
)

type segmentIntroduction struct {
	id        uint64
	data      *segmentWrapper
	obsoletes map[uint64]*roaring.Bitmap
	idTerms   []segment.Term
	internal  map[string][]byte

	applied           chan error
	persisted         chan error
	persistedCallback func(error)
}

type persistIntroduction struct {
	persisted map[uint64]*segmentWrapper
	applied   notificationChan
}

func (s *Writer) introducerLoop(introductions chan *segmentIntroduction,
	persists chan *persistIntroduction, merges chan *segmentMerge,
	introducerNotifier watcherChan, nextSnapshotEpoch uint64) {
	var introduceWatchers epochWatchers
OUTER:
	for {
		atomic.AddUint64(&s.stats.TotIntroduceLoop, 1)

		select {
		case <-s.closeCh:
			break OUTER

		case epochWatcher := <-introducerNotifier:
			introduceWatchers.Add(epochWatcher)

		case nextMerge := <-merges:
			introduceSnapshotEpoch := nextSnapshotEpoch
			nextSnapshotEpoch++
			s.introduceMerge(nextMerge, introduceSnapshotEpoch)

		case next := <-introductions:
			introduceSnapshotEpoch := nextSnapshotEpoch
			nextSnapshotEpoch++
			err := s.introduceSegment(next, introduceSnapshotEpoch)
			if err != nil {
				continue OUTER
			}

		case persist := <-persists:
			introduceSnapshotEpoch := nextSnapshotEpoch
			nextSnapshotEpoch++
			s.introducePersist(persist, introduceSnapshotEpoch)
		}

		epochCurr := s.currentEpoch()
		introduceWatchers.NotifySatisfiedWatchers(epochCurr)
	}

	s.asyncTasks.Done()
}

func (s *Writer) introduceSegment(next *segmentIntroduction, introduceSnapshotEpoch uint64) error {
	atomic.AddUint64(&s.stats.TotIntroduceSegmentBeg, 1)
	defer atomic.AddUint64(&s.stats.TotIntroduceSegmentEnd, 1)

	root := s.currentSnapshot()
	defer func() { _ = root.Close() }()

	nsegs := len(root.segment)

	// prepare new index snapshot
	newSnapshot := &Snapshot{
		parent:  s,
		epoch:   introduceSnapshotEpoch,
		segment: make([]*segmentSnapshot, 0, nsegs+1),
		offsets: make([]uint64, 0, nsegs+1),
		refs:    1,
		creator: "introduceSegment",
	}

	// iterate through current segments
	var running, docsToPersistCount uint64
	var memSegments, fileSegments uint64
	for i := range root.segment {
		// see if optimistic work included this segment
		delta, ok := next.obsoletes[root.segment[i].id]
		if !ok {
			var err error
			delta, err = root.segment[i].segment.DocsMatchingTerms(next.idTerms)
			if err != nil {
				next.applied <- fmt.Errorf("error computing doc numbers: %v", err)
				close(next.applied)
				_ = newSnapshot.Close()
				return err
			}
		}

		newss := &segmentSnapshot{
			id:      root.segment[i].id,
			segment: root.segment[i].segment,
			creator: root.segment[i].creator,
		}

		// apply new obsoletions
		if root.segment[i].deleted == nil {
			newss.deleted = delta
		} else {
			newss.deleted = roaring.Or(root.segment[i].deleted, delta)
		}
		if newss.deleted.IsEmpty() {
			newss.deleted = nil
		}

		// check for live size before copying
		if newss.LiveSize() > 0 {
			newSnapshot.segment = append(newSnapshot.segment, newss)
			root.segment[i].segment.AddRef()
			newSnapshot.offsets = append(newSnapshot.offsets, running)
			running += newss.segment.Count()
		}

		if !root.segment[i].segment.Persisted() {
			docsToPersistCount += root.segment[i].Count()
			memSegments++
		} else {
			fileSegments++
		}
	}

	atomic.StoreUint64(&s.stats.TotItemsToPersist, docsToPersistCount)
	atomic.StoreUint64(&s.stats.TotMemorySegmentsAtRoot, memSegments)
	atomic.StoreUint64(&s.stats.TotFileSegmentsAtRoot, fileSegments)

	// append new segment, if any, to end of the new index snapshot
	if next.data != nil {
		newSegmentSnapshot := &segmentSnapshot{
			id:      next.id,
			segment: next.data, // take ownership of next.data's ref-count
			creator: "introduceSegment",
		}
		newSnapshot.segment = append(newSnapshot.segment, newSegmentSnapshot)
		newSnapshot.offsets = append(newSnapshot.offsets, running)

		// increment numItemsIntroduced which tracks the number of items
		// queued for persistence.
		atomic.AddUint64(&s.stats.TotIntroducedItems, newSegmentSnapshot.Count())
		atomic.AddUint64(&s.stats.TotIntroducedSegmentsBatch, 1)
	}

	newSnapshot.updateSize()

	s.replaceRoot(newSnapshot, next.persisted, next.persistedCallback)

	close(next.applied)

	return nil
}

func (s *Writer) introducePersist(persist *persistIntroduction, introduceSnapshotEpoch uint64) {
	atomic.AddUint64(&s.stats.TotIntroducePersistBeg, 1)
	defer atomic.AddUint64(&s.stats.TotIntroducePersistEnd, 1)

	root := s.currentSnapshot()
	defer func() { _ = root.Close() }()

	newIndexSnapshot := &Snapshot{
		parent:  s,
		epoch:   introduceSnapshotEpoch,
		segment: make([]*segmentSnapshot, len(root.segment)),
		offsets: make([]uint64, len(root.offsets)),
		refs:    1,
		creator: "introducePersist",
	}

	var docsToPersistCount uint64
	var memSegments, fileSegments uint64
	for i, segSnapshot := range root.segment {
		// see if this segment has been replaced
		if replacement, ok := persist.persisted[segSnapshot.id]; ok {
			newSegmentSnapshot := &segmentSnapshot{
				id:      segSnapshot.id,
				segment: replacement,
				deleted: segSnapshot.deleted,
				creator: "introducePersist",
			}
			newIndexSnapshot.segment[i] = newSegmentSnapshot
			delete(persist.persisted, segSnapshot.id)

			// update items persisted incase of a new segment snapshot
			atomic.AddUint64(&s.stats.TotPersistedItems, newSegmentSnapshot.Count())
			atomic.AddUint64(&s.stats.TotPersistedSegments, 1)
			fileSegments++
		} else {
			newIndexSnapshot.segment[i] = root.segment[i]
			newIndexSnapshot.segment[i].segment.AddRef()

			if !root.segment[i].segment.Persisted() {
				docsToPersistCount += root.segment[i].Count()
				memSegments++
			} else {
				fileSegments++
			}
		}
		newIndexSnapshot.offsets[i] = root.offsets[i]
	}

	atomic.StoreUint64(&s.stats.TotItemsToPersist, docsToPersistCount)
	atomic.StoreUint64(&s.stats.TotMemorySegmentsAtRoot, memSegments)
	atomic.StoreUint64(&s.stats.TotFileSegmentsAtRoot, fileSegments)
	newIndexSnapshot.updateSize()

	s.replaceRoot(newIndexSnapshot, nil, nil)

	close(persist.applied)
}

// The introducer should definitely handle the segmentMerge.notify
// channel before exiting the introduceMerge.
func (s *Writer) introduceMerge(nextMerge *segmentMerge, introduceSnapshotEpoch uint64) {
	atomic.AddUint64(&s.stats.TotIntroduceMergeBeg, 1)
	defer atomic.AddUint64(&s.stats.TotIntroduceMergeEnd, 1)

	root := s.currentSnapshot()
	defer func() { _ = root.Close() }()

	newSnapshot := &Snapshot{
		parent:  s,
		epoch:   introduceSnapshotEpoch,
		refs:    1,
		creator: "introduceMerge",
	}

	// iterate through current segments
	newSegmentDeleted := roaring.NewBitmap()
	var running, docsToPersistCount uint64
	var memSegments, fileSegments uint64
	for i := range root.segment {
		segmentID := root.segment[i].id
		segmentIsGoingAway := nextMerge.ProcessSegmentNow(segmentID, root.segment[i], newSegmentDeleted)
		if !segmentIsGoingAway && root.segment[i].LiveSize() > 0 {
			// this segment is staying
			newSnapshot.segment = append(newSnapshot.segment, &segmentSnapshot{
				id:      root.segment[i].id,
				segment: root.segment[i].segment,
				deleted: root.segment[i].deleted,
				creator: root.segment[i].creator,
			})
			root.segment[i].segment.AddRef()
			newSnapshot.offsets = append(newSnapshot.offsets, running)
			running += root.segment[i].segment.Count()

			if !root.segment[i].segment.Persisted() {
				docsToPersistCount += root.segment[i].Count()
				memSegments++
			} else {
				fileSegments++
			}
		}
	}

	// before the newMerge introduction, need to clean the newly
	// merged segment wrt the current root segments, hence
	// applying the obsolete segment contents to newly merged segment
	for segID, ss := range nextMerge.old {
		obsoleted := ss.DocNumbersLive()
		if obsoleted != nil {
			obsoletedIter := obsoleted.Iterator()
			for obsoletedIter.HasNext() {
				oldDocNum := obsoletedIter.Next()
				newDocNum := nextMerge.oldNewDocNums[segID][oldDocNum]
				newSegmentDeleted.Add(uint32(newDocNum))
			}
		}
	}
	var skipped bool
	// In case where all the docs in the newly merged segment getting
	// deleted by the time we reach here, can skip the introduction.
	if nextMerge.new != nil &&
		nextMerge.new.Count() > newSegmentDeleted.GetCardinality() {
		// put new segment at end
		newSnapshot.segment = append(newSnapshot.segment, &segmentSnapshot{
			id:      nextMerge.id,
			segment: nextMerge.new, // take ownership for nextMerge.new's ref-count
			deleted: newSegmentDeleted,
			creator: "introduceMerge",
		})
		newSnapshot.offsets = append(newSnapshot.offsets, running)
		atomic.AddUint64(&s.stats.TotIntroducedSegmentsMerge, 1)

		if nextMerge.new.Persisted() {
			fileSegments++
		} else {
			docsToPersistCount += nextMerge.new.Count() - newSegmentDeleted.GetCardinality()
			memSegments++
		}
	} else {
		skipped = true
		atomic.AddUint64(&s.stats.TotFileMergeIntroductionsObsoleted, 1)
	}

	atomic.StoreUint64(&s.stats.TotItemsToPersist, docsToPersistCount)
	atomic.StoreUint64(&s.stats.TotMemorySegmentsAtRoot, memSegments)
	atomic.StoreUint64(&s.stats.TotFileSegmentsAtRoot, fileSegments)

	newSnapshot.addRef() // 1 ref for the nextMerge.notify response

	newSnapshot.updateSize()

	s.replaceRoot(newSnapshot, nil, nil)

	// notify requester that we incorporated this
	nextMerge.notifyCh <- &mergeTaskIntroStatus{snapshot: newSnapshot, skipped: skipped}
	close(nextMerge.notifyCh)
}

func (s *Writer) replaceRoot(newSnapshot *Snapshot, persistedCh chan error, persistedCallback func(error)) {
	s.rootLock.Lock()
	if persistedCh != nil {
		s.rootPersisted = append(s.rootPersisted, persistedCh)
	}
	if persistedCallback != nil {
		s.persistedCallbacks = append(s.persistedCallbacks, persistedCallback)
	}
	rootPrev := s.root
	s.root = newSnapshot
	if s.root != nil {
		atomic.StoreUint64(&s.stats.CurRootEpoch, s.root.epoch)
	}
	s.rootLock.Unlock()

	if rootPrev != nil {
		_ = rootPrev.Close()
	}
}
