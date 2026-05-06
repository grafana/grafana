// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package stat

import (
	"math"
	"slices"
	"sort"
)

// ROC returns paired false positive rate (FPR) and true positive rate
// (TPR) values corresponding to cutoff points on the receiver operator
// characteristic (ROC) curve obtained when y is treated as a binary
// classifier for classes with weights. The cutoff thresholds used to
// calculate the ROC are returned in thresh such that tpr[i] and fpr[i]
// are the true and false positive rates for y >= thresh[i].
//
// The input y and cutoffs must be sorted, and values in y must correspond
// to values in classes and weights. SortWeightedLabeled can be used to
// sort y together with classes and weights.
//
// For a given cutoff value, observations corresponding to entries in y
// greater than the cutoff value are classified as true, while those
// less than or equal to the cutoff value are classified as false. These
// assigned class labels are compared with the true values in the classes
// slice and used to calculate the FPR and TPR.
//
// If weights is nil, all weights are treated as 1. If weights is not nil
// it must have the same length as y and classes, otherwise ROC will panic.
//
// If cutoffs is nil or empty, all possible cutoffs are calculated,
// resulting in fpr and tpr having length one greater than the number of
// unique values in y. Otherwise fpr and tpr will be returned with the
// same length as cutoffs. floats.Span can be used to generate equally
// spaced cutoffs.
//
// More details about ROC curves are available at
// https://en.wikipedia.org/wiki/Receiver_operating_characteristic
func ROC(cutoffs, y []float64, classes []bool, weights []float64) (tpr, fpr, thresh []float64) {
	if len(y) != len(classes) {
		panic("stat: slice length mismatch")
	}
	if weights != nil && len(y) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if !sort.Float64sAreSorted(y) {
		panic("stat: input must be sorted ascending")
	}
	if !sort.Float64sAreSorted(cutoffs) {
		panic("stat: cutoff values must be sorted ascending")
	}
	if len(y) == 0 {
		return nil, nil, nil
	}
	if len(cutoffs) == 0 {
		if cutoffs == nil || cap(cutoffs) < len(y)+1 {
			cutoffs = make([]float64, len(y)+1)
		} else {
			cutoffs = cutoffs[:len(y)+1]
		}
		// Choose all possible cutoffs for unique values in y.
		bin := 0
		cutoffs[bin] = y[0]
		for i, u := range y[1:] {
			if u == y[i] {
				continue
			}
			bin++
			cutoffs[bin] = u
		}
		cutoffs[bin+1] = math.Inf(1)
		cutoffs = cutoffs[:bin+2]
	} else {
		// Don't mutate the provided cutoffs.
		tmp := cutoffs
		cutoffs = make([]float64, len(cutoffs))
		copy(cutoffs, tmp)
	}

	tpr = make([]float64, len(cutoffs))
	fpr = make([]float64, len(cutoffs))
	var bin int
	var nPos, nNeg float64
	for i, u := range classes {
		// Update the bin until it matches the next y value
		// skipping empty bins.
		for bin < len(cutoffs)-1 && y[i] >= cutoffs[bin] {
			bin++
			tpr[bin] = tpr[bin-1]
			fpr[bin] = fpr[bin-1]
		}
		posWeight, negWeight := 1.0, 0.0
		if weights != nil {
			posWeight = weights[i]
		}
		if !u {
			posWeight, negWeight = negWeight, posWeight
		}
		nPos += posWeight
		nNeg += negWeight
		// Count false negatives (in tpr) and true negatives (in fpr).
		if y[i] < cutoffs[bin] {
			tpr[bin] += posWeight
			fpr[bin] += negWeight
		}
	}

	invNeg := 1 / nNeg
	invPos := 1 / nPos
	// Convert negative counts to TPR and FPR.
	// Bins beyond the maximum value in y are skipped
	// leaving these fpr and tpr elements as zero.
	for i := range tpr[:bin+1] {
		// Prevent fused float operations by
		// making explicit float64 conversions.
		tpr[i] = 1 - float64(tpr[i]*invPos)
		fpr[i] = 1 - float64(fpr[i]*invNeg)
	}
	slices.Reverse(tpr)
	slices.Reverse(fpr)
	slices.Reverse(cutoffs)

	return tpr, fpr, cutoffs
}

// TOC returns the Total Operating Characteristic for the classes provided
// and the minimum and maximum bounds for the TOC.
//
// The input y values that correspond to classes and weights must be sorted
// in ascending order. classes[i] is the class of value y[i] and weights[i]
// is the weight of y[i]. SortWeightedLabeled can be used to sort classes
// together with weights by the rank variable, i+1.
//
// The returned ntp values can be interpreted as the number of true positives
// where values above the given rank are assigned class true for each given
// rank from 1 to len(classes).
//
//	ntp_i = sum_{j ≥ len(ntp)-1 - i} [ classes_j ] * weights_j, where [x] = 1 if x else 0.
//
// The values of min and max provide the minimum and maximum possible number
// of false values for the set of classes. The first element of ntp, min and
// max are always zero as this corresponds to assigning all data class false
// and the last elements are always weighted sum of classes as this corresponds
// to assigning every data class true. For len(classes) != 0, the lengths of
// min, ntp and max are len(classes)+1.
//
// If weights is nil, all weights are treated as 1. When weights are not nil,
// the calculation of min and max allows for partial assignment of single data
// points. If weights is not nil it must have the same length as classes,
// otherwise TOC will panic.
//
// More details about TOC curves are available at
// https://en.wikipedia.org/wiki/Total_operating_characteristic
func TOC(classes []bool, weights []float64) (min, ntp, max []float64) {
	if weights != nil && len(classes) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if len(classes) == 0 {
		return nil, nil, nil
	}

	ntp = make([]float64, len(classes)+1)
	min = make([]float64, len(ntp))
	max = make([]float64, len(ntp))
	if weights == nil {
		for i := range ntp[1:] {
			ntp[i+1] = ntp[i]
			if classes[len(classes)-i-1] {
				ntp[i+1]++
			}
		}
		totalPositive := ntp[len(ntp)-1]
		for i := range ntp {
			min[i] = math.Max(0, totalPositive-float64(len(classes)-i))
			max[i] = math.Min(totalPositive, float64(i))
		}
		return min, ntp, max
	}

	cumw := max // Reuse max for cumulative weight. Update its elements last.
	for i := range ntp[1:] {
		ntp[i+1] = ntp[i]
		w := weights[len(weights)-i-1]
		cumw[i+1] = cumw[i] + w
		if classes[len(classes)-i-1] {
			ntp[i+1] += w
		}
	}
	totw := cumw[len(cumw)-1]
	totalPositive := ntp[len(ntp)-1]
	for i := range ntp {
		min[i] = math.Max(0, totalPositive-(totw-cumw[i]))
		max[i] = math.Min(totalPositive, cumw[i])
	}
	return min, ntp, max
}
