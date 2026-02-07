// Copyright 2021 The Prometheus Authors
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

package histogram

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
)

// CounterResetHint contains the known information about a counter reset,
// or alternatively that we are dealing with a gauge histogram, where counter resets do not apply.
type CounterResetHint byte

const (
	UnknownCounterReset CounterResetHint = iota // UnknownCounterReset means we cannot say if this histogram signals a counter reset or not.
	CounterReset                                // CounterReset means there was definitely a counter reset starting from this histogram.
	NotCounterReset                             // NotCounterReset means there was definitely no counter reset with this histogram.
	GaugeType                                   // GaugeType means this is a gauge histogram, where counter resets do not happen.
)

// Histogram encodes a sparse, high-resolution histogram. See the design
// document for full details:
// https://docs.google.com/document/d/1cLNv3aufPZb3fNfaJgdaRBZsInZKKIHo9E6HinJVbpM/edit#
//
// The most tricky bit is how bucket indices represent real bucket boundaries.
// An example for schema 0 (by which each bucket is twice as wide as the
// previous bucket):
//
//	Bucket boundaries →              [-2,-1)  [-1,-0.5) [-0.5,-0.25) ... [-0.001,0.001] ... (0.25,0.5] (0.5,1]  (1,2] ....
//	                                    ↑        ↑           ↑                  ↑                ↑         ↑      ↑
//	Zero bucket (width e.g. 0.001) →    |        |           |                  ZB               |         |      |
//	Positive bucket indices →           |        |           |                          ...     -1         0      1    2    3
//	Negative bucket indices →  3   2    1        0          -1       ...
//
// Which bucket indices are actually used is determined by the spans.
type Histogram struct {
	// Counter reset information.
	CounterResetHint CounterResetHint
	// Currently valid schema numbers are -4 <= n <= 8 for exponential buckets,
	// They are all for base-2 bucket schemas, where 1 is a bucket boundary in
	// each case, and then each power of two is divided into 2^n logarithmic buckets.
	// Or in other words, each bucket boundary is the previous boundary times
	// 2^(2^-n). Another valid schema number is -53 for custom buckets, defined by
	// the CustomValues field.
	Schema int32
	// Width of the zero bucket.
	ZeroThreshold float64
	// Observations falling into the zero bucket.
	ZeroCount uint64
	// Total number of observations.
	Count uint64
	// Sum of observations. This is also used as the stale marker.
	Sum float64
	// Spans for positive and negative buckets (see Span below).
	PositiveSpans, NegativeSpans []Span
	// Observation counts in buckets. The first element is an absolute
	// count. All following ones are deltas relative to the previous
	// element.
	PositiveBuckets, NegativeBuckets []int64
	// Holds the custom (usually upper) bounds for bucket definitions, otherwise nil.
	// This slice is interned, to be treated as immutable and copied by reference.
	// These numbers should be strictly increasing. This field is only used when the
	// schema is for custom buckets, and the ZeroThreshold, ZeroCount, NegativeSpans
	// and NegativeBuckets fields are not used in that case.
	CustomValues []float64
}

// A Span defines a continuous sequence of buckets.
type Span struct {
	// Gap to previous span (always positive), or starting index for the 1st
	// span (which can be negative).
	Offset int32
	// Length of the span.
	Length uint32
}

func (h *Histogram) UsesCustomBuckets() bool {
	return IsCustomBucketsSchema(h.Schema)
}

// Copy returns a deep copy of the Histogram.
func (h *Histogram) Copy() *Histogram {
	c := Histogram{
		CounterResetHint: h.CounterResetHint,
		Schema:           h.Schema,
		Count:            h.Count,
		Sum:              h.Sum,
	}

	if h.UsesCustomBuckets() {
		if len(h.CustomValues) != 0 {
			c.CustomValues = make([]float64, len(h.CustomValues))
			copy(c.CustomValues, h.CustomValues)
		}
	} else {
		c.ZeroThreshold = h.ZeroThreshold
		c.ZeroCount = h.ZeroCount

		if len(h.NegativeSpans) != 0 {
			c.NegativeSpans = make([]Span, len(h.NegativeSpans))
			copy(c.NegativeSpans, h.NegativeSpans)
		}
		if len(h.NegativeBuckets) != 0 {
			c.NegativeBuckets = make([]int64, len(h.NegativeBuckets))
			copy(c.NegativeBuckets, h.NegativeBuckets)
		}
	}

	if len(h.PositiveSpans) != 0 {
		c.PositiveSpans = make([]Span, len(h.PositiveSpans))
		copy(c.PositiveSpans, h.PositiveSpans)
	}
	if len(h.PositiveBuckets) != 0 {
		c.PositiveBuckets = make([]int64, len(h.PositiveBuckets))
		copy(c.PositiveBuckets, h.PositiveBuckets)
	}

	return &c
}

