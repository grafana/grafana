package brotli

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Functions for clustering similar histograms together. */

type histogramPair struct {
	idx1       uint32
	idx2       uint32
	cost_combo float64
	cost_diff  float64
}

func histogramPairIsLess(p1 *histogramPair, p2 *histogramPair) bool {
	if p1.cost_diff != p2.cost_diff {
		return p1.cost_diff > p2.cost_diff
	}

	return (p1.idx2 - p1.idx1) > (p2.idx2 - p2.idx1)
}

/* Returns entropy reduction of the context map when we combine two clusters. */
func clusterCostDiff(size_a uint, size_b uint) float64 {
	var size_c uint = size_a + size_b
	return float64(size_a)*fastLog2(size_a) + float64(size_b)*fastLog2(size_b) - float64(size_c)*fastLog2(size_c)
}
