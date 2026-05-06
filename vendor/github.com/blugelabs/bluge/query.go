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

package bluge

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/blugelabs/bluge/search/similarity"

	"github.com/blugelabs/bluge/analysis"
	"github.com/blugelabs/bluge/analysis/tokenizer"
	"github.com/blugelabs/bluge/numeric"
	"github.com/blugelabs/bluge/numeric/geo"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/searcher"
)

// A Query represents a description of the type
// and parameters for a query into the index.
type Query interface {
	Searcher(i search.Reader,
		options search.SearcherOptions) (search.Searcher, error)
}

type querySlice []Query

func (s querySlice) searchers(i search.Reader, options search.SearcherOptions) (rv []search.Searcher, err error) {
	for _, q := range s {
		var sr search.Searcher
		sr, err = q.Searcher(i, options)
		if err != nil {
			// close all the already opened searchers
			for _, rvs := range rv {
				_ = rvs.Close()
			}
			return nil, err
		}
		rv = append(rv, sr)
	}
	return rv, nil
}

func (s querySlice) disjunction(i search.Reader, options search.SearcherOptions, min int) (search.Searcher, error) {
	constituents, err := s.searchers(i, options)
	if err != nil {
		return nil, err
	}
	return searcher.NewDisjunctionSearcher(i, constituents, min, similarity.NewCompositeSumScorer(), options)
}

func (s querySlice) conjunction(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	constituents, err := s.searchers(i, options)
	if err != nil {
		return nil, err
	}
	return searcher.NewConjunctionSearcher(i, constituents, similarity.NewCompositeSumScorer(), options)
}

type validatableQuery interface {
	Query
	Validate() error
}

type boost float64

func (b *boost) Value() float64 {
	if b == nil {
		return 1
	}
	return float64(*b)
}

type BooleanQuery struct {
	musts     querySlice
	shoulds   querySlice
	mustNots  querySlice
	boost     *boost
	scorer    search.CompositeScorer
	minShould int
}

// NewBooleanQuery creates a compound Query composed
// of several other Query objects.
// These other query objects are added using the
// AddMust() AddShould() and AddMustNot() methods.
// Result documents must satisfy ALL of the
// must Queries.
// Result documents must satisfy NONE of the must not
// Queries.
// Result documents that ALSO satisfy any of the should
// Queries will score higher.
func NewBooleanQuery() *BooleanQuery {
	return &BooleanQuery{}
}

// SetMinShould requires that at least minShould of the
// should Queries must be satisfied.
func (q *BooleanQuery) SetMinShould(minShould int) *BooleanQuery {
	q.minShould = minShould
	return q
}

func (q *BooleanQuery) AddMust(m ...Query) *BooleanQuery {
	q.musts = append(q.musts, m...)
	return q
}

// Musts returns the queries that the documents must match
func (q *BooleanQuery) Musts() []Query {
	return q.musts
}

func (q *BooleanQuery) AddShould(m ...Query) *BooleanQuery {
	q.shoulds = append(q.shoulds, m...)
	return q
}

// Shoulds returns queries that the documents may match
func (q *BooleanQuery) Shoulds() []Query {
	return q.shoulds
}

func (q *BooleanQuery) AddMustNot(m ...Query) *BooleanQuery {
	q.mustNots = append(q.mustNots, m...)
	return q
}

// MustNots returns queries that the documents must not match
func (q *BooleanQuery) MustNots() []Query {
	return q.mustNots
}

// MinShould returns the minimum number of should queries that need to match
func (q *BooleanQuery) MinShould() int {
	return q.minShould
}

func (q *BooleanQuery) SetBoost(b float64) *BooleanQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *BooleanQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *BooleanQuery) initPrimarySearchers(i search.Reader, options search.SearcherOptions) (
	mustSearcher, shouldSearcher, mustNotSearcher search.Searcher, err error) {
	if len(q.mustNots) > 0 {
		mustNotSearcher, err = q.mustNots.disjunction(i, options, 1)
		if err != nil {
			return nil, nil, nil, err
		}
	}

	if len(q.musts) > 0 {
		mustSearcher, err = q.musts.conjunction(i, options)
		if err != nil {
			if mustNotSearcher != nil {
				_ = mustNotSearcher.Close()
			}
			return nil, nil, nil, err
		}
	}

	if len(q.shoulds) > 0 {
		shouldSearcher, err = q.shoulds.disjunction(i, options, q.minShould)
		if err != nil {
			if mustNotSearcher != nil {
				_ = mustNotSearcher.Close()
			}
			if mustSearcher != nil {
				_ = mustSearcher.Close()
			}
			return nil, nil, nil, err
		}
	}

	return mustSearcher, shouldSearcher, mustNotSearcher, nil
}

