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
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/blevesearch/bleve/v2/index/scorch/mergeplan"
	"github.com/blevesearch/bleve/v2/util"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

const merger = "merger"

func (s *Scorch) mergerLoop() {
	defer func() {
		if r := recover(); r != nil {
			s.fireAsyncError(NewScorchError(
				merger,
				fmt.Sprintf("panic: %v, path: %s", r, s.path),
				ErrAsyncPanic,
			))
		}

		s.asyncTasks.Done()
	}()

	var lastEpochMergePlanned uint64
	var ctrlMsg *mergerCtrl
	mergePlannerOptions, err := s.parseMergePlannerOptions()
	if err != nil {
		s.fireAsyncError(NewScorchError(
			merger,
			fmt.Sprintf("mergerPlannerOptions json parsing err: %v", err),
			ErrOptionsParse,
		))
		return
	}
	ctrlMsgDflt := &mergerCtrl{ctx: context.Background(),
		options: mergePlannerOptions,
		doneCh:  nil}

OUTER:
	for {
		atomic.AddUint64(&s.stats.TotFileMergeLoopBeg, 1)

		select {
		case <-s.closeCh:
			break OUTER

		default:
			// check to see if there is a new snapshot to persist
			s.rootLock.Lock()
			ourSnapshot := s.root
			ourSnapshot.AddRef()
			atomic.StoreUint64(&s.iStats.mergeSnapshotSize, uint64(ourSnapshot.Size()))
			atomic.StoreUint64(&s.iStats.mergeEpoch, ourSnapshot.epoch)
			s.rootLock.Unlock()

			if ctrlMsg == nil && ourSnapshot.epoch != lastEpochMergePlanned {
				ctrlMsg = ctrlMsgDflt
			}
			if ctrlMsg != nil {
				continueMerge := s.fireEvent(EventKindPreMergeCheck, 0)
				// The default, if there's no handler, is to continue the merge.
				if !continueMerge {
					// If it's decided that this merge can't take place now,
					// begin the merge process all over again.
					// Retry instead of blocking/waiting here since a long wait
					// can result in more segments introduced i.e. s.root will
					// be updated.

					// decrement the ref count since its no longer needed in this
					// iteration
					_ = ourSnapshot.DecRef()
					continue OUTER
				}

				startTime := time.Now()

				// lets get started
				err := s.planMergeAtSnapshot(ctrlMsg.ctx, ctrlMsg.options,
					ourSnapshot)
				if err != nil {
					atomic.StoreUint64(&s.iStats.mergeEpoch, 0)
					if err == segment.ErrClosed {
						// index has been closed
						_ = ourSnapshot.DecRef()

						// continue the workloop on a user triggered cancel
						if ctrlMsg.doneCh != nil {
							close(ctrlMsg.doneCh)
							ctrlMsg = nil
							continue OUTER
						}

						// exit the workloop on index closure
						ctrlMsg = nil
						break OUTER
					}

					s.fireAsyncError(NewScorchError(
						merger,
						fmt.Sprintf("merging err: %v", err),
						ErrPersist,
					))
					_ = ourSnapshot.DecRef()
					atomic.AddUint64(&s.stats.TotFileMergeLoopErr, 1)
					continue OUTER
				}

				if ctrlMsg.doneCh != nil {
					close(ctrlMsg.doneCh)
				}
				ctrlMsg = nil

				lastEpochMergePlanned = ourSnapshot.epoch

				atomic.StoreUint64(&s.stats.LastMergedEpoch, ourSnapshot.epoch)

				s.fireEvent(EventKindMergerProgress, time.Since(startTime))
			}
			_ = ourSnapshot.DecRef()

			// tell the persister we're waiting for changes
			// first make a epochWatcher chan
			ew := &epochWatcher{
				epoch:    lastEpochMergePlanned,
				notifyCh: make(notificationChan, 1),
			}

			// give it to the persister
			select {
			case <-s.closeCh:
				break OUTER
			case s.persisterNotifier <- ew:
			case ctrlMsg = <-s.forceMergeRequestCh:
				continue OUTER
			}

			// now wait for persister (but also detect close)
			select {
			case <-s.closeCh:
				break OUTER
			case <-ew.notifyCh:
			case ctrlMsg = <-s.forceMergeRequestCh:
			}
		}

		atomic.AddUint64(&s.stats.TotFileMergeLoopEnd, 1)
	}
}

