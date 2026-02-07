package utils

import (
	"sort"
	"strconv"
)

// Bucketize will put the value of a metric into the correct bucket, and return the label for it.
// It is expected that the buckets are already sorted in increasing order and non-empty.
func Bucketize(value uint, buckets []uint) string {
	idx := sort.Search(len(buckets), func(i int) bool {
		return value <= buckets[i]
	})

	if idx == len(buckets) {
		return "+Inf"
	}

	return strconv.Itoa(int(buckets[idx]))
}

// LinearBuckets returns an evenly distributed range of buckets in the closed interval
// [min...max]. The min and max count toward the bucket count since they are included
// in the range.
func LinearBuckets(minValue, maxValue float64, count int) []float64 {
	var buckets []float64

	width := (maxValue - minValue) / float64(count-1)

	for i := minValue; i <= maxValue; i += width {
		buckets = append(buckets, i)
	}

	return buckets
}
