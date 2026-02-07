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

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/blevesearch/bleve/v2/geo"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"

	zapv11 "github.com/blevesearch/zapx/v11"
	zapv12 "github.com/blevesearch/zapx/v12"
	zapv13 "github.com/blevesearch/zapx/v13"
	zapv14 "github.com/blevesearch/zapx/v14"
	zapv15 "github.com/blevesearch/zapx/v15"
	zapv16 "github.com/blevesearch/zapx/v16"
)

// SegmentPlugin represents the essential functions required by a package to plug in
// it's segment implementation
type SegmentPlugin interface {

	// Type is the name for this segment plugin
	Type() string

	// Version is a numeric value identifying a specific version of this type.
	// When incompatible changes are made to a particular type of plugin, the
	// version must be incremented.
	Version() uint32

	// New takes a set of Documents and turns them into a new Segment
	New(results []index.Document) (segment.Segment, uint64, error)

	// Open attempts to open the file at the specified path and
	// return the corresponding Segment
	Open(path string) (segment.Segment, error)

	// Merge takes a set of Segments, and creates a new segment on disk at
	// the specified path.
	// Drops is a set of bitmaps (one for each segment) indicating which
	// documents can be dropped from the segments during the merge.
	// If the closeCh channel is closed, Merge will cease doing work at
	// the next opportunity, and return an error (closed).
	// StatsReporter can optionally be provided, in which case progress
	// made during the merge is reported while operation continues.
	// Returns:
	// A slice of new document numbers (one for each input segment),
	// this allows the caller to know a particular document's new
	// document number in the newly merged segment.
	// The number of bytes written to the new segment file.
	// An error, if any occurred.
	Merge(segments []segment.Segment, drops []*roaring.Bitmap, path string,
		closeCh chan struct{}, s segment.StatsReporter) (
		[][]uint64, uint64, error)
}

var supportedSegmentPlugins map[string]map[uint32]SegmentPlugin
var defaultSegmentPlugin SegmentPlugin

func init() {
	ResetSegmentPlugins()
	RegisterSegmentPlugin(&zapv16.ZapPlugin{}, true)
	RegisterSegmentPlugin(&zapv15.ZapPlugin{}, false)
	RegisterSegmentPlugin(&zapv14.ZapPlugin{}, false)
	RegisterSegmentPlugin(&zapv13.ZapPlugin{}, false)
	RegisterSegmentPlugin(&zapv12.ZapPlugin{}, false)
	RegisterSegmentPlugin(&zapv11.ZapPlugin{}, false)
}

func ResetSegmentPlugins() {
	supportedSegmentPlugins = map[string]map[uint32]SegmentPlugin{}
}

func RegisterSegmentPlugin(plugin SegmentPlugin, makeDefault bool) {
	if _, ok := supportedSegmentPlugins[plugin.Type()]; !ok {
		supportedSegmentPlugins[plugin.Type()] = map[uint32]SegmentPlugin{}
	}
	supportedSegmentPlugins[plugin.Type()][plugin.Version()] = plugin
	if makeDefault {
		defaultSegmentPlugin = plugin
	}
}

func SupportedSegmentTypes() (rv []string) {
	for k := range supportedSegmentPlugins {
		rv = append(rv, k)
	}
	return
}

func SupportedSegmentTypeVersions(typ string) (rv []uint32) {
	for k := range supportedSegmentPlugins[typ] {
		rv = append(rv, k)
	}
	return rv
}

func chooseSegmentPlugin(forcedSegmentType string,
	forcedSegmentVersion uint32) (SegmentPlugin, error) {
	if versions, ok := supportedSegmentPlugins[forcedSegmentType]; ok {
		if segPlugin, ok := versions[uint32(forcedSegmentVersion)]; ok {
			return segPlugin, nil
		}
		return nil, fmt.Errorf(
			"unsupported version %d for segment type: %s, supported: %v",
			forcedSegmentVersion, forcedSegmentType,
			SupportedSegmentTypeVersions(forcedSegmentType))
	}
	return nil, fmt.Errorf("unsupported segment type: %s, supported: %v",
		forcedSegmentType, SupportedSegmentTypes())
}

func (s *Scorch) loadSegmentPlugin(forcedSegmentType string,
	forcedSegmentVersion uint32) error {
	segPlugin, err := chooseSegmentPlugin(forcedSegmentType,
		forcedSegmentVersion)
	if err != nil {
		return err
	}
	s.segPlugin = segPlugin
	return nil
}

func (s *Scorch) loadSpatialAnalyzerPlugin(typ string) error {
	s.spatialPlugin = geo.GetSpatialAnalyzerPlugin(typ)
	if s.spatialPlugin == nil {
		return fmt.Errorf("unsupported spatial plugin type: %s", typ)
	}
	return nil
}
