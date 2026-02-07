//  Copyright (c) 2022 Couchbase, Inc.
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

package geo

import (
	"encoding/json"
	"sync"

	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/geojson"
	"github.com/blevesearch/geo/s2"
)

const (
	PointType              = "point"
	MultiPointType         = "multipoint"
	LineStringType         = "linestring"
	MultiLineStringType    = "multilinestring"
	PolygonType            = "polygon"
	MultiPolygonType       = "multipolygon"
	GeometryCollectionType = "geometrycollection"
	CircleType             = "circle"
	EnvelopeType           = "envelope"
)

// spatialPluginsMap is spatial plugin cache.
var (
	spatialPluginsMap = make(map[string]index.SpatialAnalyzerPlugin)
	pluginsMapLock    = sync.RWMutex{}
)

func init() {
	registerS2RegionTermIndexer()
}

func registerS2RegionTermIndexer() {
	spatialPlugin := S2SpatialAnalyzerPlugin{
		s2Indexer:                    s2.NewRegionTermIndexerWithOptions(initS2IndexerOptions()),
		s2Searcher:                   s2.NewRegionTermIndexerWithOptions(initS2SearcherOptions()),
		s2GeoPointsRegionTermIndexer: s2.NewRegionTermIndexerWithOptions(initS2OptionsForGeoPoints()),
	}

	RegisterSpatialAnalyzerPlugin(&spatialPlugin)
}

// RegisterSpatialAnalyzerPlugin registers the given plugin implementation.
func RegisterSpatialAnalyzerPlugin(plugin index.SpatialAnalyzerPlugin) {
	pluginsMapLock.Lock()
	spatialPluginsMap[plugin.Type()] = plugin
	pluginsMapLock.Unlock()
}

// GetSpatialAnalyzerPlugin retrieves the given implementation type.
func GetSpatialAnalyzerPlugin(typ string) index.SpatialAnalyzerPlugin {
	pluginsMapLock.RLock()
	rv := spatialPluginsMap[typ]
	pluginsMapLock.RUnlock()
	return rv
}

// initS2IndexerOptions returns the options for s2's region
// term indexer for the index time tokens of geojson shapes.
func initS2IndexerOptions() s2.Options {
	options := s2.Options{}
	// maxLevel control the maximum size of the
	// S2Cells used to approximate regions.
	options.SetMaxLevel(16)

	// minLevel control the minimum size of the
	// S2Cells used to approximate regions.
	options.SetMinLevel(2)

	// levelMod value greater than 1 increases the effective branching
	// factor of the S2Cell hierarchy by skipping some levels.
	options.SetLevelMod(1)

	// maxCells controls the maximum number of cells
	// when approximating each s2 region.
	options.SetMaxCells(20)

	return options
}

// initS2SearcherOptions returns the options for s2's region
// term indexer for the query time tokens of geojson shapes.
func initS2SearcherOptions() s2.Options {
	options := s2.Options{}
	// maxLevel control the maximum size of the
	// S2Cells used to approximate regions.
	options.SetMaxLevel(16)

	// minLevel control the minimum size of the
	// S2Cells used to approximate regions.
	options.SetMinLevel(2)

	// levelMod value greater than 1 increases the effective branching
	// factor of the S2Cell hierarchy by skipping some levels.
	options.SetLevelMod(1)

	// maxCells controls the maximum number of cells
	// when approximating each s2 region.
	options.SetMaxCells(8)

	return options
}

// initS2OptionsForGeoPoints returns the options for
// s2's region term indexer for the original geopoints.
func initS2OptionsForGeoPoints() s2.Options {
	options := s2.Options{}
	// maxLevel control the maximum size of the
	// S2Cells used to approximate regions.
	options.SetMaxLevel(16)

	// minLevel control the minimum size of the
	// S2Cells used to approximate regions.
	options.SetMinLevel(4)

	// levelMod value greater than 1 increases the effective branching
	// factor of the S2Cell hierarchy by skipping some levels.
	options.SetLevelMod(2)

	// maxCells controls the maximum number of cells
	// when approximating each s2 region.
	options.SetMaxCells(8)

	// explicit for geo points.
	options.SetPointsOnly(true)

	return options
}

// S2SpatialAnalyzerPlugin is an implementation of
// the index.SpatialAnalyzerPlugin interface.
type S2SpatialAnalyzerPlugin struct {
	s2Indexer                    *s2.RegionTermIndexer
	s2Searcher                   *s2.RegionTermIndexer
	s2GeoPointsRegionTermIndexer *s2.RegionTermIndexer
}

func (s *S2SpatialAnalyzerPlugin) Type() string {
	return "s2"
}

