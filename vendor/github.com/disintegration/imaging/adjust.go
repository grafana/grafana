package imaging

import (
	"image"
	"image/color"
	"math"
)

// Grayscale produces a grayscale version of the image.
func Grayscale(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, src.w, src.h))
	parallel(0, src.h, func(ys <-chan int) {
		for y := range ys {
			i := y * dst.Stride
			src.scan(0, y, src.w, y+1, dst.Pix[i:i+src.w*4])
			for x := 0; x < src.w; x++ {
				d := dst.Pix[i : i+3 : i+3]
				r := d[0]
				g := d[1]
				b := d[2]
				f := 0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)
				y := uint8(f + 0.5)
				d[0] = y
				d[1] = y
				d[2] = y
				i += 4
			}
		}
	})
	return dst
}

// Invert produces an inverted (negated) version of the image.
func Invert(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, src.w, src.h))
	parallel(0, src.h, func(ys <-chan int) {
		for y := range ys {
			i := y * dst.Stride
			src.scan(0, y, src.w, y+1, dst.Pix[i:i+src.w*4])
			for x := 0; x < src.w; x++ {
				d := dst.Pix[i : i+3 : i+3]
				d[0] = 255 - d[0]
				d[1] = 255 - d[1]
				d[2] = 255 - d[2]
				i += 4
			}
		}
	})
	return dst
}

// AdjustSaturation changes the saturation of the image using the percentage parameter and returns the adjusted image.
// The percentage must be in the range (-100, 100).
// The percentage = 0 gives the original image.
// The percentage = 100 gives the image with the saturation value doubled for each pixel.
// The percentage = -100 gives the image with the saturation value zeroed for each pixel (grayscale).
//
// Examples:
//  dstImage = imaging.AdjustSaturation(srcImage, 25) // Increase image saturation by 25%.
//  dstImage = imaging.AdjustSaturation(srcImage, -10) // Decrease image saturation by 10%.
//
func AdjustSaturation(img image.Image, percentage float64) *image.NRGBA {
	percentage = math.Min(math.Max(percentage, -100), 100)
	multiplier := 1 + percentage/100

	return AdjustFunc(img, func(c color.NRGBA) color.NRGBA {
		h, s, l := rgbToHSL(c.R, c.G, c.B)
		s *= multiplier
		if s > 1 {
			s = 1
		}
		r, g, b := hslToRGB(h, s, l)
		return color.NRGBA{r, g, b, c.A}
	})
}

// AdjustContrast changes the contrast of the image using the percentage parameter and returns the adjusted image.
// The percentage must be in range (-100, 100). The percentage = 0 gives the original image.
// The percentage = -100 gives solid gray image.
//
// Examples:
//
//	dstImage = imaging.AdjustContrast(srcImage, -10) // Decrease image contrast by 10%.
//	dstImage = imaging.AdjustContrast(srcImage, 20) // Increase image contrast by 20%.
//
func AdjustContrast(img image.Image, percentage float64) *image.NRGBA {
	percentage = math.Min(math.Max(percentage, -100.0), 100.0)
	lut := make([]uint8, 256)

	v := (100.0 + percentage) / 100.0
	for i := 0; i < 256; i++ {
		if 0 <= v && v <= 1 {
			lut[i] = clamp((0.5 + (float64(i)/255.0-0.5)*v) * 255.0)
		} else if 1 < v && v < 2 {
			lut[i] = clamp((0.5 + (float64(i)/255.0-0.5)*(1/(2.0-v))) * 255.0)
		} else {
			lut[i] = uint8(float64(i)/255.0+0.5) * 255
		}
	}

	return adjustLUT(img, lut)
}

// AdjustBrightness changes the brightness of the image using the percentage parameter and returns the adjusted image.
// The percentage must be in range (-100, 100). The percentage = 0 gives the original image.
// The percentage = -100 gives solid black image. The percentage = 100 gives solid white image.
//
// Examples:
//
//	dstImage = imaging.AdjustBrightness(srcImage, -15) // Decrease image brightness by 15%.
//	dstImage = imaging.AdjustBrightness(srcImage, 10) // Increase image brightness by 10%.
//
func AdjustBrightness(img image.Image, percentage float64) *image.NRGBA {
	percentage = math.Min(math.Max(percentage, -100.0), 100.0)
	lut := make([]uint8, 256)

	shift := 255.0 * percentage / 100.0
	for i := 0; i < 256; i++ {
		lut[i] = clamp(float64(i) + shift)
	}

	return adjustLUT(img, lut)
}

