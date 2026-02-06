// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package f32

// GemvN computes
//
//	y = alpha * A * x + beta * y
//
// where A is an m×n dense matrix, x and y are vectors, and alpha and beta are scalars.
func GemvN(m, n uintptr, alpha float32, a []float32, lda uintptr, x []float32, incX uintptr, beta float32, y []float32, incY uintptr) {
	var kx, ky, i uintptr
	if int(incX) < 0 {
		kx = uintptr(-int(n-1) * int(incX))
	}
	if int(incY) < 0 {
		ky = uintptr(-int(m-1) * int(incY))
	}

	if incX == 1 && incY == 1 {
		if beta == 0 {
			for i = 0; i < m; i++ {
				y[i] = alpha * DotUnitary(a[lda*i:lda*i+n], x)
			}
			return
		}
		for i = 0; i < m; i++ {
			y[i] = y[i]*beta + alpha*DotUnitary(a[lda*i:lda*i+n], x)
		}
		return
	}
	iy := ky
	if beta == 0 {
		for i = 0; i < m; i++ {
			y[iy] = alpha * DotInc(x, a[lda*i:lda*i+n], n, incX, 1, kx, 0)
			iy += incY
		}
		return
	}
	for i = 0; i < m; i++ {
		y[iy] = y[iy]*beta + alpha*DotInc(x, a[lda*i:lda*i+n], n, incX, 1, kx, 0)
		iy += incY
	}
}

// GemvT computes
//
//	y = alpha * Aᵀ * x + beta * y
//
// where A is an m×n dense matrix, x and y are vectors, and alpha and beta are scalars.
func GemvT(m, n uintptr, alpha float32, a []float32, lda uintptr, x []float32, incX uintptr, beta float32, y []float32, incY uintptr) {
	var kx, ky, i uintptr
	if int(incX) < 0 {
		kx = uintptr(-int(m-1) * int(incX))
	}
	if int(incY) < 0 {
		ky = uintptr(-int(n-1) * int(incY))
	}
	switch {
	case beta == 0: // beta == 0 is special-cased to memclear
		if incY == 1 {
			for i := range y {
				y[i] = 0
			}
		} else {
			iy := ky
			for i := 0; i < int(n); i++ {
				y[iy] = 0
				iy += incY
			}
		}
	case int(incY) < 0:
		ScalInc(beta, y, n, uintptr(int(-incY)))
	case incY == 1:
		ScalUnitary(beta, y[:n])
	default:
		ScalInc(beta, y, n, incY)
	}

	if incX == 1 && incY == 1 {
		for i = 0; i < m; i++ {
			AxpyUnitaryTo(y, alpha*x[i], a[lda*i:lda*i+n], y)
		}
		return
	}
	ix := kx
	for i = 0; i < m; i++ {
		AxpyInc(alpha*x[ix], a[lda*i:lda*i+n], y, n, 1, incY, 0, ky)
		ix += incX
	}
}
