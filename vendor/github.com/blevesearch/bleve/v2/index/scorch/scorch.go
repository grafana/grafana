//  Copyright (c) 2018 Couchbase, Inc.
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
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	bolt "go.etcd.io/bbolt"
)

const Name = "scorch"

const Version uint8 = 2

var ErrClosed = fmt.Errorf("scorch closed")

type Scorch struct {
	nextSegmentID uint64
	stats         Stats
	iStats        internalStats

	readOnly      bool
	version       uint8
	config        map[string]interface{}
	analysisQueue *index.AnalysisQueue
	path          string

	unsafeBatch bool

	rootLock sync.RWMutex

	root                 *IndexSnapshot // holds 1 ref-count on the root
	rootPersisted        []chan error   // closed when root is persisted
	persistedCallbacks   []index.BatchCallback
	nextSnapshotEpoch    uint64
	eligibleForRemoval   []uint64        // Index snapshot epochs that are safe to GC.
	ineligibleForRemoval map[string]bool // Filenames that should not be GC'ed yet.

	// keeps track of segments scheduled for online copy/backup operation. Each segment's filename maps to
	// the count of copy schedules. Segments with non-zero counts are protected from removal by the cleanup
	// operation. Counts decrement upon successful copy, allowing removal of segments with zero or absent counts.
	// must be accessed within the rootLock as it is accessed by the asynchronous cleanup routine.
	copyScheduled map[string]int

	numSnapshotsToKeep       int
	rollbackRetentionFactor  float64
	checkPoints              []*snapshotMetaData
	rollbackSamplingInterval time.Duration
	closeCh                  chan struct{}
	introductions            chan *segmentIntroduction
	persists                 chan *persistIntroduction
	merges                   chan *segmentMerge
	introducerNotifier       chan *epochWatcher
	persisterNotifier        chan *epochWatcher
	rootBolt                 *bolt.DB
	asyncTasks               sync.WaitGroup

	onEvent      func(event Event) bool
	onAsyncError func(err error, path string)

	forceMergeRequestCh chan *mergerCtrl

	segPlugin SegmentPlugin

	spatialPlugin index.SpatialAnalyzerPlugin
}

type ScorchErrorType string

func (t ScorchErrorType) Error() string {
	return string(t)
}

// ErrType values for ScorchError
const (
	ErrAsyncPanic   = ScorchErrorType("async panic error")
	ErrPersist      = ScorchErrorType("persist error")
	ErrCleanup      = ScorchErrorType("cleanup error")
	ErrOptionsParse = ScorchErrorType("options parse error")
)

// ScorchError is passed to onAsyncError when errors are
// fired from scorch background processes
type ScorchError struct {
	Source  string
	ErrMsg  string
	ErrType ScorchErrorType
}

func (e *ScorchError) Error() string {
	return fmt.Sprintf("source: %s, %v: %s", e.Source, e.ErrType, e.ErrMsg)
}

// Lets the onAsyncError function verify what type of
// error is fired using errors.Is(...). This lets the function
// handle errors differently.
func (e *ScorchError) Unwrap() error {
	return e.ErrType
}

func NewScorchError(source, errMsg string, errType ScorchErrorType) error {
	return &ScorchError{
		Source:  source,
		ErrMsg:  errMsg,
		ErrType: errType,
	}
}

type internalStats struct {
	persistEpoch          uint64
	persistSnapshotSize   uint64
	mergeEpoch            uint64
	mergeSnapshotSize     uint64
	newSegBufBytesAdded   uint64
	newSegBufBytesRemoved uint64
	analysisBytesAdded    uint64
	analysisBytesRemoved  uint64
}

