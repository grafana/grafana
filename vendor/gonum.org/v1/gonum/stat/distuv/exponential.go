// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/stat"
)

// Exponential represents the exponential distribution (https://en.wikipedia.org/wiki/Exponential_distribution).
type Exponential struct {
	Rate float64
	Src  rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (e Exponential) CDF(x float64) float64 {
	if x < 0 {
		return 0
	}
	return -math.Expm1(-e.Rate * x)
}

// ConjugateUpdate updates the parameters of the distribution from the sufficient
// statistics of a set of samples. The sufficient statistics, suffStat, have been
// observed with nSamples observations. The prior values of the distribution are those
// currently in the distribution, and have been observed with priorStrength samples.
//
// For the exponential distribution, the sufficient statistic is the inverse of
// the mean of the samples.
// The prior is having seen priorStrength[0] samples with inverse mean Exponential.Rate
// As a result of this function, Exponential.Rate is updated based on the weighted
// samples, and priorStrength is modified to include the new number of samples observed.
//
// This function panics if len(suffStat) != e.NumSuffStat() or
// len(priorStrength) != e.NumSuffStat().
func (e *Exponential) ConjugateUpdate(suffStat []float64, nSamples float64, priorStrength []float64) {
	if len(suffStat) != e.NumSuffStat() {
		panic("exponential: incorrect suffStat length")
	}
	if len(priorStrength) != e.NumSuffStat() {
		panic("exponential: incorrect priorStrength length")
	}

	totalSamples := nSamples + priorStrength[0]

	totalSum := nSamples / suffStat[0]
	if !(priorStrength[0] == 0) {
		totalSum += priorStrength[0] / e.Rate
	}
	e.Rate = totalSamples / totalSum
	priorStrength[0] = totalSamples
}

// Entropy returns the entropy of the distribution.
func (e Exponential) Entropy() float64 {
	return 1 - math.Log(e.Rate)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (Exponential) ExKurtosis() float64 {
	return 6
}

// Fit sets the parameters of the probability distribution from the
// data samples x with relative weights w.
// If weights is nil, then all the weights are 1.
// If weights is not nil, then the len(weights) must equal len(samples).
func (e *Exponential) Fit(samples, weights []float64) {
	suffStat := make([]float64, e.NumSuffStat())
	nSamples := e.SuffStat(suffStat, samples, weights)
	e.ConjugateUpdate(suffStat, nSamples, make([]float64, e.NumSuffStat()))
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (e Exponential) LogProb(x float64) float64 {
	if x < 0 {
		return math.Inf(-1)
	}
	return math.Log(e.Rate) - e.Rate*x
}

// Mean returns the mean of the probability distribution.
func (e Exponential) Mean() float64 {
	return 1 / e.Rate
}

// Median returns the median of the probability distribution.
func (e Exponential) Median() float64 {
	return math.Ln2 / e.Rate
}

// Mode returns the mode of the probability distribution.
func (Exponential) Mode() float64 {
	return 0
}

// NumParameters returns the number of parameters in the distribution.
func (Exponential) NumParameters() int {
	return 1
}

// NumSuffStat returns the number of sufficient statistics for the distribution.
func (Exponential) NumSuffStat() int {
	return 1
}

// Prob computes the value of the probability density function at x.
func (e Exponential) Prob(x float64) float64 {
	return math.Exp(e.LogProb(x))
}

// Quantile returns the inverse of the cumulative probability distribution.
func (e Exponential) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	return -math.Log(1-p) / e.Rate
}

// Rand returns a random sample drawn from the distribution.
func (e Exponential) Rand() float64 {
	var rnd float64
	if e.Src == nil {
		rnd = rand.ExpFloat64()
	} else {
		rnd = rand.New(e.Src).ExpFloat64()
	}
	return rnd / e.Rate
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
// The order is [∂LogProb / ∂Rate].
//
// For more information, see https://en.wikipedia.org/wiki/Score_%28statistics%29.
//
// Special cases:
//
//	Score(0) = [NaN]
func (e Exponential) Score(deriv []float64, x float64) []float64 {
	if deriv == nil {
		deriv = make([]float64, e.NumParameters())
	}
	if len(deriv) != e.NumParameters() {
		panic(badLength)
	}
	if x > 0 {
		deriv[0] = 1/e.Rate - x
		return deriv
	}
	if x < 0 {
		deriv[0] = 0
		return deriv
	}
	deriv[0] = math.NaN()
	return deriv
}

// ScoreInput returns the score function with respect to the input of the
// distribution at the input location specified by x. The score function is the
// derivative of the log-likelihood
//
//	(d/dx) log(p(x)) .
//
// Special cases:
//
//	ScoreInput(0) = NaN
func (e Exponential) ScoreInput(x float64) float64 {
	if x > 0 {
		return -e.Rate
	}
	if x < 0 {
		return 0
	}
	return math.NaN()
}

// Skewness returns the skewness of the distribution.
func (Exponential) Skewness() float64 {
	return 2
}

// StdDev returns the standard deviation of the probability distribution.
func (e Exponential) StdDev() float64 {
	return 1 / e.Rate
}

// SuffStat computes the sufficient statistics of set of samples to update
// the distribution. The sufficient statistics are stored in place, and the
// effective number of samples are returned.
//
// The exponential distribution has one sufficient statistic, the average rate
// of the samples.
//
// If weights is nil, the weights are assumed to be 1, otherwise panics if
// len(samples) != len(weights). Panics if len(suffStat) != NumSuffStat().
func (Exponential) SuffStat(suffStat, samples, weights []float64) (nSamples float64) {
	if len(weights) != 0 && len(samples) != len(weights) {
		panic(badLength)
	}

	if len(suffStat) != (Exponential{}).NumSuffStat() {
		panic(badSuffStat)
	}

	if len(weights) == 0 {
		nSamples = float64(len(samples))
	} else {
		nSamples = floats.Sum(weights)
	}

	mean := stat.Mean(samples, weights)
	suffStat[0] = 1 / mean
	return nSamples
}

// Survival returns the survival function (complementary CDF) at x.
func (e Exponential) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	return math.Exp(-e.Rate * x)
}

// setParameters modifies the parameters of the distribution.
func (e *Exponential) setParameters(p []Parameter) {
	if len(p) != e.NumParameters() {
		panic("exponential: incorrect number of parameters to set")
	}
	if p[0].Name != "Rate" {
		panic("exponential: " + panicNameMismatch)
	}
	e.Rate = p[0].Value
}

// Variance returns the variance of the probability distribution.
func (e Exponential) Variance() float64 {
	return 1 / (e.Rate * e.Rate)
}

// parameters returns the parameters of the distribution.
func (e Exponential) parameters(p []Parameter) []Parameter {
	nParam := e.NumParameters()
	if p == nil {
		p = make([]Parameter, nParam)
	} else if len(p) != nParam {
		panic("exponential: improper parameter length")
	}
	p[0].Name = "Rate"
	p[0].Value = e.Rate
	return p
}
