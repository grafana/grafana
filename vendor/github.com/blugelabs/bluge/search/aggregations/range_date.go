//  Copyright (c) 2020 The Bluge Authors.
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

package aggregations

import (
	"fmt"
	"time"

	"github.com/blugelabs/bluge/search"
)

type DateRangeAggregation struct {
	src          search.DateValuesSource
	ranges       []*DateRange
	aggregations map[string]search.Aggregation
}

func DateRanges(src search.DateValuesSource) *DateRangeAggregation {
	return &DateRangeAggregation{
		src: src,
		aggregations: map[string]search.Aggregation{
			"count": CountMatches(),
		},
	}
}

func (a *DateRangeAggregation) Fields() []string {
	return a.src.Fields()
}

func (a *DateRangeAggregation) AddRange(rang *DateRange) *DateRangeAggregation {
	a.ranges = append(a.ranges, rang)
	return a
}

func (a *DateRangeAggregation) AddAggregation(name string, agg search.Aggregation) *DateRangeAggregation {
	a.aggregations[name] = agg
	return a
}

func (a *DateRangeAggregation) Calculator() search.Calculator {
	rv := &DateRangeCalculator{
		src:    a.src,
		ranges: a.ranges,
	}

	for _, rang := range a.ranges {
		bucketName := rang.name
		if bucketName == "" {
			bucketName = fmt.Sprintf("[%s,%s)", rang.start.Format(time.RFC3339), rang.end.Format(time.RFC3339))
		}
		newBucket := search.NewBucket(bucketName, a.aggregations)
		rv.bucketCalculators = append(rv.bucketCalculators, newBucket)
	}

	return rv
}

type DateRangeCalculator struct {
	src               search.DateValuesSource
	ranges            []*DateRange
	bucketCalculators []*search.Bucket
}

func (b *DateRangeCalculator) Consume(d *search.DocumentMatch) {
	for _, val := range b.src.Dates(d) {
		for i, rang := range b.ranges {
			if !rang.start.IsZero() && val.Before(rang.start) {
				continue
			}
			if !rang.end.IsZero() && (val.Equal(rang.end) || val.After(rang.end)) {
				continue
			}
			b.bucketCalculators[i].Consume(d)
		}
	}
}

func (b *DateRangeCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*DateRangeCalculator); ok {
		if len(b.bucketCalculators) == len(other.bucketCalculators) {
			for i := range b.bucketCalculators {
				b.bucketCalculators[i].Merge(other.bucketCalculators[i])
			}
		}
	}
}

func (b *DateRangeCalculator) Finish() {
	for _, rang := range b.bucketCalculators {
		rang.Finish()
	}
}

func (b *DateRangeCalculator) Buckets() []*search.Bucket {
	return b.bucketCalculators
}

type DateRange struct {
	name  string
	start time.Time
	end   time.Time
}

func NewDateRange(start, end time.Time) *DateRange {
	return &DateRange{
		start: start,
		end:   end,
	}
}

func NewNamedDateRange(name string, start, end time.Time) *DateRange {
	return &DateRange{
		name:  name,
		start: start,
		end:   end,
	}
}
