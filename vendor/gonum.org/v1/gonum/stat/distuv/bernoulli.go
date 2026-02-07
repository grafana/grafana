// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
)

// Bernoulli represents a random variable whose value is 1 with probability p and
// value of zero with probability 1-P. The value of P must be between 0 and 1.
// More information at https://en.wikipedia.org/wiki/Bernoulli_distribution.
type Bernoulli struct {
	P   float64
	Src rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (b Bernoulli) CDF(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x < 1 {
		return 1 - b.P
	}
	return 1
}

// Entropy returns the entropy of the distribution.
func (b Bernoulli) Entropy() float64 {
	if b.P == 0 || b.P == 1 {
		return 0
	}
	q := 1 - b.P
	return -b.P*math.Log(b.P) - q*math.Log(q)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (b Bernoulli) ExKurtosis() float64 {
	pq := b.P * (1 - b.P)
	return (1 - 6*pq) / pq
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (b Bernoulli) LogProb(x float64) float64 {
	if x == 0 {
		return math.Log(1 - b.P)
	}
	if x == 1 {
		return math.Log(b.P)
	}
	return math.Inf(-1)
}

// Mean returns the mean of the probability distribution.
func (b Bernoulli) Mean() float64 {
	return b.P
}

// Median returns the median of the probability distribution.
func (b Bernoulli) Median() float64 {
	p := b.P
	switch {
	case p < 0.5:
		return 0
	case p > 0.5:
		return 1
	default:
		return 0.5
	}
}

// NumParameters returns the number of parameters in the distribution.
func (Bernoulli) NumParameters() int {
	return 1
}

// Prob computes the value of the probability distribution at x.
func (b Bernoulli) Prob(x float64) float64 {
	if x == 0 {
		return 1 - b.P
	}
	if x == 1 {
		return b.P
	}
	return 0
}

// Quantile returns the minimum value of x from amongst all those values whose CDF value exceeds or equals p.
func (b Bernoulli) Quantile(p float64) float64 {
	if p < 0 || 1 < p {
		panic(badPercentile)
	}
	if p <= 1-b.P {
		return 0
	}
	return 1
}

// Rand returns a random sample drawn from the distribution.
func (b Bernoulli) Rand() float64 {
	var rnd float64
	if b.Src == nil {
		rnd = rand.Float64()
	} else {
		rnd = rand.New(b.Src).Float64()
	}
	if rnd < b.P {
		return 1
	}
	return 0
}

// Skewness returns the skewness of the distribution.
func (b Bernoulli) Skewness() float64 {
	return (1 - 2*b.P) / math.Sqrt(b.P*(1-b.P))
}

// StdDev returns the standard deviation of the probability distribution.
func (b Bernoulli) StdDev() float64 {
	return math.Sqrt(b.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (b Bernoulli) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	if x < 1 {
		return b.P
	}
	return 0
}

// Variance returns the variance of the probability distribution.
func (b Bernoulli) Variance() float64 {
	return b.P * (1 - b.P)
}
