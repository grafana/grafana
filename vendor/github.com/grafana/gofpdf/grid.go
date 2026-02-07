package gofpdf

import (
	"math"
	"strconv"
)

func unused(args ...interface{}) {
}

// RGBType holds fields for red, green and blue color components (0..255)
type RGBType struct {
	R, G, B int
}

// RGBAType holds fields for red, green and blue color components (0..255) and
// an alpha transparency value (0..1)
type RGBAType struct {
	R, G, B int
	Alpha   float64
}

// StateType holds various commonly used drawing values for convenient
// retrieval (StateGet()) and restore (Put) methods.
type StateType struct {
	clrDraw, clrText, clrFill RGBType
	lineWd                    float64
	fontSize                  float64
	alpha                     float64
	blendStr                  string
	cellMargin                float64
}

// StateGet returns a variable that contains common state values.
func StateGet(pdf *Fpdf) (st StateType) {
	st.clrDraw.R, st.clrDraw.G, st.clrDraw.B = pdf.GetDrawColor()
	st.clrFill.R, st.clrFill.G, st.clrFill.B = pdf.GetFillColor()
	st.clrText.R, st.clrText.G, st.clrText.B = pdf.GetTextColor()
	st.lineWd = pdf.GetLineWidth()
	_, st.fontSize = pdf.GetFontSize()
	st.alpha, st.blendStr = pdf.GetAlpha()
	st.cellMargin = pdf.GetCellMargin()
	return
}

// Put sets the common state values contained in the state structure
// specified by st.
func (st StateType) Put(pdf *Fpdf) {
	pdf.SetDrawColor(st.clrDraw.R, st.clrDraw.G, st.clrDraw.B)
	pdf.SetFillColor(st.clrFill.R, st.clrFill.G, st.clrFill.B)
	pdf.SetTextColor(st.clrText.R, st.clrText.G, st.clrText.B)
	pdf.SetLineWidth(st.lineWd)
	pdf.SetFontUnitSize(st.fontSize)
	pdf.SetAlpha(st.alpha, st.blendStr)
	pdf.SetCellMargin(st.cellMargin)
}

// TickFormatFncType defines a callback for label drawing.
type TickFormatFncType func(val float64, precision int) string

// defaultFormatter returns the string form of val with precision decimal places.
func defaultFormatter(val float64, precision int) string {
	return strconv.FormatFloat(val, 'f', precision, 64)
}

// GridType assists with the generation of graphs. It allows the application to
// work with logical data coordinates rather than page coordinates and assists
// with the drawing of a background grid.
type GridType struct {
	// Chart coordinates in page units
	x, y, w, h float64
	// X, Y, Wd, Ht float64
	// Slopes and intercepts scale data points to graph coordinates linearly
	xm, xb, ym, yb float64
	// Tickmarks
	xTicks, yTicks []float64
	// Labels are inside of graph boundary
	XLabelIn, YLabelIn bool
	// Labels on X-axis should be rotated
	XLabelRotate bool
	// Formatters; use nil to eliminate labels
	XTickStr, YTickStr TickFormatFncType
	// Subdivisions between tickmarks
	XDiv, YDiv int
	// Formatting precision
	xPrecision, yPrecision int
	// Line and label colors
	ClrText, ClrMain, ClrSub RGBAType
	// Line thickness
	WdMain, WdSub float64
	// Label height in points
	TextSize float64
}

// linear returns the slope and y-intercept of the straight line joining the
// two specified points. For scaling purposes, associate the arguments as
// follows: x1: observed low value, y1: desired low value, x2: observed high
// value, y2: desired high value.
func linear(x1, y1, x2, y2 float64) (slope, intercept float64) {
	if x2 != x1 {
		slope = (y2 - y1) / (x2 - x1)
		intercept = y2 - x2*slope
	}
	return
}

// linearTickmark returns the slope and intercept that will linearly map data
// values (the range of which is specified by the tickmark slice tm) to page
// values (the range of which is specified by lo and hi).
func linearTickmark(tm []float64, lo, hi float64) (slope, intercept float64) {
	ln := len(tm)
	if ln > 0 {
		slope, intercept = linear(tm[0], lo, tm[ln-1], hi)
	}
	return
}