func (q *BooleanQuery) Searcher(i search.Reader, options search.SearcherOptions) (rv search.Searcher, err error) {
	mustSearcher, shouldSearcher, mustNotSearcher, err := q.initPrimarySearchers(i, options)
	if err != nil {
		return nil, err
	}

	mustSearcher = replaceMatchNoneWithNil(mustSearcher)
	shouldSearcher = replaceMatchNoneWithNil(shouldSearcher)
	mustNotSearcher = replaceMatchNoneWithNil(mustNotSearcher)

	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher == nil {
		// if all 3 are nil, return MatchNone
		return searcher.NewMatchNoneSearcher(i, options)
		// } else if mustSearcher == nil && shouldSearcher != nil && mustNotSearcher == nil {
		//	DISABLED optimization, if only should searcher, just return it instead
		//  While logically correct, returning the shouldSearcher looses the desired boost.
		//	return shouldSearcher, nil
	} else if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher != nil {
		// if only mustNotSearcher, start with MatchAll
		var err error
		mustSearcher, err = searcher.NewMatchAllSearcher(i, 1, similarity.ConstantScorer(1), options)
		if err != nil {
			return nil, err
		}
	}

	if q.scorer == nil {
		q.scorer = similarity.NewCompositeSumScorerWithBoost(q.boost.Value())
	}

	return searcher.NewBooleanSearcher(mustSearcher, shouldSearcher, mustNotSearcher, q.scorer, options)
}

func replaceMatchNoneWithNil(s search.Searcher) search.Searcher {
	if _, ok := s.(*searcher.MatchNoneSearcher); ok {
		return nil
	}
	return s
}

func (q *BooleanQuery) Validate() error {
	if len(q.musts) > 0 {
		for _, mq := range q.musts {
			if mq, ok := mq.(validatableQuery); ok {
				err := mq.Validate()
				if err != nil {
					return err
				}
			}
		}
	}
	if len(q.shoulds) > 0 {
		for _, sq := range q.shoulds {
			if sq, ok := sq.(validatableQuery); ok {
				err := sq.Validate()
				if err != nil {
					return err
				}
			}
		}
	}
	if len(q.mustNots) > 0 {
		for _, mnq := range q.mustNots {
			if mnq, ok := mnq.(validatableQuery); ok {
				err := mnq.Validate()
				if err != nil {
					return err
				}
			}
		}
	}
	if len(q.musts) == 0 && len(q.shoulds) == 0 && len(q.mustNots) == 0 {
		return fmt.Errorf("boolean query must contain at least one must or should or not must clause")
	}
	return nil
}

type DateRangeQuery struct {
	start          time.Time
	end            time.Time
	inclusiveStart bool
	inclusiveEnd   bool
	field          string
	boost          *boost
	scorer         search.Scorer
}

// NewDateRangeQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser configured in the
//  top-level config.QueryDateTimeParser
// Either, but not both endpoints can be nil.
func NewDateRangeQuery(start, end time.Time) *DateRangeQuery {
	return NewDateRangeInclusiveQuery(start, end, true, false)
}

// NewDateRangeInclusiveQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser configured in the
//  top-level config.QueryDateTimeParser
// Either, but not both endpoints can be nil.
// startInclusive and endInclusive control inclusion of the endpoints.
func NewDateRangeInclusiveQuery(start, end time.Time, startInclusive, endInclusive bool) *DateRangeQuery {
	return &DateRangeQuery{
		start:          start,
		end:            end,
		inclusiveStart: startInclusive,
		inclusiveEnd:   endInclusive,
	}
}

// Start returns the date range start and if the start is included in the query
func (q *DateRangeQuery) Start() (time.Time, bool) {
	return q.start, q.inclusiveStart
}

// End returns the date range end and if the end is included in the query
func (q *DateRangeQuery) End() (time.Time, bool) {
	return q.end, q.inclusiveEnd
}

func (q *DateRangeQuery) SetBoost(b float64) *DateRangeQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *DateRangeQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *DateRangeQuery) SetField(f string) *DateRangeQuery {
	q.field = f
	return q
}

func (q *DateRangeQuery) Field() string {
	return q.field
}

