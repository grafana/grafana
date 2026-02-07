// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// Gamma implements the Gamma distribution, a two-parameter continuous distribution
// with support over the positive real numbers.
//
// The gamma distribution has density function
//
//	β^α / Γ(α) x^(α-1)e^(-βx)
//
// For more information, see https://en.wikipedia.org/wiki/Gamma_distribution
type Gamma struct {
	// Alpha is the shape parameter of the distribution. Alpha must be greater
	// than 0. If Alpha == 1, this is equivalent to an exponential distribution.
	Alpha float64
	// Beta is the rate parameter of the distribution. Beta must be greater than 0.
	// If Beta == 2, this is equivalent to a Chi-Squared distribution.
	Beta float64

	Src rand.Source
}

// CDF computes the value of the cumulative distribution function at x.
func (g Gamma) CDF(x float64) float64 {
	if x < 0 {
		return 0
	}
	return mathext.GammaIncReg(g.Alpha, g.Beta*x)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (g Gamma) ExKurtosis() float64 {
	return 6 / g.Alpha
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (g Gamma) LogProb(x float64) float64 {
	if x < 0 {
		return math.Inf(-1)
	}
	a := g.Alpha
	b := g.Beta
	lg, _ := math.Lgamma(a)
	if a == 1 {
		return math.Log(b) - lg - b*x
	}
	return a*math.Log(b) - lg + (a-1)*math.Log(x) - b*x
}

// Mean returns the mean of the probability distribution.
func (g Gamma) Mean() float64 {
	return g.Alpha / g.Beta
}

// Mode returns the mode of the gamma distribution.
//
// The mode is 0 in the special case where the Alpha (shape) parameter
// is less than 1.
func (g Gamma) Mode() float64 {
	if g.Alpha < 1 {
		return 0
	}
	return (g.Alpha - 1) / g.Beta
}

// NumParameters returns the number of parameters in the distribution.
func (Gamma) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (g Gamma) Prob(x float64) float64 {
	return math.Exp(g.LogProb(x))
}

// Quantile returns the inverse of the cumulative distribution function.
func (g Gamma) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	return mathext.GammaIncRegInv(g.Alpha, p) / g.Beta
}

// Rand returns a random sample drawn from the distribution.
//
// Rand panics if either alpha or beta is <= 0.
func (g Gamma) Rand() float64 {
	const (
		// The 0.2 threshold is from https://www4.stat.ncsu.edu/~rmartin/Codes/rgamss.R
		// described in detail in https://arxiv.org/abs/1302.1884.
		smallAlphaThresh = 0.2
	)
	if g.Beta <= 0 {
		panic("gamma: beta <= 0")
	}

	unifrnd := rand.Float64
	exprnd := rand.ExpFloat64
	normrnd := rand.NormFloat64
	if g.Src != nil {
		rnd := rand.New(g.Src)
		unifrnd = rnd.Float64
		exprnd = rnd.ExpFloat64
		normrnd = rnd.NormFloat64
	}

	a := g.Alpha
	b := g.Beta
	switch {
	case a <= 0:
		panic("gamma: alpha <= 0")
	case a == 1:
		// Generate from exponential
		return exprnd() / b
	case a < smallAlphaThresh:
		// Generate using
		//  Liu, Chuanhai, Martin, Ryan and Syring, Nick. "Simulating from a
		//  gamma distribution with small shape parameter"
		//  https://arxiv.org/abs/1302.1884
		//   use this reference: http://link.springer.com/article/10.1007/s00180-016-0692-0

		// Algorithm adjusted to work in log space as much as possible.
		lambda := 1/a - 1
		lr := -math.Log1p(1 / lambda / math.E)
		for {
			e := exprnd()
			var z float64
			if e >= -lr {
				z = e + lr
			} else {
				z = -exprnd() / lambda
			}
			eza := math.Exp(-z / a)
			lh := -z - eza
			var lEta float64
			if z >= 0 {
				lEta = -z
			} else {
				lEta = -1 + lambda*z
			}
			if lh-lEta > -exprnd() {
				return eza / b
			}
		}
	case a >= smallAlphaThresh:
		// Generate using:
		//  Marsaglia, George, and Wai Wan Tsang. "A simple method for generating
		//  gamma variables." ACM Transactions on Mathematical Software (TOMS)
		//  26.3 (2000): 363-372.
		d := a - 1.0/3
		m := 1.0
		if a < 1 {
			d += 1.0
			m = math.Pow(unifrnd(), 1/a)
		}
		c := 1 / (3 * math.Sqrt(d))
		for {
			x := normrnd()
			v := 1 + x*c
			if v <= 0.0 {
				continue
			}
			v = v * v * v
			u := unifrnd()
			if u < 1.0-0.0331*(x*x)*(x*x) {
				return m * d * v / b
			}
			if math.Log(u) < 0.5*x*x+d*(1-v+math.Log(v)) {
				return m * d * v / b
			}
		}
	}
	panic("unreachable")
}

// Survival returns the survival function (complementary CDF) at x.
func (g Gamma) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	return mathext.GammaIncRegComp(g.Alpha, g.Beta*x)
}

// StdDev returns the standard deviation of the probability distribution.
func (g Gamma) StdDev() float64 {
	return math.Sqrt(g.Alpha) / g.Beta
}

// Variance returns the variance of the probability distribution.
func (g Gamma) Variance() float64 {
	return g.Alpha / g.Beta / g.Beta
}