// CopyTo makes a deep copy into the given Histogram object.
// The destination object has to be a non-nil pointer.
func (h *Histogram) CopyTo(to *Histogram) {
	to.CounterResetHint = h.CounterResetHint
	to.Schema = h.Schema
	to.Count = h.Count
	to.Sum = h.Sum

	if h.UsesCustomBuckets() {
		to.ZeroThreshold = 0
		to.ZeroCount = 0

		to.NegativeSpans = clearIfNotNil(to.NegativeSpans)
		to.NegativeBuckets = clearIfNotNil(to.NegativeBuckets)

		to.CustomValues = resize(to.CustomValues, len(h.CustomValues))
		copy(to.CustomValues, h.CustomValues)
	} else {
		to.ZeroThreshold = h.ZeroThreshold
		to.ZeroCount = h.ZeroCount

		to.NegativeSpans = resize(to.NegativeSpans, len(h.NegativeSpans))
		copy(to.NegativeSpans, h.NegativeSpans)

		to.NegativeBuckets = resize(to.NegativeBuckets, len(h.NegativeBuckets))
		copy(to.NegativeBuckets, h.NegativeBuckets)

		to.CustomValues = clearIfNotNil(to.CustomValues)
	}

	to.PositiveSpans = resize(to.PositiveSpans, len(h.PositiveSpans))
	copy(to.PositiveSpans, h.PositiveSpans)

	to.PositiveBuckets = resize(to.PositiveBuckets, len(h.PositiveBuckets))
	copy(to.PositiveBuckets, h.PositiveBuckets)
}

// String returns a string representation of the Histogram.
func (h *Histogram) String() string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "{count:%d, sum:%g", h.Count, h.Sum)

	var nBuckets []Bucket[uint64]
	for it := h.NegativeBucketIterator(); it.Next(); {
		bucket := it.At()
		if bucket.Count != 0 {
			nBuckets = append(nBuckets, it.At())
		}
	}
	for i := len(nBuckets) - 1; i >= 0; i-- {
		fmt.Fprintf(&sb, ", %s", nBuckets[i].String())
	}

	if h.ZeroCount != 0 {
		fmt.Fprintf(&sb, ", %s", h.ZeroBucket().String())
	}

	for it := h.PositiveBucketIterator(); it.Next(); {
		bucket := it.At()
		if bucket.Count != 0 {
			fmt.Fprintf(&sb, ", %s", bucket.String())
		}
	}

	sb.WriteRune('}')
	return sb.String()
}

// ZeroBucket returns the zero bucket. This method panics if the schema is for custom buckets.
func (h *Histogram) ZeroBucket() Bucket[uint64] {
	if h.UsesCustomBuckets() {
		panic("histograms with custom buckets have no zero bucket")
	}
	return Bucket[uint64]{
		Lower:          -h.ZeroThreshold,
		Upper:          h.ZeroThreshold,
		LowerInclusive: true,
		UpperInclusive: true,
		Count:          h.ZeroCount,
	}
}

// PositiveBucketIterator returns a BucketIterator to iterate over all positive
// buckets in ascending order (starting next to the zero bucket and going up).
func (h *Histogram) PositiveBucketIterator() BucketIterator[uint64] {
	it := newRegularBucketIterator(h.PositiveSpans, h.PositiveBuckets, h.Schema, true, h.CustomValues)
	return &it
}

// NegativeBucketIterator returns a BucketIterator to iterate over all negative
// buckets in descending order (starting next to the zero bucket and going down).
func (h *Histogram) NegativeBucketIterator() BucketIterator[uint64] {
	it := newRegularBucketIterator(h.NegativeSpans, h.NegativeBuckets, h.Schema, false, nil)
	return &it
}

// CumulativeBucketIterator returns a BucketIterator to iterate over a
// cumulative view of the buckets. This method currently only supports
// Histograms without negative buckets and panics if the Histogram has negative
// buckets. It is currently only used for testing.
func (h *Histogram) CumulativeBucketIterator() BucketIterator[uint64] {
	if len(h.NegativeBuckets) > 0 {
		panic("CumulativeBucketIterator called on Histogram with negative buckets")
	}
	return &cumulativeBucketIterator{h: h, posSpansIdx: -1}
}