func NewScorch(storeName string,
	config map[string]interface{},
	analysisQueue *index.AnalysisQueue,
) (index.Index, error) {
	rv := &Scorch{
		version:              Version,
		config:               config,
		analysisQueue:        analysisQueue,
		nextSnapshotEpoch:    1,
		closeCh:              make(chan struct{}),
		ineligibleForRemoval: map[string]bool{},
		forceMergeRequestCh:  make(chan *mergerCtrl, 1),
		segPlugin:            defaultSegmentPlugin,
		copyScheduled:        map[string]int{},
	}

	forcedSegmentType, forcedSegmentVersion, err := configForceSegmentTypeVersion(config)
	if err != nil {
		return nil, err
	}
	if forcedSegmentType != "" && forcedSegmentVersion != 0 {
		err := rv.loadSegmentPlugin(forcedSegmentType,
			uint32(forcedSegmentVersion))
		if err != nil {
			return nil, err
		}
	}

	typ, ok := config["spatialPlugin"].(string)
	if ok {
		if err := rv.loadSpatialAnalyzerPlugin(typ); err != nil {
			return nil, err
		}
	}

	rv.root = &IndexSnapshot{parent: rv, refs: 1, creator: "NewScorch"}
	ro, ok := config["read_only"].(bool)
	if ok {
		rv.readOnly = ro
	}
	ub, ok := config["unsafe_batch"].(bool)
	if ok {
		rv.unsafeBatch = ub
	}
	ecbName, ok := config["eventCallbackName"].(string)
	if ok {
		rv.onEvent = RegistryEventCallbacks[ecbName]
	}
	aecbName, ok := config["asyncErrorCallbackName"].(string)
	if ok {
		rv.onAsyncError = RegistryAsyncErrorCallbacks[aecbName]
	}
	// validate any custom persistor options to
	// prevent an async error in the persistor routine
	_, err = rv.parsePersisterOptions()
	if err != nil {
		return nil, err
	}
	// validate any custom merge planner options to
	// prevent an async error in the merger routine
	_, err = rv.parseMergePlannerOptions()
	if err != nil {
		return nil, err
	}

	return rv, nil
}

// configForceSegmentTypeVersion checks if the caller has requested a
// specific segment type/version
func configForceSegmentTypeVersion(config map[string]interface{}) (string, uint32, error) {
	forcedSegmentVersion, err := parseToInteger(config["forceSegmentVersion"])
	if err != nil {
		return "", 0, nil
	}

	forcedSegmentType, ok := config["forceSegmentType"].(string)
	if !ok {
		return "", 0, fmt.Errorf(
			"forceSegmentVersion set to %d, must also specify forceSegmentType", forcedSegmentVersion)
	}

	return forcedSegmentType, uint32(forcedSegmentVersion), nil
}

func (s *Scorch) NumEventsBlocking() uint64 {
	eventsCompleted := atomic.LoadUint64(&s.stats.TotEventTriggerCompleted)
	eventsStarted := atomic.LoadUint64(&s.stats.TotEventTriggerStarted)
	return eventsStarted - eventsCompleted
}

func (s *Scorch) fireEvent(kind EventKind, dur time.Duration) bool {
	res := true
	if s.onEvent != nil {
		atomic.AddUint64(&s.stats.TotEventTriggerStarted, 1)
		res = s.onEvent(Event{Kind: kind, Scorch: s, Duration: dur})
		atomic.AddUint64(&s.stats.TotEventTriggerCompleted, 1)
	}
	return res
}

func (s *Scorch) fireAsyncError(err error) {
	if s.onAsyncError != nil {
		s.onAsyncError(err, s.path)
	}
	atomic.AddUint64(&s.stats.TotOnErrors, 1)
}

func (s *Scorch) Open() error {
	if s.rootBolt == nil {
		err := s.openBolt()
		if err != nil {
			return err
		}
	}

	s.asyncTasks.Add(1)
	go s.introducerLoop()

	if !s.readOnly && s.path != "" {
		s.asyncTasks.Add(1)
		go s.persisterLoop()
		s.asyncTasks.Add(1)
		go s.mergerLoop()
	}

	return nil
}