// NewGrid returns a variable of type GridType that is initialized to draw on a
// rectangle of width w and height h with the upper left corner positioned at
// point (x, y). The coordinates are in page units, that is, the same as those
// specified in New().
//
// The returned variable is initialized with a very simple default tickmark
// layout that ranges from 0 to 1 in both axes. Prior to calling Grid(), the
// application may establish a more suitable tickmark layout by calling the
// methods TickmarksContainX() and TickmarksContainY(). These methods bound the
// data range with appropriate boundaries and divisions. Alternatively, if the
// exact extent and divisions of the tickmark layout are known, the methods
// TickmarksExtentX() and TickmarksExtentY may be called instead.
func NewGrid(x, y, w, h float64) (grid GridType) {
	grid.x = x
	grid.y = y
	grid.w = w
	grid.h = h
	grid.TextSize = 7 // Points
	grid.TickmarksExtentX(0, 1, 1)
	grid.TickmarksExtentY(0, 1, 1)
	grid.XLabelIn = false
	grid.YLabelIn = false
	grid.XLabelRotate = false
	grid.XDiv = 10
	grid.YDiv = 10
	grid.ClrText = RGBAType{R: 0, G: 0, B: 0, Alpha: 1}
	grid.ClrMain = RGBAType{R: 128, G: 160, B: 128, Alpha: 1}
	grid.ClrSub = RGBAType{R: 192, G: 224, B: 192, Alpha: 1}
	grid.WdMain = 0.1
	grid.WdSub = 0.1
	grid.YTickStr = defaultFormatter
	grid.XTickStr = defaultFormatter
	return
}

// WdAbs returns the absolute value of dataWd, specified in logical data units,
// that has been converted to the unit of measure specified in New().
func (g GridType) WdAbs(dataWd float64) float64 {
	return math.Abs(g.xm * dataWd)
}

// Wd converts dataWd, specified in logical data units, to the unit of measure
// specified in New().
func (g GridType) Wd(dataWd float64) float64 {
	return g.xm * dataWd
}

// XY converts dataX and dataY, specified in logical data units, to the X and Y
// position on the current page.
func (g GridType) XY(dataX, dataY float64) (x, y float64) {
	return g.xm*dataX + g.xb, g.ym*dataY + g.yb
}

// Pos returns the point, in page units, indicated by the relative positions
// xRel and yRel. These are values between 0 and 1. xRel specifies the relative
// position between the grid's left and right edges. yRel specifies the
// relative position between the grid's bottom and top edges.
func (g GridType) Pos(xRel, yRel float64) (x, y float64) {
	x = g.w*xRel + g.x
	y = g.h*(1-yRel) + g.y
	return
}

// X converts dataX, specified in logical data units, to the X position on the
// current page.
func (g GridType) X(dataX float64) float64 {
	return g.xm*dataX + g.xb
}

// HtAbs returns the absolute value of dataHt, specified in logical data units,
// that has been converted to the unit of measure specified in New().
func (g GridType) HtAbs(dataHt float64) float64 {
	return math.Abs(g.ym * dataHt)
}

// Ht converts dataHt, specified in logical data units, to the unit of measure
// specified in New().
func (g GridType) Ht(dataHt float64) float64 {
	return g.ym * dataHt
}

// Y converts dataY, specified in logical data units, to the Y position on the
// current page.
func (g GridType) Y(dataY float64) float64 {
	return g.ym*dataY + g.yb
}

// XRange returns the minimum and maximum values for the current tickmark
// sequence. These correspond to the data values of the graph's left and right
// edges.
func (g GridType) XRange() (min, max float64) {
	min = g.xTicks[0]
	max = g.xTicks[len(g.xTicks)-1]
	return
}

// YRange returns the minimum and maximum values for the current tickmark
// sequence. These correspond to the data values of the graph's bottom and top
// edges.
func (g GridType) YRange() (min, max float64) {
	min = g.yTicks[0]
	max = g.yTicks[len(g.yTicks)-1]
	return
}

