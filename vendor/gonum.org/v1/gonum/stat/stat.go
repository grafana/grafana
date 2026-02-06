// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package stat

import (
	"math"
	"sort"

	"gonum.org/v1/gonum/floats"
)

// CumulantKind specifies the behavior for calculating the empirical CDF or Quantile
type CumulantKind int

// List of supported CumulantKind values for the Quantile function.
// Constant values should match the R nomenclature. See
// https://en.wikipedia.org/wiki/Quantile#Estimating_the_quantiles_of_a_population
const (
	// Empirical treats the distribution as the actual empirical distribution.
	Empirical CumulantKind = 1
	// LinInterp linearly interpolates the empirical distribution between sample values, with a flat extrapolation.
	LinInterp CumulantKind = 4
)

// bhattacharyyaCoeff computes the Bhattacharyya Coefficient for probability distributions given by:
//
//	\sum_i \sqrt{p_i q_i}
//
// It is assumed that p and q have equal length.
func bhattacharyyaCoeff(p, q []float64) float64 {
	var bc float64
	for i, a := range p {
		bc += math.Sqrt(a * q[i])
	}
	return bc
}

// Bhattacharyya computes the distance between the probability distributions p and q given by:
//
//	-\ln ( \sum_i \sqrt{p_i q_i} )
//
// The lengths of p and q must be equal. It is assumed that p and q sum to 1.
func Bhattacharyya(p, q []float64) float64 {
	if len(p) != len(q) {
		panic("stat: slice length mismatch")
	}
	bc := bhattacharyyaCoeff(p, q)
	return -math.Log(bc)
}

// CDF returns the empirical cumulative distribution function value of x, that is
// the fraction of the samples less than or equal to q. The
// exact behavior is determined by the CumulantKind. CDF is theoretically
// the inverse of the Quantile function, though it may not be the actual inverse
// for all values q and CumulantKinds.
//
// The x data must be sorted in increasing order. If weights is nil then all
// of the weights are 1. If weights is not nil, then len(x) must equal len(weights).
// CDF will panic if the length of x is zero.
//
// CumulantKind behaviors:
//   - Empirical: Returns the lowest fraction for which q is greater than or equal
//     to that fraction of samples
func CDF(q float64, c CumulantKind, x, weights []float64) float64 {
	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if floats.HasNaN(x) {
		return math.NaN()
	}
	if len(x) == 0 {
		panic("stat: zero length slice")
	}
	if !sort.Float64sAreSorted(x) {
		panic("x data are not sorted")
	}

	if q < x[0] {
		return 0
	}
	if q >= x[len(x)-1] {
		return 1
	}

	var sumWeights float64
	if weights == nil {
		sumWeights = float64(len(x))
	} else {
		sumWeights = floats.Sum(weights)
	}

	// Calculate the index
	switch c {
	case Empirical:
		// Find the smallest value that is greater than that percent of the samples
		var w float64
		for i, v := range x {
			if v > q {
				return w / sumWeights
			}
			if weights == nil {
				w++
			} else {
				w += weights[i]
			}
		}
		panic("impossible")
	default:
		panic("stat: bad cumulant kind")
	}
}

// ChiSquare computes the chi-square distance between the observed frequencies 'obs' and
// expected frequencies 'exp' given by:
//
//	\sum_i (obs_i-exp_i)^2 / exp_i
//
// The lengths of obs and exp must be equal.
func ChiSquare(obs, exp []float64) float64 {
	if len(obs) != len(exp) {
		panic("stat: slice length mismatch")
	}
	var result float64
	for i, a := range obs {
		b := exp[i]
		if a == 0 && b == 0 {
			continue
		}
		result += (a - b) * (a - b) / b
	}
	return result
}

// CircularMean returns the circular mean of the dataset.
//
//	atan2(\sum_i w_i * sin(alpha_i), \sum_i w_i * cos(alpha_i))
//
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func CircularMean(x, weights []float64) float64 {
	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}

	var aX, aY float64
	if weights != nil {
		for i, v := range x {
			aX += weights[i] * math.Cos(v)
			aY += weights[i] * math.Sin(v)
		}
	} else {
		for _, v := range x {
			aX += math.Cos(v)
			aY += math.Sin(v)
		}
	}

	return math.Atan2(aY, aX)
}

