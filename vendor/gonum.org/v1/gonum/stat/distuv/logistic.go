// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
)

// Logistic implements the Logistic distribution, a two-parameter distribution with support on the real axis.
// Its cumulative distribution function is the logistic function.
//
// General form of probability density function for Logistic distribution is
//
//	E(x) / (s * (1 + E(x))^2)
//	where E(x) = exp(-(x-μ)/s)
//
// For more information, see https://en.wikipedia.org/wiki/Logistic_distribution.
type Logistic struct {
	Mu float64 // Mean value
	S  float64 // Scale parameter proportional to standard deviation
}

// CDF computes the value of the cumulative density function at x.
func (l Logistic) CDF(x float64) float64 {
	return 1 / (1 + math.Exp(-(x-l.Mu)/l.S))
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (l Logistic) ExKurtosis() float64 {
	return 6.0 / 5.0
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (l Logistic) LogProb(x float64) float64 {
	return x - 2*math.Log(math.Exp(x)+1)
}

// Mean returns the mean of the probability distribution.
func (l Logistic) Mean() float64 {
	return l.Mu
}

// Mode returns the mode of the distribution.
//
// It is same as Mean for Logistic distribution.
func (l Logistic) Mode() float64 {
	return l.Mu
}

// Median returns the median of the distribution.
//
// It is same as Mean for Logistic distribution.
func (l Logistic) Median() float64 {
	return l.Mu
}

// NumParameters returns the number of parameters in the distribution.
//
// Always returns 2.
func (l Logistic) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (l Logistic) Prob(x float64) float64 {
	E := math.Exp(-(x - l.Mu) / l.S)
	return E / (l.S * math.Pow(1+E, 2))
}

// Quantile returns the inverse of the cumulative distribution function.
func (l Logistic) Quantile(p float64) float64 {
	return l.Mu + l.S*math.Log(p/(1-p))
}

// Skewness returns the skewness of the distribution.
//
// Always 0 for Logistic distribution.
func (l Logistic) Skewness() float64 {
	return 0
}

// StdDev returns the standard deviation of the probability distribution.
func (l Logistic) StdDev() float64 {
	return l.S * math.Pi / sqrt3
}

// Survival returns the survival function (complementary CDF) at x.
func (l Logistic) Survival(x float64) float64 {
	return 1 - l.CDF(x)
}

// Variance returns the variance of the probability distribution.
func (l Logistic) Variance() float64 {
	return l.S * l.S * math.Pi * math.Pi / 3
}
