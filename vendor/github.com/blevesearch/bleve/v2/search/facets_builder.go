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
	"reflect"
	"sort"

	"github.com/blevesearch/bleve/v2/size"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeFacetsBuilder int
var reflectStaticSizeFacetResult int
var reflectStaticSizeTermFacet int
var reflectStaticSizeNumericRangeFacet int
var reflectStaticSizeDateRangeFacet int

func init() {
	var fb FacetsBuilder
	reflectStaticSizeFacetsBuilder = int(reflect.TypeOf(fb).Size())
	var fr FacetResult
	reflectStaticSizeFacetResult = int(reflect.TypeOf(fr).Size())
	var tf TermFacet
	reflectStaticSizeTermFacet = int(reflect.TypeOf(tf).Size())
	var nrf NumericRangeFacet
	reflectStaticSizeNumericRangeFacet = int(reflect.TypeOf(nrf).Size())
	var drf DateRangeFacet
	reflectStaticSizeDateRangeFacet = int(reflect.TypeOf(drf).Size())
}

type FacetBuilder interface {
	StartDoc()
	UpdateVisitor(term []byte)
	EndDoc()

	Result() *FacetResult
	Field() string

	Size() int
}

type FacetsBuilder struct {
	indexReader   index.IndexReader
	facetNames    []string
	facets        []FacetBuilder
	facetsByField map[string][]FacetBuilder
	fields        []string
}

func NewFacetsBuilder(indexReader index.IndexReader) *FacetsBuilder {
	return &FacetsBuilder{
		indexReader: indexReader,
	}
}

func (fb *FacetsBuilder) Size() int {
	sizeInBytes := reflectStaticSizeFacetsBuilder + size.SizeOfPtr

	for k, v := range fb.facets {
		sizeInBytes += size.SizeOfString + v.Size() + len(fb.facetNames[k])
	}

	for _, entry := range fb.fields {
		sizeInBytes += size.SizeOfString + len(entry)
	}

	return sizeInBytes
}

func (fb *FacetsBuilder) Add(name string, facetBuilder FacetBuilder) {
	if fb.facetsByField == nil {
		fb.facetsByField = map[string][]FacetBuilder{}
	}

	fb.facetNames = append(fb.facetNames, name)
	fb.facets = append(fb.facets, facetBuilder)
	fb.facetsByField[facetBuilder.Field()] = append(fb.facetsByField[facetBuilder.Field()], facetBuilder)
	fb.fields = append(fb.fields, facetBuilder.Field())
}

func (fb *FacetsBuilder) RequiredFields() []string {
	return fb.fields
}

func (fb *FacetsBuilder) StartDoc() {
	for _, facetBuilder := range fb.facets {
		facetBuilder.StartDoc()
	}
}

func (fb *FacetsBuilder) EndDoc() {
	for _, facetBuilder := range fb.facets {
		facetBuilder.EndDoc()
	}
}

func (fb *FacetsBuilder) UpdateVisitor(field string, term []byte) {
	if facetBuilders, ok := fb.facetsByField[field]; ok {
		for _, facetBuilder := range facetBuilders {
			facetBuilder.UpdateVisitor(term)
		}
	}
}

type TermFacet struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type TermFacets struct {
	termFacets []*TermFacet
	termLookup map[string]*TermFacet
}

func (tf *TermFacets) Terms() []*TermFacet {
	if tf == nil {
		return []*TermFacet{}
	}
	return tf.termFacets
}

func (tf *TermFacets) TrimToTopN(n int) {
	tf.termFacets = tf.termFacets[:n]
}

func (tf *TermFacets) Add(termFacets ...*TermFacet) {
	for _, termFacet := range termFacets {
		if tf.termLookup == nil {
			tf.termLookup = map[string]*TermFacet{}
		}

		if term, ok := tf.termLookup[termFacet.Term]; ok {
			term.Count += termFacet.Count
			return
		}

		// if we got here it wasn't already in the existing terms
		tf.termFacets = append(tf.termFacets, termFacet)
		tf.termLookup[termFacet.Term] = termFacet
	}
}