// Correlation returns the weighted correlation between the samples of x and y
// with the given means.
//
//	sum_i {w_i (x_i - meanX) * (y_i - meanY)} / (stdX * stdY)
//
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func Correlation(x, y, weights []float64) float64 {
	// This is a two-pass corrected implementation. It is an adaptation of the
	// algorithm used in the MeanVariance function, which applies a correction
	// to the typical two pass approach.

	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	xu := Mean(x, weights)
	yu := Mean(y, weights)
	var (
		sxx           float64
		syy           float64
		sxy           float64
		xcompensation float64
		ycompensation float64
	)
	if weights == nil {
		for i, xv := range x {
			yv := y[i]
			xd := xv - xu
			yd := yv - yu
			sxx += xd * xd
			syy += yd * yd
			sxy += xd * yd
			xcompensation += xd
			ycompensation += yd
		}
		// xcompensation and ycompensation are from Chan, et. al.
		// referenced in the MeanVariance function. They are analogous
		// to the second term in (1.7) in that paper.
		sxx -= xcompensation * xcompensation / float64(len(x))
		syy -= ycompensation * ycompensation / float64(len(x))

		return (sxy - xcompensation*ycompensation/float64(len(x))) / math.Sqrt(sxx*syy)

	}

	var sumWeights float64
	for i, xv := range x {
		w := weights[i]
		yv := y[i]
		xd := xv - xu
		wxd := w * xd
		yd := yv - yu
		wyd := w * yd
		sxx += wxd * xd
		syy += wyd * yd
		sxy += wxd * yd
		xcompensation += wxd
		ycompensation += wyd
		sumWeights += w
	}
	// xcompensation and ycompensation are from Chan, et. al.
	// referenced in the MeanVariance function. They are analogous
	// to the second term in (1.7) in that paper, except they use
	// the sumWeights instead of the sample count.
	sxx -= xcompensation * xcompensation / sumWeights
	syy -= ycompensation * ycompensation / sumWeights

	return (sxy - xcompensation*ycompensation/sumWeights) / math.Sqrt(sxx*syy)
}

// Kendall returns the weighted Tau-a Kendall correlation between the
// samples of x and y. The Kendall correlation measures the quantity of
// concordant and discordant pairs of numbers. If weights are specified then
// each pair is weighted by weights[i] * weights[j] and the final sum is
// normalized to stay between -1 and 1.
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func Kendall(x, y, weights []float64) float64 {
	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}

	var (
		cc float64 // number of concordant pairs
		dc float64 // number of discordant pairs
		n  = len(x)
	)

	if weights == nil {
		for i := 0; i < n; i++ {
			for j := i; j < n; j++ {
				if i == j {
					continue
				}
				if math.Signbit(x[j]-x[i]) == math.Signbit(y[j]-y[i]) {
					cc++
				} else {
					dc++
				}
			}
		}
		return (cc - dc) / float64(n*(n-1)/2)
	}

	var sumWeights float64

	for i := 0; i < n; i++ {
		for j := i; j < n; j++ {
			if i == j {
				continue
			}
			weight := weights[i] * weights[j]
			if math.Signbit(x[j]-x[i]) == math.Signbit(y[j]-y[i]) {
				cc += weight
			} else {
				dc += weight
			}
			sumWeights += weight
		}
	}
	return float64(cc-dc) / sumWeights
}

// Covariance returns the weighted covariance between the samples of x and y.
//
//	sum_i {w_i (x_i - meanX) * (y_i - meanY)} / (sum_j {w_j} - 1)
//
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func Covariance(x, y, weights []float64) float64 {
	// This is a two-pass corrected implementation. It is an adaptation of the
	// algorithm used in the MeanVariance function, which applies a correction
	// to the typical two pass approach.

	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	xu := Mean(x, weights)
	yu := Mean(y, weights)
	return covarianceMeans(x, y, weights, xu, yu)
}

// covarianceMeans returns the weighted covariance between x and y with the mean
// of x and y already specified. See the documentation of Covariance for more
// information.
func covarianceMeans(x, y, weights []float64, xu, yu float64) float64 {
	var (
		ss            float64
		xcompensation float64
		ycompensation float64
	)
	if weights == nil {
		for i, xv := range x {
			yv := y[i]
			xd := xv - xu
			yd := yv - yu
			ss += xd * yd
			xcompensation += xd
			ycompensation += yd
		}
		// xcompensation and ycompensation are from Chan, et. al.
		// referenced in the MeanVariance function. They are analogous
		// to the second term in (1.7) in that paper.
		return (ss - xcompensation*ycompensation/float64(len(x))) / float64(len(x)-1)
	}

	var sumWeights float64

	for i, xv := range x {
		w := weights[i]
		yv := y[i]
		wxd := w * (xv - xu)
		yd := (yv - yu)
		ss += wxd * yd
		xcompensation += wxd
		ycompensation += w * yd
		sumWeights += w
	}
	// xcompensation and ycompensation are from Chan, et. al.
	// referenced in the MeanVariance function. They are analogous
	// to the second term in (1.7) in that paper, except they use
	// the sumWeights instead of the sample count.
	return (ss - xcompensation*ycompensation/sumWeights) / (sumWeights - 1)
}

// CrossEntropy computes the cross-entropy between the two distributions specified
// in p and q.
func CrossEntropy(p, q []float64) float64 {
	if len(p) != len(q) {
		panic("stat: slice length mismatch")
	}
	var ce float64
	for i, v := range p {
		if v != 0 {
			ce -= v * math.Log(q[i])
		}
	}
	return ce
}