// TickmarksContainX sets the tickmarks to be shown by Grid() in the horizontal
// dimension. The argument min and max specify the minimum and maximum values
// to be contained within the grid. The tickmark values that are generated are
// suitable for general purpose graphs.
//
// See TickmarkExtentX() for an alternative to this method to be used when the
// exact values of the tickmarks are to be set by the application.
func (g *GridType) TickmarksContainX(min, max float64) {
	g.xTicks, g.xPrecision = Tickmarks(min, max)
	g.xm, g.xb = linearTickmark(g.xTicks, g.x, g.x+g.w)
}

// TickmarksContainY sets the tickmarks to be shown by Grid() in the vertical
// dimension. The argument min and max specify the minimum and maximum values
// to be contained within the grid. The tickmark values that are generated are
// suitable for general purpose graphs.
//
// See TickmarkExtentY() for an alternative to this method to be used when the
// exact values of the tickmarks are to be set by the application.
func (g *GridType) TickmarksContainY(min, max float64) {
	g.yTicks, g.yPrecision = Tickmarks(min, max)
	g.ym, g.yb = linearTickmark(g.yTicks, g.y+g.h, g.y)
}

func extent(min, div float64, count int) (tm []float64, precision int) {
	tm = make([]float64, count+1)
	for j := 0; j <= count; j++ {
		tm[j] = min
		min += div
	}
	precision = TickmarkPrecision(div)
	return
}

// TickmarksExtentX sets the tickmarks to be shown by Grid() in the horizontal
// dimension. count specifies number of major tickmark subdivisions to be
// graphed. min specifies the leftmost data value. div specifies, in data
// units, the extent of each major tickmark subdivision.
//
// See TickmarkContainX() for an alternative to this method to be used when
// viewer-friendly tickmarks are to be determined automatically.
func (g *GridType) TickmarksExtentX(min, div float64, count int) {
	g.xTicks, g.xPrecision = extent(min, div, count)
	g.xm, g.xb = linearTickmark(g.xTicks, g.x, g.x+g.w)
}

// TickmarksExtentY sets the tickmarks to be shown by Grid() in the vertical
// dimension. count specifies number of major tickmark subdivisions to be
// graphed. min specifies the bottommost data value. div specifies, in data
// units, the extent of each major tickmark subdivision.
//
// See TickmarkContainY() for an alternative to this method to be used when
// viewer-friendly tickmarks are to be determined automatically.
func (g *GridType) TickmarksExtentY(min, div float64, count int) {
	g.yTicks, g.yPrecision = extent(min, div, count)
	g.ym, g.yb = linearTickmark(g.yTicks, g.y+g.h, g.y)
}

// func (g *GridType) SetXExtent(dataLf, paperLf, dataRt, paperRt float64) {
// 	g.xm, g.xb = linear(dataLf, paperLf, dataRt, paperRt)
// }

// func (g *GridType) SetYExtent(dataTp, paperTp, dataBt, paperBt float64) {
// 	g.ym, g.yb = linear(dataTp, paperTp, dataBt, paperBt)
// }

func lineAttr(pdf *Fpdf, clr RGBAType, lineWd float64) {
	pdf.SetLineWidth(lineWd)
	pdf.SetAlpha(clr.Alpha, "Normal")
	pdf.SetDrawColor(clr.R, clr.G, clr.B)
}

