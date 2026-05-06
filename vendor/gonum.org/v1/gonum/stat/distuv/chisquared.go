// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// ChiSquared implements the χ² distribution, a one parameter distribution
// with support on the positive numbers.
//
// The density function is given by
//
//	1/(2^{k/2} * Γ(k/2)) * x^{k/2 - 1} * e^{-x/2}
//
// It is a special case of the Gamma distribution, Γ(k/2, 1/2).
//
// For more information, see https://en.wikipedia.org/wiki/Chi-squared_distribution.
type ChiSquared struct {
	// K is the shape parameter, corresponding to the degrees of freedom. Must
	// be greater than 0.
	K float64

	Src rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (c ChiSquared) CDF(x float64) float64 {
	return mathext.GammaIncReg(c.K/2, x/2)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (c ChiSquared) ExKurtosis() float64 {
	return 12 / c.K
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (c ChiSquared) LogProb(x float64) float64 {
	if x < 0 {
		return math.Inf(-1)
	}
	lg, _ := math.Lgamma(c.K / 2)
	return (c.K/2-1)*math.Log(x) - x/2 - (c.K/2)*math.Ln2 - lg
}

// Mean returns the mean of the probability distribution.
func (c ChiSquared) Mean() float64 {
	return c.K
}

// Mode returns the mode of the distribution.
func (c ChiSquared) Mode() float64 {
	return math.Max(c.K-2, 0)
}

// NumParameters returns the number of parameters in the distribution.
func (c ChiSquared) NumParameters() int {
	return 1
}

// Prob computes the value of the probability density function at x.
func (c ChiSquared) Prob(x float64) float64 {
	return math.Exp(c.LogProb(x))
}

// Rand returns a random sample drawn from the distribution.
func (c ChiSquared) Rand() float64 {
	return Gamma{c.K / 2, 0.5, c.Src}.Rand()
}

// Quantile returns the inverse of the cumulative distribution function.
func (c ChiSquared) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	return mathext.GammaIncRegInv(0.5*c.K, p) * 2
}

// StdDev returns the standard deviation of the probability distribution.
func (c ChiSquared) StdDev() float64 {
	return math.Sqrt(c.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (c ChiSquared) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	return mathext.GammaIncRegComp(0.5*c.K, 0.5*x)
}

// Variance returns the variance of the probability distribution.
func (c ChiSquared) Variance() float64 {
	return 2 * c.K
}
