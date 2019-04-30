package imaging

import (
	"bytes"
	"image"
	"image/color"
	"math"
)

// New creates a new image with the specified width and height, and fills it with the specified color.
func New(width, height int, fillColor color.Color) *image.NRGBA {
	if width <= 0 || height <= 0 {
		return &image.NRGBA{}
	}

	c := color.NRGBAModel.Convert(fillColor).(color.NRGBA)
	if (c == color.NRGBA{0, 0, 0, 0}) {
		return image.NewNRGBA(image.Rect(0, 0, width, height))
	}

	return &image.NRGBA{
		Pix:    bytes.Repeat([]byte{c.R, c.G, c.B, c.A}, width*height),
		Stride: 4 * width,
		Rect:   image.Rect(0, 0, width, height),
	}
}

// Clone returns a copy of the given image.
func Clone(img image.Image) *image.NRGBA {
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, src.w, src.h))
	size := src.w * 4
	parallel(0, src.h, func(ys <-chan int) {
		for y := range ys {
			i := y * dst.Stride
			src.scan(0, y, src.w, y+1, dst.Pix[i:i+size])
		}
	})
	return dst
}

// Anchor is the anchor point for image alignment.
type Anchor int

// Anchor point positions.
const (
	Center Anchor = iota
	TopLeft
	Top
	TopRight
	Left
	Right
	BottomLeft
	Bottom
	BottomRight
)

func anchorPt(b image.Rectangle, w, h int, anchor Anchor) image.Point {
	var x, y int
	switch anchor {
	case TopLeft:
		x = b.Min.X
		y = b.Min.Y
	case Top:
		x = b.Min.X + (b.Dx()-w)/2
		y = b.Min.Y
	case TopRight:
		x = b.Max.X - w
		y = b.Min.Y
	case Left:
		x = b.Min.X
		y = b.Min.Y + (b.Dy()-h)/2
	case Right:
		x = b.Max.X - w
		y = b.Min.Y + (b.Dy()-h)/2
	case BottomLeft:
		x = b.Min.X
		y = b.Max.Y - h
	case Bottom:
		x = b.Min.X + (b.Dx()-w)/2
		y = b.Max.Y - h
	case BottomRight:
		x = b.Max.X - w
		y = b.Max.Y - h
	default:
		x = b.Min.X + (b.Dx()-w)/2
		y = b.Min.Y + (b.Dy()-h)/2
	}
	return image.Pt(x, y)
}

// Crop cuts out a rectangular region with the specified bounds
// from the image and returns the cropped image.
func Crop(img image.Image, rect image.Rectangle) *image.NRGBA {
	r := rect.Intersect(img.Bounds()).Sub(img.Bounds().Min)
	if r.Empty() {
		return &image.NRGBA{}
	}
	src := newScanner(img)
	dst := image.NewNRGBA(image.Rect(0, 0, r.Dx(), r.Dy()))
	rowSize := r.Dx() * 4
	parallel(r.Min.Y, r.Max.Y, func(ys <-chan int) {
		for y := range ys {
			i := (y - r.Min.Y) * dst.Stride
			src.scan(r.Min.X, y, r.Max.X, y+1, dst.Pix[i:i+rowSize])
		}
	})
	return dst
}

// CropAnchor cuts out a rectangular region with the specified size
// from the image using the specified anchor point and returns the cropped image.
func CropAnchor(img image.Image, width, height int, anchor Anchor) *image.NRGBA {
	srcBounds := img.Bounds()
	pt := anchorPt(srcBounds, width, height, anchor)
	r := image.Rect(0, 0, width, height).Add(pt)
	b := srcBounds.Intersect(r)
	return Crop(img, b)
}

// CropCenter cuts out a rectangular region with the specified size
// from the center of the image and returns the cropped image.
func CropCenter(img image.Image, width, height int) *image.NRGBA {
	return CropAnchor(img, width, height, Center)
}

// Paste pastes the img image to the background image at the specified position and returns the combined image.
func Paste(background, img image.Image, pos image.Point) *image.NRGBA {
	dst := Clone(background)
	pos = pos.Sub(background.Bounds().Min)
	pasteRect := image.Rectangle{Min: pos, Max: pos.Add(img.Bounds().Size())}
	interRect := pasteRect.Intersect(dst.Bounds())
	if interRect.Empty() {
		return dst
	}
	src := newScanner(img)
	parallel(interRect.Min.Y, interRect.Max.Y, func(ys <-chan int) {
		for y := range ys {
			x1 := interRect.Min.X - pasteRect.Min.X
			x2 := interRect.Max.X - pasteRect.Min.X
			y1 := y - pasteRect.Min.Y
			y2 := y1 + 1
			i1 := y*dst.Stride + interRect.Min.X*4
			i2 := i1 + interRect.Dx()*4
			src.scan(x1, y1, x2, y2, dst.Pix[i1:i2])
		}
	})
	return dst
}

