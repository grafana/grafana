// Copyright 2020 The Prometheus Authors
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
	"bytes"
	"container/heap"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/pkg/errors"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/tsdb/chunks"
	tsdb_errors "github.com/prometheus/prometheus/tsdb/errors"
)

type mergeGenericQuerier struct {
	queriers []genericQuerier

	// mergeFn is used when we see series from different queriers Selects with the same labels.
	mergeFn genericSeriesMergeFunc

	// TODO(bwplotka): Remove once remote queries are asynchronous. False by default.
	concurrentSelect bool
}

// NewMergeQuerier returns a new Querier that merges results of given primary and secondary queriers.
// See NewFanout commentary to learn more about primary vs secondary differences.
//
// In case of overlaps between the data given by primaries' and secondaries' Selects, merge function will be used.
func NewMergeQuerier(primaries []Querier, secondaries []Querier, mergeFn VerticalSeriesMergeFunc) Querier {
	queriers := make([]genericQuerier, 0, len(primaries)+len(secondaries))
	for _, q := range primaries {
		if _, ok := q.(noopQuerier); !ok && q != nil {
			queriers = append(queriers, newGenericQuerierFrom(q))
		}
	}
	for _, q := range secondaries {
		if _, ok := q.(noopQuerier); !ok && q != nil {
			queriers = append(queriers, newSecondaryQuerierFrom(q))
		}
	}

	concurrentSelect := false
	if len(secondaries) > 0 {
		concurrentSelect = true
	}
	return &querierAdapter{&mergeGenericQuerier{
		mergeFn:          (&seriesMergerAdapter{VerticalSeriesMergeFunc: mergeFn}).Merge,
		queriers:         queriers,
		concurrentSelect: concurrentSelect,
	}}
}

// NewMergeChunkQuerier returns a new Chunk Querier that merges results of given primary and secondary chunk queriers.
// See NewFanout commentary to learn more about primary vs secondary differences.
//
// In case of overlaps between the data given by primaries' and secondaries' Selects, merge function will be used.
// TODO(bwplotka): Currently merge will compact overlapping chunks with bigger chunk, without limit. Split it: https://github.com/prometheus/tsdb/issues/670
func NewMergeChunkQuerier(primaries []ChunkQuerier, secondaries []ChunkQuerier, mergeFn VerticalChunkSeriesMergeFunc) ChunkQuerier {
	queriers := make([]genericQuerier, 0, len(primaries)+len(secondaries))
	for _, q := range primaries {
		if _, ok := q.(noopChunkQuerier); !ok && q != nil {
			queriers = append(queriers, newGenericQuerierFromChunk(q))
		}
	}
	for _, querier := range secondaries {
		if _, ok := querier.(noopChunkQuerier); !ok && querier != nil {
			queriers = append(queriers, newSecondaryQuerierFromChunk(querier))
		}
	}

	concurrentSelect := false
	if len(secondaries) > 0 {
		concurrentSelect = true
	}
	return &chunkQuerierAdapter{&mergeGenericQuerier{
		mergeFn:          (&chunkSeriesMergerAdapter{VerticalChunkSeriesMergeFunc: mergeFn}).Merge,
		queriers:         queriers,
		concurrentSelect: concurrentSelect,
	}}
}

// Select returns a set of series that matches the given label matchers.
func (q *mergeGenericQuerier) Select(sortSeries bool, hints *SelectHints, matchers ...*labels.Matcher) genericSeriesSet {
	if len(q.queriers) == 0 {
		return noopGenericSeriesSet{}
	}
	if len(q.queriers) == 1 {
		return q.queriers[0].Select(sortSeries, hints, matchers...)
	}

	var seriesSets = make([]genericSeriesSet, 0, len(q.queriers))
	if !q.concurrentSelect {
		for _, querier := range q.queriers {
			// We need to sort for merge  to work.
			seriesSets = append(seriesSets, querier.Select(true, hints, matchers...))
		}
		return &lazyGenericSeriesSet{init: func() (genericSeriesSet, bool) {
			s := newGenericMergeSeriesSet(seriesSets, q.mergeFn)
			return s, s.Next()
		}}
	}

	var (
		wg            sync.WaitGroup
		seriesSetChan = make(chan genericSeriesSet)
	)
	// Schedule all Selects for all queriers we know about.
	for _, querier := range q.queriers {
		wg.Add(1)
		go func(qr genericQuerier) {
			defer wg.Done()

			// We need to sort for NewMergeSeriesSet to work.
			seriesSetChan <- qr.Select(true, hints, matchers...)
		}(querier)
	}
	go func() {
		wg.Wait()
		close(seriesSetChan)
	}()

	for r := range seriesSetChan {
		seriesSets = append(seriesSets, r)
	}
	return &lazyGenericSeriesSet{init: func() (genericSeriesSet, bool) {
		s := newGenericMergeSeriesSet(seriesSets, q.mergeFn)
		return s, s.Next()
	}}
}

