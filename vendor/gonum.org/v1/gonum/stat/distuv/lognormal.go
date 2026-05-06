// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
)

// LogNormal represents a random variable whose log is normally distributed.
// The probability density function is given by
//
//	1/(x σ √2π) exp(-(ln(x)-μ)^2)/(2σ^2))
type LogNormal struct {
	Mu    float64
	Sigma float64
	Src   rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (l LogNormal) CDF(x float64) float64 {
	return 0.5 * math.Erfc(-(math.Log(x)-l.Mu)/(math.Sqrt2*l.Sigma))
}

// Entropy returns the differential entropy of the distribution.
func (l LogNormal) Entropy() float64 {
	return 0.5 + 0.5*math.Log(2*math.Pi*l.Sigma*l.Sigma) + l.Mu
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (l LogNormal) ExKurtosis() float64 {
	s2 := l.Sigma * l.Sigma
	return math.Exp(4*s2) + 2*math.Exp(3*s2) + 3*math.Exp(2*s2) - 6
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (l LogNormal) LogProb(x float64) float64 {
	if x < 0 {
		return math.Inf(-1)
	}
	logx := math.Log(x)
	normdiff := (logx - l.Mu) / l.Sigma
	return -0.5*normdiff*normdiff - logx - math.Log(l.Sigma) - logRoot2Pi
}

// Mean returns the mean of the probability distribution.
func (l LogNormal) Mean() float64 {
	return math.Exp(l.Mu + 0.5*l.Sigma*l.Sigma)
}

// Median returns the median of the probability distribution.
func (l LogNormal) Median() float64 {
	return math.Exp(l.Mu)
}

// Mode returns the mode of the probability distribution.
func (l LogNormal) Mode() float64 {
	return math.Exp(l.Mu - l.Sigma*l.Sigma)
}

// NumParameters returns the number of parameters in the distribution.
func (LogNormal) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (l LogNormal) Prob(x float64) float64 {
	return math.Exp(l.LogProb(x))
}

// Quantile returns the inverse of the cumulative probability distribution.
func (l LogNormal) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	// Formula from http://www.math.uah.edu/stat/special/LogNormal.html.
	return math.Exp(l.Mu + l.Sigma*UnitNormal.Quantile(p))
}

// Rand returns a random sample drawn from the distribution.
func (l LogNormal) Rand() float64 {
	var rnd float64
	if l.Src == nil {
		rnd = rand.NormFloat64()
	} else {
		rnd = rand.New(l.Src).NormFloat64()
	}
	return math.Exp(rnd*l.Sigma + l.Mu)
}

// Skewness returns the skewness of the distribution.
func (l LogNormal) Skewness() float64 {
	s2 := l.Sigma * l.Sigma
	return (math.Exp(s2) + 2) * math.Sqrt(math.Exp(s2)-1)
}

// StdDev returns the standard deviation of the probability distribution.
func (l LogNormal) StdDev() float64 {
	return math.Sqrt(l.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (l LogNormal) Survival(x float64) float64 {
	return 0.5 * (1 - math.Erf((math.Log(x)-l.Mu)/(math.Sqrt2*l.Sigma)))
}

// Variance returns the variance of the probability distribution.
func (l LogNormal) Variance() float64 {
	s2 := l.Sigma * l.Sigma
	return (math.Exp(s2) - 1) * math.Exp(2*l.Mu+s2)
}
