//  Copyright (c) 2019 Couchbase, Inc.
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
	"fmt"
	"os"
	"sync"

	"github.com/RoaringBitmap/roaring/v2"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	bolt "go.etcd.io/bbolt"
)

const DefaultBuilderBatchSize = 1000
const DefaultBuilderMergeMax = 10

type Builder struct {
	m         sync.Mutex
	segCount  uint64
	path      string
	buildPath string
	segPaths  []string
	batchSize int
	mergeMax  int
	batch     *index.Batch
	internal  map[string][]byte
	segPlugin SegmentPlugin
}

func NewBuilder(config map[string]interface{}) (*Builder, error) {
	path, ok := config["path"].(string)
	if !ok {
		return nil, fmt.Errorf("must specify path")
	}

	buildPathPrefix, _ := config["buildPathPrefix"].(string)
	buildPath, err := os.MkdirTemp(buildPathPrefix, "scorch-offline-build")
	if err != nil {
		return nil, err
	}

	rv := &Builder{
		path:      path,
		buildPath: buildPath,
		mergeMax:  DefaultBuilderMergeMax,
		batchSize: DefaultBuilderBatchSize,
		batch:     index.NewBatch(),
		segPlugin: defaultSegmentPlugin,
	}

	err = rv.parseConfig(config)
	if err != nil {
		return nil, fmt.Errorf("error parsing builder config: %v", err)
	}

	return rv, nil
}

func (o *Builder) parseConfig(config map[string]interface{}) (err error) {
	if v, ok := config["mergeMax"]; ok {
		var t int
		if t, err = parseToInteger(v); err != nil {
			return fmt.Errorf("mergeMax parse err: %v", err)
		}
		if t > 0 {
			o.mergeMax = t
		}
	}

	if v, ok := config["batchSize"]; ok {
		var t int
		if t, err = parseToInteger(v); err != nil {
			return fmt.Errorf("batchSize parse err: %v", err)
		}
		if t > 0 {
			o.batchSize = t
		}
	}

	if v, ok := config["internal"]; ok {
		if vinternal, ok := v.(map[string][]byte); ok {
			o.internal = vinternal
		}
	}

	forcedSegmentType, forcedSegmentVersion, err := configForceSegmentTypeVersion(config)
	if err != nil {
		return err
	}
	if forcedSegmentType != "" && forcedSegmentVersion != 0 {
		segPlugin, err := chooseSegmentPlugin(forcedSegmentType,
			uint32(forcedSegmentVersion))
		if err != nil {
			return err
		}
		o.segPlugin = segPlugin
	}

	return nil
}

// Index will place the document into the index.
// It is invalid to index the same document multiple times.
func (o *Builder) Index(doc index.Document) error {
	o.m.Lock()
	defer o.m.Unlock()

	o.batch.Update(doc)

	return o.maybeFlushBatchLOCKED(o.batchSize)
}

func (o *Builder) maybeFlushBatchLOCKED(moreThan int) error {
	if len(o.batch.IndexOps) >= moreThan {
		defer o.batch.Reset()
		return o.executeBatchLOCKED(o.batch)
	}
	return nil
}

func (o *Builder) executeBatchLOCKED(batch *index.Batch) (err error) {
	analysisResults := make([]index.Document, 0, len(batch.IndexOps))
	for _, doc := range batch.IndexOps {
		if doc != nil {
			// insert _id field
			doc.AddIDField()
			// perform analysis directly
			analyze(doc, nil)
			analysisResults = append(analysisResults, doc)
		}
	}

	seg, _, err := o.segPlugin.New(analysisResults)
	if err != nil {
		return fmt.Errorf("error building segment base: %v", err)
	}

	filename := zapFileName(o.segCount)
	o.segCount++
	path := o.buildPath + string(os.PathSeparator) + filename

	if segUnpersisted, ok := seg.(segment.UnpersistedSegment); ok {
		err = segUnpersisted.Persist(path)
		if err != nil {
			return fmt.Errorf("error persisting segment base to %s: %v", path, err)
		}

		o.segPaths = append(o.segPaths, path)
		return nil
	}

	return fmt.Errorf("new segment does not implement unpersisted: %T", seg)
}

