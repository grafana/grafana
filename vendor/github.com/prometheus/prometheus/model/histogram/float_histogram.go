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
	"strings"
)

// FloatHistogram is similar to Histogram but uses float64 for all
// counts. Additionally, bucket counts are absolute and not deltas.
//
// A FloatHistogram is needed by PromQL to handle operations that might result
// in fractional counts. Since the counts in a histogram are unlikely to be too
// large to be represented precisely by a float64, a FloatHistogram can also be
// used to represent a histogram with integer counts and thus serves as a more
// generalized representation.
type FloatHistogram struct {
	// Counter reset information.
	CounterResetHint CounterResetHint
	// Currently valid schema numbers are -4 <= n <= 8 for exponential buckets.
	// They are all for base-2 bucket schemas, where 1 is a bucket boundary in
	// each case, and then each power of two is divided into 2^n logarithmic buckets.
	// Or in other words, each bucket boundary is the previous boundary times
	// 2^(2^-n). Another valid schema number is -53 for custom buckets, defined by
	// the CustomValues field.
	Schema int32
	// Width of the zero bucket.
	ZeroThreshold float64
	// Observations falling into the zero bucket. Must be zero or positive.
	ZeroCount float64
	// Total number of observations. Must be zero or positive.
	Count float64
	// Sum of observations. This is also used as the stale marker.
	Sum float64
	// Spans for positive and negative buckets (see Span below).
	PositiveSpans, NegativeSpans []Span
	// Observation counts in buckets. Each represents an absolute count and
	// must be zero or positive.
	PositiveBuckets, NegativeBuckets []float64
	// Holds the custom (usually upper) bounds for bucket definitions, otherwise nil.
	// This slice is interned, to be treated as immutable and copied by reference.
	// These numbers should be strictly increasing. This field is only used when the
	// schema is for custom buckets, and the ZeroThreshold, ZeroCount, NegativeSpans
	// and NegativeBuckets fields are not used in that case.
	CustomValues []float64
}

func (h *FloatHistogram) UsesCustomBuckets() bool {
	return IsCustomBucketsSchema(h.Schema)
}

// Copy returns a deep copy of the Histogram.
func (h *FloatHistogram) Copy() *FloatHistogram {
	c := FloatHistogram{
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
			c.NegativeBuckets = make([]float64, len(h.NegativeBuckets))
			copy(c.NegativeBuckets, h.NegativeBuckets)
		}
	}

	if len(h.PositiveSpans) != 0 {
		c.PositiveSpans = make([]Span, len(h.PositiveSpans))
		copy(c.PositiveSpans, h.PositiveSpans)
	}
	if len(h.PositiveBuckets) != 0 {
		c.PositiveBuckets = make([]float64, len(h.PositiveBuckets))
		copy(c.PositiveBuckets, h.PositiveBuckets)
	}

	return &c
}

// CopyTo makes a deep copy into the given FloatHistogram.
// The destination object has to be a non-nil pointer.
func (h *FloatHistogram) CopyTo(to *FloatHistogram) {
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

// CopyToSchema works like Copy, but the returned deep copy has the provided
// target schema, which must be ≤ the original schema (i.e. it must have a lower
// resolution). This method panics if a custom buckets schema is used in the
// receiving FloatHistogram or as the provided targetSchema.
func (h *FloatHistogram) CopyToSchema(targetSchema int32) *FloatHistogram {
	if targetSchema == h.Schema {
		// Fast path.
		return h.Copy()
	}
	if h.UsesCustomBuckets() {
		panic(fmt.Errorf("cannot reduce resolution to %d when there are custom buckets", targetSchema))
	}
	if IsCustomBucketsSchema(targetSchema) {
		panic("cannot reduce resolution to custom buckets schema")
	}
	if targetSchema > h.Schema {
		panic(fmt.Errorf("cannot copy from schema %d to %d", h.Schema, targetSchema))
	}
	c := FloatHistogram{
		Schema:        targetSchema,
		ZeroThreshold: h.ZeroThreshold,
		ZeroCount:     h.ZeroCount,
		Count:         h.Count,
		Sum:           h.Sum,
	}

	c.PositiveSpans, c.PositiveBuckets = reduceResolution(h.PositiveSpans, h.PositiveBuckets, h.Schema, targetSchema, false, false)
	c.NegativeSpans, c.NegativeBuckets = reduceResolution(h.NegativeSpans, h.NegativeBuckets, h.Schema, targetSchema, false, false)

	return &c
}

// String returns a string representation of the Histogram.
func (h *FloatHistogram) String() string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "{count:%g, sum:%g", h.Count, h.Sum)

	var nBuckets []Bucket[float64]
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

// TestExpression returns the string representation of this histogram as it is used in the internal PromQL testing
// framework as well as in promtool rules unit tests.
// The syntax is described in https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/#series
func (h *FloatHistogram) TestExpression() string {
	var res []string
	m := h.Copy()

	m.Compact(math.MaxInt) // Compact to reduce the number of positive and negative spans to 1.

	if m.Schema != 0 {
		res = append(res, fmt.Sprintf("schema:%d", m.Schema))
	}
	if m.Count != 0 {
		res = append(res, fmt.Sprintf("count:%g", m.Count))
	}
	if m.Sum != 0 {
		res = append(res, fmt.Sprintf("sum:%g", m.Sum))
	}
	if m.ZeroCount != 0 {
		res = append(res, fmt.Sprintf("z_bucket:%g", m.ZeroCount))
	}
	if m.ZeroThreshold != 0 {
		res = append(res, fmt.Sprintf("z_bucket_w:%g", m.ZeroThreshold))
	}
	if m.UsesCustomBuckets() {
		res = append(res, fmt.Sprintf("custom_values:%g", m.CustomValues))
	}

	switch m.CounterResetHint {
	case UnknownCounterReset:
		// Unknown is the default, don't add anything.
	case CounterReset:
		res = append(res, "counter_reset_hint:reset")
	case NotCounterReset:
		res = append(res, "counter_reset_hint:not_reset")
	case GaugeType:
		res = append(res, "counter_reset_hint:gauge")
	}

	addBuckets := func(kind, bucketsKey, offsetKey string, buckets []float64, spans []Span) []string {
		if len(spans) > 1 {
			panic(fmt.Sprintf("histogram with multiple %s spans not supported", kind))
		}
		for _, span := range spans {
			if span.Offset != 0 {
				res = append(res, fmt.Sprintf("%s:%d", offsetKey, span.Offset))
			}
		}

		var bucketStr []string
		for _, bucket := range buckets {
			bucketStr = append(bucketStr, fmt.Sprintf("%g", bucket))
		}
		if len(bucketStr) > 0 {
			res = append(res, fmt.Sprintf("%s:[%s]", bucketsKey, strings.Join(bucketStr, " ")))
		}
		return res
	}
	res = addBuckets("positive", "buckets", "offset", m.PositiveBuckets, m.PositiveSpans)
	res = addBuckets("negative", "n_buckets", "n_offset", m.NegativeBuckets, m.NegativeSpans)
	return "{{" + strings.Join(res, " ") + "}}"
}

