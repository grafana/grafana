// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import (
	"gonum.org/v1/gonum/mathext/internal/cephes"
)

// GammaIncReg computes the regularized incomplete Gamma integral.
//
//	GammaIncReg(a,x) = (1/ Γ(a)) \int_0^x e^{-t} t^{a-1} dt
//
// The input argument a must be positive and x must be non-negative or GammaIncReg
// will panic.
//
// See http://mathworld.wolfram.com/IncompleteGammaFunction.html
// or https://en.wikipedia.org/wiki/Incomplete_gamma_function for more detailed
// information.
func GammaIncReg(a, x float64) float64 {
	return cephes.Igam(a, x)
}

// GammaIncRegComp computes the complemented regularized incomplete Gamma integral.
//
//	GammaIncRegComp(a,x) = 1 - GammaIncReg(a,x)
//	                     = (1/ Γ(a)) \int_x^\infty e^{-t} t^{a-1} dt
//
// The input argument a must be positive and x must be non-negative or
// GammaIncRegComp will panic.
func GammaIncRegComp(a, x float64) float64 {
	return cephes.IgamC(a, x)
}

// GammaIncRegInv computes the inverse of the regularized incomplete Gamma integral. That is,
// it returns the x such that:
//
//	GammaIncReg(a, x) = y
//
// The input argument a must be positive and y must be between 0 and 1
// inclusive or GammaIncRegInv will panic. GammaIncRegInv should return a positive
// number, but can return NaN if there is a failure to converge.
func GammaIncRegInv(a, y float64) float64 {
	return gammaIncRegInv(a, y)
}

// GammaIncRegCompInv computes the inverse of the complemented regularized incomplete Gamma
// integral. That is, it returns the x such that:
//
//	GammaIncRegComp(a, x) = y
//
// The input argument a must be positive and y must be between 0 and 1
// inclusive or GammaIncRegCompInv will panic. GammaIncRegCompInv should return a
// positive number, but can return 0 even with non-zero y due to underflow.
func GammaIncRegCompInv(a, y float64) float64 {
	return cephes.IgamI(a, y)
}
