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
	"io"
	"sync"

	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

type SegmentPlugin struct {
	Type    string
	Version uint32
	New     func(results []segment.Document, normCalc func(string, int) float32) (segment.Segment, uint64, error)
	Load    func(*segment.Data) (segment.Segment, error)
	Merge   func([]segment.Segment, []*roaring.Bitmap, int) segment.Merger
}

func supportedSegmentTypes(supportedSegmentPlugins map[string]map[uint32]*SegmentPlugin) (rv []string) {
	for k := range supportedSegmentPlugins {
		rv = append(rv, k)
	}
	return
}

func supportedSegmentTypeVersions(supportedSegmentPlugins map[string]map[uint32]*SegmentPlugin, typ string) (
	rv []uint32) {
	for k := range supportedSegmentPlugins[typ] {
		rv = append(rv, k)
	}
	return rv
}

func loadSegmentPlugin(supportedSegmentPlugins map[string]map[uint32]*SegmentPlugin,
	forcedSegmentType string, forcedSegmentVersion uint32) (*SegmentPlugin, error) {
	if versions, ok := supportedSegmentPlugins[forcedSegmentType]; ok {
		if segPlugin, ok := versions[forcedSegmentVersion]; ok {
			return segPlugin, nil
		}
		return nil, fmt.Errorf(
			"unsupported version %d for segment type: %s, supported: %v",
			forcedSegmentVersion, forcedSegmentType,
			supportedSegmentTypeVersions(supportedSegmentPlugins, forcedSegmentType))
	}
	return nil, fmt.Errorf("unsupported segment type: %s, supported: %v",
		forcedSegmentType, supportedSegmentTypes(supportedSegmentPlugins))
}

func (s *Writer) newSegment(results []segment.Document) (*segmentWrapper, uint64, error) {
	seg, count, err := s.segPlugin.New(results, s.config.NormCalc)
	return &segmentWrapper{
		Segment:    seg,
		refCounter: noOpRefCounter{},
	}, count, err
}

type segmentWrapper struct {
	segment.Segment
	refCounter
	persisted bool
}

func (s segmentWrapper) Persisted() bool {
	return s.persisted
}

func (s segmentWrapper) Close() error {
	return s.DecRef()
}

type refCounter interface {
	AddRef()
	DecRef() error
}

type noOpRefCounter struct{}

func (noOpRefCounter) AddRef()       {}
func (noOpRefCounter) DecRef() error { return nil }

type closeOnLastRefCounter struct {
	closer io.Closer
	m      sync.Mutex
	refs   int64
}

func (c *closeOnLastRefCounter) AddRef() {
	c.m.Lock()
	c.refs++
	c.m.Unlock()
}

func (c *closeOnLastRefCounter) DecRef() error {
	c.m.Lock()
	c.refs--
	var err error
	if c.refs == 0 && c.closer != nil {
		err = c.closer.Close()
	}
	c.m.Unlock()
	return err
}