func (tf *TermFacets) Len() int {
	// Handle case where *TermFacets is not fully initialized in index_impl.go.init()
	if tf == nil {
		return 0
	}

	return len(tf.termFacets)
}
func (tf *TermFacets) Swap(i, j int) {
	tf.termFacets[i], tf.termFacets[j] = tf.termFacets[j], tf.termFacets[i]
}
func (tf *TermFacets) Less(i, j int) bool {
	if tf.termFacets[i].Count == tf.termFacets[j].Count {
		return tf.termFacets[i].Term < tf.termFacets[j].Term
	}
	return tf.termFacets[i].Count > tf.termFacets[j].Count
}

// TermFacets used to be a type alias for []*TermFacet.
// To maintain backwards compatibility, we have to implement custom
// JSON marshalling.
func (tf *TermFacets) MarshalJSON() ([]byte, error) {
	return util.MarshalJSON(tf.termFacets)
}

func (tf *TermFacets) UnmarshalJSON(b []byte) error {
	termFacets := []*TermFacet{}
	err := util.UnmarshalJSON(b, &termFacets)
	if err != nil {
		return err
	}

	for _, termFacet := range termFacets {
		tf.Add(termFacet)
	}

	return nil
}

type NumericRangeFacet struct {
	Name  string   `json:"name"`
	Min   *float64 `json:"min,omitempty"`
	Max   *float64 `json:"max,omitempty"`
	Count int      `json:"count"`
}

func (nrf *NumericRangeFacet) Same(other *NumericRangeFacet) bool {
	if nrf.Min == nil && other.Min != nil {
		return false
	}
	if nrf.Min != nil && other.Min == nil {
		return false
	}
	if nrf.Min != nil && other.Min != nil && *nrf.Min != *other.Min {
		return false
	}
	if nrf.Max == nil && other.Max != nil {
		return false
	}
	if nrf.Max != nil && other.Max == nil {
		return false
	}
	if nrf.Max != nil && other.Max != nil && *nrf.Max != *other.Max {
		return false
	}

	return true
}

type NumericRangeFacets []*NumericRangeFacet

func (nrf NumericRangeFacets) Add(numericRangeFacet *NumericRangeFacet) NumericRangeFacets {
	for _, existingNr := range nrf {
		if numericRangeFacet.Same(existingNr) {
			existingNr.Count += numericRangeFacet.Count
			return nrf
		}
	}
	// if we got here it wasn't already in the existing terms
	nrf = append(nrf, numericRangeFacet)
	return nrf
}

func (nrf NumericRangeFacets) Len() int      { return len(nrf) }
func (nrf NumericRangeFacets) Swap(i, j int) { nrf[i], nrf[j] = nrf[j], nrf[i] }
func (nrf NumericRangeFacets) Less(i, j int) bool {
	if nrf[i].Count == nrf[j].Count {
		return nrf[i].Name < nrf[j].Name
	}
	return nrf[i].Count > nrf[j].Count
}

type DateRangeFacet struct {
	Name  string  `json:"name"`
	Start *string `json:"start,omitempty"`
	End   *string `json:"end,omitempty"`
	Count int     `json:"count"`
}

func (drf *DateRangeFacet) Same(other *DateRangeFacet) bool {
	if drf.Start == nil && other.Start != nil {
		return false
	}
	if drf.Start != nil && other.Start == nil {
		return false
	}
	if drf.Start != nil && other.Start != nil && *drf.Start != *other.Start {
		return false
	}
	if drf.End == nil && other.End != nil {
		return false
	}
	if drf.End != nil && other.End == nil {
		return false
	}
	if drf.End != nil && other.End != nil && *drf.End != *other.End {
		return false
	}

	return true
}

type DateRangeFacets []*DateRangeFacet

func (drf DateRangeFacets) Add(dateRangeFacet *DateRangeFacet) DateRangeFacets {
	for _, existingDr := range drf {
		if dateRangeFacet.Same(existingDr) {
			existingDr.Count += dateRangeFacet.Count
			return drf
		}
	}
	// if we got here it wasn't already in the existing terms
	drf = append(drf, dateRangeFacet)
	return drf
}

