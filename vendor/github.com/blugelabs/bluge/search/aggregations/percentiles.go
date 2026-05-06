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
	"github.com/caio/go-tdigest"
)

type QuantilesMetric struct {
	src         search.NumericValuesSource
	compression float64
}

func Quantiles(src search.NumericValuesSource) *QuantilesMetric {
	return &QuantilesMetric{
		src:         src,
		compression: 100,
	}
}

func (c *QuantilesMetric) SetCompression(compression float64) error {
	if compression < 1 {
		return fmt.Errorf("compression must be > 1")
	}
	c.compression = compression
	return nil
}

func (c *QuantilesMetric) Fields() []string {
	return c.src.Fields()
}

func (c *QuantilesMetric) Calculator() search.Calculator {
	rv := &QuantilesCalculator{
		src: c.src,
	}
	rv.tdigest, _ = tdigest.New(tdigest.Compression(c.compression))
	return rv
}

type QuantilesCalculator struct {
	src     search.NumericValuesSource
	tdigest *tdigest.TDigest
}

func (c *QuantilesCalculator) Quantile(percent float64) (float64, error) {
	if percent < 0 || percent > 1 {
		return 0, fmt.Errorf("percent must be between 0 and 1")
	}
	return c.tdigest.Quantile(percent), nil
}

func (c *QuantilesCalculator) Consume(d *search.DocumentMatch) {
	for _, val := range c.src.Numbers(d) {
		_ = c.tdigest.Add(val)
	}
}

func (c *QuantilesCalculator) Merge(other search.Calculator) {
	if other, ok := other.(*QuantilesCalculator); ok {
		_ = c.tdigest.Merge(other.tdigest)
	}
}

func (c *QuantilesCalculator) Finish() {

}
