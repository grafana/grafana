// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// This file is adapted from https://github.com/robpike/ivy/blob/master/value/loop.go.

package apd

import (
	"math"

	"github.com/pkg/errors"
)

type loop struct {
	c             *Context
	name          string // The name of the function we are evaluating.
	i             uint64 // Loop count.
	precision     int32
	maxIterations uint64   // When to give up.
	arg           *Decimal // original argument to function; only used for diagnostic.
	prevZ         *Decimal // Result from the previous iteration.
	delta         *Decimal // |Change| from previous iteration.
}

const digitsToBitsRatio = math.Ln10 / math.Ln2

// newLoop returns a new loop checker. Arguments:
// 	 - name: name of the function being calculated (for error messages)
// 	 - arg: argument to the function (for error messages)
// 	 - precision: desired precision; the loop ends when consecutive estimates
// 	              differ less than the desired precision. Note that typically
// 	              the inner computations in an iteration need higher precision,
// 	              so this is normally lower than the precision in the context.
// 	 - maxItersPerDigit: after this many iterations per digit of precision, the
// 	                     loop ends in error.
func (c *Context) newLoop(name string, arg *Decimal, precision uint32, maxItersPerDigit int) *loop {
	return &loop{
		c:             c,
		name:          name,
		arg:           new(Decimal).Set(arg),
		precision:     int32(precision),
		maxIterations: 10 + uint64(maxItersPerDigit*int(precision)),
		prevZ:         new(Decimal),
		delta:         new(Decimal),
	}
}

// done reports whether the loop is done. If it does not converge
// after the maximum number of iterations, it returns an error.
func (l *loop) done(z *Decimal) (bool, error) {
	if _, err := l.c.Sub(l.delta, l.prevZ, z); err != nil {
		return false, err
	}
	sign := l.delta.Sign()
	if sign == 0 {
		return true, nil
	}
	if sign < 0 {
		// Convergence can oscillate when the calculation is nearly
		// done and we're running out of bits. This stops that.
		// See next comment.
		l.delta.Neg(l.delta)
	}

	// We stop if the delta is smaller than a change of 1 in the
	// (l.precision)-th digit of z. Examples:
	//
	//   p   = 4
	//   z   = 12345.678 = 12345678 * 10^-3
	//   eps =    10.000 = 10^(-4+8-3)
	//
	//   p   = 3
	//   z   = 0.001234 = 1234 * 10^-6
	//   eps = 0.00001  = 10^(-3+4-6)
	eps := Decimal{Coeff: *bigOne, Exponent: -l.precision + int32(z.NumDigits()) + z.Exponent}
	if l.delta.Cmp(&eps) <= 0 {
		return true, nil
	}
	l.i++
	if l.i == l.maxIterations {
		return false, errors.Errorf(
			"%s %s: did not converge after %d iterations; prev,last result %s,%s delta %s precision: %d",
			l.name, l.arg.String(), l.maxIterations, z, l.prevZ, l.delta, l.precision,
		)
	}
	l.prevZ.Set(z)
	return false, nil
}