// ZeroBucket returns the zero bucket. This method panics if the schema is for custom buckets.
func (h *FloatHistogram) ZeroBucket() Bucket[float64] {
	if h.UsesCustomBuckets() {
		panic("histograms with custom buckets have no zero bucket")
	}
	return Bucket[float64]{
		Lower:          -h.ZeroThreshold,
		Upper:          h.ZeroThreshold,
		LowerInclusive: true,
		UpperInclusive: true,
		Count:          h.ZeroCount,
		// Index is irrelevant for the zero bucket.
	}
}

// Mul multiplies the FloatHistogram by the provided factor, i.e. it scales all
// bucket counts including the zero bucket and the count and the sum of
// observations. The bucket layout stays the same. This method changes the
// receiving histogram directly (rather than acting on a copy). It returns a
// pointer to the receiving histogram for convenience.
func (h *FloatHistogram) Mul(factor float64) *FloatHistogram {
	h.ZeroCount *= factor
	h.Count *= factor
	h.Sum *= factor
	for i := range h.PositiveBuckets {
		h.PositiveBuckets[i] *= factor
	}
	for i := range h.NegativeBuckets {
		h.NegativeBuckets[i] *= factor
	}
	return h
}

// Div works like Mul but divides instead of multiplies.
// When dividing by 0, everything will be set to Inf.
func (h *FloatHistogram) Div(scalar float64) *FloatHistogram {
	h.ZeroCount /= scalar
	h.Count /= scalar
	h.Sum /= scalar
	// Division by zero removes all buckets.
	if scalar == 0 {
		h.PositiveBuckets = nil
		h.NegativeBuckets = nil
		h.PositiveSpans = nil
		h.NegativeSpans = nil
		return h
	}
	for i := range h.PositiveBuckets {
		h.PositiveBuckets[i] /= scalar
	}
	for i := range h.NegativeBuckets {
		h.NegativeBuckets[i] /= scalar
	}
	return h
}

// Add adds the provided other histogram to the receiving histogram. Count, Sum,
// and buckets from the other histogram are added to the corresponding
// components of the receiving histogram. Buckets in the other histogram that do
// not exist in the receiving histogram are inserted into the latter. The
// resulting histogram might have buckets with a population of zero or directly
// adjacent spans (offset=0). To normalize those, call the Compact method.
//
// The method reconciles differences in the zero threshold and in the schema, and
// changes them if needed. The other histogram will not be modified in any case.
// Adding is currently only supported between 2 exponential histograms, or between
// 2 custom buckets histograms with the exact same custom bounds.
//
// This method returns a pointer to the receiving histogram for convenience.
func (h *FloatHistogram) Add(other *FloatHistogram) (*FloatHistogram, error) {
	if h.UsesCustomBuckets() != other.UsesCustomBuckets() {
		return nil, ErrHistogramsIncompatibleSchema
	}
	if h.UsesCustomBuckets() && !FloatBucketsMatch(h.CustomValues, other.CustomValues) {
		return nil, ErrHistogramsIncompatibleBounds
	}

	switch {
	case other.CounterResetHint == h.CounterResetHint:
		// Adding apples to apples, all good. No need to change anything.
	case h.CounterResetHint == GaugeType:
		// Adding something else to a gauge. That's probably OK. Outcome is a gauge.
		// Nothing to do since the receiver is already marked as gauge.
	case other.CounterResetHint == GaugeType:
		// Similar to before, but this time the receiver is "something else" and we have to change it to gauge.
		h.CounterResetHint = GaugeType
	case h.CounterResetHint == UnknownCounterReset:
		// With the receiver's CounterResetHint being "unknown", this could still be legitimate
		// if the caller knows what they are doing. Outcome is then again "unknown".
		// No need to do anything since the receiver's CounterResetHint is already "unknown".
	case other.CounterResetHint == UnknownCounterReset:
		// Similar to before, but now we have to set the receiver's CounterResetHint to "unknown".
		h.CounterResetHint = UnknownCounterReset
	default:
		// All other cases shouldn't actually happen.
		// They are a direct collision of CounterReset and NotCounterReset.
		// Conservatively set the CounterResetHint to "unknown" and issue a warning.
		h.CounterResetHint = UnknownCounterReset
		// TODO(trevorwhitney): Actually issue the warning as soon as the plumbing for it is in place
	}

	if !h.UsesCustomBuckets() {
		otherZeroCount := h.reconcileZeroBuckets(other)
		h.ZeroCount += otherZeroCount
	}
	h.Count += other.Count
	h.Sum += other.Sum

	var (
		hPositiveSpans       = h.PositiveSpans
		hPositiveBuckets     = h.PositiveBuckets
		otherPositiveSpans   = other.PositiveSpans
		otherPositiveBuckets = other.PositiveBuckets
	)

	if h.UsesCustomBuckets() {
		h.PositiveSpans, h.PositiveBuckets = addBuckets(h.Schema, h.ZeroThreshold, false, hPositiveSpans, hPositiveBuckets, otherPositiveSpans, otherPositiveBuckets)
		return h, nil
	}

	var (
		hNegativeSpans       = h.NegativeSpans
		hNegativeBuckets     = h.NegativeBuckets
		otherNegativeSpans   = other.NegativeSpans
		otherNegativeBuckets = other.NegativeBuckets
	)

	switch {
	case other.Schema < h.Schema:
		hPositiveSpans, hPositiveBuckets = reduceResolution(hPositiveSpans, hPositiveBuckets, h.Schema, other.Schema, false, true)
		hNegativeSpans, hNegativeBuckets = reduceResolution(hNegativeSpans, hNegativeBuckets, h.Schema, other.Schema, false, true)
		h.Schema = other.Schema

	case other.Schema > h.Schema:
		otherPositiveSpans, otherPositiveBuckets = reduceResolution(otherPositiveSpans, otherPositiveBuckets, other.Schema, h.Schema, false, false)
		otherNegativeSpans, otherNegativeBuckets = reduceResolution(otherNegativeSpans, otherNegativeBuckets, other.Schema, h.Schema, false, false)
	}

	h.PositiveSpans, h.PositiveBuckets = addBuckets(h.Schema, h.ZeroThreshold, false, hPositiveSpans, hPositiveBuckets, otherPositiveSpans, otherPositiveBuckets)
	h.NegativeSpans, h.NegativeBuckets = addBuckets(h.Schema, h.ZeroThreshold, false, hNegativeSpans, hNegativeBuckets, otherNegativeSpans, otherNegativeBuckets)

	return h, nil
}

