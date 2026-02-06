// Copyright ©2018 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
)

// GumbelRight implements the right-skewed Gumbel distribution, a two-parameter
// continuous distribution with support over the real numbers. The right-skewed
// Gumbel distribution is also sometimes known as the Extreme Value distribution.
//
// The right-skewed Gumbel distribution has density function
//
//	1/beta * exp(-(z + exp(-z)))
//	z = (x - mu)/beta
//
// Beta must be greater than 0.
//
// For more information, see https://en.wikipedia.org/wiki/Gumbel_distribution.
type GumbelRight struct {
	Mu   float64
	Beta float64
	Src  rand.Source
}

func (g GumbelRight) z(x float64) float64 {
	return (x - g.Mu) / g.Beta
}

// CDF computes the value of the cumulative density function at x.
func (g GumbelRight) CDF(x float64) float64 {
	z := g.z(x)
	return math.Exp(-math.Exp(-z))
}

// Entropy returns the differential entropy of the distribution.
func (g GumbelRight) Entropy() float64 {
	return math.Log(g.Beta) + eulerMascheroni + 1
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (g GumbelRight) ExKurtosis() float64 {
	return 12.0 / 5
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (g GumbelRight) LogProb(x float64) float64 {
	z := g.z(x)
	return -math.Log(g.Beta) - z - math.Exp(-z)
}

// Mean returns the mean of the probability distribution.
func (g GumbelRight) Mean() float64 {
	return g.Mu + g.Beta*eulerMascheroni
}

// Median returns the median of the Gumbel distribution.
func (g GumbelRight) Median() float64 {
	return g.Mu - g.Beta*math.Log(math.Ln2)
}

// Mode returns the mode of the normal distribution.
func (g GumbelRight) Mode() float64 {
	return g.Mu
}

// NumParameters returns the number of parameters in the distribution.
func (GumbelRight) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (g GumbelRight) Prob(x float64) float64 {
	return math.Exp(g.LogProb(x))
}

// Quantile returns the inverse of the cumulative probability distribution.
func (g GumbelRight) Quantile(p float64) float64 {
	if p < 0 || 1 < p {
		panic(badPercentile)
	}
	return g.Mu - g.Beta*math.Log(-math.Log(p))
}

// Rand returns a random sample drawn from the distribution.
func (g GumbelRight) Rand() float64 {
	var rnd float64
	if g.Src == nil {
		rnd = rand.ExpFloat64()
	} else {
		rnd = rand.New(g.Src).ExpFloat64()
	}
	return g.Mu - g.Beta*math.Log(rnd)
}

// Skewness returns the skewness of the distribution.
func (GumbelRight) Skewness() float64 {
	return 12 * math.Sqrt(6) * apery / (math.Pi * math.Pi * math.Pi)
}

// StdDev returns the standard deviation of the probability distribution.
func (g GumbelRight) StdDev() float64 {
	return (math.Pi / math.Sqrt(6)) * g.Beta
}

// Survival returns the survival function (complementary CDF) at x.
func (g GumbelRight) Survival(x float64) float64 {
	return 1 - g.CDF(x)
}

// Variance returns the variance of the probability distribution.
func (g GumbelRight) Variance() float64 {
	return math.Pi * math.Pi * g.Beta * g.Beta / 6
}
