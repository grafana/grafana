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
	"container/heap"
	"context"
	"strings"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/labels"
)

type fanout struct {
	logger log.Logger

	primary     Storage
	secondaries []Storage
}

// NewFanout returns a new fan-out Storage, which proxies reads and writes
// through to multiple underlying storages.
func NewFanout(logger log.Logger, primary Storage, secondaries ...Storage) Storage {
	return &fanout{
		logger:      logger,
		primary:     primary,
		secondaries: secondaries,
	}
}

// StartTime implements the Storage interface.
func (f *fanout) StartTime() (int64, error) {
	// StartTime of a fanout should be the earliest StartTime of all its storages,
	// both primary and secondaries.
	firstTime, err := f.primary.StartTime()
	if err != nil {
		return int64(model.Latest), err
	}

	for _, storage := range f.secondaries {
		t, err := storage.StartTime()
		if err != nil {
			return int64(model.Latest), err
		}
		if t < firstTime {
			firstTime = t
		}
	}
	return firstTime, nil
}

func (f *fanout) Querier(ctx context.Context, mint, maxt int64) (Querier, error) {
	queriers := make([]Querier, 0, 1+len(f.secondaries))

	// Add primary querier
	querier, err := f.primary.Querier(ctx, mint, maxt)
	if err != nil {
		return nil, err
	}
	queriers = append(queriers, querier)

	// Add secondary queriers
	for _, storage := range f.secondaries {
		querier, err := storage.Querier(ctx, mint, maxt)
		if err != nil {
			NewMergeQuerier(queriers).Close()
			return nil, err
		}
		queriers = append(queriers, querier)
	}

	return NewMergeQuerier(queriers), nil
}

func (f *fanout) Appender() (Appender, error) {
	primary, err := f.primary.Appender()
	if err != nil {
		return nil, err
	}

	secondaries := make([]Appender, 0, len(f.secondaries))
	for _, storage := range f.secondaries {
		appender, err := storage.Appender()
		if err != nil {
			return nil, err
		}
		secondaries = append(secondaries, appender)
	}
	return &fanoutAppender{
		logger:      f.logger,
		primary:     primary,
		secondaries: secondaries,
	}, nil
}