// Sub works like Add but subtracts the other histogram.
func (h *FloatHistogram) Sub(other *FloatHistogram) (*FloatHistogram, error) {
	if h.UsesCustomBuckets() != other.UsesCustomBuckets() {
		return nil, ErrHistogramsIncompatibleSchema
	}
	if h.UsesCustomBuckets() && !FloatBucketsMatch(h.CustomValues, other.CustomValues) {
		return nil, ErrHistogramsIncompatibleBounds
	}

	if !h.UsesCustomBuckets() {
		otherZeroCount := h.reconcileZeroBuckets(other)
		h.ZeroCount -= otherZeroCount
	}
	h.Count -= other.Count
	h.Sum -= other.Sum

	var (
		hPositiveSpans       = h.PositiveSpans
		hPositiveBuckets     = h.PositiveBuckets
		otherPositiveSpans   = other.PositiveSpans
		otherPositiveBuckets = other.PositiveBuckets
	)

	if h.UsesCustomBuckets() {
		h.PositiveSpans, h.PositiveBuckets = addBuckets(h.Schema, h.ZeroThreshold, true, hPositiveSpans, hPositiveBuckets, otherPositiveSpans, otherPositiveBuckets)
		return h, nil
	}

	var (
		hNegativeSpans       = h.NegativeSpans
		hNegativeBuckets     = h.NegativeBuckets
		otherNegativeSpans   = other.NegativeSpans
		otherNegativeBuckets = other.NegativeBuckets
	)

	switch {
	case other.Schema < h.Schema:
		hPositiveSpans, hPositiveBuckets = reduceResolution(hPositiveSpans, hPositiveBuckets, h.Schema, other.Schema, false, true)
		hNegativeSpans, hNegativeBuckets = reduceResolution(hNegativeSpans, hNegativeBuckets, h.Schema, other.Schema, false, true)
		h.Schema = other.Schema
	case other.Schema > h.Schema:
		otherPositiveSpans, otherPositiveBuckets = reduceResolution(otherPositiveSpans, otherPositiveBuckets, other.Schema, h.Schema, false, false)
		otherNegativeSpans, otherNegativeBuckets = reduceResolution(otherNegativeSpans, otherNegativeBuckets, other.Schema, h.Schema, false, false)
	}

	h.PositiveSpans, h.PositiveBuckets = addBuckets(h.Schema, h.ZeroThreshold, true, hPositiveSpans, hPositiveBuckets, otherPositiveSpans, otherPositiveBuckets)
	h.NegativeSpans, h.NegativeBuckets = addBuckets(h.Schema, h.ZeroThreshold, true, hNegativeSpans, hNegativeBuckets, otherNegativeSpans, otherNegativeBuckets)

	return h, nil
}

// Equals returns true if the given float histogram matches exactly.
// Exact match is when there are no new buckets (even empty) and no missing buckets,
// and all the bucket values match. Spans can have different empty length spans in between,
// but they must represent the same bucket layout to match.
// Sum, Count, ZeroCount and bucket values are compared based on their bit patterns
// because this method is about data equality rather than mathematical equality.
// We ignore fields that are not used based on the exponential / custom buckets schema,
// but check fields where differences may cause unintended behaviour even if they are not
// supposed to be used according to the schema.
func (h *FloatHistogram) Equals(h2 *FloatHistogram) bool {
	if h2 == nil {
		return false
	}

	if h.Schema != h2.Schema ||
		math.Float64bits(h.Count) != math.Float64bits(h2.Count) ||
		math.Float64bits(h.Sum) != math.Float64bits(h2.Sum) {
		return false
	}

	if h.UsesCustomBuckets() {
		if !FloatBucketsMatch(h.CustomValues, h2.CustomValues) {
			return false
		}
	}

	if h.ZeroThreshold != h2.ZeroThreshold ||
		math.Float64bits(h.ZeroCount) != math.Float64bits(h2.ZeroCount) {
		return false
	}

	if !spansMatch(h.NegativeSpans, h2.NegativeSpans) {
		return false
	}
	if !FloatBucketsMatch(h.NegativeBuckets, h2.NegativeBuckets) {
		return false
	}

	if !spansMatch(h.PositiveSpans, h2.PositiveSpans) {
		return false
	}
	if !FloatBucketsMatch(h.PositiveBuckets, h2.PositiveBuckets) {
		return false
	}

	return true
}

