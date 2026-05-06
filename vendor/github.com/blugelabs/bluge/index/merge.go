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
	"github.com/blugelabs/bluge/index/mergeplan"
	segment "github.com/blugelabs/bluge_segment_api"
)

func (s *Writer) mergerLoop(merges chan *segmentMerge, persisterNotifier watcherChan) {
	defer s.asyncTasks.Done()

	var lastEpochMergePlanned uint64

	// tell the persister we're waiting for anything after the initialEpoch
	ew, err := persisterNotifier.NotifyUsAfter(0, s.closeCh)
	if err != nil {
		return
	}

OUTER:
	for {
		atomic.AddUint64(&s.stats.TotFileMergeLoopBeg, 1)

		select {
		case <-s.closeCh:
			break OUTER

		case <-ew.notifyCh:
			// check to see if there is a new snapshot to persist
			ourSnapshot := s.currentSnapshot()
			atomic.StoreUint64(&s.stats.mergeSnapshotSize, uint64(ourSnapshot.Size()))
			atomic.StoreUint64(&s.stats.mergeEpoch, ourSnapshot.epoch)

			if ourSnapshot.epoch != lastEpochMergePlanned {
				startTime := time.Now()

				// lets get started
				err = s.planMergeAtSnapshot(merges, ourSnapshot, s.config.MergePlanOptions)
				if err != nil {
					atomic.StoreUint64(&s.stats.mergeEpoch, 0)
					if err == segment.ErrClosed {
						// index has been closed
						_ = ourSnapshot.Close()
						break OUTER
					}
					s.fireAsyncError(fmt.Errorf("merging err: %v", err))
					_ = ourSnapshot.Close()
					atomic.AddUint64(&s.stats.TotFileMergeLoopErr, 1)
					continue OUTER
				}
				lastEpochMergePlanned = ourSnapshot.epoch

				atomic.StoreUint64(&s.stats.LastMergedEpoch, ourSnapshot.epoch)

				s.fireEvent(EventKindMergerProgress, time.Since(startTime))
			}
			_ = ourSnapshot.Close()

			// update the persister, that we're now waiting for something
			// after lastEpochMergePlanned
			ew, err = persisterNotifier.NotifyUsAfter(lastEpochMergePlanned, s.closeCh)
			if err != nil {
				break OUTER
			}
		}

		atomic.AddUint64(&s.stats.TotFileMergeLoopEnd, 1)
	}
}

