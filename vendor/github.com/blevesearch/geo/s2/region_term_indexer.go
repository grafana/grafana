// Copyright 2021 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//
// Indexing Strategy
// -----------------
//
// Given a query region, we want to find all of the document regions that
// intersect it.  The first step is to represent all the regions as S2Cell
// coverings (see S2RegionCoverer).  We then split the problem into two parts,
// namely finding the document regions that are "smaller" than the query
// region and those that are "larger" than the query region.
//
// We do this by defining two terms for each S2CellId: a "covering term" and
// an "ancestor term".  (In the implementation below, covering terms are
// distinguished by prefixing a '$' to them.)  For each document region, we
// insert a covering term for every cell in the region's covering, and we
// insert an ancestor term for these cells *and* all of their ancestors.
//
// Then given a query region, we can look up all the document regions that
// intersect its covering by querying the union of the following terms:
//
// 1. An "ancestor term" for each cell in the query region.  These terms
//    ensure that we find all document regions that are "smaller" than the
//    query region, i.e. where the query region contains a cell that is either
//    a cell of a document region or one of its ancestors.
//
// 2. A "covering term" for every ancestor of the cells in the query region.
//    These terms ensure that we find all the document regions that are
//    "larger" than the query region, i.e. where document region contains a
//    cell that is a (proper) ancestor of a cell in the query region.
//
// Together, these terms find all of the document regions that intersect the
// query region.  Furthermore, the number of terms to be indexed and queried
// are both fairly small, and can be bounded in terms of max_cells() and the
// number of cell levels used.
//
// Optimizations
// -------------
//
// + Cells at the maximum level being indexed (max_level()) have the special
//   property that they will never be an ancestor of a cell in the query
//   region.  Therefore we can safely skip generating "covering terms" for
//   these cells (see query step 2 above).
//
// + If the index will contain only points (rather than general regions), then
//   we can skip all the covering terms mentioned above because there will
//   never be any document regions larger than the query region.  This can
//   significantly reduce the size of queries.
//
// + If it is more important to optimize index size rather than query speed,
//   the number of index terms can be reduced by creating ancestor terms only
//   for the *proper* ancestors of the cells in a document region, and
//   compensating for this by including covering terms for all cells in the
//   query region (in addition to their ancestors).
//
//   Effectively, when the query region and a document region contain exactly
//   the same cell, we have a choice about whether to treat this match as a
//   "covering term" or an "ancestor term".  One choice minimizes query size
//   while the other minimizes index size.

package s2

import (
	"strings"

	"github.com/blevesearch/geo/s1"
)

type TermType int

var marker = string('$')

const (
	ANCESTOR TermType = iota + 1
	COVERING
)

var defaultMaxCells = int(8)

type Options struct {
	///////////////// Options Inherited From S2RegionCoverer ////////////////

	// maxCells controls the maximum number of cells when approximating
	// each region.  This parameter value may be changed as often as desired.
	// e.g. to approximate some regions more accurately than others.
	//
	// Increasing this value during indexing will make indexes more accurate
	// but larger.  Increasing this value for queries will make queries more
	// accurate but slower.  (See regioncoverer.go for details on how this
	// parameter affects accuracy.)  For example, if you don't mind large
	// indexes but want fast serving, it might be reasonable to set
	// max_cells() == 100 during indexing and max_cells() == 8 for queries.
	//
	// DEFAULT: 8  (coarse approximations)
	maxCells int

	// minLevel and maxLevel control the minimum and maximum size of the
	// S2Cells used to approximate regions.  Setting these parameters
	// appropriately can reduce the size of the index and speed up queries by
	// reducing the number of terms needed.  For example, if you know that
	// your query regions will rarely be less than 100 meters in width, then
	// you could set maxLevel to 100.
	//
	// This restricts the index to S2Cells that are approximately 100 meters
	// across or larger.  Similar, if you know that query regions will rarely
	// be larger than 1000km across, then you could set minLevel similarly.
	//
	// If minLevel is set too high, then large regions may generate too
	// many query terms.  If maxLevel() set too low, then small query
	// regions will not be able to discriminate which regions they intersect
	// very precisely and may return many more candidates than necessary.
	//
	// If you have no idea about the scale of the regions being queried,
	// it is perfectly fine to set minLevel to 0 and maxLevel to 30.
	// The only drawback is that may result in a larger index and slower queries.
	//
	// The default parameter values are suitable for query regions ranging
	// from about 100 meters to 3000 km across.
	//
	// DEFAULT: 4  (average cell width == 600km)
	minLevel int

	// DEFAULT: 16 (average cell width == 150m)
	maxLevel int

	// Setting levelMod to a value greater than 1 increases the effective
	// branching factor of the S2Cell hierarchy by skipping some levels.  For
	// example, if levelMod to 2 then every second level is skipped (which
	// increases the effective branching factor to 16).  You might want to
	// consider doing this if your query regions are typically very small
	// (e.g., single points) and you don't mind increasing the index size
	// (since skipping levels will reduce the accuracy of cell coverings for a
	// given maxCells limit).
	//
	// DEFAULT: 1  (don't skip any cell levels)
	levelMod int

	// If your index will only contain points (rather than regions), be sure
	// to set this flag.  This will generate smaller and faster queries that
	// are specialized for the points-only case.
	//
	// With the default quality settings, this flag reduces the number of
	// query terms by about a factor of two.  (The improvement gets smaller
	// as maxCells is increased, but there is really no reason not to use
	// this flag if your index consists entirely of points.)
	//
	// DEFAULT: false
	pointsOnly bool

	// If true, the index will be optimized for space rather than for query
	// time.  With the default quality settings, this flag reduces the number
	// of index terms and increases the number of query terms by the same
	// factor (approximately 1.3).  The factor increases up to a limiting
	// ratio of 2.0 as maxCells is increased.
	//
	// CAVEAT: This option has no effect if the index contains only points.
	//
	// DEFAULT: false
	optimizeSpace bool
}

