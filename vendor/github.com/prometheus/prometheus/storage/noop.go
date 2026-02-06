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
	"context"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/util/annotations"
)

type noopQuerier struct{}

// NoopQuerier is a Querier that does nothing.
func NoopQuerier() Querier {
	return noopQuerier{}
}

func (noopQuerier) Select(context.Context, bool, *SelectHints, ...*labels.Matcher) SeriesSet {
	return NoopSeriesSet()
}

func (noopQuerier) LabelValues(context.Context, string, *LabelHints, ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	return nil, nil, nil
}

func (noopQuerier) LabelNames(context.Context, *LabelHints, ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	return nil, nil, nil
}

func (noopQuerier) Close() error {
	return nil
}

type noopChunkQuerier struct{}

// NoopChunkedQuerier is a ChunkQuerier that does nothing.
func NoopChunkedQuerier() ChunkQuerier {
	return noopChunkQuerier{}
}

func (noopChunkQuerier) Select(context.Context, bool, *SelectHints, ...*labels.Matcher) ChunkSeriesSet {
	return NoopChunkedSeriesSet()
}

func (noopChunkQuerier) LabelValues(context.Context, string, *LabelHints, ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	return nil, nil, nil
}

func (noopChunkQuerier) LabelNames(context.Context, *LabelHints, ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	return nil, nil, nil
}

func (noopChunkQuerier) Close() error {
	return nil
}

type noopSeriesSet struct{}

// NoopSeriesSet is a SeriesSet that does nothing.
func NoopSeriesSet() SeriesSet {
	return noopSeriesSet{}
}

func (noopSeriesSet) Next() bool { return false }

func (noopSeriesSet) At() Series { return nil }

func (noopSeriesSet) Err() error { return nil }

func (noopSeriesSet) Warnings() annotations.Annotations { return nil }

type noopChunkedSeriesSet struct{}

// NoopChunkedSeriesSet is a ChunkSeriesSet that does nothing.
func NoopChunkedSeriesSet() ChunkSeriesSet {
	return noopChunkedSeriesSet{}
}

func (noopChunkedSeriesSet) Next() bool { return false }

func (noopChunkedSeriesSet) At() ChunkSeries { return nil }

func (noopChunkedSeriesSet) Err() error { return nil }

func (noopChunkedSeriesSet) Warnings() annotations.Annotations { return nil }