// Size returns the total size of the FloatHistogram, which includes the size of the pointer
// to FloatHistogram, all its fields, and all elements contained in slices.
// NOTE: this is only valid for 64 bit architectures.
func (h *FloatHistogram) Size() int {
	// Size of each slice separately.
	posSpanSize := len(h.PositiveSpans) * 8     // 8 bytes (int32 + uint32).
	negSpanSize := len(h.NegativeSpans) * 8     // 8 bytes (int32 + uint32).
	posBucketSize := len(h.PositiveBuckets) * 8 // 8 bytes (float64).
	negBucketSize := len(h.NegativeBuckets) * 8 // 8 bytes (float64).
	customBoundSize := len(h.CustomValues) * 8  // 8 bytes (float64).

	// Total size of the struct.

	// fh is 8 bytes.
	// fh.CounterResetHint is 4 bytes (1 byte bool + 3 bytes padding).
	// fh.Schema is 4 bytes.
	// fh.ZeroThreshold is 8 bytes.
	// fh.ZeroCount is 8 bytes.
	// fh.Count is 8 bytes.
	// fh.Sum is 8 bytes.
	// fh.PositiveSpans is 24 bytes.
	// fh.NegativeSpans is 24 bytes.
	// fh.PositiveBuckets is 24 bytes.
	// fh.NegativeBuckets is 24 bytes.
	// fh.CustomValues is 24 bytes.
	structSize := 168

	return structSize + posSpanSize + negSpanSize + posBucketSize + negBucketSize + customBoundSize
}

// Compact eliminates empty buckets at the beginning and end of each span, then
// merges spans that are consecutive or at most maxEmptyBuckets apart, and
// finally splits spans that contain more consecutive empty buckets than
// maxEmptyBuckets. (The actual implementation might do something more efficient
// but with the same result.)  The compaction happens "in place" in the
// receiving histogram, but a pointer to it is returned for convenience.
//
// The ideal value for maxEmptyBuckets depends on circumstances. The motivation
// to set maxEmptyBuckets > 0 is the assumption that is less overhead to
// represent very few empty buckets explicitly within one span than cutting the
// one span into two to treat the empty buckets as a gap between the two spans,
// both in terms of storage requirement as well as in terms of encoding and
// decoding effort. However, the tradeoffs are subtle. For one, they are
// different in the exposition format vs. in a TSDB chunk vs. for the in-memory
// representation as Go types. In the TSDB, as an additional aspects, the span
// layout is only stored once per chunk, while many histograms with that same
// chunk layout are then only stored with their buckets (so that even a single
// empty bucket will be stored many times).
//
// For the Go types, an additional Span takes 8 bytes. Similarly, an additional
// bucket takes 8 bytes. Therefore, with a single separating empty bucket, both
// options have the same storage requirement, but the single-span solution is
// easier to iterate through. Still, the safest bet is to use maxEmptyBuckets==0
// and only use a larger number if you know what you are doing.
func (h *FloatHistogram) Compact(maxEmptyBuckets int) *FloatHistogram {
	h.PositiveBuckets, h.PositiveSpans = compactBuckets(
		h.PositiveBuckets, h.PositiveSpans, maxEmptyBuckets, false,
	)
	h.NegativeBuckets, h.NegativeSpans = compactBuckets(
		h.NegativeBuckets, h.NegativeSpans, maxEmptyBuckets, false,
	)
	return h
}

// DetectReset returns true if the receiving histogram is missing any buckets
// that have a non-zero population in the provided previous histogram. It also
// returns true if any count (in any bucket, in the zero count, or in the count
// of observations, but NOT the sum of observations) is smaller in the receiving
// histogram compared to the previous histogram. Otherwise, it returns false.
//
// This method will shortcut to true if a CounterReset is detected, and shortcut
// to false if NotCounterReset is detected. Otherwise it will do the work to detect
// a reset.
//
// Special behavior in case the Schema or the ZeroThreshold are not the same in
// both histograms:
//
//   - A decrease of the ZeroThreshold or an increase of the Schema (i.e. an
//     increase of resolution) can only happen together with a reset. Thus, the
//     method returns true in either case.
//
//   - Upon an increase of the ZeroThreshold, the buckets in the previous
//     histogram that fall within the new ZeroThreshold are added to the ZeroCount
//     of the previous histogram (without mutating the provided previous
//     histogram). The scenario that a populated bucket of the previous histogram
//     is partially within, partially outside of the new ZeroThreshold, can only
//     happen together with a counter reset and therefore shortcuts to returning
//     true.
//
//   - Upon a decrease of the Schema, the buckets of the previous histogram are
//     merged so that they match the new, lower-resolution schema (again without
//     mutating the provided previous histogram).
func (h *FloatHistogram) DetectReset(previous *FloatHistogram) bool {
	if h.CounterResetHint == CounterReset {
		return true
	}
	if h.CounterResetHint == NotCounterReset {
		return false
	}
	// In all other cases of CounterResetHint (UnknownCounterReset and GaugeType),
	// we go on as we would otherwise, for reasons explained below.
	//
	// If the CounterResetHint is UnknownCounterReset, we do not know yet if this histogram comes
	// with a counter reset. Therefore, we have to do all the detailed work to find out if there
	// is a counter reset or not.
	// We do the same if the CounterResetHint is GaugeType, which should not happen, but PromQL still
	// allows the user to apply functions to gauge histograms that are only meant for counter histograms.
	// In this case, we treat the gauge histograms as counter histograms. A warning should be returned
	// to the user in this case.
	if h.Count < previous.Count {
		return true
	}
	if h.UsesCustomBuckets() != previous.UsesCustomBuckets() || (h.UsesCustomBuckets() && !FloatBucketsMatch(h.CustomValues, previous.CustomValues)) {
		// Mark that something has changed or that the application has been restarted. However, this does
		// not matter so much since the change in schema will be handled directly in the chunks and PromQL
		// functions.
		return true
	}
	if h.Schema > previous.Schema {
		return true
	}
	if h.ZeroThreshold < previous.ZeroThreshold {
		// ZeroThreshold decreased.
		return true
	}
	previousZeroCount, newThreshold := previous.zeroCountForLargerThreshold(h.ZeroThreshold)
	if newThreshold != h.ZeroThreshold {
		// ZeroThreshold is within a populated bucket in previous
		// histogram.
		return true
	}
	if h.ZeroCount < previousZeroCount {
		return true
	}
	currIt := h.floatBucketIterator(true, h.ZeroThreshold, h.Schema)
	prevIt := previous.floatBucketIterator(true, h.ZeroThreshold, h.Schema)
	if detectReset(&currIt, &prevIt) {
		return true
	}
	currIt = h.floatBucketIterator(false, h.ZeroThreshold, h.Schema)
	prevIt = previous.floatBucketIterator(false, h.ZeroThreshold, h.Schema)
	return detectReset(&currIt, &prevIt)
}

