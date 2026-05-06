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
	"time"

	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
)

var (
	reflectStaticSizeDateTimeFacetBuilder int
	reflectStaticSizedateTimeRange        int
)

func init() {
	var dtfb DateTimeFacetBuilder
	reflectStaticSizeDateTimeFacetBuilder = int(reflect.TypeOf(dtfb).Size())
	var dtr dateTimeRange
	reflectStaticSizedateTimeRange = int(reflect.TypeOf(dtr).Size())
}

type dateTimeRange struct {
	start time.Time
	end   time.Time
}

type DateTimeFacetBuilder struct {
	size       int
	field      string
	termsCount map[string]int
	total      int
	missing    int
	ranges     map[string]*dateTimeRange
	sawValue   bool
}

func NewDateTimeFacetBuilder(field string, size int) *DateTimeFacetBuilder {
	return &DateTimeFacetBuilder{
		size:       size,
		field:      field,
		termsCount: make(map[string]int),
		ranges:     make(map[string]*dateTimeRange, 0),
	}
}

func (fb *DateTimeFacetBuilder) Size() int {
	sizeInBytes := reflectStaticSizeDateTimeFacetBuilder + size.SizeOfPtr +
		len(fb.field)

	for k := range fb.termsCount {
		sizeInBytes += size.SizeOfString + len(k) +
			size.SizeOfInt
	}

	for k := range fb.ranges {
		sizeInBytes += size.SizeOfString + len(k) +
			size.SizeOfPtr + reflectStaticSizedateTimeRange
	}

	return sizeInBytes
}

func (fb *DateTimeFacetBuilder) AddRange(name string, start, end time.Time) {
	r := dateTimeRange{
		start: start,
		end:   end,
	}
	fb.ranges[name] = &r
}

func (fb *DateTimeFacetBuilder) Field() string {
	return fb.field
}

func (fb *DateTimeFacetBuilder) UpdateVisitor(term []byte) {
	fb.sawValue = true
	// only consider the values which are shifted 0
	prefixCoded := numeric.PrefixCoded(term)
	shift, err := prefixCoded.Shift()
	if err == nil && shift == 0 {
		i64, err := prefixCoded.Int64()
		if err == nil {
			t := time.Unix(0, i64)

			// look at each of the ranges for a match
			for rangeName, r := range fb.ranges {
				if (r.start.IsZero() || t.After(r.start) || t.Equal(r.start)) && (r.end.IsZero() || t.Before(r.end)) {
					fb.termsCount[rangeName] = fb.termsCount[rangeName] + 1
					fb.total++
				}
			}
		}
	}
}

func (fb *DateTimeFacetBuilder) StartDoc() {
	fb.sawValue = false
}

func (fb *DateTimeFacetBuilder) EndDoc() {
	if !fb.sawValue {
		fb.missing++
	}
}

func (fb *DateTimeFacetBuilder) Result() *search.FacetResult {
	rv := search.FacetResult{
		Field:   fb.field,
		Total:   fb.total,
		Missing: fb.missing,
	}

	rv.DateRanges = make([]*search.DateRangeFacet, 0, len(fb.termsCount))

	for term, count := range fb.termsCount {
		dateRange := fb.ranges[term]
		tf := &search.DateRangeFacet{
			Name:  term,
			Count: count,
		}
		if !dateRange.start.IsZero() {
			start := dateRange.start.Format(time.RFC3339Nano)
			tf.Start = &start
		}
		if !dateRange.end.IsZero() {
			end := dateRange.end.Format(time.RFC3339Nano)
			tf.End = &end
		}
		rv.DateRanges = append(rv.DateRanges, tf)
	}

	sort.Sort(rv.DateRanges)

	// we now have the list of the top N facets
	if fb.size < len(rv.DateRanges) {
		rv.DateRanges = rv.DateRanges[:fb.size]
	}

	notOther := 0
	for _, nr := range rv.DateRanges {
		notOther += nr.Count
	}
	rv.Other = fb.total - notOther

	return &rv
}
