//  Copyright (c) 2014 Couchbase, Inc.
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

package bleve

import (
	"time"

	"github.com/blevesearch/bleve/v2/search/query"
)

// NewBoolFieldQuery creates a new Query for boolean fields
func NewBoolFieldQuery(val bool) *query.BoolFieldQuery {
	return query.NewBoolFieldQuery(val)
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
func NewBooleanQuery() *query.BooleanQuery {
	return query.NewBooleanQuery(nil, nil, nil)
}

// NewConjunctionQuery creates a new compound Query.
// Result documents must satisfy all of the queries.
func NewConjunctionQuery(conjuncts ...query.Query) *query.ConjunctionQuery {
	return query.NewConjunctionQuery(conjuncts)
}

// NewDateRangeQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser configured in the
//
//	top-level config.QueryDateTimeParser
//
// Either, but not both endpoints can be nil.
func NewDateRangeQuery(start, end time.Time) *query.DateRangeQuery {
	return query.NewDateRangeQuery(start, end)
}

// NewDateRangeInclusiveQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser configured in the
//
//	top-level config.QueryDateTimeParser
//
// Either, but not both endpoints can be nil.
// startInclusive and endInclusive control inclusion of the endpoints.
func NewDateRangeInclusiveQuery(start, end time.Time, startInclusive, endInclusive *bool) *query.DateRangeQuery {
	return query.NewDateRangeInclusiveQuery(start, end, startInclusive, endInclusive)
}

// NewDateRangeStringQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser set using
//
//	the DateRangeStringQuery.SetDateTimeParser() method.
//
// If no DateTimeParser is set, then the
//
//	top-level config.QueryDateTimeParser
//
// is used.
func NewDateRangeStringQuery(start, end string) *query.DateRangeStringQuery {
	return query.NewDateRangeStringQuery(start, end)
}

// NewDateRangeInclusiveStringQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser set using
//
//	the DateRangeStringQuery.SetDateTimeParser() method.
//
// this DateTimeParser is a custom date time parser defined in the index mapping,
// using AddCustomDateTimeParser() method.
// If no DateTimeParser is set, then the
//
//	top-level config.QueryDateTimeParser
//
// is used.
// Either, but not both endpoints can be nil.
// startInclusive and endInclusive control inclusion of the endpoints.
func NewDateRangeInclusiveStringQuery(start, end string, startInclusive, endInclusive *bool) *query.DateRangeStringQuery {
	return query.NewDateRangeStringInclusiveQuery(start, end, startInclusive, endInclusive)
}

// NewDisjunctionQuery creates a new compound Query.
// Result documents satisfy at least one Query.
func NewDisjunctionQuery(disjuncts ...query.Query) *query.DisjunctionQuery {
	return query.NewDisjunctionQuery(disjuncts)
}

// NewDocIDQuery creates a new Query object returning indexed documents among
// the specified set. Combine it with ConjunctionQuery to restrict the scope of
// other queries output.
func NewDocIDQuery(ids []string) *query.DocIDQuery {
	return query.NewDocIDQuery(ids)
}

// NewFuzzyQuery creates a new Query which finds
// documents containing terms within a specific
// fuzziness of the specified term.
// The default fuzziness is 1.
//
// The current implementation uses Levenshtein edit
// distance as the fuzziness metric.
func NewFuzzyQuery(term string) *query.FuzzyQuery {
	return query.NewFuzzyQuery(term)
}

// NewMatchAllQuery creates a Query which will
// match all documents in the index.
func NewMatchAllQuery() *query.MatchAllQuery {
	return query.NewMatchAllQuery()
}

// NewMatchNoneQuery creates a Query which will not
// match any documents in the index.
func NewMatchNoneQuery() *query.MatchNoneQuery {
	return query.NewMatchNoneQuery()
}

// NewMatchPhraseQuery creates a new Query object
// for matching phrases in the index.
// An Analyzer is chosen based on the field.
// Input text is analyzed using this analyzer.
// Token terms resulting from this analysis are
// used to build a search phrase.  Result documents
// must match this phrase. Queried field must have been indexed with
// IncludeTermVectors set to true.
func NewMatchPhraseQuery(matchPhrase string) *query.MatchPhraseQuery {
	return query.NewMatchPhraseQuery(matchPhrase)
}

// NewMatchQuery creates a Query for matching text.
// An Analyzer is chosen based on the field.
// Input text is analyzed using this analyzer.
// Token terms resulting from this analysis are
// used to perform term searches.  Result documents
// must satisfy at least one of these term searches.
func NewMatchQuery(match string) *query.MatchQuery {
	return query.NewMatchQuery(match)
}

// NewNumericRangeQuery creates a new Query for ranges
// of numeric values.
// Either, but not both endpoints can be nil.
// The minimum value is inclusive.
// The maximum value is exclusive.
func NewNumericRangeQuery(min, max *float64) *query.NumericRangeQuery {
	return query.NewNumericRangeQuery(min, max)
}

// NewNumericRangeInclusiveQuery creates a new Query for ranges
// of numeric values.
// Either, but not both endpoints can be nil.
// Control endpoint inclusion with inclusiveMin, inclusiveMax.
func NewNumericRangeInclusiveQuery(min, max *float64, minInclusive, maxInclusive *bool) *query.NumericRangeQuery {
	return query.NewNumericRangeInclusiveQuery(min, max, minInclusive, maxInclusive)
}

// NewTermRangeQuery creates a new Query for ranges
// of text terms.
// Either, but not both endpoints can be "".
// The minimum value is inclusive.
// The maximum value is exclusive.
func NewTermRangeQuery(min, max string) *query.TermRangeQuery {
	return query.NewTermRangeQuery(min, max)
}

// NewTermRangeInclusiveQuery creates a new Query for ranges
// of text terms.
// Either, but not both endpoints can be "".
// Control endpoint inclusion with inclusiveMin, inclusiveMax.
func NewTermRangeInclusiveQuery(min, max string, minInclusive, maxInclusive *bool) *query.TermRangeQuery {
	return query.NewTermRangeInclusiveQuery(min, max, minInclusive, maxInclusive)
}

// NewPhraseQuery creates a new Query for finding
// exact term phrases in the index.
// The provided terms must exist in the correct
// order, at the correct index offsets, in the
// specified field. Queried field must have been indexed with
// IncludeTermVectors set to true.
func NewPhraseQuery(terms []string, field string) *query.PhraseQuery {
	return query.NewPhraseQuery(terms, field)
}

// NewPrefixQuery creates a new Query which finds
// documents containing terms that start with the
// specified prefix.
func NewPrefixQuery(prefix string) *query.PrefixQuery {
	return query.NewPrefixQuery(prefix)
}

// NewRegexpQuery creates a new Query which finds
// documents containing terms that match the
// specified regular expression.
func NewRegexpQuery(regexp string) *query.RegexpQuery {
	return query.NewRegexpQuery(regexp)
}

// NewQueryStringQuery creates a new Query used for
// finding documents that satisfy a query string.  The
// query string is a small query language for humans.
func NewQueryStringQuery(q string) *query.QueryStringQuery {
	return query.NewQueryStringQuery(q)
}

// NewTermQuery creates a new Query for finding an
// exact term match in the index.
func NewTermQuery(term string) *query.TermQuery {
	return query.NewTermQuery(term)
}

// NewWildcardQuery creates a new Query which finds
// documents containing terms that match the
// specified wildcard.  In the wildcard pattern '*'
// will match any sequence of 0 or more characters,
// and '?' will match any single character.
func NewWildcardQuery(wildcard string) *query.WildcardQuery {
	return query.NewWildcardQuery(wildcard)
}

// NewGeoBoundingBoxQuery creates a new Query for performing geo bounding
// box searches. The arguments describe the position of the box and documents
// which have an indexed geo point inside the box will be returned.
func NewGeoBoundingBoxQuery(topLeftLon, topLeftLat, bottomRightLon, bottomRightLat float64) *query.GeoBoundingBoxQuery {
	return query.NewGeoBoundingBoxQuery(topLeftLon, topLeftLat, bottomRightLon, bottomRightLat)
}

// NewGeoDistanceQuery creates a new Query for performing geo distance
// searches. The arguments describe a position and a distance. Documents
// which have an indexed geo point which is less than or equal to the provided
// distance from the given position will be returned.
func NewGeoDistanceQuery(lon, lat float64, distance string) *query.GeoDistanceQuery {
	return query.NewGeoDistanceQuery(lon, lat, distance)
}

// NewIPRangeQuery creates a new Query for matching IP addresses.
// If the argument is in CIDR format, then the query will match all
// IP addresses in the network specified. If the argument is an IP address,
// then the query will return documents which contain that IP.
// Both ipv4 and ipv6 are supported.
func NewIPRangeQuery(cidr string) *query.IPRangeQuery {
	return query.NewIPRangeQuery(cidr)
}

// NewGeoShapeQuery creates a new Query for matching the given geo shape.
// This method can be used for creating geoshape queries for shape types
// like: point, linestring, polygon, multipoint, multilinestring,
// multipolygon and envelope.
func NewGeoShapeQuery(coordinates [][][][]float64, typ, relation string) (*query.GeoShapeQuery, error) {
	return query.NewGeoShapeQuery(coordinates, typ, relation)
}

// NewGeoShapeCircleQuery creates a new query for a geoshape that is a
// circle given center point and the radius. Radius formats supported:
// "5in" "5inch" "7yd" "7yards" "9ft" "9feet" "11km" "11kilometers"
// "3nm" "3nauticalmiles" "13mm" "13millimeters" "15cm" "15centimeters"
// "17mi" "17miles" "19m" "19meters" If the unit cannot be determined,
// the entire string is parsed and the unit of meters is assumed.
func NewGeoShapeCircleQuery(coordinates []float64, radius, relation string) (*query.GeoShapeQuery, error) {
	return query.NewGeoShapeCircleQuery(coordinates, radius, relation)
}

// NewGeometryCollectionQuery creates a new query for the provided
// geometrycollection coordinates and types, which could contain
// multiple geo shapes.
func NewGeometryCollectionQuery(coordinates [][][][][]float64, types []string, relation string) (*query.GeoShapeQuery, error) {
	return query.NewGeometryCollectionQuery(coordinates, types, relation)
}