// Equals returns true if the given histogram matches exactly.
// Exact match is when there are no new buckets (even empty) and no missing buckets,
// and all the bucket values match. Spans can have different empty length spans in between,
// but they must represent the same bucket layout to match.
// Sum is compared based on its bit pattern because this method
// is about data equality rather than mathematical equality.
// We ignore fields that are not used based on the exponential / custom buckets schema,
// but check fields where differences may cause unintended behaviour even if they are not
// supposed to be used according to the schema.
func (h *Histogram) Equals(h2 *Histogram) bool {
	if h2 == nil {
		return false
	}

	if h.Schema != h2.Schema || h.Count != h2.Count ||
		math.Float64bits(h.Sum) != math.Float64bits(h2.Sum) {
		return false
	}

	if h.UsesCustomBuckets() {
		if !FloatBucketsMatch(h.CustomValues, h2.CustomValues) {
			return false
		}
	}

	if h.ZeroThreshold != h2.ZeroThreshold || h.ZeroCount != h2.ZeroCount {
		return false
	}

	if !spansMatch(h.NegativeSpans, h2.NegativeSpans) {
		return false
	}
	if !slices.Equal(h.NegativeBuckets, h2.NegativeBuckets) {
		return false
	}

	if !spansMatch(h.PositiveSpans, h2.PositiveSpans) {
		return false
	}
	if !slices.Equal(h.PositiveBuckets, h2.PositiveBuckets) {
		return false
	}

	return true
}

// spansMatch returns true if both spans represent the same bucket layout
// after combining zero length spans with the next non-zero length span.
func spansMatch(s1, s2 []Span) bool {
	if len(s1) == 0 && len(s2) == 0 {
		return true
	}

	s1idx, s2idx := 0, 0
	for {
		if s1idx >= len(s1) {
			return allEmptySpans(s2[s2idx:])
		}
		if s2idx >= len(s2) {
			return allEmptySpans(s1[s1idx:])
		}

		currS1, currS2 := s1[s1idx], s2[s2idx]
		s1idx++
		s2idx++
		if currS1.Length == 0 {
			// This span is zero length, so we add consecutive such spans
			// until we find a non-zero span.
			for ; s1idx < len(s1) && s1[s1idx].Length == 0; s1idx++ {
				currS1.Offset += s1[s1idx].Offset
			}
			if s1idx < len(s1) {
				currS1.Offset += s1[s1idx].Offset
				currS1.Length = s1[s1idx].Length
				s1idx++
			}
		}
		if currS2.Length == 0 {
			// This span is zero length, so we add consecutive such spans
			// until we find a non-zero span.
			for ; s2idx < len(s2) && s2[s2idx].Length == 0; s2idx++ {
				currS2.Offset += s2[s2idx].Offset
			}
			if s2idx < len(s2) {
				currS2.Offset += s2[s2idx].Offset
				currS2.Length = s2[s2idx].Length
				s2idx++
			}
		}

		if currS1.Length == 0 && currS2.Length == 0 {
			// The last spans of both set are zero length. Previous spans match.
			return true
		}

		if currS1.Offset != currS2.Offset || currS1.Length != currS2.Length {
			return false
		}
	}
}

func allEmptySpans(s []Span) bool {
	for _, ss := range s {
		if ss.Length > 0 {
			return false
		}
	}
	return true
}

// Compact works like FloatHistogram.Compact. See there for detailed
// explanations.
func (h *Histogram) Compact(maxEmptyBuckets int) *Histogram {
	h.PositiveBuckets, h.PositiveSpans = compactBuckets(
		h.PositiveBuckets, h.PositiveSpans, maxEmptyBuckets, true,
	)
	h.NegativeBuckets, h.NegativeSpans = compactBuckets(
		h.NegativeBuckets, h.NegativeSpans, maxEmptyBuckets, true,
	)
	return h
}