func (q *DateRangeQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	min, max, err := q.parseEndpoints()
	if err != nil {
		return nil, err
	}

	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	if q.scorer == nil {
		q.scorer = similarity.ConstantScorer(1)
	}

	return searcher.NewNumericRangeSearcher(i, min, max, q.inclusiveStart, q.inclusiveEnd, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *DateRangeQuery) parseEndpoints() (min, max float64, err error) {
	min = math.Inf(-1)
	max = math.Inf(1)
	if !q.start.IsZero() {
		if !isDatetimeCompatible(q.start) {
			// overflow
			return 0, 0, fmt.Errorf("invalid/unsupported date range, start: %v", q.start)
		}
		startInt64 := q.start.UnixNano()
		min = numeric.Int64ToFloat64(startInt64)
	}
	if !q.end.IsZero() {
		if !isDatetimeCompatible(q.end) {
			// overflow
			return 0, 0, fmt.Errorf("invalid/unsupported date range, end: %v", q.end)
		}
		endInt64 := q.end.UnixNano()
		max = numeric.Int64ToFloat64(endInt64)
	}

	return min, max, nil
}

func (q *DateRangeQuery) Validate() error {
	if q.start.IsZero() && q.end.IsZero() {
		return fmt.Errorf("must specify start or end")
	}
	_, _, err := q.parseEndpoints()
	if err != nil {
		return err
	}
	return nil
}

func isDatetimeCompatible(t time.Time) bool {
	if t.Before(time.Unix(0, math.MinInt64)) || t.After(time.Unix(0, math.MaxInt64)) {
		return false
	}

	return true
}

type FuzzyQuery struct {
	term      string
	prefix    int
	fuzziness int
	field     string
	boost     *boost
	scorer    search.Scorer
}

// NewFuzzyQuery creates a new Query which finds
// documents containing terms within a specific
// fuzziness of the specified term.
// The default fuzziness is 1.
//
// The current implementation uses Levenshtein edit
// distance as the fuzziness metric.
func NewFuzzyQuery(term string) *FuzzyQuery {
	return &FuzzyQuery{
		term:      term,
		fuzziness: 1,
	}
}

// Term returns the term being queried
func (q *FuzzyQuery) Term() string {
	return q.term
}

// PrefixLen returns the prefix match value
func (q *FuzzyQuery) Prefix() int {
	return q.prefix
}

// Fuzziness returns the fuzziness of the query
func (q *FuzzyQuery) Fuzziness() int {
	return q.fuzziness
}

func (q *FuzzyQuery) SetBoost(b float64) *FuzzyQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *FuzzyQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *FuzzyQuery) SetField(f string) *FuzzyQuery {
	q.field = f
	return q
}

func (q *FuzzyQuery) Field() string {
	return q.field
}

func (q *FuzzyQuery) SetFuzziness(f int) *FuzzyQuery {
	q.fuzziness = f
	return q
}

func (q *FuzzyQuery) SetPrefix(p int) *FuzzyQuery {
	q.prefix = p
	return q
}

func (q *FuzzyQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}
	return searcher.NewFuzzySearcher(i, q.term, q.prefix, q.fuzziness, field, q.boost.Value(),
		q.scorer, similarity.NewCompositeSumScorer(), options)
}

type GeoBoundingBoxQuery struct {
	topLeft     []float64
	bottomRight []float64
	field       string
	boost       *boost
	scorer      search.Scorer
}

// NewGeoBoundingBoxQuery creates a new Query for performing geo bounding
// box searches. The arguments describe the position of the box and documents
// which have an indexed geo point inside the box will be returned.
func NewGeoBoundingBoxQuery(topLeftLon, topLeftLat, bottomRightLon, bottomRightLat float64) *GeoBoundingBoxQuery {
	return &GeoBoundingBoxQuery{
		topLeft:     []float64{topLeftLon, topLeftLat},
		bottomRight: []float64{bottomRightLon, bottomRightLat},
	}
}

// TopLeft returns the start corner of the bounding box
func (q *GeoBoundingBoxQuery) TopLeft() []float64 {
	return q.topLeft
}

// BottomRight returns the end cornder of the bounding box
func (q *GeoBoundingBoxQuery) BottomRight() []float64 {
	return q.bottomRight
}

func (q *GeoBoundingBoxQuery) SetBoost(b float64) *GeoBoundingBoxQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *GeoBoundingBoxQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *GeoBoundingBoxQuery) SetField(f string) *GeoBoundingBoxQuery {
	q.field = f
	return q
}

func (q *GeoBoundingBoxQuery) Field() string {
	return q.field
}

const (
	minLon = -180
	maxLon = 180
)