func (s *Scorch) openBolt() error {
	var ok bool
	s.path, ok = s.config["path"].(string)
	if !ok {
		return fmt.Errorf("must specify path")
	}
	if s.path == "" {
		s.unsafeBatch = true
	}

	rootBoltOpt := *bolt.DefaultOptions
	if s.readOnly {
		rootBoltOpt.ReadOnly = true
		rootBoltOpt.OpenFile = func(path string, flag int, mode os.FileMode) (*os.File, error) {
			// Bolt appends an O_CREATE flag regardless.
			// See - https://github.com/etcd-io/bbolt/blob/v1.3.5/db.go#L210
			// Use os.O_RDONLY only if path exists (#1623)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				return os.OpenFile(path, flag, mode)
			}
			return os.OpenFile(path, os.O_RDONLY, mode)
		}
	} else {
		if s.path != "" {
			err := os.MkdirAll(s.path, 0o700)
			if err != nil {
				return err
			}
		}
	}

	if boltTimeoutStr, ok := s.config["bolt_timeout"].(string); ok {
		var err error
		boltTimeout, err := time.ParseDuration(boltTimeoutStr)
		if err != nil {
			return fmt.Errorf("invalid duration specified for bolt_timeout: %v", err)
		}
		rootBoltOpt.Timeout = boltTimeout
	}

	rootBoltPath := s.path + string(os.PathSeparator) + "root.bolt"
	var err error
	if s.path != "" {
		s.rootBolt, err = bolt.Open(rootBoltPath, 0o600, &rootBoltOpt)
		if err != nil {
			return err
		}

		// now see if there is any existing state to load
		err = s.loadFromBolt()
		if err != nil {
			_ = s.Close()
			return err
		}
	}

	atomic.StoreUint64(&s.stats.TotFileSegmentsAtRoot, uint64(len(s.root.segment)))

	s.introductions = make(chan *segmentIntroduction)
	s.persists = make(chan *persistIntroduction)
	s.merges = make(chan *segmentMerge)
	s.introducerNotifier = make(chan *epochWatcher, 1)
	s.persisterNotifier = make(chan *epochWatcher, 1)
	s.closeCh = make(chan struct{})
	s.forceMergeRequestCh = make(chan *mergerCtrl, 1)

	if !s.readOnly && s.path != "" {
		err := s.removeOldZapFiles() // Before persister or merger create any new files.
		if err != nil {
			_ = s.Close()
			return err
		}
	}

	s.numSnapshotsToKeep = NumSnapshotsToKeep
	if v, ok := s.config["numSnapshotsToKeep"]; ok {
		var t int
		if t, err = parseToInteger(v); err != nil {
			return fmt.Errorf("numSnapshotsToKeep parse err: %v", err)
		}
		if t > 0 {
			s.numSnapshotsToKeep = t
		}
	}

	s.rollbackSamplingInterval = RollbackSamplingInterval
	if v, ok := s.config["rollbackSamplingInterval"]; ok {
		var t time.Duration
		if t, err = parseToTimeDuration(v); err != nil {
			return fmt.Errorf("rollbackSamplingInterval parse err: %v", err)
		}
		s.rollbackSamplingInterval = t
	}

	s.rollbackRetentionFactor = RollbackRetentionFactor
	if v, ok := s.config["rollbackRetentionFactor"]; ok {
		var r float64
		if r, ok = v.(float64); ok {
			return fmt.Errorf("rollbackRetentionFactor parse err: %v", err)
		}
		s.rollbackRetentionFactor = r
	}

	typ, ok := s.config["spatialPlugin"].(string)
	if ok {
		if err := s.loadSpatialAnalyzerPlugin(typ); err != nil {
			return err
		}
	}

	return nil
}

func (s *Scorch) Close() (err error) {
	startTime := time.Now()
	defer func() {
		s.fireEvent(EventKindClose, time.Since(startTime))
	}()

	s.fireEvent(EventKindCloseStart, 0)

	// signal to async tasks we want to close
	close(s.closeCh)
	// wait for them to close
	s.asyncTasks.Wait()
	// now close the root bolt
	if s.rootBolt != nil {
		err = s.rootBolt.Close()
		s.rootLock.Lock()
		if s.root != nil {
			err2 := s.root.DecRef()
			if err == nil {
				err = err2
			}
		}
		s.root = nil
		s.rootBolt = nil
		s.rootLock.Unlock()
	}

	return
}

func (s *Scorch) Update(doc index.Document) error {
	b := index.NewBatch()
	b.Update(doc)
	return s.Batch(b)
}

func (s *Scorch) Delete(id string) error {
	b := index.NewBatch()
	b.Delete(id)
	return s.Batch(b)
}