func (o *Builder) doMerge() error {
	// as long as we have more than 1 segment, keep merging
	for len(o.segPaths) > 1 {

		// merge the next <mergeMax> number of segments into one new one
		// or, if there are fewer than <mergeMax> remaining, merge them all
		mergeCount := o.mergeMax
		if mergeCount > len(o.segPaths) {
			mergeCount = len(o.segPaths)
		}

		mergePaths := o.segPaths[0:mergeCount]
		o.segPaths = o.segPaths[mergeCount:]

		// open each of the segments to be merged
		mergeSegs := make([]segment.Segment, 0, mergeCount)

		// closeOpenedSegs attempts to close all opened
		// segments even if an error occurs, in which case
		// the first error is returned
		closeOpenedSegs := func() error {
			var err error
			for _, seg := range mergeSegs {
				clErr := seg.Close()
				if clErr != nil && err == nil {
					err = clErr
				}
			}
			return err
		}

		for _, mergePath := range mergePaths {
			seg, err := o.segPlugin.Open(mergePath)
			if err != nil {
				_ = closeOpenedSegs()
				return fmt.Errorf("error opening segment (%s) for merge: %v", mergePath, err)
			}
			mergeSegs = append(mergeSegs, seg)
		}

		// do the merge
		mergedSegPath := o.buildPath + string(os.PathSeparator) + zapFileName(o.segCount)
		drops := make([]*roaring.Bitmap, mergeCount)
		_, _, err := o.segPlugin.Merge(mergeSegs, drops, mergedSegPath, nil, nil)
		if err != nil {
			_ = closeOpenedSegs()
			return fmt.Errorf("error merging segments (%v): %v", mergePaths, err)
		}
		o.segCount++
		o.segPaths = append(o.segPaths, mergedSegPath)

		// close segments opened for merge
		err = closeOpenedSegs()
		if err != nil {
			return fmt.Errorf("error closing opened segments: %v", err)
		}

		// remove merged segments
		for _, mergePath := range mergePaths {
			err = os.RemoveAll(mergePath)
			if err != nil {
				return fmt.Errorf("error removing segment %s after merge: %v", mergePath, err)
			}
		}
	}

	return nil
}

func (o *Builder) Close() error {
	o.m.Lock()
	defer o.m.Unlock()

	// see if there is a partial batch
	err := o.maybeFlushBatchLOCKED(1)
	if err != nil {
		return fmt.Errorf("error flushing batch before close: %v", err)
	}

	// perform all the merging
	err = o.doMerge()
	if err != nil {
		return fmt.Errorf("error while merging: %v", err)
	}

	// ensure the store path exists
	err = os.MkdirAll(o.path, 0700)
	if err != nil {
		return err
	}

	// move final segment into place
	// segment id 2 is chosen to match the behavior of a scorch
	// index which indexes a single batch of data
	finalSegPath := o.path + string(os.PathSeparator) + zapFileName(2)
	err = os.Rename(o.segPaths[0], finalSegPath)
	if err != nil {
		return fmt.Errorf("error moving final segment into place: %v", err)
	}

	// remove the buildPath, as it is no longer needed
	err = os.RemoveAll(o.buildPath)
	if err != nil {
		return fmt.Errorf("error removing build path: %v", err)
	}

	// prepare wrapping
	seg, err := o.segPlugin.Open(finalSegPath)
	if err != nil {
		return fmt.Errorf("error opening final segment")
	}

	// create a segment snapshot for this segment
	ss := &SegmentSnapshot{
		segment: seg,
	}
	is := &IndexSnapshot{
		epoch:    3, // chosen to match scorch behavior when indexing a single batch
		segment:  []*SegmentSnapshot{ss},
		creator:  "scorch-builder",
		internal: o.internal,
	}

	// create the root bolt
	rootBoltPath := o.path + string(os.PathSeparator) + "root.bolt"
	rootBolt, err := bolt.Open(rootBoltPath, 0600, nil)
	if err != nil {
		return err
	}

	// start a write transaction
	tx, err := rootBolt.Begin(true)
	if err != nil {
		return err
	}

	// fill the root bolt with this fake index snapshot
	_, _, err = prepareBoltSnapshot(is, tx, o.path, o.segPlugin, nil, nil)
	if err != nil {
		_ = tx.Rollback()
		_ = rootBolt.Close()
		return fmt.Errorf("error preparing bolt snapshot in root.bolt: %v", err)
	}

	// commit bolt data
	err = tx.Commit()
	if err != nil {
		_ = rootBolt.Close()
		return fmt.Errorf("error committing bolt tx in root.bolt: %v", err)
	}

	// close bolt
	err = rootBolt.Close()
	if err != nil {
		return fmt.Errorf("error closing root.bolt: %v", err)
	}

	// close final segment
	err = seg.Close()
	if err != nil {
		return fmt.Errorf("error closing final segment: %v", err)
	}
	return nil
}