// Entropy computes the Shannon entropy of a distribution or the distance between
// two distributions. The natural logarithm is used.
//   - sum_i (p_i * log_e(p_i))
func Entropy(p []float64) float64 {
	var e float64
	for _, v := range p {
		if v != 0 { // Entropy needs 0 * log(0) == 0.
			e -= v * math.Log(v)
		}
	}
	return e
}

// ExKurtosis returns the population excess kurtosis of the sample.
// The kurtosis is defined by the 4th moment of the mean divided by the squared
// variance. The excess kurtosis subtracts 3.0 so that the excess kurtosis of
// the normal distribution is zero.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func ExKurtosis(x, weights []float64) float64 {
	mean, std := MeanStdDev(x, weights)
	if weights == nil {
		var e float64
		for _, v := range x {
			z := (v - mean) / std
			e += z * z * z * z
		}
		mul, offset := kurtosisCorrection(float64(len(x)))
		return e*mul - offset
	}

	var (
		e          float64
		sumWeights float64
	)
	for i, v := range x {
		z := (v - mean) / std
		e += weights[i] * z * z * z * z
		sumWeights += weights[i]
	}
	mul, offset := kurtosisCorrection(sumWeights)
	return e*mul - offset
}

// n is the number of samples
// see https://en.wikipedia.org/wiki/Kurtosis
func kurtosisCorrection(n float64) (mul, offset float64) {
	return ((n + 1) / (n - 1)) * (n / (n - 2)) * (1 / (n - 3)), 3 * ((n - 1) / (n - 2)) * ((n - 1) / (n - 3))
}

// GeometricMean returns the weighted geometric mean of the dataset
//
//	\prod_i {x_i ^ w_i}
//
// This only applies with positive x and positive weights. If weights is nil
// then all of the weights are 1. If weights is not nil, then len(x) must equal
// len(weights).
func GeometricMean(x, weights []float64) float64 {
	if weights == nil {
		var s float64
		for _, v := range x {
			s += math.Log(v)
		}
		s /= float64(len(x))
		return math.Exp(s)
	}
	if len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	var (
		s          float64
		sumWeights float64
	)
	for i, v := range x {
		s += weights[i] * math.Log(v)
		sumWeights += weights[i]
	}
	s /= sumWeights
	return math.Exp(s)
}

// HarmonicMean returns the weighted harmonic mean of the dataset
//
//	\sum_i {w_i} / ( sum_i {w_i / x_i} )
//
// This only applies with positive x and positive weights.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func HarmonicMean(x, weights []float64) float64 {
	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	// TODO(btracey): Fix this to make it more efficient and avoid allocation.

	// This can be numerically unstable (for example if x is very small).
	// W = \sum_i {w_i}
	// hm = exp(log(W) - log(\sum_i w_i / x_i))

	logs := make([]float64, len(x))
	var W float64
	for i := range x {
		if weights == nil {
			logs[i] = -math.Log(x[i])
			W++
			continue
		}
		logs[i] = math.Log(weights[i]) - math.Log(x[i])
		W += weights[i]
	}

	// Sum all of the logs
	v := floats.LogSumExp(logs) // This computes log(\sum_i { w_i / x_i}).
	return math.Exp(math.Log(W) - v)
}

// Hellinger computes the distance between the probability distributions p and q given by:
//
//	\sqrt{ 1 - \sum_i \sqrt{p_i q_i} }
//
// The lengths of p and q must be equal. It is assumed that p and q sum to 1.
func Hellinger(p, q []float64) float64 {
	if len(p) != len(q) {
		panic("stat: slice length mismatch")
	}
	bc := bhattacharyyaCoeff(p, q)
	return math.Sqrt(1 - bc)
}

// Histogram sums up the weighted number of data points in each bin.
// The weight of data point x[i] will be placed into count[j] if
// dividers[j] <= x < dividers[j+1]. The "span" function in the floats package can assist
// with bin creation.
//
// The following conditions on the inputs apply:
//   - The count variable must either be nil or have length of one less than dividers.
//   - The values in dividers must be sorted (use the sort package).
//   - The x values must be sorted.
//   - If weights is nil then all of the weights are 1.
//   - If weights is not nil, then len(x) must equal len(weights).
func Histogram(count, dividers, x, weights []float64) []float64 {
	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if count == nil {
		count = make([]float64, len(dividers)-1)
	}
	if len(dividers) < 2 {
		panic("histogram: fewer than two dividers")
	}
	if len(count) != len(dividers)-1 {
		panic("histogram: bin count mismatch")
	}
	if !sort.Float64sAreSorted(dividers) {
		panic("histogram: dividers are not sorted")
	}
	if !sort.Float64sAreSorted(x) {
		panic("histogram: x data are not sorted")
	}
	for i := range count {
		count[i] = 0
	}
	if len(x) == 0 {
		return count
	}
	if x[0] < dividers[0] {
		panic("histogram: minimum x value is less than lowest divider")
	}
	if dividers[len(dividers)-1] <= x[len(x)-1] {
		panic("histogram: maximum x value is greater than or equal to highest divider")
	}

	idx := 0
	comp := dividers[idx+1]
	if weights == nil {
		for _, v := range x {
			if v < comp {
				// Still in the current bucket.
				count[idx]++
				continue
			}
			// Find the next divider where v is less than the divider.
			for j := idx + 1; j < len(dividers); j++ {
				if v < dividers[j+1] {
					idx = j
					comp = dividers[j+1]
					break
				}
			}
			count[idx]++
		}
		return count
	}

	for i, v := range x {
		if v < comp {
			// Still in the current bucket.
			count[idx] += weights[i]
			continue
		}
		// Need to find the next divider where v is less than the divider.
		for j := idx + 1; j < len(count); j++ {
			if v < dividers[j+1] {
				idx = j
				comp = dividers[j+1]
				break
			}
		}
		count[idx] += weights[i]
	}
	return count
}

// JensenShannon computes the JensenShannon divergence between the distributions
// p and q. The Jensen-Shannon divergence is defined as
//
//	m = 0.5 * (p + q)
//	JS(p, q) = 0.5 ( KL(p, m) + KL(q, m) )
//
// Unlike Kullback-Leibler, the Jensen-Shannon distance is symmetric. The value
// is between 0 and ln(2).
func JensenShannon(p, q []float64) float64 {
	if len(p) != len(q) {
		panic("stat: slice length mismatch")
	}
	var js float64
	for i, v := range p {
		qi := q[i]
		m := 0.5 * (v + qi)
		if v != 0 {
			// add kl from p to m
			js += 0.5 * v * (math.Log(v) - math.Log(m))
		}
		if qi != 0 {
			// add kl from q to m
			js += 0.5 * qi * (math.Log(qi) - math.Log(m))
		}
	}
	return js
}

// KolmogorovSmirnov computes the largest distance between two empirical CDFs.
// Each dataset x and y consists of sample locations and counts, xWeights and
// yWeights, respectively.
//
// x and y may have different lengths, though len(x) must equal len(xWeights), and
// len(y) must equal len(yWeights). Both x and y must be sorted.
//
// Special cases are:
//
//	= 0 if len(x) == len(y) == 0
//	= 1 if len(x) == 0, len(y) != 0 or len(x) != 0 and len(y) == 0
func KolmogorovSmirnov(x, xWeights, y, yWeights []float64) float64 {
	if xWeights != nil && len(x) != len(xWeights) {
		panic("stat: slice length mismatch")
	}
	if yWeights != nil && len(y) != len(yWeights) {
		panic("stat: slice length mismatch")
	}
	if len(x) == 0 || len(y) == 0 {
		if len(x) == 0 && len(y) == 0 {
			return 0
		}
		return 1
	}

	if floats.HasNaN(x) {
		return math.NaN()
	}
	if floats.HasNaN(y) {
		return math.NaN()
	}

	if !sort.Float64sAreSorted(x) {
		panic("x data are not sorted")
	}
	if !sort.Float64sAreSorted(y) {
		panic("y data are not sorted")
	}

	xWeightsNil := xWeights == nil
	yWeightsNil := yWeights == nil

	var (
		maxDist    float64
		xSum, ySum float64
		xCdf, yCdf float64
		xIdx, yIdx int
	)

	if xWeightsNil {
		xSum = float64(len(x))
	} else {
		xSum = floats.Sum(xWeights)
	}

	if yWeightsNil {
		ySum = float64(len(y))
	} else {
		ySum = floats.Sum(yWeights)
	}

	xVal := x[0]
	yVal := y[0]

	// Algorithm description:
	// The goal is to find the maximum difference in the empirical CDFs for the
	// two datasets. The CDFs are piecewise-constant, and thus the distance
	// between the CDFs will only change at the values themselves.
	//
	// To find the maximum distance, step through the data in ascending order
	// of value between the two datasets. At each step, compute the empirical CDF
	// and compare the local distance with the maximum distance.
	// Due to some corner cases, equal data entries must be tallied simultaneously.
	for {
		switch {
		case xVal < yVal:
			xVal, xCdf, xIdx = updateKS(xIdx, xCdf, xSum, x, xWeights, xWeightsNil)
		case yVal < xVal:
			yVal, yCdf, yIdx = updateKS(yIdx, yCdf, ySum, y, yWeights, yWeightsNil)
		case xVal == yVal:
			newX := x[xIdx]
			newY := y[yIdx]
			if newX < newY {
				xVal, xCdf, xIdx = updateKS(xIdx, xCdf, xSum, x, xWeights, xWeightsNil)
			} else if newY < newX {
				yVal, yCdf, yIdx = updateKS(yIdx, yCdf, ySum, y, yWeights, yWeightsNil)
			} else {
				// Update them both, they'll be equal next time and the right
				// thing will happen.
				xVal, xCdf, xIdx = updateKS(xIdx, xCdf, xSum, x, xWeights, xWeightsNil)
				yVal, yCdf, yIdx = updateKS(yIdx, yCdf, ySum, y, yWeights, yWeightsNil)
			}
		default:
			panic("unreachable")
		}

		dist := math.Abs(xCdf - yCdf)
		if dist > maxDist {
			maxDist = dist
		}

		// Both xCdf and yCdf will equal 1 at the end, so if we have reached the
		// end of either sample list, the distance is as large as it can be.
		if xIdx == len(x) || yIdx == len(y) {
			return maxDist
		}
	}
}

// updateKS gets the next data point from one of the set. In doing so, it combines
// the weight of all the data points of equal value. Upon return, val is the new
// value of the data set, newCdf is the total combined CDF up until this point,
// and newIdx is the index of the next location in that sample to examine.
func updateKS(idx int, cdf, sum float64, values, weights []float64, isNil bool) (val, newCdf float64, newIdx int) {
	// Sum up all the weights of consecutive values that are equal.
	if isNil {
		newCdf = cdf + 1/sum
	} else {
		newCdf = cdf + weights[idx]/sum
	}
	newIdx = idx + 1
	for {
		if newIdx == len(values) {
			return values[newIdx-1], newCdf, newIdx
		}
		if values[newIdx-1] != values[newIdx] {
			return values[newIdx], newCdf, newIdx
		}
		if isNil {
			newCdf += 1 / sum
		} else {
			newCdf += weights[newIdx] / sum
		}
		newIdx++
	}
}

// KullbackLeibler computes the Kullback-Leibler distance between the
// distributions p and q. The natural logarithm is used.
//
//	sum_i(p_i * log(p_i / q_i))
//
// Note that the Kullback-Leibler distance is not symmetric;
// KullbackLeibler(p,q) != KullbackLeibler(q,p)
func KullbackLeibler(p, q []float64) float64 {
	if len(p) != len(q) {
		panic("stat: slice length mismatch")
	}
	var kl float64
	for i, v := range p {
		if v != 0 { // Entropy needs 0 * log(0) == 0.
			kl += v * (math.Log(v) - math.Log(q[i]))
		}
	}
	return kl
}

// LinearRegression computes the best-fit line
//
//	y = alpha + beta*x
//
// to the data in x and y with the given weights. If origin is true, the
// regression is forced to pass through the origin.
//
// Specifically, LinearRegression computes the values of alpha and
// beta such that the total residual
//
//	\sum_i w[i]*(y[i] - alpha - beta*x[i])^2
//
// is minimized. If origin is true, then alpha is forced to be zero.
//
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func LinearRegression(x, y, weights []float64, origin bool) (alpha, beta float64) {
	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	if weights != nil && len(weights) != len(x) {
		panic("stat: slice length mismatch")
	}

	w := 1.0
	if origin {
		var x2Sum, xySum float64
		for i, xi := range x {
			if weights != nil {
				w = weights[i]
			}
			yi := y[i]
			xySum += w * xi * yi
			x2Sum += w * xi * xi
		}
		beta = xySum / x2Sum

		return 0, beta
	}

	xu, xv := MeanVariance(x, weights)
	yu := Mean(y, weights)
	cov := covarianceMeans(x, y, weights, xu, yu)
	beta = cov / xv
	alpha = yu - beta*xu
	return alpha, beta
}

// RSquared returns the coefficient of determination defined as
//
//	R^2 = 1 - \sum_i w[i]*(y[i] - alpha - beta*x[i])^2 / \sum_i w[i]*(y[i] - mean(y))^2
//
// for the line
//
//	y = alpha + beta*x
//
// and the data in x and y with the given weights.
//
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func RSquared(x, y, weights []float64, alpha, beta float64) float64 {
	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	if weights != nil && len(weights) != len(x) {
		panic("stat: slice length mismatch")
	}

	w := 1.0
	yMean := Mean(y, weights)
	var res, tot, d float64
	for i, xi := range x {
		if weights != nil {
			w = weights[i]
		}
		yi := y[i]
		fi := alpha + beta*xi
		d = yi - fi
		res += w * d * d
		d = yi - yMean
		tot += w * d * d
	}
	return 1 - res/tot
}

// RSquaredFrom returns the coefficient of determination defined as
//
//	R^2 = 1 - \sum_i w[i]*(estimate[i] - value[i])^2 / \sum_i w[i]*(value[i] - mean(values))^2
//
// and the data in estimates and values with the given weights.
//
// The lengths of estimates and values must be equal. If weights is nil then
// all of the weights are 1. If weights is not nil, then len(values) must
// equal len(weights).
func RSquaredFrom(estimates, values, weights []float64) float64 {
	if len(estimates) != len(values) {
		panic("stat: slice length mismatch")
	}
	if weights != nil && len(weights) != len(values) {
		panic("stat: slice length mismatch")
	}

	w := 1.0
	mean := Mean(values, weights)
	var res, tot, d float64
	for i, val := range values {
		if weights != nil {
			w = weights[i]
		}
		d = val - estimates[i]
		res += w * d * d
		d = val - mean
		tot += w * d * d
	}
	return 1 - res/tot
}

// RNoughtSquared returns the coefficient of determination defined as
//
//	R₀^2 = \sum_i w[i]*(beta*x[i])^2 / \sum_i w[i]*y[i]^2
//
// for the line
//
//	y = beta*x
//
// and the data in x and y with the given weights. RNoughtSquared should
// only be used for best-fit lines regressed through the origin.
//
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func RNoughtSquared(x, y, weights []float64, beta float64) float64 {
	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	if weights != nil && len(weights) != len(x) {
		panic("stat: slice length mismatch")
	}

	w := 1.0
	var ssr, tot float64
	for i, xi := range x {
		if weights != nil {
			w = weights[i]
		}
		fi := beta * xi
		ssr += w * fi * fi
		yi := y[i]
		tot += w * yi * yi
	}
	return ssr / tot
}

// Mean computes the weighted mean of the data set.
//
//	sum_i {w_i * x_i} / sum_i {w_i}
//
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func Mean(x, weights []float64) float64 {
	if weights == nil {
		return floats.Sum(x) / float64(len(x))
	}
	if len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	var (
		sumValues  float64
		sumWeights float64
	)
	for i, w := range weights {
		sumValues += w * x[i]
		sumWeights += w
	}
	return sumValues / sumWeights
}

// Mode returns the most common value in the dataset specified by x and the
// given weights. Strict float64 equality is used when comparing values, so users
// should take caution. If several values are the mode, any of them may be returned.
func Mode(x, weights []float64) (val float64, count float64) {
	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if len(x) == 0 {
		return 0, 0
	}
	m := make(map[float64]float64)
	if weights == nil {
		for _, v := range x {
			m[v]++
		}
	} else {
		for i, v := range x {
			m[v] += weights[i]
		}
	}
	var (
		maxCount float64
		max      float64
	)
	for val, count := range m {
		if count > maxCount {
			maxCount = count
			max = val
		}
	}
	return max, maxCount
}

// BivariateMoment computes the weighted mixed moment between the samples x and y.
//
//	E[(x - μ_x)^r*(y - μ_y)^s]
//
// No degrees of freedom correction is done.
// The lengths of x and y must be equal. If weights is nil then all of the
// weights are 1. If weights is not nil, then len(x) must equal len(weights).
func BivariateMoment(r, s float64, x, y, weights []float64) float64 {
	meanX := Mean(x, weights)
	meanY := Mean(y, weights)
	if len(x) != len(y) {
		panic("stat: slice length mismatch")
	}
	if weights == nil {
		var m float64
		for i, vx := range x {
			vy := y[i]
			m += math.Pow(vx-meanX, r) * math.Pow(vy-meanY, s)
		}
		return m / float64(len(x))
	}
	if len(weights) != len(x) {
		panic("stat: slice length mismatch")
	}
	var (
		m          float64
		sumWeights float64
	)
	for i, vx := range x {
		vy := y[i]
		w := weights[i]
		m += w * math.Pow(vx-meanX, r) * math.Pow(vy-meanY, s)
		sumWeights += w
	}
	return m / sumWeights
}

// Moment computes the weighted n^th moment of the samples,
//
//	E[(x - μ)^N]
//
// No degrees of freedom correction is done.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func Moment(moment float64, x, weights []float64) float64 {
	// This also checks that x and weights have the same length.
	mean := Mean(x, weights)
	if weights == nil {
		var m float64
		for _, v := range x {
			m += math.Pow(v-mean, moment)
		}
		return m / float64(len(x))
	}
	var (
		m          float64
		sumWeights float64
	)
	for i, v := range x {
		w := weights[i]
		m += w * math.Pow(v-mean, moment)
		sumWeights += w
	}
	return m / sumWeights
}

// MomentAbout computes the weighted n^th weighted moment of the samples about
// the given mean \mu,
//
//	E[(x - μ)^N]
//
// No degrees of freedom correction is done.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func MomentAbout(moment float64, x []float64, mean float64, weights []float64) float64 {
	if weights == nil {
		var m float64
		for _, v := range x {
			m += math.Pow(v-mean, moment)
		}
		m /= float64(len(x))
		return m
	}
	if len(weights) != len(x) {
		panic("stat: slice length mismatch")
	}
	var (
		m          float64
		sumWeights float64
	)
	for i, v := range x {
		m += weights[i] * math.Pow(v-mean, moment)
		sumWeights += weights[i]
	}
	return m / sumWeights
}

// Quantile returns the sample of x such that x is greater than or
// equal to the fraction p of samples. The exact behavior is determined by the
// CumulantKind, and p should be a number between 0 and 1. Quantile is theoretically
// the inverse of the CDF function, though it may not be the actual inverse
// for all values p and CumulantKinds.
//
// The x data must be sorted in increasing order. If weights is nil then all
// of the weights are 1. If weights is not nil, then len(x) must equal len(weights).
// Quantile will panic if the length of x is zero.
//
// CumulantKind behaviors:
//   - Empirical: Returns the lowest value q for which q is greater than or equal
//     to the fraction p of samples
//   - LinInterp: Returns the linearly interpolated value
func Quantile(p float64, c CumulantKind, x, weights []float64) float64 {
	if !(p >= 0 && p <= 1) {
		panic("stat: percentile out of bounds")
	}

	if weights != nil && len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	if len(x) == 0 {
		panic("stat: zero length slice")
	}
	if floats.HasNaN(x) {
		return math.NaN() // This is needed because the algorithm breaks otherwise.
	}
	if !sort.Float64sAreSorted(x) {
		panic("x data are not sorted")
	}

	var sumWeights float64
	if weights == nil {
		sumWeights = float64(len(x))
	} else {
		sumWeights = floats.Sum(weights)
	}
	switch c {
	case Empirical:
		return empiricalQuantile(p, x, weights, sumWeights)
	case LinInterp:
		return linInterpQuantile(p, x, weights, sumWeights)
	default:
		panic("stat: bad cumulant kind")
	}
}

func empiricalQuantile(p float64, x, weights []float64, sumWeights float64) float64 {
	var cumsum float64
	fidx := p * sumWeights
	for i := range x {
		if weights == nil {
			cumsum++
		} else {
			cumsum += weights[i]
		}
		if cumsum >= fidx {
			return x[i]
		}
	}
	panic("impossible")
}

func linInterpQuantile(p float64, x, weights []float64, sumWeights float64) float64 {
	var cumsum float64
	fidx := p * sumWeights
	for i := range x {
		if weights == nil {
			cumsum++
		} else {
			cumsum += weights[i]
		}
		if cumsum >= fidx {
			if i == 0 {
				return x[0]
			}
			t := cumsum - fidx
			if weights != nil {
				t /= weights[i]
			}
			return t*x[i-1] + (1-t)*x[i]
		}
	}
	panic("impossible")
}

// Skew computes the skewness of the sample data.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
// When weights sum to 1 or less, a biased variance estimator should be used.
func Skew(x, weights []float64) float64 {

	mean, std := MeanStdDev(x, weights)
	if weights == nil {
		var s float64
		for _, v := range x {
			z := (v - mean) / std
			s += z * z * z
		}
		return s * skewCorrection(float64(len(x)))
	}
	var (
		s          float64
		sumWeights float64
	)
	for i, v := range x {
		z := (v - mean) / std
		s += weights[i] * z * z * z
		sumWeights += weights[i]
	}
	return s * skewCorrection(sumWeights)
}

// From: http://www.amstat.org/publications/jse/v19n2/doane.pdf page 7
func skewCorrection(n float64) float64 {
	return (n / (n - 1)) * (1 / (n - 2))
}

// SortWeighted rearranges the data in x along with their corresponding
// weights so that the x data are sorted. The data is sorted in place.
// Weights may be nil, but if weights is non-nil then it must have the same
// length as x.
func SortWeighted(x, weights []float64) {
	if weights == nil {
		sort.Float64s(x)
		return
	}
	if len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	sort.Sort(weightSorter{
		x: x,
		w: weights,
	})
}

type weightSorter struct {
	x []float64
	w []float64
}

func (w weightSorter) Len() int           { return len(w.x) }
func (w weightSorter) Less(i, j int) bool { return w.x[i] < w.x[j] }
func (w weightSorter) Swap(i, j int) {
	w.x[i], w.x[j] = w.x[j], w.x[i]
	w.w[i], w.w[j] = w.w[j], w.w[i]
}

// SortWeightedLabeled rearranges the data in x along with their
// corresponding weights and boolean labels so that the x data are sorted.
// The data is sorted in place. Weights and labels may be nil, if either
// is non-nil it must have the same length as x.
func SortWeightedLabeled(x []float64, labels []bool, weights []float64) {
	if labels == nil {
		SortWeighted(x, weights)
		return
	}
	if weights == nil {
		if len(x) != len(labels) {
			panic("stat: slice length mismatch")
		}
		sort.Sort(labelSorter{
			x: x,
			l: labels,
		})
		return
	}
	if len(x) != len(labels) || len(x) != len(weights) {
		panic("stat: slice length mismatch")
	}
	sort.Sort(weightLabelSorter{
		x: x,
		l: labels,
		w: weights,
	})
}

type labelSorter struct {
	x []float64
	l []bool
}

func (a labelSorter) Len() int           { return len(a.x) }
func (a labelSorter) Less(i, j int) bool { return a.x[i] < a.x[j] }
func (a labelSorter) Swap(i, j int) {
	a.x[i], a.x[j] = a.x[j], a.x[i]
	a.l[i], a.l[j] = a.l[j], a.l[i]
}

type weightLabelSorter struct {
	x []float64
	l []bool
	w []float64
}

func (a weightLabelSorter) Len() int           { return len(a.x) }
func (a weightLabelSorter) Less(i, j int) bool { return a.x[i] < a.x[j] }
func (a weightLabelSorter) Swap(i, j int) {
	a.x[i], a.x[j] = a.x[j], a.x[i]
	a.l[i], a.l[j] = a.l[j], a.l[i]
	a.w[i], a.w[j] = a.w[j], a.w[i]
}

// StdDev returns the sample standard deviation.
func StdDev(x, weights []float64) float64 {
	_, std := MeanStdDev(x, weights)
	return std
}

// MeanStdDev returns the sample mean and unbiased standard deviation
// When weights sum to 1 or less, a biased variance estimator should be used.
func MeanStdDev(x, weights []float64) (mean, std float64) {
	mean, variance := MeanVariance(x, weights)
	return mean, math.Sqrt(variance)
}

// StdErr returns the standard error in the mean with the given values.
func StdErr(std, sampleSize float64) float64 {
	return std / math.Sqrt(sampleSize)
}

// StdScore returns the standard score (a.k.a. z-score, z-value) for the value x
// with the given mean and standard deviation, i.e.
//
//	(x - mean) / std
func StdScore(x, mean, std float64) float64 {
	return (x - mean) / std
}

// Variance computes the unbiased weighted sample variance:
//
//	\sum_i w_i (x_i - mean)^2 / (sum_i w_i - 1)
//
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
// When weights sum to 1 or less, a biased variance estimator should be used.
func Variance(x, weights []float64) float64 {
	_, variance := MeanVariance(x, weights)
	return variance
}

// MeanVariance computes the sample mean and unbiased variance, where the mean and variance are
//
//	\sum_i w_i * x_i / (sum_i w_i)
//	\sum_i w_i (x_i - mean)^2 / (sum_i w_i - 1)
//
// respectively.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
// When weights sum to 1 or less, a biased variance estimator should be used.
func MeanVariance(x, weights []float64) (mean, variance float64) {
	var (
		unnormalisedVariance float64
		sumWeights           float64
	)
	mean, unnormalisedVariance, sumWeights = meanUnnormalisedVarianceSumWeights(x, weights)
	return mean, unnormalisedVariance / (sumWeights - 1)
}

// PopMeanVariance computes the sample mean and biased variance (also known as
// "population variance"), where the mean and variance are
//
//	\sum_i w_i * x_i / (sum_i w_i)
//	\sum_i w_i (x_i - mean)^2 / (sum_i w_i)
//
// respectively.
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func PopMeanVariance(x, weights []float64) (mean, variance float64) {
	var (
		unnormalisedVariance float64
		sumWeights           float64
	)
	mean, unnormalisedVariance, sumWeights = meanUnnormalisedVarianceSumWeights(x, weights)
	return mean, unnormalisedVariance / sumWeights
}

// PopMeanStdDev returns the sample mean and biased standard deviation
// (also known as "population standard deviation").
func PopMeanStdDev(x, weights []float64) (mean, std float64) {
	mean, variance := PopMeanVariance(x, weights)
	return mean, math.Sqrt(variance)
}

// PopStdDev returns the population standard deviation, i.e., a square root
// of the biased variance estimate.
func PopStdDev(x, weights []float64) float64 {
	_, stDev := PopMeanStdDev(x, weights)
	return stDev
}

// PopVariance computes the unbiased weighted sample variance:
//
//	\sum_i w_i (x_i - mean)^2 / (sum_i w_i)
//
// If weights is nil then all of the weights are 1. If weights is not nil, then
// len(x) must equal len(weights).
func PopVariance(x, weights []float64) float64 {
	_, variance := PopMeanVariance(x, weights)
	return variance
}

func meanUnnormalisedVarianceSumWeights(x, weights []float64) (mean, unnormalisedVariance, sumWeights float64) {
	// This uses the corrected two-pass algorithm (1.7), from "Algorithms for computing
	// the sample variance: Analysis and recommendations" by Chan, Tony F., Gene H. Golub,
	// and Randall J. LeVeque.

	// Note that this will panic if the slice lengths do not match.
	mean = Mean(x, weights)
	var (
		ss           float64
		compensation float64
	)
	if weights == nil {
		for _, v := range x {
			d := v - mean
			ss += d * d
			compensation += d
		}
		unnormalisedVariance = (ss - compensation*compensation/float64(len(x)))
		return mean, unnormalisedVariance, float64(len(x))
	}

	for i, v := range x {
		w := weights[i]
		d := v - mean
		wd := w * d
		ss += wd * d
		compensation += wd
		sumWeights += w
	}
	unnormalisedVariance = (ss - compensation*compensation/sumWeights)
	return mean, unnormalisedVariance, sumWeights
}
