// Copyright 2015 The Prometheus Authors
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

package promql

import (
	"math"
	"slices"
	"sort"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/util/almost"
)

// smallDeltaTolerance is the threshold for relative deltas between classic
// histogram buckets that will be ignored by the histogram_quantile function
// because they are most likely artifacts of floating point precision issues.
// Testing on 2 sets of real data with bugs arising from small deltas,
// the safe ranges were from:
// - 1e-05 to 1e-15
// - 1e-06 to 1e-15
// Anything to the left of that would cause non-query-sharded data to have
// small deltas ignored (unnecessary and we should avoid this), and anything
// to the right of that would cause query-sharded data to not have its small
// deltas ignored (so the problem won't be fixed).
// For context, query sharding triggers these float precision errors in Mimir.
// To illustrate, with a relative deviation of 1e-12, we need to have 1e12
// observations in the bucket so that the change of one observation is small
// enough to get ignored. With the usual observation rate even of very busy
// services, this will hardly be reached in timeframes that matters for
// monitoring.
const smallDeltaTolerance = 1e-12

// Helpers to calculate quantiles.

// excludedLabels are the labels to exclude from signature calculation for
// quantiles.
var excludedLabels = []string{
	labels.BucketLabel,
}

// Bucket represents a bucket of a classic histogram. It is used internally by the promql
// package, but it is nevertheless exported for potential use in other PromQL engines.
type Bucket struct {
	UpperBound float64
	Count      float64
}

// Buckets implements sort.Interface.
type Buckets []Bucket

type metricWithBuckets struct {
	metric  labels.Labels
	buckets Buckets
}

// BucketQuantile calculates the quantile 'q' based on the given buckets. The
// buckets will be sorted by upperBound by this function (i.e. no sorting
// needed before calling this function). The quantile value is interpolated
// assuming a linear distribution within a bucket. However, if the quantile
// falls into the highest bucket, the upper bound of the 2nd highest bucket is
// returned. A natural lower bound of 0 is assumed if the upper bound of the
// lowest bucket is greater 0. In that case, interpolation in the lowest bucket
// happens linearly between 0 and the upper bound of the lowest bucket.
// However, if the lowest bucket has an upper bound less or equal 0, this upper
// bound is returned if the quantile falls into the lowest bucket.
//
// There are a number of special cases (once we have a way to report errors
// happening during evaluations of AST functions, we should report those
// explicitly):
//
// If 'buckets' has 0 observations, NaN is returned.
//
// If 'buckets' has fewer than 2 elements, NaN is returned.
//
// If the highest bucket is not +Inf, NaN is returned.
//
// If q==NaN, NaN is returned.
//
// If q<0, -Inf is returned.
//
// If q>1, +Inf is returned.
//
// We also return a bool to indicate if monotonicity needed to be forced,
// and another bool to indicate if small differences between buckets (that
// are likely artifacts of floating point precision issues) have been
// ignored.
//
// Generically speaking, BucketQuantile is for calculating the
// histogram_quantile() of classic histograms. See also: HistogramQuantile
// for native histograms.
//
// BucketQuantile is exported as a useful quantile function over a set of
// given buckets. It may be used by other PromQL engine implementations.
func BucketQuantile(q float64, buckets Buckets) (float64, bool, bool) {
	if math.IsNaN(q) {
		return math.NaN(), false, false
	}
	if q < 0 {
		return math.Inf(-1), false, false
	}
	if q > 1 {
		return math.Inf(+1), false, false
	}
	slices.SortFunc(buckets, func(a, b Bucket) int {
		// We don't expect the bucket boundary to be a NaN.
		if a.UpperBound < b.UpperBound {
			return -1
		}
		if a.UpperBound > b.UpperBound {
			return +1
		}
		return 0
	})
	if !math.IsInf(buckets[len(buckets)-1].UpperBound, +1) {
		return math.NaN(), false, false
	}

	buckets = coalesceBuckets(buckets)
	forcedMonotonic, fixedPrecision := ensureMonotonicAndIgnoreSmallDeltas(buckets, smallDeltaTolerance)

	if len(buckets) < 2 {
		return math.NaN(), false, false
	}
	observations := buckets[len(buckets)-1].Count
	if observations == 0 {
		return math.NaN(), false, false
	}
	rank := q * observations
	b := sort.Search(len(buckets)-1, func(i int) bool { return buckets[i].Count >= rank })

	if b == len(buckets)-1 {
		return buckets[len(buckets)-2].UpperBound, forcedMonotonic, fixedPrecision
	}
	if b == 0 && buckets[0].UpperBound <= 0 {
		return buckets[0].UpperBound, forcedMonotonic, fixedPrecision
	}
	var (
		bucketStart float64
		bucketEnd   = buckets[b].UpperBound
		count       = buckets[b].Count
	)
	if b > 0 {
		bucketStart = buckets[b-1].UpperBound
		count -= buckets[b-1].Count
		rank -= buckets[b-1].Count
	}
	return bucketStart + (bucketEnd-bucketStart)*(rank/count), forcedMonotonic, fixedPrecision
}