// Batch applices a batch of changes to the index atomically
func (s *Scorch) Batch(batch *index.Batch) (err error) {
	start := time.Now()

	// notify handlers that we're about to index a batch of data
	s.fireEvent(EventKindBatchIntroductionStart, 0)
	defer func() {
		s.fireEvent(EventKindBatchIntroduction, time.Since(start))
	}()

	resultChan := make(chan index.Document, len(batch.IndexOps))

	var numUpdates uint64
	var numDeletes uint64
	var numPlainTextBytes uint64
	var ids []string
	for docID, doc := range batch.IndexOps {
		if doc != nil {
			// insert _id field
			doc.AddIDField()
			numUpdates++
			numPlainTextBytes += doc.NumPlainTextBytes()
		} else {
			numDeletes++
		}
		ids = append(ids, docID)
	}

	// FIXME could sort ids list concurrent with analysis?

	if numUpdates > 0 {
		go func() {
			for k := range batch.IndexOps {
				doc := batch.IndexOps[k]
				if doc != nil {
					// put the work on the queue
					s.analysisQueue.Queue(func() {
						analyze(doc, s.setSpatialAnalyzerPlugin)
						resultChan <- doc
					})
				}
			}
		}()
	}

	// wait for analysis result
	analysisResults := make([]index.Document, int(numUpdates))
	var itemsDeQueued uint64
	var totalAnalysisSize int
	for itemsDeQueued < numUpdates {
		result := <-resultChan
		resultSize := result.Size()
		// check if the document is searchable by the index
		if result.Indexed() {
			atomic.AddUint64(&s.stats.TotMutationsFiltered, 1)
		}
		atomic.AddUint64(&s.iStats.analysisBytesAdded, uint64(resultSize))
		totalAnalysisSize += resultSize
		analysisResults[itemsDeQueued] = result
		itemsDeQueued++
	}
	close(resultChan)
	defer atomic.AddUint64(&s.iStats.analysisBytesRemoved, uint64(totalAnalysisSize))

	atomic.AddUint64(&s.stats.TotAnalysisTime, uint64(time.Since(start)))

	indexStart := time.Now()

	var newSegment segment.Segment
	var bufBytes uint64
	stats := newFieldStats()

	if len(analysisResults) > 0 {
		newSegment, bufBytes, err = s.segPlugin.New(analysisResults)
		if err != nil {
			return err
		}
		if segB, ok := newSegment.(segment.DiskStatsReporter); ok {
			atomic.AddUint64(&s.stats.TotBytesWrittenAtIndexTime,
				segB.BytesWritten())
		}
		atomic.AddUint64(&s.iStats.newSegBufBytesAdded, bufBytes)
		if fsr, ok := newSegment.(segment.FieldStatsReporter); ok {
			fsr.UpdateFieldStats(stats)
		}
	} else {
		atomic.AddUint64(&s.stats.TotBatchesEmpty, 1)
	}

	err = s.prepareSegment(newSegment, ids, batch.InternalOps, batch.PersistedCallback(), stats)
	if err != nil {
		if newSegment != nil {
			_ = newSegment.Close()
		}
		atomic.AddUint64(&s.stats.TotOnErrors, 1)
	} else {
		atomic.AddUint64(&s.stats.TotUpdates, numUpdates)
		atomic.AddUint64(&s.stats.TotDeletes, numDeletes)
		atomic.AddUint64(&s.stats.TotBatches, 1)
		atomic.AddUint64(&s.stats.TotIndexedPlainTextBytes, numPlainTextBytes)
	}

	atomic.AddUint64(&s.iStats.newSegBufBytesRemoved, bufBytes)
	atomic.AddUint64(&s.stats.TotIndexTime, uint64(time.Since(indexStart)))

	return err
}

