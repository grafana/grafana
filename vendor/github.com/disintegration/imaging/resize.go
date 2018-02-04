package imaging

import (
	"image"
	"math"
)

type indexWeight struct {
	index  int
	weight float64
}

func precomputeWeights(dstSize, srcSize int, filter ResampleFilter) [][]indexWeight {
	du := float64(srcSize) / float64(dstSize)
	scale := du
	if scale < 1.0 {
		scale = 1.0
	}
	ru := math.Ceil(scale * filter.Support)

	out := make([][]indexWeight, dstSize)
	tmp := make([]indexWeight, 0, dstSize*int(ru+2)*2)

	for v := 0; v < dstSize; v++ {
		fu := (float64(v)+0.5)*du - 0.5

		startu := int(math.Ceil(fu - ru))
		if startu < 0 {
			startu = 0
		}
		endu := int(math.Floor(fu + ru))
		if endu > srcSize-1 {
			endu = srcSize - 1
		}

		var sum float64
		for u := startu; u <= endu; u++ {
			w := filter.Kernel((float64(u) - fu) / scale)
			if w != 0 {
				sum += w
				tmp = append(tmp, indexWeight{index: u, weight: w})
			}
		}
		if sum != 0 {
			for i := range tmp {
				tmp[i].weight /= sum
			}
		}

		out[v] = tmp
		tmp = tmp[len(tmp):]
	}

	return out
}

// Resize resizes the image to the specified width and height using the specified resampling
// filter and returns the transformed image. If one of width or height is 0, the image aspect
// ratio is preserved.
//
// Supported resample filters: NearestNeighbor, Box, Linear, Hermite, MitchellNetravali,
// CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine.
//
// Usage example:
//
//	dstImage := imaging.Resize(srcImage, 800, 600, imaging.Lanczos)
//
func Resize(img image.Image, width, height int, filter ResampleFilter) *image.NRGBA {
	dstW, dstH := width, height

	if dstW < 0 || dstH < 0 {
		return &image.NRGBA{}
	}
	if dstW == 0 && dstH == 0 {
		return &image.NRGBA{}
	}

	src := toNRGBA(img)

	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y

	if srcW <= 0 || srcH <= 0 {
		return &image.NRGBA{}
	}

	// if new width or height is 0 then preserve aspect ratio, minimum 1px
	if dstW == 0 {
		tmpW := float64(dstH) * float64(srcW) / float64(srcH)
		dstW = int(math.Max(1.0, math.Floor(tmpW+0.5)))
	}
	if dstH == 0 {
		tmpH := float64(dstW) * float64(srcH) / float64(srcW)
		dstH = int(math.Max(1.0, math.Floor(tmpH+0.5)))
	}

	var dst *image.NRGBA

	if filter.Support <= 0.0 {
		// nearest-neighbor special case
		dst = resizeNearest(src, dstW, dstH)

	} else {
		// two-pass resize
		if srcW != dstW {
			dst = resizeHorizontal(src, dstW, filter)
		} else {
			dst = src
		}

		if srcH != dstH {
			dst = resizeVertical(dst, dstH, filter)
		}
	}

	return dst
}

func resizeHorizontal(src *image.NRGBA, width int, filter ResampleFilter) *image.NRGBA {
	srcBounds := src.Bounds()
	srcW := srcBounds.Max.X
	srcH := srcBounds.Max.Y

	dstW := width
	dstH := srcH

	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	weights := precomputeWeights(dstW, srcW, filter)

	parallel(dstH, func(partStart, partEnd int) {
		for dstY := partStart; dstY < partEnd; dstY++ {
			i0 := dstY * src.Stride
			j0 := dstY * dst.Stride
			for dstX := 0; dstX < dstW; dstX++ {
				var r, g, b, a float64
				for _, w := range weights[dstX] {
					i := i0 + w.index*4
					aw := float64(src.Pix[i+3]) * w.weight
					r += float64(src.Pix[i+0]) * aw
					g += float64(src.Pix[i+1]) * aw
					b += float64(src.Pix[i+2]) * aw
					a += aw
				}
				if a != 0 {
					aInv := 1 / a
					j := j0 + dstX*4
					dst.Pix[j+0] = clamp(r * aInv)
					dst.Pix[j+1] = clamp(g * aInv)
					dst.Pix[j+2] = clamp(b * aInv)
					dst.Pix[j+3] = clamp(a)
				}
			}
		}
	})

	return dst
}

