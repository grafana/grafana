// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// F implements the F-distribution, a two-parameter continuous distribution
// with support over the positive real numbers.
//
// The F-distribution has density function
//
//	sqrt(((d1*x)^d1) * d2^d2 / ((d1*x+d2)^(d1+d2))) / (x * B(d1/2,d2/2))
//
// where B is the beta function.
//
// For more information, see https://en.wikipedia.org/wiki/F-distribution
type F struct {
	D1  float64 // Degrees of freedom for the numerator
	D2  float64 // Degrees of freedom for the denominator
	Src rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (f F) CDF(x float64) float64 {
	return mathext.RegIncBeta(f.D1/2, f.D2/2, f.D1*x/(f.D1*x+f.D2))
}

// ExKurtosis returns the excess kurtosis of the distribution.
//
// ExKurtosis returns NaN if the D2 parameter is less or equal to 8.
func (f F) ExKurtosis() float64 {
	if f.D2 <= 8 {
		return math.NaN()
	}
	return (12 / (f.D2 - 6)) * ((5*f.D2-22)/(f.D2-8) + ((f.D2-4)/f.D1)*((f.D2-2)/(f.D2-8))*((f.D2-2)/(f.D1+f.D2-2)))
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (f F) LogProb(x float64) float64 {
	return 0.5*(f.D1*math.Log(f.D1*x)+f.D2*math.Log(f.D2)-(f.D1+f.D2)*math.Log(f.D1*x+f.D2)) - math.Log(x) - mathext.Lbeta(f.D1/2, f.D2/2)
}

// Mean returns the mean of the probability distribution.
//
// Mean returns NaN if the D2 parameter is less than or equal to 2.
func (f F) Mean() float64 {
	if f.D2 <= 2 {
		return math.NaN()
	}
	return f.D2 / (f.D2 - 2)
}

// Mode returns the mode of the distribution.
//
// Mode returns NaN if the D1 parameter is less than or equal to 2.
func (f F) Mode() float64 {
	if f.D1 <= 2 {
		return math.NaN()
	}
	return ((f.D1 - 2) / f.D1) * (f.D2 / (f.D2 + 2))
}

// NumParameters returns the number of parameters in the distribution.
func (f F) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (f F) Prob(x float64) float64 {
	return math.Exp(f.LogProb(x))
}

// Quantile returns the inverse of the cumulative distribution function.
func (f F) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	y := mathext.InvRegIncBeta(0.5*f.D1, 0.5*f.D2, p)
	return f.D2 * y / (f.D1 * (1 - y))
}

// Rand returns a random sample drawn from the distribution.
func (f F) Rand() float64 {
	u1 := ChiSquared{f.D1, f.Src}.Rand()
	u2 := ChiSquared{f.D2, f.Src}.Rand()
	return (u1 / f.D1) / (u2 / f.D2)
}

// Skewness returns the skewness of the distribution.
//
// Skewness returns NaN if the D2 parameter is less than or equal to 6.
func (f F) Skewness() float64 {
	if f.D2 <= 6 {
		return math.NaN()
	}
	num := (2*f.D1 + f.D2 - 2) * math.Sqrt(8*(f.D2-4))
	den := (f.D2 - 6) * math.Sqrt(f.D1*(f.D1+f.D2-2))
	return num / den
}

// StdDev returns the standard deviation of the probability distribution.
//
// StdDev returns NaN if the D2 parameter is less than or equal to 4.
func (f F) StdDev() float64 {
	if f.D2 <= 4 {
		return math.NaN()
	}
	return math.Sqrt(f.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (f F) Survival(x float64) float64 {
	return 1 - f.CDF(x)
}

// Variance returns the variance of the probability distribution.
//
// Variance returns NaN if the D2 parameter is less than or equal to 4.
func (f F) Variance() float64 {
	if f.D2 <= 4 {
		return math.NaN()
	}
	num := 2 * f.D2 * f.D2 * (f.D1 + f.D2 - 2)
	den := f.D1 * (f.D2 - 2) * (f.D2 - 2) * (f.D2 - 4)
	return num / den
}
