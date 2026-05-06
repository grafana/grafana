/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import (
	"fmt"
	"math"
	"strings"

	"github.com/dustin/go-humanize"
)

// Creates bounds for an histogram. The bounds are powers of two of the form
// [2^min_exponent, ..., 2^max_exponent].
func HistogramBounds(minExponent, maxExponent uint32) []float64 {
	var bounds []float64
	for i := minExponent; i <= maxExponent; i++ {
		bounds = append(bounds, float64(int(1)<<i))
	}
	return bounds
}

func Fibonacci(num int) []float64 {
	assert(num > 4)
	bounds := make([]float64, num)
	bounds[0] = 1
	bounds[1] = 2
	for i := 2; i < num; i++ {
		bounds[i] = bounds[i-1] + bounds[i-2]
	}
	return bounds
}

// HistogramData stores the information needed to represent the sizes of the keys and values
// as a histogram.
type HistogramData struct {
	Bounds         []float64
	Count          int64
	CountPerBucket []int64
	Min            int64
	Max            int64
	Sum            int64
}

// NewHistogramData returns a new instance of HistogramData with properly initialized fields.
func NewHistogramData(bounds []float64) *HistogramData {
	return &HistogramData{
		Bounds:         bounds,
		CountPerBucket: make([]int64, len(bounds)+1),
		Max:            0,
		Min:            math.MaxInt64,
	}
}

func (histogram *HistogramData) Copy() *HistogramData {
	if histogram == nil {
		return nil
	}
	return &HistogramData{
		Bounds:         append([]float64{}, histogram.Bounds...),
		CountPerBucket: append([]int64{}, histogram.CountPerBucket...),
		Count:          histogram.Count,
		Min:            histogram.Min,
		Max:            histogram.Max,
		Sum:            histogram.Sum,
	}
}

// Update changes the Min and Max fields if value is less than or greater than the current values.
func (histogram *HistogramData) Update(value int64) {
	if histogram == nil {
		return
	}
	if value > histogram.Max {
		histogram.Max = value
	}
	if value < histogram.Min {
		histogram.Min = value
	}

	histogram.Sum += value
	histogram.Count++

	for index := 0; index <= len(histogram.Bounds); index++ {
		// Allocate value in the last buckets if we reached the end of the Bounds array.
		if index == len(histogram.Bounds) {
			histogram.CountPerBucket[index]++
			break
		}

		if value < int64(histogram.Bounds[index]) {
			histogram.CountPerBucket[index]++
			break
		}
	}
}

// Mean returns the mean value for the histogram.
func (histogram *HistogramData) Mean() float64 {
	if histogram.Count == 0 {
		return 0
	}
	return float64(histogram.Sum) / float64(histogram.Count)
}

// String converts the histogram data into human-readable string.
func (histogram *HistogramData) String() string {
	if histogram == nil {
		return ""
	}
	var b strings.Builder

	b.WriteString("\n -- Histogram: \n")
	b.WriteString(fmt.Sprintf("Min value: %d \n", histogram.Min))
	b.WriteString(fmt.Sprintf("Max value: %d \n", histogram.Max))
	b.WriteString(fmt.Sprintf("Count: %d \n", histogram.Count))
	b.WriteString(fmt.Sprintf("50p: %.2f \n", histogram.Percentile(0.5)))
	b.WriteString(fmt.Sprintf("75p: %.2f \n", histogram.Percentile(0.75)))
	b.WriteString(fmt.Sprintf("90p: %.2f \n", histogram.Percentile(0.90)))

	numBounds := len(histogram.Bounds)
	var cum float64
	for index, count := range histogram.CountPerBucket {
		if count == 0 {
			continue
		}

		// The last bucket represents the bucket that contains the range from
		// the last bound up to infinity so it's processed differently than the
		// other buckets.
		if index == len(histogram.CountPerBucket)-1 {
			lowerBound := uint64(histogram.Bounds[numBounds-1])
			page := float64(count*100) / float64(histogram.Count)
			cum += page
			b.WriteString(fmt.Sprintf("[%s, %s) %d %.2f%% %.2f%%\n",
				humanize.IBytes(lowerBound), "infinity", count, page, cum))
			continue
		}

		upperBound := uint64(histogram.Bounds[index])
		lowerBound := uint64(0)
		if index > 0 {
			lowerBound = uint64(histogram.Bounds[index-1])
		}

		page := float64(count*100) / float64(histogram.Count)
		cum += page
		b.WriteString(fmt.Sprintf("[%d, %d) %d %.2f%% %.2f%%\n",
			lowerBound, upperBound, count, page, cum))
	}
	b.WriteString(" --\n")
	return b.String()
}

// Percentile returns the percentile value for the histogram.
// value of p should be between [0.0-1.0]
func (histogram *HistogramData) Percentile(p float64) float64 {
	if histogram == nil {
		return 0
	}

	if histogram.Count == 0 {
		// if no data return the minimum range
		return histogram.Bounds[0]
	}
	pval := int64(float64(histogram.Count) * p)
	for i, v := range histogram.CountPerBucket {
		pval = pval - v
		if pval <= 0 {
			if i == len(histogram.Bounds) {
				break
			}
			return histogram.Bounds[i]
		}
	}
	// default return should be the max range
	return histogram.Bounds[len(histogram.Bounds)-1]
}

// Clear reset the histogram. Helpful in situations where we need to reset the metrics
func (histogram *HistogramData) Clear() {
	if histogram == nil {
		return
	}

	histogram.Count = 0
	histogram.CountPerBucket = make([]int64, len(histogram.Bounds)+1)
	histogram.Sum = 0
	histogram.Max = 0
	histogram.Min = math.MaxInt64
}