// Grid generates a graph-paperlike set of grid lines on the current page.
func (g GridType) Grid(pdf *Fpdf) {
	var st StateType
	var yLen, xLen int
	var textSz, halfTextSz, yMin, yMax, xMin, xMax, yDiv, xDiv float64
	var str string
	var strOfs, strWd, tp, bt, lf, rt, drawX, drawY float64

	xLen = len(g.xTicks)
	yLen = len(g.yTicks)
	if xLen > 1 && yLen > 1 {

		st = StateGet(pdf)

		line := func(x1, y1, x2, y2 float64, heavy bool) {
			if heavy {
				lineAttr(pdf, g.ClrMain, g.WdMain)
			} else {
				lineAttr(pdf, g.ClrSub, g.WdSub)
			}
			pdf.Line(x1, y1, x2, y2)
		}

		textSz = pdf.PointToUnitConvert(g.TextSize)
		halfTextSz = textSz / 2

		pdf.SetAutoPageBreak(false, 0)
		pdf.SetFontUnitSize(textSz)
		strOfs = pdf.GetStringWidth("0")
		pdf.SetFillColor(255, 255, 255)
		pdf.SetCellMargin(0)

		xMin = g.xTicks[0]
		xMax = g.xTicks[xLen-1]

		yMin = g.yTicks[0]
		yMax = g.yTicks[yLen-1]

		lf = g.X(xMin)
		rt = g.X(xMax)
		bt = g.Y(yMin)
		tp = g.Y(yMax)

		// Verticals along X axis
		xDiv = g.xTicks[1] - g.xTicks[0]
		if g.XDiv > 0 {
			xDiv = xDiv / float64(g.XDiv)
		}
		xDiv = g.Wd(xDiv)
		for j, x := range g.xTicks {
			drawX = g.X(x)
			line(drawX, tp, drawX, bt, true)
			if j < xLen-1 {
				for k := 1; k < g.XDiv; k++ {
					drawX += xDiv
					line(drawX, tp, drawX, bt, false)
				}
			}
		}

		// Horizontals along Y axis
		yDiv = g.yTicks[1] - g.yTicks[0]
		if g.YDiv > 0 {
			yDiv = yDiv / float64(g.YDiv)
		}
		yDiv = g.Ht(yDiv)
		for j, y := range g.yTicks {
			drawY = g.Y(y)
			line(lf, drawY, rt, drawY, true)
			if j < yLen-1 {
				for k := 1; k < g.YDiv; k++ {
					drawY += yDiv
					line(lf, drawY, rt, drawY, false)
				}
			}
		}

		// X labels
		if g.XTickStr != nil {
			drawY = bt
			for _, x := range g.xTicks {
				str = g.XTickStr(x, g.xPrecision)
				strWd = pdf.GetStringWidth(str)
				drawX = g.X(x)
				if g.XLabelRotate {
					pdf.TransformBegin()
					pdf.TransformRotate(90, drawX, drawY)
					if g.XLabelIn {
						pdf.SetXY(drawX+strOfs, drawY-halfTextSz)
					} else {
						pdf.SetXY(drawX-strOfs-strWd, drawY-halfTextSz)
					}
					pdf.CellFormat(strWd, textSz, str, "", 0, "L", true, 0, "")
					pdf.TransformEnd()
				} else {
					drawX -= strWd / 2.0
					if g.XLabelIn {
						pdf.SetXY(drawX, drawY-textSz-strOfs)
					} else {
						pdf.SetXY(drawX, drawY+strOfs)
					}
					pdf.CellFormat(strWd, textSz, str, "", 0, "L", true, 0, "")
				}
			}
		}

		// Y labels
		if g.YTickStr != nil {
			drawX = lf
			for _, y := range g.yTicks {
				// str = strconv.FormatFloat(y, 'f', g.yPrecision, 64)
				str = g.YTickStr(y, g.yPrecision)
				strWd = pdf.GetStringWidth(str)
				if g.YLabelIn {
					pdf.SetXY(drawX+strOfs, g.Y(y)-halfTextSz)
				} else {
					pdf.SetXY(lf-strOfs-strWd, g.Y(y)-halfTextSz)
				}
				pdf.CellFormat(strWd, textSz, str, "", 0, "L", true, 0, "")
			}
		}

		// Restore drawing attributes
		st.Put(pdf)

	}

}

// Plot plots a series of count line segments from xMin to xMax. It repeatedly
// calls fnc(x) to retrieve the y value associate with x. The currently
// selected line drawing attributes are used.
func (g GridType) Plot(pdf *Fpdf, xMin, xMax float64, count int, fnc func(x float64) (y float64)) {
	if count > 0 {
		var x, delta, drawX0, drawY0, drawX1, drawY1 float64
		delta = (xMax - xMin) / float64(count)
		x = xMin
		for j := 0; j <= count; j++ {
			if j == 0 {
				drawX1 = g.X(x)
				drawY1 = g.Y(fnc(x))
			} else {
				pdf.Line(drawX0, drawY0, drawX1, drawY1)
			}
			x += delta
			drawX0 = drawX1
			drawY0 = drawY1
			drawX1 = g.X(x)
			drawY1 = g.Y(fnc(x))
		}
	}
}