func detectReset(currIt, prevIt *floatBucketIterator) bool {
	if !prevIt.Next() {
		return false // If no buckets in previous histogram, nothing can be reset.
	}
	prevBucket := prevIt.strippedAt()
	if !currIt.Next() {
		// No bucket in current, but at least one in previous
		// histogram. Check if any of those are non-zero, in which case
		// this is a reset.
		for {
			if prevBucket.count != 0 {
				return true
			}
			if !prevIt.Next() {
				return false
			}
		}
	}
	currBucket := currIt.strippedAt()
	for {
		// Forward currIt until we find the bucket corresponding to prevBucket.
		for currBucket.index < prevBucket.index {
			if !currIt.Next() {
				// Reached end of currIt early, therefore
				// previous histogram has a bucket that the
				// current one does not have. Unless all
				// remaining buckets in the previous histogram
				// are unpopulated, this is a reset.
				for {
					if prevBucket.count != 0 {
						return true
					}
					if !prevIt.Next() {
						return false
					}
				}
			}
			currBucket = currIt.strippedAt()
		}
		if currBucket.index > prevBucket.index {
			// Previous histogram has a bucket the current one does
			// not have. If it's populated, it's a reset.
			if prevBucket.count != 0 {
				return true
			}
		} else {
			// We have reached corresponding buckets in both iterators.
			// We can finally compare the counts.
			if currBucket.count < prevBucket.count {
				return true
			}
		}
		if !prevIt.Next() {
			// Reached end of prevIt without finding offending buckets.
			return false
		}
		prevBucket = prevIt.strippedAt()
	}
}

// PositiveBucketIterator returns a BucketIterator to iterate over all positive
// buckets in ascending order (starting next to the zero bucket and going up).
func (h *FloatHistogram) PositiveBucketIterator() BucketIterator[float64] {
	it := h.floatBucketIterator(true, 0, h.Schema)
	return &it
}

// NegativeBucketIterator returns a BucketIterator to iterate over all negative
// buckets in descending order (starting next to the zero bucket and going
// down).
func (h *FloatHistogram) NegativeBucketIterator() BucketIterator[float64] {
	it := h.floatBucketIterator(false, 0, h.Schema)
	return &it
}

// PositiveReverseBucketIterator returns a BucketIterator to iterate over all
// positive buckets in descending order (starting at the highest bucket and
// going down towards the zero bucket).
func (h *FloatHistogram) PositiveReverseBucketIterator() BucketIterator[float64] {
	it := newReverseFloatBucketIterator(h.PositiveSpans, h.PositiveBuckets, h.Schema, true, h.CustomValues)
	return &it
}

// NegativeReverseBucketIterator returns a BucketIterator to iterate over all
// negative buckets in ascending order (starting at the lowest bucket and going
// up towards the zero bucket).
func (h *FloatHistogram) NegativeReverseBucketIterator() BucketIterator[float64] {
	it := newReverseFloatBucketIterator(h.NegativeSpans, h.NegativeBuckets, h.Schema, false, nil)
	return &it
}

// AllBucketIterator returns a BucketIterator to iterate over all negative,
// zero, and positive buckets in ascending order (starting at the lowest bucket
// and going up). If the highest negative bucket or the lowest positive bucket
// overlap with the zero bucket, their upper or lower boundary, respectively, is
// set to the zero threshold.
func (h *FloatHistogram) AllBucketIterator() BucketIterator[float64] {
	return &allFloatBucketIterator{
		h:         h,
		leftIter:  newReverseFloatBucketIterator(h.NegativeSpans, h.NegativeBuckets, h.Schema, false, nil),
		rightIter: h.floatBucketIterator(true, 0, h.Schema),
		state:     -1,
	}
}

// AllReverseBucketIterator returns a BucketIterator to iterate over all negative,
// zero, and positive buckets in descending order (starting at the lowest bucket
// and going up). If the highest negative bucket or the lowest positive bucket
// overlap with the zero bucket, their upper or lower boundary, respectively, is
// set to the zero threshold.
func (h *FloatHistogram) AllReverseBucketIterator() BucketIterator[float64] {
	return &allFloatBucketIterator{
		h:         h,
		leftIter:  newReverseFloatBucketIterator(h.PositiveSpans, h.PositiveBuckets, h.Schema, true, h.CustomValues),
		rightIter: h.floatBucketIterator(false, 0, h.Schema),
		state:     -1,
	}
}

// Validate validates consistency between span and bucket slices. Also, buckets are checked
// against negative values. We check to make sure there are no unexpected fields or field values
// based on the exponential / custom buckets schema.
// We do not check for h.Count being at least as large as the sum of the
// counts in the buckets because floating point precision issues can
// create false positives here.
func (h *FloatHistogram) Validate() error {
	var nCount, pCount float64
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
		err := checkHistogramBuckets(h.NegativeBuckets, &nCount, false)
		if err != nil {
			return fmt.Errorf("negative side: %w", err)
		}
		if h.CustomValues != nil {
			return errors.New("histogram with exponential schema must not have custom bounds")
		}
	}
	err := checkHistogramBuckets(h.PositiveBuckets, &pCount, false)
	if err != nil {
		return fmt.Errorf("positive side: %w", err)
	}

	return nil
}