// HistogramQuantile calculates the quantile 'q' based on the given histogram.
//
// For custom buckets, the result is interpolated linearly, i.e. it is assumed
// the observations are uniformly distributed within each bucket. (This is a
// quite blunt assumption, but it is consistent with the interpolation method
// used for classic histograms so far.)
//
// For exponential buckets, the interpolation is done under the assumption that
// the samples within each bucket are distributed in a way that they would
// uniformly populate the buckets in a hypothetical histogram with higher
// resolution. For example, if the rank calculation suggests that the requested
// quantile is right in the middle of the population of the (1,2] bucket, we
// assume the quantile would be right at the bucket boundary between the two
// buckets the (1,2] bucket would be divided into if the histogram had double
// the resolution, which is 2**2**-1 = 1.4142... We call this exponential
// interpolation.
//
// However, for a quantile that ends up in the zero bucket, this method isn't
// very helpful (because there is an infinite number of buckets close to zero,
// so we would have to assume zero as the result). Therefore, we return to
// linear interpolation in the zero bucket.
//
// A natural lower bound of 0 is assumed if the histogram has only positive
// buckets. Likewise, a natural upper bound of 0 is assumed if the histogram has
// only negative buckets.
//
// There are a number of special cases:
//
// If the histogram has 0 observations, NaN is returned.
//
// If q<0, -Inf is returned.
//
// If q>1, +Inf is returned.
//
// If q is NaN, NaN is returned.
//
// HistogramQuantile is for calculating the histogram_quantile() of native
// histograms. See also: BucketQuantile for classic histograms.
//
// HistogramQuantile is exported as it may be used by other PromQL engine
// implementations.
func HistogramQuantile(q float64, h *histogram.FloatHistogram) float64 {
	if q < 0 {
		return math.Inf(-1)
	}
	if q > 1 {
		return math.Inf(+1)
	}

	if h.Count == 0 || math.IsNaN(q) {
		return math.NaN()
	}

	var (
		bucket histogram.Bucket[float64]
		count  float64
		it     histogram.BucketIterator[float64]
		rank   float64
	)

	// If there are NaN observations in the histogram (h.Sum is NaN), use the forward iterator.
	// If q < 0.5, use the forward iterator.
	// If q >= 0.5, use the reverse iterator.
	if math.IsNaN(h.Sum) || q < 0.5 {
		it = h.AllBucketIterator()
		rank = q * h.Count
	} else {
		it = h.AllReverseBucketIterator()
		rank = (1 - q) * h.Count
	}

	for it.Next() {
		bucket = it.At()
		if bucket.Count == 0 {
			continue
		}
		count += bucket.Count
		if count >= rank {
			break
		}
	}
	if !h.UsesCustomBuckets() && bucket.Lower < 0 && bucket.Upper > 0 {
		switch {
		case len(h.NegativeBuckets) == 0 && len(h.PositiveBuckets) > 0:
			// The result is in the zero bucket and the histogram has only
			// positive buckets. So we consider 0 to be the lower bound.
			bucket.Lower = 0
		case len(h.PositiveBuckets) == 0 && len(h.NegativeBuckets) > 0:
			// The result is in the zero bucket and the histogram has only
			// negative buckets. So we consider 0 to be the upper bound.
			bucket.Upper = 0
		}
	} else if h.UsesCustomBuckets() {
		if bucket.Lower == math.Inf(-1) {
			// first bucket, with lower bound -Inf
			if bucket.Upper <= 0 {
				return bucket.Upper
			}
			bucket.Lower = 0
		} else if bucket.Upper == math.Inf(1) {
			// last bucket, with upper bound +Inf
			return bucket.Lower
		}
	}
	// Due to numerical inaccuracies, we could end up with a higher count
	// than h.Count. Thus, make sure count is never higher than h.Count.
	if count > h.Count {
		count = h.Count
	}
	// We could have hit the highest bucket without even reaching the rank
	// (this should only happen if the histogram contains observations of
	// the value NaN), in which case we simply return the upper limit of the
	// highest explicit bucket.
	if count < rank {
		return bucket.Upper
	}

	// NaN observations increase h.Count but not the total number of
	// observations in the buckets. Therefore, we have to use the forward
	// iterator to find percentiles. We recognize histograms containing NaN
	// observations by checking if their h.Sum is NaN.
	if math.IsNaN(h.Sum) || q < 0.5 {
		rank -= count - bucket.Count
	} else {
		rank = count - rank
	}

	// The fraction of how far we are into the current bucket.
	fraction := rank / bucket.Count

	// Return linear interpolation for custom buckets and for quantiles that
	// end up in the zero bucket.
	if h.UsesCustomBuckets() || (bucket.Lower <= 0 && bucket.Upper >= 0) {
		return bucket.Lower + (bucket.Upper-bucket.Lower)*fraction
	}

	// For exponential buckets, we interpolate on a logarithmic scale. On a
	// logarithmic scale, the exponential bucket boundaries (for any schema)
	// become linear (every bucket has the same width). Therefore, after
	// taking the logarithm of both bucket boundaries, we can use the
	// calculated fraction in the same way as for linear interpolation (see
	// above). Finally, we return to the normal scale by applying the
	// exponential function to the result.
	logLower := math.Log2(math.Abs(bucket.Lower))
	logUpper := math.Log2(math.Abs(bucket.Upper))
	if bucket.Lower > 0 { // Positive bucket.
		return math.Exp2(logLower + (logUpper-logLower)*fraction)
	}
	// Otherwise, we are in a negative bucket and have to mirror things.
	return -math.Exp2(logUpper + (logLower-logUpper)*(1-fraction))
}