type mergerCtrl struct {
	ctx     context.Context
	options *mergeplan.MergePlanOptions
	doneCh  chan struct{}
}

// ForceMerge helps users trigger a merge operation on
// an online scorch index.
func (s *Scorch) ForceMerge(ctx context.Context,
	mo *mergeplan.MergePlanOptions) error {
	// check whether force merge is already under processing
	s.rootLock.Lock()
	if s.stats.TotFileMergeForceOpsStarted >
		s.stats.TotFileMergeForceOpsCompleted {
		s.rootLock.Unlock()
		return fmt.Errorf("force merge already in progress")
	}

	s.stats.TotFileMergeForceOpsStarted++
	s.rootLock.Unlock()

	if mo != nil {
		err := mergeplan.ValidateMergePlannerOptions(mo)
		if err != nil {
			return err
		}
	} else {
		// assume the default single segment merge policy
		mo = &mergeplan.SingleSegmentMergePlanOptions
	}
	msg := &mergerCtrl{options: mo,
		doneCh: make(chan struct{}),
		ctx:    ctx,
	}

	// request the merger perform a force merge
	select {
	case s.forceMergeRequestCh <- msg:
	case <-s.closeCh:
		return nil
	}

	// wait for the force merge operation completion
	select {
	case <-msg.doneCh:
		atomic.AddUint64(&s.stats.TotFileMergeForceOpsCompleted, 1)
	case <-s.closeCh:
	}

	return nil
}

func (s *Scorch) parseMergePlannerOptions() (*mergeplan.MergePlanOptions,
	error) {
	mergePlannerOptions := mergeplan.DefaultMergePlanOptions

	po, err := s.parsePersisterOptions()
	if err != nil {
		return nil, err
	}
	// by default use the MaxSizeInMemoryMergePerWorker from the persister option
	// as the FloorSegmentFileSize for the merge planner which would be the
	// first tier size in the planning. If the value is 0, then we don't use the
	// file size in the planning.
	mergePlannerOptions.FloorSegmentFileSize = int64(po.MaxSizeInMemoryMergePerWorker)

	if v, ok := s.config["scorchMergePlanOptions"]; ok {
		b, err := util.MarshalJSON(v)
		if err != nil {
			return &mergePlannerOptions, err
		}

		err = util.UnmarshalJSON(b, &mergePlannerOptions)
		if err != nil {
			return &mergePlannerOptions, err
		}

		err = mergeplan.ValidateMergePlannerOptions(&mergePlannerOptions)
		if err != nil {
			return nil, err
		}
	}
	return &mergePlannerOptions, nil
}

type closeChWrapper struct {
	ch1      chan struct{}
	ctx      context.Context
	closeCh  chan struct{}
	cancelCh chan struct{}
}

func newCloseChWrapper(ch1 chan struct{},
	ctx context.Context) *closeChWrapper {
	return &closeChWrapper{
		ch1:      ch1,
		ctx:      ctx,
		closeCh:  make(chan struct{}),
		cancelCh: make(chan struct{}),
	}
}

func (w *closeChWrapper) close() {
	close(w.closeCh)
}

func (w *closeChWrapper) listen() {
	select {
	case <-w.ch1:
		close(w.cancelCh)
	case <-w.ctx.Done():
		close(w.cancelCh)
	case <-w.closeCh:
	}
}