func resizeVertical(src *image.NRGBA, height int, filter ResampleFilter) *image.NRGBA {
	srcBounds := src.Bounds()
	srcW := srcBounds.Max.X
	srcH := srcBounds.Max.Y

	dstW := srcW
	dstH := height

	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	weights := precomputeWeights(dstH, srcH, filter)

	parallel(dstW, func(partStart, partEnd int) {
		for dstX := partStart; dstX < partEnd; dstX++ {
			for dstY := 0; dstY < dstH; dstY++ {
				var r, g, b, a float64
				for _, w := range weights[dstY] {
					i := w.index*src.Stride + dstX*4
					aw := float64(src.Pix[i+3]) * w.weight
					r += float64(src.Pix[i+0]) * aw
					g += float64(src.Pix[i+1]) * aw
					b += float64(src.Pix[i+2]) * aw
					a += aw
				}
				if a != 0 {
					aInv := 1 / a
					j := dstY*dst.Stride + dstX*4
					dst.Pix[j+0] = clamp(r * aInv)
					dst.Pix[j+1] = clamp(g * aInv)
					dst.Pix[j+2] = clamp(b * aInv)
					dst.Pix[j+3] = clamp(a)
				}
			}
		}
	})

	return dst
}

// resizeNearest is a fast nearest-neighbor resize, no filtering.
func resizeNearest(src *image.NRGBA, width, height int) *image.NRGBA {
	dstW, dstH := width, height

	srcBounds := src.Bounds()
	srcW := srcBounds.Max.X
	srcH := srcBounds.Max.Y

	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	dx := float64(srcW) / float64(dstW)
	dy := float64(srcH) / float64(dstH)

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			srcY := int((float64(dstY) + 0.5) * dy)
			if srcY > srcH-1 {
				srcY = srcH - 1
			}

			for dstX := 0; dstX < dstW; dstX++ {
				srcX := int((float64(dstX) + 0.5) * dx)
				if srcX > srcW-1 {
					srcX = srcW - 1
				}

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// Fit scales down the image using the specified resample filter to fit the specified
// maximum width and height and returns the transformed image.
//
// Supported resample filters: NearestNeighbor, Box, Linear, Hermite, MitchellNetravali,
// CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine.
//
// Usage example:
//
//	dstImage := imaging.Fit(srcImage, 800, 600, imaging.Lanczos)
//
func Fit(img image.Image, width, height int, filter ResampleFilter) *image.NRGBA {
	maxW, maxH := width, height

	if maxW <= 0 || maxH <= 0 {
		return &image.NRGBA{}
	}

	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	if srcW <= 0 || srcH <= 0 {
		return &image.NRGBA{}
	}

	if srcW <= maxW && srcH <= maxH {
		return Clone(img)
	}

	srcAspectRatio := float64(srcW) / float64(srcH)
	maxAspectRatio := float64(maxW) / float64(maxH)

	var newW, newH int
	if srcAspectRatio > maxAspectRatio {
		newW = maxW
		newH = int(float64(newW) / srcAspectRatio)
	} else {
		newH = maxH
		newW = int(float64(newH) * srcAspectRatio)
	}

	return Resize(img, newW, newH, filter)
}

// Fill scales the image to the smallest possible size that will cover the specified dimensions,
// crops the resized image to the specified dimensions using the given anchor point and returns
// the transformed image.
//
// Supported resample filters: NearestNeighbor, Box, Linear, Hermite, MitchellNetravali,
// CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine.
//
// Usage example:
//
//	dstImage := imaging.Fill(srcImage, 800, 600, imaging.Center, imaging.Lanczos)
//
func Fill(img image.Image, width, height int, anchor Anchor, filter ResampleFilter) *image.NRGBA {
	minW, minH := width, height

	if minW <= 0 || minH <= 0 {
		return &image.NRGBA{}
	}

	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	if srcW <= 0 || srcH <= 0 {
		return &image.NRGBA{}
	}

	if srcW == minW && srcH == minH {
		return Clone(img)
	}

	srcAspectRatio := float64(srcW) / float64(srcH)
	minAspectRatio := float64(minW) / float64(minH)

	var tmp *image.NRGBA
	if srcAspectRatio < minAspectRatio {
		tmp = Resize(img, minW, 0, filter)
	} else {
		tmp = Resize(img, 0, minH, filter)
	}

	return CropAnchor(tmp, minW, minH, anchor)
}

// Thumbnail scales the image up or down using the specified resample filter, crops it
// to the specified width and hight and returns the transformed image.
//
// Supported resample filters: NearestNeighbor, Box, Linear, Hermite, MitchellNetravali,
// CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine.
//
// Usage example:
//
//	dstImage := imaging.Thumbnail(srcImage, 100, 100, imaging.Lanczos)
//
func Thumbnail(img image.Image, width, height int, filter ResampleFilter) *image.NRGBA {
	return Fill(img, width, height, Center, filter)
}

// ResampleFilter is a resampling filter struct. It can be used to define custom filters.
//
// Supported resample filters: NearestNeighbor, Box, Linear, Hermite, MitchellNetravali,
// CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine.
//
//	General filter recommendations:
//
//	- Lanczos
//		Probably the best resampling filter for photographic images yielding sharp results,
//		but it's slower than cubic filters (see below).
//
//	- CatmullRom
//		A sharp cubic filter. It's a good filter for both upscaling and downscaling if sharp results are needed.
//
//	- MitchellNetravali
//		A high quality cubic filter that produces smoother results with less ringing than CatmullRom.
//
//	- BSpline
//		A good filter if a very smooth output is needed.
//
//	- Linear
//		Bilinear interpolation filter, produces reasonably good, smooth output. It's faster than cubic filters.
//
//	- Box
//		Simple and fast resampling filter appropriate for downscaling.
//		When upscaling it's similar to NearestNeighbor.
//
//	- NearestNeighbor
//		Fastest resample filter, no antialiasing at all. Rarely used.
//
type ResampleFilter struct {
	Support float64
	Kernel  func(float64) float64
}

// NearestNeighbor is a nearest-neighbor filter (no anti-aliasing).
var NearestNeighbor ResampleFilter

// Box filter (averaging pixels).
var Box ResampleFilter

// Linear filter.
var Linear ResampleFilter

// Hermite cubic spline filter (BC-spline; B=0; C=0).
var Hermite ResampleFilter

// MitchellNetravali is Mitchell-Netravali cubic filter (BC-spline; B=1/3; C=1/3).
var MitchellNetravali ResampleFilter

// CatmullRom is a Catmull-Rom - sharp cubic filter (BC-spline; B=0; C=0.5).
var CatmullRom ResampleFilter

// BSpline is a smooth cubic filter (BC-spline; B=1; C=0).
var BSpline ResampleFilter

// Gaussian is a Gaussian blurring Filter.
var Gaussian ResampleFilter

// Bartlett is a Bartlett-windowed sinc filter (3 lobes).
var Bartlett ResampleFilter

// Lanczos filter (3 lobes).
var Lanczos ResampleFilter

// Hann is a Hann-windowed sinc filter (3 lobes).
var Hann ResampleFilter

// Hamming is a Hamming-windowed sinc filter (3 lobes).
var Hamming ResampleFilter

// Blackman is a Blackman-windowed sinc filter (3 lobes).
var Blackman ResampleFilter

// Welch is a Welch-windowed sinc filter (parabolic window, 3 lobes).
var Welch ResampleFilter

// Cosine is a Cosine-windowed sinc filter (3 lobes).
var Cosine ResampleFilter

func bcspline(x, b, c float64) float64 {
	x = math.Abs(x)
	if x < 1.0 {
		return ((12-9*b-6*c)*x*x*x + (-18+12*b+6*c)*x*x + (6 - 2*b)) / 6
	}
	if x < 2.0 {
		return ((-b-6*c)*x*x*x + (6*b+30*c)*x*x + (-12*b-48*c)*x + (8*b + 24*c)) / 6
	}
	return 0
}

func sinc(x float64) float64 {
	if x == 0 {
		return 1
	}
	return math.Sin(math.Pi*x) / (math.Pi * x)
}

func init() {
	NearestNeighbor = ResampleFilter{
		Support: 0.0, // special case - not applying the filter
	}

	Box = ResampleFilter{
		Support: 0.5,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x <= 0.5 {
				return 1.0
			}
			return 0
		},
	}

	Linear = ResampleFilter{
		Support: 1.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 1.0 {
				return 1.0 - x
			}
			return 0
		},
	}

	Hermite = ResampleFilter{
		Support: 1.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 1.0 {
				return bcspline(x, 0.0, 0.0)
			}
			return 0
		},
	}

	MitchellNetravali = ResampleFilter{
		Support: 2.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 2.0 {
				return bcspline(x, 1.0/3.0, 1.0/3.0)
			}
			return 0
		},
	}

	CatmullRom = ResampleFilter{
		Support: 2.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 2.0 {
				return bcspline(x, 0.0, 0.5)
			}
			return 0
		},
	}

	BSpline = ResampleFilter{
		Support: 2.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 2.0 {
				return bcspline(x, 1.0, 0.0)
			}
			return 0
		},
	}

	Gaussian = ResampleFilter{
		Support: 2.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 2.0 {
				return math.Exp(-2 * x * x)
			}
			return 0
		},
	}

	Bartlett = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * (3.0 - x) / 3.0
			}
			return 0
		},
	}

	Lanczos = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * sinc(x/3.0)
			}
			return 0
		},
	}

	Hann = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * (0.5 + 0.5*math.Cos(math.Pi*x/3.0))
			}
			return 0
		},
	}

	Hamming = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * (0.54 + 0.46*math.Cos(math.Pi*x/3.0))
			}
			return 0
		},
	}

	Blackman = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * (0.42 - 0.5*math.Cos(math.Pi*x/3.0+math.Pi) + 0.08*math.Cos(2.0*math.Pi*x/3.0))
			}
			return 0
		},
	}

	Welch = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * (1.0 - (x * x / 9.0))
			}
			return 0
		},
	}

	Cosine = ResampleFilter{
		Support: 3.0,
		Kernel: func(x float64) float64 {
			x = math.Abs(x)
			if x < 3.0 {
				return sinc(x) * math.Cos((math.Pi/2.0)*(x/3.0))
			}
			return 0
		},
	}
}