func (s *Writer) planMergeAtSnapshot(merges chan *segmentMerge, ourSnapshot *Snapshot,
	options mergeplan.Options) error {
	// build list of persisted segments in this snapshot
	var onlyPersistedSnapshots []mergeplan.Segment
	for _, segmentSnapshot := range ourSnapshot.segment {
		if segmentSnapshot.segment.Persisted() {
			onlyPersistedSnapshots = append(onlyPersistedSnapshots, segmentSnapshot)
		}
	}

	atomic.AddUint64(&s.stats.TotFileMergePlan, 1)

	// give this list to the planner
	resultMergePlan, err := mergeplan.Plan(onlyPersistedSnapshots, &options)
	if err != nil {
		atomic.AddUint64(&s.stats.TotFileMergePlanErr, 1)
		return fmt.Errorf("merge planning err: %v", err)
	}
	if resultMergePlan == nil {
		// nothing to do
		atomic.AddUint64(&s.stats.TotFileMergePlanNone, 1)
		return nil
	}
	atomic.AddUint64(&s.stats.TotFileMergePlanOk, 1)

	atomic.AddUint64(&s.stats.TotFileMergePlanTasks, uint64(len(resultMergePlan.Tasks)))

	// process tasks in serial for now
	for _, task := range resultMergePlan.Tasks {
		err := s.executeMergeTask(merges, task)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *Writer) executeMergeTask(merges chan *segmentMerge, task *mergeplan.MergeTask) error {
	if len(task.Segments) == 0 {
		atomic.AddUint64(&s.stats.TotFileMergePlanTasksSegmentsEmpty, 1)
		return nil
	}

	atomic.AddUint64(&s.stats.TotFileMergePlanTasksSegments, uint64(len(task.Segments)))

	oldMap, segmentsToMerge, docsToDrop := s.planSegmentsToMerge(task)

	newSegmentID := atomic.AddUint64(&s.nextSegmentID, 1)
	var oldNewDocNums map[uint64][]uint64
	var seg *segmentWrapper
	if len(segmentsToMerge) > 0 {
		fileMergeZapStartTime := time.Now()

		atomic.AddUint64(&s.stats.TotFileMergeZapBeg, 1)
		newDocNums, err := s.merge(segmentsToMerge, docsToDrop, newSegmentID)
		atomic.AddUint64(&s.stats.TotFileMergeZapEnd, 1)

		fileMergeZapTime := uint64(time.Since(fileMergeZapStartTime))
		atomic.AddUint64(&s.stats.TotFileMergeZapTime, fileMergeZapTime)
		if atomic.LoadUint64(&s.stats.MaxFileMergeZapTime) < fileMergeZapTime {
			atomic.StoreUint64(&s.stats.MaxFileMergeZapTime, fileMergeZapTime)
		}

		if err != nil {
			atomic.AddUint64(&s.stats.TotFileMergePlanTasksErr, 1)
			if err == segment.ErrClosed {
				return err
			}
			return fmt.Errorf("merging failed: %v", err)
		}

		seg, err = s.loadSegment(newSegmentID, s.segPlugin)
		if err != nil {
			atomic.AddUint64(&s.stats.TotFileMergePlanTasksErr, 1)
			return err
		}
		oldNewDocNums = make(map[uint64][]uint64)
		for i, segNewDocNums := range newDocNums {
			oldNewDocNums[task.Segments[i].ID()] = segNewDocNums
		}

		atomic.AddUint64(&s.stats.TotFileMergeSegments, uint64(len(segmentsToMerge)))
	}

	sm := &segmentMerge{
		id:            newSegmentID,
		old:           oldMap,
		oldNewDocNums: oldNewDocNums,
		new:           seg,
		notifyCh:      make(chan *mergeTaskIntroStatus),
	}

	s.fireEvent(EventKindMergeTaskIntroductionStart, 0)

	// give it to the introducer
	select {
	case <-s.closeCh:
		_ = seg.Close()
		return segment.ErrClosed
	case merges <- sm:
		atomic.AddUint64(&s.stats.TotFileMergeIntroductions, 1)
	}

	introStartTime := time.Now()
	// it is safe to blockingly wait for the merge introduction
	// here as the introducer is bound to handle the notify channel.
	mergeTaskIntroStatus := <-sm.notifyCh
	introTime := uint64(time.Since(introStartTime))
	atomic.AddUint64(&s.stats.TotFileMergeZapIntroductionTime, introTime)
	if atomic.LoadUint64(&s.stats.MaxFileMergeZapIntroductionTime) < introTime {
		atomic.StoreUint64(&s.stats.MaxFileMergeZapIntroductionTime, introTime)
	}
	atomic.AddUint64(&s.stats.TotFileMergeIntroductionsDone, 1)
	if mergeTaskIntroStatus != nil && mergeTaskIntroStatus.snapshot != nil {
		_ = mergeTaskIntroStatus.snapshot.Close()
		if mergeTaskIntroStatus.skipped {
			// decrement the ref counts on skipping introduction.
			// FIXME stale file that won't get cleaned up
			_ = seg.Close()
		}
	}

	atomic.AddUint64(&s.stats.TotFileMergePlanTasksDone, 1)
	s.fireEvent(EventKindMergeTaskIntroduction, 0)
	return nil
}

func (s *Writer) planSegmentsToMerge(task *mergeplan.MergeTask) (oldMap map[uint64]*segmentSnapshot,
	segmentsToMerge []segment.Segment, docsToDrop []*roaring.Bitmap) {
	oldMap = make(map[uint64]*segmentSnapshot)
	segmentsToMerge = make([]segment.Segment, 0, len(task.Segments))
	docsToDrop = make([]*roaring.Bitmap, 0, len(task.Segments))
	for _, planSegment := range task.Segments {
		if segSnapshot, ok := planSegment.(*segmentSnapshot); ok {
			oldMap[segSnapshot.id] = segSnapshot
			if segSnapshot.segment.Persisted() {
				if segSnapshot.LiveSize() == 0 {
					atomic.AddUint64(&s.stats.TotFileMergeSegmentsEmpty, 1)
					oldMap[segSnapshot.id] = nil
				} else {
					segmentsToMerge = append(segmentsToMerge, segSnapshot.segment.Segment)
					docsToDrop = append(docsToDrop, segSnapshot.deleted)
				}
			}
		}
	}
	return oldMap, segmentsToMerge, docsToDrop
}

type mergeTaskIntroStatus struct {
	snapshot *Snapshot
	skipped  bool
}

type segmentMerge struct {
	id            uint64
	old           map[uint64]*segmentSnapshot
	oldNewDocNums map[uint64][]uint64
	new           *segmentWrapper
	notifyCh      chan *mergeTaskIntroStatus
}

// ProcessSegmentNow takes in a segmentID, the current version of that segment snapshot
// which could have more deleted items since we examined it for the merge, and a
// roaringBitmap to track these new deletions.
// If this segment isn't going away, we do nothing, returning false.
// If this segment is going away, we check for any deletions since we examined it
// during the merge, for each of these, we find the new document number of the item,
// and flip the bit in the newSegmentDeleted bitmap, then returning true.
func (s *segmentMerge) ProcessSegmentNow(segmentID uint64, segSnapNow *segmentSnapshot,
	newSegmentDeleted *roaring.Bitmap) bool {
	if segSnapAtMerge, ok := s.old[segmentID]; ok {
		if segSnapAtMerge != nil && segSnapNow.deleted != nil {
			// assume all these deletes are new
			deletedSince := segSnapNow.deleted
			// if we already knew about some of them, remove
			if segSnapAtMerge.deleted != nil {
				deletedSince = roaring.AndNot(segSnapNow.deleted, segSnapAtMerge.deleted)
			}
			deletedSinceItr := deletedSince.Iterator()
			for deletedSinceItr.HasNext() {
				oldDocNum := deletedSinceItr.Next()
				newDocNum := s.oldNewDocNums[segmentID][oldDocNum]
				newSegmentDeleted.Add(uint32(newDocNum))
			}
		}
		// clean up the old segment map to figure out the
		// obsolete segments wrt root in meantime, whatever
		// segments left behind in old map after processing
		// the root segments would be the obsolete segment set
		delete(s.old, segmentID)

		return true
	}
	return false
}

// perform a merging of the given SegmentBase instances into a new,
// persisted segment, and synchronously introduce that new segment
// into the root
func (s *Writer) mergeSegmentBases(merges chan *segmentMerge, snapshot *Snapshot,
	sbs []segment.Segment, sbsDrops []*roaring.Bitmap,
	sbsIndexes []int) (*Snapshot, uint64, error) {
	atomic.AddUint64(&s.stats.TotMemMergeBeg, 1)

	memMergeZapStartTime := time.Now()

	atomic.AddUint64(&s.stats.TotMemMergeZapBeg, 1)

	newSegmentID := atomic.AddUint64(&s.nextSegmentID, 1)

	newDocNums, err := s.merge(sbs, sbsDrops, newSegmentID)

	atomic.AddUint64(&s.stats.TotMemMergeZapEnd, 1)

	memMergeZapTime := uint64(time.Since(memMergeZapStartTime))
	atomic.AddUint64(&s.stats.TotMemMergeZapTime, memMergeZapTime)
	if atomic.LoadUint64(&s.stats.MaxMemMergeZapTime) < memMergeZapTime {
		atomic.StoreUint64(&s.stats.MaxMemMergeZapTime, memMergeZapTime)
	}

	if err != nil {
		atomic.AddUint64(&s.stats.TotMemMergeErr, 1)
		return nil, 0, err
	}

	seg, err := s.loadSegment(newSegmentID, s.segPlugin)
	if err != nil {
		atomic.AddUint64(&s.stats.TotMemMergeErr, 1)
		return nil, 0, err
	}

	// update persisted stats
	atomic.AddUint64(&s.stats.TotPersistedItems, seg.Count())
	atomic.AddUint64(&s.stats.TotPersistedSegments, 1)

	sm := &segmentMerge{
		id:            newSegmentID,
		old:           make(map[uint64]*segmentSnapshot),
		oldNewDocNums: make(map[uint64][]uint64),
		new:           seg,
		notifyCh:      make(chan *mergeTaskIntroStatus),
	}

	for i, idx := range sbsIndexes {
		ss := snapshot.segment[idx]
		sm.old[ss.id] = ss
		sm.oldNewDocNums[ss.id] = newDocNums[i]
	}

	select { // send to introducer
	case <-s.closeCh:
		_ = seg.DecRef()
		return nil, 0, segment.ErrClosed
	case merges <- sm:
	}

	// blockingly wait for the introduction to complete
	var newSnapshot *Snapshot
	mergeTaskIntroStatus := <-sm.notifyCh
	if mergeTaskIntroStatus != nil && mergeTaskIntroStatus.snapshot != nil {
		newSnapshot = mergeTaskIntroStatus.snapshot
		atomic.AddUint64(&s.stats.TotMemMergeSegments, uint64(len(sbs)))
		atomic.AddUint64(&s.stats.TotMemMergeDone, 1)
		if mergeTaskIntroStatus.skipped {
			// decrement the ref counts on skipping introduction.
			_ = newSnapshot.Close()
			_ = seg.Close()
			newSnapshot = nil
		}
	}
	return newSnapshot, newSegmentID, nil
}

func (s *Writer) merge(segments []segment.Segment, drops []*roaring.Bitmap, id uint64) (
	[][]uint64, error) {
	merger := s.segPlugin.Merge(segments, drops, s.config.MergeBufferSize)

	err := s.directory.Persist(ItemKindSegment, id, merger, s.closeCh)
	if err != nil {
		return nil, err
	}

	return merger.DocumentNumbers(), nil
}
