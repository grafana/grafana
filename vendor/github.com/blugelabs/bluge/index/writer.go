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
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"sync"
	"sync/atomic"
	"time"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/RoaringBitmap/roaring"
)

type Writer struct {
	stats Stats

	// state
	nextSegmentID uint64

	config         Config
	deletionPolicy DeletionPolicy
	directory      Directory
	segPlugin      *SegmentPlugin // segment plug-in in use

	rootLock sync.RWMutex
	root     *Snapshot // holds 1 ref-count on the root

	introductions chan *segmentIntroduction

	rootPersisted      []chan error // closed when root is persisted
	persistedCallbacks []func(error)

	// control/track goroutines
	closeCh    chan struct{}
	asyncTasks sync.WaitGroup

	closeOnce sync.Once
}

func OpenWriter(config Config) (*Writer, error) {
	rv := &Writer{
		config:         config,
		deletionPolicy: config.DeletionPolicyFunc(),
		directory:      config.DirectoryFunc(),
		closeCh:        make(chan struct{}),
	}

	// start the requested number of analysis workers
	for i := 0; i < config.NumAnalysisWorkers; i++ {
		config.GoFunc(func() {
			analysisWorker(config.AnalysisChan, rv.closeCh)
		})
	}

	var err error
	rv.segPlugin, err = loadSegmentPlugin(config.supportedSegmentPlugins, config.SegmentType, config.SegmentVersion)
	if err != nil {
		return nil, fmt.Errorf("error loading segment plugin: %v", err)
	}

	rv.root = &Snapshot{
		parent:  rv,
		refs:    1,
		creator: "NewChill",
	}

	err = rv.directory.Setup(false)
	if err != nil {
		return nil, fmt.Errorf("error setting up directory: %w", err)
	}

	err = rv.directory.Lock()
	if err != nil {
		return nil, fmt.Errorf("error getting exclusive access to diretory: %w", err)
	}

	lastPersistedEpoch, nextSnapshotEpoch, err2 := rv.loadSnapshots()
	if err2 != nil {
		_ = rv.Close()
		return nil, err2
	}

	// initialize nextSegmentID to a safe value
	existingSegments, err := rv.directory.List(ItemKindSegment)
	if err != nil {
		_ = rv.Close()
		return nil, err
	}
	if len(existingSegments) > 0 {
		rv.nextSegmentID = existingSegments[0]
	}
	rv.nextSegmentID++

	// give deletion policy an opportunity to cleanup now before we begin
	err = rv.deletionPolicy.Cleanup(rv.directory)
	if err != nil {
		_ = rv.Close()
		return nil, fmt.Errorf("error cleaning up on open: %v", err)
	}

	rv.introductions = make(chan *segmentIntroduction)
	persistsCh := make(chan *persistIntroduction)
	mergesCh := make(chan *segmentMerge)
	introducerNotifier := make(watcherChan, 1)
	persistNotifier := make(watcherChan, 1)

	// start async tasks
	rv.asyncTasks.Add(1)
	go rv.introducerLoop(rv.introductions, persistsCh, mergesCh, introducerNotifier, nextSnapshotEpoch)
	rv.asyncTasks.Add(1)
	go rv.persisterLoop(mergesCh, persistsCh, introducerNotifier, persistNotifier, lastPersistedEpoch)
	rv.asyncTasks.Add(1)
	go rv.mergerLoop(mergesCh, persistNotifier)

	return rv, nil
}