// Close closes the storage and all its underlying resources.
func (f *fanout) Close() error {
	if err := f.primary.Close(); err != nil {
		return err
	}

	// TODO return multiple errors?
	var lastErr error
	for _, storage := range f.secondaries {
		if err := storage.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// fanoutAppender implements Appender.
type fanoutAppender struct {
	logger log.Logger

	primary     Appender
	secondaries []Appender
}

func (f *fanoutAppender) Add(l labels.Labels, t int64, v float64) (uint64, error) {
	ref, err := f.primary.Add(l, t, v)
	if err != nil {
		return ref, err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.Add(l, t, v); err != nil {
			return 0, err
		}
	}
	return ref, nil
}

func (f *fanoutAppender) AddFast(l labels.Labels, ref uint64, t int64, v float64) error {
	if err := f.primary.AddFast(l, ref, t, v); err != nil {
		return err
	}

	for _, appender := range f.secondaries {
		if _, err := appender.Add(l, t, v); err != nil {
			return err
		}
	}
	return nil
}

func (f *fanoutAppender) Commit() (err error) {
	err = f.primary.Commit()

	for _, appender := range f.secondaries {
		if err == nil {
			err = appender.Commit()
		} else {
			if rollbackErr := appender.Rollback(); rollbackErr != nil {
				level.Error(f.logger).Log("msg", "Squashed rollback error on commit", "err", rollbackErr)
			}
		}
	}
	return
}

func (f *fanoutAppender) Rollback() (err error) {
	err = f.primary.Rollback()

	for _, appender := range f.secondaries {
		rollbackErr := appender.Rollback()
		if err == nil {
			err = rollbackErr
		} else if rollbackErr != nil {
			level.Error(f.logger).Log("msg", "Squashed rollback error on rollback", "err", rollbackErr)
		}
	}
	return nil
}

// mergeQuerier implements Querier.
type mergeQuerier struct {
	queriers []Querier
}

// NewMergeQuerier returns a new Querier that merges results of input queriers.
// NB NewMergeQuerier will return NoopQuerier if no queriers are passed to it,
// and will filter NoopQueriers from its arguments, in order to reduce overhead
// when only one querier is passed.
func NewMergeQuerier(queriers []Querier) Querier {
	filtered := make([]Querier, 0, len(queriers))
	for _, querier := range queriers {
		if querier != NoopQuerier() {
			filtered = append(filtered, querier)
		}
	}

	switch len(filtered) {
	case 0:
		return NoopQuerier()
	case 1:
		return filtered[0]
	default:
		return &mergeQuerier{
			queriers: filtered,
		}
	}
}

// Select returns a set of series that matches the given label matchers.
func (q *mergeQuerier) Select(params *SelectParams, matchers ...*labels.Matcher) (SeriesSet, error) {
	seriesSets := make([]SeriesSet, 0, len(q.queriers))
	for _, querier := range q.queriers {
		set, err := querier.Select(params, matchers...)
		if err != nil {
			return nil, err
		}
		seriesSets = append(seriesSets, set)
	}
	return NewMergeSeriesSet(seriesSets), nil
}

// LabelValues returns all potential values for a label name.
func (q *mergeQuerier) LabelValues(name string) ([]string, error) {
	var results [][]string
	for _, querier := range q.queriers {
		values, err := querier.LabelValues(name)
		if err != nil {
			return nil, err
		}
		results = append(results, values)
	}
	return mergeStringSlices(results), nil
}

func mergeStringSlices(ss [][]string) []string {
	switch len(ss) {
	case 0:
		return nil
	case 1:
		return ss[0]
	case 2:
		return mergeTwoStringSlices(ss[0], ss[1])
	default:
		halfway := len(ss) / 2
		return mergeTwoStringSlices(
			mergeStringSlices(ss[:halfway]),
			mergeStringSlices(ss[halfway:]),
		)
	}
}

func mergeTwoStringSlices(a, b []string) []string {
	i, j := 0, 0
	result := make([]string, 0, len(a)+len(b))
	for i < len(a) && j < len(b) {
		switch strings.Compare(a[i], b[j]) {
		case 0:
			result = append(result, a[i])
			i++
			j++
		case -1:
			result = append(result, a[i])
			i++
		case 1:
			result = append(result, b[j])
			j++
		}
	}
	result = append(result, a[i:]...)
	result = append(result, b[j:]...)
	return result
}

// Close releases the resources of the Querier.
func (q *mergeQuerier) Close() error {
	// TODO return multiple errors?
	var lastErr error
	for _, querier := range q.queriers {
		if err := querier.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// mergeSeriesSet implements SeriesSet
type mergeSeriesSet struct {
	currentLabels labels.Labels
	currentSets   []SeriesSet
	heap          seriesSetHeap
	sets          []SeriesSet
}

// NewMergeSeriesSet returns a new series set that merges (deduplicates)
// series returned by the input series sets when iterating.
func NewMergeSeriesSet(sets []SeriesSet) SeriesSet {
	if len(sets) == 1 {
		return sets[0]
	}

	// Sets need to be pre-advanced, so we can introspect the label of the
	// series under the cursor.
	var h seriesSetHeap
	for _, set := range sets {
		if set.Next() {
			heap.Push(&h, set)
		}
	}
	return &mergeSeriesSet{
		heap: h,
		sets: sets,
	}
}

func (c *mergeSeriesSet) Next() bool {
	// Firstly advance all the current series sets.  If any of them have run out
	// we can drop them, otherwise they should be inserted back into the heap.
	for _, set := range c.currentSets {
		if set.Next() {
			heap.Push(&c.heap, set)
		}
	}
	if len(c.heap) == 0 {
		return false
	}

	// Now, pop items of the heap that have equal label sets.
	c.currentSets = nil
	c.currentLabels = c.heap[0].At().Labels()
	for len(c.heap) > 0 && labels.Equal(c.currentLabels, c.heap[0].At().Labels()) {
		set := heap.Pop(&c.heap).(SeriesSet)
		c.currentSets = append(c.currentSets, set)
	}
	return true
}

func (c *mergeSeriesSet) At() Series {
	if len(c.currentSets) == 1 {
		return c.currentSets[0].At()
	}
	series := []Series{}
	for _, seriesSet := range c.currentSets {
		series = append(series, seriesSet.At())
	}
	return &mergeSeries{
		labels: c.currentLabels,
		series: series,
	}
}

func (c *mergeSeriesSet) Err() error {
	for _, set := range c.sets {
		if err := set.Err(); err != nil {
			return err
		}
	}
	return nil
}

type seriesSetHeap []SeriesSet

func (h seriesSetHeap) Len() int      { return len(h) }
func (h seriesSetHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h seriesSetHeap) Less(i, j int) bool {
	a, b := h[i].At().Labels(), h[j].At().Labels()
	return labels.Compare(a, b) < 0
}

func (h *seriesSetHeap) Push(x interface{}) {
	*h = append(*h, x.(SeriesSet))
}

func (h *seriesSetHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

type mergeSeries struct {
	labels labels.Labels
	series []Series
}

func (m *mergeSeries) Labels() labels.Labels {
	return m.labels
}

func (m *mergeSeries) Iterator() SeriesIterator {
	iterators := make([]SeriesIterator, 0, len(m.series))
	for _, s := range m.series {
		iterators = append(iterators, s.Iterator())
	}
	return newMergeIterator(iterators)
}

type mergeIterator struct {
	iterators []SeriesIterator
	h         seriesIteratorHeap
}

func newMergeIterator(iterators []SeriesIterator) SeriesIterator {
	return &mergeIterator{
		iterators: iterators,
		h:         nil,
	}
}

func (c *mergeIterator) Seek(t int64) bool {
	c.h = seriesIteratorHeap{}
	for _, iter := range c.iterators {
		if iter.Seek(t) {
			heap.Push(&c.h, iter)
		}
	}
	return len(c.h) > 0
}

func (c *mergeIterator) At() (t int64, v float64) {
	if len(c.h) == 0 {
		panic("mergeIterator.At() called after .Next() returned false.")
	}

	return c.h[0].At()
}

func (c *mergeIterator) Next() bool {
	if c.h == nil {
		for _, iter := range c.iterators {
			if iter.Next() {
				heap.Push(&c.h, iter)
			}
		}

		return len(c.h) > 0
	}

	if len(c.h) == 0 {
		return false
	}

	currt, _ := c.At()
	for len(c.h) > 0 {
		nextt, _ := c.h[0].At()
		if nextt != currt {
			break
		}

		iter := heap.Pop(&c.h).(SeriesIterator)
		if iter.Next() {
			heap.Push(&c.h, iter)
		}
	}

	return len(c.h) > 0
}

func (c *mergeIterator) Err() error {
	for _, iter := range c.iterators {
		if err := iter.Err(); err != nil {
			return err
		}
	}
	return nil
}

type seriesIteratorHeap []SeriesIterator

func (h seriesIteratorHeap) Len() int      { return len(h) }
func (h seriesIteratorHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h seriesIteratorHeap) Less(i, j int) bool {
	at, _ := h[i].At()
	bt, _ := h[j].At()
	return at < bt
}

func (h *seriesIteratorHeap) Push(x interface{}) {
	*h = append(*h, x.(SeriesIterator))
}

func (h *seriesIteratorHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}