// zeroCountForLargerThreshold returns what the histogram's zero count would be
// if the ZeroThreshold had the provided larger (or equal) value. If the
// provided value is less than the histogram's ZeroThreshold, the method panics.
// If the largerThreshold ends up within a populated bucket of the histogram, it
// is adjusted upwards to the lower limit of that bucket (all in terms of
// absolute values) and that bucket's count is included in the returned
// count. The adjusted threshold is returned, too.
func (h *FloatHistogram) zeroCountForLargerThreshold(largerThreshold float64) (count, threshold float64) {
	// Fast path.
	if largerThreshold == h.ZeroThreshold {
		return h.ZeroCount, largerThreshold
	}
	if largerThreshold < h.ZeroThreshold {
		panic(fmt.Errorf("new threshold %f is less than old threshold %f", largerThreshold, h.ZeroThreshold))
	}
outer:
	for {
		count = h.ZeroCount
		i := h.PositiveBucketIterator()
		for i.Next() {
			b := i.At()
			if b.Lower >= largerThreshold {
				break
			}
			count += b.Count // Bucket to be merged into zero bucket.
			if b.Upper > largerThreshold {
				// New threshold ended up within a bucket. if it's
				// populated, we need to adjust largerThreshold before
				// we are done here.
				if b.Count != 0 {
					largerThreshold = b.Upper
				}
				break
			}
		}
		i = h.NegativeBucketIterator()
		for i.Next() {
			b := i.At()
			if b.Upper <= -largerThreshold {
				break
			}
			count += b.Count // Bucket to be merged into zero bucket.
			if b.Lower < -largerThreshold {
				// New threshold ended up within a bucket. If
				// it's populated, we need to adjust
				// largerThreshold and have to redo the whole
				// thing because the treatment of the positive
				// buckets is invalid now.
				if b.Count != 0 {
					largerThreshold = -b.Lower
					continue outer
				}
				break
			}
		}
		return count, largerThreshold
	}
}

// trimBucketsInZeroBucket removes all buckets that are within the zero
// bucket. It assumes that the zero threshold is at a bucket boundary and that
// the counts in the buckets to remove are already part of the zero count.
func (h *FloatHistogram) trimBucketsInZeroBucket() {
	i := h.PositiveBucketIterator()
	bucketsIdx := 0
	for i.Next() {
		b := i.At()
		if b.Lower >= h.ZeroThreshold {
			break
		}
		h.PositiveBuckets[bucketsIdx] = 0
		bucketsIdx++
	}
	i = h.NegativeBucketIterator()
	bucketsIdx = 0
	for i.Next() {
		b := i.At()
		if b.Upper <= -h.ZeroThreshold {
			break
		}
		h.NegativeBuckets[bucketsIdx] = 0
		bucketsIdx++
	}
	// We are abusing Compact to trim the buckets set to zero
	// above. Premature compacting could cause additional cost, but this
	// code path is probably rarely used anyway.
	h.Compact(0)
}

// reconcileZeroBuckets finds a zero bucket large enough to include the zero
// buckets of both histograms (the receiving histogram and the other histogram)
// with a zero threshold that is not within a populated bucket in either
// histogram. This method modifies the receiving histogram accordingly, but
// leaves the other histogram as is. Instead, it returns the zero count the
// other histogram would have if it were modified.
func (h *FloatHistogram) reconcileZeroBuckets(other *FloatHistogram) float64 {
	otherZeroCount := other.ZeroCount
	otherZeroThreshold := other.ZeroThreshold

	for otherZeroThreshold != h.ZeroThreshold {
		if h.ZeroThreshold > otherZeroThreshold {
			otherZeroCount, otherZeroThreshold = other.zeroCountForLargerThreshold(h.ZeroThreshold)
		}
		if otherZeroThreshold > h.ZeroThreshold {
			h.ZeroCount, h.ZeroThreshold = h.zeroCountForLargerThreshold(otherZeroThreshold)
			h.trimBucketsInZeroBucket()
		}
	}
	return otherZeroCount
}

// floatBucketIterator is a low-level constructor for bucket iterators.
//
// If positive is true, the returned iterator iterates through the positive
// buckets, otherwise through the negative buckets.
//
// Only for exponential schemas, if absoluteStartValue is < the lowest absolute
// value of any upper bucket boundary, the iterator starts with the first bucket.
// Otherwise, it will skip all buckets with an absolute value of their upper boundary ≤
// absoluteStartValue. For custom bucket schemas, absoluteStartValue is ignored and
// no buckets are skipped.
//
// targetSchema must be ≤ the schema of FloatHistogram (and of course within the
// legal values for schemas in general). The buckets are merged to match the
// targetSchema prior to iterating (without mutating FloatHistogram), but custom buckets
// schemas cannot be merged with other schemas.
func (h *FloatHistogram) floatBucketIterator(
	positive bool, absoluteStartValue float64, targetSchema int32,
) floatBucketIterator {
	if h.UsesCustomBuckets() && targetSchema != h.Schema {
		panic(errors.New("cannot merge from custom buckets schema to exponential schema"))
	}
	if !h.UsesCustomBuckets() && IsCustomBucketsSchema(targetSchema) {
		panic(errors.New("cannot merge from exponential buckets schema to custom schema"))
	}
	if targetSchema > h.Schema {
		panic(fmt.Errorf("cannot merge from schema %d to %d", h.Schema, targetSchema))
	}
	i := floatBucketIterator{
		baseBucketIterator: baseBucketIterator[float64, float64]{
			schema:   h.Schema,
			positive: positive,
		},
		targetSchema:           targetSchema,
		absoluteStartValue:     absoluteStartValue,
		boundReachedStartValue: absoluteStartValue == 0,
	}
	if positive {
		i.spans = h.PositiveSpans
		i.buckets = h.PositiveBuckets
		i.customValues = h.CustomValues
	} else {
		i.spans = h.NegativeSpans
		i.buckets = h.NegativeBuckets
	}
	return i
}

// reverseFloatBucketIterator is a low-level constructor for reverse bucket iterators.
func newReverseFloatBucketIterator(
	spans []Span, buckets []float64, schema int32, positive bool, customValues []float64,
) reverseFloatBucketIterator {
	r := reverseFloatBucketIterator{
		baseBucketIterator: baseBucketIterator[float64, float64]{
			schema:       schema,
			spans:        spans,
			buckets:      buckets,
			positive:     positive,
			customValues: customValues,
		},
	}

	r.spansIdx = len(r.spans) - 1
	r.bucketsIdx = len(r.buckets) - 1
	if r.spansIdx >= 0 {
		r.idxInSpan = int32(r.spans[r.spansIdx].Length) - 1
	}
	r.currIdx = 0
	for _, s := range r.spans {
		r.currIdx += s.Offset + int32(s.Length)
	}

	return r
}