func (o *Options) MaxCells() int {
	return o.maxCells
}

func (o *Options) SetMaxCells(mc int) {
	o.maxCells = mc
}

func (o *Options) MinLevel() int {
	return o.minLevel
}

func (o *Options) SetMinLevel(ml int) {
	o.minLevel = ml
}

func (o *Options) MaxLevel() int {
	return o.maxLevel
}

func (o *Options) SetMaxLevel(ml int) {
	o.maxLevel = ml
}

func (o *Options) LevelMod() int {
	return o.levelMod
}

func (o *Options) SetLevelMod(lm int) {
	o.levelMod = lm
}

func (o *Options) SetPointsOnly(v bool) {
	o.pointsOnly = v
}

func (o *Options) SetOptimizeSpace(v bool) {
	o.optimizeSpace = v
}

func (o *Options) trueMaxLevel() int {
	trueMax := o.maxLevel
	if o.levelMod != 1 {
		trueMax = o.maxLevel - (o.maxLevel-o.minLevel)%o.levelMod
	}
	return trueMax
}

// RegionTermIndexer is a helper struct for adding spatial data to an
// information retrieval system.  Such systems work by converting documents
// into a collection of "index terms" (e.g., representing words or phrases),
// and then building an "inverted index" that maps each term to a list of
// documents (and document positions) where that term occurs.
//
// This class deals with the problem of converting spatial data into index
// terms, which can then be indexed along with the other document information.
//
// Spatial data is represented using the S2Region type.  Useful S2Region
// subtypes include:
//
//   S2Cap
//    - a disc-shaped region
//
//   S2LatLngRect
//    - a rectangle in latitude-longitude coordinates
//
//   S2Polyline
//    - a polyline
//
//   S2Polygon
//    - a polygon, possibly with multiple holes and/or shells
//
//   S2CellUnion
//    - a region approximated as a collection of S2CellIds
//
//   S2ShapeIndexRegion
//    - an arbitrary collection of points, polylines, and polygons
//
//   S2ShapeIndexBufferedRegion
//    - like the above, but expanded by a given radius
//
//   S2RegionUnion, S2RegionIntersection
//    - the union or intersection of arbitrary other regions
//
// So for example, if you want to query documents that are within 500 meters
// of a polyline, you could use an S2ShapeIndexBufferedRegion containing the
// polyline with a radius of 500 meters.
//
// For example usage refer:
// https://github.com/google/s2geometry/blob/ad1489e898f369ca09e2099353ccd55bd0fd7a26/src/s2/s2region_term_indexer.h#L58

type RegionTermIndexer struct {
	options       Options
	regionCoverer RegionCoverer
}

func NewRegionTermIndexer() *RegionTermIndexer {
	rv := &RegionTermIndexer{
		options: Options{
			maxCells: 8,
			minLevel: 4,
			maxLevel: 16,
			levelMod: 1,
		},
	}
	return rv
}

func NewRegionTermIndexerWithOptions(option Options) *RegionTermIndexer {
	return &RegionTermIndexer{options: option}
}

func (rti *RegionTermIndexer) GetTerm(termTyp TermType, id CellID,
	prefix string) string {
	if termTyp == ANCESTOR {
		return prefix + id.ToToken()
	}
	return prefix + marker + id.ToToken()
}

func (rti *RegionTermIndexer) GetIndexTermsForPoint(p Point, prefix string) []string {
	// See the top of this file for an overview of the indexing strategy.
	//
	// The last cell generated by this loop is effectively the covering for
	// the given point.  You might expect that this cell would be indexed as a
	// covering term, but as an optimization we always index these cells as
	// ancestor terms only.  This is possible because query regions will never
	// contain a descendant of such cells.  Note that this is true even when
	// max_level() != true_max_level() (see S2RegionCoverer::Options).
	cellID := cellIDFromPoint(p)
	var rv []string
	for l := rti.options.minLevel; l <= rti.options.maxLevel; l += rti.options.levelMod {
		rv = append(rv, rti.GetTerm(ANCESTOR, cellID.Parent(l), prefix))
	}
	return rv
}

