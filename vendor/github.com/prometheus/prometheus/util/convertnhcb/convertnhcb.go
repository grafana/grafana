// Copyright 2024 The Prometheus Authors
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

package convertnhcb

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
)

var (
	errNegativeBucketCount = errors.New("bucket count must be non-negative")
	errNegativeCount       = errors.New("count must be non-negative")
	errCountMismatch       = errors.New("count mismatch")
	errCountNotCumulative  = errors.New("count is not cumulative")
)

type tempHistogramBucket struct {
	le    float64
	count float64
}

// TempHistogram is used to collect information about classic histogram
// samples incrementally before creating a histogram.Histogram or
// histogram.FloatHistogram based on the values collected.
type TempHistogram struct {
	buckets  []tempHistogramBucket
	count    float64
	sum      float64
	err      error
	hasCount bool
}

// NewTempHistogram creates a new TempHistogram to
// collect information about classic histogram samples.
func NewTempHistogram() TempHistogram {
	return TempHistogram{
		buckets: make([]tempHistogramBucket, 0, 10),
	}
}

func (h TempHistogram) Err() error {
	return h.err
}

func (h *TempHistogram) Reset() {
	h.buckets = h.buckets[:0]
	h.count = 0
	h.sum = 0
	h.err = nil
	h.hasCount = false
}

func (h *TempHistogram) SetBucketCount(boundary, count float64) error {
	if h.err != nil {
		return h.err
	}
	if count < 0 {
		h.err = fmt.Errorf("%w: le=%g, count=%g", errNegativeBucketCount, boundary, count)
		return h.err
	}
	// Assume that the elements are added in order.
	switch {
	case len(h.buckets) == 0:
		h.buckets = append(h.buckets, tempHistogramBucket{le: boundary, count: count})
	case h.buckets[len(h.buckets)-1].le < boundary:
		// Happy case is "<".
		if count < h.buckets[len(h.buckets)-1].count {
			h.err = fmt.Errorf("%w: %g < %g", errCountNotCumulative, count, h.buckets[len(h.buckets)-1].count)
			return h.err
		}
		h.buckets = append(h.buckets, tempHistogramBucket{le: boundary, count: count})
	case h.buckets[len(h.buckets)-1].le == boundary:
		// Ignore this, as it is a duplicate sample.
	default:
		// Find the correct position to insert.
		i := sort.Search(len(h.buckets), func(i int) bool {
			return h.buckets[i].le >= boundary
		})
		if h.buckets[i].le == boundary {
			// Ignore this, as it is a duplicate sample.
			return nil
		}
		if i > 0 && count < h.buckets[i-1].count {
			h.err = fmt.Errorf("%w: %g < %g", errCountNotCumulative, count, h.buckets[i-1].count)
			return h.err
		}
		if count > h.buckets[i].count {
			h.err = fmt.Errorf("%w: %g > %g", errCountNotCumulative, count, h.buckets[i].count)
			return h.err
		}
		// Insert at the correct position unless duplicate.
		h.buckets = append(h.buckets, tempHistogramBucket{})
		copy(h.buckets[i+1:], h.buckets[i:])
		h.buckets[i] = tempHistogramBucket{le: boundary, count: count}
	}
	return nil
}

func (h *TempHistogram) SetCount(count float64) error {
	if h.err != nil {
		return h.err
	}
	if count < 0 {
		h.err = fmt.Errorf("%w: count=%g", errNegativeCount, count)
		return h.err
	}
	h.count = count
	h.hasCount = true
	return nil
}

func (h *TempHistogram) SetSum(sum float64) error {
	if h.err != nil {
		return h.err
	}
	h.sum = sum
	return nil
}

