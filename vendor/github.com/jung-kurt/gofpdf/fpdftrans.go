package gofpdf

import (
	"fmt"
	"math"
)

// Routines in this file are translated from the work of Moritz Wagner and
// Andreas Würmser.

// TransformMatrix is used for generalized transformations of text, drawings
// and images.
type TransformMatrix struct {
	A, B, C, D, E, F float64
}

// TransformBegin sets up a transformation context for subsequent text,
// drawings and images. The typical usage is to immediately follow a call to
// this method with a call to one or more of the transformation methods such as
// TransformScale(), TransformSkew(), etc. This is followed by text, drawing or
// image output and finally a call to TransformEnd(). All transformation
// contexts must be properly ended prior to outputting the document.
func (f *Fpdf) TransformBegin() {
	f.transformNest++
	f.out("q")
}

// TransformScaleX scales the width of the following text, drawings and images.
// scaleWd is the percentage scaling factor. (x, y) is center of scaling.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformScaleX(scaleWd, x, y float64) {
	f.TransformScale(scaleWd, 100, x, y)
}

// TransformScaleY scales the height of the following text, drawings and
// images. scaleHt is the percentage scaling factor. (x, y) is center of
// scaling.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformScaleY(scaleHt, x, y float64) {
	f.TransformScale(100, scaleHt, x, y)
}

// TransformScaleXY uniformly scales the width and height of the following
// text, drawings and images. s is the percentage scaling factor for both width
// and height. (x, y) is center of scaling.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformScaleXY(s, x, y float64) {
	f.TransformScale(s, s, x, y)
}

// TransformScale generally scales the following text, drawings and images.
// scaleWd and scaleHt are the percentage scaling factors for width and height.
// (x, y) is center of scaling.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformScale(scaleWd, scaleHt, x, y float64) {
	if scaleWd == 0 || scaleHt == 0 {
		f.err = fmt.Errorf("scale factor cannot be zero")
		return
	}
	y = (f.h - y) * f.k
	x *= f.k
	scaleWd /= 100
	scaleHt /= 100
	f.Transform(TransformMatrix{scaleWd, 0, 0,
		scaleHt, x * (1 - scaleWd), y * (1 - scaleHt)})
}

// TransformMirrorHorizontal horizontally mirrors the following text, drawings
// and images. x is the axis of reflection.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformMirrorHorizontal(x float64) {
	f.TransformScale(-100, 100, x, f.y)
}

// TransformMirrorVertical vertically mirrors the following text, drawings and
// images. y is the axis of reflection.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformMirrorVertical(y float64) {
	f.TransformScale(100, -100, f.x, y)
}

// TransformMirrorPoint symmetrically mirrors the following text, drawings and
// images on the point specified by (x, y).
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformMirrorPoint(x, y float64) {
	f.TransformScale(-100, -100, x, y)
}

// TransformMirrorLine symmetrically mirrors the following text, drawings and
// images on the line defined by angle and the point (x, y). angles is
// specified in degrees and measured counter-clockwise from the 3 o'clock
// position.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformMirrorLine(angle, x, y float64) {
	f.TransformScale(-100, 100, x, y)
	f.TransformRotate(-2*(angle-90), x, y)
}

// TransformTranslateX moves the following text, drawings and images
// horizontally by the amount specified by tx.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformTranslateX(tx float64) {
	f.TransformTranslate(tx, 0)
}

// TransformTranslateY moves the following text, drawings and images vertically
// by the amount specified by ty.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformTranslateY(ty float64) {
	f.TransformTranslate(0, ty)
}

// TransformTranslate moves the following text, drawings and images
// horizontally and vertically by the amounts specified by tx and ty.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformTranslate(tx, ty float64) {
	f.Transform(TransformMatrix{1, 0, 0, 1, tx * f.k, -ty * f.k})
}

// TransformRotate rotates the following text, drawings and images around the
// center point (x, y). angle is specified in degrees and measured
// counter-clockwise from the 3 o'clock position.
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformRotate(angle, x, y float64) {
	y = (f.h - y) * f.k
	x *= f.k
	angle = angle * math.Pi / 180
	var tm TransformMatrix
	tm.A = math.Cos(angle)
	tm.B = math.Sin(angle)
	tm.C = -tm.B
	tm.D = tm.A
	tm.E = x + tm.B*y - tm.A*x
	tm.F = y - tm.A*y - tm.B*x
	f.Transform(tm)
}

// TransformSkewX horizontally skews the following text, drawings and images
// keeping the point (x, y) stationary. angleX ranges from -90 degrees (skew to
// the left) to 90 degrees (skew to the right).
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformSkewX(angleX, x, y float64) {
	f.TransformSkew(angleX, 0, x, y)
}

// TransformSkewY vertically skews the following text, drawings and images
// keeping the point (x, y) stationary. angleY ranges from -90 degrees (skew to
// the bottom) to 90 degrees (skew to the top).
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformSkewY(angleY, x, y float64) {
	f.TransformSkew(0, angleY, x, y)
}

// TransformSkew generally skews the following text, drawings and images
// keeping the point (x, y) stationary. angleX ranges from -90 degrees (skew to
// the left) to 90 degrees (skew to the right). angleY ranges from -90 degrees
// (skew to the bottom) to 90 degrees (skew to the top).
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformSkew(angleX, angleY, x, y float64) {
	if angleX <= -90 || angleX >= 90 || angleY <= -90 || angleY >= 90 {
		f.err = fmt.Errorf("skew values must be between -90° and 90°")
		return
	}
	x *= f.k
	y = (f.h - y) * f.k
	var tm TransformMatrix
	tm.A = 1
	tm.B = math.Tan(angleY * math.Pi / 180)
	tm.C = math.Tan(angleX * math.Pi / 180)
	tm.D = 1
	tm.E = -tm.C * y
	tm.F = -tm.B * x
	f.Transform(tm)
}

// Transform generally transforms the following text, drawings and images
// according to the specified matrix. It is typically easier to use the various
// methods such as TransformRotate() and TransformMirrorVertical() instead.
func (f *Fpdf) Transform(tm TransformMatrix) {
	if f.transformNest > 0 {
		f.outf("%.5f %.5f %.5f %.5f %.5f %.5f cm",
			tm.A, tm.B, tm.C, tm.D, tm.E, tm.F)
	} else if f.err == nil {
		f.err = fmt.Errorf("transformation context is not active")
	}
}

// TransformEnd applies a transformation that was begun with a call to TransformBegin().
//
// The TransformBegin() example demonstrates this method.
func (f *Fpdf) TransformEnd() {
	if f.transformNest > 0 {
		f.transformNest--
		f.out("Q")
	} else {
		f.err = fmt.Errorf("error attempting to end transformation operation out of sequence")
	}
}
