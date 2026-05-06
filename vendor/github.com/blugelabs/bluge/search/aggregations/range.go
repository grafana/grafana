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

	"github.com/blugelabs/bluge/search"
)

type RangeAggregation struct {
	src          search.NumericValuesSource
	ranges       []*NumericRange
	aggregations map[string]search.Aggregation
}

func Ranges(src search.NumericValuesSource) *RangeAggregation {
	return &RangeAggregation{
		src: src,
		aggregations: map[string]search.Aggregation{
			"count": CountMatches(),
		},
	}
}

func (a *RangeAggregation) Fields() []string {
	return a.src.Fields()
}

func (a *RangeAggregation) AddRange(rang *NumericRange) *RangeAggregation {
	a.ranges = append(a.ranges, rang)
	return a
}

func (a *RangeAggregation) AddAggregation(name string, agg search.Aggregation) *RangeAggregation {
	a.aggregations[name] = agg
	return a
}

func (a *RangeAggregation) Calculator() search.Calculator {
	rv := &RangeCalculator{
		src:    a.src,
		ranges: a.ranges,
	}

	for _, rang := range a.ranges {
		bucketName := rang.name
		if bucketName == "" {
			bucketName = fmt.Sprintf("[%f,%f)", rang.low, rang.high)
		}
		newBucket := search.NewBucket(bucketName, a.aggregations)
		rv.bucketCalculators = append(rv.bucketCalculators, newBucket)
	}

	return rv
}

type RangeCalculator struct {
	src               search.NumericValuesSource
	ranges            []*NumericRange
	bucketCalculators []*search.Bucket
}

func (b *RangeCalculator) Consume(d *search.DocumentMatch) {
	for _, val := range b.src.Numbers(d) {
		for i, rang := range b.ranges {
			if val >= rang.low && val < rang.high {
				b.bucketCalculators[i].Consume(d)
			}
		}
	}
}

func (b *RangeCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*RangeCalculator); ok {
		if len(b.bucketCalculators) == len(other.bucketCalculators) {
			for i := range b.bucketCalculators {
				b.bucketCalculators[i].Merge(other.bucketCalculators[i])
			}
		}
	}
}

func (b *RangeCalculator) Finish() {
	for _, rang := range b.bucketCalculators {
		rang.Finish()
	}
}

func (b *RangeCalculator) Buckets() []*search.Bucket {
	return b.bucketCalculators
}

type NumericRange struct {
	name string
	low  float64
	high float64
}

func Range(low, high float64) *NumericRange {
	return &NumericRange{
		low:  low,
		high: high,
	}
}

func NamedRange(name string, low, high float64) *NumericRange {
	return &NumericRange{
		name: name,
		low:  low,
		high: high,
	}
}