func (s *Writer) loadSnapshots() (lastPersistedEpoch, nextSnapshotEpoch uint64, err error) {
	nextSnapshotEpoch = 1
	snapshotEpochs, err := s.directory.List(ItemKindSnapshot)
	if err != nil {
		return 0, 0, err
	}

	// try and load each snapshot seen
	var snapshotsFound, snapshotLoaded bool
	// walk snapshots backwards (oldest to newest)
	// this allows the deletion policy see each snapshot
	// in the order it was created
	for i := len(snapshotEpochs) - 1; i >= 0; i-- {
		snapshotEpoch := snapshotEpochs[i]
		snapshotsFound = true
		var indexSnapshot *Snapshot
		indexSnapshot, err = s.loadSnapshot(snapshotEpoch)
		if err != nil {
			log.Printf("error loading snapshot epoch: %d: %v", snapshotEpoch, err)
			// but keep going and hope there is another newer snapshot that works
			continue
		}
		snapshotLoaded = true

		lastPersistedEpoch = indexSnapshot.epoch
		nextSnapshotEpoch = indexSnapshot.epoch + 1

		// inform the deletion policy about this commit
		s.deletionPolicy.Commit(indexSnapshot)

		// make this snapshot the root (and retire the previous)
		atomic.StoreUint64(&s.stats.TotFileSegmentsAtRoot, uint64(len(indexSnapshot.segment)))
		s.replaceRoot(indexSnapshot, nil, nil)
	}
	if snapshotsFound && !snapshotLoaded {
		// handle this case better, there was at least one snapshot on disk
		// but we failed to successfully load anything
		// this results in losing all data and starting from scratch
		// should require, some more explicit decision, for now error out
		return 0, 0, fmt.Errorf("existing snapshots found, but none could be loaded, exiting")
	}
	return lastPersistedEpoch, nextSnapshotEpoch, nil
}

func (s *Writer) fireEvent(kind int, dur time.Duration) {
	if s.config.EventCallback != nil {
		atomic.AddUint64(&s.stats.TotEventFired, 1)
		s.config.EventCallback(Event{Kind: kind, Chill: s, Duration: dur})
		atomic.AddUint64(&s.stats.TotEventReturned, 1)
	}
}

func (s *Writer) fireAsyncError(err error) {
	if s.config.AsyncError != nil {
		s.config.AsyncError(err)
	}
	atomic.AddUint64(&s.stats.TotOnErrors, 1)
}

func (s *Writer) Close() (err error) {
	s.closeOnce.Do(func() {
		err = s.close()
	})
	return err
}

func (s *Writer) close() (err error) {
	startTime := time.Now()
	defer func() {
		s.fireEvent(EventKindClose, time.Since(startTime))
	}()

	s.fireEvent(EventKindCloseStart, 0)

	// signal to async tasks we want to close
	close(s.closeCh)
	// wait for them to close
	s.asyncTasks.Wait()

	s.replaceRoot(nil, nil, nil)

	err = s.directory.Unlock()
	if err != nil {
		return err
	}

	return nil
}

// Batch applies a batch of changes to the index atomically
func (s *Writer) Batch(batch *Batch) (err error) {
	start := time.Now()

	defer func() {
		s.fireEvent(EventKindBatchIntroduction, time.Since(start))
	}()

	var numUpdates = len(batch.documents)
	var numDeletes = len(batch.ids)

	var allDocsAnalyzed sync.WaitGroup

	for _, doc := range batch.documents {
		allDocsAnalyzed.Add(1)
		doc := doc // capture variable
		if doc != nil {
			aw := func() {
				doc.Analyze()
				allDocsAnalyzed.Done()
			}
			// put the work on the queue
			s.config.AnalysisChan <- aw
		}
	}

	allDocsAnalyzed.Wait()

	atomic.AddUint64(&s.stats.TotAnalysisTime, uint64(time.Since(start)))

	indexStart := time.Now()

	// notify handlers that we're about to introduce a segment
	s.fireEvent(EventKindBatchIntroductionStart, 0)

	var newSegment *segmentWrapper
	var bufBytes uint64
	if numUpdates > 0 {
		newSegment, bufBytes, err = s.newSegment(batch.documents)
		if err != nil {
			return err
		}
		atomic.AddUint64(&s.stats.newSegBufBytesAdded, bufBytes)
	} else {
		atomic.AddUint64(&s.stats.TotBatchesEmpty, 1)
	}

	err = s.prepareSegment(newSegment, batch.ids, nil, batch.PersistedCallback())
	if err != nil {
		if newSegment != nil {
			_ = newSegment.Close()
		}
		atomic.AddUint64(&s.stats.TotOnErrors, 1)
	} else {
		atomic.AddUint64(&s.stats.TotUpdates, uint64(numUpdates))
		atomic.AddUint64(&s.stats.TotDeletes, uint64(numDeletes))
		atomic.AddUint64(&s.stats.TotBatches, 1)
	}

	atomic.AddUint64(&s.stats.newSegBufBytesRemoved, bufBytes)
	atomic.AddUint64(&s.stats.TotIndexTime, uint64(time.Since(indexStart)))

	return err
}