func (h TempHistogram) Convert() (*histogram.Histogram, *histogram.FloatHistogram, error) {
	if h.err != nil {
		return nil, nil, h.err
	}

	if !h.hasCount && len(h.buckets) > 0 {
		// No count, so set count to the highest known bucket's count.
		h.count = h.buckets[len(h.buckets)-1].count
		h.hasCount = true
	}

	if len(h.buckets) == 0 || h.buckets[len(h.buckets)-1].le != math.Inf(1) {
		// No +Inf bucket.
		// Let the last bucket be +Inf with the overall count.
		h.buckets = append(h.buckets, tempHistogramBucket{le: math.Inf(1), count: h.count})
	}

	for _, b := range h.buckets {
		intCount := int64(math.Round(b.count))
		if b.count != float64(intCount) {
			return h.convertToFloatHistogram()
		}
	}

	intCount := uint64(math.Round(h.count))
	if h.count != float64(intCount) {
		return h.convertToFloatHistogram()
	}
	return h.convertToIntegerHistogram(intCount)
}

func (h TempHistogram) convertToIntegerHistogram(count uint64) (*histogram.Histogram, *histogram.FloatHistogram, error) {
	rh := &histogram.Histogram{
		Schema:          histogram.CustomBucketsSchema,
		Count:           count,
		Sum:             h.sum,
		PositiveSpans:   []histogram.Span{{Length: uint32(len(h.buckets))}},
		PositiveBuckets: make([]int64, len(h.buckets)),
	}

	if len(h.buckets) > 1 {
		rh.CustomValues = make([]float64, len(h.buckets)-1) // Not storing the last +Inf bucket.
	}

	prevCount := int64(0)
	prevDelta := int64(0)
	for i, b := range h.buckets {
		// delta is the actual bucket count as the input is cumulative.
		delta := int64(b.count) - prevCount
		rh.PositiveBuckets[i] = delta - prevDelta
		prevCount = int64(b.count)
		prevDelta = delta
		if b.le != math.Inf(1) {
			rh.CustomValues[i] = b.le
		}
	}

	if count != uint64(h.buckets[len(h.buckets)-1].count) {
		h.err = fmt.Errorf("%w: count=%d != le=%g count=%g", errCountMismatch, count, h.buckets[len(h.buckets)-1].le, h.buckets[len(h.buckets)-1].count)
		return nil, nil, h.err
	}

	return rh.Compact(2), nil, nil
}

func (h TempHistogram) convertToFloatHistogram() (*histogram.Histogram, *histogram.FloatHistogram, error) {
	rh := &histogram.FloatHistogram{
		Schema:          histogram.CustomBucketsSchema,
		Count:           h.count,
		Sum:             h.sum,
		PositiveSpans:   []histogram.Span{{Length: uint32(len(h.buckets))}},
		PositiveBuckets: make([]float64, len(h.buckets)),
	}

	if len(h.buckets) > 1 {
		rh.CustomValues = make([]float64, len(h.buckets)-1) // Not storing the last +Inf bucket.
	}

	prevCount := 0.0
	for i, b := range h.buckets {
		rh.PositiveBuckets[i] = b.count - prevCount
		prevCount = b.count
		if b.le != math.Inf(1) {
			rh.CustomValues[i] = b.le
		}
	}

	if h.count != h.buckets[len(h.buckets)-1].count {
		h.err = fmt.Errorf("%w: count=%g != le=%g count=%g", errCountMismatch, h.count, h.buckets[len(h.buckets)-1].le, h.buckets[len(h.buckets)-1].count)
		return nil, nil, h.err
	}

	return nil, rh.Compact(0), nil
}

func GetHistogramMetricBase(m labels.Labels, name string) labels.Labels {
	return labels.NewBuilder(m).
		Set(labels.MetricName, name).
		Del(labels.BucketLabel).
		Labels()
}

type SuffixType int

const (
	SuffixNone SuffixType = iota
	SuffixBucket
	SuffixSum
	SuffixCount
)

// GetHistogramMetricBaseName removes the suffixes _bucket, _sum, _count from
// the metric name. We specifically do not remove the _created suffix as that
// should be removed by the caller.
func GetHistogramMetricBaseName(s string) (SuffixType, string) {
	if r, ok := strings.CutSuffix(s, "_bucket"); ok {
		return SuffixBucket, r
	}
	if r, ok := strings.CutSuffix(s, "_sum"); ok {
		return SuffixSum, r
	}
	if r, ok := strings.CutSuffix(s, "_count"); ok {
		return SuffixCount, r
	}
	return SuffixNone, s
}
