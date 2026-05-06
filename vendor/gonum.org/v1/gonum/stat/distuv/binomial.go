// Copyright ©2018 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
	"gonum.org/v1/gonum/stat/combin"
)

// Binomial implements the binomial distribution, a discrete probability distribution
// that expresses the probability of a given number of successful Bernoulli trials
// out of a total of n, each with success probability p.
// The binomial distribution has the density function:
//
//	f(k) = (n choose k) p^k (1-p)^(n-k)
//
// For more information, see https://en.wikipedia.org/wiki/Binomial_distribution.
type Binomial struct {
	// N is the total number of Bernoulli trials. N must be greater than 0.
	N float64
	// P is the probability of success in any given trial. P must be in [0, 1].
	P float64

	Src rand.Source
}

// CDF computes the value of the cumulative distribution function at x.
func (b Binomial) CDF(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x >= b.N {
		return 1
	}
	x = math.Floor(x)
	return mathext.RegIncBeta(b.N-x, x+1, 1-b.P)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (b Binomial) ExKurtosis() float64 {
	v := b.P * (1 - b.P)
	return (1 - 6*v) / (b.N * v)
}

// LogProb computes the natural logarithm of the value of the probability
// density function at x.
func (b Binomial) LogProb(x float64) float64 {
	if x < 0 || x > b.N || math.Floor(x) != x {
		return math.Inf(-1)
	}
	lb := combin.LogGeneralizedBinomial(b.N, x)
	return lb + x*math.Log(b.P) + (b.N-x)*math.Log(1-b.P)
}

// Mean returns the mean of the probability distribution.
func (b Binomial) Mean() float64 {
	return b.N * b.P
}

// NumParameters returns the number of parameters in the distribution.
func (Binomial) NumParameters() int {
	return 2
}

// Prob computes the value of the probability density function at x.
func (b Binomial) Prob(x float64) float64 {
	return math.Exp(b.LogProb(x))
}

// Rand returns a random sample drawn from the distribution.
func (b Binomial) Rand() float64 {
	// NUMERICAL RECIPES IN C: THE ART OF SCIENTIFIC COMPUTING (ISBN 0-521-43108-5)
	// p. 295-6
	// http://www.aip.de/groups/soe/local/numres/bookcpdf/c7-3.pdf

	runif := rand.Float64
	rexp := rand.ExpFloat64
	if b.Src != nil {
		rnd := rand.New(b.Src)
		runif = rnd.Float64
		rexp = rnd.ExpFloat64
	}

	p := b.P
	if p > 0.5 {
		p = 1 - p
	}
	am := b.N * p

	if b.N < 25 {
		// Use direct method.
		bnl := 0.0
		for i := 0; i < int(b.N); i++ {
			if runif() < p {
				bnl++
			}
		}
		if p != b.P {
			return b.N - bnl
		}
		return bnl
	}

	if am < 1 {
		// Use rejection method with Poisson proposal.
		const logM = 2.6e-2 // constant for rejection sampling (https://en.wikipedia.org/wiki/Rejection_sampling)
		var bnl float64
		z := -p
		pclog := (1 + 0.5*z) * z / (1 + (1+1.0/6*z)*z) // Padé approximant of log(1 + x)
		for {
			bnl = 0.0
			t := 0.0
			for i := 0; i < int(b.N); i++ {
				t += rexp()
				if t >= am {
					break
				}
				bnl++
			}
			bnlc := b.N - bnl
			z = -bnl / b.N
			log1p := (1 + 0.5*z) * z / (1 + (1+1.0/6*z)*z)
			t = (bnlc+0.5)*log1p + bnl - bnlc*pclog + 1/(12*bnlc) - am + logM // Uses Stirling's expansion of log(n!)
			if rexp() >= t {
				break
			}
		}
		if p != b.P {
			return b.N - bnl
		}
		return bnl
	}
	// Original algorithm samples from a Poisson distribution with the
	// appropriate expected value. However, the Poisson approximation is
	// asymptotic such that the absolute deviation in probability is O(1/n).
	// Rejection sampling produces exact variates with at worst less than 3%
	// rejection with minimal additional computation.

	// Use rejection method with Cauchy proposal.
	g, _ := math.Lgamma(b.N + 1)
	plog := math.Log(p)
	pclog := math.Log1p(-p)
	sq := math.Sqrt(2 * am * (1 - p))
	for {
		var em, y float64
		for {
			y = math.Tan(math.Pi * runif())
			em = sq*y + am
			if em >= 0 && em < b.N+1 {
				break
			}
		}
		em = math.Floor(em)
		lg1, _ := math.Lgamma(em + 1)
		lg2, _ := math.Lgamma(b.N - em + 1)
		t := 1.2 * sq * (1 + y*y) * math.Exp(g-lg1-lg2+em*plog+(b.N-em)*pclog)
		if runif() <= t {
			if p != b.P {
				return b.N - em
			}
			return em
		}
	}
}

// Skewness returns the skewness of the distribution.
func (b Binomial) Skewness() float64 {
	return (1 - 2*b.P) / b.StdDev()
}

// StdDev returns the standard deviation of the probability distribution.
func (b Binomial) StdDev() float64 {
	return math.Sqrt(b.Variance())
}

// Survival returns the survival function (complementary CDF) at x.
func (b Binomial) Survival(x float64) float64 {
	return 1 - b.CDF(x)
}

// Variance returns the variance of the probability distribution.
func (b Binomial) Variance() float64 {
	return b.N * b.P * (1 - b.P)
}
