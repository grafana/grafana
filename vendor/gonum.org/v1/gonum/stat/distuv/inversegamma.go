// Copyright ©2018 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// InverseGamma implements the inverse gamma distribution, a two-parameter
// continuous distribution with support over the positive real numbers. The
// inverse gamma distribution is the same as the distribution of the reciprocal
// of a gamma distributed random variable.
//
// The inverse gamma distribution has density function
//
//	β^α / Γ(α) x^(-α-1)e^(-β/x)
//
// For more information, see https://en.wikipedia.org/wiki/Inverse-gamma_distribution
type InverseGamma struct {
	// Alpha is the shape parameter of the distribution. Alpha must be greater than 0.
	Alpha float64
	// Beta is the scale parameter of the distribution. Beta must be greater than 0.
	Beta float64

	Src rand.Source
}

// CDF computes the value of the cumulative distribution function at x.
func (g InverseGamma) CDF(x float64) float64 {
	if x < 0 {
		return 0
	}
	// TODO(btracey): Replace this with a direct call to the upper regularized
	// gamma function if mathext gets it.
	//return 1 - mathext.GammaInc(g.Alpha, g.Beta/x)
	return mathext.GammaIncRegComp(g.Alpha, g.Beta/x)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (g InverseGamma) ExKurtosis() float64 {
	if g.Alpha <= 4 {
		return math.Inf(1)
	}
	return (30*g.Alpha - 66) / (g.Alpha - 3) / (g.Alpha - 4)
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (g InverseGamma) LogProb(x float64) float64 {
	if x <= 0 {
		return math.Inf(-1)
	}
	a := g.Alpha
	b := g.Beta
	lg, _ := math.Lgamma(a)
	return a*math.Log(b) - lg + (-a-1)*math.Log(x) - b/x
}

// Mean returns the mean of the probability distribution.
func (g InverseGamma) Mean() float64 {
	if g.Alpha <= 1 {
		return math.Inf(1)
	}
	return g.Beta / (g.Alpha - 1)
}

// Mode returns the mode of the distribution.
func (g InverseGamma) Mode() float64 {
	return g.Beta / (g.Alpha + 1)
}

// NumParameters returns the number of parameters in the distribution.
func (InverseGamma) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (g InverseGamma) Prob(x float64) float64 {
	return math.Exp(g.LogProb(x))
}

// Quantile returns the inverse of the cumulative distribution function.
func (g InverseGamma) Quantile(p float64) float64 {
	if p < 0 || 1 < p {
		panic(badPercentile)
	}
	return (1 / (mathext.GammaIncRegCompInv(g.Alpha, p))) * g.Beta
}

// Rand returns a random sample drawn from the distribution.
//
// Rand panics if either alpha or beta is <= 0.
func (g InverseGamma) Rand() float64 {
	// TODO(btracey): See if there is a more direct way to sample.
	return 1 / Gamma(g).Rand()
}

// Survival returns the survival function (complementary CDF) at x.
func (g InverseGamma) Survival(x float64) float64 {
	if x < 0 {
		return 1
	}
	return mathext.GammaIncReg(g.Alpha, g.Beta/x)
}

// StdDev returns the standard deviation of the probability distribution.
func (g InverseGamma) StdDev() float64 {
	return math.Sqrt(g.Variance())
}

// Variance returns the variance of the probability distribution.
func (g InverseGamma) Variance() float64 {
	if g.Alpha <= 2 {
		return math.Inf(1)
	}
	v := g.Beta / (g.Alpha - 1)
	return v * v / (g.Alpha - 2)
}
