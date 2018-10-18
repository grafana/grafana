// Copyright 2017 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"math"

	"github.com/prometheus/prometheus/pkg/labels"
)

type noopQuerier struct{}

// NoopQuerier is a Querier that does nothing.
func NoopQuerier() Querier {
	return noopQuerier{}
}

func (noopQuerier) Select(*SelectParams, ...*labels.Matcher) (SeriesSet, error) {
	return NoopSeriesSet(), nil
}

func (noopQuerier) LabelValues(name string) ([]string, error) {
	return nil, nil
}

func (noopQuerier) Close() error {
	return nil
}

type noopSeriesSet struct{}

// NoopSeriesSet is a SeriesSet that does nothing.
func NoopSeriesSet() SeriesSet {
	return noopSeriesSet{}
}

func (noopSeriesSet) Next() bool {
	return false
}

func (noopSeriesSet) At() Series {
	return nil
}

func (noopSeriesSet) Err() error {
	return nil
}

type noopSeriesIterator struct{}

// NoopSeriesIt is a SeriesIterator that does nothing.
var NoopSeriesIt = noopSeriesIterator{}

func (noopSeriesIterator) At() (int64, float64) {
	return math.MinInt64, 0
}

func (noopSeriesIterator) Seek(t int64) bool {
	return false
}

func (noopSeriesIterator) Next() bool {
	return false
}

func (noopSeriesIterator) Err() error {
	return nil
}