func (s *S2SpatialAnalyzerPlugin) GetIndexTokens(queryShape index.GeoJSON) []string {
	var rv []string
	shapes := []index.GeoJSON{queryShape}
	if gc, ok := queryShape.(*geojson.GeometryCollection); ok {
		shapes = gc.Shapes
	}

	for _, shape := range shapes {
		if s2t, ok := shape.(s2Tokenizable); ok {
			rv = append(rv, s2t.IndexTokens(s.s2Indexer)...)
		} else if s2t, ok := shape.(s2TokenizableEx); ok {
			rv = append(rv, s2t.IndexTokens(s)...)
		}
	}

	return geojson.DeduplicateTerms(rv)
}

func (s *S2SpatialAnalyzerPlugin) GetQueryTokens(queryShape index.GeoJSON) []string {
	var rv []string
	shapes := []index.GeoJSON{queryShape}
	if gc, ok := queryShape.(*geojson.GeometryCollection); ok {
		shapes = gc.Shapes
	}

	for _, shape := range shapes {
		if s2t, ok := shape.(s2Tokenizable); ok {
			rv = append(rv, s2t.QueryTokens(s.s2Searcher)...)
		} else if s2t, ok := shape.(s2TokenizableEx); ok {
			rv = append(rv, s2t.QueryTokens(s)...)
		}
	}

	return geojson.DeduplicateTerms(rv)
}

// ------------------------------------------------------------------------
// s2Tokenizable is an optional interface for shapes that support
// the generation of s2 based tokens that can be used for both
// indexing and querying.

type s2Tokenizable interface {
	// IndexTokens returns the tokens for indexing.
	IndexTokens(*s2.RegionTermIndexer) []string

	// QueryTokens returns the tokens for searching.
	QueryTokens(*s2.RegionTermIndexer) []string
}

// ------------------------------------------------------------------------
// s2TokenizableEx is an optional interface for shapes that support
// the generation of s2 based tokens that can be used for both
// indexing and querying. This is intended for the older geopoint
// indexing and querying.
type s2TokenizableEx interface {
	// IndexTokens returns the tokens for indexing.
	IndexTokens(*S2SpatialAnalyzerPlugin) []string

	// QueryTokens returns the tokens for searching.
	QueryTokens(*S2SpatialAnalyzerPlugin) []string
}

//----------------------------------------------------------------------------------

func (p *Point) Type() string {
	return PointType
}

func (p *Point) Value() ([]byte, error) {
	return util.MarshalJSON(p)
}

