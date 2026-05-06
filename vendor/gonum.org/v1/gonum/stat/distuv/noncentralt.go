// Copyright ©2025 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"errors"
	"math"
	"math/rand/v2"

	"gonum.org/v1/gonum/mathext"
)

// NoncentralT is the noncentral t-distribution.
//
// See https://en.wikipedia.org/wiki/Noncentral_t-distribution for more details.
type NoncentralT struct {
	// Nu is the degrees of freedom.
	Nu float64

	// Mu is the noncentral parameter.
	Mu float64

	// Src is the random source used to generate samples.
	Src rand.Source
}

// Rand samples from the noncentral t-distribution.
func (n NoncentralT) Rand() float64 {
	z := n.Mu + rand.New(n.Src).NormFloat64()
	c2 := ChiSquared{K: n.Nu, Src: n.Src}.Rand()
	return z / math.Sqrt(c2/n.Nu)
}

// Mean returns the mean of the noncentral t-distribution.
func (n NoncentralT) Mean() float64 {
	nu := n.Nu
	if nu <= 1 {
		return math.NaN()
	}
	return n.Mu * math.Sqrt(nu/2) * gammaADivB((nu-1)/2, nu/2)
}

// Variance returns the variance of the noncentral t-distribution.
func (n NoncentralT) Variance() float64 {
	nu := n.Nu
	if nu <= 2 {
		return math.NaN()
	}
	mean := n.Mean()
	return nu*(1+n.Mu*n.Mu)/(nu-2) - mean*mean
}

// Prob returns the probability density function of the noncentral t-distribution.
func (n NoncentralT) Prob(x float64) float64 {
	return math.Exp(n.LogProb(x))
}

// LogProb returns the log-probability density function of the noncentral t-distribution.
// This implementation is based on the third form described in
// https://en.wikipedia.org/w/index.php?title=Noncentral_t-distribution&oldid=1251317434#Probability_density_function
func (n NoncentralT) LogProb(x float64) float64 {
	const epsilon = 0x1p-52
	ax := math.Abs(x)
	a := NoncentralT{Nu: n.Nu + 2, Mu: n.Mu}.CDF(x * math.Sqrt(1+2/n.Nu))
	b := n.CDF(x)
	if ax > math.Sqrt(n.Nu*epsilon) {
		return math.Log(n.Nu) - math.Log(ax) + math.Log(math.Abs(a-b))
	}
	return lgamma((n.Nu+1)/2) - lgamma(n.Nu/2) - 0.5*(logPi+math.Log(n.Nu)+n.Mu*n.Mu)
}

// CDF is the cumulative distribution function of the noncentral t-distribution.
// This implementation is based on:
// Russell Lenth, Cumulative Distribution Function of the Non-Central T Distribution, Algorithm AS 243.
func (n NoncentralT) CDF(t float64) float64 {
	df, delta := n.Nu, n.Mu

	const itrmax = 1000
	const errmax = 1e-12

	if df <= 0 {
		return math.NaN()
	}

	var negdel bool
	var del float64
	if t >= 0 {
		negdel, del = false, delta
	} else {
		negdel, del = true, -delta
	}

	// Initialize twin series.
	// Guenther, J. (1978). Statist. Computn. Simuln. vol.6, 199.
	x := t * t / (t*t + df)
	lambda := del * del
	p := 0.5 * math.Exp(-0.5*lambda)
	if p == 0 {
		// We overflowed, so use approximation from equation 26.7.10, Abramowitz & Stegun.
		x := (t*(1-1./(4*df)) - delta) / math.Sqrt(1+t*t/(2*df))
		return normCDF(x, 0, 1, !negdel)
	}
	q := math.Sqrt(2/math.Pi) * p * del
	s := 0.5 - p
	a := 0.5
	b := 0.5 * df
	rxb := math.Pow(1-x, b)
	albeta := math.Log(math.Sqrt(math.Pi)) + lgamma(b) - lgamma(0.5+b)
	xodd := mathext.RegIncBeta(a, b, x)
	godd := 2 * rxb * math.Exp(float64(a*math.Log(x))-albeta)
	xeven := 1 - rxb
	geven := b * x * rxb
	tnc := float64(p*xodd) + float64(q*xeven)

	// Repeat until convergence.
	for en := 1; en <= itrmax; en++ {
		a += 1
		xodd -= godd
		xeven -= geven
		godd *= x * (a + b - 1) / a
		geven *= x * (a + b - 0.5) / (a + 0.5)
		p *= lambda / (2 * float64(en))
		q *= lambda / (float64(2*float64(en)) + 1)
		s -= p
		tnc += float64(p*xodd) + float64(q*xeven)
		errbd := 2 * s * (xodd - godd)
		if math.Abs(errbd) < errmax {
			break
		}

		if s < 0 { // loss of precision
			break
		}
	}

	tnc += normCDF(-del, 0, 1, true)

	if negdel {
		return 1 - tnc
	}
	return tnc
}

