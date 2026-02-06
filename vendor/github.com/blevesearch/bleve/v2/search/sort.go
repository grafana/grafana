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

package search

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/util"
)

var (
	HighTerm = strings.Repeat(string(utf8.MaxRune), 3)
	LowTerm  = string([]byte{0x00})
)

type SearchSort interface {
	UpdateVisitor(field string, term []byte)
	Value(a *DocumentMatch) string
	DecodeValue(value string) string
	Descending() bool

	RequiresDocID() bool
	RequiresScoring() bool
	RequiresFields() []string

	Reverse()

	Copy() SearchSort
}

func ParseSearchSortObj(input map[string]interface{}) (SearchSort, error) {
	descending, ok := input["desc"].(bool)
	if !ok {
		descending = false
	}

	by, ok := input["by"].(string)
	if !ok {
		return nil, fmt.Errorf("search sort must specify by")
	}

	switch by {
	case "id":
		return &SortDocID{
			Desc: descending,
		}, nil
	case "score":
		return &SortScore{
			Desc: descending,
		}, nil
	case "geo_distance":
		field, ok := input["field"].(string)
		if !ok {
			return nil, fmt.Errorf("search sort mode geo_distance must specify field")
		}
		lon, lat, foundLocation := geo.ExtractGeoPoint(input["location"])
		if !foundLocation {
			return nil, fmt.Errorf("unable to parse geo_distance location")
		}
		rvd := &SortGeoDistance{
			Field:    field,
			Desc:     descending,
			Lon:      lon,
			Lat:      lat,
			unitMult: 1.0,
		}
		if distUnit, ok := input["unit"].(string); ok {
			var err error
			rvd.unitMult, err = geo.ParseDistanceUnit(distUnit)
			if err != nil {
				return nil, err
			}
			rvd.Unit = distUnit
		}
		return rvd, nil
	case "field":
		field, ok := input["field"].(string)
		if !ok {
			return nil, fmt.Errorf("search sort mode field must specify field")
		}
		rv := &SortField{
			Field: field,
			Desc:  descending,
		}
		typ, ok := input["type"].(string)
		if ok {
			switch typ {
			case "auto":
				rv.Type = SortFieldAuto
			case "string":
				rv.Type = SortFieldAsString
			case "number":
				rv.Type = SortFieldAsNumber
			case "date":
				rv.Type = SortFieldAsDate
			default:
				return nil, fmt.Errorf("unknown sort field type: %s", typ)
			}
		}
		mode, ok := input["mode"].(string)
		if ok {
			switch mode {
			case "default":
				rv.Mode = SortFieldDefault
			case "min":
				rv.Mode = SortFieldMin
			case "max":
				rv.Mode = SortFieldMax
			default:
				return nil, fmt.Errorf("unknown sort field mode: %s", mode)
			}
		}
		missing, ok := input["missing"].(string)
		if ok {
			switch missing {
			case "first":
				rv.Missing = SortFieldMissingFirst
			case "last":
				rv.Missing = SortFieldMissingLast
			default:
				return nil, fmt.Errorf("unknown sort field missing: %s", missing)
			}
		}
		return rv, nil
	}

	return nil, fmt.Errorf("unknown search sort by: %s", by)
}

func ParseSearchSortString(input string) SearchSort {
	descending := false
	if strings.HasPrefix(input, "-") {
		descending = true
		input = input[1:]
	} else if strings.HasPrefix(input, "+") {
		input = input[1:]
	}

	switch input {
	case "_id":
		return &SortDocID{
			Desc: descending,
		}
	case "_score":
		return &SortScore{
			Desc: descending,
		}
	}

	return &SortField{
		Field: input,
		Desc:  descending,
	}
}

func ParseSearchSortJSON(input json.RawMessage) (SearchSort, error) {
	// first try to parse it as string
	var sortString string
	err := util.UnmarshalJSON(input, &sortString)
	if err != nil {
		var sortObj map[string]interface{}
		err = util.UnmarshalJSON(input, &sortObj)
		if err != nil {
			return nil, err
		}
		return ParseSearchSortObj(sortObj)
	}
	return ParseSearchSortString(sortString), nil
}

func ParseSortOrderStrings(in []string) SortOrder {
	rv := make(SortOrder, 0, len(in))
	for _, i := range in {
		ss := ParseSearchSortString(i)
		rv = append(rv, ss)
	}
	return rv
}