func (q *GeoBoundingBoxQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	if q.scorer == nil {
		q.scorer = similarity.ConstantScorer(1)
	}

	if q.bottomRight[0] < q.topLeft[0] {
		// cross date line, rewrite as two parts

		leftSearcher, err := searcher.NewGeoBoundingBoxSearcher(i,
			minLon, q.bottomRight[1], q.bottomRight[0], q.topLeft[1],
			field, q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(),
			options, true, geoPrecisionStep)
		if err != nil {
			return nil, err
		}
		rightSearcher, err := searcher.NewGeoBoundingBoxSearcher(i,
			q.topLeft[0], q.bottomRight[1], maxLon, q.topLeft[1],
			field, q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(),
			options, true, geoPrecisionStep)
		if err != nil {
			_ = leftSearcher.Close()
			return nil, err
		}

		return searcher.NewDisjunctionSearcher(i, []search.Searcher{leftSearcher, rightSearcher},
			0, similarity.NewCompositeSumScorer(), options)
	}

	return searcher.NewGeoBoundingBoxSearcher(i, q.topLeft[0], q.bottomRight[1], q.bottomRight[0], q.topLeft[1],
		field, q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(),
		options, true, geoPrecisionStep)
}

func (q *GeoBoundingBoxQuery) Validate() error {
	return nil
}

type GeoDistanceQuery struct {
	location []float64
	distance string
	field    string
	boost    *boost
	scorer   search.Scorer
}

// NewGeoDistanceQuery creates a new Query for performing geo distance
// searches. The arguments describe a position and a distance. Documents
// which have an indexed geo point which is less than or equal to the provided
// distance from the given position will be returned.
func NewGeoDistanceQuery(lon, lat float64, distance string) *GeoDistanceQuery {
	return &GeoDistanceQuery{
		location: []float64{lon, lat},
		distance: distance,
	}
}

// Location returns the location being queried
func (q *GeoDistanceQuery) Location() []float64 {
	return q.location
}

// Distance returns the distance being queried
func (q *GeoDistanceQuery) Distance() string {
	return q.distance
}

func (q *GeoDistanceQuery) SetBoost(b float64) *GeoDistanceQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *GeoDistanceQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *GeoDistanceQuery) SetField(f string) *GeoDistanceQuery {
	q.field = f
	return q
}

func (q *GeoDistanceQuery) Field() string {
	return q.field
}

func (q *GeoDistanceQuery) Searcher(i search.Reader,
	options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	dist, err := geo.ParseDistance(q.distance)
	if err != nil {
		return nil, err
	}

	return searcher.NewGeoPointDistanceSearcher(i, q.location[0], q.location[1], dist,
		field, q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options, geoPrecisionStep)
}

func (q *GeoDistanceQuery) Validate() error {
	return nil
}

type GeoBoundingPolygonQuery struct {
	points []geo.Point
	field  string
	boost  *boost
	scorer search.Scorer
}

// FIXME document like the others
func NewGeoBoundingPolygonQuery(points []geo.Point) *GeoBoundingPolygonQuery {
	return &GeoBoundingPolygonQuery{
		points: points}
}

// Points returns all the points being queried inside the bounding box
func (q *GeoBoundingPolygonQuery) Points() []geo.Point {
	return q.points
}

func (q *GeoBoundingPolygonQuery) SetBoost(b float64) *GeoBoundingPolygonQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *GeoBoundingPolygonQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *GeoBoundingPolygonQuery) SetField(f string) *GeoBoundingPolygonQuery {
	q.field = f
	return q
}

func (q *GeoBoundingPolygonQuery) Field() string {
	return q.field
}

func (q *GeoBoundingPolygonQuery) Searcher(i search.Reader,
	options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	return searcher.NewGeoBoundedPolygonSearcher(i, q.points, field, q.boost.Value(),
		q.scorer, similarity.NewCompositeSumScorer(), options, geoPrecisionStep)
}

func (q *GeoBoundingPolygonQuery) Validate() error {
	return nil
}

type MatchAllQuery struct {
	boost *boost
}

// NewMatchAllQuery creates a Query which will
// match all documents in the index.
func NewMatchAllQuery() *MatchAllQuery {
	return &MatchAllQuery{}
}

func (q *MatchAllQuery) SetBoost(b float64) *MatchAllQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *MatchAllQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *MatchAllQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	return searcher.NewMatchAllSearcher(i, q.boost.Value(), similarity.ConstantScorer(1), options)
}

type MatchNoneQuery struct {
	boost *boost
}