// Quantile is the quantile function.
func (n NoncentralT) Quantile(p float64) float64 {
	if n.Nu <= 0 {
		return math.NaN()
	}

	f := func(x float64) float64 { return n.CDF(x) - p }

	// Find a, b where f(a)f(b) < 0.
	// Start the find by making a rough guess assuming a gaussian.
	var guess float64 = 1
	if n.Nu > 3 {
		sigma := math.Sqrt(n.Variance())
		guess = n.Mean() + sigma*mathext.NormalQuantile(p)
	}
	a, b := findBracketMono(f, guess)

	t, err := brent(f, a, b, 1e-13)
	if err != nil {
		return math.NaN()
	}

	return t
}

var (
	errInterval = errors.New("distuv: invalid root bracket")
	errMaxIter  = errors.New("distuv: maximum iterations exceeded")
)

// Brent finds the root of a function using Brent's method.
// The root to be found should lie between [a, b], and will be refined until its accuracy is tol.
// This implementation is based on:
// Numerical Recipes in Fortran 77 2nd Ed., William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery, Vol 1, Section 9.3, page 352.
// https://s3.amazonaws.com/nrbook.com/book_F210.html
//
// See https://en.wikipedia.org/wiki/Brent%27s_method for more details.
func brent(f func(float64) float64, a, b, tol float64) (float64, error) {
	const itmax = 100
	const eps = 0x1p-52

	var d, e, xm float64

	fa, fb := f(a), f(b)
	if (fa > 0 && fb > 0) || (fa < 0 && fb < 0) {
		return 0, errInterval
	}

	c, fc := b, fb
	for range itmax {
		if (fb > 0 && fc > 0) || (fb < 0 && fc < 0) {
			// Rename a, b, c and adjust bounding interval d.
			c, fc = a, fa
			d = b - a
			e = d
		}
		if math.Abs(fc) < math.Abs(fb) {
			a, fa = b, fb
			b, fb = c, fc
			c, fc = a, fa
		}

		// Convergence check.
		var tol1 float64 = 2*eps*math.Abs(b) + 0.5*tol
		xm = 0.5 * (c - b)
		if math.Abs(xm) < tol1 || fb == 0 {
			return b, nil
		}

		if math.Abs(e) >= tol1 && math.Abs(fa) > math.Abs(fb) {
			// Attempt inverse quadratic interpolation.
			var p, q float64
			s := fb / fa
			if a == c {
				p, q = 2*xm*s, 1-s
			} else {
				var r float64
				q, r = fa/fc, fb/fc
				p = s * (2*xm*q*(q-r) - (b-a)*(r-1))
				q = (q - 1) * (r - 1) * (s - 1)
			}

			// Check whether in bounds.
			if p > 0 {
				q = -q
			}

			p = math.Abs(p)
			if 2*p < math.Min(3*xm*q-math.Abs(tol1*q), math.Abs(e*q)) {
				// Accept interpolation.
				e = d
				d = p / q
			} else {
				// Interpolation failed, use bisection.
				d = xm
				e = d
			}
		} else {
			// Bounds decreasing too slowly, use bisection.
			d = xm
			e = d
		}

		// Move last best guess to a.
		a, fa = b, fb
		// Evaluate new trial root.
		if math.Abs(d) > tol1 {
			b += d
		} else {
			b += math.Copysign(tol1, xm)
		}
		fb = f(b)
	}
	return b, errMaxIter
}

// FindBracketMono finds a bracket interval [a, b] where f(a)f(b) < 0.
// f must be a monotonically increasing function.
func findBracketMono(f func(float64) float64, guess float64) (float64, float64) {
	// Make sure initial guess has the same sign as the root.
	f0 := f(0)
	if (guess < 0 && f0 < 0) || (guess > 0 && f0 > 0) {
		guess *= -1
	}

	// r is the rate in which we adjust the interval.
	var r float64
	a, fa := guess, f(guess)
	if (a > 0) == (fa < 0) {
		r = 2
	} else {
		r = 0.5
	}

	b := a * r
	fb := f(b)
	for range 200 {
		if math.Signbit(fa) != math.Signbit(fb) || fa == 0 || fb == 0 {
			break
		}
		a, fa = b, fb
		b *= r
		fb = f(b)
	}

	return a, b
}

func normCDF(x, mu, sigma float64, lowerTail bool) float64 {
	p := 0.5 * math.Erfc(-(x-mu)/(sigma*math.Sqrt2))
	if lowerTail {
		return p
	}
	return 1 - p
}

func lgamma(x float64) float64 {
	y, _ := math.Lgamma(x)
	return y
}

func gammaADivB(a, b float64) float64 {
	var ly float64
	var sign int = 1

	ga, sa := math.Lgamma(a)
	ly, sign = ly+ga, sign*sa

	gb, sb := math.Lgamma(b)
	ly, sign = ly-gb, sign*sb

	return float64(sign) * math.Exp(ly)
}