func ParseSortOrderJSON(in []json.RawMessage) (SortOrder, error) {
	rv := make(SortOrder, 0, len(in))
	for _, i := range in {
		ss, err := ParseSearchSortJSON(i)
		if err != nil {
			return nil, err
		}
		rv = append(rv, ss)
	}
	return rv, nil
}

type SortOrder []SearchSort

func (so SortOrder) Value(doc *DocumentMatch) {
	for _, soi := range so {
		value := soi.Value(doc)
		doc.Sort = append(doc.Sort, value)
		doc.DecodedSort = append(doc.DecodedSort, soi.DecodeValue(value))
	}
}

func (so SortOrder) UpdateVisitor(field string, term []byte) {
	for _, soi := range so {
		soi.UpdateVisitor(field, term)
	}
}

func (so SortOrder) Copy() SortOrder {
	rv := make(SortOrder, len(so))
	for i, soi := range so {
		rv[i] = soi.Copy()
	}
	return rv
}

// Compare will compare two document matches using the specified sort order
// if both are numbers, we avoid converting back to term
func (so SortOrder) Compare(cachedScoring, cachedDesc []bool, i, j *DocumentMatch) int {
	// compare the documents on all search sorts until a differences is found
	for x := range so {
		c := 0
		if cachedScoring[x] {
			if i.Score < j.Score {
				c = -1
			} else if i.Score > j.Score {
				c = 1
			}
		} else {
			iVal := i.Sort[x]
			jVal := j.Sort[x]
			if iVal < jVal {
				c = -1
			} else if iVal > jVal {
				c = 1
			}
		}

		if c == 0 {
			continue
		}
		if cachedDesc[x] {
			c = -c
		}
		return c
	}
	// if they are the same at this point, impose order based on index natural sort order
	if i.HitNumber == j.HitNumber {
		return 0
	} else if i.HitNumber > j.HitNumber {
		return 1
	}
	return -1
}

func (so SortOrder) RequiresScore() bool {
	for _, soi := range so {
		if soi.RequiresScoring() {
			return true
		}
	}
	return false
}

func (so SortOrder) RequiresDocID() bool {
	for _, soi := range so {
		if soi.RequiresDocID() {
			return true
		}
	}
	return false
}

func (so SortOrder) RequiredFields() []string {
	var rv []string
	for _, soi := range so {
		rv = append(rv, soi.RequiresFields()...)
	}
	return rv
}

func (so SortOrder) CacheIsScore() []bool {
	rv := make([]bool, 0, len(so))
	for _, soi := range so {
		rv = append(rv, soi.RequiresScoring())
	}
	return rv
}

func (so SortOrder) CacheDescending() []bool {
	rv := make([]bool, 0, len(so))
	for _, soi := range so {
		rv = append(rv, soi.Descending())
	}
	return rv
}

func (so SortOrder) Reverse() {
	for _, soi := range so {
		soi.Reverse()
	}
}

// SortFieldType lets you control some internal sort behavior
// normally leaving this to the zero-value of SortFieldAuto is fine
type SortFieldType int

const (
	// SortFieldAuto applies heuristics attempt to automatically sort correctly
	SortFieldAuto SortFieldType = iota
	// SortFieldAsString forces sort as string (no prefix coded terms removed)
	SortFieldAsString
	// SortFieldAsNumber forces sort as string (prefix coded terms with shift > 0 removed)
	SortFieldAsNumber
	// SortFieldAsDate forces sort as string (prefix coded terms with shift > 0 removed)
	SortFieldAsDate
)

// SortFieldMode describes the behavior if the field has multiple values
type SortFieldMode int

const (
	// SortFieldDefault uses the first (or only) value, this is the default zero-value
	SortFieldDefault SortFieldMode = iota // FIXME name is confusing
	// SortFieldMin uses the minimum value
	SortFieldMin
	// SortFieldMax uses the maximum value
	SortFieldMax
)

// SortFieldMissing controls where documents missing a field value should be sorted
type SortFieldMissing int

const (
	// SortFieldMissingLast sorts documents missing a field at the end
	SortFieldMissingLast SortFieldMissing = iota

	// SortFieldMissingFirst sorts documents missing a field at the beginning
	SortFieldMissingFirst
)