type floatBucketIterator struct {
	baseBucketIterator[float64, float64]

	targetSchema       int32   // targetSchema is the schema to merge to and must be ≤ schema.
	origIdx            int32   // The bucket index within the original schema.
	absoluteStartValue float64 // Never return buckets with an upper bound ≤ this value.

	boundReachedStartValue bool // Has getBound reached absoluteStartValue already?
}

func (i *floatBucketIterator) At() Bucket[float64] {
	// Need to use i.targetSchema rather than i.baseBucketIterator.schema.
	return i.baseBucketIterator.at(i.targetSchema)
}

func (i *floatBucketIterator) Next() bool {
	if i.spansIdx >= len(i.spans) {
		return false
	}

	if i.schema == i.targetSchema {
		// Fast path for the common case.
		span := i.spans[i.spansIdx]
		if i.bucketsIdx == 0 {
			// Seed origIdx for the first bucket.
			i.currIdx = span.Offset
		} else {
			i.currIdx++
		}

		for i.idxInSpan >= span.Length {
			// We have exhausted the current span and have to find a new
			// one. We even handle pathologic spans of length 0 here.
			i.idxInSpan = 0
			i.spansIdx++
			if i.spansIdx >= len(i.spans) {
				return false
			}
			span = i.spans[i.spansIdx]
			i.currIdx += span.Offset
		}

		i.currCount = i.buckets[i.bucketsIdx]
		i.idxInSpan++
		i.bucketsIdx++
	} else {
		// Copy all of these into local variables so that we can forward to the
		// next bucket and then roll back if needed.
		origIdx, spansIdx, idxInSpan := i.origIdx, i.spansIdx, i.idxInSpan
		span := i.spans[spansIdx]
		firstPass := true
		i.currCount = 0

	mergeLoop: // Merge together all buckets from the original schema that fall into one bucket in the targetSchema.
		for {
			if i.bucketsIdx == 0 {
				// Seed origIdx for the first bucket.
				origIdx = span.Offset
			} else {
				origIdx++
			}
			for idxInSpan >= span.Length {
				// We have exhausted the current span and have to find a new
				// one. We even handle pathologic spans of length 0 here.
				idxInSpan = 0
				spansIdx++
				if spansIdx >= len(i.spans) {
					if firstPass {
						return false
					}
					break mergeLoop
				}
				span = i.spans[spansIdx]
				origIdx += span.Offset
			}
			currIdx := targetIdx(origIdx, i.schema, i.targetSchema)
			switch {
			case firstPass:
				i.currIdx = currIdx
				firstPass = false
			case currIdx != i.currIdx:
				// Reached next bucket in targetSchema.
				// Do not actually forward to the next bucket, but break out.
				break mergeLoop
			}
			i.currCount += i.buckets[i.bucketsIdx]
			idxInSpan++
			i.bucketsIdx++
			i.origIdx, i.spansIdx, i.idxInSpan = origIdx, spansIdx, idxInSpan
			if i.schema == i.targetSchema {
				// Don't need to test the next bucket for mergeability
				// if we have no schema change anyway.
				break mergeLoop
			}
		}
	}

	// Skip buckets before absoluteStartValue for exponential schemas.
	// TODO(beorn7): Maybe do something more efficient than this recursive call.
	if !i.boundReachedStartValue && IsExponentialSchema(i.targetSchema) && getBoundExponential(i.currIdx, i.targetSchema) <= i.absoluteStartValue {
		return i.Next()
	}
	i.boundReachedStartValue = true
	return true
}

type reverseFloatBucketIterator struct {
	baseBucketIterator[float64, float64]
	idxInSpan int32 // Changed from uint32 to allow negative values for exhaustion detection.
}

func (i *reverseFloatBucketIterator) Next() bool {
	i.currIdx--
	if i.bucketsIdx < 0 {
		return false
	}

	for i.idxInSpan < 0 {
		// We have exhausted the current span and have to find a new
		// one. We'll even handle pathologic spans of length 0.
		i.spansIdx--
		i.idxInSpan = int32(i.spans[i.spansIdx].Length) - 1
		i.currIdx -= i.spans[i.spansIdx+1].Offset
	}

	i.currCount = i.buckets[i.bucketsIdx]
	i.bucketsIdx--
	i.idxInSpan--
	return true
}

type allFloatBucketIterator struct {
	h         *FloatHistogram
	leftIter  reverseFloatBucketIterator
	rightIter floatBucketIterator
	// -1 means we are iterating negative buckets.
	// 0 means it is time for the zero bucket.
	// 1 means we are iterating positive buckets.
	// Anything else means iteration is over.
	state      int8
	currBucket Bucket[float64]
}

func (i *allFloatBucketIterator) Next() bool {
	switch i.state {
	case -1:
		if i.leftIter.Next() {
			i.currBucket = i.leftIter.At()
			switch {
			case i.currBucket.Upper < 0 && i.currBucket.Upper > -i.h.ZeroThreshold:
				i.currBucket.Upper = -i.h.ZeroThreshold
			case i.currBucket.Lower > 0 && i.currBucket.Lower < i.h.ZeroThreshold:
				i.currBucket.Lower = i.h.ZeroThreshold
			}
			return true
		}
		i.state = 0
		return i.Next()
	case 0:
		i.state = 1
		if i.h.ZeroCount > 0 {
			i.currBucket = i.h.ZeroBucket()
			return true
		}
		return i.Next()
	case 1:
		if i.rightIter.Next() {
			i.currBucket = i.rightIter.At()
			switch {
			case i.currBucket.Lower > 0 && i.currBucket.Lower < i.h.ZeroThreshold:
				i.currBucket.Lower = i.h.ZeroThreshold
			case i.currBucket.Upper < 0 && i.currBucket.Upper > -i.h.ZeroThreshold:
				i.currBucket.Upper = -i.h.ZeroThreshold
			}
			return true
		}
		i.state = 42
		return false
	}

	return false
}