func (s *Scorch) planMergeAtSnapshot(ctx context.Context,
	options *mergeplan.MergePlanOptions, ourSnapshot *IndexSnapshot) error {
	// build list of persisted segments in this snapshot
	var onlyPersistedSnapshots []mergeplan.Segment
	for _, segmentSnapshot := range ourSnapshot.segment {
		if _, ok := segmentSnapshot.segment.(segment.PersistedSegment); ok {
			onlyPersistedSnapshots = append(onlyPersistedSnapshots, segmentSnapshot)
		}
	}

	atomic.AddUint64(&s.stats.TotFileMergePlan, 1)

	// give this list to the planner
	resultMergePlan, err := mergeplan.Plan(onlyPersistedSnapshots, options)
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
	var filenames []string

	cw := newCloseChWrapper(s.closeCh, ctx)
	defer cw.close()

	go cw.listen()

	for _, task := range resultMergePlan.Tasks {
		if len(task.Segments) == 0 {
			atomic.AddUint64(&s.stats.TotFileMergePlanTasksSegmentsEmpty, 1)
			continue
		}

		atomic.AddUint64(&s.stats.TotFileMergePlanTasksSegments, uint64(len(task.Segments)))

		oldMap := make(map[uint64]*SegmentSnapshot, len(task.Segments))
		newSegmentID := atomic.AddUint64(&s.nextSegmentID, 1)
		segmentsToMerge := make([]segment.Segment, 0, len(task.Segments))
		docsToDrop := make([]*roaring.Bitmap, 0, len(task.Segments))
		mergedSegHistory := make(map[uint64]*mergedSegmentHistory, len(task.Segments))

		for _, planSegment := range task.Segments {
			if segSnapshot, ok := planSegment.(*SegmentSnapshot); ok {
				oldMap[segSnapshot.id] = segSnapshot
				mergedSegHistory[segSnapshot.id] = &mergedSegmentHistory{
					workerID:   0,
					oldSegment: segSnapshot,
				}
				if persistedSeg, ok := segSnapshot.segment.(segment.PersistedSegment); ok {
					if segSnapshot.LiveSize() == 0 {
						atomic.AddUint64(&s.stats.TotFileMergeSegmentsEmpty, 1)
						oldMap[segSnapshot.id] = nil
						delete(mergedSegHistory, segSnapshot.id)
					} else {
						segmentsToMerge = append(segmentsToMerge, segSnapshot.segment)
						docsToDrop = append(docsToDrop, segSnapshot.deleted)
					}
					// track the files getting merged for unsetting the
					// removal ineligibility. This helps to unflip files
					// even with fast merger, slow persister work flows.
					path := persistedSeg.Path()
					filenames = append(filenames,
						strings.TrimPrefix(path, s.path+string(os.PathSeparator)))
				}
			}
		}

		var seg segment.Segment
		var filename string
		if len(segmentsToMerge) > 0 {
			filename = zapFileName(newSegmentID)
			s.markIneligibleForRemoval(filename)
			path := s.path + string(os.PathSeparator) + filename

			fileMergeZapStartTime := time.Now()

			atomic.AddUint64(&s.stats.TotFileMergeZapBeg, 1)
			prevBytesReadTotal := cumulateBytesRead(segmentsToMerge)
			newDocNums, _, err := s.segPlugin.Merge(segmentsToMerge, docsToDrop, path,
				cw.cancelCh, s)
			atomic.AddUint64(&s.stats.TotFileMergeZapEnd, 1)

			fileMergeZapTime := uint64(time.Since(fileMergeZapStartTime))
			atomic.AddUint64(&s.stats.TotFileMergeZapTime, fileMergeZapTime)
			if atomic.LoadUint64(&s.stats.MaxFileMergeZapTime) < fileMergeZapTime {
				atomic.StoreUint64(&s.stats.MaxFileMergeZapTime, fileMergeZapTime)
			}

			if err != nil {
				s.unmarkIneligibleForRemoval(filename)
				atomic.AddUint64(&s.stats.TotFileMergePlanTasksErr, 1)
				if err == segment.ErrClosed {
					return err
				}
				return fmt.Errorf("merging failed: %v", err)
			}

			seg, err = s.segPlugin.Open(path)
			if err != nil {
				s.unmarkIneligibleForRemoval(filename)
				atomic.AddUint64(&s.stats.TotFileMergePlanTasksErr, 1)
				return err
			}

			totalBytesRead := seg.BytesRead() + prevBytesReadTotal
			seg.ResetBytesRead(totalBytesRead)

			for i, segNewDocNums := range newDocNums {
				if mergedSegHistory[task.Segments[i].Id()] != nil {
					mergedSegHistory[task.Segments[i].Id()].oldNewDocIDs = segNewDocNums
				}
			}

			atomic.AddUint64(&s.stats.TotFileMergeSegments, uint64(len(segmentsToMerge)))
		}

		sm := &segmentMerge{
			id:               []uint64{newSegmentID},
			mergedSegHistory: mergedSegHistory,
			new:              []segment.Segment{seg},
			newCount:         seg.Count(),
			notifyCh:         make(chan *mergeTaskIntroStatus),
			mmaped:           1,
		}

		s.fireEvent(EventKindMergeTaskIntroductionStart, 0)

		// give it to the introducer
		select {
		case <-s.closeCh:
			_ = seg.Close()
			return segment.ErrClosed
		case s.merges <- sm:
			atomic.AddUint64(&s.stats.TotFileMergeIntroductions, 1)
		}

		introStartTime := time.Now()
		// it is safe to blockingly wait for the merge introduction
		// here as the introducer is bound to handle the notify channel.
		introStatus := <-sm.notifyCh
		introTime := uint64(time.Since(introStartTime))
		atomic.AddUint64(&s.stats.TotFileMergeZapIntroductionTime, introTime)
		if atomic.LoadUint64(&s.stats.MaxFileMergeZapIntroductionTime) < introTime {
			atomic.StoreUint64(&s.stats.MaxFileMergeZapIntroductionTime, introTime)
		}
		atomic.AddUint64(&s.stats.TotFileMergeIntroductionsDone, 1)
		if introStatus != nil && introStatus.indexSnapshot != nil {
			_ = introStatus.indexSnapshot.DecRef()
			if introStatus.skipped {
				// close the segment on skipping introduction.
				s.unmarkIneligibleForRemoval(filename)
				_ = seg.Close()
			}
		}

		atomic.AddUint64(&s.stats.TotFileMergePlanTasksDone, 1)

		s.fireEvent(EventKindMergeTaskIntroduction, 0)
	}

	// once all the newly merged segment introductions are done,
	// its safe to unflip the removal ineligibility for the replaced
	// older segments
	for _, f := range filenames {
		s.unmarkIneligibleForRemoval(f)
	}

	return nil
}