// SortField will sort results by the value of a stored field
//
//	Field is the name of the field
//	Descending reverse the sort order (default false)
//	Type allows forcing of string/number/date behavior (default auto)
//	Mode controls behavior for multi-values fields (default first)
//	Missing controls behavior of missing values (default last)
type SortField struct {
	Field   string
	Desc    bool
	Type    SortFieldType
	Mode    SortFieldMode
	Missing SortFieldMissing
	values  [][]byte
	tmp     [][]byte
}

// UpdateVisitor notifies this sort field that in this document
// this field has the specified term
func (s *SortField) UpdateVisitor(field string, term []byte) {
	if field == s.Field {
		s.values = append(s.values, term)
	}
}

// Value returns the sort value of the DocumentMatch
// it also resets the state of this SortField for
// processing the next document
func (s *SortField) Value(i *DocumentMatch) string {
	iTerms := s.filterTermsByType(s.values)
	iTerm := s.filterTermsByMode(iTerms)
	s.values = s.values[:0]
	return iTerm
}

func (s *SortField) DecodeValue(value string) string {
	switch s.Type {
	case SortFieldAsNumber:
		i64, err := numeric.PrefixCoded(value).Int64()
		if err != nil {
			return value
		}
		return strconv.FormatFloat(numeric.Int64ToFloat64(i64), 'f', -1, 64)
	case SortFieldAsDate:
		i64, err := numeric.PrefixCoded(value).Int64()
		if err != nil {
			return value
		}
		return time.Unix(0, i64).UTC().Format(time.RFC3339Nano)
	default:
		return value
	}
}

// Descending determines the order of the sort
func (s *SortField) Descending() bool {
	return s.Desc
}

func (s *SortField) filterTermsByMode(terms [][]byte) string {
	if len(terms) == 1 || (len(terms) > 1 && s.Mode == SortFieldDefault) {
		return string(terms[0])
	} else if len(terms) > 1 {
		switch s.Mode {
		case SortFieldMin:
			sort.Sort(BytesSlice(terms))
			return string(terms[0])
		case SortFieldMax:
			sort.Sort(BytesSlice(terms))
			return string(terms[len(terms)-1])
		}
	}

	// handle missing terms
	if s.Missing == SortFieldMissingLast {
		if s.Desc {
			return LowTerm
		}
		return HighTerm
	}
	if s.Desc {
		return HighTerm
	}
	return LowTerm
}

// filterTermsByType attempts to make one pass on the terms
// if we are in auto-mode AND all the terms look like prefix-coded numbers
// return only the terms which had shift of 0
// if we are in explicit number or date mode, return only valid
// prefix coded numbers with shift of 0
func (s *SortField) filterTermsByType(terms [][]byte) [][]byte {
	stype := s.Type

	switch stype {
	case SortFieldAuto:
		allTermsPrefixCoded := true
		termsWithShiftZero := s.tmp[:0]
		for _, term := range terms {
			valid, shift := numeric.ValidPrefixCodedTermBytes(term)
			if valid && shift == 0 {
				termsWithShiftZero = append(termsWithShiftZero, term)
			} else if !valid {
				allTermsPrefixCoded = false
			}
		}
		// reset the terms only when valid zero shift terms are found.
		if allTermsPrefixCoded && len(termsWithShiftZero) > 0 {
			terms = termsWithShiftZero
			s.tmp = termsWithShiftZero[:0]
		}
	case SortFieldAsNumber, SortFieldAsDate:
		termsWithShiftZero := s.tmp[:0]
		for _, term := range terms {
			valid, shift := numeric.ValidPrefixCodedTermBytes(term)
			if valid && shift == 0 {
				termsWithShiftZero = append(termsWithShiftZero, term)
			}
		}
		terms = termsWithShiftZero
		s.tmp = termsWithShiftZero[:0]
	}

	return terms
}

// RequiresDocID says this SearchSort does not require the DocID be loaded
func (s *SortField) RequiresDocID() bool { return false }

// RequiresScoring says this SearchStore does not require scoring
func (s *SortField) RequiresScoring() bool { return false }

// RequiresFields says this SearchStore requires the specified stored field
func (s *SortField) RequiresFields() []string { return []string{s.Field} }