func (rti *RegionTermIndexer) GetIndexTermsForRegion(region Region,
	prefix string) []string {
	rti.regionCoverer.LevelMod = rti.options.levelMod
	rti.regionCoverer.MaxLevel = rti.options.maxLevel
	rti.regionCoverer.MinLevel = rti.options.minLevel
	rti.regionCoverer.MaxCells = rti.options.maxCells

	covering := rti.regionCoverer.Covering(region)
	return rti.GetIndexTermsForCanonicalCovering(covering, prefix)
}

func (rti *RegionTermIndexer) GetIndexTermsForCanonicalCovering(
	covering CellUnion, prefix string) []string {
	// See the top of this file for an overview of the indexing strategy.
	//
	// Cells in the covering are normally indexed as covering terms.  If we are
	// optimizing for query time rather than index space, they are also indexed
	// as ancestor terms (since this lets us reduce the number of terms in the
	// query).  Finally, as an optimization we always index true_max_level()
	// cells as ancestor cells only, since these cells have the special property
	// that query regions will never contain a descendant of these cells.
	var rv []string
	prevID := CellID(0)
	tml := rti.options.trueMaxLevel()

	for _, cellID := range covering {
		level := cellID.Level()
		if level < tml {
			rv = append(rv, rti.GetTerm(COVERING, cellID, prefix))
		}

		if level == tml || !rti.options.optimizeSpace {
			rv = append(rv, rti.GetTerm(ANCESTOR, cellID.Parent(level), prefix))
		}

		for (level - rti.options.levelMod) >= rti.options.minLevel {
			level -= rti.options.levelMod
			ancestorID := cellID.Parent(level)
			if prevID != CellID(0) && prevID.Level() > level &&
				prevID.Parent(level) == ancestorID {
				break
			}
			rv = append(rv, rti.GetTerm(ANCESTOR, ancestorID, prefix))
		}
		prevID = cellID
	}

	return rv
}

func (rti *RegionTermIndexer) GetQueryTermsForPoint(p Point, prefix string) []string {
	cellID := cellIDFromPoint(p)
	var rv []string

	level := rti.options.trueMaxLevel()
	rv = append(rv, rti.GetTerm(ANCESTOR, cellID.Parent(level), prefix))
	if rti.options.pointsOnly {
		return rv
	}

	for level >= rti.options.minLevel {
		rv = append(rv, rti.GetTerm(COVERING, cellID.Parent(level), prefix))
		level -= rti.options.levelMod
	}

	return rv
}

func (rti *RegionTermIndexer) GetQueryTermsForRegion(region Region,
	prefix string) []string {
	rti.regionCoverer.LevelMod = rti.options.levelMod
	rti.regionCoverer.MaxLevel = rti.options.maxLevel
	rti.regionCoverer.MinLevel = rti.options.minLevel
	rti.regionCoverer.MaxCells = rti.options.maxCells

	covering := rti.regionCoverer.Covering(region)
	return rti.GetQueryTermsForCanonicalCovering(covering, prefix)

}

func (rti *RegionTermIndexer) GetQueryTermsForCanonicalCovering(
	covering CellUnion, prefix string) []string {
	var rv []string
	prevID := CellID(0)
	tml := rti.options.trueMaxLevel()
	for _, cellID := range covering {
		level := cellID.Level()
		rv = append(rv, rti.GetTerm(ANCESTOR, cellID, prefix))

		if rti.options.pointsOnly {
			continue
		}

		if rti.options.optimizeSpace && level < tml {
			rv = append(rv, rti.GetTerm(COVERING, cellID, prefix))
		}

		for level-rti.options.levelMod >= rti.options.minLevel {
			level -= rti.options.levelMod
			ancestorID := cellID.Parent(level)
			if prevID != CellID(0) && prevID.Level() > level &&
				prevID.Parent(level) == ancestorID {
				break
			}
			rv = append(rv, rti.GetTerm(COVERING, ancestorID, prefix))
		}

		prevID = cellID
	}

	return rv
}

func CapFromCenterAndRadius(centerLat, centerLon, dist float64) Cap {
	return CapFromCenterAngle(PointFromLatLng(
		LatLngFromDegrees(centerLat, centerLon)), s1.Angle((dist/1000)/6378))
}

// FilterOutCoveringTerms filters out the covering terms so that
// it helps to reduce the search terms while searching in a one
// dimensional space. (point only indexing usecase)
func FilterOutCoveringTerms(terms []string) []string {
	rv := make([]string, 0, len(terms))
	for _, term := range terms {
		if strings.HasPrefix(term, marker) {
			continue
		}
		rv = append(rv, term)
	}
	return rv
}