// AdjustGamma performs a gamma correction on the image and returns the adjusted image.
// Gamma parameter must be positive. Gamma = 1.0 gives the original image.
// Gamma less than 1.0 darkens the image and gamma greater than 1.0 lightens it.
//
// Example:
//
//	dstImage = imaging.AdjustGamma(srcImage, 0.7)
//
func AdjustGamma(img image.Image, gamma float64) *image.NRGBA {
	e := 1.0 / math.Max(gamma, 0.0001)
	lut := make([]uint8, 256)

	for i := 0; i < 256; i++ {
		lut[i] = clamp(math.Pow(float64(i)/255.0, e) * 255.0)
	}

	return adjustLUT(img, lut)
}

// AdjustSigmoid changes the contrast of the image using a sigmoidal function and returns the adjusted image.
// It's a non-linear contrast change useful for photo adjustments as it preserves highlight and shadow detail.
// The midpoint parameter is the midpoint of contrast that must be between 0 and 1, typically 0.5.
// The factor parameter indicates how much to increase or decrease the contrast, typically in range (-10, 10).
// If the factor parameter is positive the image contrast is increased otherwise the contrast is decreased.
//
// Examples:
//
//	dstImage = imaging.AdjustSigmoid(srcImage, 0.5, 3.0) // Increase the contrast.
//	dstImage = imaging.AdjustSigmoid(srcImage, 0.5, -3.0) // Decrease the contrast.
//
func AdjustSigmoid(img image.Image, midpoint, factor float64) *image.NRGBA {
	if factor == 0 {
		return Clone(img)
	}

	lut := make([]uint8, 256)
	a := math.Min(math.Max(midpoint, 0.0), 1.0)
	b := math.Abs(factor)
	sig0 := sigmoid(a, b, 0)
	sig1 := sigmoid(a, b, 1)
	e := 1.0e-6

	if factor > 0 {
		for i := 0; i < 256; i++ {
			x := float64(i) / 255.0
			sigX := sigmoid(a, b, x)
			f := (sigX - sig0) / (sig1 - sig0)
			lut[i] = clamp(f * 255.0)
		}
	} else {
		for i := 0; i < 256; i++ {
			x := float64(i) / 255.0
			arg := math.Min(math.Max((sig1-sig0)*x+sig0, e), 1.0-e)
			f := a - math.Log(1.0/arg-1.0)/b
			lut[i] = clamp(f * 255.0)
		}
	}

	return adjustLUT(img, lut)
}

func sigmoid(a, b, x float64) float64 {
	return 1 / (1 + math.Exp(b*(a-x)))
}

// adjustLUT applies the given lookup table to the colors of the image.
func adjustLUT(img image.Image, lut []uint8) *image.NRGBA {
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, src.w, src.h))
	lut = lut[0:256]
	parallel(0, src.h, func(ys <-chan int) {
		for y := range ys {
			i := y * dst.Stride
			src.scan(0, y, src.w, y+1, dst.Pix[i:i+src.w*4])
			for x := 0; x < src.w; x++ {
				d := dst.Pix[i : i+3 : i+3]
				d[0] = lut[d[0]]
				d[1] = lut[d[1]]
				d[2] = lut[d[2]]
				i += 4
			}
		}
	})
	return dst
}

// AdjustFunc applies the fn function to each pixel of the img image and returns the adjusted image.
//
// Example:
//
//	dstImage = imaging.AdjustFunc(
//		srcImage,
//		func(c color.NRGBA) color.NRGBA {
//			// Shift the red channel by 16.
//			r := int(c.R) + 16
//			if r > 255 {
//				r = 255
//			}
//			return color.NRGBA{uint8(r), c.G, c.B, c.A}
//		}
//	)
//
func AdjustFunc(img image.Image, fn func(c color.NRGBA) color.NRGBA) *image.NRGBA {
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, src.w, src.h))
	parallel(0, src.h, func(ys <-chan int) {
		for y := range ys {
			i := y * dst.Stride
			src.scan(0, y, src.w, y+1, dst.Pix[i:i+src.w*4])
			for x := 0; x < src.w; x++ {
				d := dst.Pix[i : i+4 : i+4]
				r := d[0]
				g := d[1]
				b := d[2]
				a := d[3]
				c := fn(color.NRGBA{r, g, b, a})
				d[0] = c.R
				d[1] = c.G
				d[2] = c.B
				d[3] = c.A
				i += 4
			}
		}
	})
	return dst
}
