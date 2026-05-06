package gofpdf

// Adapted from http://www.fpdf.org/en/script/script61.php by Wirus and released with the FPDF license.

// SubWrite prints text from the current position in the same way as Write().
// ht is the line height in the unit of measure specified in New(). str
// specifies the text to write. subFontSize is the size of the font in points.
// subOffset is the vertical offset of the text in points; a positive value
// indicates a superscript, a negative value indicates a subscript. link is the
// identifier returned by AddLink() or 0 for no internal link. linkStr is a
// target URL or empty for no external link. A non--zero value for link takes
// precedence over linkStr.
//
// The SubWrite example demonstrates this method.
func (f *Fpdf) SubWrite(ht float64, str string, subFontSize, subOffset float64, link int, linkStr string) {
	if f.err != nil {
		return
	}
	// resize font
	subFontSizeOld := f.fontSizePt
	f.SetFontSize(subFontSize)
	// reposition y
	subOffset = (((subFontSize - subFontSizeOld) / f.k) * 0.3) + (subOffset / f.k)
	subX := f.x
	subY := f.y
	f.SetXY(subX, subY-subOffset)
	//Output text
	f.write(ht, str, link, linkStr)
	// restore y position
	subX = f.x
	subY = f.y
	f.SetXY(subX, subY+subOffset)
	// restore font size
	f.SetFontSize(subFontSizeOld)
}