// NewMatchNoneQuery creates a Query which will not
// match any documents in the index.
func NewMatchNoneQuery() *MatchNoneQuery {
	return &MatchNoneQuery{}
}

func (q *MatchNoneQuery) SetBoost(b float64) *MatchNoneQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *MatchNoneQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *MatchNoneQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	return searcher.NewMatchNoneSearcher(i, options)
}

type MatchPhraseQuery struct {
	matchPhrase string
	field       string
	analyzer    *analysis.Analyzer
	boost       *boost
	slop        int
}

// NewMatchPhraseQuery creates a new Query object
// for matching phrases in the index.
// An Analyzer is chosen based on the field.
// Input text is analyzed using this analyzer.
// Token terms resulting from this analysis are
// used to build a search phrase.  Result documents
// must match this phrase. Queried field must have been indexed with
// IncludeTermVectors set to true.
func NewMatchPhraseQuery(matchPhrase string) *MatchPhraseQuery {
	return &MatchPhraseQuery{
		matchPhrase: matchPhrase,
	}
}

// Phrase returns the phrase being queried
func (q *MatchPhraseQuery) Phrase() string {
	return q.matchPhrase
}

func (q *MatchPhraseQuery) SetBoost(b float64) *MatchPhraseQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *MatchPhraseQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *MatchPhraseQuery) SetField(f string) *MatchPhraseQuery {
	q.field = f
	return q
}

func (q *MatchPhraseQuery) Field() string {
	return q.field
}

// Slop returns the acceptable distance between tokens
func (q *MatchPhraseQuery) Slop() int {
	return q.slop
}

// SetSlop updates the sloppyness of the query
// the phrase terms can be as "dist" terms away from each other
func (q *MatchPhraseQuery) SetSlop(dist int) *MatchPhraseQuery {
	q.slop = dist
	return q
}

func (q *MatchPhraseQuery) SetAnalyzer(a *analysis.Analyzer) *MatchPhraseQuery {
	q.analyzer = a
	return q
}

func (q *MatchPhraseQuery) Analyzer() *analysis.Analyzer {
	return q.analyzer
}

func (q *MatchPhraseQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	var tokens analysis.TokenStream
	if q.analyzer != nil {
		tokens = q.analyzer.Analyze([]byte(q.matchPhrase))
	} else if options.DefaultAnalyzer != nil {
		tokens = options.DefaultAnalyzer.Analyze([]byte(q.matchPhrase))
	} else {
		tokens = tokenizer.MakeTokenStream([]byte(q.matchPhrase))
	}

	if len(tokens) > 0 {
		phrase := tokenStreamToPhrase(tokens)
		phraseQuery := NewMultiPhraseQuery(phrase)
		phraseQuery.SetField(field)
		phraseQuery.SetBoost(q.boost.Value())
		phraseQuery.SetSlop(q.slop)
		return phraseQuery.Searcher(i, options)
	}
	noneQuery := NewMatchNoneQuery()
	return noneQuery.Searcher(i, options)
}

func tokenStreamToPhrase(tokens analysis.TokenStream) [][]string {
	firstPosition := int(^uint(0) >> 1)
	lastPosition := 0
	var currPosition int
	for _, token := range tokens {
		currPosition += token.PositionIncr
		if currPosition < firstPosition {
			firstPosition = currPosition
		}
		if currPosition > lastPosition {
			lastPosition = currPosition
		}
	}
	phraseLen := lastPosition - firstPosition + 1
	if phraseLen > 0 {
		rv := make([][]string, phraseLen)
		currPosition = 0
		for _, token := range tokens {
			currPosition += token.PositionIncr
			pos := currPosition - firstPosition
			rv[pos] = append(rv[pos], string(token.Term))
		}
		return rv
	}
	return nil
}

type MatchQueryOperator int

const (
	// Document must satisfy AT LEAST ONE of term searches.
	MatchQueryOperatorOr = 0
	// Document must satisfy ALL of term searches.
	MatchQueryOperatorAnd = 1
)

type MatchQuery struct {
	match     string
	field     string
	analyzer  *analysis.Analyzer
	boost     *boost
	prefix    int
	fuzziness int
	operator  MatchQueryOperator
}

// NewMatchQuery creates a Query for matching text.
// An Analyzer is chosen based on the field.
// Input text is analyzed using this analyzer.
// Token terms resulting from this analysis are
// used to perform term searches.  Result documents
// must satisfy at least one of these term searches.
func NewMatchQuery(match string) *MatchQuery {
	return &MatchQuery{
		match:    match,
		operator: MatchQueryOperatorOr,
	}
}