func (s *SortField) MarshalJSON() ([]byte, error) {
	// see if simple format can be used
	if s.Missing == SortFieldMissingLast &&
		s.Mode == SortFieldDefault &&
		s.Type == SortFieldAuto {
		if s.Desc {
			return json.Marshal("-" + s.Field)
		}
		return json.Marshal(s.Field)
	}
	sfm := map[string]interface{}{
		"by":    "field",
		"field": s.Field,
	}
	if s.Desc {
		sfm["desc"] = true
	}
	if s.Missing > SortFieldMissingLast {
		switch s.Missing {
		case SortFieldMissingFirst:
			sfm["missing"] = "first"
		}
	}
	if s.Mode > SortFieldDefault {
		switch s.Mode {
		case SortFieldMin:
			sfm["mode"] = "min"
		case SortFieldMax:
			sfm["mode"] = "max"
		}
	}
	if s.Type > SortFieldAuto {
		switch s.Type {
		case SortFieldAsString:
			sfm["type"] = "string"
		case SortFieldAsNumber:
			sfm["type"] = "number"
		case SortFieldAsDate:
			sfm["type"] = "date"
		}
	}

	return json.Marshal(sfm)
}

func (s *SortField) Copy() SearchSort {
	rv := *s
	return &rv
}

func (s *SortField) Reverse() {
	s.Desc = !s.Desc
	if s.Missing == SortFieldMissingFirst {
		s.Missing = SortFieldMissingLast
	} else {
		s.Missing = SortFieldMissingFirst
	}
}

// SortDocID will sort results by the document identifier
type SortDocID struct {
	Desc bool
}

// UpdateVisitor is a no-op for SortDocID as it's value
// is not dependent on any field terms
func (s *SortDocID) UpdateVisitor(field string, term []byte) {
}

// Value returns the sort value of the DocumentMatch
func (s *SortDocID) Value(i *DocumentMatch) string {
	return i.ID
}

func (s *SortDocID) DecodeValue(value string) string {
	return value
}

// Descending determines the order of the sort
func (s *SortDocID) Descending() bool {
	return s.Desc
}

// RequiresDocID says this SearchSort does require the DocID be loaded
func (s *SortDocID) RequiresDocID() bool { return true }

// RequiresScoring says this SearchStore does not require scoring
func (s *SortDocID) RequiresScoring() bool { return false }

// RequiresFields says this SearchStore does not require any stored fields
func (s *SortDocID) RequiresFields() []string { return nil }

func (s *SortDocID) MarshalJSON() ([]byte, error) {
	if s.Desc {
		return json.Marshal("-_id")
	}
	return json.Marshal("_id")
}

func (s *SortDocID) Copy() SearchSort {
	rv := *s
	return &rv
}

func (s *SortDocID) Reverse() {
	s.Desc = !s.Desc
}

// SortScore will sort results by the document match score
type SortScore struct {
	Desc bool
}

// UpdateVisitor is a no-op for SortScore as it's value
// is not dependent on any field terms
func (s *SortScore) UpdateVisitor(field string, term []byte) {
}

// Value returns the sort value of the DocumentMatch
func (s *SortScore) Value(i *DocumentMatch) string {
	return "_score"
}

func (s *SortScore) DecodeValue(value string) string {
	return value
}

// Descending determines the order of the sort
func (s *SortScore) Descending() bool {
	return s.Desc
}

// RequiresDocID says this SearchSort does not require the DocID be loaded
func (s *SortScore) RequiresDocID() bool { return false }

// RequiresScoring says this SearchStore does require scoring
func (s *SortScore) RequiresScoring() bool { return true }

// RequiresFields says this SearchStore does not require any store fields
func (s *SortScore) RequiresFields() []string { return nil }

func (s *SortScore) MarshalJSON() ([]byte, error) {
	if s.Desc {
		return json.Marshal("-_score")
	}
	return json.Marshal("_score")
}

func (s *SortScore) Copy() SearchSort {
	rv := *s
	return &rv
}

func (s *SortScore) Reverse() {
	s.Desc = !s.Desc
}

var maxDistance = string(numeric.MustNewPrefixCodedInt64(math.MaxInt64, 0))

