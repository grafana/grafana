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
	"math"

	"github.com/blugelabs/bluge/search"
)

type SingleValueMetric struct {
	src     search.NumericValuesSource
	init    float64
	compute SingleValueCalculatorFunc
}

func Sum(src search.NumericValuesSource) *SingleValueMetric {
	return &SingleValueMetric{
		src: src,
		compute: func(s *SingleValueCalculator, val float64) {
			s.val += val
		},
	}
}

func Min(src search.NumericValuesSource) *SingleValueMetric {
	return &SingleValueMetric{
		init: math.Inf(1),
		src:  src,
		compute: func(s *SingleValueCalculator, val float64) {
			if val < s.val {
				s.val = val
			}
		},
	}
}

func Max(src search.NumericValuesSource) *SingleValueMetric {
	return MaxStartingAt(src, math.Inf(-1))
}

func MaxStartingAt(src search.NumericValuesSource, initial float64) *SingleValueMetric {
	return &SingleValueMetric{
		init: initial,
		src:  src,
		compute: func(s *SingleValueCalculator, val float64) {
			if val > s.val {
				s.val = val
			}
		},
	}
}

func (s *SingleValueMetric) Fields() []string {
	return s.src.Fields()
}

func (s *SingleValueMetric) Calculator() search.Calculator {
	rv := &SingleValueCalculator{
		val:     s.init,
		src:     s.src,
		compute: s.compute,
	}
	return rv
}

type SingleValueCalculatorFunc func(*SingleValueCalculator, float64)

type SingleValueCalculator struct {
	src     search.NumericValuesSource
	val     float64
	compute SingleValueCalculatorFunc
}

func (s *SingleValueCalculator) Consume(d *search.DocumentMatch) {
	for _, val := range s.src.Numbers(d) {
		s.compute(s, val)
	}
}

func (s *SingleValueCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*SingleValueCalculator); ok {
		s.compute(s, other.val)
	}
}

func (s *SingleValueCalculator) Finish() {}

func (s *SingleValueCalculator) Value() float64 {
	return s.val
}

type WeightedAvgMetric struct {
	src    search.NumericValuesSource
	weight search.NumericValuesSource
}

func Avg(src search.NumericValuesSource) *WeightedAvgMetric {
	return &WeightedAvgMetric{
		src: src,
	}
}

func WeightedAvg(src, weight search.NumericValuesSource) *WeightedAvgMetric {
	return &WeightedAvgMetric{
		src:    src,
		weight: weight,
	}
}

func (a *WeightedAvgMetric) Fields() []string {
	rv := a.src.Fields()
	if a.weight != nil {
		rv = append(rv, a.weight.Fields()...)
	}
	return rv
}

func (a *WeightedAvgMetric) Calculator() search.Calculator {
	rv := &WeightedAvgCalculator{
		src:    a.src,
		weight: a.weight,
	}
	return rv
}

type WeightedAvgCalculator struct {
	src     search.NumericValuesSource
	weight  search.NumericValuesSource
	val     float64
	weights float64
}

func (a *WeightedAvgCalculator) Value() float64 {
	return a.val / a.weights
}

func (a *WeightedAvgCalculator) Consume(d *search.DocumentMatch) {
	weight := 1.0
	if a.weight != nil {
		weightValues := a.weight.Numbers(d)
		if len(weightValues) > 0 {
			weight = weightValues[0]
		}
	}
	for _, val := range a.src.Numbers(d) {
		a.val += val * weight
		a.weights += weight
	}
}

func (a *WeightedAvgCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*WeightedAvgCalculator); ok {
		a.val += other.val
		a.weights += other.weights
	}
}

func (a *WeightedAvgCalculator) Finish() {

}