// Match returns the term being queried
func (q *MatchQuery) Match() string {
	return q.match
}

func (q *MatchQuery) SetBoost(b float64) *MatchQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *MatchQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *MatchQuery) SetField(f string) *MatchQuery {
	q.field = f
	return q
}

func (q *MatchQuery) Field() string {
	return q.field
}

func (q *MatchQuery) SetFuzziness(f int) *MatchQuery {
	q.fuzziness = f
	return q
}

func (q *MatchQuery) Fuzziness() int {
	return q.fuzziness
}

func (q *MatchQuery) SetPrefix(p int) *MatchQuery {
	q.prefix = p
	return q
}

func (q *MatchQuery) Prefix() int {
	return q.prefix
}

func (q *MatchQuery) Analyzer() *analysis.Analyzer {
	return q.analyzer
}

func (q *MatchQuery) SetAnalyzer(a *analysis.Analyzer) *MatchQuery {
	q.analyzer = a
	return q
}

func (q *MatchQuery) SetOperator(operator MatchQueryOperator) *MatchQuery {
	q.operator = operator
	return q
}

func (q *MatchQuery) Operator() MatchQueryOperator {
	return q.operator
}

func (q *MatchQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	var tokens analysis.TokenStream
	if q.analyzer != nil {
		tokens = q.analyzer.Analyze([]byte(q.match))
	} else if options.DefaultAnalyzer != nil {
		tokens = options.DefaultAnalyzer.Analyze([]byte(q.match))
	} else {
		tokens = tokenizer.MakeTokenStream([]byte(q.match))
	}

	if len(tokens) > 0 {
		tqs := make([]Query, len(tokens))
		if q.fuzziness != 0 {
			for i, token := range tokens {
				query := NewFuzzyQuery(string(token.Term))
				query.SetFuzziness(q.fuzziness)
				query.SetPrefix(q.prefix)
				query.SetField(field)
				query.SetBoost(q.boost.Value())
				tqs[i] = query
			}
		} else {
			for i, token := range tokens {
				tq := NewTermQuery(string(token.Term))
				tq.SetField(field)
				tq.SetBoost(q.boost.Value())
				tqs[i] = tq
			}
		}

		switch q.operator {
		case MatchQueryOperatorOr:
			booleanQuery := NewBooleanQuery()
			booleanQuery.AddShould(tqs...)
			booleanQuery.SetMinShould(1)
			booleanQuery.SetBoost(q.boost.Value())
			return booleanQuery.Searcher(i, options)

		case MatchQueryOperatorAnd:
			booleanQuery := NewBooleanQuery()
			booleanQuery.AddMust(tqs...)
			booleanQuery.SetBoost(q.boost.Value())
			return booleanQuery.Searcher(i, options)

		default:
			return nil, fmt.Errorf("unhandled operator %d", q.operator)
		}
	}
	noneQuery := NewMatchNoneQuery()
	return noneQuery.Searcher(i, options)
}

type MultiPhraseQuery struct {
	terms  [][]string
	field  string
	boost  *boost
	scorer search.Scorer
	slop   int
}

// NewMultiPhraseQuery creates a new Query for finding
// term phrases in the index.
// It is like PhraseQuery, but each position in the
// phrase may be satisfied by a list of terms
// as opposed to just one.
// At least one of the terms must exist in the correct
// order, at the correct index offsets, in the
// specified field. Queried field must have been indexed with
// IncludeTermVectors set to true.
func NewMultiPhraseQuery(terms [][]string) *MultiPhraseQuery {
	return &MultiPhraseQuery{
		terms: terms,
	}
}

// Terms returns the term phrases being queried
func (q *MultiPhraseQuery) Terms() [][]string {
	return q.terms
}

func (q *MultiPhraseQuery) SetBoost(b float64) *MultiPhraseQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *MultiPhraseQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *MultiPhraseQuery) SetField(f string) *MultiPhraseQuery {
	q.field = f
	return q
}

func (q *MultiPhraseQuery) Field() string {
	return q.field
}

// Slop returns the acceptable distance between terms
func (q *MultiPhraseQuery) Slop() int {
	return q.slop
}

// SetSlop updates the sloppyness of the query
// the phrase terms can be as "dist" terms away from each other
func (q *MultiPhraseQuery) SetSlop(dist int) *MultiPhraseQuery {
	q.slop = dist
	return q
}

func (q *MultiPhraseQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	return searcher.NewSloppyMultiPhraseSearcher(i, q.terms, field, q.slop, q.scorer, options)
}