// ToFloat returns a FloatHistogram representation of the Histogram. It is a deep
// copy (e.g. spans are not shared). The function accepts a FloatHistogram as an
// argument whose memory will be reused and overwritten if provided. If this
// argument is nil, a new FloatHistogram will be allocated.
func (h *Histogram) ToFloat(fh *FloatHistogram) *FloatHistogram {
	if fh == nil {
		fh = &FloatHistogram{}
	}
	fh.CounterResetHint = h.CounterResetHint
	fh.Schema = h.Schema
	fh.Count = float64(h.Count)
	fh.Sum = h.Sum

	if h.UsesCustomBuckets() {
		fh.ZeroThreshold = 0
		fh.ZeroCount = 0
		fh.NegativeSpans = clearIfNotNil(fh.NegativeSpans)
		fh.NegativeBuckets = clearIfNotNil(fh.NegativeBuckets)

		fh.CustomValues = resize(fh.CustomValues, len(h.CustomValues))
		copy(fh.CustomValues, h.CustomValues)
	} else {
		fh.ZeroThreshold = h.ZeroThreshold
		fh.ZeroCount = float64(h.ZeroCount)

		fh.NegativeSpans = resize(fh.NegativeSpans, len(h.NegativeSpans))
		copy(fh.NegativeSpans, h.NegativeSpans)

		fh.NegativeBuckets = resize(fh.NegativeBuckets, len(h.NegativeBuckets))
		var currentNegative float64
		for i, b := range h.NegativeBuckets {
			currentNegative += float64(b)
			fh.NegativeBuckets[i] = currentNegative
		}
		fh.CustomValues = clearIfNotNil(fh.CustomValues)
	}

	fh.PositiveSpans = resize(fh.PositiveSpans, len(h.PositiveSpans))
	copy(fh.PositiveSpans, h.PositiveSpans)

	fh.PositiveBuckets = resize(fh.PositiveBuckets, len(h.PositiveBuckets))
	var currentPositive float64
	for i, b := range h.PositiveBuckets {
		currentPositive += float64(b)
		fh.PositiveBuckets[i] = currentPositive
	}

	return fh
}

func resize[T any](items []T, n int) []T {
	if cap(items) < n {
		return make([]T, n)
	}
	return items[:n]
}

// Validate validates consistency between span and bucket slices. Also, buckets are checked
// against negative values. We check to make sure there are no unexpected fields or field values
// based on the exponential / custom buckets schema.
// For histograms that have not observed any NaN values (based on IsNaN(h.Sum) check), a
// strict h.Count = nCount + pCount + h.ZeroCount check is performed.
// Otherwise, only a lower bound check will be done (h.Count >= nCount + pCount + h.ZeroCount),
// because NaN observations do not increment the values of buckets (but they do increment
// the total h.Count).
func (h *Histogram) Validate() error {
	var nCount, pCount uint64
	if h.UsesCustomBuckets() {
		if err := checkHistogramCustomBounds(h.CustomValues, h.PositiveSpans, len(h.PositiveBuckets)); err != nil {
			return fmt.Errorf("custom buckets: %w", err)
		}
		if h.ZeroCount != 0 {
			return errors.New("custom buckets: must have zero count of 0")
		}
		if h.ZeroThreshold != 0 {
			return errors.New("custom buckets: must have zero threshold of 0")
		}
		if len(h.NegativeSpans) > 0 {
			return errors.New("custom buckets: must not have negative spans")
		}
		if len(h.NegativeBuckets) > 0 {
			return errors.New("custom buckets: must not have negative buckets")
		}
	} else {
		if err := checkHistogramSpans(h.PositiveSpans, len(h.PositiveBuckets)); err != nil {
			return fmt.Errorf("positive side: %w", err)
		}
		if err := checkHistogramSpans(h.NegativeSpans, len(h.NegativeBuckets)); err != nil {
			return fmt.Errorf("negative side: %w", err)
		}
		err := checkHistogramBuckets(h.NegativeBuckets, &nCount, true)
		if err != nil {
			return fmt.Errorf("negative side: %w", err)
		}
		if h.CustomValues != nil {
			return errors.New("histogram with exponential schema must not have custom bounds")
		}
	}
	err := checkHistogramBuckets(h.PositiveBuckets, &pCount, true)
	if err != nil {
		return fmt.Errorf("positive side: %w", err)
	}

	sumOfBuckets := nCount + pCount + h.ZeroCount
	if math.IsNaN(h.Sum) {
		if sumOfBuckets > h.Count {
			return fmt.Errorf("%d observations found in buckets, but the Count field is %d: %w", sumOfBuckets, h.Count, ErrHistogramCountNotBigEnough)
		}
	} else {
		if sumOfBuckets != h.Count {
			return fmt.Errorf("%d observations found in buckets, but the Count field is %d: %w", sumOfBuckets, h.Count, ErrHistogramCountMismatch)
		}
	}

	return nil
}

type regularBucketIterator struct {
	baseBucketIterator[uint64, int64]
}

func newRegularBucketIterator(spans []Span, buckets []int64, schema int32, positive bool, customValues []float64) regularBucketIterator {
	i := baseBucketIterator[uint64, int64]{
		schema:       schema,
		spans:        spans,
		buckets:      buckets,
		positive:     positive,
		customValues: customValues,
	}
	return regularBucketIterator{i}
}