func (s *Scorch) prepareSegment(newSegment segment.Segment, ids []string,
	internalOps map[string][]byte, persistedCallback index.BatchCallback, stats *fieldStats,
) error {
	// new introduction
	introduction := &segmentIntroduction{
		id:                atomic.AddUint64(&s.nextSegmentID, 1),
		data:              newSegment,
		ids:               ids,
		internal:          internalOps,
		stats:             stats,
		applied:           make(chan error),
		persistedCallback: persistedCallback,
	}

	if !s.unsafeBatch {
		introduction.persisted = make(chan error, 1)
	}

	// optimistically prepare obsoletes outside of rootLock
	s.rootLock.RLock()
	root := s.root
	root.AddRef()
	s.rootLock.RUnlock()

	defer func() { _ = root.DecRef() }()

	introduction.obsoletes = make(map[uint64]*roaring.Bitmap, len(root.segment))

	for _, seg := range root.segment {
		delta, err := seg.segment.DocNumbers(ids)
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

func (s *Scorch) SetInternal(key, val []byte) error {
	b := index.NewBatch()
	b.SetInternal(key, val)
	return s.Batch(b)
}

func (s *Scorch) DeleteInternal(key []byte) error {
	b := index.NewBatch()
	b.DeleteInternal(key)
	return s.Batch(b)
}

// Reader returns a low-level accessor on the index data. Close it to
// release associated resources.
func (s *Scorch) Reader() (index.IndexReader, error) {
	return s.currentSnapshot(), nil
}

func (s *Scorch) currentSnapshot() *IndexSnapshot {
	s.rootLock.RLock()
	rv := s.root
	if rv != nil {
		rv.AddRef()
	}
	s.rootLock.RUnlock()
	return rv
}

func (s *Scorch) Stats() json.Marshaler {
	return &s.stats
}

func (s *Scorch) BytesReadQueryTime() uint64 {
	return s.stats.TotBytesReadAtQueryTime
}

func (s *Scorch) diskFileStats(rootSegmentPaths map[string]struct{}) (uint64,
	uint64, uint64,
) {
	var numFilesOnDisk, numBytesUsedDisk, numBytesOnDiskByRoot uint64
	if s.path != "" {
		files, err := os.ReadDir(s.path)
		if err == nil {
			for _, f := range files {
				if !f.IsDir() {
					if finfo, err := f.Info(); err == nil {
						numBytesUsedDisk += uint64(finfo.Size())
						numFilesOnDisk++
						if rootSegmentPaths != nil {
							fname := s.path + string(os.PathSeparator) + finfo.Name()
							if _, fileAtRoot := rootSegmentPaths[fname]; fileAtRoot {
								numBytesOnDiskByRoot += uint64(finfo.Size())
							}
						}
					}
				}
			}
		}
	}
	// if no root files path given, then consider all disk files.
	if rootSegmentPaths == nil {
		return numFilesOnDisk, numBytesUsedDisk, numBytesUsedDisk
	}

	return numFilesOnDisk, numBytesUsedDisk, numBytesOnDiskByRoot
}

func (s *Scorch) StatsMap() map[string]interface{} {
	m := s.stats.ToMap()

	indexSnapshot := s.currentSnapshot()
	if indexSnapshot == nil {
		return nil
	}

	defer func() {
		_ = indexSnapshot.Close()
	}()

	rootSegPaths := indexSnapshot.diskSegmentsPaths()

	s.rootLock.RLock()
	m["CurFilesIneligibleForRemoval"] = uint64(len(s.ineligibleForRemoval))
	s.rootLock.RUnlock()

	numFilesOnDisk, numBytesUsedDisk, numBytesOnDiskByRoot := s.diskFileStats(rootSegPaths)

	m["CurOnDiskBytes"] = numBytesUsedDisk
	m["CurOnDiskFiles"] = numFilesOnDisk

	// TODO: consider one day removing these backwards compatible
	// names for apps using the old names
	m["updates"] = m["TotUpdates"]
	m["deletes"] = m["TotDeletes"]
	m["batches"] = m["TotBatches"]
	m["errors"] = m["TotOnErrors"]
	m["analysis_time"] = m["TotAnalysisTime"]
	m["index_time"] = m["TotIndexTime"]
	m["term_searchers_started"] = m["TotTermSearchersStarted"]
	m["term_searchers_finished"] = m["TotTermSearchersFinished"]
	m["knn_searches"] = m["TotKNNSearches"]
	m["synonym_searches"] = m["TotSynonymSearches"]
	m["total_mutations_filtered"] = m["TotMutationsFiltered"]

	m["num_bytes_read_at_query_time"] = m["TotBytesReadAtQueryTime"]
	m["num_plain_text_bytes_indexed"] = m["TotIndexedPlainTextBytes"]
	m["num_bytes_written_at_index_time"] = m["TotBytesWrittenAtIndexTime"]
	m["num_items_introduced"] = m["TotIntroducedItems"]
	m["num_items_persisted"] = m["TotPersistedItems"]
	m["num_recs_to_persist"] = m["TotItemsToPersist"]
	// total disk bytes found in index directory inclusive of older snapshots
	m["num_bytes_used_disk"] = numBytesUsedDisk
	// total disk bytes by the latest root index, exclusive of older snapshots
	m["num_bytes_used_disk_by_root"] = numBytesOnDiskByRoot
	// num_bytes_used_disk_by_root_reclaimable is an approximation about the
	// reclaimable disk space in an index. (eg: from a full compaction)
	m["num_bytes_used_disk_by_root_reclaimable"] = uint64(float64(numBytesOnDiskByRoot) *
		indexSnapshot.reClaimableDocsRatio())
	m["num_files_on_disk"] = numFilesOnDisk
	m["num_root_memorysegments"] = m["TotMemorySegmentsAtRoot"]
	m["num_root_filesegments"] = m["TotFileSegmentsAtRoot"]
	m["num_persister_nap_pause_completed"] = m["TotPersisterNapPauseCompleted"]
	m["num_persister_nap_merger_break"] = m["TotPersisterMergerNapBreak"]
	m["total_compaction_written_bytes"] = m["TotFileMergeWrittenBytes"]

	// the bool stat `index_bgthreads_active` indicates whether the background routines
	// (which are responsible for the index to attain a steady state) are still
	// doing some work.
	if rootEpoch, ok := m["CurRootEpoch"].(uint64); ok {
		if lastMergedEpoch, ok := m["LastMergedEpoch"].(uint64); ok {
			if lastPersistedEpoch, ok := m["LastPersistedEpoch"].(uint64); ok {
				m["index_bgthreads_active"] = !(lastMergedEpoch == rootEpoch && lastPersistedEpoch == rootEpoch)
			}
		}
	}

	// calculate the aggregate of all the segment's field stats
	aggFieldStats := newFieldStats()
	for _, segmentSnapshot := range indexSnapshot.Segments() {
		if segmentSnapshot.stats != nil {
			aggFieldStats.Aggregate(segmentSnapshot.stats)
		}
	}

	aggFieldStatsMap := aggFieldStats.Fetch()
	for statName, stats := range aggFieldStatsMap {
		for fieldName, val := range stats {
			m["field:"+fieldName+":"+statName] = val
		}
	}
	return m
}

func (s *Scorch) Analyze(d index.Document) {
	analyze(d, s.setSpatialAnalyzerPlugin)
}

type customAnalyzerPluginInitFunc func(field index.Field)

func (s *Scorch) setSpatialAnalyzerPlugin(f index.Field) {
	if s.segPlugin != nil {
		// check whether the current field is a custom tokenizable
		// spatial field then set the spatial analyser plugin for
		// overriding the tokenisation during the analysis stage.
		if sf, ok := f.(index.TokenizableSpatialField); ok {
			sf.SetSpatialAnalyzerPlugin(s.spatialPlugin)
		}
	}
}

func analyze(d index.Document, fn customAnalyzerPluginInitFunc) {
	d.VisitFields(func(field index.Field) {
		if field.Options().IsIndexed() {
			if fn != nil {
				fn(field)
			}

			field.Analyze()

			if d.HasComposite() && field.Name() != "_id" {
				// see if any of the composite fields need this
				d.VisitComposite(func(cf index.CompositeField) {
					cf.Compose(field.Name(), field.AnalyzedLength(), field.AnalyzedTokenFrequencies())
				})
				// Since the encoded geoShape is only necessary within the doc values
				// of the geoShapeField, it has been removed from the field's term dictionary.
				// However, '_all' field uses its term dictionary as its docValues, so it
				// becomes necessary to add the geoShape into the '_all' field's term dictionary
				if f, ok := field.(index.GeoShapeField); ok {
					d.VisitComposite(func(cf index.CompositeField) {
						geoshape := f.EncodedShape()
						cf.Compose(field.Name(), 1, index.TokenFrequencies{
							string(geoshape): &index.TokenFreq{
								Term: geoshape,
								Locations: []*index.TokenLocation{
									{
										Start:    0,
										End:      len(geoshape),
										Position: 1,
									},
								},
							},
						})
					})
				}
			}
		}
	})
}

func (s *Scorch) AddEligibleForRemoval(epoch uint64) {
	s.rootLock.Lock()
	if s.root == nil || s.root.epoch != epoch {
		s.eligibleForRemoval = append(s.eligibleForRemoval, epoch)
	}
	s.rootLock.Unlock()
}

func (s *Scorch) MemoryUsed() (memUsed uint64) {
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
	persistEpoch := atomic.LoadUint64(&s.iStats.persistEpoch)
	persistSnapshotSize := atomic.LoadUint64(&s.iStats.persistSnapshotSize)
	if persistEpoch != 0 && indexSnapshot.epoch > persistEpoch {
		// the snapshot that the persister is working on isn't the same as
		// the current snapshot
		memUsed += persistSnapshotSize
	}

	// Account for snapshot that the merger may be working on
	mergeEpoch := atomic.LoadUint64(&s.iStats.mergeEpoch)
	mergeSnapshotSize := atomic.LoadUint64(&s.iStats.mergeSnapshotSize)
	if mergeEpoch != 0 && indexSnapshot.epoch > mergeEpoch {
		// the snapshot that the merger is working on isn't the same as
		// the current snapshot
		memUsed += mergeSnapshotSize
	}

	memUsed += (atomic.LoadUint64(&s.iStats.newSegBufBytesAdded) -
		atomic.LoadUint64(&s.iStats.newSegBufBytesRemoved))

	memUsed += (atomic.LoadUint64(&s.iStats.analysisBytesAdded) -
		atomic.LoadUint64(&s.iStats.analysisBytesRemoved))

	return memUsed
}

func (s *Scorch) markIneligibleForRemoval(filename string) {
	s.rootLock.Lock()
	s.ineligibleForRemoval[filename] = true
	s.rootLock.Unlock()
}

func (s *Scorch) unmarkIneligibleForRemoval(filename string) {
	s.rootLock.Lock()
	delete(s.ineligibleForRemoval, filename)
	s.rootLock.Unlock()
}

func init() {
	err := registry.RegisterIndexType(Name, NewScorch)
	if err != nil {
		panic(err)
	}
}

func parseToTimeDuration(i interface{}) (time.Duration, error) {
	switch v := i.(type) {
	case string:
		return time.ParseDuration(v)

	default:
		return 0, fmt.Errorf("expects a duration string")
	}
}

func parseToInteger(i interface{}) (int, error) {
	switch v := i.(type) {
	case float64:
		return int(v), nil
	case int:
		return v, nil

	default:
		return 0, fmt.Errorf("expects int or float64 value")
	}
}

// Holds Zap's field level stats at a segment level
type fieldStats struct {
	// StatName -> FieldName -> value
	statMap map[string]map[string]uint64
}

// Add the data into the map after checking if the statname is valid
func (fs *fieldStats) Store(statName, fieldName string, value uint64) {
	if _, exists := fs.statMap[statName]; !exists {
		fs.statMap[statName] = make(map[string]uint64)
	}
	fs.statMap[statName][fieldName] = value
}

// Combine the given stats map with the existing map
func (fs *fieldStats) Aggregate(stats segment.FieldStats) {
	statMap := stats.Fetch()
	if statMap == nil {
		return
	}
	for statName, statMap := range statMap {
		if _, exists := fs.statMap[statName]; !exists {
			fs.statMap[statName] = make(map[string]uint64)
		}
		for fieldName, val := range statMap {
			if _, exists := fs.statMap[statName][fieldName]; !exists {
				fs.statMap[statName][fieldName] = 0
			}
			fs.statMap[statName][fieldName] += val
		}
	}
}

// Returns the stats map
func (fs *fieldStats) Fetch() map[string]map[string]uint64 {
	if fs == nil {
		return nil
	}

	return fs.statMap
}

// Initializes an empty stats map
func newFieldStats() *fieldStats {
	rv := &fieldStats{
		statMap: map[string]map[string]uint64{},
	}
	return rv
}

// CopyReader returns a low-level accessor for index data, ensuring persisted segments
// remain on disk for backup, preventing race conditions with the persister/merger cleanup.
// Close the reader after backup to allow segment removal by the persister/merger.
func (s *Scorch) CopyReader() index.CopyReader {
	s.rootLock.Lock()
	rv := s.root
	if rv != nil {
		rv.AddRef()
		var fileName string
		// schedule a backup for all the segments from the root. Note that the
		// both the unpersisted and persisted segments are scheduled for backup.
		// because during the backup, the unpersisted segments may get persisted and
		// hence we need to protect both the unpersisted and persisted segments from removal
		// by the cleanup routine during the online backup
		for _, seg := range rv.segment {
			if perSeg, ok := seg.segment.(segment.PersistedSegment); ok {
				// segment is persisted
				fileName = filepath.Base(perSeg.Path())
			} else {
				// segment is not persisted
				// the name of the segment file that is generated if the
				// the segment is persisted in the future.
				fileName = zapFileName(seg.id)
			}
			rv.parent.copyScheduled[fileName]++
		}
	}
	s.rootLock.Unlock()
	return rv
}

// external API to fire a scorch event (EventKindIndexStart) externally from bleve
func (s *Scorch) FireIndexEvent() {
	s.fireEvent(EventKindIndexStart, 0)
}

// Updates bolt db with the given field info. Existing field info already in bolt
// will be merged before persisting. The index mapping is also overwritted both
// in bolt as well as the index snapshot
func (s *Scorch) UpdateFields(fieldInfo map[string]*index.UpdateFieldInfo, mappingBytes []byte) error {
	err := s.updateBolt(fieldInfo, mappingBytes)
	if err != nil {
		return err
	}
	// Pass the update field info to all snapshots and segment bases
	s.root.UpdateFieldsInfo(fieldInfo)
	return nil
}

func (s *Scorch) OpenMeta() error {
	if s.rootBolt == nil {
		err := s.openBolt()
		if err != nil {
			return err
		}
	}

	return nil
}

// Merge and update deleted field info and rewrite index mapping
func (s *Scorch) updateBolt(fieldInfo map[string]*index.UpdateFieldInfo, mappingBytes []byte) error {
	return s.rootBolt.Update(func(tx *bolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return nil
		}

		c := snapshots.Cursor()
		for k, _ := c.Last(); k != nil; k, _ = c.Prev() {
			_, _, err := decodeUvarintAscending(k)
			if err != nil {
				fmt.Printf("unable to parse segment epoch %x, continuing", k)
				continue
			}
			snapshot := snapshots.Bucket(k)
			cc := snapshot.Cursor()
			for kk, _ := cc.First(); kk != nil; kk, _ = cc.Next() {
				if kk[0] == util.BoltInternalKey[0] {
					internalBucket := snapshot.Bucket(kk)
					if internalBucket == nil {
						return fmt.Errorf("segment key, but bucket missing %x", kk)
					}
					err = internalBucket.Put(util.MappingInternalKey, mappingBytes)
					if err != nil {
						return err
					}
				} else if kk[0] != util.BoltMetaDataKey[0] {
					segmentBucket := snapshot.Bucket(kk)
					if segmentBucket == nil {
						return fmt.Errorf("segment key, but bucket missing %x", kk)
					}
					var updatedFields map[string]*index.UpdateFieldInfo
					updatedFieldBytes := segmentBucket.Get(util.BoltUpdatedFieldsKey)
					if updatedFieldBytes != nil {
						err := json.Unmarshal(updatedFieldBytes, &updatedFields)
						if err != nil {
							return fmt.Errorf("error reading updated field bytes: %v", err)
						}
						for field, info := range fieldInfo {
							if val, ok := updatedFields[field]; ok {
								updatedFields[field] = &index.UpdateFieldInfo{
									Deleted:   info.Deleted || val.Deleted,
									Store:     info.Store || val.Store,
									DocValues: info.DocValues || val.DocValues,
									Index:     info.Index || val.Index,
								}
							} else {
								updatedFields[field] = info
							}
						}
					} else {
						updatedFields = fieldInfo
					}
					b, err := json.Marshal(updatedFields)
					if err != nil {
						return err
					}
					err = segmentBucket.Put(util.BoltUpdatedFieldsKey, b)
					if err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}
