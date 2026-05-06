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
	"github.com/axiomhq/hyperloglog"
	"github.com/blugelabs/bluge/search"
)

type CardinalityMetric struct {
	src search.TextValuesSource
}

func Cardinality(src search.TextValuesSource) *CardinalityMetric {
	return &CardinalityMetric{
		src: src,
	}
}

func (c *CardinalityMetric) Fields() []string {
	return c.src.Fields()
}

func (c *CardinalityMetric) Calculator() search.Calculator {
	rv := &CardinalityCalculator{
		src:    c.src,
		sketch: hyperloglog.New16(),
	}
	return rv
}

type CardinalityCalculator struct {
	src    search.TextValuesSource
	sketch *hyperloglog.Sketch
}

func (c *CardinalityCalculator) Value() float64 {
	return float64(c.sketch.Estimate())
}

func (c *CardinalityCalculator) Consume(d *search.DocumentMatch) {
	for _, val := range c.src.Values(d) {
		c.sketch.Insert(val)
	}
}

func (c *CardinalityCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*CardinalityCalculator); ok {
		_ = c.sketch.Merge(other.sketch)
	}
}

func (c *CardinalityCalculator) Finish() {

}