func (s *Writer) prepareSegment(newSegment *segmentWrapper, idTerms []segment.Term,
	internalOps map[string][]byte, persistedCallback func(error)) error {
	// new introduction
	introduction := &segmentIntroduction{
		id:                atomic.AddUint64(&s.nextSegmentID, 1),
		data:              newSegment,
		idTerms:           idTerms,
		obsoletes:         make(map[uint64]*roaring.Bitmap),
		internal:          internalOps,
		applied:           make(chan error),
		persistedCallback: persistedCallback,
	}

	if !s.config.UnsafeBatch {
		introduction.persisted = make(chan error, 1)
	}

	// optimistically prepare obsoletes outside of rootLock
	root := s.currentSnapshot()
	defer func() { _ = root.Close() }()

	for _, seg := range root.segment {
		delta, err := seg.segment.DocsMatchingTerms(idTerms)
		if err != nil {
			return err
		}
		introduction.obsoletes[seg.id] = delta
	}

	introStartTime := time.Now()

	s.introductions <- introduction

	// block until this segment is applied
	err := <-introduction.applied
	if err != nil {
		return err
	}

	if introduction.persisted != nil {
		err = <-introduction.persisted
	}

	introTime := uint64(time.Since(introStartTime))
	atomic.AddUint64(&s.stats.TotBatchIntroTime, introTime)
	if atomic.LoadUint64(&s.stats.MaxBatchIntroTime) < introTime {
		atomic.StoreUint64(&s.stats.MaxBatchIntroTime, introTime)
	}

	return err
}

// Reader returns a low-level accessor on the index data. Close it to
// release associated resources.
func (s *Writer) Reader() (*Snapshot, error) {
	return s.currentSnapshot(), nil
}

func (s *Writer) MemoryUsed() (memUsed uint64) {
	indexSnapshot := s.currentSnapshot()
	if indexSnapshot == nil {
		return
	}

	defer func() {
		_ = indexSnapshot.Close()
	}()

	// Account for current root snapshot overhead
	memUsed += uint64(indexSnapshot.Size())

	// Account for snapshot that the persister may be working on
	persistEpoch := atomic.LoadUint64(&s.stats.persistEpoch)
	persistSnapshotSize := atomic.LoadUint64(&s.stats.persistSnapshotSize)
	if persistEpoch != 0 && indexSnapshot.epoch > persistEpoch {
		// the snapshot that the persister is working on isn't the same as
		// the current snapshot
		memUsed += persistSnapshotSize
	}

	// Account for snapshot that the merger may be working on
	mergeEpoch := atomic.LoadUint64(&s.stats.mergeEpoch)
	mergeSnapshotSize := atomic.LoadUint64(&s.stats.mergeSnapshotSize)
	if mergeEpoch != 0 && indexSnapshot.epoch > mergeEpoch {
		// the snapshot that the merger is working on isn't the same as
		// the current snapshot
		memUsed += mergeSnapshotSize
	}

	memUsed += atomic.LoadUint64(&s.stats.newSegBufBytesAdded) -
		atomic.LoadUint64(&s.stats.newSegBufBytesRemoved)

	memUsed += atomic.LoadUint64(&s.stats.analysisBytesAdded) -
		atomic.LoadUint64(&s.stats.analysisBytesRemoved)

	return memUsed
}

func (s *Writer) currentSnapshot() *Snapshot {
	s.rootLock.RLock()
	var rv *Snapshot
	if s.root != nil {
		rv = s.root
		if rv != nil {
			rv.addRef()
		}
	}
	s.rootLock.RUnlock()
	return rv
}

func (s *Writer) currentEpoch() uint64 {
	indexSnapshot := s.currentSnapshot()
	var rv uint64
	if indexSnapshot != nil {
		rv = indexSnapshot.epoch
		_ = indexSnapshot.Close()
	}
	return rv
}