// PasteCenter pastes the img image to the center of the background image and returns the combined image.
func PasteCenter(background, img image.Image) *image.NRGBA {
	bgBounds := background.Bounds()
	bgW := bgBounds.Dx()
	bgH := bgBounds.Dy()
	bgMinX := bgBounds.Min.X
	bgMinY := bgBounds.Min.Y

	centerX := bgMinX + bgW/2
	centerY := bgMinY + bgH/2

	x0 := centerX - img.Bounds().Dx()/2
	y0 := centerY - img.Bounds().Dy()/2

	return Paste(background, img, image.Pt(x0, y0))
}

// Overlay draws the img image over the background image at given position
// and returns the combined image. Opacity parameter is the opacity of the img
// image layer, used to compose the images, it must be from 0.0 to 1.0.
//
// Examples:
//
//	// Draw spriteImage over backgroundImage at the given position (x=50, y=50).
//	dstImage := imaging.Overlay(backgroundImage, spriteImage, image.Pt(50, 50), 1.0)
//
//	// Blend two opaque images of the same size.
//	dstImage := imaging.Overlay(imageOne, imageTwo, image.Pt(0, 0), 0.5)
//
func Overlay(background, img image.Image, pos image.Point, opacity float64) *image.NRGBA {
	opacity = math.Min(math.Max(opacity, 0.0), 1.0) // Ensure 0.0 <= opacity <= 1.0.
	dst := Clone(background)
	pos = pos.Sub(background.Bounds().Min)
	pasteRect := image.Rectangle{Min: pos, Max: pos.Add(img.Bounds().Size())}
	interRect := pasteRect.Intersect(dst.Bounds())
	if interRect.Empty() {
		return dst
	}
	src := newScanner(img)
	parallel(interRect.Min.Y, interRect.Max.Y, func(ys <-chan int) {
		scanLine := make([]uint8, interRect.Dx()*4)
		for y := range ys {
			x1 := interRect.Min.X - pasteRect.Min.X
			x2 := interRect.Max.X - pasteRect.Min.X
			y1 := y - pasteRect.Min.Y
			y2 := y1 + 1
			src.scan(x1, y1, x2, y2, scanLine)
			i := y*dst.Stride + interRect.Min.X*4
			j := 0
			for x := interRect.Min.X; x < interRect.Max.X; x++ {
				d := dst.Pix[i : i+4 : i+4]
				r1 := float64(d[0])
				g1 := float64(d[1])
				b1 := float64(d[2])
				a1 := float64(d[3])

				s := scanLine[j : j+4 : j+4]
				r2 := float64(s[0])
				g2 := float64(s[1])
				b2 := float64(s[2])
				a2 := float64(s[3])

				coef2 := opacity * a2 / 255
				coef1 := (1 - coef2) * a1 / 255
				coefSum := coef1 + coef2
				coef1 /= coefSum
				coef2 /= coefSum

				d[0] = uint8(r1*coef1 + r2*coef2)
				d[1] = uint8(g1*coef1 + g2*coef2)
				d[2] = uint8(b1*coef1 + b2*coef2)
				d[3] = uint8(math.Min(a1+a2*opacity*(255-a1)/255, 255))

				i += 4
				j += 4
			}
		}
	})
	return dst
}

// OverlayCenter overlays the img image to the center of the background image and
// returns the combined image. Opacity parameter is the opacity of the img
// image layer, used to compose the images, it must be from 0.0 to 1.0.
func OverlayCenter(background, img image.Image, opacity float64) *image.NRGBA {
	bgBounds := background.Bounds()
	bgW := bgBounds.Dx()
	bgH := bgBounds.Dy()
	bgMinX := bgBounds.Min.X
	bgMinY := bgBounds.Min.Y

	centerX := bgMinX + bgW/2
	centerY := bgMinY + bgH/2

	x0 := centerX - img.Bounds().Dx()/2
	y0 := centerY - img.Bounds().Dy()/2

	return Overlay(background, img, image.Point{x0, y0}, opacity)
}
