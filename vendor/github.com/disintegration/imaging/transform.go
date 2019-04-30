package imaging

import (
	"image"
	"image/color"
	"math"
)

// FlipH flips the image horizontally (from left to right) and returns the transformed image.
func FlipH(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.w
	dstH := src.h
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcY := dstY
			src.scan(0, srcY, src.w, srcY+1, dst.Pix[i:i+rowSize])
			reverse(dst.Pix[i : i+rowSize])
		}
	})
	return dst
}

// FlipV flips the image vertically (from top to bottom) and returns the transformed image.
func FlipV(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.w
	dstH := src.h
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcY := dstH - dstY - 1
			src.scan(0, srcY, src.w, srcY+1, dst.Pix[i:i+rowSize])
		}
	})
	return dst
}

// Transpose flips the image horizontally and rotates 90 degrees counter-clockwise.
func Transpose(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.h
	dstH := src.w
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcX := dstY
			src.scan(srcX, 0, srcX+1, src.h, dst.Pix[i:i+rowSize])
		}
	})
	return dst
}

// Transverse flips the image vertically and rotates 90 degrees counter-clockwise.
func Transverse(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.h
	dstH := src.w
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcX := dstH - dstY - 1
			src.scan(srcX, 0, srcX+1, src.h, dst.Pix[i:i+rowSize])
			reverse(dst.Pix[i : i+rowSize])
		}
	})
	return dst
}

// Rotate90 rotates the image 90 degrees counter-clockwise and returns the transformed image.
func Rotate90(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.h
	dstH := src.w
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcX := dstH - dstY - 1
			src.scan(srcX, 0, srcX+1, src.h, dst.Pix[i:i+rowSize])
		}
	})
	return dst
}

// Rotate180 rotates the image 180 degrees counter-clockwise and returns the transformed image.
func Rotate180(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.w
	dstH := src.h
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcY := dstH - dstY - 1
			src.scan(0, srcY, src.w, srcY+1, dst.Pix[i:i+rowSize])
			reverse(dst.Pix[i : i+rowSize])
		}
	})
	return dst
}

// Rotate270 rotates the image 270 degrees counter-clockwise and returns the transformed image.
func Rotate270(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dstW := src.h
	dstH := src.w
	rowSize := dstW * 4
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			i := dstY * dst.Stride
			srcX := dstY
			src.scan(srcX, 0, srcX+1, src.h, dst.Pix[i:i+rowSize])
			reverse(dst.Pix[i : i+rowSize])
		}
	})
	return dst
}

// Rotate rotates an image by the given angle counter-clockwise .
// The angle parameter is the rotation angle in degrees.
// The bgColor parameter specifies the color of the uncovered zone after the rotation.
func Rotate(img image.Image, angle float64, bgColor color.Color) *image.NRGBA {
	angle = angle - math.Floor(angle/360)*360

	switch angle {
	case 0:
		return Clone(img)
	case 90:
		return Rotate90(img)
	case 180:
		return Rotate180(img)
	case 270:
		return Rotate270(img)
	}

	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW, dstH := rotatedSize(srcW, srcH, angle)
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	if dstW <= 0 || dstH <= 0 {
		return dst
	}

	srcXOff := float64(srcW)/2 - 0.5
	srcYOff := float64(srcH)/2 - 0.5
	dstXOff := float64(dstW)/2 - 0.5
	dstYOff := float64(dstH)/2 - 0.5

	bgColorNRGBA := color.NRGBAModel.Convert(bgColor).(color.NRGBA)
	sin, cos := math.Sincos(math.Pi * angle / 180)

	parallel(0, dstH, func(ys <-chan int) {
		for dstY := range ys {
			for dstX := 0; dstX < dstW; dstX++ {
				xf, yf := rotatePoint(float64(dstX)-dstXOff, float64(dstY)-dstYOff, sin, cos)
				xf, yf = xf+srcXOff, yf+srcYOff
				interpolatePoint(dst, dstX, dstY, src, xf, yf, bgColorNRGBA)
			}
		}
	})

	return dst
}

func rotatePoint(x, y, sin, cos float64) (float64, float64) {
	return x*cos - y*sin, x*sin + y*cos
}

func rotatedSize(w, h int, angle float64) (int, int) {
	if w <= 0 || h <= 0 {
		return 0, 0
	}

	sin, cos := math.Sincos(math.Pi * angle / 180)
	x1, y1 := rotatePoint(float64(w-1), 0, sin, cos)
	x2, y2 := rotatePoint(float64(w-1), float64(h-1), sin, cos)
	x3, y3 := rotatePoint(0, float64(h-1), sin, cos)

	minx := math.Min(x1, math.Min(x2, math.Min(x3, 0)))
	maxx := math.Max(x1, math.Max(x2, math.Max(x3, 0)))
	miny := math.Min(y1, math.Min(y2, math.Min(y3, 0)))
	maxy := math.Max(y1, math.Max(y2, math.Max(y3, 0)))

	neww := maxx - minx + 1
	if neww-math.Floor(neww) > 0.1 {
		neww++
	}
	newh := maxy - miny + 1
	if newh-math.Floor(newh) > 0.1 {
		newh++
	}

	return int(neww), int(newh)
}

func interpolatePoint(dst *image.NRGBA, dstX, dstY int, src *image.NRGBA, xf, yf float64, bgColor color.NRGBA) {
	j := dstY*dst.Stride + dstX*4
	d := dst.Pix[j : j+4 : j+4]

	x0 := int(math.Floor(xf))
	y0 := int(math.Floor(yf))
	bounds := src.Bounds()
	if !image.Pt(x0, y0).In(image.Rect(bounds.Min.X-1, bounds.Min.Y-1, bounds.Max.X, bounds.Max.Y)) {
		d[0] = bgColor.R
		d[1] = bgColor.G
		d[2] = bgColor.B
		d[3] = bgColor.A
		return
	}

	xq := xf - float64(x0)
	yq := yf - float64(y0)
	points := [4]image.Point{
		{x0, y0},
		{x0 + 1, y0},
		{x0, y0 + 1},
		{x0 + 1, y0 + 1},
	}
	weights := [4]float64{
		(1 - xq) * (1 - yq),
		xq * (1 - yq),
		(1 - xq) * yq,
		xq * yq,
	}

	var r, g, b, a float64
	for i := 0; i < 4; i++ {
		p := points[i]
		w := weights[i]
		if p.In(bounds) {
			i := p.Y*src.Stride + p.X*4
			s := src.Pix[i : i+4 : i+4]
			wa := float64(s[3]) * w
			r += float64(s[0]) * wa
			g += float64(s[1]) * wa
			b += float64(s[2]) * wa
			a += wa
		} else {
			wa := float64(bgColor.A) * w
			r += float64(bgColor.R) * wa
			g += float64(bgColor.G) * wa
			b += float64(bgColor.B) * wa
			a += wa
		}
	}
	if a != 0 {
		aInv := 1 / a
		d[0] = clamp(r * aInv)
		d[1] = clamp(g * aInv)
		d[2] = clamp(b * aInv)
		d[3] = clamp(a)
	}
}
