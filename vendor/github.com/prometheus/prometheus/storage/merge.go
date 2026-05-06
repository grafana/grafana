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
	"context"
	"fmt"
	"math"
	"sync"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/tsdb/chunks"
	tsdb_errors "github.com/prometheus/prometheus/tsdb/errors"
	"github.com/prometheus/prometheus/util/annotations"
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
func NewMergeQuerier(primaries, secondaries []Querier, mergeFn VerticalSeriesMergeFunc) Querier {
	primaries = filterQueriers(primaries)
	secondaries = filterQueriers(secondaries)

	switch {
	case len(primaries) == 0 && len(secondaries) == 0:
		return noopQuerier{}
	case len(primaries) == 1 && len(secondaries) == 0:
		return primaries[0]
	case len(primaries) == 0 && len(secondaries) == 1:
		return &querierAdapter{newSecondaryQuerierFrom(secondaries[0])}
	}

	queriers := make([]genericQuerier, 0, len(primaries)+len(secondaries))
	for _, q := range primaries {
		queriers = append(queriers, newGenericQuerierFrom(q))
	}
	for _, q := range secondaries {
		queriers = append(queriers, newSecondaryQuerierFrom(q))
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

func filterQueriers(qs []Querier) []Querier {
	ret := make([]Querier, 0, len(qs))
	for _, q := range qs {
		if _, ok := q.(noopQuerier); !ok && q != nil {
			ret = append(ret, q)
		}
	}
	return ret
}

// NewMergeChunkQuerier returns a new Chunk Querier that merges results of given primary and secondary chunk queriers.
// See NewFanout commentary to learn more about primary vs secondary differences.
//
// In case of overlaps between the data given by primaries' and secondaries' Selects, merge function will be used.
// TODO(bwplotka): Currently merge will compact overlapping chunks with bigger chunk, without limit. Split it: https://github.com/prometheus/tsdb/issues/670
func NewMergeChunkQuerier(primaries, secondaries []ChunkQuerier, mergeFn VerticalChunkSeriesMergeFunc) ChunkQuerier {
	primaries = filterChunkQueriers(primaries)
	secondaries = filterChunkQueriers(secondaries)

	switch {
	case len(primaries) == 0 && len(secondaries) == 0:
		return noopChunkQuerier{}
	case len(primaries) == 1 && len(secondaries) == 0:
		return primaries[0]
	case len(primaries) == 0 && len(secondaries) == 1:
		return &chunkQuerierAdapter{newSecondaryQuerierFromChunk(secondaries[0])}
	}

	queriers := make([]genericQuerier, 0, len(primaries)+len(secondaries))
	for _, q := range primaries {
		queriers = append(queriers, newGenericQuerierFromChunk(q))
	}
	for _, q := range secondaries {
		queriers = append(queriers, newSecondaryQuerierFromChunk(q))
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

func filterChunkQueriers(qs []ChunkQuerier) []ChunkQuerier {
	ret := make([]ChunkQuerier, 0, len(qs))
	for _, q := range qs {
		if _, ok := q.(noopChunkQuerier); !ok && q != nil {
			ret = append(ret, q)
		}
	}
	return ret
}

// Select returns a set of series that matches the given label matchers.
func (q *mergeGenericQuerier) Select(ctx context.Context, _ bool, hints *SelectHints, matchers ...*labels.Matcher) genericSeriesSet {
	seriesSets := make([]genericSeriesSet, 0, len(q.queriers))
	var limit int
	if hints != nil {
		limit = hints.Limit
	}
	if !q.concurrentSelect {
		for _, querier := range q.queriers {
			// We need to sort for merge  to work.
			seriesSets = append(seriesSets, querier.Select(ctx, true, hints, matchers...))
		}
		return &lazyGenericSeriesSet{init: func() (genericSeriesSet, bool) {
			s := newGenericMergeSeriesSet(seriesSets, limit, q.mergeFn)
			return s, s.Next()
		}}
	}

	var (
		wg            sync.WaitGroup
		seriesSetChan = make(chan genericSeriesSet)
	)
	// Schedule all Selects for all queriers we know about.
	for _, querier := range q.queriers {
		// copy the matchers as some queriers may alter the slice.
		// See https://github.com/prometheus/prometheus/issues/14723
		matchersCopy := make([]*labels.Matcher, len(matchers))
		copy(matchersCopy, matchers)

		wg.Add(1)
		go func(qr genericQuerier, m []*labels.Matcher) {
			defer wg.Done()

			// We need to sort for NewMergeSeriesSet to work.
			seriesSetChan <- qr.Select(ctx, true, hints, m...)
		}(querier, matchersCopy)
	}
	go func() {
		wg.Wait()
		close(seriesSetChan)
	}()

	for r := range seriesSetChan {
		seriesSets = append(seriesSets, r)
	}
	return &lazyGenericSeriesSet{init: func() (genericSeriesSet, bool) {
		s := newGenericMergeSeriesSet(seriesSets, limit, q.mergeFn)
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
// If matchers are specified the returned result set is reduced
// to label values of metrics matching the matchers.
func (q *mergeGenericQuerier) LabelValues(ctx context.Context, name string, hints *LabelHints, matchers ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	res, ws, err := q.mergeResults(q.queriers, hints, func(q LabelQuerier) ([]string, annotations.Annotations, error) {
		return q.LabelValues(ctx, name, hints, matchers...)
	})
	if err != nil {
		return nil, nil, fmt.Errorf("LabelValues() from merge generic querier for label %s: %w", name, err)
	}
	return res, ws, nil
}

// mergeResults performs merge sort on the results of invoking the resultsFn against multiple queriers.
func (q *mergeGenericQuerier) mergeResults(lq labelGenericQueriers, hints *LabelHints, resultsFn func(q LabelQuerier) ([]string, annotations.Annotations, error)) ([]string, annotations.Annotations, error) {
	if lq.Len() == 0 {
		return nil, nil, nil
	}
	if lq.Len() == 1 {
		return resultsFn(lq.Get(0))
	}
	a, b := lq.SplitByHalf()

	var ws annotations.Annotations
	s1, w, err := q.mergeResults(a, hints, resultsFn)
	ws.Merge(w)
	if err != nil {
		return nil, ws, err
	}
	s2, w, err := q.mergeResults(b, hints, resultsFn)
	ws.Merge(w)
	if err != nil {
		return nil, ws, err
	}

	s1 = truncateToLimit(s1, hints)
	s2 = truncateToLimit(s2, hints)

	merged := mergeStrings(s1, s2)
	merged = truncateToLimit(merged, hints)

	return merged, ws, nil
}

func mergeStrings(a, b []string) []string {
	maxl := len(a)
	if len(b) > len(a) {
		maxl = len(b)
	}
	res := make([]string, 0, maxl*10/9)

	for len(a) > 0 && len(b) > 0 {
		switch {
		case a[0] == b[0]:
			res = append(res, a[0])
			a, b = a[1:], b[1:]
		case a[0] < b[0]:
			res = append(res, a[0])
			a = a[1:]
		default:
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
func (q *mergeGenericQuerier) LabelNames(ctx context.Context, hints *LabelHints, matchers ...*labels.Matcher) ([]string, annotations.Annotations, error) {
	res, ws, err := q.mergeResults(q.queriers, hints, func(q LabelQuerier) ([]string, annotations.Annotations, error) {
		return q.LabelNames(ctx, hints, matchers...)
	})
	if err != nil {
		return nil, nil, fmt.Errorf("LabelNames() from merge generic querier: %w", err)
	}
	return res, ws, nil
}

// Close releases the resources of the generic querier.
func (q *mergeGenericQuerier) Close() error {
	errs := tsdb_errors.NewMulti()
	for _, querier := range q.queriers {
		if err := querier.Close(); err != nil {
			errs.Add(err)
		}
	}
	return errs.Err()
}

func truncateToLimit(s []string, hints *LabelHints) []string {
	if hints != nil && hints.Limit > 0 && len(s) > hints.Limit {
		s = s[:hints.Limit]
	}
	return s
}

// VerticalSeriesMergeFunc returns merged series implementation that merges series with same labels together.
// It has to handle time-overlapped series as well.
type VerticalSeriesMergeFunc func(...Series) Series

// NewMergeSeriesSet returns a new SeriesSet that merges many SeriesSets together.
// If limit is set, the SeriesSet will be limited up-to the limit. 0 means disabled.
func NewMergeSeriesSet(sets []SeriesSet, limit int, mergeFunc VerticalSeriesMergeFunc) SeriesSet {
	genericSets := make([]genericSeriesSet, 0, len(sets))
	for _, s := range sets {
		genericSets = append(genericSets, &genericSeriesSetAdapter{s})
	}
	return &seriesSetAdapter{newGenericMergeSeriesSet(genericSets, limit, (&seriesMergerAdapter{VerticalSeriesMergeFunc: mergeFunc}).Merge)}
}

// VerticalChunkSeriesMergeFunc returns merged chunk series implementation that merges potentially time-overlapping
// chunk series with the same labels into single ChunkSeries.
//
// NOTE: It's up to implementation how series are vertically merged (if chunks are sorted, re-encoded etc).
type VerticalChunkSeriesMergeFunc func(...ChunkSeries) ChunkSeries

// NewMergeChunkSeriesSet returns a new ChunkSeriesSet that merges many SeriesSet together.
func NewMergeChunkSeriesSet(sets []ChunkSeriesSet, limit int, mergeFunc VerticalChunkSeriesMergeFunc) ChunkSeriesSet {
	genericSets := make([]genericSeriesSet, 0, len(sets))
	for _, s := range sets {
		genericSets = append(genericSets, &genericChunkSeriesSetAdapter{s})
	}
	return &chunkSeriesSetAdapter{newGenericMergeSeriesSet(genericSets, limit, (&chunkSeriesMergerAdapter{VerticalChunkSeriesMergeFunc: mergeFunc}).Merge)}
}

// genericMergeSeriesSet implements genericSeriesSet.
type genericMergeSeriesSet struct {
	currentLabels labels.Labels
	mergeFunc     genericSeriesMergeFunc

	heap         genericSeriesSetHeap
	sets         []genericSeriesSet
	currentSets  []genericSeriesSet
	seriesLimit  int
	mergedSeries int // tracks the total number of series merged and returned.
}

// newGenericMergeSeriesSet returns a new genericSeriesSet that merges (and deduplicates)
// series returned by the series sets when iterating.
// Each series set must return its series in labels order, otherwise
// merged series set will be incorrect.
// Overlapped situations are merged using provided mergeFunc.
// If seriesLimit is set, only limited series are returned.
func newGenericMergeSeriesSet(sets []genericSeriesSet, seriesLimit int, mergeFunc genericSeriesMergeFunc) genericSeriesSet {
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
		mergeFunc:   mergeFunc,
		sets:        sets,
		heap:        h,
		seriesLimit: seriesLimit,
	}
}

func (c *genericMergeSeriesSet) Next() bool {
	if c.seriesLimit > 0 && c.mergedSeries >= c.seriesLimit {
		// Exit early if seriesLimit is set.
		return false
	}

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
		c.currentSets = c.currentSets[:0]
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
	c.mergedSeries++
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

func (c *genericMergeSeriesSet) Warnings() annotations.Annotations {
	var ws annotations.Annotations
	for _, set := range c.sets {
		ws.Merge(set.Warnings())
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
		SampleIteratorFn: func(it chunkenc.Iterator) chunkenc.Iterator {
			return ChainSampleIteratorFromSeries(it, series)
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
	lastT int64

	// Whether the previous and the current sample are direct neighbors
	// within the same base iterator.
	consecutive bool
}

// Return a chainSampleIterator initialized for length entries, re-using the memory from it if possible.
func getChainSampleIterator(it chunkenc.Iterator, length int) *chainSampleIterator {
	csi, ok := it.(*chainSampleIterator)
	if !ok {
		csi = &chainSampleIterator{}
	}
	if cap(csi.iterators) < length {
		csi.iterators = make([]chunkenc.Iterator, length)
	} else {
		csi.iterators = csi.iterators[:length]
	}
	csi.h = nil
	csi.lastT = math.MinInt64
	return csi
}

func ChainSampleIteratorFromSeries(it chunkenc.Iterator, series []Series) chunkenc.Iterator {
	csi := getChainSampleIterator(it, len(series))
	for i, s := range series {
		csi.iterators[i] = s.Iterator(csi.iterators[i])
	}
	return csi
}

func ChainSampleIteratorFromIterables(it chunkenc.Iterator, iterables []chunkenc.Iterable) chunkenc.Iterator {
	csi := getChainSampleIterator(it, len(iterables))
	for i, c := range iterables {
		csi.iterators[i] = c.Iterator(csi.iterators[i])
	}
	return csi
}

func ChainSampleIteratorFromIterators(it chunkenc.Iterator, iterators []chunkenc.Iterator) chunkenc.Iterator {
	csi := getChainSampleIterator(it, 0)
	csi.iterators = iterators
	return csi
}

func (c *chainSampleIterator) Seek(t int64) chunkenc.ValueType {
	// No-op check.
	if c.curr != nil && c.lastT >= t {
		return c.curr.Seek(c.lastT)
	}
	// Don't bother to find out if the next sample is consecutive. Callers
	// of Seek usually aren't interested anyway.
	c.consecutive = false
	c.h = samplesIteratorHeap{}
	for _, iter := range c.iterators {
		if iter.Seek(t) == chunkenc.ValNone {
			if iter.Err() != nil {
				// If any iterator is reporting an error, abort.
				return chunkenc.ValNone
			}
			continue
		}
		heap.Push(&c.h, iter)
	}
	if len(c.h) > 0 {
		c.curr = heap.Pop(&c.h).(chunkenc.Iterator)
		c.lastT = c.curr.AtT()
		return c.curr.Seek(c.lastT)
	}
	c.curr = nil
	return chunkenc.ValNone
}

func (c *chainSampleIterator) At() (t int64, v float64) {
	if c.curr == nil {
		panic("chainSampleIterator.At called before first .Next or after .Next returned false.")
	}
	return c.curr.At()
}

func (c *chainSampleIterator) AtHistogram(h *histogram.Histogram) (int64, *histogram.Histogram) {
	if c.curr == nil {
		panic("chainSampleIterator.AtHistogram called before first .Next or after .Next returned false.")
	}
	t, h := c.curr.AtHistogram(h)
	// If the current sample is not consecutive with the previous one, we
	// cannot be sure anymore about counter resets for counter histograms.
	// TODO(beorn7): If a `NotCounterReset` sample is followed by a
	// non-consecutive `CounterReset` sample, we could keep the hint as
	// `CounterReset`. But then we needed to track the previous sample
	// in more detail, which might not be worth it.
	if !c.consecutive && h.CounterResetHint != histogram.GaugeType {
		h.CounterResetHint = histogram.UnknownCounterReset
	}
	return t, h
}

func (c *chainSampleIterator) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	if c.curr == nil {
		panic("chainSampleIterator.AtFloatHistogram called before first .Next or after .Next returned false.")
	}
	t, fh := c.curr.AtFloatHistogram(fh)
	// If the current sample is not consecutive with the previous one, we
	// cannot be sure anymore about counter resets for counter histograms.
	// TODO(beorn7): If a `NotCounterReset` sample is followed by a
	// non-consecutive `CounterReset` sample, we could keep the hint as
	// `CounterReset`. But then we needed to track the previous sample
	// in more detail, which might not be worth it.
	if !c.consecutive && fh.CounterResetHint != histogram.GaugeType {
		fh.CounterResetHint = histogram.UnknownCounterReset
	}
	return t, fh
}

func (c *chainSampleIterator) AtT() int64 {
	if c.curr == nil {
		panic("chainSampleIterator.AtT called before first .Next or after .Next returned false.")
	}
	return c.curr.AtT()
}

func (c *chainSampleIterator) Next() chunkenc.ValueType {
	var (
		currT           int64
		currValueType   chunkenc.ValueType
		iteratorChanged bool
	)
	if c.h == nil {
		iteratorChanged = true
		c.h = samplesIteratorHeap{}
		// We call c.curr.Next() as the first thing below.
		// So, we don't call Next() on it here.
		c.curr = c.iterators[0]
		for _, iter := range c.iterators[1:] {
			if iter.Next() == chunkenc.ValNone {
				if iter.Err() != nil {
					// If any iterator is reporting an error, abort.
					// If c.iterators[0] is reporting an error, we'll handle that below.
					return chunkenc.ValNone
				}
			} else {
				heap.Push(&c.h, iter)
			}
		}
	}

	if c.curr == nil {
		return chunkenc.ValNone
	}

	for {
		currValueType = c.curr.Next()

		if currValueType == chunkenc.ValNone {
			if c.curr.Err() != nil {
				// Abort if we've hit an error.
				return chunkenc.ValNone
			}

			if len(c.h) == 0 {
				// No iterator left to iterate.
				c.curr = nil
				return chunkenc.ValNone
			}
		} else {
			currT = c.curr.AtT()
			if currT == c.lastT {
				// Ignoring sample for the same timestamp.
				continue
			}
			if len(c.h) == 0 {
				// curr is the only iterator remaining,
				// no need to check with the heap.
				break
			}

			// Check current iterator with the top of the heap.
			nextT := c.h[0].AtT()
			if currT < nextT {
				// Current iterator has smaller timestamp than the heap.
				break
			}
			// Current iterator does not hold the smallest timestamp.
			heap.Push(&c.h, c.curr)
		}

		c.curr = heap.Pop(&c.h).(chunkenc.Iterator)
		iteratorChanged = true
		currT = c.curr.AtT()
		currValueType = c.curr.Seek(currT)
		if currT != c.lastT {
			break
		}
	}

	c.consecutive = !iteratorChanged
	c.lastT = currT
	return currValueType
}

func (c *chainSampleIterator) Err() error {
	errs := tsdb_errors.NewMulti()
	for _, iter := range c.iterators {
		errs.Add(iter.Err())
	}
	return errs.Err()
}

type samplesIteratorHeap []chunkenc.Iterator

func (h samplesIteratorHeap) Len() int      { return len(h) }
func (h samplesIteratorHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h samplesIteratorHeap) Less(i, j int) bool {
	return h[i].AtT() < h[j].AtT()
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
			ChunkIteratorFn: func(chunks.Iterator) chunks.Iterator {
				iterators := make([]chunks.Iterator, 0, len(series))
				for _, s := range series {
					iterators = append(iterators, s.Iterator(nil))
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

		// Only do something if it is not a perfect duplicate.
		if next.MinTime != prev.MinTime ||
			next.MaxTime != prev.MaxTime ||
			!bytes.Equal(next.Chunk.Bytes(), prev.Chunk.Bytes()) {
			// We operate on same series, so labels do not matter here.
			overlapping = append(overlapping, newChunkToSeriesDecoder(labels.EmptyLabels(), next))
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
	iter = NewSeriesToChunkEncoder(c.mergeFunc(append(overlapping, newChunkToSeriesDecoder(labels.EmptyLabels(), c.curr))...)).Iterator(nil)
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
	errs := tsdb_errors.NewMulti()
	for _, iter := range c.iterators {
		errs.Add(iter.Err())
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

// NewConcatenatingChunkSeriesMerger returns a VerticalChunkSeriesMergeFunc that simply concatenates the
// chunks from the series. The resultant stream of chunks for a series might be overlapping and unsorted.
func NewConcatenatingChunkSeriesMerger() VerticalChunkSeriesMergeFunc {
	return func(series ...ChunkSeries) ChunkSeries {
		if len(series) == 0 {
			return nil
		}
		return &ChunkSeriesEntry{
			Lset: series[0].Labels(),
			ChunkIteratorFn: func(chunks.Iterator) chunks.Iterator {
				iterators := make([]chunks.Iterator, 0, len(series))
				for _, s := range series {
					iterators = append(iterators, s.Iterator(nil))
				}
				return &concatenatingChunkIterator{
					iterators: iterators,
				}
			},
		}
	}
}

type concatenatingChunkIterator struct {
	iterators []chunks.Iterator
	idx       int

	curr chunks.Meta
}

func (c *concatenatingChunkIterator) At() chunks.Meta {
	return c.curr
}

func (c *concatenatingChunkIterator) Next() bool {
	if c.idx >= len(c.iterators) {
		return false
	}
	if c.iterators[c.idx].Next() {
		c.curr = c.iterators[c.idx].At()
		return true
	}
	if c.iterators[c.idx].Err() != nil {
		return false
	}
	c.idx++
	return c.Next()
}

func (c *concatenatingChunkIterator) Err() error {
	errs := tsdb_errors.NewMulti()
	for _, iter := range c.iterators {
		errs.Add(iter.Err())
	}
	return errs.Err()
}