// HistogramFraction calculates the fraction of observations between the
// provided lower and upper bounds, based on the provided histogram.
//
// HistogramFraction is in a certain way the inverse of histogramQuantile.  If
// HistogramQuantile(0.9, h) returns 123.4, then HistogramFraction(-Inf, 123.4, h)
// returns 0.9.
//
// The same notes with regard to interpolation and assumptions about the zero
// bucket boundaries apply as for histogramQuantile.
//
// Whether either boundary is inclusive or exclusive doesn’t actually matter as
// long as interpolation has to be performed anyway. In the case of a boundary
// coinciding with a bucket boundary, the inclusive or exclusive nature of the
// boundary determines the exact behavior of the threshold. With the current
// implementation, that means that lower is exclusive for positive values and
// inclusive for negative values, while upper is inclusive for positive values
// and exclusive for negative values.
//
// Special cases:
//
// If the histogram has 0 observations, NaN is returned.
//
// Use a lower bound of -Inf to get the fraction of all observations below the
// upper bound.
//
// Use an upper bound of +Inf to get the fraction of all observations above the
// lower bound.
//
// If lower or upper is NaN, NaN is returned.
//
// If lower >= upper and the histogram has at least 1 observation, zero is returned.
//
// HistogramFraction is exported as it may be used by other PromQL engine
// implementations.
func HistogramFraction(lower, upper float64, h *histogram.FloatHistogram) float64 {
	if h.Count == 0 || math.IsNaN(lower) || math.IsNaN(upper) {
		return math.NaN()
	}
	if lower >= upper {
		return 0
	}

	var (
		rank, lowerRank, upperRank float64
		lowerSet, upperSet         bool
		it                         = h.AllBucketIterator()
	)
	for it.Next() {
		b := it.At()
		zeroBucket := false

		// interpolateLinearly is used for custom buckets to be
		// consistent with the linear interpolation known from classic
		// histograms. It is also used for the zero bucket.
		interpolateLinearly := func(v float64) float64 {
			return rank + b.Count*(v-b.Lower)/(b.Upper-b.Lower)
		}

		// interpolateExponentially is using the same exponential
		// interpolation method as above for histogramQuantile. This
		// method is a better fit for exponential bucketing.
		interpolateExponentially := func(v float64) float64 {
			var (
				logLower = math.Log2(math.Abs(b.Lower))
				logUpper = math.Log2(math.Abs(b.Upper))
				logV     = math.Log2(math.Abs(v))
				fraction float64
			)
			if v > 0 {
				fraction = (logV - logLower) / (logUpper - logLower)
			} else {
				fraction = 1 - ((logV - logUpper) / (logLower - logUpper))
			}
			return rank + b.Count*fraction
		}

		if b.Lower <= 0 && b.Upper >= 0 {
			zeroBucket = true
			switch {
			case len(h.NegativeBuckets) == 0 && len(h.PositiveBuckets) > 0:
				// This is the zero bucket and the histogram has only
				// positive buckets. So we consider 0 to be the lower
				// bound.
				b.Lower = 0
			case len(h.PositiveBuckets) == 0 && len(h.NegativeBuckets) > 0:
				// This is in the zero bucket and the histogram has only
				// negative buckets. So we consider 0 to be the upper
				// bound.
				b.Upper = 0
			}
		}
		if !lowerSet && b.Lower >= lower {
			// We have hit the lower value at the lower bucket boundary.
			lowerRank = rank
			lowerSet = true
		}
		if !upperSet && b.Lower >= upper {
			// We have hit the upper value at the lower bucket boundary.
			upperRank = rank
			upperSet = true
		}
		if lowerSet && upperSet {
			break
		}
		if !lowerSet && b.Lower < lower && b.Upper > lower {
			// The lower value is in this bucket.
			if h.UsesCustomBuckets() || zeroBucket {
				lowerRank = interpolateLinearly(lower)
			} else {
				lowerRank = interpolateExponentially(lower)
			}
			lowerSet = true
		}
		if !upperSet && b.Lower < upper && b.Upper > upper {
			// The upper value is in this bucket.
			if h.UsesCustomBuckets() || zeroBucket {
				upperRank = interpolateLinearly(upper)
			} else {
				upperRank = interpolateExponentially(upper)
			}
			upperSet = true
		}
		if lowerSet && upperSet {
			break
		}
		rank += b.Count
	}
	if !lowerSet || lowerRank > h.Count {
		lowerRank = h.Count
	}
	if !upperSet || upperRank > h.Count {
		upperRank = h.Count
	}

	return (upperRank - lowerRank) / h.Count
}