type labelGenericQueriers []genericQuerier

func (l labelGenericQueriers) Len() int               { return len(l) }
func (l labelGenericQueriers) Get(i int) LabelQuerier { return l[i] }
func (l labelGenericQueriers) SplitByHalf() (labelGenericQueriers, labelGenericQueriers) {
	i := len(l) / 2
	return l[:i], l[i:]
}

// LabelValues returns all potential values for a label name.
func (q *mergeGenericQuerier) LabelValues(name string) ([]string, Warnings, error) {
	res, ws, err := q.lvals(q.queriers, name)
	if err != nil {
		return nil, nil, errors.Wrapf(err, "LabelValues() from merge generic querier for label %s", name)
	}
	return res, ws, nil
}

// lvals performs merge sort for LabelValues from multiple queriers.
func (q *mergeGenericQuerier) lvals(lq labelGenericQueriers, n string) ([]string, Warnings, error) {
	if lq.Len() == 0 {
		return nil, nil, nil
	}
	if lq.Len() == 1 {
		return lq.Get(0).LabelValues(n)
	}
	a, b := lq.SplitByHalf()

	var ws Warnings
	s1, w, err := q.lvals(a, n)
	ws = append(ws, w...)
	if err != nil {
		return nil, ws, err
	}
	s2, ws, err := q.lvals(b, n)
	ws = append(ws, w...)
	if err != nil {
		return nil, ws, err
	}
	return mergeStrings(s1, s2), ws, nil
}

func mergeStrings(a, b []string) []string {
	maxl := len(a)
	if len(b) > len(a) {
		maxl = len(b)
	}
	res := make([]string, 0, maxl*10/9)

	for len(a) > 0 && len(b) > 0 {
		d := strings.Compare(a[0], b[0])

		if d == 0 {
			res = append(res, a[0])
			a, b = a[1:], b[1:]
		} else if d < 0 {
			res = append(res, a[0])
			a = a[1:]
		} else if d > 0 {
			res = append(res, b[0])
			b = b[1:]
		}
	}

	// Append all remaining elements.
	res = append(res, a...)
	res = append(res, b...)
	return res
}

// LabelNames returns all the unique label names present in all queriers in sorted order.
func (q *mergeGenericQuerier) LabelNames() ([]string, Warnings, error) {
	var (
		labelNamesMap = make(map[string]struct{})
		warnings      Warnings
	)
	for _, querier := range q.queriers {
		names, wrn, err := querier.LabelNames()
		if wrn != nil {
			// TODO(bwplotka): We could potentially wrap warnings.
			warnings = append(warnings, wrn...)
		}
		if err != nil {
			return nil, nil, errors.Wrap(err, "LabelNames() from merge generic querier")
		}
		for _, name := range names {
			labelNamesMap[name] = struct{}{}
		}
	}
	if len(labelNamesMap) == 0 {
		return nil, warnings, nil
	}

	labelNames := make([]string, 0, len(labelNamesMap))
	for name := range labelNamesMap {
		labelNames = append(labelNames, name)
	}
	sort.Strings(labelNames)
	return labelNames, warnings, nil
}

// Close releases the resources of the generic querier.
func (q *mergeGenericQuerier) Close() error {
	errs := tsdb_errors.MultiError{}
	for _, querier := range q.queriers {
		if err := querier.Close(); err != nil {
			errs.Add(err)
		}
	}
	return errs.Err()
}

// VerticalSeriesMergeFunc returns merged series implementation that merges series with same labels together.
// It has to handle time-overlapped series as well.
type VerticalSeriesMergeFunc func(...Series) Series

// NewMergeSeriesSet returns a new SeriesSet that merges many SeriesSets together.
func NewMergeSeriesSet(sets []SeriesSet, mergeFunc VerticalSeriesMergeFunc) SeriesSet {
	genericSets := make([]genericSeriesSet, 0, len(sets))
	for _, s := range sets {
		genericSets = append(genericSets, &genericSeriesSetAdapter{s})

	}
	return &seriesSetAdapter{newGenericMergeSeriesSet(genericSets, (&seriesMergerAdapter{VerticalSeriesMergeFunc: mergeFunc}).Merge)}
}

