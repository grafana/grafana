// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// Chi implements the χ distribution, a one parameter distribution
// with support on the positive numbers.
//
// The density function is given by
//
//	1/(2^{k/2-1} * Γ(k/2)) * x^{k - 1} * e^{-x^2/2}
//
// For more information, see https://en.wikipedia.org/wiki/Chi_distribution.
type Chi struct {
	// K is the shape parameter, corresponding to the degrees of freedom. Must
	// be greater than 0.
	K float64

	Src rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (c Chi) CDF(x float64) float64 {
	return mathext.GammaIncReg(c.K/2, (x*x)/2)
}

// Entropy returns the differential entropy of the distribution.
func (c Chi) Entropy() float64 {
	lg, _ := math.Lgamma(c.K / 2)
	return lg + 0.5*(c.K-math.Ln2-(c.K-1)*mathext.Digamma(c.K/2))
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (c Chi) ExKurtosis() float64 {
	v := c.Variance()
	s := math.Sqrt(v)
	return 2 / v * (1 - c.Mean()*s*c.Skewness() - v)
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (c Chi) LogProb(x float64) float64 {
	if x < 0 {
		return math.Inf(-1)
	}
	lg, _ := math.Lgamma(c.K / 2)
	return (c.K-1)*math.Log(x) - (x*x)/2 - (c.K/2-1)*math.Ln2 - lg
}

// Mean returns the mean of the probability distribution.
func (c Chi) Mean() float64 {
	lg1, _ := math.Lgamma((c.K + 1) / 2)
	lg, _ := math.Lgamma(c.K / 2)
	return math.Sqrt2 * math.Exp(lg1-lg)
}

// Median returns the median of the distribution.
func (c Chi) Median() float64 {
	return c.Quantile(0.5)
}

// Mode returns the mode of the distribution.
//
// Mode returns NaN if K is less than one.
func (c Chi) Mode() float64 {
	return math.Sqrt(c.K - 1)
}

// NumParameters returns the number of parameters in the distribution.
func (c Chi) NumParameters() int {
	return 1
}

// Prob computes the value of the probability density function at x.
func (c Chi) Prob(x float64) float64 {
	return math.Exp(c.LogProb(x))
}

// Rand returns a random sample drawn from the distribution.
func (c Chi) Rand() float64 {
	return math.Sqrt(Gamma{c.K / 2, 0.5, c.Src}.Rand())
}

// Quantile returns the inverse of the cumulative distribution function.
func (c Chi) Quantile(p float64) float64 {
	if p < 0 || 1 < p {
		panic(badPercentile)
	}
	return math.Sqrt(2 * mathext.GammaIncRegInv(0.5*c.K, p))
}

// Skewness returns the skewness of the distribution.
func (c Chi) Skewness() float64 {
	v := c.Variance()
	s := math.Sqrt(v)
	return c.Mean() / (s * v) * (1 - 2*v)
}

// StdDev returns the standard deviation of the probability distribution.
func (c Chi) StdDev() float64 {
	return math.Sqrt(c.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (c Chi) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	return mathext.GammaIncRegComp(0.5*c.K, 0.5*(x*x))
}

// Variance returns the variance of the probability distribution.
func (c Chi) Variance() float64 {
	m := c.Mean()
	return math.Max(0, c.K-m*m)
}
