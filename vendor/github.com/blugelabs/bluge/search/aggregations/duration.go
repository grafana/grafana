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
	"time"

	"github.com/blugelabs/bluge/search"
)

type DurationMetric struct{}

func Duration() *DurationMetric {
	return &DurationMetric{}
}

func (d *DurationMetric) Fields() []string {
	return nil
}

func (d *DurationMetric) Calculator() search.Calculator {
	return &DurationCalculator{
		origin: time.Now(),
	}
}

type DurationCalculator struct {
	origin time.Time
	since  time.Duration
}

func (d *DurationCalculator) Consume(*search.DocumentMatch) {}

func (d *DurationCalculator) Finish() {
	d.since = time.Since(d.origin)
}

func (d *DurationCalculator) Merge(other search.Calculator) {}

func (d *DurationCalculator) Duration() time.Duration {
	return d.since
}