func (q *MultiPhraseQuery) Validate() error {
	if len(q.terms) < 1 {
		return fmt.Errorf("phrase query must contain at least one term")
	}
	return nil
}

type NumericRangeQuery struct {
	min          float64
	max          float64
	inclusiveMin bool
	inclusiveMax bool
	field        string
	boost        *boost
	scorer       search.Scorer
}

var MinNumeric = math.Inf(-1)
var MaxNumeric = math.Inf(1)

// NewNumericRangeQuery creates a new Query for ranges
// of numeric values.
// Either, but not both endpoints can be nil.
// The minimum value is inclusive.
// The maximum value is exclusive.
func NewNumericRangeQuery(min, max float64) *NumericRangeQuery {
	return NewNumericRangeInclusiveQuery(min, max, true, false)
}

// NewNumericRangeInclusiveQuery creates a new Query for ranges
// of numeric values.
// Either, but not both endpoints can be nil.
// Control endpoint inclusion with inclusiveMin, inclusiveMax.
func NewNumericRangeInclusiveQuery(min, max float64, minInclusive, maxInclusive bool) *NumericRangeQuery {
	return &NumericRangeQuery{
		min:          min,
		max:          max,
		inclusiveMin: minInclusive,
		inclusiveMax: maxInclusive,
	}
}

// Min returns the numeric range lower bound and if the lowerbound is included
func (q *NumericRangeQuery) Min() (float64, bool) {
	return q.min, q.inclusiveMin
}

// Max returns the numeric range upperbound and if the upperbound is included
func (q *NumericRangeQuery) Max() (float64, bool) {
	return q.max, q.inclusiveMax
}

func (q *NumericRangeQuery) SetBoost(b float64) *NumericRangeQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *NumericRangeQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *NumericRangeQuery) SetField(f string) *NumericRangeQuery {
	q.field = f
	return q
}

func (q *NumericRangeQuery) Field() string {
	return q.field
}

func (q *NumericRangeQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}
	if q.scorer == nil {
		q.scorer = similarity.ConstantScorer(q.boost.Value())
	}
	return searcher.NewNumericRangeSearcher(i, q.min, q.max, q.inclusiveMin, q.inclusiveMax, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *NumericRangeQuery) Validate() error {
	if q.min == MinNumeric && q.max == MaxNumeric {
		return fmt.Errorf("numeric range query must specify min or max")
	}
	return nil
}

type PrefixQuery struct {
	prefix string
	field  string
	boost  *boost
	scorer search.Scorer
}

// NewPrefixQuery creates a new Query which finds
// documents containing terms that start with the
// specified prefix.
func NewPrefixQuery(prefix string) *PrefixQuery {
	return &PrefixQuery{
		prefix: prefix,
	}
}

// Prefix return the prefix being queried
func (q *PrefixQuery) Prefix() string {
	return q.prefix
}

func (q *PrefixQuery) SetBoost(b float64) *PrefixQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *PrefixQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *PrefixQuery) SetField(f string) *PrefixQuery {
	q.field = f
	return q
}

func (q *PrefixQuery) Field() string {
	return q.field
}

func (q *PrefixQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}
	return searcher.NewTermPrefixSearcher(i, q.prefix, field, q.boost.Value(),
		q.scorer, similarity.NewCompositeSumScorer(), options)
}

type RegexpQuery struct {
	regexp string
	field  string
	boost  *boost
	scorer search.Scorer
}

// NewRegexpQuery creates a new Query which finds
// documents containing terms that match the
// specified regular expression.
func NewRegexpQuery(regexp string) *RegexpQuery {
	return &RegexpQuery{
		regexp: regexp,
	}
}

// Regexp returns the regular expression being queried
func (q *RegexpQuery) Regexp() string {
	return q.regexp
}

func (q *RegexpQuery) SetBoost(b float64) *RegexpQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *RegexpQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *RegexpQuery) SetField(f string) *RegexpQuery {
	q.field = f
	return q
}

func (q *RegexpQuery) Field() string {
	return q.field
}

