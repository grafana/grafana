/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"fmt"
	"math"
)

// PrintHistogram builds and displays the key-value size histogram.
// When keyPrefix is set, only the keys that have prefix "keyPrefix" are
// considered for creating the histogram
func (db *DB) PrintHistogram(keyPrefix []byte) {
	if db == nil {
		fmt.Println("\nCannot build histogram: DB is nil.")
		return
	}
	histogram := db.buildHistogram(keyPrefix)
	fmt.Printf("Histogram of key sizes (in bytes)\n")
	histogram.keySizeHistogram.printHistogram()
	fmt.Printf("Histogram of value sizes (in bytes)\n")
	histogram.valueSizeHistogram.printHistogram()
}

// histogramData stores information about a histogram
type histogramData struct {
	bins        []int64
	countPerBin []int64
	totalCount  int64
	min         int64
	max         int64
	sum         int64
}

// sizeHistogram contains keySize histogram and valueSize histogram
type sizeHistogram struct {
	keySizeHistogram, valueSizeHistogram histogramData
}

// newSizeHistogram returns a new instance of keyValueSizeHistogram with
// properly initialized fields.
func newSizeHistogram() *sizeHistogram {
	// TODO(ibrahim): find appropriate bin size.
	keyBins := createHistogramBins(1, 16)
	valueBins := createHistogramBins(1, 30)
	return &sizeHistogram{
		keySizeHistogram: histogramData{
			bins:        keyBins,
			countPerBin: make([]int64, len(keyBins)+1),
			max:         math.MinInt64,
			min:         math.MaxInt64,
			sum:         0,
		},
		valueSizeHistogram: histogramData{
			bins:        valueBins,
			countPerBin: make([]int64, len(valueBins)+1),
			max:         math.MinInt64,
			min:         math.MaxInt64,
			sum:         0,
		},
	}
}

// createHistogramBins creates bins for an histogram. The bin sizes are powers
// of two of the form [2^min_exponent, ..., 2^max_exponent].
func createHistogramBins(minExponent, maxExponent uint32) []int64 {
	var bins []int64
	for i := minExponent; i <= maxExponent; i++ {
		bins = append(bins, int64(1)<<i)
	}
	return bins
}

// Update the min and max fields if value is less than or greater than the
// current min/max value.
func (histogram *histogramData) Update(value int64) {
	if value > histogram.max {
		histogram.max = value
	}
	if value < histogram.min {
		histogram.min = value
	}

	histogram.sum += value
	histogram.totalCount++

	for index := 0; index <= len(histogram.bins); index++ {
		// Allocate value in the last buckets if we reached the end of the Bounds array.
		if index == len(histogram.bins) {
			histogram.countPerBin[index]++
			break
		}

		// Check if the value should be added to the "index" bin
		if value < histogram.bins[index] {
			histogram.countPerBin[index]++
			break
		}
	}
}

// buildHistogram builds the key-value size histogram.
// When keyPrefix is set, only the keys that have prefix "keyPrefix" are
// considered for creating the histogram
func (db *DB) buildHistogram(keyPrefix []byte) *sizeHistogram {
	txn := db.NewTransaction(false)
	defer txn.Discard()

	itr := txn.NewIterator(DefaultIteratorOptions)
	defer itr.Close()

	badgerHistogram := newSizeHistogram()

	// Collect key and value sizes.
	for itr.Seek(keyPrefix); itr.ValidForPrefix(keyPrefix); itr.Next() {
		item := itr.Item()
		badgerHistogram.keySizeHistogram.Update(item.KeySize())
		badgerHistogram.valueSizeHistogram.Update(item.ValueSize())
	}
	return badgerHistogram
}

// printHistogram prints the histogram data in a human-readable format.
func (histogram histogramData) printHistogram() {
	fmt.Printf("Total count: %d\n", histogram.totalCount)
	fmt.Printf("Min value: %d\n", histogram.min)
	fmt.Printf("Max value: %d\n", histogram.max)
	fmt.Printf("Mean: %.2f\n", float64(histogram.sum)/float64(histogram.totalCount))
	fmt.Printf("%24s %9s\n", "Range", "Count")

	numBins := len(histogram.bins)
	for index, count := range histogram.countPerBin {
		if count == 0 {
			continue
		}

		// The last bin represents the bin that contains the range from
		// the last bin up to infinity so it's processed differently than the
		// other bins.
		if index == len(histogram.countPerBin)-1 {
			lowerBound := int(histogram.bins[numBins-1])
			fmt.Printf("[%10d, %10s) %9d\n", lowerBound, "infinity", count)
			continue
		}

		upperBound := int(histogram.bins[index])
		lowerBound := 0
		if index > 0 {
			lowerBound = int(histogram.bins[index-1])
		}

		fmt.Printf("[%10d, %10d) %9d\n", lowerBound, upperBound, count)
	}
	fmt.Println()
}
