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

package facet

import (
	"reflect"
	"sort"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
)

var reflectStaticSizeTermsFacetBuilder int

func init() {
	var tfb TermsFacetBuilder
	reflectStaticSizeTermsFacetBuilder = int(reflect.TypeOf(tfb).Size())
}

type TermsFacetBuilder struct {
	size       int
	field      string
	termsCount map[string]int
	total      int
	missing    int
	sawValue   bool
}

func NewTermsFacetBuilder(field string, size int) *TermsFacetBuilder {
	return &TermsFacetBuilder{
		size:       size,
		field:      field,
		termsCount: make(map[string]int),
	}
}

func (fb *TermsFacetBuilder) Size() int {
	sizeInBytes := reflectStaticSizeTermsFacetBuilder + size.SizeOfPtr +
		len(fb.field)

	for k := range fb.termsCount {
		sizeInBytes += size.SizeOfString + len(k) +
			size.SizeOfInt
	}

	return sizeInBytes
}

func (fb *TermsFacetBuilder) Field() string {
	return fb.field
}

func (fb *TermsFacetBuilder) UpdateVisitor(term []byte) {
	fb.sawValue = true
	fb.termsCount[string(term)] = fb.termsCount[string(term)] + 1
	fb.total++
}

func (fb *TermsFacetBuilder) StartDoc() {
	fb.sawValue = false
}

func (fb *TermsFacetBuilder) EndDoc() {
	if !fb.sawValue {
		fb.missing++
	}
}

func (fb *TermsFacetBuilder) Result() *search.FacetResult {
	rv := search.FacetResult{
		Field:   fb.field,
		Total:   fb.total,
		Missing: fb.missing,
	}

	rv.Terms = &search.TermFacets{}

	for term, count := range fb.termsCount {
		tf := &search.TermFacet{
			Term:  term,
			Count: count,
		}

		rv.Terms.Add(tf)
	}

	sort.Sort(rv.Terms)

	// we now have the list of the top N facets
	trimTopN := fb.size
	if trimTopN > rv.Terms.Len() {
		trimTopN = rv.Terms.Len()
	}
	rv.Terms.TrimToTopN(trimTopN)

	notOther := 0
	for _, tf := range rv.Terms.Terms() {
		notOther += tf.Count
	}
	rv.Other = fb.total - notOther

	return &rv
}