// coalesceBuckets merges buckets with the same upper bound.
//
// The input buckets must be sorted.
func coalesceBuckets(buckets Buckets) Buckets {
	last := buckets[0]
	i := 0
	for _, b := range buckets[1:] {
		if b.UpperBound == last.UpperBound {
			last.Count += b.Count
		} else {
			buckets[i] = last
			last = b
			i++
		}
	}
	buckets[i] = last
	return buckets[:i+1]
}

// The assumption that bucket counts increase monotonically with increasing
// upperBound may be violated during:
//
//   - Circumstances where data is already inconsistent at the target's side.
//   - Ingestion via the remote write receiver that Prometheus implements.
//   - Optimisation of query execution where precision is sacrificed for other
//     benefits, not by Prometheus but by systems built on top of it.
//   - Circumstances where floating point precision errors accumulate.
//
// Monotonicity is usually guaranteed because if a bucket with upper bound
// u1 has count c1, then any bucket with a higher upper bound u > u1 must
// have counted all c1 observations and perhaps more, so that c >= c1.
//
// bucketQuantile depends on that monotonicity to do a binary search for the
// bucket with the φ-quantile count, so breaking the monotonicity
// guarantee causes bucketQuantile() to return undefined (nonsense) results.
//
// As a somewhat hacky solution, we first silently ignore any numerically
// insignificant (relative delta below the requested tolerance and likely to
// be from floating point precision errors) differences between successive
// buckets regardless of the direction. Then we calculate the "envelope" of
// the histogram buckets, essentially removing any decreases in the count
// between successive buckets.
//
// We return a bool to indicate if this monotonicity was forced or not, and
// another bool to indicate if small deltas were ignored or not.
func ensureMonotonicAndIgnoreSmallDeltas(buckets Buckets, tolerance float64) (bool, bool) {
	var forcedMonotonic, fixedPrecision bool
	prev := buckets[0].Count
	for i := 1; i < len(buckets); i++ {
		curr := buckets[i].Count // Assumed always positive.
		if curr == prev {
			// No correction needed if the counts are identical between buckets.
			continue
		}
		if almost.Equal(prev, curr, tolerance) {
			// Silently correct numerically insignificant differences from floating
			// point precision errors, regardless of direction.
			// Do not update the 'prev' value as we are ignoring the difference.
			buckets[i].Count = prev
			fixedPrecision = true
			continue
		}
		if curr < prev {
			// Force monotonicity by removing any decreases regardless of magnitude.
			// Do not update the 'prev' value as we are ignoring the decrease.
			buckets[i].Count = prev
			forcedMonotonic = true
			continue
		}
		prev = curr
	}
	return forcedMonotonic, fixedPrecision
}

// quantile calculates the given quantile of a vector of samples.
//
// The Vector will be sorted.
// If 'values' has zero elements, NaN is returned.
// If q==NaN, NaN is returned.
// If q<0, -Inf is returned.
// If q>1, +Inf is returned.
func quantile(q float64, values vectorByValueHeap) float64 {
	if len(values) == 0 || math.IsNaN(q) {
		return math.NaN()
	}
	if q < 0 {
		return math.Inf(-1)
	}
	if q > 1 {
		return math.Inf(+1)
	}
	sort.Sort(values)

	n := float64(len(values))
	// When the quantile lies between two samples,
	// we use a weighted average of the two samples.
	rank := q * (n - 1)

	lowerIndex := math.Max(0, math.Floor(rank))
	upperIndex := math.Min(n-1, lowerIndex+1)

	weight := rank - math.Floor(rank)
	return values[int(lowerIndex)].F*(1-weight) + values[int(upperIndex)].F*weight
}