type mergeTaskIntroStatus struct {
	indexSnapshot *IndexSnapshot
	skipped       bool
}

// this is important when it comes to introducing multiple merged segments in a
// single introducer channel push. That way there is a check to ensure that the
// file count doesn't explode during the index's lifetime.
type mergedSegmentHistory struct {
	workerID     uint64
	oldNewDocIDs []uint64
	oldSegment   *SegmentSnapshot
}

type segmentMerge struct {
	id               []uint64
	new              []segment.Segment
	mergedSegHistory map[uint64]*mergedSegmentHistory
	notifyCh         chan *mergeTaskIntroStatus
	mmaped           uint32
	newCount         uint64
}

func cumulateBytesRead(sbs []segment.Segment) uint64 {
	var rv uint64
	for _, seg := range sbs {
		rv += seg.BytesRead()
	}
	return rv
}

func closeNewMergedSegments(segs []segment.Segment) error {
	for _, seg := range segs {
		if seg != nil {
			_ = seg.DecRef()
		}
	}
	return nil
}

// mergeAndPersistInMemorySegments takes an IndexSnapshot and a list of in-memory segments,
// which are merged and persisted to disk concurrently. These are then introduced as
// the new root snapshot in one-shot.
func (s *Scorch) mergeAndPersistInMemorySegments(snapshot *IndexSnapshot,
	flushableObjs []*flushable) (*IndexSnapshot, []uint64, error) {
	atomic.AddUint64(&s.stats.TotMemMergeBeg, 1)

	memMergeZapStartTime := time.Now()

	atomic.AddUint64(&s.stats.TotMemMergeZapBeg, 1)

	var wg sync.WaitGroup
	// we're tracking the merged segments and their doc number per worker
	// to be able to introduce them all at once, so the first dimension of the
	// slices here correspond to workerID
	newDocIDsSet := make([][][]uint64, len(flushableObjs))
	newMergedSegments := make([]segment.Segment, len(flushableObjs))
	newMergedSegmentIDs := make([]uint64, len(flushableObjs))
	numFlushes := len(flushableObjs)
	var numSegments, newMergedCount uint64
	var em sync.Mutex
	var errs []error

	// deploy the workers to merge and flush the batches of segments concurrently
	// and create a new file segment
	for i := 0; i < numFlushes; i++ {
		wg.Add(1)
		go func(segsBatch []segment.Segment, dropsBatch []*roaring.Bitmap, id int) {
			defer wg.Done()
			newSegmentID := atomic.AddUint64(&s.nextSegmentID, 1)
			filename := zapFileName(newSegmentID)
			path := s.path + string(os.PathSeparator) + filename

			// the newly merged segment is already flushed out to disk, just needs
			// to be opened using mmap.
			newDocIDs, _, err :=
				s.segPlugin.Merge(segsBatch, dropsBatch, path, s.closeCh, s)
			if err != nil {
				em.Lock()
				errs = append(errs, err)
				em.Unlock()
				atomic.AddUint64(&s.stats.TotMemMergeErr, 1)
				return
			}
			// to prevent accidental cleanup of this newly created file, mark it
			// as ineligible for removal. this will be flipped back when the bolt
			// is updated - which is valid, since the snapshot updated in bolt is
			// cleaned up only if its zero ref'd (MB-66163 for more details)
			s.markIneligibleForRemoval(filename)
			newMergedSegmentIDs[id] = newSegmentID
			newDocIDsSet[id] = newDocIDs
			newMergedSegments[id], err = s.segPlugin.Open(path)
			if err != nil {
				em.Lock()
				errs = append(errs, err)
				em.Unlock()
				atomic.AddUint64(&s.stats.TotMemMergeErr, 1)
				return
			}
			atomic.AddUint64(&newMergedCount, newMergedSegments[id].Count())
			atomic.AddUint64(&numSegments, uint64(len(segsBatch)))
		}(flushableObjs[i].segments, flushableObjs[i].drops, i)
	}
	wg.Wait()

	if errs != nil {
		// close the new merged segments
		_ = closeNewMergedSegments(newMergedSegments)
		var errf error
		for _, err := range errs {
			if err == segment.ErrClosed {
				// the index snapshot was closed which will be handled gracefully
				// by retrying the whole merge+flush operation in a later iteration
				// so its safe to early exit the same error.
				return nil, nil, err
			}
			errf = fmt.Errorf("%w; %v", errf, err)
		}
		return nil, nil, errf
	}

	atomic.AddUint64(&s.stats.TotMemMergeZapEnd, 1)

	memMergeZapTime := uint64(time.Since(memMergeZapStartTime))
	atomic.AddUint64(&s.stats.TotMemMergeZapTime, memMergeZapTime)
	if atomic.LoadUint64(&s.stats.MaxMemMergeZapTime) < memMergeZapTime {
		atomic.StoreUint64(&s.stats.MaxMemMergeZapTime, memMergeZapTime)
	}

	// update the segmentMerge task with the newly merged + flushed segments which
	// are to be introduced atomically.
	sm := &segmentMerge{
		id:               newMergedSegmentIDs,
		new:              newMergedSegments,
		mergedSegHistory: make(map[uint64]*mergedSegmentHistory, numSegments),
		notifyCh:         make(chan *mergeTaskIntroStatus),
		newCount:         newMergedCount,
	}

	// create a history map which maps the old in-memory segments with the specific
	// persister worker (also the specific file segment its going to be part of)
	// which flushed it out. This map will be used on the introducer side to out-ref
	// the in-memory segments and also track the new tombstones if present.
	for i, flushable := range flushableObjs {
		for j, idx := range flushable.sbIdxs {
			ss := snapshot.segment[idx]
			// oldSegmentSnapshot.id -> {workerID, oldSegmentSnapshot, docIDs}
			sm.mergedSegHistory[ss.id] = &mergedSegmentHistory{
				workerID:     uint64(i),
				oldNewDocIDs: newDocIDsSet[i][j],
				oldSegment:   ss,
			}
		}
	}

	select { // send to introducer
	case <-s.closeCh:
		_ = closeNewMergedSegments(newMergedSegments)
		return nil, nil, segment.ErrClosed
	case s.merges <- sm:
	}

	// blockingly wait for the introduction to complete
	var newSnapshot *IndexSnapshot
	introStatus := <-sm.notifyCh
	if introStatus != nil && introStatus.indexSnapshot != nil {
		newSnapshot = introStatus.indexSnapshot
		atomic.AddUint64(&s.stats.TotMemMergeSegments, uint64(numSegments))
		atomic.AddUint64(&s.stats.TotMemMergeDone, 1)
		if introStatus.skipped {
			// close the segment on skipping introduction.
			_ = newSnapshot.DecRef()
			_ = closeNewMergedSegments(newMergedSegments)
			newSnapshot = nil
		}
	}

	return newSnapshot, newMergedSegmentIDs, nil
}

func (s *Scorch) ReportBytesWritten(bytesWritten uint64) {
	atomic.AddUint64(&s.stats.TotFileMergeWrittenBytes, bytesWritten)
}