func (i *allFloatBucketIterator) At() Bucket[float64] {
	return i.currBucket
}

// targetIdx returns the bucket index in the target schema for the given bucket
// index idx in the original schema.
func targetIdx(idx, originSchema, targetSchema int32) int32 {
	return ((idx - 1) >> (originSchema - targetSchema)) + 1
}

// addBuckets adds the buckets described by spansB/bucketsB to the buckets described by spansA/bucketsA,
// creating missing buckets in spansA/bucketsA as needed.
// It returns the resulting spans/buckets (which must be used instead of the original spansA/bucketsA,
// although spansA/bucketsA might get modified by this function).
// All buckets must use the same provided schema.
// Buckets in spansB/bucketsB with an absolute upper limit ≤ threshold are ignored.
// If negative is true, the buckets in spansB/bucketsB are subtracted rather than added.
func addBuckets(
	schema int32, threshold float64, negative bool,
	spansA []Span, bucketsA []float64,
	spansB []Span, bucketsB []float64,
) ([]Span, []float64) {
	var (
		iSpan              = -1
		iBucket            = -1
		iInSpan            int32
		indexA             int32
		indexB             int32
		bIdxB              int
		bucketB            float64
		deltaIndex         int32
		lowerThanThreshold = true
	)

	for _, spanB := range spansB {
		indexB += spanB.Offset
		for j := 0; j < int(spanB.Length); j++ {
			if lowerThanThreshold && IsExponentialSchema(schema) && getBoundExponential(indexB, schema) <= threshold {
				goto nextLoop
			}
			lowerThanThreshold = false

			bucketB = bucketsB[bIdxB]
			if negative {
				bucketB *= -1
			}

			if iSpan == -1 {
				if len(spansA) == 0 || spansA[0].Offset > indexB {
					// Add bucket before all others.
					bucketsA = append(bucketsA, 0)
					copy(bucketsA[1:], bucketsA)
					bucketsA[0] = bucketB
					if len(spansA) > 0 && spansA[0].Offset == indexB+1 {
						spansA[0].Length++
						spansA[0].Offset--
						goto nextLoop
					}
					spansA = append(spansA, Span{})
					copy(spansA[1:], spansA)
					spansA[0] = Span{Offset: indexB, Length: 1}
					if len(spansA) > 1 {
						// Convert the absolute offset in the formerly
						// first span to a relative offset.
						spansA[1].Offset -= indexB + 1
					}
					goto nextLoop
				} else if spansA[0].Offset == indexB {
					// Just add to first bucket.
					bucketsA[0] += bucketB
					goto nextLoop
				}
				iSpan, iBucket, iInSpan = 0, 0, 0
				indexA = spansA[0].Offset
			}
			deltaIndex = indexB - indexA
			for {
				remainingInSpan := int32(spansA[iSpan].Length) - iInSpan
				if deltaIndex < remainingInSpan {
					// Bucket is in current span.
					iBucket += int(deltaIndex)
					iInSpan += deltaIndex
					bucketsA[iBucket] += bucketB
					break
				}
				deltaIndex -= remainingInSpan
				iBucket += int(remainingInSpan)
				iSpan++
				if iSpan == len(spansA) || deltaIndex < spansA[iSpan].Offset {
					// Bucket is in gap behind previous span (or there are no further spans).
					bucketsA = append(bucketsA, 0)
					copy(bucketsA[iBucket+1:], bucketsA[iBucket:])
					bucketsA[iBucket] = bucketB
					switch {
					case deltaIndex == 0:
						// Directly after previous span, extend previous span.
						if iSpan < len(spansA) {
							spansA[iSpan].Offset--
						}
						iSpan--
						iInSpan = int32(spansA[iSpan].Length)
						spansA[iSpan].Length++
						goto nextLoop
					case iSpan < len(spansA) && deltaIndex == spansA[iSpan].Offset-1:
						// Directly before next span, extend next span.
						iInSpan = 0
						spansA[iSpan].Offset--
						spansA[iSpan].Length++
						goto nextLoop
					default:
						// No next span, or next span is not directly adjacent to new bucket.
						// Add new span.
						iInSpan = 0
						if iSpan < len(spansA) {
							spansA[iSpan].Offset -= deltaIndex + 1
						}
						spansA = append(spansA, Span{})
						copy(spansA[iSpan+1:], spansA[iSpan:])
						spansA[iSpan] = Span{Length: 1, Offset: deltaIndex}
						goto nextLoop
					}
				} else {
					// Try start of next span.
					deltaIndex -= spansA[iSpan].Offset
					iInSpan = 0
				}
			}

		nextLoop:
			indexA = indexB
			indexB++
			bIdxB++
		}
	}

	return spansA, bucketsA
}

func FloatBucketsMatch(b1, b2 []float64) bool {
	if len(b1) != len(b2) {
		return false
	}
	for i, b := range b1 {
		if math.Float64bits(b) != math.Float64bits(b2[i]) {
			return false
		}
	}
	return true
}

// ReduceResolution reduces the float histogram's spans, buckets into target schema.
// The target schema must be smaller than the current float histogram's schema.
// This will panic if the histogram has custom buckets or if the target schema is
// a custom buckets schema.
func (h *FloatHistogram) ReduceResolution(targetSchema int32) *FloatHistogram {
	if h.UsesCustomBuckets() {
		panic("cannot reduce resolution when there are custom buckets")
	}
	if IsCustomBucketsSchema(targetSchema) {
		panic("cannot reduce resolution to custom buckets schema")
	}
	if targetSchema >= h.Schema {
		panic(fmt.Errorf("cannot reduce resolution from schema %d to %d", h.Schema, targetSchema))
	}

	h.PositiveSpans, h.PositiveBuckets = reduceResolution(h.PositiveSpans, h.PositiveBuckets, h.Schema, targetSchema, false, true)
	h.NegativeSpans, h.NegativeBuckets = reduceResolution(h.NegativeSpans, h.NegativeBuckets, h.Schema, targetSchema, false, true)

	h.Schema = targetSchema
	return h
}
