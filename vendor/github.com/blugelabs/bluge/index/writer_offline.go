//  Copyright (c) 2020 The Bluge Authors.
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
	"io"
	"sync"

	"github.com/RoaringBitmap/roaring"

	segment "github.com/blugelabs/bluge_segment_api"
)

type WriterOffline struct {
	m         sync.Mutex
	config    Config
	directory Directory
	segPlugin *SegmentPlugin
	segCount  uint64
	segIDs    []uint64

	mergeMax int
}

func OpenOfflineWriter(config Config) (writer *WriterOffline, err error) {
	writer = &WriterOffline{
		config:    config,
		directory: config.DirectoryFunc(),
		segPlugin: nil,
		mergeMax:  10,
	}

	err = writer.directory.Setup(false)
	if err != nil {
		return nil, fmt.Errorf("error setting up directory: %w", err)
	}

	writer.segPlugin, err = loadSegmentPlugin(config.supportedSegmentPlugins, config.SegmentType, config.SegmentVersion)
	if err != nil {
		return nil, fmt.Errorf("error loading segment plugin: %v", err)
	}

	return writer, nil
}

func (s *WriterOffline) Batch(batch *Batch) (err error) {
	s.m.Lock()
	defer s.m.Unlock()

	if len(batch.documents) == 0 {
		return nil
	}

	for _, doc := range batch.documents {
		if doc != nil {
			doc.Analyze()
		}
	}

	newSegment, _, err := s.segPlugin.New(batch.documents, s.config.NormCalc)
	if err != nil {
		return err
	}

	err = s.directory.Persist(ItemKindSegment, s.segCount, newSegment, nil)
	if err != nil {
		return fmt.Errorf("error persisting segment: %v", err)
	}
	s.segIDs = append(s.segIDs, s.segCount)
	s.segCount++

	return nil
}

func (s *WriterOffline) doMerge() error {
	for len(s.segIDs) > 1 {
		// merge the next <mergeMax> number of segments into one new one
		// or, if there are fewer than <mergeMax> remaining, merge them all
		mergeCount := s.mergeMax
		if mergeCount > len(s.segIDs) {
			mergeCount = len(s.segIDs)
		}

		mergeIDs := s.segIDs[0:mergeCount]
		s.segIDs = s.segIDs[mergeCount:]

		// open each of the segments to be merged
		mergeSegs := make([]segment.Segment, 0, mergeCount)

		var closers []io.Closer
		// closeOpenedSegs attempts to close all opened
		// segments even if an error occurs, in which case
		// the first error is returned
		closeOpenedSegs := func() error {
			var err error
			for _, closer := range closers {
				clErr := closer.Close()
				if clErr != nil && err == nil {
					err = clErr
				}
			}
			return err
		}

		for _, mergeID := range mergeIDs {
			data, closer, err := s.directory.Load(ItemKindSegment, mergeID)
			if err != nil {
				_ = closeOpenedSegs()
				return fmt.Errorf("error loading segment from directory: %w", err)
			}
			if closer != nil {
				closers = append(closers, closer)
			}
			seg, err := s.segPlugin.Load(data)
			if err != nil {
				_ = closeOpenedSegs()
				return fmt.Errorf("error loading segment: %w", err)
			}
			mergeSegs = append(mergeSegs, seg)
		}

		// do the merge
		drops := make([]*roaring.Bitmap, mergeCount)
		merger := s.segPlugin.Merge(mergeSegs, drops, s.config.MergeBufferSize)

		err := s.directory.Persist(ItemKindSegment, s.segCount, merger, nil)
		if err != nil {
			_ = closeOpenedSegs()
			return fmt.Errorf("error merging segments (%v): %w", mergeIDs, err)
		}
		s.segIDs = append(s.segIDs, s.segCount)
		s.segCount++

		// close segments opened for merge
		err = closeOpenedSegs()
		if err != nil {
			return fmt.Errorf("error closing opened segments: %w", err)
		}

		// remove merged segments
		for _, mergeID := range mergeIDs {
			err = s.directory.Remove(ItemKindSegment, mergeID)
			if err != nil {
				return fmt.Errorf("error removing segment %v after merge: %w", mergeIDs, err)
			}
		}
	}

	return nil
}

func (s *WriterOffline) Close() error {
	s.m.Lock()
	defer s.m.Unlock()

	// perform all the merging into one segment
	err := s.doMerge()
	if err != nil {
		return fmt.Errorf("error while merging: %w", err)
	}

	// open the merged segment
	data, closer, err := s.directory.Load(ItemKindSegment, s.segIDs[0])
	if err != nil {
		return fmt.Errorf("error loading segment from directory: %w", err)
	}
	finalSeg, err := s.segPlugin.Load(data)
	if err != nil {
		if closer != nil {
			_ = closer.Close()
		}
		return fmt.Errorf("error loading segment: %w", err)
	}

	// fake snapshot referencing this segment
	snapshot := &Snapshot{
		segment: []*segmentSnapshot{
			{
				id: s.segIDs[0],
				segment: &segmentWrapper{
					Segment:    finalSeg,
					refCounter: nil,
					persisted:  true,
				},
				segmentType:    s.segPlugin.Type,
				segmentVersion: s.segPlugin.Version,
			},
		},
		epoch: s.segIDs[0],
	}

	// persist the snapshot
	err = s.directory.Persist(ItemKindSnapshot, s.segIDs[0], snapshot, nil)
	if err != nil {
		return fmt.Errorf("error recording snapshot: %w", err)
	}

	if closer != nil {
		return closer.Close()
	}
	return nil
}