// VerticalChunkSeriesMergeFunc returns merged chunk series implementation that merges potentially time-overlapping
// chunk series with the same labels into single ChunkSeries.
//
// NOTE: It's up to implementation how series are vertically merged (if chunks are sorted, re-encoded etc).
type VerticalChunkSeriesMergeFunc func(...ChunkSeries) ChunkSeries

// NewMergeChunkSeriesSet returns a new ChunkSeriesSet that merges many SeriesSet together.
func NewMergeChunkSeriesSet(sets []ChunkSeriesSet, mergeFunc VerticalChunkSeriesMergeFunc) ChunkSeriesSet {
	genericSets := make([]genericSeriesSet, 0, len(sets))
	for _, s := range sets {
		genericSets = append(genericSets, &genericChunkSeriesSetAdapter{s})

	}
	return &chunkSeriesSetAdapter{newGenericMergeSeriesSet(genericSets, (&chunkSeriesMergerAdapter{VerticalChunkSeriesMergeFunc: mergeFunc}).Merge)}
}

// genericMergeSeriesSet implements genericSeriesSet.
type genericMergeSeriesSet struct {
	currentLabels labels.Labels
	mergeFunc     genericSeriesMergeFunc

	heap        genericSeriesSetHeap
	sets        []genericSeriesSet
	currentSets []genericSeriesSet
}

// newGenericMergeSeriesSet returns a new genericSeriesSet that merges (and deduplicates)
// series returned by the series sets when iterating.
// Each series set must return its series in labels order, otherwise
// merged series set will be incorrect.
// Overlapped situations are merged using provided mergeFunc.
func newGenericMergeSeriesSet(sets []genericSeriesSet, mergeFunc genericSeriesMergeFunc) genericSeriesSet {
	if len(sets) == 1 {
		return sets[0]
	}

	// We are pre-advancing sets, so we can introspect the label of the
	// series under the cursor.
	var h genericSeriesSetHeap
	for _, set := range sets {
		if set == nil {
			continue
		}
		if set.Next() {
			heap.Push(&h, set)
		}
		if err := set.Err(); err != nil {
			return errorOnlySeriesSet{err}
		}
	}
	return &genericMergeSeriesSet{
		mergeFunc: mergeFunc,
		sets:      sets,
		heap:      h,
	}
}

func (c *genericMergeSeriesSet) Next() bool {
	// Run in a loop because the "next" series sets may not be valid anymore.
	// If, for the current label set, all the next series sets come from
	// failed remote storage sources, we want to keep trying with the next label set.
	for {
		// Firstly advance all the current series sets. If any of them have run out,
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
			set := heap.Pop(&c.heap).(genericSeriesSet)
			c.currentSets = append(c.currentSets, set)
		}

		// As long as the current set contains at least 1 set,
		// then it should return true.
		if len(c.currentSets) != 0 {
			break
		}
	}
	return true
}

func (c *genericMergeSeriesSet) At() Labels {
	if len(c.currentSets) == 1 {
		return c.currentSets[0].At()
	}
	series := make([]Labels, 0, len(c.currentSets))
	for _, seriesSet := range c.currentSets {
		series = append(series, seriesSet.At())
	}
	return c.mergeFunc(series...)
}

func (c *genericMergeSeriesSet) Err() error {
	for _, set := range c.sets {
		if err := set.Err(); err != nil {
			return err
		}
	}
	return nil
}

func (c *genericMergeSeriesSet) Warnings() Warnings {
	var ws Warnings
	for _, set := range c.sets {
		ws = append(ws, set.Warnings()...)
	}
	return ws
}

type genericSeriesSetHeap []genericSeriesSet

func (h genericSeriesSetHeap) Len() int      { return len(h) }
func (h genericSeriesSetHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h genericSeriesSetHeap) Less(i, j int) bool {
	a, b := h[i].At().Labels(), h[j].At().Labels()
	return labels.Compare(a, b) < 0
}

func (h *genericSeriesSetHeap) Push(x interface{}) {
	*h = append(*h, x.(genericSeriesSet))
}