func (r *regularBucketIterator) Next() bool {
	if r.spansIdx >= len(r.spans) {
		return false
	}
	span := r.spans[r.spansIdx]
	// Seed currIdx for the first bucket.
	if r.bucketsIdx == 0 {
		r.currIdx = span.Offset
	} else {
		r.currIdx++
	}
	for r.idxInSpan >= span.Length {
		// We have exhausted the current span and have to find a new
		// one. We'll even handle pathologic spans of length 0.
		r.idxInSpan = 0
		r.spansIdx++
		if r.spansIdx >= len(r.spans) {
			return false
		}
		span = r.spans[r.spansIdx]
		r.currIdx += span.Offset
	}

	r.currCount += r.buckets[r.bucketsIdx]
	r.idxInSpan++
	r.bucketsIdx++
	return true
}

type cumulativeBucketIterator struct {
	h *Histogram

	posSpansIdx   int    // Index in h.PositiveSpans we are in. -1 means 0 bucket.
	posBucketsIdx int    // Index in h.PositiveBuckets.
	idxInSpan     uint32 // Index in the current span. 0 <= idxInSpan < span.Length.

	initialized         bool
	currIdx             int32   // The actual bucket index after decoding from spans.
	currUpper           float64 // The upper boundary of the current bucket.
	currCount           int64   // Current non-cumulative count for the current bucket. Does not apply for empty bucket.
	currCumulativeCount uint64  // Current "cumulative" count for the current bucket.

	// Between 2 spans there could be some empty buckets which
	// still needs to be counted for cumulative buckets.
	// When we hit the end of a span, we use this to iterate
	// through the empty buckets.
	emptyBucketCount int32
}

func (c *cumulativeBucketIterator) Next() bool {
	if c.posSpansIdx == -1 {
		// Zero bucket.
		c.posSpansIdx++
		if c.h.ZeroCount == 0 {
			return c.Next()
		}

		c.currUpper = c.h.ZeroThreshold
		c.currCount = int64(c.h.ZeroCount)
		c.currCumulativeCount = uint64(c.currCount)
		return true
	}

	if c.posSpansIdx >= len(c.h.PositiveSpans) {
		return false
	}

	if c.emptyBucketCount > 0 {
		// We are traversing through empty buckets at the moment.
		c.currUpper = getBound(c.currIdx, c.h.Schema, c.h.CustomValues)
		c.currIdx++
		c.emptyBucketCount--
		return true
	}

	span := c.h.PositiveSpans[c.posSpansIdx]
	if c.posSpansIdx == 0 && !c.initialized {
		// Initializing.
		c.currIdx = span.Offset
		// The first bucket is an absolute value and not a delta with Zero bucket.
		c.currCount = 0
		c.initialized = true
	}

	c.currCount += c.h.PositiveBuckets[c.posBucketsIdx]
	c.currCumulativeCount += uint64(c.currCount)
	c.currUpper = getBound(c.currIdx, c.h.Schema, c.h.CustomValues)

	c.posBucketsIdx++
	c.idxInSpan++
	c.currIdx++
	if c.idxInSpan >= span.Length {
		// Move to the next span. This one is done.
		c.posSpansIdx++
		c.idxInSpan = 0
		if c.posSpansIdx < len(c.h.PositiveSpans) {
			c.emptyBucketCount = c.h.PositiveSpans[c.posSpansIdx].Offset
		}
	}

	return true
}

func (c *cumulativeBucketIterator) At() Bucket[uint64] {
	return Bucket[uint64]{
		Upper:          c.currUpper,
		Lower:          math.Inf(-1),
		UpperInclusive: true,
		LowerInclusive: true,
		Count:          c.currCumulativeCount,
		Index:          c.currIdx - 1,
	}
}

// ReduceResolution reduces the histogram's spans, buckets into target schema.
// The target schema must be smaller than the current histogram's schema.
// This will panic if the histogram has custom buckets or if the target schema is
// a custom buckets schema.
func (h *Histogram) ReduceResolution(targetSchema int32) *Histogram {
	if h.UsesCustomBuckets() {
		panic("cannot reduce resolution when there are custom buckets")
	}
	if IsCustomBucketsSchema(targetSchema) {
		panic("cannot reduce resolution to custom buckets schema")
	}
	if targetSchema >= h.Schema {
		panic(fmt.Errorf("cannot reduce resolution from schema %d to %d", h.Schema, targetSchema))
	}

	h.PositiveSpans, h.PositiveBuckets = reduceResolution(
		h.PositiveSpans, h.PositiveBuckets, h.Schema, targetSchema, true, true,
	)
	h.NegativeSpans, h.NegativeBuckets = reduceResolution(
		h.NegativeSpans, h.NegativeBuckets, h.Schema, targetSchema, true, true,
	)
	h.Schema = targetSchema
	return h
}
