// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

const logPi = 1.1447298858494001741 // http://oeis.org/A053510

// StudentsT implements the three-parameter Student's T distribution, a distribution
// over the real numbers.
//
// The Student's T distribution has density function
//
//	Γ((ν+1)/2) / (sqrt(νπ) Γ(ν/2) σ) (1 + 1/ν * ((x-μ)/σ)^2)^(-(ν+1)/2)
//
// The Student's T distribution approaches the normal distribution as ν → ∞.
//
// For more information, see https://en.wikipedia.org/wiki/Student%27s_t-distribution,
// specifically https://en.wikipedia.org/wiki/Student%27s_t-distribution#Non-standardized_Student.27s_t-distribution .
//
// The standard Student's T distribution is with Mu = 0, and Sigma = 1.
type StudentsT struct {
	// Mu is the location parameter of the distribution, and the mean of the
	// distribution
	Mu float64

	// Sigma is the scale parameter of the distribution. It is related to the
	// standard deviation by std = Sigma * sqrt(Nu/(Nu-2))
	Sigma float64

	// Nu is the shape parameter of the distribution, representing the number of
	// degrees of the distribution, and one less than the number of observations
	// from a Normal distribution.
	Nu float64

	Src rand.Source
}

// CDF computes the value of the cumulative distribution function at x.
func (s StudentsT) CDF(x float64) float64 {
	// transform to standard normal
	y := (x - s.Mu) / s.Sigma
	if y == 0 {
		return 0.5
	}
	// For t > 0
	// F(y) = 1 - 0.5 * I_t(y)(nu/2, 1/2)
	// t(y) = nu/(y^2 + nu)
	// and 1 - F(y) for t < 0
	t := s.Nu / (y*y + s.Nu)
	if y > 0 {
		return 1 - 0.5*mathext.RegIncBeta(0.5*s.Nu, 0.5, t)
	}
	return 0.5 * mathext.RegIncBeta(s.Nu/2, 0.5, t)
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (s StudentsT) LogProb(x float64) float64 {
	g1, _ := math.Lgamma((s.Nu + 1) / 2)
	g2, _ := math.Lgamma(s.Nu / 2)
	z := (x - s.Mu) / s.Sigma
	return g1 - g2 - 0.5*math.Log(s.Nu) - 0.5*logPi - math.Log(s.Sigma) - ((s.Nu+1)/2)*math.Log(1+z*z/s.Nu)
}

// Mean returns the mean of the probability distribution.
func (s StudentsT) Mean() float64 {
	return s.Mu
}

// Mode returns the mode of the distribution.
func (s StudentsT) Mode() float64 {
	return s.Mu
}

// NumParameters returns the number of parameters in the distribution.
func (StudentsT) NumParameters() int {
	return 3
}

// Prob computes the value of the probability density function at x.
func (s StudentsT) Prob(x float64) float64 {
	return math.Exp(s.LogProb(x))
}

// Quantile returns the inverse of the cumulative distribution function.
func (s StudentsT) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	// F(x) = 1 - 0.5 * I_t(x)(nu/2, 1/2)
	// t(x) = nu/(t^2 + nu)
	if p == 0.5 {
		return s.Mu
	}
	var y float64
	if p > 0.5 {
		// Know t > 0
		t := mathext.InvRegIncBeta(s.Nu/2, 0.5, 2*(1-p))
		y = math.Sqrt(s.Nu * (1 - t) / t)
	} else {
		t := mathext.InvRegIncBeta(s.Nu/2, 0.5, 2*p)
		y = -math.Sqrt(s.Nu * (1 - t) / t)
	}
	// Convert out of standard normal
	return y*s.Sigma + s.Mu
}

// Rand returns a random sample drawn from the distribution.
func (s StudentsT) Rand() float64 {
	// http://www.math.uah.edu/stat/special/Student.html
	n := Normal{0, 1, s.Src}.Rand()
	c := Gamma{s.Nu / 2, 0.5, s.Src}.Rand()
	z := n / math.Sqrt(c/s.Nu)
	return z*s.Sigma + s.Mu
}

// StdDev returns the standard deviation of the probability distribution.
//
// The standard deviation is undefined for ν <= 1, and this returns math.NaN().
func (s StudentsT) StdDev() float64 {
	return math.Sqrt(s.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (s StudentsT) Survival(x float64) float64 {
	// transform to standard normal
	y := (x - s.Mu) / s.Sigma
	if y == 0 {
		return 0.5
	}
	// For t > 0
	// F(y) = 1 - 0.5 * I_t(y)(nu/2, 1/2)
	// t(y) = nu/(y^2 + nu)
	// and 1 - F(y) for t < 0
	t := s.Nu / (y*y + s.Nu)
	if y > 0 {
		return 0.5 * mathext.RegIncBeta(s.Nu/2, 0.5, t)
	}
	return 1 - 0.5*mathext.RegIncBeta(s.Nu/2, 0.5, t)
}

// Variance returns the variance of the probability distribution.
//
// The variance is undefined for ν <= 1, and this returns math.NaN().
func (s StudentsT) Variance() float64 {
	if s.Nu <= 1 {
		return math.NaN()
	}
	if s.Nu <= 2 {
		return math.Inf(1)
	}
	return s.Sigma * s.Sigma * s.Nu / (s.Nu - 2)
}
