// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
 * Cephes Math Library Release 2.4:  March,1996
 * Copyright 1984, 1996 by Stephen L. Moshier
 */

package cephes

import "math"

// Incbi computes the inverse of the regularized incomplete beta integral.
func Incbi(aa, bb, yy0 float64) float64 {
	var a, b, y0, d, y, x, x0, x1, lgm, yp, di, dithresh, yl, yh, xt float64
	var i, rflg, dir, nflg int

	if yy0 <= 0 {
		return (0.0)
	}
	if yy0 >= 1.0 {
		return (1.0)
	}
	x0 = 0.0
	yl = 0.0
	x1 = 1.0
	yh = 1.0
	nflg = 0

	if aa <= 1.0 || bb <= 1.0 {
		dithresh = 1.0e-6
		rflg = 0
		a = aa
		b = bb
		y0 = yy0
		x = a / (a + b)
		y = Incbet(a, b, x)
		goto ihalve
	} else {
		dithresh = 1.0e-4
	}
	// Approximation to inverse function
	yp = -Ndtri(yy0)

	if yy0 > 0.5 {
		rflg = 1
		a = bb
		b = aa
		y0 = 1.0 - yy0
		yp = -yp
	} else {
		rflg = 0
		a = aa
		b = bb
		y0 = yy0
	}

	lgm = (yp*yp - 3.0) / 6.0
	x = 2.0 / (1.0/(2.0*a-1.0) + 1.0/(2.0*b-1.0))
	d = yp*math.Sqrt(x+lgm)/x - (1.0/(2.0*b-1.0)-1.0/(2.0*a-1.0))*(lgm+5.0/6.0-2.0/(3.0*x))
	d = 2.0 * d
	if d < minLog {
		// mtherr("incbi", UNDERFLOW)
		x = 0
		goto done
	}
	x = a / (a + b*math.Exp(d))
	y = Incbet(a, b, x)
	yp = (y - y0) / y0
	if math.Abs(yp) < 0.2 {
		goto newt
	}

	/* Resort to interval halving if not close enough. */
ihalve:

	dir = 0
	di = 0.5
	for i = 0; i < 100; i++ {
		if i != 0 {
			x = x0 + di*(x1-x0)
			if x == 1.0 {
				x = 1.0 - machEp
			}
			if x == 0.0 {
				di = 0.5
				x = x0 + di*(x1-x0)
				if x == 0.0 {
					// mtherr("incbi", UNDERFLOW)
					goto done
				}
			}
			y = Incbet(a, b, x)
			yp = (x1 - x0) / (x1 + x0)
			if math.Abs(yp) < dithresh {
				goto newt
			}
			yp = (y - y0) / y0
			if math.Abs(yp) < dithresh {
				goto newt
			}
		}
		if y < y0 {
			x0 = x
			yl = y
			if dir < 0 {
				dir = 0
				di = 0.5
			} else if dir > 3 {
				di = 1.0 - (1.0-di)*(1.0-di)
			} else if dir > 1 {
				di = 0.5*di + 0.5
			} else {
				di = (y0 - y) / (yh - yl)
			}
			dir += 1
			if x0 > 0.75 {
				if rflg == 1 {
					rflg = 0
					a = aa
					b = bb
					y0 = yy0
				} else {
					rflg = 1
					a = bb
					b = aa
					y0 = 1.0 - yy0
				}
				x = 1.0 - x
				y = Incbet(a, b, x)
				x0 = 0.0
				yl = 0.0
				x1 = 1.0
				yh = 1.0
				goto ihalve
			}
		} else {
			x1 = x
			if rflg == 1 && x1 < machEp {
				x = 0.0
				goto done
			}
			yh = y
			if dir > 0 {
				dir = 0
				di = 0.5
			} else if dir < -3 {
				di = di * di
			} else if dir < -1 {
				di = 0.5 * di
			} else {
				di = (y - y0) / (yh - yl)
			}
			dir -= 1
		}
	}
	// mtherr("incbi", PLOSS)
	if x0 >= 1.0 {
		x = 1.0 - machEp
		goto done
	}
	if x <= 0.0 {
		// mtherr("incbi", UNDERFLOW)
		x = 0.0
		goto done
	}

newt:
	if nflg > 0 {
		goto done
	}
	nflg = 1
	lgm = lgam(a+b) - lgam(a) - lgam(b)

	for i = 0; i < 8; i++ {
		/* Compute the function at this point. */
		if i != 0 {
			y = Incbet(a, b, x)
		}
		if y < yl {
			x = x0
			y = yl
		} else if y > yh {
			x = x1
			y = yh
		} else if y < y0 {
			x0 = x
			yl = y
		} else {
			x1 = x
			yh = y
		}
		if x == 1.0 || x == 0.0 {
			break
		}
		/* Compute the derivative of the function at this point. */
		d = (a-1.0)*math.Log(x) + (b-1.0)*math.Log(1.0-x) + lgm
		if d < minLog {
			goto done
		}
		if d > maxLog {
			break
		}
		d = math.Exp(d)
		/* Compute the step to the next approximation of x. */
		d = (y - y0) / d
		xt = x - d
		if xt <= x0 {
			y = (x - x0) / (x1 - x0)
			xt = x0 + 0.5*y*(x-x0)
			if xt <= 0.0 {
				break
			}
		}
		if xt >= x1 {
			y = (x1 - x) / (x1 - x0)
			xt = x1 - 0.5*y*(x1-x)
			if xt >= 1.0 {
				break
			}
		}
		x = xt
		if math.Abs(d/x) < 128.0*machEp {
			goto done
		}
	}
	/* Did not converge.  */
	dithresh = 256.0 * machEp
	goto ihalve

done:

	if rflg > 0 {
		if x <= machEp {
			x = 1.0 - machEp
		} else {
			x = 1.0 - x
		}
	}
	return (x)
}

func lgam(a float64) float64 {
	lg, _ := math.Lgamma(a)
	return lg
}