// NewSortGeoDistance creates SearchSort instance for sorting documents by
// their distance from the specified point.
func NewSortGeoDistance(field, unit string, lon, lat float64, desc bool) (
	*SortGeoDistance, error,
) {
	rv := &SortGeoDistance{
		Field: field,
		Desc:  desc,
		Unit:  unit,
		Lon:   lon,
		Lat:   lat,
	}
	var err error
	rv.unitMult, err = geo.ParseDistanceUnit(unit)
	if err != nil {
		return nil, err
	}
	return rv, nil
}

// SortGeoDistance will sort results by the distance of an
// indexed geo point, from the provided location.
//
//	Field is the name of the field
//	Descending reverse the sort order (default false)
type SortGeoDistance struct {
	Field    string
	Desc     bool
	Unit     string
	values   []string
	Lon      float64
	Lat      float64
	unitMult float64
}

// UpdateVisitor notifies this sort field that in this document
// this field has the specified term
func (s *SortGeoDistance) UpdateVisitor(field string, term []byte) {
	if field == s.Field {
		s.values = append(s.values, string(term))
	}
}

// Value returns the sort value of the DocumentMatch
// it also resets the state of this SortField for
// processing the next document
func (s *SortGeoDistance) Value(i *DocumentMatch) string {
	iTerms := s.filterTermsByType(s.values)
	iTerm := s.filterTermsByMode(iTerms)
	s.values = s.values[:0]

	if iTerm == "" {
		return maxDistance
	}

	i64, err := numeric.PrefixCoded(iTerm).Int64()
	if err != nil {
		return maxDistance
	}
	docLon := geo.MortonUnhashLon(uint64(i64))
	docLat := geo.MortonUnhashLat(uint64(i64))

	dist := geo.Haversin(s.Lon, s.Lat, docLon, docLat)
	// dist is returned in km, so convert to m
	dist *= 1000
	if s.unitMult != 0 {
		dist /= s.unitMult
	}
	distInt64 := numeric.Float64ToInt64(dist)
	return string(numeric.MustNewPrefixCodedInt64(distInt64, 0))
}

func (s *SortGeoDistance) DecodeValue(value string) string {
	distInt, err := numeric.PrefixCoded(value).Int64()
	if err != nil {
		return ""
	}
	return strconv.FormatFloat(numeric.Int64ToFloat64(distInt), 'f', -1, 64)
}

// Descending determines the order of the sort
func (s *SortGeoDistance) Descending() bool {
	return s.Desc
}

func (s *SortGeoDistance) filterTermsByMode(terms []string) string {
	if len(terms) >= 1 {
		return terms[0]
	}

	return ""
}

// filterTermsByType attempts to make one pass on the terms
// return only valid prefix coded numbers with shift of 0
func (s *SortGeoDistance) filterTermsByType(terms []string) []string {
	var termsWithShiftZero []string
	for _, term := range terms {
		valid, shift := numeric.ValidPrefixCodedTerm(term)
		if valid && shift == 0 {
			termsWithShiftZero = append(termsWithShiftZero, term)
		}
	}
	return termsWithShiftZero
}

// RequiresDocID says this SearchSort does not require the DocID be loaded
func (s *SortGeoDistance) RequiresDocID() bool { return false }

// RequiresScoring says this SearchStore does not require scoring
func (s *SortGeoDistance) RequiresScoring() bool { return false }

// RequiresFields says this SearchStore requires the specified stored field
func (s *SortGeoDistance) RequiresFields() []string { return []string{s.Field} }

func (s *SortGeoDistance) MarshalJSON() ([]byte, error) {
	sfm := map[string]interface{}{
		"by":    "geo_distance",
		"field": s.Field,
		"location": map[string]interface{}{
			"lon": s.Lon,
			"lat": s.Lat,
		},
	}
	if s.Unit != "" {
		sfm["unit"] = s.Unit
	}
	if s.Desc {
		sfm["desc"] = true
	}

	return json.Marshal(sfm)
}

func (s *SortGeoDistance) Copy() SearchSort {
	rv := *s
	return &rv
}

func (s *SortGeoDistance) Reverse() {
	s.Desc = !s.Desc
}

type BytesSlice [][]byte

func (p BytesSlice) Len() int           { return len(p) }
func (p BytesSlice) Less(i, j int) bool { return bytes.Compare(p[i], p[j]) < 0 }
func (p BytesSlice) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }
