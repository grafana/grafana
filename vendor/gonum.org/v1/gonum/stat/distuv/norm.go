// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/mathext"
	"gonum.org/v1/gonum/stat"
)

// UnitNormal is an instantiation of the normal distribution with Mu = 0 and Sigma = 1.
var UnitNormal = Normal{Mu: 0, Sigma: 1}

// Normal represents a normal (Gaussian) distribution (https://en.wikipedia.org/wiki/Normal_distribution).
type Normal struct {
	Mu    float64 // Mean of the normal distribution
	Sigma float64 // Standard deviation of the normal distribution
	Src   rand.Source

	// Needs to be Mu and Sigma and not Mean and StdDev because Normal has functions
	// Mean and StdDev
}

// CDF computes the value of the cumulative density function at x.
func (n Normal) CDF(x float64) float64 {
	return 0.5 * math.Erfc(-(x-n.Mu)/(n.Sigma*math.Sqrt2))
}

// ConjugateUpdate updates the parameters of the distribution from the sufficient
// statistics of a set of samples. The sufficient statistics, suffStat, have been
// observed with nSamples observations. The prior values of the distribution are those
// currently in the distribution, and have been observed with priorStrength samples.
//
// For the normal distribution, the sufficient statistics are the mean and
// uncorrected standard deviation of the samples.
// The prior is having seen strength[0] samples with mean Normal.Mu
// and strength[1] samples with standard deviation Normal.Sigma. As a result of
// this function, Normal.Mu and Normal.Sigma are updated based on the weighted
// samples, and strength is modified to include the new number of samples observed.
//
// This function panics if len(suffStat) != n.NumSuffStat() or
// len(priorStrength) != n.NumSuffStat().
func (n *Normal) ConjugateUpdate(suffStat []float64, nSamples float64, priorStrength []float64) {
	// TODO: Support prior strength with math.Inf(1) to allow updating with
	// a known mean/standard deviation
	if len(suffStat) != n.NumSuffStat() {
		panic("norm: incorrect suffStat length")
	}
	if len(priorStrength) != n.NumSuffStat() {
		panic("norm: incorrect priorStrength length")
	}

	totalMeanSamples := nSamples + priorStrength[0]
	totalSum := suffStat[0]*nSamples + n.Mu*priorStrength[0]

	totalVarianceSamples := nSamples + priorStrength[1]
	// sample variance
	totalVariance := nSamples * suffStat[1] * suffStat[1]
	// add prior variance
	totalVariance += priorStrength[1] * n.Sigma * n.Sigma
	// add cross variance from the difference of the means
	meanDiff := (suffStat[0] - n.Mu)
	totalVariance += priorStrength[0] * nSamples * meanDiff * meanDiff / totalMeanSamples

	n.Mu = totalSum / totalMeanSamples
	n.Sigma = math.Sqrt(totalVariance / totalVarianceSamples)
	floats.AddConst(nSamples, priorStrength)
}

// Entropy returns the differential entropy of the distribution.
func (n Normal) Entropy() float64 {
	return 0.5 * (log2Pi + 1 + 2*math.Log(n.Sigma))
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (Normal) ExKurtosis() float64 {
	return 0
}

// Fit sets the parameters of the probability distribution from the
// data samples x with relative weights w. If weights is nil, then all the weights
// are 1. If weights is not nil, then the len(weights) must equal len(samples).
func (n *Normal) Fit(samples, weights []float64) {
	suffStat := make([]float64, n.NumSuffStat())
	nSamples := n.SuffStat(suffStat, samples, weights)
	n.ConjugateUpdate(suffStat, nSamples, make([]float64, n.NumSuffStat()))
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (n Normal) LogProb(x float64) float64 {
	return negLogRoot2Pi - math.Log(n.Sigma) - (x-n.Mu)*(x-n.Mu)/(2*n.Sigma*n.Sigma)
}

// Mean returns the mean of the probability distribution.
func (n Normal) Mean() float64 {
	return n.Mu
}

// Median returns the median of the normal distribution.
func (n Normal) Median() float64 {
	return n.Mu
}

// Mode returns the mode of the normal distribution.
func (n Normal) Mode() float64 {
	return n.Mu
}

// NumParameters returns the number of parameters in the distribution.
func (Normal) NumParameters() int {
	return 2
}

// NumSuffStat returns the number of sufficient statistics for the distribution.
func (Normal) NumSuffStat() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (n Normal) Prob(x float64) float64 {
	return math.Exp(n.LogProb(x))
}

// Quantile returns the inverse of the cumulative probability distribution.
func (n Normal) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	return n.Mu + n.Sigma*mathext.NormalQuantile(p)
}

// Rand returns a random sample drawn from the distribution.
func (n Normal) Rand() float64 {
	var rnd float64
	if n.Src == nil {
		rnd = rand.NormFloat64()
	} else {
		rnd = rand.New(n.Src).NormFloat64()
	}
	return rnd*n.Sigma + n.Mu
}

// Score returns the score function with respect to the parameters of the
// distribution at the input location x. The score function is the derivative
// of the log-likelihood at x with respect to the parameters
//
//	(∂/∂θ) log(p(x;θ))
//
// If deriv is non-nil, len(deriv) must equal the number of parameters otherwise
// Score will panic, and the derivative is stored in-place into deriv. If deriv
// is nil a new slice will be allocated and returned.
//
// The order is [∂LogProb / ∂Mu, ∂LogProb / ∂Sigma].
//
// For more information, see https://en.wikipedia.org/wiki/Score_%28statistics%29.
func (n Normal) Score(deriv []float64, x float64) []float64 {
	if deriv == nil {
		deriv = make([]float64, n.NumParameters())
	}
	if len(deriv) != n.NumParameters() {
		panic(badLength)
	}
	deriv[0] = (x - n.Mu) / (n.Sigma * n.Sigma)
	deriv[1] = 1 / n.Sigma * (-1 + ((x-n.Mu)/n.Sigma)*((x-n.Mu)/n.Sigma))
	return deriv
}

// ScoreInput returns the score function with respect to the input of the
// distribution at the input location specified by x. The score function is the
// derivative of the log-likelihood
//
//	(d/dx) log(p(x)) .
func (n Normal) ScoreInput(x float64) float64 {
	return -(1 / (2 * n.Sigma * n.Sigma)) * 2 * (x - n.Mu)
}

// Skewness returns the skewness of the distribution.
func (Normal) Skewness() float64 {
	return 0
}

// StdDev returns the standard deviation of the probability distribution.
func (n Normal) StdDev() float64 {
	return n.Sigma
}

// SuffStat computes the sufficient statistics of a set of samples to update
// the distribution. The sufficient statistics are stored in place, and the
// effective number of samples are returned.
//
// The normal distribution has two sufficient statistics, the mean of the samples
// and the standard deviation of the samples.
//
// If weights is nil, the weights are assumed to be 1, otherwise panics if
// len(samples) != len(weights). Panics if len(suffStat) != NumSuffStat().
func (Normal) SuffStat(suffStat, samples, weights []float64) (nSamples float64) {
	lenSamp := len(samples)
	if len(weights) != 0 && len(samples) != len(weights) {
		panic(badLength)
	}
	if len(suffStat) != (Normal{}).NumSuffStat() {
		panic(badSuffStat)
	}

	if len(weights) == 0 {
		nSamples = float64(lenSamp)
	} else {
		nSamples = floats.Sum(weights)
	}

	mean := stat.Mean(samples, weights)
	suffStat[0] = mean

	// Use Moment and not StdDev because we want it to be uncorrected
	variance := stat.MomentAbout(2, samples, mean, weights)
	suffStat[1] = math.Sqrt(variance)
	return nSamples
}

// Survival returns the survival function (complementary CDF) at x.
func (n Normal) Survival(x float64) float64 {
	return 0.5 * (1 - math.Erf((x-n.Mu)/(n.Sigma*math.Sqrt2)))
}

// setParameters modifies the parameters of the distribution.
func (n *Normal) setParameters(p []Parameter) {
	if len(p) != n.NumParameters() {
		panic("normal: incorrect number of parameters to set")
	}
	if p[0].Name != "Mu" {
		panic("normal: " + panicNameMismatch)
	}
	if p[1].Name != "Sigma" {
		panic("normal: " + panicNameMismatch)
	}
	n.Mu = p[0].Value
	n.Sigma = p[1].Value
}

// Variance returns the variance of the probability distribution.
func (n Normal) Variance() float64 {
	return n.Sigma * n.Sigma
}

// parameters returns the parameters of the distribution.
func (n Normal) parameters(p []Parameter) []Parameter {
	nParam := n.NumParameters()
	if p == nil {
		p = make([]Parameter, nParam)
	} else if len(p) != nParam {
		panic("normal: improper parameter length")
	}
	p[0].Name = "Mu"
	p[0].Value = n.Mu
	p[1].Name = "Sigma"
	p[1].Value = n.Sigma
	return p
}