func OpenReader(config Config) (*Snapshot, error) {
	parent := &Writer{
		config:    config,
		directory: config.DirectoryFunc(),
	}

	var err error
	parent.segPlugin, err = loadSegmentPlugin(config.supportedSegmentPlugins,
		config.SegmentType, config.SegmentVersion)
	if err != nil {
		return nil, fmt.Errorf("error loadign segment plugin: %v", err)
	}

	err = parent.directory.Setup(true)
	if err != nil {
		return nil, fmt.Errorf("error setting up directory: %w", err)
	}

	snapshotEpochs, err := parent.directory.List(ItemKindSnapshot)
	if err != nil {
		return nil, err
	}

	// start with most recent
	var indexSnapshot *Snapshot
	for _, snapshotEpoch := range snapshotEpochs {
		indexSnapshot, err = parent.loadSnapshot(snapshotEpoch)
		if err != nil {
			log.Printf("error loading snapshot epoch: %d: %v", snapshotEpoch, err)
			// but keep going and hope there is another newer snapshot that works
			continue
		}
		break
	}
	if indexSnapshot == nil {
		return nil, fmt.Errorf("unable to find a usable snapshot")
	}

	return indexSnapshot, nil
}

func (s *Writer) loadSnapshot(epoch uint64) (*Snapshot, error) {
	snapshot := &Snapshot{
		parent:  s,
		epoch:   epoch,
		refs:    1,
		creator: "loadSnapshot",
	}

	data, closer, err := s.directory.Load(ItemKindSnapshot, epoch)
	if err != nil {
		return nil, err
	}

	// wrap the reader so we never read the last 4 bytes (CRC)
	dataReader := io.LimitReader(data.Reader(), int64(data.Len()-crcWidth))
	var crcReader *countHashReader
	if s.config.ValidateSnapshotCRC {
		crcReader = newCountHashReader(dataReader)
		dataReader = crcReader
	}

	_, err = snapshot.ReadFrom(dataReader)
	if err != nil {
		if closer != nil {
			_ = closer.Close()
		}
		return nil, err
	}

	if crcReader != nil {
		computedCRCBytes := make([]byte, crcWidth)
		binary.BigEndian.PutUint32(computedCRCBytes, crcReader.Sum32())
		var fileCRCBytes []byte
		fileCRCBytes, err = data.Read(data.Len()-crcWidth, data.Len())
		if err != nil {
			if closer != nil {
				_ = closer.Close()
			}
			return nil, fmt.Errorf("error reading snapshot CRC: %w", err)
		}
		if !bytes.Equal(computedCRCBytes, fileCRCBytes) {
			if closer != nil {
				_ = closer.Close()
			}
			return nil, fmt.Errorf("CRC mismatch loading snapshot %d: computed: %x file: %x",
				epoch, computedCRCBytes, fileCRCBytes)
		}
	}
	if closer != nil {
		err = closer.Close()
		if err != nil {
			return nil, err
		}
	}

	var running uint64
	for _, segSnapshot := range snapshot.segment {
		segPlugin, err := loadSegmentPlugin(s.config.supportedSegmentPlugins, segSnapshot.segmentType, segSnapshot.segmentVersion)
		if err != nil {
			return nil, fmt.Errorf("error loading required segment plugin: %v", err)
		}
		segSnapshot.segment, err = s.loadSegment(segSnapshot.id, segPlugin)
		if err != nil {
			return nil, fmt.Errorf("error opening segment %d: %w", segSnapshot.id, err)
		}

		snapshot.offsets = append(snapshot.offsets, running)
		running += segSnapshot.segment.Count()
	}

	return snapshot, nil
}

func (s *Writer) loadSegment(id uint64, plugin *SegmentPlugin) (*segmentWrapper, error) {
	data, closer, err := s.directory.Load(ItemKindSegment, id)
	if err != nil {
		return nil, fmt.Errorf("error loading segment fromt directory: %v", err)
	}
	seg, err := plugin.Load(data)
	if err != nil {
		if closer != nil {
			_ = closer.Close()
		}
		return nil, fmt.Errorf("error loading segment: %v", err)
	}
	return &segmentWrapper{
		Segment: seg,
		refCounter: &closeOnLastRefCounter{
			closer: closer,
			refs:   1,
		},
		persisted: true,
	}, nil
}

func analysisWorker(q chan func(), closeCh chan struct{}) {
	for {
		select {
		case <-closeCh:
			return
		case w := <-q:
			w()
		}
	}
}