func (h *genericSeriesSetHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

// ChainedSeriesMerge returns single series from many same, potentially overlapping series by chaining samples together.
// If one or more samples overlap, one sample from random overlapped ones is kept and all others with the same
// timestamp are dropped.
//
// This works the best with replicated series, where data from two series are exactly the same. This does not work well
// with "almost" the same data, e.g. from 2 Prometheus HA replicas. This is fine, since from the Prometheus perspective
// this never happens.
//
// It's optimized for non-overlap cases as well.
func ChainedSeriesMerge(series ...Series) Series {
	if len(series) == 0 {
		return nil
	}
	return &SeriesEntry{
		Lset: series[0].Labels(),
		SampleIteratorFn: func() chunkenc.Iterator {
			iterators := make([]chunkenc.Iterator, 0, len(series))
			for _, s := range series {
				iterators = append(iterators, s.Iterator())
			}
			return newChainSampleIterator(iterators)
		},
	}
}

// chainSampleIterator is responsible to iterate over samples from different iterators of the same time series in timestamps
// order. If one or more samples overlap, one sample from random overlapped ones is kept and all others with the same
// timestamp are dropped. It's optimized for non-overlap cases as well.
type chainSampleIterator struct {
	iterators []chunkenc.Iterator
	h         samplesIteratorHeap

	curr  chunkenc.Iterator
	lastt int64
}

func newChainSampleIterator(iterators []chunkenc.Iterator) chunkenc.Iterator {
	return &chainSampleIterator{
		iterators: iterators,
		h:         nil,
		lastt:     math.MinInt64,
	}
}

func (c *chainSampleIterator) Seek(t int64) bool {
	c.h = samplesIteratorHeap{}
	for _, iter := range c.iterators {
		if iter.Seek(t) {
			heap.Push(&c.h, iter)
		}
	}
	if len(c.h) > 0 {
		c.curr = heap.Pop(&c.h).(chunkenc.Iterator)
		return true
	}
	c.curr = nil
	return false
}

func (c *chainSampleIterator) At() (t int64, v float64) {
	if c.curr == nil {
		panic("chainSampleIterator.At() called before first .Next() or after .Next() returned false.")
	}
	return c.curr.At()
}

func (c *chainSampleIterator) Next() bool {
	if c.h == nil {
		c.h = samplesIteratorHeap{}
		// We call c.curr.Next() as the first thing below.
		// So, we don't call Next() on it here.
		c.curr = c.iterators[0]
		for _, iter := range c.iterators[1:] {
			if iter.Next() {
				heap.Push(&c.h, iter)
			}
		}
	}

	if c.curr == nil {
		return false
	}

	var currt int64
	for {
		if c.curr.Next() {
			currt, _ = c.curr.At()
			if currt == c.lastt {
				// Ignoring sample for the same timestamp.
				continue
			}
			if len(c.h) == 0 {
				// curr is the only iterator remaining,
				// no need to check with the heap.
				break
			}

			// Check current iterator with the top of the heap.
			if nextt, _ := c.h[0].At(); currt < nextt {
				// Current iterator has smaller timestamp than the heap.
				break
			}
			// Current iterator does not hold the smallest timestamp.
			heap.Push(&c.h, c.curr)
		} else if len(c.h) == 0 {
			// No iterator left to iterate.
			c.curr = nil
			return false
		}

		c.curr = heap.Pop(&c.h).(chunkenc.Iterator)
		currt, _ = c.curr.At()
		if currt != c.lastt {
			break
		}
	}

	c.lastt = currt
	return true
}

func (c *chainSampleIterator) Err() error {
	var errs tsdb_errors.MultiError
	for _, iter := range c.iterators {
		if err := iter.Err(); err != nil {
			errs.Add(err)
		}
	}
	return errs.Err()
}

type samplesIteratorHeap []chunkenc.Iterator

func (h samplesIteratorHeap) Len() int      { return len(h) }
func (h samplesIteratorHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h samplesIteratorHeap) Less(i, j int) bool {
	at, _ := h[i].At()
	bt, _ := h[j].At()
	return at < bt
}

func (h *samplesIteratorHeap) Push(x interface{}) {
	*h = append(*h, x.(chunkenc.Iterator))
}

func (h *samplesIteratorHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

// NewCompactingChunkSeriesMerger returns VerticalChunkSeriesMergeFunc that merges the same chunk series into single chunk series.
// In case of the chunk overlaps, it compacts those into one or more time-ordered non-overlapping chunks with merged data.
// Samples from overlapped chunks are merged using series vertical merge func.
// It expects the same labels for each given series.
//
// NOTE: Use the returned merge function only when you see potentially overlapping series, as this introduces small a overhead
// to handle overlaps between series.
func NewCompactingChunkSeriesMerger(mergeFunc VerticalSeriesMergeFunc) VerticalChunkSeriesMergeFunc {
	return func(series ...ChunkSeries) ChunkSeries {
		if len(series) == 0 {
			return nil
		}
		return &ChunkSeriesEntry{
			Lset: series[0].Labels(),
			ChunkIteratorFn: func() chunks.Iterator {
				iterators := make([]chunks.Iterator, 0, len(series))
				for _, s := range series {
					iterators = append(iterators, s.Iterator())
				}
				return &compactChunkIterator{
					mergeFunc: mergeFunc,
					iterators: iterators,
				}
			},
		}
	}
}

// compactChunkIterator is responsible to compact chunks from different iterators of the same time series into single chainSeries.
// If time-overlapping chunks are found, they are encoded and passed to series merge and encoded again into one bigger chunk.
// TODO(bwplotka): Currently merge will compact overlapping chunks with bigger chunk, without limit. Split it: https://github.com/prometheus/tsdb/issues/670
type compactChunkIterator struct {
	mergeFunc VerticalSeriesMergeFunc
	iterators []chunks.Iterator

	h chunkIteratorHeap

	err  error
	curr chunks.Meta
}

func (c *compactChunkIterator) At() chunks.Meta {
	return c.curr
}

func (c *compactChunkIterator) Next() bool {
	if c.h == nil {
		for _, iter := range c.iterators {
			if iter.Next() {
				heap.Push(&c.h, iter)
			}
		}
	}
	if len(c.h) == 0 {
		return false
	}

	iter := heap.Pop(&c.h).(chunks.Iterator)
	c.curr = iter.At()
	if iter.Next() {
		heap.Push(&c.h, iter)
	}

	var (
		overlapping []Series
		oMaxTime    = c.curr.MaxTime
		prev        = c.curr
	)
	// Detect overlaps to compact. Be smart about it and deduplicate on the fly if chunks are identical.
	for len(c.h) > 0 {
		// Get the next oldest chunk by min, then max time.
		next := c.h[0].At()
		if next.MinTime > oMaxTime {
			// No overlap with current one.
			break
		}

		if next.MinTime == prev.MinTime &&
			next.MaxTime == prev.MaxTime &&
			bytes.Equal(next.Chunk.Bytes(), prev.Chunk.Bytes()) {
			// 1:1 duplicates, skip it.
		} else {
			// We operate on same series, so labels does not matter here.
			overlapping = append(overlapping, newChunkToSeriesDecoder(nil, next))
			if next.MaxTime > oMaxTime {
				oMaxTime = next.MaxTime
			}
			prev = next
		}

		iter := heap.Pop(&c.h).(chunks.Iterator)
		if iter.Next() {
			heap.Push(&c.h, iter)
		}
	}
	if len(overlapping) == 0 {
		return true
	}

	// Add last as it's not yet included in overlap. We operate on same series, so labels does not matter here.
	iter = (&seriesToChunkEncoder{Series: c.mergeFunc(append(overlapping, newChunkToSeriesDecoder(nil, c.curr))...)}).Iterator()
	if !iter.Next() {
		if c.err = iter.Err(); c.err != nil {
			return false
		}
		panic("unexpected seriesToChunkEncoder lack of iterations")
	}
	c.curr = iter.At()
	if iter.Next() {
		heap.Push(&c.h, iter)
	}
	return true
}

func (c *compactChunkIterator) Err() error {
	var errs tsdb_errors.MultiError
	for _, iter := range c.iterators {
		if err := iter.Err(); err != nil {
			errs.Add(err)
		}
	}
	errs.Add(c.err)
	return errs.Err()
}

type chunkIteratorHeap []chunks.Iterator

func (h chunkIteratorHeap) Len() int      { return len(h) }
func (h chunkIteratorHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h chunkIteratorHeap) Less(i, j int) bool {
	at := h[i].At()
	bt := h[j].At()
	if at.MinTime == bt.MinTime {
		return at.MaxTime < bt.MaxTime
	}
	return at.MinTime < bt.MinTime
}

func (h *chunkIteratorHeap) Push(x interface{}) {
	*h = append(*h, x.(chunks.Iterator))
}

func (h *chunkIteratorHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}