func (p *Point) Intersects(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (p *Point) Contains(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (p *Point) IndexTokens(s *S2SpatialAnalyzerPlugin) []string {
	return s.s2GeoPointsRegionTermIndexer.GetIndexTermsForPoint(s2.PointFromLatLng(
		s2.LatLngFromDegrees(p.Lat, p.Lon)), "")
}

func (p *Point) QueryTokens(s *S2SpatialAnalyzerPlugin) []string {
	return nil
}

//----------------------------------------------------------------------------------

type boundedRectangle struct {
	minLat float64
	maxLat float64
	minLon float64
	maxLon float64
}

func NewBoundedRectangle(minLat, minLon, maxLat,
	maxLon float64) *boundedRectangle {
	return &boundedRectangle{minLat: minLat,
		maxLat: maxLat, minLon: minLon, maxLon: maxLon}
}

func (br *boundedRectangle) Type() string {
	// placeholder implementation
	return "boundedRectangle"
}

func (br *boundedRectangle) Value() ([]byte, error) {
	return util.MarshalJSON(br)
}

func (p *boundedRectangle) Intersects(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (p *boundedRectangle) Contains(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (br *boundedRectangle) IndexTokens(s *S2SpatialAnalyzerPlugin) []string {
	return nil
}

func (br *boundedRectangle) QueryTokens(s *S2SpatialAnalyzerPlugin) []string {
	rect := s2.RectFromDegrees(br.minLat, br.minLon, br.maxLat, br.maxLon)

	// obtain the terms to be searched for the given bounding box.
	terms := s.s2GeoPointsRegionTermIndexer.GetQueryTermsForRegion(rect, "")

	return geojson.StripCoveringTerms(terms)
}

//----------------------------------------------------------------------------------

type boundedPolygon struct {
	coordinates []Point
}

func NewBoundedPolygon(coordinates []Point) *boundedPolygon {
	return &boundedPolygon{coordinates: coordinates}
}

func (bp *boundedPolygon) Type() string {
	// placeholder implementation
	return "boundedPolygon"
}

func (bp *boundedPolygon) Value() ([]byte, error) {
	return util.MarshalJSON(bp)
}

func (p *boundedPolygon) Intersects(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (p *boundedPolygon) Contains(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (bp *boundedPolygon) IndexTokens(s *S2SpatialAnalyzerPlugin) []string {
	return nil
}

func (bp *boundedPolygon) QueryTokens(s *S2SpatialAnalyzerPlugin) []string {
	vertices := make([]s2.Point, len(bp.coordinates))
	for i, point := range bp.coordinates {
		vertices[i] = s2.PointFromLatLng(
			s2.LatLngFromDegrees(point.Lat, point.Lon))
	}
	s2polygon := s2.PolygonFromOrientedLoops([]*s2.Loop{s2.LoopFromPoints(vertices)})

	// obtain the terms to be searched for the given polygon.
	terms := s.s2GeoPointsRegionTermIndexer.GetQueryTermsForRegion(
		s2polygon.CapBound(), "")

	return geojson.StripCoveringTerms(terms)
}

//----------------------------------------------------------------------------------

type pointDistance struct {
	dist      float64
	centerLat float64
	centerLon float64
}

func (p *pointDistance) Type() string {
	// placeholder implementation
	return "pointDistance"
}

func (p *pointDistance) Value() ([]byte, error) {
	return util.MarshalJSON(p)
}

func NewPointDistance(centerLat, centerLon,
	dist float64) *pointDistance {
	return &pointDistance{centerLat: centerLat,
		centerLon: centerLon, dist: dist}
}

func (p *pointDistance) Intersects(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (p *pointDistance) Contains(s index.GeoJSON) (bool, error) {
	// placeholder implementation
	return false, nil
}

func (pd *pointDistance) IndexTokens(s *S2SpatialAnalyzerPlugin) []string {
	return nil
}

func (pd *pointDistance) QueryTokens(s *S2SpatialAnalyzerPlugin) []string {
	// obtain the covering query region from the given points.
	queryRegion := s2.CapFromCenterAndRadius(pd.centerLat,
		pd.centerLon, pd.dist)

	// obtain the query terms for the query region.
	terms := s.s2GeoPointsRegionTermIndexer.GetQueryTermsForRegion(queryRegion, "")

	return geojson.StripCoveringTerms(terms)
}

// ------------------------------------------------------------------------

// NewGeometryCollection instantiate a geometrycollection
// and prefix the byte contents with certain glue bytes that
// can be used later while filering the doc values.
func NewGeometryCollection(coordinates [][][][][]float64,
	typs []string) (index.GeoJSON, []byte, error) {
	shapes := make([]*geojson.GeoShape, len(coordinates))
	for i := range coordinates {
		shapes[i] = &geojson.GeoShape{
			Coordinates: coordinates[i],
			Type:        typs[i],
		}
	}

	return geojson.NewGeometryCollection(shapes)
}

func NewGeometryCollectionFromShapes(shapes []*geojson.GeoShape) (
	index.GeoJSON, []byte, error) {

	return geojson.NewGeometryCollection(shapes)
}

// NewGeoCircleShape instantiate a circle shape and
// prefix the byte contents with certain glue bytes that
// can be used later while filering the doc values.
func NewGeoCircleShape(cp []float64,
	radius string) (index.GeoJSON, []byte, error) {
	return geojson.NewGeoCircleShape(cp, radius)
}

func NewGeoJsonShape(coordinates [][][][]float64, typ string) (
	index.GeoJSON, []byte, error) {
	return geojson.NewGeoJsonShape(coordinates, typ)
}

func NewGeoJsonPoint(points []float64) index.GeoJSON {
	return geojson.NewGeoJsonPoint(points)
}

func NewGeoJsonMultiPoint(points [][]float64) index.GeoJSON {
	return geojson.NewGeoJsonMultiPoint(points)
}

func NewGeoJsonLinestring(points [][]float64) index.GeoJSON {
	return geojson.NewGeoJsonLinestring(points)
}

func NewGeoJsonMultilinestring(points [][][]float64) index.GeoJSON {
	return geojson.NewGeoJsonMultilinestring(points)
}

func NewGeoJsonPolygon(points [][][]float64) index.GeoJSON {
	return geojson.NewGeoJsonPolygon(points)
}

func NewGeoJsonMultiPolygon(points [][][][]float64) index.GeoJSON {
	return geojson.NewGeoJsonMultiPolygon(points)
}

func NewGeoCircle(points []float64, radius string) index.GeoJSON {
	return geojson.NewGeoCircle(points, radius)
}

func NewGeoEnvelope(points [][]float64) index.GeoJSON {
	return geojson.NewGeoEnvelope(points)
}

func ParseGeoJSONShape(input json.RawMessage) (index.GeoJSON, error) {
	return geojson.ParseGeoJSONShape(input)
}