func (drf DateRangeFacets) Len() int      { return len(drf) }
func (drf DateRangeFacets) Swap(i, j int) { drf[i], drf[j] = drf[j], drf[i] }
func (drf DateRangeFacets) Less(i, j int) bool {
	if drf[i].Count == drf[j].Count {
		return drf[i].Name < drf[j].Name
	}
	return drf[i].Count > drf[j].Count
}

type FacetResult struct {
	Field         string             `json:"field"`
	Total         int                `json:"total"`
	Missing       int                `json:"missing"`
	Other         int                `json:"other"`
	Terms         *TermFacets        `json:"terms,omitempty"`
	NumericRanges NumericRangeFacets `json:"numeric_ranges,omitempty"`
	DateRanges    DateRangeFacets    `json:"date_ranges,omitempty"`
}

func (fr *FacetResult) Size() int {
	return reflectStaticSizeFacetResult + size.SizeOfPtr +
		len(fr.Field) +
		fr.Terms.Len()*(reflectStaticSizeTermFacet+size.SizeOfPtr) +
		len(fr.NumericRanges)*(reflectStaticSizeNumericRangeFacet+size.SizeOfPtr) +
		len(fr.DateRanges)*(reflectStaticSizeDateRangeFacet+size.SizeOfPtr)
}

func (fr *FacetResult) Merge(other *FacetResult) {
	fr.Total += other.Total
	fr.Missing += other.Missing
	fr.Other += other.Other
	if other.Terms != nil {
		if fr.Terms == nil {
			fr.Terms = other.Terms
			return
		}
		for _, term := range other.Terms.termFacets {
			fr.Terms.Add(term)
		}
	}
	if other.NumericRanges != nil {
		if fr.NumericRanges == nil {
			fr.NumericRanges = other.NumericRanges
			return
		}
		for _, nr := range other.NumericRanges {
			fr.NumericRanges = fr.NumericRanges.Add(nr)
		}
	}
	if other.DateRanges != nil {
		if fr.DateRanges == nil {
			fr.DateRanges = other.DateRanges
			return
		}
		for _, dr := range other.DateRanges {
			fr.DateRanges = fr.DateRanges.Add(dr)
		}
	}
}

func (fr *FacetResult) Fixup(size int) {
	if fr.Terms != nil {
		sort.Sort(fr.Terms)
		if fr.Terms.Len() > size {
			moveToOther := fr.Terms.termFacets[size:]
			for _, mto := range moveToOther {
				fr.Other += mto.Count
			}
			fr.Terms.termFacets = fr.Terms.termFacets[0:size]
		}
	} else if fr.NumericRanges != nil {
		sort.Sort(fr.NumericRanges)
		if len(fr.NumericRanges) > size {
			moveToOther := fr.NumericRanges[size:]
			for _, mto := range moveToOther {
				fr.Other += mto.Count
			}
			fr.NumericRanges = fr.NumericRanges[0:size]
		}
	} else if fr.DateRanges != nil {
		sort.Sort(fr.DateRanges)
		if len(fr.DateRanges) > size {
			moveToOther := fr.DateRanges[size:]
			for _, mto := range moveToOther {
				fr.Other += mto.Count
			}
			fr.DateRanges = fr.DateRanges[0:size]
		}
	}
}

type FacetResults map[string]*FacetResult

func (fr FacetResults) Merge(other FacetResults) {
	for name, oFacetResult := range other {
		facetResult, ok := fr[name]
		if ok {
			facetResult.Merge(oFacetResult)
		} else {
			fr[name] = oFacetResult
		}
	}
}

func (fr FacetResults) Fixup(name string, size int) {
	facetResult, ok := fr[name]
	if ok {
		facetResult.Fixup(size)
	}
}

func (fb *FacetsBuilder) Results() FacetResults {
	fr := make(FacetResults)
	for i, facetBuilder := range fb.facets {
		facetResult := facetBuilder.Result()
		fr[fb.facetNames[i]] = facetResult
	}
	return fr
}
