// Copyright ©2018 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"

	"gonum.org/v1/gonum/mathext"
)

// Bhattacharyya is a type for computing the Bhattacharyya distance between
// probability distributions.
//
// The Bhattacharyya distance is defined as
//
//	D_B = -ln(BC(l,r))
//	BC = \int_-∞^∞ (p(x)q(x))^(1/2) dx
//
// Where BC is known as the Bhattacharyya coefficient.
// The Bhattacharyya distance is related to the Hellinger distance by
//
//	H(l,r) = sqrt(1-BC(l,r))
//
// For more information, see
//
//	https://en.wikipedia.org/wiki/Bhattacharyya_distance
type Bhattacharyya struct{}

// DistBeta returns the Bhattacharyya distance between Beta distributions l and r.
// For Beta distributions, the Bhattacharyya distance is given by
//
//	-ln(B((α_l + α_r)/2, (β_l + β_r)/2) / (B(α_l,β_l), B(α_r,β_r)))
//
// Where B is the Beta function.
func (Bhattacharyya) DistBeta(l, r Beta) float64 {
	// Reference: https://en.wikipedia.org/wiki/Hellinger_distance#Examples
	return -mathext.Lbeta((l.Alpha+r.Alpha)/2, (l.Beta+r.Beta)/2) +
		0.5*mathext.Lbeta(l.Alpha, l.Beta) + 0.5*mathext.Lbeta(r.Alpha, r.Beta)
}

// DistNormal returns the Bhattacharyya distance Normal distributions l and r.
// For Normal distributions, the Bhattacharyya distance is given by
//
//	s = (σ_l^2 + σ_r^2)/2
//	BC = 1/8 (μ_l-μ_r)^2/s + 1/2 ln(s/(σ_l*σ_r))
func (Bhattacharyya) DistNormal(l, r Normal) float64 {
	// Reference: https://en.wikipedia.org/wiki/Bhattacharyya_distance
	m := l.Mu - r.Mu
	s := (l.Sigma*l.Sigma + r.Sigma*r.Sigma) / 2
	return 0.125*m*m/s + 0.5*math.Log(s) - 0.5*math.Log(l.Sigma) - 0.5*math.Log(r.Sigma)
}

// Hellinger is a type for computing the Hellinger distance between probability
// distributions.
//
// The Hellinger distance is defined as
//
//	H^2(l,r) = 1/2 * int_x (\sqrt(l(x)) - \sqrt(r(x)))^2 dx
//
// and is bounded between 0 and 1. Note the above formula defines the squared
// Hellinger distance, while this returns the Hellinger distance itself.
// The Hellinger distance is related to the Bhattacharyya distance by
//
//	H^2 = 1 - exp(-D_B)
//
// For more information, see
//
//	https://en.wikipedia.org/wiki/Hellinger_distance
type Hellinger struct{}

// DistBeta computes the Hellinger distance between Beta distributions l and r.
// See the documentation of Bhattacharyya.DistBeta for the distance formula.
func (Hellinger) DistBeta(l, r Beta) float64 {
	db := Bhattacharyya{}.DistBeta(l, r)
	return math.Sqrt(-math.Expm1(-db))
}

// DistNormal computes the Hellinger distance between Normal distributions l and r.
// See the documentation of Bhattacharyya.DistNormal for the distance formula.
func (Hellinger) DistNormal(l, r Normal) float64 {
	db := Bhattacharyya{}.DistNormal(l, r)
	return math.Sqrt(-math.Expm1(-db))
}

// KullbackLeibler is a type for computing the Kullback-Leibler divergence from l to r.
//
// The Kullback-Leibler divergence is defined as
//
//	D_KL(l || r ) = \int_x p(x) log(p(x)/q(x)) dx
//
// Note that the Kullback-Leibler divergence is not symmetric with respect to
// the order of the input arguments.
type KullbackLeibler struct{}

// DistBeta returns the Kullback-Leibler divergence between Beta distributions
// l and r.
//
// For two Beta distributions, the KL divergence is computed as
//
//	D_KL(l || r) =  log Γ(α_l+β_l) - log Γ(α_l) - log Γ(β_l)
//	                - log Γ(α_r+β_r) + log Γ(α_r) + log Γ(β_r)
//	                + (α_l-α_r)(ψ(α_l)-ψ(α_l+β_l)) + (β_l-β_r)(ψ(β_l)-ψ(α_l+β_l))
//
// Where Γ is the gamma function and ψ is the digamma function.
func (KullbackLeibler) DistBeta(l, r Beta) float64 {
	// http://bariskurt.com/kullback-leibler-divergence-between-two-dirichlet-and-beta-distributions/
	if l.Alpha <= 0 || l.Beta <= 0 {
		panic("distuv: bad parameters for left distribution")
	}
	if r.Alpha <= 0 || r.Beta <= 0 {
		panic("distuv: bad parameters for right distribution")
	}
	lab := l.Alpha + l.Beta
	l1, _ := math.Lgamma(lab)
	l2, _ := math.Lgamma(l.Alpha)
	l3, _ := math.Lgamma(l.Beta)
	lt := l1 - l2 - l3

	r1, _ := math.Lgamma(r.Alpha + r.Beta)
	r2, _ := math.Lgamma(r.Alpha)
	r3, _ := math.Lgamma(r.Beta)
	rt := r1 - r2 - r3

	d0 := mathext.Digamma(l.Alpha + l.Beta)
	ct := (l.Alpha-r.Alpha)*(mathext.Digamma(l.Alpha)-d0) + (l.Beta-r.Beta)*(mathext.Digamma(l.Beta)-d0)

	return lt - rt + ct
}

// DistNormal returns the Kullback-Leibler divergence between Normal distributions
// l and r.
//
// For two Normal distributions, the KL divergence is computed as
//
//	D_KL(l || r) = log(σ_r / σ_l) + (σ_l^2 + (μ_l-μ_r)^2)/(2 * σ_r^2) - 0.5
func (KullbackLeibler) DistNormal(l, r Normal) float64 {
	d := l.Mu - r.Mu
	v := (l.Sigma*l.Sigma + d*d) / (2 * r.Sigma * r.Sigma)
	return math.Log(r.Sigma) - math.Log(l.Sigma) + v - 0.5
}
