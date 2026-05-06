// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
)

// UnitUniform is an instantiation of the uniform distribution with Min = 0
// and Max = 1.
var UnitUniform = Uniform{Min: 0, Max: 1}

// Uniform represents a continuous uniform distribution (https://en.wikipedia.org/wiki/Uniform_distribution_%28continuous%29).
type Uniform struct {
	Min float64
	Max float64
	Src rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (u Uniform) CDF(x float64) float64 {
	if x < u.Min {
		return 0
	}
	if x > u.Max {
		return 1
	}
	return (x - u.Min) / (u.Max - u.Min)
}

// Uniform doesn't have any of the DLogProbD? because the derivative is 0 everywhere
// except where it's undefined

// Entropy returns the entropy of the distribution.
func (u Uniform) Entropy() float64 {
	return math.Log(u.Max - u.Min)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (Uniform) ExKurtosis() float64 {
	return -6.0 / 5.0
}

// Uniform doesn't have Fit because it's a bad idea to fit a uniform from data.

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (u Uniform) LogProb(x float64) float64 {
	if x < u.Min {
		return math.Inf(-1)
	}
	if x > u.Max {
		return math.Inf(-1)
	}
	return -math.Log(u.Max - u.Min)
}

// parameters returns the parameters of the distribution.
func (u Uniform) parameters(p []Parameter) []Parameter {
	nParam := u.NumParameters()
	if p == nil {
		p = make([]Parameter, nParam)
	} else if len(p) != nParam {
		panic("uniform: improper parameter length")
	}
	p[0].Name = "Min"
	p[0].Value = u.Min
	p[1].Name = "Max"
	p[1].Value = u.Max
	return p
}

// Mean returns the mean of the probability distribution.
func (u Uniform) Mean() float64 {
	return (u.Max + u.Min) / 2
}

// Median returns the median of the probability distribution.
func (u Uniform) Median() float64 {
	return (u.Max + u.Min) / 2
}

// Uniform doesn't have a mode because it's any value in the distribution

// NumParameters returns the number of parameters in the distribution.
func (Uniform) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (u Uniform) Prob(x float64) float64 {
	if x < u.Min {
		return 0
	}
	if x > u.Max {
		return 0
	}
	return 1 / (u.Max - u.Min)
}

// Quantile returns the inverse of the cumulative probability distribution.
func (u Uniform) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	return p*(u.Max-u.Min) + u.Min
}

// Rand returns a random sample drawn from the distribution.
func (u Uniform) Rand() float64 {
	var rnd float64
	if u.Src == nil {
		rnd = rand.Float64()
	} else {
		rnd = rand.New(u.Src).Float64()
	}
	return rnd*(u.Max-u.Min) + u.Min
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
func (u Uniform) Score(deriv []float64, x float64) []float64 {
	if deriv == nil {
		deriv = make([]float64, u.NumParameters())
	}
	if len(deriv) != u.NumParameters() {
		panic(badLength)
	}
	if (x < u.Min) || (x > u.Max) {
		deriv[0] = math.NaN()
		deriv[1] = math.NaN()
	} else {
		deriv[0] = 1 / (u.Max - u.Min)
		deriv[1] = -deriv[0]
		if x == u.Min {
			deriv[0] = math.NaN()
		}
		if x == u.Max {
			deriv[1] = math.NaN()
		}
	}
	return deriv
}

// ScoreInput returns the score function with respect to the input of the
// distribution at the input location specified by x. The score function is the
// derivative of the log-likelihood
//
//	(d/dx) log(p(x)) .
func (u Uniform) ScoreInput(x float64) float64 {
	if (x <= u.Min) || (x >= u.Max) {
		return math.NaN()
	}
	return 0
}

// Skewness returns the skewness of the distribution.
func (Uniform) Skewness() float64 {
	return 0
}

// StdDev returns the standard deviation of the probability distribution.
func (u Uniform) StdDev() float64 {
	return math.Sqrt(u.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (u Uniform) Survival(x float64) float64 {
	if x < u.Min {
		return 1
	}
	if x > u.Max {
		return 0
	}
	return (u.Max - x) / (u.Max - u.Min)
}

// setParameters modifies the parameters of the distribution.
func (u *Uniform) setParameters(p []Parameter) {
	if len(p) != u.NumParameters() {
		panic("uniform: incorrect number of parameters to set")
	}
	if p[0].Name != "Min" {
		panic("uniform: " + panicNameMismatch)
	}
	if p[1].Name != "Max" {
		panic("uniform: " + panicNameMismatch)
	}

	u.Min = p[0].Value
	u.Max = p[1].Value
}

// Variance returns the variance of the probability distribution.
func (u Uniform) Variance() float64 {
	return 1.0 / 12.0 * (u.Max - u.Min) * (u.Max - u.Min)
}