func (q *RegexpQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	// require that pattern NOT be anchored to start and end of term.
	// do not attempt to remove trailing $, its presence is not
	// known to interfere with LiteralPrefix() the way ^ does
	// and removing $ introduces possible ambiguities with escaped \$, \\$, etc
	actualRegexp := q.regexp
	actualRegexp = strings.TrimPrefix(actualRegexp, "^")

	return searcher.NewRegexpStringSearcher(i, actualRegexp, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *RegexpQuery) Validate() error {
	return nil // real validation delayed until searcher constructor
}

type TermQuery struct {
	term   string
	field  string
	boost  *boost
	scorer search.Scorer
}

// NewTermQuery creates a new Query for finding an
// exact term match in the index.
func NewTermQuery(term string) *TermQuery {
	return &TermQuery{
		term: term,
	}
}

func (q *TermQuery) SetBoost(b float64) *TermQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *TermQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *TermQuery) SetField(f string) *TermQuery {
	q.field = f
	return q
}

func (q *TermQuery) Field() string {
	return q.field
}

// Term returns the exact term being queried
func (q *TermQuery) Term() string {
	return q.term
}

func (q *TermQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}
	return searcher.NewTermSearcher(i, q.term, field, q.boost.Value(), q.scorer, options)
}

type TermRangeQuery struct {
	min          string
	max          string
	inclusiveMin bool
	inclusiveMax bool
	field        string
	boost        *boost
	scorer       search.Scorer
}

// NewTermRangeQuery creates a new Query for ranges
// of text terms.
// Either, but not both endpoints can be "".
// The minimum value is inclusive.
// The maximum value is exclusive.
func NewTermRangeQuery(min, max string) *TermRangeQuery {
	return NewTermRangeInclusiveQuery(min, max, true, false)
}

// NewTermRangeInclusiveQuery creates a new Query for ranges
// of text terms.
// Either, but not both endpoints can be "".
// Control endpoint inclusion with inclusiveMin, inclusiveMax.
func NewTermRangeInclusiveQuery(min, max string, minInclusive, maxInclusive bool) *TermRangeQuery {
	return &TermRangeQuery{
		min:          min,
		max:          max,
		inclusiveMin: minInclusive,
		inclusiveMax: maxInclusive,
	}
}

func (q *TermRangeQuery) SetBoost(b float64) *TermRangeQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *TermRangeQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *TermRangeQuery) SetField(f string) *TermRangeQuery {
	q.field = f
	return q
}

func (q *TermRangeQuery) Field() string {
	return q.field
}

func (q *TermRangeQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}
	var minTerm []byte
	if q.min != "" {
		minTerm = []byte(q.min)
	}
	var maxTerm []byte
	if q.max != "" {
		maxTerm = []byte(q.max)
	}
	return searcher.NewTermRangeSearcher(i, minTerm, maxTerm, q.inclusiveMin, q.inclusiveMax, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *TermRangeQuery) Validate() error {
	if q.min == "" && q.max == "" {
		return fmt.Errorf("term range query must specify min or max")
	}
	return nil
}

// Min returns the query lower bound and if the lower bound is included in query
func (q *TermRangeQuery) Min() (string, bool) {
	return q.min, q.inclusiveMin
}

// Max returns the query upperbound and if the upper bound is included in the query
func (q *TermRangeQuery) Max() (string, bool) {
	return q.max, q.inclusiveMax
}

type WildcardQuery struct {
	wildcard string
	field    string
	boost    *boost
	scorer   search.Scorer
}

// NewWildcardQuery creates a new Query which finds
// documents containing terms that match the
// specified wildcard.  In the wildcard pattern '*'
// will match any sequence of 0 or more characters,
// and '?' will match any single character.
func NewWildcardQuery(wildcard string) *WildcardQuery {
	return &WildcardQuery{
		wildcard: wildcard,
	}
}

// Wildcard returns the wildcard being queried
func (q *WildcardQuery) Wildcard() string {
	return q.wildcard
}

func (q *WildcardQuery) SetBoost(b float64) *WildcardQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *WildcardQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *WildcardQuery) SetField(f string) *WildcardQuery {
	q.field = f
	return q
}

func (q *WildcardQuery) Field() string {
	return q.field
}

var wildcardRegexpReplacer = strings.NewReplacer(
	// characters in the wildcard that must
	// be escaped in the regexp
	"+", `\+`,
	"(", `\(`,
	")", `\)`,
	"^", `\^`,
	"$", `\$`,
	".", `\.`,
	"{", `\{`,
	"}", `\}`,
	"[", `\[`,
	"]", `\]`,
	`|`, `\|`,
	`\`, `\\`,
	// wildcard characters
	"*", ".*",
	"?", ".")

func (q *WildcardQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	regexpString := wildcardRegexpReplacer.Replace(q.wildcard)

	return searcher.NewRegexpStringSearcher(i, regexpString, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *WildcardQuery) Validate() error {
	return nil // real validation delayed until searcher constructor
}
