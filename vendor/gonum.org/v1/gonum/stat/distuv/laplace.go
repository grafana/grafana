// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
	"sort"

	"gonum.org/v1/gonum/stat"
)

// Laplace represents the Laplace distribution (https://en.wikipedia.org/wiki/Laplace_distribution).
type Laplace struct {
	Mu    float64 // Mean of the Laplace distribution
	Scale float64 // Scale of the Laplace distribution
	Src   rand.Source
}

// CDF computes the value of the cumulative density function at x.
func (l Laplace) CDF(x float64) float64 {
	if x < l.Mu {
		return 0.5 * math.Exp((x-l.Mu)/l.Scale)
	}
	return 1 - 0.5*math.Exp(-(x-l.Mu)/l.Scale)
}

// Entropy returns the entropy of the distribution.
func (l Laplace) Entropy() float64 {
	return 1 + math.Log(2*l.Scale)
}

// ExKurtosis returns the excess kurtosis of the distribution.
func (l Laplace) ExKurtosis() float64 {
	return 3
}

// Fit sets the parameters of the probability distribution from the
// data samples x with relative weights w.
// If weights is nil, then all the weights are 1.
// If weights is not nil, then the len(weights) must equal len(samples).
//
// Note: Laplace distribution has no FitPrior because it has no sufficient
// statistics.
func (l *Laplace) Fit(samples, weights []float64) {
	if weights != nil && len(samples) != len(weights) {
		panic(badLength)
	}

	if len(samples) == 0 {
		panic(errNoSamples)
	}
	if len(samples) == 1 {
		l.Mu = samples[0]
		l.Scale = 0
		return
	}

	var (
		sortedSamples []float64
		sortedWeights []float64
	)
	if sort.Float64sAreSorted(samples) {
		sortedSamples = samples
		sortedWeights = weights
	} else {
		// Need to copy variables so the input variables aren't effected by the sorting
		sortedSamples = make([]float64, len(samples))
		copy(sortedSamples, samples)
		sortedWeights := make([]float64, len(samples))
		copy(sortedWeights, weights)

		stat.SortWeighted(sortedSamples, sortedWeights)
	}

	// The (weighted) median of the samples is the maximum likelihood estimate
	// of the mean parameter
	// TODO: Rethink quantile type when stat has more options
	l.Mu = stat.Quantile(0.5, stat.Empirical, sortedSamples, sortedWeights)

	// The scale parameter is the average absolute distance
	// between the sample and the mean
	var absError float64
	var sumWeights float64
	if weights != nil {
		for i, v := range samples {
			absError += weights[i] * math.Abs(l.Mu-v)
			sumWeights += weights[i]
		}
		l.Scale = absError / sumWeights
	} else {
		for _, v := range samples {
			absError += math.Abs(l.Mu - v)
		}
		l.Scale = absError / float64(len(samples))
	}
}

// LogProb computes the natural logarithm of the value of the probability density
// function at x.
func (l Laplace) LogProb(x float64) float64 {
	return -math.Ln2 - math.Log(l.Scale) - math.Abs(x-l.Mu)/l.Scale
}

// parameters returns the parameters of the distribution.
func (l Laplace) parameters(p []Parameter) []Parameter {
	nParam := l.NumParameters()
	if p == nil {
		p = make([]Parameter, nParam)
	} else if len(p) != nParam {
		panic(badLength)
	}
	p[0].Name = "Mu"
	p[0].Value = l.Mu
	p[1].Name = "Scale"
	p[1].Value = l.Scale
	return p
}

// Mean returns the mean of the probability distribution.
func (l Laplace) Mean() float64 {
	return l.Mu
}

// Median returns the median of the LaPlace distribution.
func (l Laplace) Median() float64 {
	return l.Mu
}

// Mode returns the mode of the LaPlace distribution.
func (l Laplace) Mode() float64 {
	return l.Mu
}

// NumParameters returns the number of parameters in the distribution.
func (l Laplace) NumParameters() int {
	return 2
}

// Quantile returns the inverse of the cumulative probability distribution.
func (l Laplace) Quantile(p float64) float64 {
	if p < 0 || p > 1 {
		panic(badPercentile)
	}
	if p < 0.5 {
		return l.Mu + l.Scale*math.Log(1+2*(p-0.5))
	}
	return l.Mu - l.Scale*math.Log(1-2*(p-0.5))
}

// Prob computes the value of the probability density function at x.
func (l Laplace) Prob(x float64) float64 {
	return math.Exp(l.LogProb(x))
}

// Rand returns a random sample drawn from the distribution.
func (l Laplace) Rand() float64 {
	var rnd float64
	if l.Src == nil {
		rnd = rand.Float64()
	} else {
		rnd = rand.New(l.Src).Float64()
	}
	u := rnd - 0.5
	if u < 0 {
		return l.Mu + l.Scale*math.Log(1+2*u)
	}
	return l.Mu - l.Scale*math.Log(1-2*u)
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
// The order is [∂LogProb / ∂Mu, ∂LogProb / ∂Scale].
//
// For more information, see https://en.wikipedia.org/wiki/Score_%28statistics%29.
//
// Special cases:
//
//	Score(l.Mu) = [NaN, -1/l.Scale]
func (l Laplace) Score(deriv []float64, x float64) []float64 {
	if deriv == nil {
		deriv = make([]float64, l.NumParameters())
	}
	if len(deriv) != l.NumParameters() {
		panic(badLength)
	}
	diff := x - l.Mu
	if diff > 0 {
		deriv[0] = 1 / l.Scale
	} else if diff < 0 {
		deriv[0] = -1 / l.Scale
	} else {
		// must be NaN
		deriv[0] = math.NaN()
	}

	deriv[1] = math.Abs(diff)/(l.Scale*l.Scale) - 1/l.Scale
	return deriv
}

// ScoreInput returns the score function with respect to the input of the
// distribution at the input location specified by x. The score function is the
// derivative of the log-likelihood
//
//	(d/dx) log(p(x)) .
//
// Special cases:
//
//	ScoreInput(l.Mu) = NaN
func (l Laplace) ScoreInput(x float64) float64 {
	diff := x - l.Mu
	if diff == 0 {
		return math.NaN()
	}
	if diff > 0 {
		return -1 / l.Scale
	}
	return 1 / l.Scale
}

// Skewness returns the skewness of the distribution.
func (Laplace) Skewness() float64 {
	return 0
}

// StdDev returns the standard deviation of the distribution.
func (l Laplace) StdDev() float64 {
	return math.Sqrt2 * l.Scale
}

// Survival returns the survival function (complementary CDF) at x.
func (l Laplace) Survival(x float64) float64 {
	if x < l.Mu {
		return 1 - 0.5*math.Exp((x-l.Mu)/l.Scale)
	}
	return 0.5 * math.Exp(-(x-l.Mu)/l.Scale)
}

// setParameters modifies the parameters of the distribution.
func (l *Laplace) setParameters(p []Parameter) {
	if len(p) != l.NumParameters() {
		panic(badLength)
	}
	if p[0].Name != "Mu" {
		panic("laplace: " + panicNameMismatch)
	}
	if p[1].Name != "Scale" {
		panic("laplace: " + panicNameMismatch)
	}
	l.Mu = p[0].Value
	l.Scale = p[1].Value
}

// Variance returns the variance of the probability distribution.
func (l Laplace) Variance() float64 {
	return 2 * l.Scale * l.Scale
}
