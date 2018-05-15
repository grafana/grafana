package imaging

import (
	"image"
)

// ConvolveOptions are convolution parameters.
type ConvolveOptions struct {
	// If Normalize is true the kernel is normalized before convolution.
	Normalize bool

	// If Abs is true the absolute value of each color channel is taken after convolution.
	Abs bool

	// Bias is added to each color channel value after convolution.
	Bias int
}

// Convolve3x3 convolves the image with the specified 3x3 convolution kernel.
// Default parameters are used if a nil *ConvolveOptions is passed.
func Convolve3x3(img image.Image, kernel [9]float64, options *ConvolveOptions) *image.NRGBA {
	return convolve(img, kernel[:], options)
}

// Convolve5x5 convolves the image with the specified 5x5 convolution kernel.
// Default parameters are used if a nil *ConvolveOptions is passed.
func Convolve5x5(img image.Image, kernel [25]float64, options *ConvolveOptions) *image.NRGBA {
	return convolve(img, kernel[:], options)
}

func convolve(img image.Image, kernel []float64, options *ConvolveOptions) *image.NRGBA {
	src := toNRGBA(img)
	w := src.Bounds().Max.X
	h := src.Bounds().Max.Y
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))

	if w < 1 || h < 1 {
		return dst
	}

	if options == nil {
		options = &ConvolveOptions{}
	}

	if options.Normalize {
		normalizeKernel(kernel)
	}

	type coef struct {
		x, y int
		k    float64
	}
	var coefs []coef
	var m int

	switch len(kernel) {
	case 9:
		m = 1
	case 25:
		m = 2
	}

	i := 0
	for y := -m; y <= m; y++ {
		for x := -m; x <= m; x++ {
			if kernel[i] != 0 {
				coefs = append(coefs, coef{x: x, y: y, k: kernel[i]})
			}
			i++
		}
	}

	parallel(0, h, func(ys <-chan int) {
		for y := range ys {
			for x := 0; x < w; x++ {
				var r, g, b float64
				for _, c := range coefs {
					ix := x + c.x
					if ix < 0 {
						ix = 0
					} else if ix >= w {
						ix = w - 1
					}

					iy := y + c.y
					if iy < 0 {
						iy = 0
					} else if iy >= h {
						iy = h - 1
					}

					off := iy*src.Stride + ix*4
					r += float64(src.Pix[off+0]) * c.k
					g += float64(src.Pix[off+1]) * c.k
					b += float64(src.Pix[off+2]) * c.k
				}

				if options.Abs {
					if r < 0 {
						r = -r
					}
					if g < 0 {
						g = -g
					}
					if b < 0 {
						b = -b
					}
				}

				if options.Bias != 0 {
					r += float64(options.Bias)
					g += float64(options.Bias)
					b += float64(options.Bias)
				}

				srcOff := y*src.Stride + x*4
				dstOff := y*dst.Stride + x*4
				dst.Pix[dstOff+0] = clamp(r)
				dst.Pix[dstOff+1] = clamp(g)
				dst.Pix[dstOff+2] = clamp(b)
				dst.Pix[dstOff+3] = src.Pix[srcOff+3]
			}
		}
	})

	return dst
}

func normalizeKernel(kernel []float64) {
	var sum, sumpos float64
	for i := range kernel {
		sum += kernel[i]
		if kernel[i] > 0 {
			sumpos += kernel[i]
		}
	}
	if sum != 0 {
		for i := range kernel {
			kernel[i] /= sum
		}
	} else if sumpos != 0 {
		for i := range kernel {
			kernel[i] /= sumpos
		}
	}
}
