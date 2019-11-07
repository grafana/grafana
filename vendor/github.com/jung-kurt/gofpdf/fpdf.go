/*
 * Copyright (c) 2013-2014 Kurt Jung (Gmail: kurt.w.jung)
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

package gofpdf

// Version: 1.7
// Date:    2011-06-18
// Author:  Olivier PLATHEY
// Port to Go: Kurt Jung, 2013-07-15

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"math"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

var gl struct {
	catalogSort  bool
	noCompress   bool // Initial zero value indicates compression
	creationDate time.Time
}

type fmtBuffer struct {
	bytes.Buffer
}

func (b *fmtBuffer) printf(fmtStr string, args ...interface{}) {
	b.Buffer.WriteString(fmt.Sprintf(fmtStr, args...))
}

func fpdfNew(orientationStr, unitStr, sizeStr, fontDirStr string, size SizeType) (f *Fpdf) {
	f = new(Fpdf)
	if orientationStr == "" {
		orientationStr = "p"
	} else {
		orientationStr = strings.ToLower(orientationStr)
	}
	if unitStr == "" {
		unitStr = "mm"
	}
	if sizeStr == "" {
		sizeStr = "A4"
	}
	if fontDirStr == "" {
		fontDirStr = "."
	}
	f.page = 0
	f.n = 2
	f.pages = make([]*bytes.Buffer, 0, 8)
	f.pages = append(f.pages, bytes.NewBufferString("")) // pages[0] is unused (1-based)
	f.pageSizes = make(map[int]SizeType)
	f.pageBoxes = make(map[int]map[string]PageBox)
	f.defPageBoxes = make(map[string]PageBox)
	f.state = 0
	f.fonts = make(map[string]fontDefType)
	f.fontFiles = make(map[string]fontFileType)
	f.diffs = make([]string, 0, 8)
	f.templates = make(map[string]Template)
	f.templateObjects = make(map[string]int)
	f.importedObjs = make(map[string][]byte, 0)
	f.importedObjPos = make(map[string]map[int]string, 0)
	f.importedTplObjs = make(map[string]string)
	f.importedTplIDs = make(map[string]int, 0)
	f.images = make(map[string]*ImageInfoType)
	f.pageLinks = make([][]linkType, 0, 8)
	f.pageLinks = append(f.pageLinks, make([]linkType, 0, 0)) // pageLinks[0] is unused (1-based)
	f.links = make([]intLinkType, 0, 8)
	f.links = append(f.links, intLinkType{}) // links[0] is unused (1-based)
	f.aliasMap = make(map[string]string)
	f.inHeader = false
	f.inFooter = false
	f.lasth = 0
	f.fontFamily = ""
	f.fontStyle = ""
	f.SetFontSize(12)
	f.underline = false
	f.setDrawColor(0, 0, 0)
	f.setFillColor(0, 0, 0)
	f.setTextColor(0, 0, 0)
	f.colorFlag = false
	f.ws = 0
	f.fontpath = fontDirStr
	// Core fonts
	f.coreFonts = map[string]bool{
		"courier":      true,
		"helvetica":    true,
		"times":        true,
		"symbol":       true,
		"zapfdingbats": true,
	}
	// Scale factor
	switch unitStr {
	case "pt", "point":
		f.k = 1.0
	case "mm":
		f.k = 72.0 / 25.4
	case "cm":
		f.k = 72.0 / 2.54
	case "in", "inch":
		f.k = 72.0
	default:
		f.err = fmt.Errorf("incorrect unit %s", unitStr)
		return
	}
	f.unitStr = unitStr
	// Page sizes
	f.stdPageSizes = make(map[string]SizeType)
	f.stdPageSizes["a3"] = SizeType{841.89, 1190.55}
	f.stdPageSizes["a4"] = SizeType{595.28, 841.89}
	f.stdPageSizes["a5"] = SizeType{420.94, 595.28}
	f.stdPageSizes["a6"] = SizeType{297.64, 420.94}
	f.stdPageSizes["a2"] = SizeType{1190.55, 1683.78}
	f.stdPageSizes["a1"] = SizeType{1683.78, 2383.94}
	f.stdPageSizes["letter"] = SizeType{612, 792}
	f.stdPageSizes["legal"] = SizeType{612, 1008}
	f.stdPageSizes["tabloid"] = SizeType{792, 1224}
	if size.Wd > 0 && size.Ht > 0 {
		f.defPageSize = size
	} else {
		f.defPageSize = f.getpagesizestr(sizeStr)
		if f.err != nil {
			return
		}
	}
	f.curPageSize = f.defPageSize
	// Page orientation
	switch orientationStr {
	case "p", "portrait":
		f.defOrientation = "P"
		f.w = f.defPageSize.Wd
		f.h = f.defPageSize.Ht
		// dbg("Assign h: %8.2f", f.h)
	case "l", "landscape":
		f.defOrientation = "L"
		f.w = f.defPageSize.Ht
		f.h = f.defPageSize.Wd
	default:
		f.err = fmt.Errorf("incorrect orientation: %s", orientationStr)
		return
	}
	f.curOrientation = f.defOrientation
	f.wPt = f.w * f.k
	f.hPt = f.h * f.k
	// Page margins (1 cm)
	margin := 28.35 / f.k
	f.SetMargins(margin, margin, margin)
	// Interior cell margin (1 mm)
	f.cMargin = margin / 10
	// Line width (0.2 mm)
	f.lineWidth = 0.567 / f.k
	// 	Automatic page break
	f.SetAutoPageBreak(true, 2*margin)
	// Default display mode
	f.SetDisplayMode("default", "default")
	if f.err != nil {
		return
	}
	f.acceptPageBreak = func() bool {
		return f.autoPageBreak
	}
	// Enable compression
	f.SetCompression(!gl.noCompress)
	f.spotColorMap = make(map[string]spotColorType)
	f.blendList = make([]blendModeType, 0, 8)
	f.blendList = append(f.blendList, blendModeType{}) // blendList[0] is unused (1-based)
	f.blendMap = make(map[string]int)
	f.blendMode = "Normal"
	f.alpha = 1
	f.gradientList = make([]gradientType, 0, 8)
	f.gradientList = append(f.gradientList, gradientType{}) // gradientList[0] is unused
	// Set default PDF version number
	f.pdfVersion = "1.3"
	f.SetProducer("FPDF "+cnFpdfVersion, true)
	f.layerInit()
	f.catalogSort = gl.catalogSort
	f.creationDate = gl.creationDate
	f.userUnderlineThickness = 1
	return
}

// NewCustom returns a pointer to a new Fpdf instance. Its methods are
// subsequently called to produce a single PDF document. NewCustom() is an
// alternative to New() that provides additional customization. The PageSize()
// example demonstrates this method.
func NewCustom(init *InitType) (f *Fpdf) {
	return fpdfNew(init.OrientationStr, init.UnitStr, init.SizeStr, init.FontDirStr, init.Size)
}

// New returns a pointer to a new Fpdf instance. Its methods are subsequently
// called to produce a single PDF document.
//
// orientationStr specifies the default page orientation. For portrait mode,
// specify "P" or "Portrait". For landscape mode, specify "L" or "Landscape".
// An empty string will be replaced with "P".
//
// unitStr specifies the unit of length used in size parameters for elements
// other than fonts, which are always measured in points. Specify "pt" for
// point, "mm" for millimeter, "cm" for centimeter, or "in" for inch. An empty
// string will be replaced with "mm".
//
// sizeStr specifies the page size. Acceptable values are "A3", "A4", "A5",
// "Letter", "Legal", or "Tabloid". An empty string will be replaced with "A4".
//
// fontDirStr specifies the file system location in which font resources will
// be found. An empty string is replaced with ".". This argument only needs to
// reference an actual directory if a font other than one of the core
// fonts is used. The core fonts are "courier", "helvetica" (also called
// "arial"), "times", and "zapfdingbats" (also called "symbol").
func New(orientationStr, unitStr, sizeStr, fontDirStr string) (f *Fpdf) {
	return fpdfNew(orientationStr, unitStr, sizeStr, fontDirStr, SizeType{0, 0})
}

// Ok returns true if no processing errors have occurred.
func (f *Fpdf) Ok() bool {
	return f.err == nil
}

// Err returns true if a processing error has occurred.
func (f *Fpdf) Err() bool {
	return f.err != nil
}

// ClearError unsets the internal Fpdf error. This method should be used with
// care, as an internal error condition usually indicates an unrecoverable
// problem with the generation of a document. It is intended to deal with cases
// in which an error is used to select an alternate form of the document.
func (f *Fpdf) ClearError() {
	f.err = nil
}

// SetErrorf sets the internal Fpdf error with formatted text to halt PDF
// generation; this may facilitate error handling by application. If an error
// condition is already set, this call is ignored.
//
// See the documentation for printing in the standard fmt package for details
// about fmtStr and args.
func (f *Fpdf) SetErrorf(fmtStr string, args ...interface{}) {
	if f.err == nil {
		f.err = fmt.Errorf(fmtStr, args...)
	}
}

// String satisfies the fmt.Stringer interface and summarizes the Fpdf
// instance.
func (f *Fpdf) String() string {
	return "Fpdf " + cnFpdfVersion
}

// SetError sets an error to halt PDF generation. This may facilitate error
// handling by application. See also Ok(), Err() and Error().
func (f *Fpdf) SetError(err error) {
	if f.err == nil && err != nil {
		f.err = err
	}
}

// Error returns the internal Fpdf error; this will be nil if no error has occurred.
func (f *Fpdf) Error() error {
	return f.err
}

// GetPageSize returns the current page's width and height. This is the paper's
// size. To compute the size of the area being used, subtract the margins (see
// GetMargins()).
func (f *Fpdf) GetPageSize() (width, height float64) {
	width = f.w
	height = f.h
	return
}

// GetMargins returns the left, top, right, and bottom margins. The first three
// are set with the SetMargins() method. The bottom margin is set with the
// SetAutoPageBreak() method.
func (f *Fpdf) GetMargins() (left, top, right, bottom float64) {
	left = f.lMargin
	top = f.tMargin
	right = f.rMargin
	bottom = f.bMargin
	return
}

// SetMargins defines the left, top and right margins. By default, they equal 1
// cm. Call this method to change them. If the value of the right margin is
// less than zero, it is set to the same as the left margin.
func (f *Fpdf) SetMargins(left, top, right float64) {
	f.lMargin = left
	f.tMargin = top
	if right < 0 {
		right = left
	}
	f.rMargin = right
}

// SetLeftMargin defines the left margin. The method can be called before
// creating the first page. If the current abscissa gets out of page, it is
// brought back to the margin.
func (f *Fpdf) SetLeftMargin(margin float64) {
	f.lMargin = margin
	if f.page > 0 && f.x < margin {
		f.x = margin
	}
}

// GetCellMargin returns the cell margin. This is the amount of space before
// and after the text within a cell that's left blank, and is in units passed
// to New(). It defaults to 1mm.
func (f *Fpdf) GetCellMargin() float64 {
	return f.cMargin
}

// SetCellMargin sets the cell margin. This is the amount of space before and
// after the text within a cell that's left blank, and is in units passed to
// New().
func (f *Fpdf) SetCellMargin(margin float64) {
	f.cMargin = margin
}

// SetPageBoxRec sets the page box for the current page, and any following
// pages. Allowable types are trim, trimbox, crop, cropbox, bleed, bleedbox,
// art and artbox box types are case insensitive. See SetPageBox() for a method
// that specifies the coordinates and extent of the page box individually.
func (f *Fpdf) SetPageBoxRec(t string, pb PageBox) {
	switch strings.ToLower(t) {
	case "trim":
		fallthrough
	case "trimbox":
		t = "TrimBox"
	case "crop":
		fallthrough
	case "cropbox":
		t = "CropBox"
	case "bleed":
		fallthrough
	case "bleedbox":
		t = "BleedBox"
	case "art":
		fallthrough
	case "artbox":
		t = "ArtBox"
	default:
		f.err = fmt.Errorf("%s is not a valid page box type", t)
		return
	}

	pb.X = pb.X * f.k
	pb.Y = pb.Y * f.k
	pb.Wd = (pb.Wd * f.k) + pb.X
	pb.Ht = (pb.Ht * f.k) + pb.Y

	if f.page > 0 {
		f.pageBoxes[f.page][t] = pb
	}

	// always override. page defaults are supplied in addPage function
	f.defPageBoxes[t] = pb
}

// SetPageBox sets the page box for the current page, and any following pages.
// Allowable types are trim, trimbox, crop, cropbox, bleed, bleedbox, art and
// artbox box types are case insensitive.
func (f *Fpdf) SetPageBox(t string, x, y, wd, ht float64) {
	f.SetPageBoxRec(t, PageBox{SizeType{Wd: wd, Ht: ht}, PointType{X: x, Y: y}})
}

// SetPage sets the current page to that of a valid page in the PDF document.
// pageNum is one-based. The SetPage() example demonstrates this method.
func (f *Fpdf) SetPage(pageNum int) {
	if (pageNum > 0) && (pageNum < len(f.pages)) {
		f.page = pageNum
	}
}

// PageCount returns the number of pages currently in the document. Since page
// numbers in gofpdf are one-based, the page count is the same as the page
// number of the current last page.
func (f *Fpdf) PageCount() int {
	return len(f.pages) - 1
}

// SetFontLocation sets the location in the file system of the font and font
// definition files.
func (f *Fpdf) SetFontLocation(fontDirStr string) {
	f.fontpath = fontDirStr
}

// SetFontLoader sets a loader used to read font files (.json and .z) from an
// arbitrary source. If a font loader has been specified, it is used to load
// the named font resources when AddFont() is called. If this operation fails,
// an attempt is made to load the resources from the configured font directory
// (see SetFontLocation()).
func (f *Fpdf) SetFontLoader(loader FontLoader) {
	f.fontLoader = loader
}

// SetHeaderFuncMode sets the function that lets the application render the
// page header. See SetHeaderFunc() for more details. The value for homeMode
// should be set to true to have the current position set to the left and top
// margin after the header function is called.
func (f *Fpdf) SetHeaderFuncMode(fnc func(), homeMode bool) {
	f.headerFnc = fnc
	f.headerHomeMode = homeMode
}

// SetHeaderFunc sets the function that lets the application render the page
// header. The specified function is automatically called by AddPage() and
// should not be called directly by the application. The implementation in Fpdf
// is empty, so you have to provide an appropriate function if you want page
// headers. fnc will typically be a closure that has access to the Fpdf
// instance and other document generation variables.
//
// A header is a convenient place to put background content that repeats on
// each page such as a watermark. When this is done, remember to reset the X
// and Y values so the normal content begins where expected. Including a
// watermark on each page is demonstrated in the example for TransformRotate.
//
// This method is demonstrated in the example for AddPage().
func (f *Fpdf) SetHeaderFunc(fnc func()) {
	f.headerFnc = fnc
}

// SetFooterFunc sets the function that lets the application render the page
// footer. The specified function is automatically called by AddPage() and
// Close() and should not be called directly by the application. The
// implementation in Fpdf is empty, so you have to provide an appropriate
// function if you want page footers. fnc will typically be a closure that has
// access to the Fpdf instance and other document generation variables. See
// SetFooterFuncLpi for a similar function that passes a last page indicator.
//
// This method is demonstrated in the example for AddPage().
func (f *Fpdf) SetFooterFunc(fnc func()) {
	f.footerFnc = fnc
	f.footerFncLpi = nil
}

// SetFooterFuncLpi sets the function that lets the application render the page
// footer. The specified function is automatically called by AddPage() and
// Close() and should not be called directly by the application. It is passed a
// boolean that is true if the last page of the document is being rendered. The
// implementation in Fpdf is empty, so you have to provide an appropriate
// function if you want page footers. fnc will typically be a closure that has
// access to the Fpdf instance and other document generation variables.
func (f *Fpdf) SetFooterFuncLpi(fnc func(lastPage bool)) {
	f.footerFncLpi = fnc
	f.footerFnc = nil
}

// SetTopMargin defines the top margin. The method can be called before
// creating the first page.
func (f *Fpdf) SetTopMargin(margin float64) {
	f.tMargin = margin
}

// SetRightMargin defines the right margin. The method can be called before
// creating the first page.
func (f *Fpdf) SetRightMargin(margin float64) {
	f.rMargin = margin
}

// GetAutoPageBreak returns true if automatic pages breaks are enabled, false
// otherwise. This is followed by the triggering limit from the bottom of the
// page. This value applies only if automatic page breaks are enabled.
func (f *Fpdf) GetAutoPageBreak() (auto bool, margin float64) {
	auto = f.autoPageBreak
	margin = f.bMargin
	return
}

// SetAutoPageBreak enables or disables the automatic page breaking mode. When
// enabling, the second parameter is the distance from the bottom of the page
// that defines the triggering limit. By default, the mode is on and the margin
// is 2 cm.
func (f *Fpdf) SetAutoPageBreak(auto bool, margin float64) {
	f.autoPageBreak = auto
	f.bMargin = margin
	f.pageBreakTrigger = f.h - margin
}

// SetDisplayMode sets advisory display directives for the document viewer.
// Pages can be displayed entirely on screen, occupy the full width of the
// window, use real size, be scaled by a specific zooming factor or use viewer
// default (configured in the Preferences menu of Adobe Reader). The page
// layout can be specified so that pages are displayed individually or in
// pairs.
//
// zoomStr can be "fullpage" to display the entire page on screen, "fullwidth"
// to use maximum width of window, "real" to use real size (equivalent to 100%
// zoom) or "default" to use viewer default mode.
//
// layoutStr can be "single" (or "SinglePage") to display one page at once,
// "continuous" (or "OneColumn") to display pages continuously, "two" (or
// "TwoColumnLeft") to display two pages on two columns with odd-numbered pages
// on the left, or "TwoColumnRight" to display two pages on two columns with
// odd-numbered pages on the right, or "TwoPageLeft" to display pages two at a
// time with odd-numbered pages on the left, or "TwoPageRight" to display pages
// two at a time with odd-numbered pages on the right, or "default" to use
// viewer default mode.
func (f *Fpdf) SetDisplayMode(zoomStr, layoutStr string) {
	if f.err != nil {
		return
	}
	if layoutStr == "" {
		layoutStr = "default"
	}
	switch zoomStr {
	case "fullpage", "fullwidth", "real", "default":
		f.zoomMode = zoomStr
	default:
		f.err = fmt.Errorf("incorrect zoom display mode: %s", zoomStr)
		return
	}
	switch layoutStr {
	case "single", "continuous", "two", "default", "SinglePage", "OneColumn",
		"TwoColumnLeft", "TwoColumnRight", "TwoPageLeft", "TwoPageRight":
		f.layoutMode = layoutStr
	default:
		f.err = fmt.Errorf("incorrect layout display mode: %s", layoutStr)
		return
	}
}

// SetDefaultCompression controls the default setting of the internal
// compression flag. See SetCompression() for more details. Compression is on
// by default.
func SetDefaultCompression(compress bool) {
	gl.noCompress = !compress
}

// SetCompression activates or deactivates page compression with zlib. When
// activated, the internal representation of each page is compressed, which
// leads to a compression ratio of about 2 for the resulting document.
// Compression is on by default.
func (f *Fpdf) SetCompression(compress bool) {
	f.compress = compress
}

// SetProducer defines the producer of the document. isUTF8 indicates if the string
// is encoded in ISO-8859-1 (false) or UTF-8 (true).
func (f *Fpdf) SetProducer(producerStr string, isUTF8 bool) {
	if isUTF8 {
		producerStr = utf8toutf16(producerStr)
	}
	f.producer = producerStr
}

// SetTitle defines the title of the document. isUTF8 indicates if the string
// is encoded in ISO-8859-1 (false) or UTF-8 (true).
func (f *Fpdf) SetTitle(titleStr string, isUTF8 bool) {
	if isUTF8 {
		titleStr = utf8toutf16(titleStr)
	}
	f.title = titleStr
}

// SetSubject defines the subject of the document. isUTF8 indicates if the
// string is encoded in ISO-8859-1 (false) or UTF-8 (true).
func (f *Fpdf) SetSubject(subjectStr string, isUTF8 bool) {
	if isUTF8 {
		subjectStr = utf8toutf16(subjectStr)
	}
	f.subject = subjectStr
}

// SetAuthor defines the author of the document. isUTF8 indicates if the string
// is encoded in ISO-8859-1 (false) or UTF-8 (true).
func (f *Fpdf) SetAuthor(authorStr string, isUTF8 bool) {
	if isUTF8 {
		authorStr = utf8toutf16(authorStr)
	}
	f.author = authorStr
}

// SetKeywords defines the keywords of the document. keywordStr is a
// space-delimited string, for example "invoice August". isUTF8 indicates if
// the string is encoded
func (f *Fpdf) SetKeywords(keywordsStr string, isUTF8 bool) {
	if isUTF8 {
		keywordsStr = utf8toutf16(keywordsStr)
	}
	f.keywords = keywordsStr
}

// SetCreator defines the creator of the document. isUTF8 indicates if the
// string is encoded in ISO-8859-1 (false) or UTF-8 (true).
func (f *Fpdf) SetCreator(creatorStr string, isUTF8 bool) {
	if isUTF8 {
		creatorStr = utf8toutf16(creatorStr)
	}
	f.creator = creatorStr
}

// SetXmpMetadata defines XMP metadata that will be embedded with the document.
func (f *Fpdf) SetXmpMetadata(xmpStream []byte) {
	f.xmp = xmpStream
}

// AliasNbPages defines an alias for the total number of pages. It will be
// substituted as the document is closed. An empty string is replaced with the
// string "{nb}".
//
// See the example for AddPage() for a demonstration of this method.
func (f *Fpdf) AliasNbPages(aliasStr string) {
	if aliasStr == "" {
		aliasStr = "{nb}"
	}
	f.aliasNbPagesStr = aliasStr
}

// RTL enables right-to-left mode
func (f *Fpdf) RTL() {
	f.isRTL = true
}

// LTR disables right-to-left mode
func (f *Fpdf) LTR() {
	f.isRTL = false
}

// open begins a document
func (f *Fpdf) open() {
	f.state = 1
}

// Close terminates the PDF document. It is not necessary to call this method
// explicitly because Output(), OutputAndClose() and OutputFileAndClose() do it
// automatically. If the document contains no page, AddPage() is called to
// prevent the generation of an invalid document.
func (f *Fpdf) Close() {
	if f.err == nil {
		if f.clipNest > 0 {
			f.err = fmt.Errorf("clip procedure must be explicitly ended")
		} else if f.transformNest > 0 {
			f.err = fmt.Errorf("transformation procedure must be explicitly ended")
		}
	}
	if f.err != nil {
		return
	}
	if f.state == 3 {
		return
	}
	if f.page == 0 {
		f.AddPage()
		if f.err != nil {
			return
		}
	}
	// Page footer
	f.inFooter = true
	if f.footerFnc != nil {
		f.footerFnc()
	} else if f.footerFncLpi != nil {
		f.footerFncLpi(true)
	}
	f.inFooter = false

	// Close page
	f.endpage()
	// Close document
	f.enddoc()
	return
}

// PageSize returns the width and height of the specified page in the units
// established in New(). These return values are followed by the unit of
// measure itself. If pageNum is zero or otherwise out of bounds, it returns
// the default page size, that is, the size of the page that would be added by
// AddPage().
func (f *Fpdf) PageSize(pageNum int) (wd, ht float64, unitStr string) {
	sz, ok := f.pageSizes[pageNum]
	if ok {
		sz.Wd, sz.Ht = sz.Wd/f.k, sz.Ht/f.k
	} else {
		sz = f.defPageSize // user units
	}
	return sz.Wd, sz.Ht, f.unitStr
}

// AddPageFormat adds a new page with non-default orientation or size. See
// AddPage() for more details.
//
// See New() for a description of orientationStr.
//
// size specifies the size of the new page in the units established in New().
//
// The PageSize() example demonstrates this method.
func (f *Fpdf) AddPageFormat(orientationStr string, size SizeType) {
	if f.err != nil {
		return
	}
	if f.page != len(f.pages)-1 {
		f.page = len(f.pages) - 1
	}
	if f.state == 0 {
		f.open()
	}
	familyStr := f.fontFamily
	style := f.fontStyle
	if f.underline {
		style += "U"
	}
	fontsize := f.fontSizePt
	lw := f.lineWidth
	dc := f.color.draw
	fc := f.color.fill
	tc := f.color.text
	cf := f.colorFlag

	if f.page > 0 {
		f.inFooter = true
		// Page footer avoid double call on footer.
		if f.footerFnc != nil {
			f.footerFnc()

		} else if f.footerFncLpi != nil {
			f.footerFncLpi(false) // not last page.
		}
		f.inFooter = false
		// Close page
		f.endpage()
	}
	// Start new page
	f.beginpage(orientationStr, size)
	// 	Set line cap style to current value
	// f.out("2 J")
	f.outf("%d J", f.capStyle)
	// 	Set line join style to current value
	f.outf("%d j", f.joinStyle)
	// Set line width
	f.lineWidth = lw
	f.outf("%.2f w", lw*f.k)
	// Set dash pattern
	if len(f.dashArray) > 0 {
		f.outputDashPattern()
	}
	// 	Set font
	if familyStr != "" {
		f.SetFont(familyStr, style, fontsize)
		if f.err != nil {
			return
		}
	}
	// 	Set colors
	f.color.draw = dc
	if dc.str != "0 G" {
		f.out(dc.str)
	}
	f.color.fill = fc
	if fc.str != "0 g" {
		f.out(fc.str)
	}
	f.color.text = tc
	f.colorFlag = cf
	// 	Page header
	if f.headerFnc != nil {
		f.inHeader = true
		f.headerFnc()
		f.inHeader = false
		if f.headerHomeMode {
			f.SetHomeXY()
		}
	}
	// 	Restore line width
	if f.lineWidth != lw {
		f.lineWidth = lw
		f.outf("%.2f w", lw*f.k)
	}
	// Restore font
	if familyStr != "" {
		f.SetFont(familyStr, style, fontsize)
		if f.err != nil {
			return
		}
	}
	// Restore colors
	if f.color.draw.str != dc.str {
		f.color.draw = dc
		f.out(dc.str)
	}
	if f.color.fill.str != fc.str {
		f.color.fill = fc
		f.out(fc.str)
	}
	f.color.text = tc
	f.colorFlag = cf
	return
}

// AddPage adds a new page to the document. If a page is already present, the
// Footer() method is called first to output the footer. Then the page is
// added, the current position set to the top-left corner according to the left
// and top margins, and Header() is called to display the header.
//
// The font which was set before calling is automatically restored. There is no
// need to call SetFont() again if you want to continue with the same font. The
// same is true for colors and line width.
//
// The origin of the coordinate system is at the top-left corner and increasing
// ordinates go downwards.
//
// See AddPageFormat() for a version of this method that allows the page size
// and orientation to be different than the default.
func (f *Fpdf) AddPage() {
	if f.err != nil {
		return
	}
	// dbg("AddPage")
	f.AddPageFormat(f.defOrientation, f.defPageSize)
	return
}

// PageNo returns the current page number.
//
// See the example for AddPage() for a demonstration of this method.
func (f *Fpdf) PageNo() int {
	return f.page
}

func colorComp(v int) (int, float64) {
	if v < 0 {
		v = 0
	} else if v > 255 {
		v = 255
	}
	return v, float64(v) / 255.0
}

func rgbColorValue(r, g, b int, grayStr, fullStr string) (clr colorType) {
	clr.ir, clr.r = colorComp(r)
	clr.ig, clr.g = colorComp(g)
	clr.ib, clr.b = colorComp(b)
	clr.mode = colorModeRGB
	clr.gray = clr.ir == clr.ig && clr.r == clr.b
	if len(grayStr) > 0 {
		if clr.gray {
			clr.str = sprintf("%.3f %s", clr.r, grayStr)
		} else {
			clr.str = sprintf("%.3f %.3f %.3f %s", clr.r, clr.g, clr.b, fullStr)
		}
	} else {
		clr.str = sprintf("%.3f %.3f %.3f", clr.r, clr.g, clr.b)
	}
	return
}

// SetDrawColor defines the color used for all drawing operations (lines,
// rectangles and cell borders). It is expressed in RGB components (0 - 255).
// The method can be called before the first page is created. The value is
// retained from page to page.
func (f *Fpdf) SetDrawColor(r, g, b int) {
	f.setDrawColor(r, g, b)
}

func (f *Fpdf) setDrawColor(r, g, b int) {
	f.color.draw = rgbColorValue(r, g, b, "G", "RG")
	if f.page > 0 {
		f.out(f.color.draw.str)
	}
}

// GetDrawColor returns the most recently set draw color as RGB components (0 -
// 255). This will not be the current value if a draw color of some other type
// (for example, spot) has been more recently set.
func (f *Fpdf) GetDrawColor() (int, int, int) {
	return f.color.draw.ir, f.color.draw.ig, f.color.draw.ib
}

// SetFillColor defines the color used for all filling operations (filled
// rectangles and cell backgrounds). It is expressed in RGB components (0
// -255). The method can be called before the first page is created and the
// value is retained from page to page.
func (f *Fpdf) SetFillColor(r, g, b int) {
	f.setFillColor(r, g, b)
}

func (f *Fpdf) setFillColor(r, g, b int) {
	f.color.fill = rgbColorValue(r, g, b, "g", "rg")
	f.colorFlag = f.color.fill.str != f.color.text.str
	if f.page > 0 {
		f.out(f.color.fill.str)
	}
}

// GetFillColor returns the most recently set fill color as RGB components (0 -
// 255). This will not be the current value if a fill color of some other type
// (for example, spot) has been more recently set.
func (f *Fpdf) GetFillColor() (int, int, int) {
	return f.color.fill.ir, f.color.fill.ig, f.color.fill.ib
}

// SetTextColor defines the color used for text. It is expressed in RGB
// components (0 - 255). The method can be called before the first page is
// created. The value is retained from page to page.
func (f *Fpdf) SetTextColor(r, g, b int) {
	f.setTextColor(r, g, b)
}

func (f *Fpdf) setTextColor(r, g, b int) {
	f.color.text = rgbColorValue(r, g, b, "g", "rg")
	f.colorFlag = f.color.fill.str != f.color.text.str
}

// GetTextColor returns the most recently set text color as RGB components (0 -
// 255). This will not be the current value if a text color of some other type
// (for example, spot) has been more recently set.
func (f *Fpdf) GetTextColor() (int, int, int) {
	return f.color.text.ir, f.color.text.ig, f.color.text.ib
}

// GetStringWidth returns the length of a string in user units. A font must be
// currently selected.
func (f *Fpdf) GetStringWidth(s string) float64 {
	if f.err != nil {
		return 0
	}
	w := f.GetStringSymbolWidth(s)
	return float64(w) * f.fontSize / 1000
}

// GetStringSymbolWidth returns the length of a string in glyf units. A font must be
// currently selected.
func (f *Fpdf) GetStringSymbolWidth(s string) int {
	if f.err != nil {
		return 0
	}
	w := 0
	if f.isCurrentUTF8 {
		unicode := []rune(s)
		for _, char := range unicode {
			intChar := int(char)
			if len(f.currentFont.Cw) >= intChar && f.currentFont.Cw[intChar] > 0 {
				if f.currentFont.Cw[intChar] != 65535 {
					w += f.currentFont.Cw[intChar]
				}
			} else if f.currentFont.Desc.MissingWidth != 0 {
				w += f.currentFont.Desc.MissingWidth
			} else {
				w += 500
			}
		}
	} else {
		for _, ch := range []byte(s) {
			if ch == 0 {
				break
			}
			w += f.currentFont.Cw[ch]
		}
	}
	return w
}

// SetLineWidth defines the line width. By default, the value equals 0.2 mm.
// The method can be called before the first page is created. The value is
// retained from page to page.
func (f *Fpdf) SetLineWidth(width float64) {
	f.setLineWidth(width)
}

func (f *Fpdf) setLineWidth(width float64) {
	f.lineWidth = width
	if f.page > 0 {
		f.outf("%.2f w", width*f.k)
	}
}

// GetLineWidth returns the current line thickness.
func (f *Fpdf) GetLineWidth() float64 {
	return f.lineWidth
}

// SetLineCapStyle defines the line cap style. styleStr should be "butt",
// "round" or "square". A square style projects from the end of the line. The
// method can be called before the first page is created. The value is
// retained from page to page.
func (f *Fpdf) SetLineCapStyle(styleStr string) {
	var capStyle int
	switch styleStr {
	case "round":
		capStyle = 1
	case "square":
		capStyle = 2
	default:
		capStyle = 0
	}
	f.capStyle = capStyle
	if f.page > 0 {
		f.outf("%d J", f.capStyle)
	}
}

// SetLineJoinStyle defines the line cap style. styleStr should be "miter",
// "round" or "bevel". The method can be called before the first page
// is created. The value is retained from page to page.
func (f *Fpdf) SetLineJoinStyle(styleStr string) {
	var joinStyle int
	switch styleStr {
	case "round":
		joinStyle = 1
	case "bevel":
		joinStyle = 2
	default:
		joinStyle = 0
	}
	f.joinStyle = joinStyle
	if f.page > 0 {
		f.outf("%d j", f.joinStyle)
	}
}

// SetDashPattern sets the dash pattern that is used to draw lines. The
// dashArray elements are numbers that specify the lengths, in units
// established in New(), of alternating dashes and gaps. The dash phase
// specifies the distance into the dash pattern at which to start the dash. The
// dash pattern is retained from page to page. Call this method with an empty
// array to restore solid line drawing.
//
// The Beziergon() example demonstrates this method.
func (f *Fpdf) SetDashPattern(dashArray []float64, dashPhase float64) {
	scaled := make([]float64, len(dashArray))
	for i, value := range dashArray {
		scaled[i] = value * f.k
	}
	dashPhase *= f.k

	f.dashArray = scaled
	f.dashPhase = dashPhase
	if f.page > 0 {
		f.outputDashPattern()
	}

}

func (f *Fpdf) outputDashPattern() {
	var buf bytes.Buffer
	buf.WriteByte('[')
	for i, value := range f.dashArray {
		if i > 0 {
			buf.WriteByte(' ')
		}
		buf.WriteString(strconv.FormatFloat(value, 'f', 2, 64))
	}
	buf.WriteString("] ")
	buf.WriteString(strconv.FormatFloat(f.dashPhase, 'f', 2, 64))
	buf.WriteString(" d")
	f.outbuf(&buf)
}

// Line draws a line between points (x1, y1) and (x2, y2) using the current
// draw color, line width and cap style.
func (f *Fpdf) Line(x1, y1, x2, y2 float64) {
	f.outf("%.2f %.2f m %.2f %.2f l S", x1*f.k, (f.h-y1)*f.k, x2*f.k, (f.h-y2)*f.k)
}

// fillDrawOp corrects path painting operators
func fillDrawOp(styleStr string) (opStr string) {
	switch strings.ToUpper(styleStr) {
	case "", "D":
		// Stroke the path.
		opStr = "S"
	case "F":
		// fill the path, using the nonzero winding number rule
		opStr = "f"
	case "F*":
		// fill the path, using the even-odd rule
		opStr = "f*"
	case "FD", "DF":
		// fill and then stroke the path, using the nonzero winding number rule
		opStr = "B"
	case "FD*", "DF*":
		// fill and then stroke the path, using the even-odd rule
		opStr = "B*"
	default:
		opStr = styleStr
	}
	return
}

// Rect outputs a rectangle of width w and height h with the upper left corner
// positioned at point (x, y).
//
// It can be drawn (border only), filled (with no border) or both. styleStr can
// be "F" for filled, "D" for outlined only, or "DF" or "FD" for outlined and
// filled. An empty string will be replaced with "D". Drawing uses the current
// draw color and line width centered on the rectangle's perimeter. Filling
// uses the current fill color.
func (f *Fpdf) Rect(x, y, w, h float64, styleStr string) {
	f.outf("%.2f %.2f %.2f %.2f re %s", x*f.k, (f.h-y)*f.k, w*f.k, -h*f.k, fillDrawOp(styleStr))
}

// RoundedRect outputs a rectangle of width w and height h with the upper left
// corner positioned at point (x, y). It can be drawn (border only), filled
// (with no border) or both. styleStr can be "F" for filled, "D" for outlined
// only, or "DF" or "FD" for outlined and filled. An empty string will be
// replaced with "D". Drawing uses the current draw color and line width
// centered on the rectangle's perimeter. Filling uses the current fill color.
// The rounded corners of the rectangle are specified by radius r. corners is a
// string that includes "1" to round the upper left corner, "2" to round the
// upper right corner, "3" to round the lower right corner, and "4" to round
// the lower left corner. The RoundedRect example demonstrates this method.
func (f *Fpdf) RoundedRect(x, y, w, h, r float64, corners string, stylestr string) {
	// This routine was adapted by Brigham Thompson from a script by Christophe Prugnaud
	k := f.k
	hp := f.h
	myArc := r * (4.0 / 3.0) * (math.Sqrt2 - 1.0)
	f.outf("q %.5f %.5f m", (x+r)*k, (hp-y)*k)
	xc := x + w - r
	yc := y + r
	f.outf("%.5f %.5f l", xc*k, (hp-y)*k)
	if strings.Contains(corners, "2") == false {
		f.outf("%.5f %.5f l", (x+w)*k, (hp-y)*k)
	} else {
		f.clipArc(xc+myArc, yc-r, xc+r, yc-myArc, xc+r, yc)
	}
	xc = x + w - r
	yc = y + h - r
	f.outf("%.5f %.5f l", (x+w)*k, (hp-yc)*k)
	if strings.Contains(corners, "3") == false {
		f.outf("%.5f %.5f l", (x+w)*k, (hp-(y+h))*k)
	} else {
		f.clipArc(xc+r, yc+myArc, xc+myArc, yc+r, xc, yc+r)
	}
	xc = x + r
	yc = y + h - r
	f.outf("%.5f %.5f l", xc*k, (hp-(y+h))*k)
	if strings.Contains(corners, "4") == false {
		f.outf("%.5f %.5f l", x*k, (hp-(y+h))*k)
	} else {
		f.clipArc(xc-myArc, yc+r, xc-r, yc+myArc, xc-r, yc)
	}
	xc = x + r
	yc = y + r
	f.outf("%.5f %.5f l", x*k, (hp-yc)*k)
	if strings.Contains(corners, "1") == false {
		f.outf("%.5f %.5f l", x*k, (hp-y)*k)
		f.outf("%.5f %.5f l", (x+r)*k, (hp-y)*k)
	} else {
		f.clipArc(xc-r, yc-myArc, xc-myArc, yc-r, xc, yc-r)
	}
	f.out(fillDrawOp(stylestr))
}

// Circle draws a circle centered on point (x, y) with radius r.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color and line width centered on the circle's perimeter.
// Filling uses the current fill color.
func (f *Fpdf) Circle(x, y, r float64, styleStr string) {
	f.Ellipse(x, y, r, r, 0, styleStr)
}

// Ellipse draws an ellipse centered at point (x, y). rx and ry specify its
// horizontal and vertical radii.
//
// degRotate specifies the counter-clockwise angle in degrees that the ellipse
// will be rotated.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color and line width centered on the ellipse's perimeter.
// Filling uses the current fill color.
//
// The Circle() example demonstrates this method.
func (f *Fpdf) Ellipse(x, y, rx, ry, degRotate float64, styleStr string) {
	f.arc(x, y, rx, ry, degRotate, 0, 360, styleStr, false)
}

// Polygon draws a closed figure defined by a series of vertices specified by
// points. The x and y fields of the points use the units established in New().
// The last point in the slice will be implicitly joined to the first to close
// the polygon.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color and line width centered on the ellipse's perimeter.
// Filling uses the current fill color.
func (f *Fpdf) Polygon(points []PointType, styleStr string) {
	if len(points) > 2 {
		for j, pt := range points {
			if j == 0 {
				f.point(pt.X, pt.Y)
			} else {
				f.outf("%.5f %.5f l ", pt.X*f.k, (f.h-pt.Y)*f.k)
			}
		}
		f.outf("%.5f %.5f l ", points[0].X*f.k, (f.h-points[0].Y)*f.k)
		f.DrawPath(styleStr)
	}
}

// Beziergon draws a closed figure defined by a series of cubic Bézier curve
// segments. The first point in the slice defines the starting point of the
// figure. Each three following points p1, p2, p3 represent a curve segment to
// the point p3 using p1 and p2 as the Bézier control points.
//
// The x and y fields of the points use the units established in New().
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color and line width centered on the ellipse's perimeter.
// Filling uses the current fill color.
func (f *Fpdf) Beziergon(points []PointType, styleStr string) {

	// Thanks, Robert Lillack, for contributing this function.

	if len(points) < 4 {
		return
	}
	f.point(points[0].XY())

	points = points[1:]
	for len(points) >= 3 {
		cx0, cy0 := points[0].XY()
		cx1, cy1 := points[1].XY()
		x1, y1 := points[2].XY()
		f.curve(cx0, cy0, cx1, cy1, x1, y1)
		points = points[3:]
	}

	f.DrawPath(styleStr)
}

// point outputs current point
func (f *Fpdf) point(x, y float64) {
	f.outf("%.2f %.2f m", x*f.k, (f.h-y)*f.k)
}

// curve outputs a single cubic Bézier curve segment from current point
func (f *Fpdf) curve(cx0, cy0, cx1, cy1, x, y float64) {
	// Thanks, Robert Lillack, for straightening this out
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c", cx0*f.k, (f.h-cy0)*f.k, cx1*f.k,
		(f.h-cy1)*f.k, x*f.k, (f.h-y)*f.k)
}

// Curve draws a single-segment quadratic Bézier curve. The curve starts at
// the point (x0, y0) and ends at the point (x1, y1). The control point (cx,
// cy) specifies the curvature. At the start point, the curve is tangent to the
// straight line between the start point and the control point. At the end
// point, the curve is tangent to the straight line between the end point and
// the control point.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color, line width, and cap style centered on the curve's
// path. Filling uses the current fill color.
//
// The Circle() example demonstrates this method.
func (f *Fpdf) Curve(x0, y0, cx, cy, x1, y1 float64, styleStr string) {
	f.point(x0, y0)
	f.outf("%.5f %.5f %.5f %.5f v %s", cx*f.k, (f.h-cy)*f.k, x1*f.k, (f.h-y1)*f.k,
		fillDrawOp(styleStr))
}

// CurveCubic draws a single-segment cubic Bézier curve. This routine performs
// the same function as CurveBezierCubic() but has a nonstandard argument order.
// It is retained to preserve backward compatibility.
func (f *Fpdf) CurveCubic(x0, y0, cx0, cy0, x1, y1, cx1, cy1 float64, styleStr string) {
	// f.point(x0, y0)
	// f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c %s", cx0*f.k, (f.h-cy0)*f.k,
	// cx1*f.k, (f.h-cy1)*f.k, x1*f.k, (f.h-y1)*f.k, fillDrawOp(styleStr))
	f.CurveBezierCubic(x0, y0, cx0, cy0, cx1, cy1, x1, y1, styleStr)
}

// CurveBezierCubic draws a single-segment cubic Bézier curve. The curve starts at
// the point (x0, y0) and ends at the point (x1, y1). The control points (cx0,
// cy0) and (cx1, cy1) specify the curvature. At the start point, the curve is
// tangent to the straight line between the start point and the control point
// (cx0, cy0). At the end point, the curve is tangent to the straight line
// between the end point and the control point (cx1, cy1).
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color, line width, and cap style centered on the curve's
// path. Filling uses the current fill color.
//
// This routine performs the same function as CurveCubic() but uses standard
// argument order.
//
// The Circle() example demonstrates this method.
func (f *Fpdf) CurveBezierCubic(x0, y0, cx0, cy0, cx1, cy1, x1, y1 float64, styleStr string) {
	f.point(x0, y0)
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c %s", cx0*f.k, (f.h-cy0)*f.k,
		cx1*f.k, (f.h-cy1)*f.k, x1*f.k, (f.h-y1)*f.k, fillDrawOp(styleStr))
}

// Arc draws an elliptical arc centered at point (x, y). rx and ry specify its
// horizontal and vertical radii.
//
// degRotate specifies the angle that the arc will be rotated. degStart and
// degEnd specify the starting and ending angle of the arc. All angles are
// specified in degrees and measured counter-clockwise from the 3 o'clock
// position.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color, line width, and cap style centered on the arc's
// path. Filling uses the current fill color.
//
// The Circle() example demonstrates this method.
func (f *Fpdf) Arc(x, y, rx, ry, degRotate, degStart, degEnd float64, styleStr string) {
	f.arc(x, y, rx, ry, degRotate, degStart, degEnd, styleStr, false)
}

// GetAlpha returns the alpha blending channel, which consists of the
// alpha transparency value and the blend mode. See SetAlpha for more
// details.
func (f *Fpdf) GetAlpha() (alpha float64, blendModeStr string) {
	return f.alpha, f.blendMode
}

// SetAlpha sets the alpha blending channel. The blending effect applies to
// text, drawings and images.
//
// alpha must be a value between 0.0 (fully transparent) to 1.0 (fully opaque).
// Values outside of this range result in an error.
//
// blendModeStr must be one of "Normal", "Multiply", "Screen", "Overlay",
// "Darken", "Lighten", "ColorDodge", "ColorBurn","HardLight", "SoftLight",
// "Difference", "Exclusion", "Hue", "Saturation", "Color", or "Luminosity". An
// empty string is replaced with "Normal".
//
// To reset normal rendering after applying a blending mode, call this method
// with alpha set to 1.0 and blendModeStr set to "Normal".
func (f *Fpdf) SetAlpha(alpha float64, blendModeStr string) {
	if f.err != nil {
		return
	}
	var bl blendModeType
	switch blendModeStr {
	case "Normal", "Multiply", "Screen", "Overlay",
		"Darken", "Lighten", "ColorDodge", "ColorBurn", "HardLight", "SoftLight",
		"Difference", "Exclusion", "Hue", "Saturation", "Color", "Luminosity":
		bl.modeStr = blendModeStr
	case "":
		bl.modeStr = "Normal"
	default:
		f.err = fmt.Errorf("unrecognized blend mode \"%s\"", blendModeStr)
		return
	}
	if alpha < 0.0 || alpha > 1.0 {
		f.err = fmt.Errorf("alpha value (0.0 - 1.0) is out of range: %.3f", alpha)
		return
	}
	f.alpha = alpha
	f.blendMode = blendModeStr
	alphaStr := sprintf("%.3f", alpha)
	keyStr := sprintf("%s %s", alphaStr, blendModeStr)
	pos, ok := f.blendMap[keyStr]
	if !ok {
		pos = len(f.blendList) // at least 1
		f.blendList = append(f.blendList, blendModeType{alphaStr, alphaStr, blendModeStr, 0})
		f.blendMap[keyStr] = pos
	}
	f.outf("/GS%d gs", pos)
}

func (f *Fpdf) gradientClipStart(x, y, w, h float64) {
	// Save current graphic state and set clipping area
	f.outf("q %.2f %.2f %.2f %.2f re W n", x*f.k, (f.h-y)*f.k, w*f.k, -h*f.k)
	// Set up transformation matrix for gradient
	f.outf("%.5f 0 0 %.5f %.5f %.5f cm", w*f.k, h*f.k, x*f.k, (f.h-(y+h))*f.k)
}

func (f *Fpdf) gradientClipEnd() {
	// Restore previous graphic state
	f.out("Q")
}

func (f *Fpdf) gradient(tp, r1, g1, b1, r2, g2, b2 int, x1, y1, x2, y2, r float64) {
	pos := len(f.gradientList)
	clr1 := rgbColorValue(r1, g1, b1, "", "")
	clr2 := rgbColorValue(r2, g2, b2, "", "")
	f.gradientList = append(f.gradientList, gradientType{tp, clr1.str, clr2.str,
		x1, y1, x2, y2, r, 0})
	f.outf("/Sh%d sh", pos)
}

// LinearGradient draws a rectangular area with a blending of one color to
// another. The rectangle is of width w and height h. Its upper left corner is
// positioned at point (x, y).
//
// Each color is specified with three component values, one each for red, green
// and blue. The values range from 0 to 255. The first color is specified by
// (r1, g1, b1) and the second color by (r2, g2, b2).
//
// The blending is controlled with a gradient vector that uses normalized
// coordinates in which the lower left corner is position (0, 0) and the upper
// right corner is (1, 1). The vector's origin and destination are specified by
// the points (x1, y1) and (x2, y2). In a linear gradient, blending occurs
// perpendicularly to the vector. The vector does not necessarily need to be
// anchored on the rectangle edge. Color 1 is used up to the origin of the
// vector and color 2 is used beyond the vector's end point. Between the points
// the colors are gradually blended.
func (f *Fpdf) LinearGradient(x, y, w, h float64, r1, g1, b1, r2, g2, b2 int, x1, y1, x2, y2 float64) {
	f.gradientClipStart(x, y, w, h)
	f.gradient(2, r1, g1, b1, r2, g2, b2, x1, y1, x2, y2, 0)
	f.gradientClipEnd()
}

// RadialGradient draws a rectangular area with a blending of one color to
// another. The rectangle is of width w and height h. Its upper left corner is
// positioned at point (x, y).
//
// Each color is specified with three component values, one each for red, green
// and blue. The values range from 0 to 255. The first color is specified by
// (r1, g1, b1) and the second color by (r2, g2, b2).
//
// The blending is controlled with a point and a circle, both specified with
// normalized coordinates in which the lower left corner of the rendered
// rectangle is position (0, 0) and the upper right corner is (1, 1). Color 1
// begins at the origin point specified by (x1, y1). Color 2 begins at the
// circle specified by the center point (x2, y2) and radius r. Colors are
// gradually blended from the origin to the circle. The origin and the circle's
// center do not necessarily have to coincide, but the origin must be within
// the circle to avoid rendering problems.
//
// The LinearGradient() example demonstrates this method.
func (f *Fpdf) RadialGradient(x, y, w, h float64, r1, g1, b1, r2, g2, b2 int, x1, y1, x2, y2, r float64) {
	f.gradientClipStart(x, y, w, h)
	f.gradient(3, r1, g1, b1, r2, g2, b2, x1, y1, x2, y2, r)
	f.gradientClipEnd()
}

// ClipRect begins a rectangular clipping operation. The rectangle is of width
// w and height h. Its upper left corner is positioned at point (x, y). outline
// is true to draw a border with the current draw color and line width centered
// on the rectangle's perimeter. Only the outer half of the border will be
// shown. After calling this method, all rendering operations (for example,
// Image(), LinearGradient(), etc) will be clipped by the specified rectangle.
// Call ClipEnd() to restore unclipped operations.
//
// This ClipText() example demonstrates this method.
func (f *Fpdf) ClipRect(x, y, w, h float64, outline bool) {
	f.clipNest++
	f.outf("q %.2f %.2f %.2f %.2f re W %s", x*f.k, (f.h-y)*f.k, w*f.k, -h*f.k, strIf(outline, "S", "n"))
}

// ClipText begins a clipping operation in which rendering is confined to the
// character string specified by txtStr. The origin (x, y) is on the left of
// the first character at the baseline. The current font is used. outline is
// true to draw a border with the current draw color and line width centered on
// the perimeters of the text characters. Only the outer half of the border
// will be shown. After calling this method, all rendering operations (for
// example, Image(), LinearGradient(), etc) will be clipped. Call ClipEnd() to
// restore unclipped operations.
func (f *Fpdf) ClipText(x, y float64, txtStr string, outline bool) {
	f.clipNest++
	f.outf("q BT %.5f %.5f Td %d Tr (%s) Tj ET", x*f.k, (f.h-y)*f.k, intIf(outline, 5, 7), f.escape(txtStr))
}

func (f *Fpdf) clipArc(x1, y1, x2, y2, x3, y3 float64) {
	h := f.h
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c ", x1*f.k, (h-y1)*f.k,
		x2*f.k, (h-y2)*f.k, x3*f.k, (h-y3)*f.k)
}

// ClipRoundedRect begins a rectangular clipping operation. The rectangle is of
// width w and height h. Its upper left corner is positioned at point (x, y).
// The rounded corners of the rectangle are specified by radius r. outline is
// true to draw a border with the current draw color and line width centered on
// the rectangle's perimeter. Only the outer half of the border will be shown.
// After calling this method, all rendering operations (for example, Image(),
// LinearGradient(), etc) will be clipped by the specified rectangle. Call
// ClipEnd() to restore unclipped operations.
//
// This ClipText() example demonstrates this method.
func (f *Fpdf) ClipRoundedRect(x, y, w, h, r float64, outline bool) {
	f.clipNest++
	k := f.k
	hp := f.h
	myArc := (4.0 / 3.0) * (math.Sqrt2 - 1.0)
	f.outf("q %.5f %.5f m", (x+r)*k, (hp-y)*k)
	xc := x + w - r
	yc := y + r
	f.outf("%.5f %.5f l", xc*k, (hp-y)*k)
	f.clipArc(xc+r*myArc, yc-r, xc+r, yc-r*myArc, xc+r, yc)
	xc = x + w - r
	yc = y + h - r
	f.outf("%.5f %.5f l", (x+w)*k, (hp-yc)*k)
	f.clipArc(xc+r, yc+r*myArc, xc+r*myArc, yc+r, xc, yc+r)
	xc = x + r
	yc = y + h - r
	f.outf("%.5f %.5f l", xc*k, (hp-(y+h))*k)
	f.clipArc(xc-r*myArc, yc+r, xc-r, yc+r*myArc, xc-r, yc)
	xc = x + r
	yc = y + r
	f.outf("%.5f %.5f l", x*k, (hp-yc)*k)
	f.clipArc(xc-r, yc-r*myArc, xc-r*myArc, yc-r, xc, yc-r)
	f.outf(" W %s", strIf(outline, "S", "n"))
}

// ClipEllipse begins an elliptical clipping operation. The ellipse is centered
// at (x, y). Its horizontal and vertical radii are specified by rx and ry.
// outline is true to draw a border with the current draw color and line width
// centered on the ellipse's perimeter. Only the outer half of the border will
// be shown. After calling this method, all rendering operations (for example,
// Image(), LinearGradient(), etc) will be clipped by the specified ellipse.
// Call ClipEnd() to restore unclipped operations.
//
// This ClipText() example demonstrates this method.
func (f *Fpdf) ClipEllipse(x, y, rx, ry float64, outline bool) {
	f.clipNest++
	lx := (4.0 / 3.0) * rx * (math.Sqrt2 - 1)
	ly := (4.0 / 3.0) * ry * (math.Sqrt2 - 1)
	k := f.k
	h := f.h
	f.outf("q %.5f %.5f m %.5f %.5f %.5f %.5f %.5f %.5f c",
		(x+rx)*k, (h-y)*k,
		(x+rx)*k, (h-(y-ly))*k,
		(x+lx)*k, (h-(y-ry))*k,
		x*k, (h-(y-ry))*k)
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c",
		(x-lx)*k, (h-(y-ry))*k,
		(x-rx)*k, (h-(y-ly))*k,
		(x-rx)*k, (h-y)*k)
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c",
		(x-rx)*k, (h-(y+ly))*k,
		(x-lx)*k, (h-(y+ry))*k,
		x*k, (h-(y+ry))*k)
	f.outf("%.5f %.5f %.5f %.5f %.5f %.5f c W %s",
		(x+lx)*k, (h-(y+ry))*k,
		(x+rx)*k, (h-(y+ly))*k,
		(x+rx)*k, (h-y)*k,
		strIf(outline, "S", "n"))
}

// ClipCircle begins a circular clipping operation. The circle is centered at
// (x, y) and has radius r. outline is true to draw a border with the current
// draw color and line width centered on the circle's perimeter. Only the outer
// half of the border will be shown. After calling this method, all rendering
// operations (for example, Image(), LinearGradient(), etc) will be clipped by
// the specified circle. Call ClipEnd() to restore unclipped operations.
//
// The ClipText() example demonstrates this method.
func (f *Fpdf) ClipCircle(x, y, r float64, outline bool) {
	f.ClipEllipse(x, y, r, r, outline)
}

// ClipPolygon begins a clipping operation within a polygon. The figure is
// defined by a series of vertices specified by points. The x and y fields of
// the points use the units established in New(). The last point in the slice
// will be implicitly joined to the first to close the polygon. outline is true
// to draw a border with the current draw color and line width centered on the
// polygon's perimeter. Only the outer half of the border will be shown. After
// calling this method, all rendering operations (for example, Image(),
// LinearGradient(), etc) will be clipped by the specified polygon. Call
// ClipEnd() to restore unclipped operations.
//
// The ClipText() example demonstrates this method.
func (f *Fpdf) ClipPolygon(points []PointType, outline bool) {
	f.clipNest++
	var s fmtBuffer
	h := f.h
	k := f.k
	s.printf("q ")
	for j, pt := range points {
		s.printf("%.5f %.5f %s ", pt.X*k, (h-pt.Y)*k, strIf(j == 0, "m", "l"))
	}
	s.printf("h W %s", strIf(outline, "S", "n"))
	f.out(s.String())
}

// ClipEnd ends a clipping operation that was started with a call to
// ClipRect(), ClipRoundedRect(), ClipText(), ClipEllipse(), ClipCircle() or
// ClipPolygon(). Clipping operations can be nested. The document cannot be
// successfully output while a clipping operation is active.
//
// The ClipText() example demonstrates this method.
func (f *Fpdf) ClipEnd() {
	if f.err == nil {
		if f.clipNest > 0 {
			f.clipNest--
			f.out("Q")
		} else {
			f.err = fmt.Errorf("error attempting to end clip operation out of sequence")
		}
	}
}

// AddFont imports a TrueType, OpenType or Type1 font and makes it available.
// It is necessary to generate a font definition file first with the makefont
// utility. It is not necessary to call this function for the core PDF fonts
// (courier, helvetica, times, zapfdingbats).
//
// The JSON definition file (and the font file itself when embedding) must be
// present in the font directory. If it is not found, the error "Could not
// include font definition file" is set.
//
// family specifies the font family. The name can be chosen arbitrarily. If it
// is a standard family name, it will override the corresponding font. This
// string is used to subsequently set the font with the SetFont method.
//
// style specifies the font style. Acceptable values are (case insensitive) the
// empty string for regular style, "B" for bold, "I" for italic, or "BI" or
// "IB" for bold and italic combined.
//
// fileStr specifies the base name with ".json" extension of the font
// definition file to be added. The file will be loaded from the font directory
// specified in the call to New() or SetFontLocation().
func (f *Fpdf) AddFont(familyStr, styleStr, fileStr string) {
	f.addFont(familyStr, styleStr, fileStr, false)
}

// AddUTF8Font imports a TrueType font with utf-8 symbols and makes it available.
// It is necessary to generate a font definition file first with the makefont
// utility. It is not necessary to call this function for the core PDF fonts
// (courier, helvetica, times, zapfdingbats).
//
// The JSON definition file (and the font file itself when embedding) must be
// present in the font directory. If it is not found, the error "Could not
// include font definition file" is set.
//
// family specifies the font family. The name can be chosen arbitrarily. If it
// is a standard family name, it will override the corresponding font. This
// string is used to subsequently set the font with the SetFont method.
//
// style specifies the font style. Acceptable values are (case insensitive) the
// empty string for regular style, "B" for bold, "I" for italic, or "BI" or
// "IB" for bold and italic combined.
//
// fileStr specifies the base name with ".json" extension of the font
// definition file to be added. The file will be loaded from the font directory
// specified in the call to New() or SetFontLocation().
func (f *Fpdf) AddUTF8Font(familyStr, styleStr, fileStr string) {
	f.addFont(familyStr, styleStr, fileStr, true)
}

func (f *Fpdf) addFont(familyStr, styleStr, fileStr string, isUTF8 bool) {
	if fileStr == "" {
		if isUTF8 {
			fileStr = strings.Replace(familyStr, " ", "", -1) + strings.ToLower(styleStr) + ".ttf"
		} else {
			fileStr = strings.Replace(familyStr, " ", "", -1) + strings.ToLower(styleStr) + ".json"
		}
	}
	if isUTF8 {
		fontKey := getFontKey(familyStr, styleStr)
		_, ok := f.fonts[fontKey]
		if ok {
			return
		}
		var ttfStat os.FileInfo
		var err error
		fileStr = path.Join(f.fontpath, fileStr)
		ttfStat, err = os.Stat(fileStr)
		if err != nil {
			f.SetError(err)
			return
		}
		originalSize := ttfStat.Size()
		Type := "UTF8"
		var utf8Bytes []byte
		utf8Bytes, err = ioutil.ReadFile(fileStr)
		if err != nil {
			f.SetError(err)
			return
		}
		reader := fileReader{readerPosition: 0, array: utf8Bytes}
		utf8File := newUTF8Font(&reader)
		err = utf8File.parseFile()
		if err != nil {
			f.SetError(err)
			return
		}

		desc := FontDescType{
			Ascent:       int(utf8File.Ascent),
			Descent:      int(utf8File.Descent),
			CapHeight:    utf8File.CapHeight,
			Flags:        utf8File.Flags,
			FontBBox:     utf8File.Bbox,
			ItalicAngle:  utf8File.ItalicAngle,
			StemV:        utf8File.StemV,
			MissingWidth: round(utf8File.DefaultWidth),
		}

		var sbarr map[int]int
		if f.aliasNbPagesStr == "" {
			sbarr = makeSubsetRange(57)
		} else {
			sbarr = makeSubsetRange(32)
		}
		def := fontDefType{
			Tp:        Type,
			Name:      fontKey,
			Desc:      desc,
			Up:        int(round(utf8File.UnderlinePosition)),
			Ut:        round(utf8File.UnderlineThickness),
			Cw:        utf8File.CharWidths,
			usedRunes: sbarr,
			File:      fileStr,
			utf8File:  utf8File,
		}
		def.i, _ = generateFontID(def)
		f.fonts[fontKey] = def
		f.fontFiles[fontKey] = fontFileType{
			length1:  originalSize,
			fontType: "UTF8",
		}
		f.fontFiles[fileStr] = fontFileType{
			fontType: "UTF8",
		}
	} else {
		if f.fontLoader != nil {
			reader, err := f.fontLoader.Open(fileStr)
			if err == nil {
				f.AddFontFromReader(familyStr, styleStr, reader)
				if closer, ok := reader.(io.Closer); ok {
					closer.Close()
				}
				return
			}
		}

		fileStr = path.Join(f.fontpath, fileStr)
		file, err := os.Open(fileStr)
		if err != nil {
			f.err = err
			return
		}
		defer file.Close()

		f.AddFontFromReader(familyStr, styleStr, file)
	}
}

func makeSubsetRange(end int) map[int]int {
	answer := make(map[int]int)
	for i := 0; i < end; i++ {
		answer[i] = 0
	}
	return answer
}

// AddFontFromBytes imports a TrueType, OpenType or Type1 font from static
// bytes within the executable and makes it available for use in the generated
// document.
//
// family specifies the font family. The name can be chosen arbitrarily. If it
// is a standard family name, it will override the corresponding font. This
// string is used to subsequently set the font with the SetFont method.
//
// style specifies the font style. Acceptable values are (case insensitive) the
// empty string for regular style, "B" for bold, "I" for italic, or "BI" or
// "IB" for bold and italic combined.
//
// jsonFileBytes contain all bytes of JSON file.
//
// zFileBytes contain all bytes of Z file.
func (f *Fpdf) AddFontFromBytes(familyStr, styleStr string, jsonFileBytes, zFileBytes []byte) {
	f.addFontFromBytes(familyStr, styleStr, jsonFileBytes, zFileBytes, nil)
}

// AddUTF8FontFromBytes  imports a TrueType font with utf-8 symbols from static
// bytes within the executable and makes it available for use in the generated
// document.
//
// family specifies the font family. The name can be chosen arbitrarily. If it
// is a standard family name, it will override the corresponding font. This
// string is used to subsequently set the font with the SetFont method.
//
// style specifies the font style. Acceptable values are (case insensitive) the
// empty string for regular style, "B" for bold, "I" for italic, or "BI" or
// "IB" for bold and italic combined.
//
// jsonFileBytes contain all bytes of JSON file.
//
// zFileBytes contain all bytes of Z file.
func (f *Fpdf) AddUTF8FontFromBytes(familyStr, styleStr string, utf8Bytes []byte) {
	f.addFontFromBytes(familyStr, styleStr, nil, nil, utf8Bytes)
}

func (f *Fpdf) addFontFromBytes(familyStr, styleStr string, jsonFileBytes, zFileBytes, utf8Bytes []byte) {
	if f.err != nil {
		return
	}

	// load font key
	var ok bool
	fontkey := getFontKey(familyStr, styleStr)
	_, ok = f.fonts[fontkey]

	if ok {
		return
	}

	if utf8Bytes != nil {

		// if styleStr == "IB" {
		// 	styleStr = "BI"
		// }

		Type := "UTF8"
		reader := fileReader{readerPosition: 0, array: utf8Bytes}

		utf8File := newUTF8Font(&reader)

		err := utf8File.parseFile()
		if err != nil {
			fmt.Printf("get metrics Error: %e\n", err)
			return
		}
		desc := FontDescType{
			Ascent:       int(utf8File.Ascent),
			Descent:      int(utf8File.Descent),
			CapHeight:    utf8File.CapHeight,
			Flags:        utf8File.Flags,
			FontBBox:     utf8File.Bbox,
			ItalicAngle:  utf8File.ItalicAngle,
			StemV:        utf8File.StemV,
			MissingWidth: round(utf8File.DefaultWidth),
		}

		var sbarr map[int]int
		if f.aliasNbPagesStr == "" {
			sbarr = makeSubsetRange(57)
		} else {
			sbarr = makeSubsetRange(32)
		}
		def := fontDefType{
			Tp:        Type,
			Name:      fontkey,
			Desc:      desc,
			Up:        int(round(utf8File.UnderlinePosition)),
			Ut:        round(utf8File.UnderlineThickness),
			Cw:        utf8File.CharWidths,
			utf8File:  utf8File,
			usedRunes: sbarr,
		}
		def.i, _ = generateFontID(def)
		f.fonts[fontkey] = def
	} else {
		// load font definitions
		var info fontDefType
		err := json.Unmarshal(jsonFileBytes, &info)

		if err != nil {
			f.err = err
		}

		if f.err != nil {
			return
		}

		if info.i, err = generateFontID(info); err != nil {
			f.err = err
			return
		}

		// search existing encodings
		if len(info.Diff) > 0 {
			n := -1

			for j, str := range f.diffs {
				if str == info.Diff {
					n = j + 1
					break
				}
			}

			if n < 0 {
				f.diffs = append(f.diffs, info.Diff)
				n = len(f.diffs)
			}

			info.DiffN = n
		}

		// embed font
		if len(info.File) > 0 {
			if info.Tp == "TrueType" {
				f.fontFiles[info.File] = fontFileType{
					length1:  int64(info.OriginalSize),
					embedded: true,
					content:  zFileBytes,
				}
			} else {
				f.fontFiles[info.File] = fontFileType{
					length1:  int64(info.Size1),
					length2:  int64(info.Size2),
					embedded: true,
					content:  zFileBytes,
				}
			}
		}

		f.fonts[fontkey] = info
	}
}

// getFontKey is used by AddFontFromReader and GetFontDesc
func getFontKey(familyStr, styleStr string) string {
	familyStr = strings.ToLower(familyStr)
	styleStr = strings.ToUpper(styleStr)
	if styleStr == "IB" {
		styleStr = "BI"
	}
	return familyStr + styleStr
}

// AddFontFromReader imports a TrueType, OpenType or Type1 font and makes it
// available using a reader that satisifies the io.Reader interface. See
// AddFont for details about familyStr and styleStr.
func (f *Fpdf) AddFontFromReader(familyStr, styleStr string, r io.Reader) {
	if f.err != nil {
		return
	}
	// dbg("Adding family [%s], style [%s]", familyStr, styleStr)
	var ok bool
	fontkey := getFontKey(familyStr, styleStr)
	_, ok = f.fonts[fontkey]
	if ok {
		return
	}
	var info fontDefType
	info = f.loadfont(r)
	if f.err != nil {
		return
	}
	if len(info.Diff) > 0 {
		// Search existing encodings
		n := -1
		for j, str := range f.diffs {
			if str == info.Diff {
				n = j + 1
				break
			}
		}
		if n < 0 {
			f.diffs = append(f.diffs, info.Diff)
			n = len(f.diffs)
		}
		info.DiffN = n
	}
	// dbg("font [%s], type [%s]", info.File, info.Tp)
	if len(info.File) > 0 {
		// Embedded font
		if info.Tp == "TrueType" {
			f.fontFiles[info.File] = fontFileType{length1: int64(info.OriginalSize)}
		} else {
			f.fontFiles[info.File] = fontFileType{length1: int64(info.Size1), length2: int64(info.Size2)}
		}
	}
	f.fonts[fontkey] = info
	return
}

// GetFontDesc returns the font descriptor, which can be used for
// example to find the baseline of a font. If familyStr is empty
// current font descriptor will be returned.
// See FontDescType for documentation about the font descriptor.
// See AddFont for details about familyStr and styleStr.
func (f *Fpdf) GetFontDesc(familyStr, styleStr string) FontDescType {
	if familyStr == "" {
		return f.currentFont.Desc
	}
	return f.fonts[getFontKey(familyStr, styleStr)].Desc
}

// SetFont sets the font used to print character strings. It is mandatory to
// call this method at least once before printing text or the resulting
// document will not be valid.
//
// The font can be either a standard one or a font added via the AddFont()
// method or AddFontFromReader() method. Standard fonts use the Windows
// encoding cp1252 (Western Europe).
//
// The method can be called before the first page is created and the font is
// kept from page to page. If you just wish to change the current font size, it
// is simpler to call SetFontSize().
//
// Note: the font definition file must be accessible. An error is set if the
// file cannot be read.
//
// familyStr specifies the font family. It can be either a name defined by
// AddFont(), AddFontFromReader() or one of the standard families (case
// insensitive): "Courier" for fixed-width, "Helvetica" or "Arial" for sans
// serif, "Times" for serif, "Symbol" or "ZapfDingbats" for symbolic.
//
// styleStr can be "B" (bold), "I" (italic), "U" (underscore) or any
// combination. The default value (specified with an empty string) is regular.
// Bold and italic styles do not apply to Symbol and ZapfDingbats.
//
// size is the font size measured in points. The default value is the current
// size. If no size has been specified since the beginning of the document, the
// value taken is 12.
func (f *Fpdf) SetFont(familyStr, styleStr string, size float64) {
	// dbg("SetFont x %.2f, lMargin %.2f", f.x, f.lMargin)

	if f.err != nil {
		return
	}
	// dbg("SetFont")
	var ok bool
	if familyStr == "" {
		familyStr = f.fontFamily
	} else {
		familyStr = strings.ToLower(familyStr)
	}
	styleStr = strings.ToUpper(styleStr)
	f.underline = strings.Contains(styleStr, "U")
	if f.underline {
		styleStr = strings.Replace(styleStr, "U", "", -1)
	}
	if styleStr == "IB" {
		styleStr = "BI"
	}
	if size == 0.0 {
		size = f.fontSizePt
	}

	// Test if font is already loaded
	fontKey := familyStr + styleStr
	_, ok = f.fonts[fontKey]
	if !ok {
		// Test if one of the core fonts
		if familyStr == "arial" {
			familyStr = "helvetica"
		}
		_, ok = f.coreFonts[familyStr]
		if ok {
			if familyStr == "symbol" {
				familyStr = "zapfdingbats"
			}
			if familyStr == "zapfdingbats" {
				styleStr = ""
			}
			fontKey = familyStr + styleStr
			_, ok = f.fonts[fontKey]
			if !ok {
				rdr := f.coreFontReader(familyStr, styleStr)
				if f.err == nil {
					f.AddFontFromReader(familyStr, styleStr, rdr)
				}
				if f.err != nil {
					return
				}
			}
		} else {
			f.err = fmt.Errorf("undefined font: %s %s", familyStr, styleStr)
			return
		}
	}
	// Select it
	f.fontFamily = familyStr
	f.fontStyle = styleStr
	f.fontSizePt = size
	f.fontSize = size / f.k
	f.currentFont = f.fonts[fontKey]
	if f.currentFont.Tp == "UTF8" {
		f.isCurrentUTF8 = true
	} else {
		f.isCurrentUTF8 = false
	}
	if f.page > 0 {
		f.outf("BT /F%s %.2f Tf ET", f.currentFont.i, f.fontSizePt)
	}
	return
}

// SetFontStyle sets the style of the current font. See also SetFont()
func (f *Fpdf) SetFontStyle(styleStr string) {
	f.SetFont(f.fontFamily, styleStr, f.fontSizePt)
}

// SetFontSize defines the size of the current font. Size is specified in
// points (1/ 72 inch). See also SetFontUnitSize().
func (f *Fpdf) SetFontSize(size float64) {
	f.fontSizePt = size
	f.fontSize = size / f.k
	if f.page > 0 {
		f.outf("BT /F%s %.2f Tf ET", f.currentFont.i, f.fontSizePt)
	}
}

// SetFontUnitSize defines the size of the current font. Size is specified in
// the unit of measure specified in New(). See also SetFontSize().
func (f *Fpdf) SetFontUnitSize(size float64) {
	f.fontSizePt = size * f.k
	f.fontSize = size
	if f.page > 0 {
		f.outf("BT /F%s %.2f Tf ET", f.currentFont.i, f.fontSizePt)
	}
}

// GetFontSize returns the size of the current font in points followed by the
// size in the unit of measure specified in New(). The second value can be used
// as a line height value in drawing operations.
func (f *Fpdf) GetFontSize() (ptSize, unitSize float64) {
	return f.fontSizePt, f.fontSize
}

// AddLink creates a new internal link and returns its identifier. An internal
// link is a clickable area which directs to another place within the document.
// The identifier can then be passed to Cell(), Write(), Image() or Link(). The
// destination is defined with SetLink().
func (f *Fpdf) AddLink() int {
	f.links = append(f.links, intLinkType{})
	return len(f.links) - 1
}

// SetLink defines the page and position a link points to. See AddLink().
func (f *Fpdf) SetLink(link int, y float64, page int) {
	if y == -1 {
		y = f.y
	}
	if page == -1 {
		page = f.page
	}
	f.links[link] = intLinkType{page, y}
}

// newLink adds a new clickable link on current page
func (f *Fpdf) newLink(x, y, w, h float64, link int, linkStr string) {
	// linkList, ok := f.pageLinks[f.page]
	// if !ok {
	// linkList = make([]linkType, 0, 8)
	// f.pageLinks[f.page] = linkList
	// }
	f.pageLinks[f.page] = append(f.pageLinks[f.page],
		linkType{x * f.k, f.hPt - y*f.k, w * f.k, h * f.k, link, linkStr})
}

// Link puts a link on a rectangular area of the page. Text or image links are
// generally put via Cell(), Write() or Image(), but this method can be useful
// for instance to define a clickable area inside an image. link is the value
// returned by AddLink().
func (f *Fpdf) Link(x, y, w, h float64, link int) {
	f.newLink(x, y, w, h, link, "")
}

// LinkString puts a link on a rectangular area of the page. Text or image
// links are generally put via Cell(), Write() or Image(), but this method can
// be useful for instance to define a clickable area inside an image. linkStr
// is the target URL.
func (f *Fpdf) LinkString(x, y, w, h float64, linkStr string) {
	f.newLink(x, y, w, h, 0, linkStr)
}

// Bookmark sets a bookmark that will be displayed in a sidebar outline. txtStr
// is the title of the bookmark. level specifies the level of the bookmark in
// the outline; 0 is the top level, 1 is just below, and so on. y specifies the
// vertical position of the bookmark destination in the current page; -1
// indicates the current position.
func (f *Fpdf) Bookmark(txtStr string, level int, y float64) {
	if y == -1 {
		y = f.y
	}
	f.outlines = append(f.outlines, outlineType{text: txtStr, level: level, y: y, p: f.PageNo(), prev: -1, last: -1, next: -1, first: -1})
}

// Text prints a character string. The origin (x, y) is on the left of the
// first character at the baseline. This method permits a string to be placed
// precisely on the page, but it is usually easier to use Cell(), MultiCell()
// or Write() which are the standard methods to print text.
func (f *Fpdf) Text(x, y float64, txtStr string) {
	var txt2 string
	if f.isCurrentUTF8 {
		if f.isRTL {
			txtStr = reverseText(txtStr)
			x -= f.GetStringWidth(txtStr)
		}
		txt2 = f.escape(utf8toutf16(txtStr, false))
		for _, uni := range []rune(txtStr) {
			f.currentFont.usedRunes[int(uni)] = int(uni)
		}
	} else {
		txt2 = f.escape(txtStr)
	}
	s := sprintf("BT %.2f %.2f Td (%s) Tj ET", x*f.k, (f.h-y)*f.k, txt2)
	if f.underline && txtStr != "" {
		s += " " + f.dounderline(x, y, txtStr)
	}
	if f.colorFlag {
		s = sprintf("q %s %s Q", f.color.text.str, s)
	}
	f.out(s)
}

// SetWordSpacing sets spacing between words of following text. See the
// WriteAligned() example for a demonstration of its use.
func (f *Fpdf) SetWordSpacing(space float64) {
	f.out(sprintf("%.5f Tw", space*f.k))
}

// SetAcceptPageBreakFunc allows the application to control where page breaks
// occur.
//
// fnc is an application function (typically a closure) that is called by the
// library whenever a page break condition is met. The break is issued if true
// is returned. The default implementation returns a value according to the
// mode selected by SetAutoPageBreak. The function provided should not be
// called by the application.
//
// See the example for SetLeftMargin() to see how this function can be used to
// manage multiple columns.
func (f *Fpdf) SetAcceptPageBreakFunc(fnc func() bool) {
	f.acceptPageBreak = fnc
}

// CellFormat prints a rectangular cell with optional borders, background color
// and character string. The upper-left corner of the cell corresponds to the
// current position. The text can be aligned or centered. After the call, the
// current position moves to the right or to the next line. It is possible to
// put a link on the text.
//
// An error will be returned if a call to SetFont() has not already taken
// place before this method is called.
//
// If automatic page breaking is enabled and the cell goes beyond the limit, a
// page break is done before outputting.
//
// w and h specify the width and height of the cell. If w is 0, the cell
// extends up to the right margin. Specifying 0 for h will result in no output,
// but the current position will be advanced by w.
//
// txtStr specifies the text to display.
//
// borderStr specifies how the cell border will be drawn. An empty string
// indicates no border, "1" indicates a full border, and one or more of "L",
// "T", "R" and "B" indicate the left, top, right and bottom sides of the
// border.
//
// ln indicates where the current position should go after the call. Possible
// values are 0 (to the right), 1 (to the beginning of the next line), and 2
// (below). Putting 1 is equivalent to putting 0 and calling Ln() just after.
//
// alignStr specifies how the text is to be positioned within the cell.
// Horizontal alignment is controlled by including "L", "C" or "R" (left,
// center, right) in alignStr. Vertical alignment is controlled by including
// "T", "M", "B" or "A" (top, middle, bottom, baseline) in alignStr. The default
// alignment is left middle.
//
// fill is true to paint the cell background or false to leave it transparent.
//
// link is the identifier returned by AddLink() or 0 for no internal link.
//
// linkStr is a target URL or empty for no external link. A non--zero value for
// link takes precedence over linkStr.
func (f *Fpdf) CellFormat(w, h float64, txtStr, borderStr string, ln int,
	alignStr string, fill bool, link int, linkStr string) {
	// dbg("CellFormat. h = %.2f, borderStr = %s", h, borderStr)
	if f.err != nil {
		return
	}

	if f.currentFont.Name == "" {
		f.err = fmt.Errorf("font has not been set; unable to render text")
		return
	}

	borderStr = strings.ToUpper(borderStr)
	k := f.k
	if f.y+h > f.pageBreakTrigger && !f.inHeader && !f.inFooter && f.acceptPageBreak() {
		// Automatic page break
		x := f.x
		ws := f.ws
		// dbg("auto page break, x %.2f, ws %.2f", x, ws)
		if ws > 0 {
			f.ws = 0
			f.out("0 Tw")
		}
		f.AddPageFormat(f.curOrientation, f.curPageSize)
		if f.err != nil {
			return
		}
		f.x = x
		if ws > 0 {
			f.ws = ws
			f.outf("%.3f Tw", ws*k)
		}
	}
	if w == 0 {
		w = f.w - f.rMargin - f.x
	}
	var s fmtBuffer
	if fill || borderStr == "1" {
		var op string
		if fill {
			if borderStr == "1" {
				op = "B"
				// dbg("border is '1', fill")
			} else {
				op = "f"
				// dbg("border is empty, fill")
			}
		} else {
			// dbg("border is '1', no fill")
			op = "S"
		}
		/// dbg("(CellFormat) f.x %.2f f.k %.2f", f.x, f.k)
		s.printf("%.2f %.2f %.2f %.2f re %s ", f.x*k, (f.h-f.y)*k, w*k, -h*k, op)
	}
	if len(borderStr) > 0 && borderStr != "1" {
		// fmt.Printf("border is '%s', no fill\n", borderStr)
		x := f.x
		y := f.y
		left := x * k
		top := (f.h - y) * k
		right := (x + w) * k
		bottom := (f.h - (y + h)) * k
		if strings.Contains(borderStr, "L") {
			s.printf("%.2f %.2f m %.2f %.2f l S ", left, top, left, bottom)
		}
		if strings.Contains(borderStr, "T") {
			s.printf("%.2f %.2f m %.2f %.2f l S ", left, top, right, top)
		}
		if strings.Contains(borderStr, "R") {
			s.printf("%.2f %.2f m %.2f %.2f l S ", right, top, right, bottom)
		}
		if strings.Contains(borderStr, "B") {
			s.printf("%.2f %.2f m %.2f %.2f l S ", left, bottom, right, bottom)
		}
	}
	if len(txtStr) > 0 {
		var dx, dy float64
		// Horizontal alignment
		switch {
		case strings.Contains(alignStr, "R"):
			dx = w - f.cMargin - f.GetStringWidth(txtStr)
		case strings.Contains(alignStr, "C"):
			dx = (w - f.GetStringWidth(txtStr)) / 2
		default:
			dx = f.cMargin
		}

		// Vertical alignment
		switch {
		case strings.Contains(alignStr, "T"):
			dy = (f.fontSize - h) / 2.0
		case strings.Contains(alignStr, "B"):
			dy = (h - f.fontSize) / 2.0
		case strings.Contains(alignStr, "A"):
			var descent float64
			d := f.currentFont.Desc
			if d.Descent == 0 {
				// not defined (standard font?), use average of 19%
				descent = -0.19 * f.fontSize
			} else {
				descent = float64(d.Descent) * f.fontSize / float64(d.Ascent-d.Descent)
			}
			dy = (h-f.fontSize)/2.0 - descent
		default:
			dy = 0
		}
		if f.colorFlag {
			s.printf("q %s ", f.color.text.str)
		}
		//If multibyte, Tw has no effect - do word spacing using an adjustment before each space
		if (f.ws != 0 || alignStr == "J") && f.isCurrentUTF8 { // && f.ws != 0
			if f.isRTL {
				txtStr = reverseText(txtStr)
			}
			wmax := int(math.Ceil((w - 2*f.cMargin) * 1000 / f.fontSize))
			for _, uni := range []rune(txtStr) {
				f.currentFont.usedRunes[int(uni)] = int(uni)
			}
			space := f.escape(utf8toutf16(" ", false))
			strSize := f.GetStringSymbolWidth(txtStr)
			s.printf("BT 0 Tw %.2f %.2f Td [", (f.x+dx)*k, (f.h-(f.y+.5*h+.3*f.fontSize))*k)
			t := strings.Split(txtStr, " ")
			shift := float64((wmax - strSize)) / float64(len(t)-1)
			numt := len(t)
			for i := 0; i < numt; i++ {
				tx := t[i]
				tx = "(" + f.escape(utf8toutf16(tx, false)) + ")"
				s.printf("%s ", tx)
				if (i + 1) < numt {
					s.printf("%.3f(%s) ", -shift, space)
				}
			}
			s.printf("] TJ ET")
		} else {
			var txt2 string
			if f.isCurrentUTF8 {
				if f.isRTL {
					txtStr = reverseText(txtStr)
				}
				txt2 = f.escape(utf8toutf16(txtStr, false))
				for _, uni := range []rune(txtStr) {
					f.currentFont.usedRunes[int(uni)] = int(uni)
				}
			} else {

				txt2 = strings.Replace(txtStr, "\\", "\\\\", -1)
				txt2 = strings.Replace(txt2, "(", "\\(", -1)
				txt2 = strings.Replace(txt2, ")", "\\)", -1)
			}
			bt := (f.x + dx) * k
			td := (f.h - (f.y + dy + .5*h + .3*f.fontSize)) * k
			s.printf("BT %.2f %.2f Td (%s)Tj ET", bt, td, txt2)
			//BT %.2F %.2F Td (%s) Tj ET',(f.x+dx)*k,(f.h-(f.y+.5*h+.3*f.FontSize))*k,txt2);
		}

		if f.underline {
			s.printf(" %s", f.dounderline(f.x+dx, f.y+dy+.5*h+.3*f.fontSize, txtStr))
		}
		if f.colorFlag {
			s.printf(" Q")
		}
		if link > 0 || len(linkStr) > 0 {
			f.newLink(f.x+dx, f.y+dy+.5*h-.5*f.fontSize, f.GetStringWidth(txtStr), f.fontSize, link, linkStr)
		}
	}
	str := s.String()
	if len(str) > 0 {
		f.out(str)
	}
	f.lasth = h
	if ln > 0 {
		// Go to next line
		f.y += h
		if ln == 1 {
			f.x = f.lMargin
		}
	} else {
		f.x += w
	}
	return
}

// Revert string to use in RTL languages
func reverseText(text string) string {
	oldText := []rune(text)
	newText := make([]rune, len(oldText))
	length := len(oldText) - 1
	for i, r := range oldText {
		newText[length-i] = r
	}
	return string(newText)
}

// Cell is a simpler version of CellFormat with no fill, border, links or
// special alignment.
func (f *Fpdf) Cell(w, h float64, txtStr string) {
	f.CellFormat(w, h, txtStr, "", 0, "L", false, 0, "")
}

// Cellf is a simpler printf-style version of CellFormat with no fill, border,
// links or special alignment. See documentation for the fmt package for
// details on fmtStr and args.
func (f *Fpdf) Cellf(w, h float64, fmtStr string, args ...interface{}) {
	f.CellFormat(w, h, sprintf(fmtStr, args...), "", 0, "L", false, 0, "")
}

// SplitLines splits text into several lines using the current font. Each line
// has its length limited to a maximum width given by w. This function can be
// used to determine the total height of wrapped text for vertical placement
// purposes.
//
// This method is useful for codepage-based fonts only. For UTF-8 encoded text,
// use SplitText().
//
// You can use MultiCell if you want to print a text on several lines in a
// simple way.
func (f *Fpdf) SplitLines(txt []byte, w float64) [][]byte {
	// Function contributed by Bruno Michel
	lines := [][]byte{}
	cw := f.currentFont.Cw
	wmax := int(math.Ceil((w - 2*f.cMargin) * 1000 / f.fontSize))
	s := bytes.Replace(txt, []byte("\r"), []byte{}, -1)
	nb := len(s)
	for nb > 0 && s[nb-1] == '\n' {
		nb--
	}
	s = s[0:nb]
	sep := -1
	i := 0
	j := 0
	l := 0
	for i < nb {
		c := s[i]
		l += cw[c]
		if c == ' ' || c == '\t' || c == '\n' {
			sep = i
		}
		if c == '\n' || l > wmax {
			if sep == -1 {
				if i == j {
					i++
				}
				sep = i
			} else {
				i = sep + 1
			}
			lines = append(lines, s[j:sep])
			sep = -1
			j = i
			l = 0
		} else {
			i++
		}
	}
	if i != j {
		lines = append(lines, s[j:i])
	}
	return lines
}

// MultiCell supports printing text with line breaks. They can be automatic (as
// soon as the text reaches the right border of the cell) or explicit (via the
// \n character). As many cells as necessary are output, one below the other.
//
// Text can be aligned, centered or justified. The cell block can be framed and
// the background painted. See CellFormat() for more details.
//
// The current position after calling MultiCell() is the beginning of the next
// line, equivalent to calling CellFormat with ln equal to 1.
//
// w is the width of the cells. A value of zero indicates cells that reach to
// the right margin.
//
// h indicates the line height of each cell in the unit of measure specified in New().
func (f *Fpdf) MultiCell(w, h float64, txtStr, borderStr, alignStr string, fill bool) {
	if f.err != nil {
		return
	}
	// dbg("MultiCell")
	if alignStr == "" {
		alignStr = "J"
	}
	cw := f.currentFont.Cw
	if w == 0 {
		w = f.w - f.rMargin - f.x
	}
	wmax := int(math.Ceil((w - 2*f.cMargin) * 1000 / f.fontSize))
	s := strings.Replace(txtStr, "\r", "", -1)
	srune := []rune(s)

	// remove extra line breaks
	var nb int
	if f.isCurrentUTF8 {
		nb = len(srune)
		for nb > 0 && srune[nb-1] == '\n' {
			nb--
		}
		srune = srune[0:nb]
	} else {
		nb = len(s)
		bytes2 := []byte(s)
		for nb > 0 && bytes2[nb-1] == '\n' {
			nb--
		}
		s = s[0:nb]
	}
	// dbg("[%s]\n", s)
	var b, b2 string
	b = "0"
	if len(borderStr) > 0 {
		if borderStr == "1" {
			borderStr = "LTRB"
			b = "LRT"
			b2 = "LR"
		} else {
			b2 = ""
			if strings.Contains(borderStr, "L") {
				b2 += "L"
			}
			if strings.Contains(borderStr, "R") {
				b2 += "R"
			}
			if strings.Contains(borderStr, "T") {
				b = b2 + "T"
			} else {
				b = b2
			}
		}
	}
	sep := -1
	i := 0
	j := 0
	l := 0
	ls := 0
	ns := 0
	nl := 1
	for i < nb {
		// Get next character
		var c rune
		if f.isCurrentUTF8 {
			c = srune[i]
		} else {
			c = rune(s[i])
		}
		if c == '\n' {
			// Explicit line break
			if f.ws > 0 {
				f.ws = 0
				f.out("0 Tw")
			}

			if f.isCurrentUTF8 {
				newAlignStr := alignStr
				if newAlignStr == "J" {
					if f.isRTL {
						newAlignStr = "R"
					} else {
						newAlignStr = "L"
					}
				}
				f.CellFormat(w, h, string(srune[j:i]), b, 2, newAlignStr, fill, 0, "")
			} else {
				f.CellFormat(w, h, s[j:i], b, 2, alignStr, fill, 0, "")
			}
			i++
			sep = -1
			j = i
			l = 0
			ns = 0
			nl++
			if len(borderStr) > 0 && nl == 2 {
				b = b2
			}
			continue
		}
		if c == ' ' || isChinese(c) {
			sep = i
			ls = l
			ns++
		}
		if cw[int(c)] == 0 { //Marker width 0 used for missing symbols
			l += f.currentFont.Desc.MissingWidth
		} else if cw[int(c)] != 65535 { //Marker width 65535 used for zero width symbols
			l += cw[int(c)]
		}
		if l > wmax {
			// Automatic line break
			if sep == -1 {
				if i == j {
					i++
				}
				if f.ws > 0 {
					f.ws = 0
					f.out("0 Tw")
				}
				if f.isCurrentUTF8 {
					f.CellFormat(w, h, string(srune[j:i]), b, 2, alignStr, fill, 0, "")
				} else {
					f.CellFormat(w, h, s[j:i], b, 2, alignStr, fill, 0, "")
				}
			} else {
				if alignStr == "J" {
					if ns > 1 {
						f.ws = float64((wmax-ls)/1000) * f.fontSize / float64(ns-1)
					} else {
						f.ws = 0
					}
					f.outf("%.3f Tw", f.ws*f.k)
				}
				if f.isCurrentUTF8 {
					f.CellFormat(w, h, string(srune[j:sep]), b, 2, alignStr, fill, 0, "")
				} else {
					f.CellFormat(w, h, s[j:sep], b, 2, alignStr, fill, 0, "")
				}
				i = sep + 1
			}
			sep = -1
			j = i
			l = 0
			ns = 0
			nl++
			if len(borderStr) > 0 && nl == 2 {
				b = b2
			}
		} else {
			i++
		}
	}
	// Last chunk
	if f.ws > 0 {
		f.ws = 0
		f.out("0 Tw")
	}
	if len(borderStr) > 0 && strings.Contains(borderStr, "B") {
		b += "B"
	}
	if f.isCurrentUTF8 {
		if alignStr == "J" {
			if f.isRTL {
				alignStr = "R"
			} else {
				alignStr = ""
			}
		}
		f.CellFormat(w, h, string(srune[j:i]), b, 2, alignStr, fill, 0, "")
	} else {
		f.CellFormat(w, h, s[j:i], b, 2, alignStr, fill, 0, "")
	}
	f.x = f.lMargin
}

// write outputs text in flowing mode
func (f *Fpdf) write(h float64, txtStr string, link int, linkStr string) {
	// dbg("Write")
	cw := f.currentFont.Cw
	w := f.w - f.rMargin - f.x
	wmax := (w - 2*f.cMargin) * 1000 / f.fontSize
	s := strings.Replace(txtStr, "\r", "", -1)
	var nb int
	if f.isCurrentUTF8 {
		nb = len([]rune(s))
		if nb == 1 && s == " " {
			f.x += f.GetStringWidth(s)
			return
		}
	} else {
		nb = len(s)
	}
	sep := -1
	i := 0
	j := 0
	l := 0.0
	nl := 1
	for i < nb {
		// Get next character
		var c rune
		if f.isCurrentUTF8 {
			c = []rune(s)[i]
		} else {
			c = rune(byte(s[i]))
		}
		if c == '\n' {
			// Explicit line break
			if f.isCurrentUTF8 {
				f.CellFormat(w, h, string([]rune(s)[j:i]), "", 2, "", false, link, linkStr)
			} else {
				f.CellFormat(w, h, s[j:i], "", 2, "", false, link, linkStr)
			}
			i++
			sep = -1
			j = i
			l = 0.0
			if nl == 1 {
				f.x = f.lMargin
				w = f.w - f.rMargin - f.x
				wmax = (w - 2*f.cMargin) * 1000 / f.fontSize
			}
			nl++
			continue
		}
		if c == ' ' {
			sep = i
		}
		l += float64(cw[int(c)])
		if l > wmax {
			// Automatic line break
			if sep == -1 {
				if f.x > f.lMargin {
					// Move to next line
					f.x = f.lMargin
					f.y += h
					w = f.w - f.rMargin - f.x
					wmax = (w - 2*f.cMargin) * 1000 / f.fontSize
					i++
					nl++
					continue
				}
				if i == j {
					i++
				}
				if f.isCurrentUTF8 {
					f.CellFormat(w, h, string([]rune(s)[j:i]), "", 2, "", false, link, linkStr)
				} else {
					f.CellFormat(w, h, s[j:i], "", 2, "", false, link, linkStr)
				}
			} else {
				if f.isCurrentUTF8 {
					f.CellFormat(w, h, string([]rune(s)[j:sep]), "", 2, "", false, link, linkStr)
				} else {
					f.CellFormat(w, h, s[j:sep], "", 2, "", false, link, linkStr)
				}
				i = sep + 1
			}
			sep = -1
			j = i
			l = 0.0
			if nl == 1 {
				f.x = f.lMargin
				w = f.w - f.rMargin - f.x
				wmax = (w - 2*f.cMargin) * 1000 / f.fontSize
			}
			nl++
		} else {
			i++
		}
	}
	// Last chunk
	if i != j {
		if f.isCurrentUTF8 {
			f.CellFormat(l/1000*f.fontSize, h, string([]rune(s)[j:]), "", 0, "", false, link, linkStr)
		} else {
			f.CellFormat(l/1000*f.fontSize, h, s[j:], "", 0, "", false, link, linkStr)
		}
	}
}

// Write prints text from the current position. When the right margin is
// reached (or the \n character is met) a line break occurs and text continues
// from the left margin. Upon method exit, the current position is left just at
// the end of the text.
//
// It is possible to put a link on the text.
//
// h indicates the line height in the unit of measure specified in New().
func (f *Fpdf) Write(h float64, txtStr string) {
	f.write(h, txtStr, 0, "")
}

// Writef is like Write but uses printf-style formatting. See the documentation
// for package fmt for more details on fmtStr and args.
func (f *Fpdf) Writef(h float64, fmtStr string, args ...interface{}) {
	f.write(h, sprintf(fmtStr, args...), 0, "")
}

// WriteLinkString writes text that when clicked launches an external URL. See
// Write() for argument details.
func (f *Fpdf) WriteLinkString(h float64, displayStr, targetStr string) {
	f.write(h, displayStr, 0, targetStr)
}

// WriteLinkID writes text that when clicked jumps to another location in the
// PDF. linkID is an identifier returned by AddLink(). See Write() for argument
// details.
func (f *Fpdf) WriteLinkID(h float64, displayStr string, linkID int) {
	f.write(h, displayStr, linkID, "")
}

// WriteAligned is an implementation of Write that makes it possible to align
// text.
//
// width indicates the width of the box the text will be drawn in. This is in
// the unit of measure specified in New(). If it is set to 0, the bounding box
//of the page will be taken (pageWidth - leftMargin - rightMargin).
//
// lineHeight indicates the line height in the unit of measure specified in
// New().
//
// alignStr sees to horizontal alignment of the given textStr. The options are
// "L", "C" and "R" (Left, Center, Right). The default is "L".
func (f *Fpdf) WriteAligned(width, lineHeight float64, textStr, alignStr string) {
	lMargin, _, rMargin, _ := f.GetMargins()

	pageWidth, _ := f.GetPageSize()
	if width == 0 {
		width = pageWidth - (lMargin + rMargin)
	}

	var lines []string

	if f.isCurrentUTF8 {
		lines = f.SplitText(textStr, width)
	} else {
		for _, line := range f.SplitLines([]byte(textStr), width) {
			lines = append(lines, string(line))
		}
	}

	for _, lineBt := range lines {
		lineStr := string(lineBt)
		lineWidth := f.GetStringWidth(lineStr)

		switch alignStr {
		case "C":
			f.SetLeftMargin(lMargin + ((width - lineWidth) / 2))
			f.Write(lineHeight, lineStr)
			f.SetLeftMargin(lMargin)
		case "R":
			f.SetLeftMargin(lMargin + (width - lineWidth) - 2.01*f.cMargin)
			f.Write(lineHeight, lineStr)
			f.SetLeftMargin(lMargin)
		default:
			f.SetRightMargin(pageWidth - lMargin - width)
			f.Write(lineHeight, lineStr)
			f.SetRightMargin(rMargin)
		}
	}
}

// Ln performs a line break. The current abscissa goes back to the left margin
// and the ordinate increases by the amount passed in parameter. A negative
// value of h indicates the height of the last printed cell.
//
// This method is demonstrated in the example for MultiCell.
func (f *Fpdf) Ln(h float64) {
	f.x = f.lMargin
	if h < 0 {
		f.y += f.lasth
	} else {
		f.y += h
	}
}

// ImageTypeFromMime returns the image type used in various image-related
// functions (for example, Image()) that is associated with the specified MIME
// type. For example, "jpg" is returned if mimeStr is "image/jpeg". An error is
// set if the specified MIME type is not supported.
func (f *Fpdf) ImageTypeFromMime(mimeStr string) (tp string) {
	switch mimeStr {
	case "image/png":
		tp = "png"
	case "image/jpg":
		tp = "jpg"
	case "image/jpeg":
		tp = "jpg"
	case "image/gif":
		tp = "gif"
	default:
		f.SetErrorf("unsupported image type: %s", mimeStr)
	}
	return
}

func (f *Fpdf) imageOut(info *ImageInfoType, x, y, w, h float64, allowNegativeX, flow bool, link int, linkStr string) {
	// Automatic width and height calculation if needed
	if w == 0 && h == 0 {
		// Put image at 96 dpi
		w = -96
		h = -96
	}
	if w == -1 {
		// Set image width to whatever value for dpi we read
		// from the image or that was set manually
		w = -info.dpi
	}
	if h == -1 {
		// Set image height to whatever value for dpi we read
		// from the image or that was set manually
		h = -info.dpi
	}
	if w < 0 {
		w = -info.w * 72.0 / w / f.k
	}
	if h < 0 {
		h = -info.h * 72.0 / h / f.k
	}
	if w == 0 {
		w = h * info.w / info.h
	}
	if h == 0 {
		h = w * info.h / info.w
	}
	// Flowing mode
	if flow {
		if f.y+h > f.pageBreakTrigger && !f.inHeader && !f.inFooter && f.acceptPageBreak() {
			// Automatic page break
			x2 := f.x
			f.AddPageFormat(f.curOrientation, f.curPageSize)
			if f.err != nil {
				return
			}
			f.x = x2
		}
		y = f.y
		f.y += h
	}
	if !allowNegativeX {
		if x < 0 {
			x = f.x
		}
	}
	// dbg("h %.2f", h)
	// q 85.04 0 0 NaN 28.35 NaN cm /I2 Do Q
	f.outf("q %.5f 0 0 %.5f %.5f %.5f cm /I%s Do Q", w*f.k, h*f.k, x*f.k, (f.h-(y+h))*f.k, info.i)
	if link > 0 || len(linkStr) > 0 {
		f.newLink(x, y, w, h, link, linkStr)
	}
}

// Image puts a JPEG, PNG or GIF image in the current page.
//
// Deprecated in favor of ImageOptions -- see that function for
// details on the behavior of arguments
func (f *Fpdf) Image(imageNameStr string, x, y, w, h float64, flow bool, tp string, link int, linkStr string) {
	options := ImageOptions{
		ReadDpi:   false,
		ImageType: tp,
	}
	f.ImageOptions(imageNameStr, x, y, w, h, flow, options, link, linkStr)
}

// ImageOptions puts a JPEG, PNG or GIF image in the current page. The size it
// will take on the page can be specified in different ways. If both w and h
// are 0, the image is rendered at 96 dpi. If either w or h is zero, it will be
// calculated from the other dimension so that the aspect ratio is maintained.
// If w and/or h are -1, the dpi for that dimension will be read from the
// ImageInfoType object. PNG files can contain dpi information, and if present,
// this information will be populated in the ImageInfoType object and used in
// Width, Height, and Extent calculations. Otherwise, the SetDpi function can
// be used to change the dpi from the default of 72.
//
// If w and h are any other negative value, their absolute values
// indicate their dpi extents.
//
// Supported JPEG formats are 24 bit, 32 bit and gray scale. Supported PNG
// formats are 24 bit, indexed color, and 8 bit indexed gray scale. If a GIF
// image is animated, only the first frame is rendered. Transparency is
// supported. It is possible to put a link on the image.
//
// imageNameStr may be the name of an image as registered with a call to either
// RegisterImageReader() or RegisterImage(). In the first case, the image is
// loaded using an io.Reader. This is generally useful when the image is
// obtained from some other means than as a disk-based file. In the second
// case, the image is loaded as a file. Alternatively, imageNameStr may
// directly specify a sufficiently qualified filename.
//
// However the image is loaded, if it is used more than once only one copy is
// embedded in the file.
//
// If x is negative, the current abscissa is used.
//
// If flow is true, the current y value is advanced after placing the image and
// a page break may be made if necessary.
//
// If link refers to an internal page anchor (that is, it is non-zero; see
// AddLink()), the image will be a clickable internal link. Otherwise, if
// linkStr specifies a URL, the image will be a clickable external link.
func (f *Fpdf) ImageOptions(imageNameStr string, x, y, w, h float64, flow bool, options ImageOptions, link int, linkStr string) {
	if f.err != nil {
		return
	}
	info := f.RegisterImageOptions(imageNameStr, options)
	if f.err != nil {
		return
	}
	f.imageOut(info, x, y, w, h, options.AllowNegativePosition, flow, link, linkStr)
	return
}

// RegisterImageReader registers an image, reading it from Reader r, adding it
// to the PDF file but not adding it to the page.
//
// This function is now deprecated in favor of RegisterImageOptionsReader
func (f *Fpdf) RegisterImageReader(imgName, tp string, r io.Reader) (info *ImageInfoType) {
	options := ImageOptions{
		ReadDpi:   false,
		ImageType: tp,
	}
	return f.RegisterImageOptionsReader(imgName, options, r)
}

// ImageOptions provides a place to hang any options we want to use while
// parsing an image.
//
// ImageType's possible values are (case insensitive):
// "JPG", "JPEG", "PNG" and "GIF". If empty, the type is inferred from
// the file extension.
//
// ReadDpi defines whether to attempt to automatically read the image
// dpi information from the image file. Normally, this should be set
// to true (understanding that not all images will have this info
// available). However, for backwards compatibility with previous
// versions of the API, it defaults to false.
//
// AllowNegativePosition can be set to true in order to prevent the default
// coercion of negative x values to the current x position.
type ImageOptions struct {
	ImageType             string
	ReadDpi               bool
	AllowNegativePosition bool
}

// RegisterImageOptionsReader registers an image, reading it from Reader r, adding it
// to the PDF file but not adding it to the page. Use Image() with the same
// name to add the image to the page. Note that tp should be specified in this
// case.
//
// See Image() for restrictions on the image and the options parameters.
func (f *Fpdf) RegisterImageOptionsReader(imgName string, options ImageOptions, r io.Reader) (info *ImageInfoType) {
	// Thanks, Ivan Daniluk, for generalizing this code to use the Reader interface.
	if f.err != nil {
		return
	}
	info, ok := f.images[imgName]
	if ok {
		return
	}

	// First use of this image, get info
	if options.ImageType == "" {
		f.err = fmt.Errorf("image type should be specified if reading from custom reader")
		return
	}
	options.ImageType = strings.ToLower(options.ImageType)
	if options.ImageType == "jpeg" {
		options.ImageType = "jpg"
	}
	switch options.ImageType {
	case "jpg":
		info = f.parsejpg(r)
	case "png":
		info = f.parsepng(r, options.ReadDpi)
	case "gif":
		info = f.parsegif(r)
	default:
		f.err = fmt.Errorf("unsupported image type: %s", options.ImageType)
	}
	if f.err != nil {
		return
	}

	if info.i, f.err = generateImageID(info); f.err != nil {
		return
	}
	f.images[imgName] = info

	return
}

// RegisterImage registers an image, adding it to the PDF file but not adding
// it to the page. Use Image() with the same filename to add the image to the
// page. Note that Image() calls this function, so this function is only
// necessary if you need information about the image before placing it.
//
// This function is now deprecated in favor of RegisterImageOptions.
// See Image() for restrictions on the image and the "tp" parameters.
func (f *Fpdf) RegisterImage(fileStr, tp string) (info *ImageInfoType) {
	options := ImageOptions{
		ReadDpi:   false,
		ImageType: tp,
	}
	return f.RegisterImageOptions(fileStr, options)
}

// RegisterImageOptions registers an image, adding it to the PDF file but not
// adding it to the page. Use Image() with the same filename to add the image
// to the page. Note that Image() calls this function, so this function is only
// necessary if you need information about the image before placing it. See
// Image() for restrictions on the image and the "tp" parameters.
func (f *Fpdf) RegisterImageOptions(fileStr string, options ImageOptions) (info *ImageInfoType) {
	info, ok := f.images[fileStr]
	if ok {
		return
	}

	file, err := os.Open(fileStr)
	if err != nil {
		f.err = err
		return
	}
	defer file.Close()

	// First use of this image, get info
	if options.ImageType == "" {
		pos := strings.LastIndex(fileStr, ".")
		if pos < 0 {
			f.err = fmt.Errorf("image file has no extension and no type was specified: %s", fileStr)
			return
		}
		options.ImageType = fileStr[pos+1:]
	}

	return f.RegisterImageOptionsReader(fileStr, options, file)
}

// GetImageInfo returns information about the registered image specified by
// imageStr. If the image has not been registered, nil is returned. The
// internal error is not modified by this method.
func (f *Fpdf) GetImageInfo(imageStr string) (info *ImageInfoType) {
	return f.images[imageStr]
}

// ImportObjects imports objects from gofpdi into current document
func (f *Fpdf) ImportObjects(objs map[string][]byte) {
	for k, v := range objs {
		f.importedObjs[k] = v
	}
}

// ImportObjPos imports object hash positions from gofpdi
func (f *Fpdf) ImportObjPos(objPos map[string]map[int]string) {
	for k, v := range objPos {
		f.importedObjPos[k] = v
	}
}

// putImportedTemplates writes the imported template objects to the PDF
func (f *Fpdf) putImportedTemplates() {
	nOffset := f.n + 1

	// keep track of list of sha1 hashes (to be replaced with integers)
	objsIDHash := make([]string, len(f.importedObjs))

	// actual object data with new id
	objsIDData := make([][]byte, len(f.importedObjs))

	// Populate hash slice and data slice
	i := 0
	for k, v := range f.importedObjs {
		objsIDHash[i] = k
		objsIDData[i] = v

		i++
	}

	// Populate a lookup table to get an object id from a hash
	hashToObjID := make(map[string]int, len(f.importedObjs))
	for i = 0; i < len(objsIDHash); i++ {
		hashToObjID[objsIDHash[i]] = i + nOffset
	}

	// Now, replace hashes inside data with %040d object id
	for i = 0; i < len(objsIDData); i++ {
		// get hash
		hash := objsIDHash[i]

		for pos, h := range f.importedObjPos[hash] {
			// Convert object id into a 40 character string padded with spaces
			objIDPadded := fmt.Sprintf("%40s", fmt.Sprintf("%d", hashToObjID[h]))

			// Convert objIDPadded into []byte
			objIDBytes := []byte(objIDPadded)

			// Replace sha1 hash with object id padded
			for j := pos; j < pos+40; j++ {
				objsIDData[i][j] = objIDBytes[j-pos]
			}
		}

		// Save objsIDHash so that procset dictionary has the correct object ids
		f.importedTplIDs[hash] = i + nOffset
	}

	// Now, put objects
	for i = 0; i < len(objsIDData); i++ {
		f.newobj()
		f.out(string(objsIDData[i]))
	}
}

// UseImportedTemplate uses imported template from gofpdi. It draws imported
// PDF page onto page.
func (f *Fpdf) UseImportedTemplate(tplName string, scaleX float64, scaleY float64, tX float64, tY float64) {
	f.outf("q 0 J 1 w 0 j 0 G 0 g q %.4F 0 0 %.4F %.4F %.4F cm %s Do Q Q\n", scaleX*f.k, scaleY*f.k, tX*f.k, (tY+f.h)*f.k, tplName)
}

// ImportTemplates imports gofpdi template names into importedTplObjs for
// inclusion in the procset dictionary
func (f *Fpdf) ImportTemplates(tpls map[string]string) {
	for tplName, tplID := range tpls {
		f.importedTplObjs[tplName] = tplID
	}
}

// GetConversionRatio returns the conversion ratio based on the unit given when
// creating the PDF.
func (f *Fpdf) GetConversionRatio() float64 {
	return f.k
}

// GetXY returns the abscissa and ordinate of the current position.
//
// Note: the value returned for the abscissa will be affected by the current
// cell margin. To account for this, you may need to either add the value
// returned by GetCellMargin() to it or call SetCellMargin(0) to remove the
// cell margin.
func (f *Fpdf) GetXY() (float64, float64) {
	return f.x, f.y
}

// GetX returns the abscissa of the current position.
//
// Note: the value returned will be affected by the current cell margin. To
// account for this, you may need to either add the value returned by
// GetCellMargin() to it or call SetCellMargin(0) to remove the cell margin.
func (f *Fpdf) GetX() float64 {
	return f.x
}

// SetX defines the abscissa of the current position. If the passed value is
// negative, it is relative to the right of the page.
func (f *Fpdf) SetX(x float64) {
	if x >= 0 {
		f.x = x
	} else {
		f.x = f.w + x
	}
}

// GetY returns the ordinate of the current position.
func (f *Fpdf) GetY() float64 {
	return f.y
}

// SetY moves the current abscissa back to the left margin and sets the
// ordinate. If the passed value is negative, it is relative to the bottom of
// the page.
func (f *Fpdf) SetY(y float64) {
	// dbg("SetY x %.2f, lMargin %.2f", f.x, f.lMargin)
	f.x = f.lMargin
	if y >= 0 {
		f.y = y
	} else {
		f.y = f.h + y
	}
}

// SetHomeXY is a convenience method that sets the current position to the left
// and top margins.
func (f *Fpdf) SetHomeXY() {
	f.SetY(f.tMargin)
	f.SetX(f.lMargin)
}

// SetXY defines the abscissa and ordinate of the current position. If the
// passed values are negative, they are relative respectively to the right and
// bottom of the page.
func (f *Fpdf) SetXY(x, y float64) {
	f.SetY(y)
	f.SetX(x)
}

// SetProtection applies certain constraints on the finished PDF document.
//
// actionFlag is a bitflag that controls various document operations.
// CnProtectPrint allows the document to be printed. CnProtectModify allows a
// document to be modified by a PDF editor. CnProtectCopy allows text and
// images to be copied into the system clipboard. CnProtectAnnotForms allows
// annotations and forms to be added by a PDF editor. These values can be
// combined by or-ing them together, for example,
// CnProtectCopy|CnProtectModify. This flag is advisory; not all PDF readers
// implement the constraints that this argument attempts to control.
//
// userPassStr specifies the password that will need to be provided to view the
// contents of the PDF. The permissions specified by actionFlag will apply.
//
// ownerPassStr specifies the password that will need to be provided to gain
// full access to the document regardless of the actionFlag value. An empty
// string for this argument will be replaced with a random value, effectively
// prohibiting full access to the document.
func (f *Fpdf) SetProtection(actionFlag byte, userPassStr, ownerPassStr string) {
	if f.err != nil {
		return
	}
	f.protect.setProtection(actionFlag, userPassStr, ownerPassStr)
}

// OutputAndClose sends the PDF document to the writer specified by w. This
// method will close both f and w, even if an error is detected and no document
// is produced.
func (f *Fpdf) OutputAndClose(w io.WriteCloser) error {
	f.Output(w)
	w.Close()
	return f.err
}

// OutputFileAndClose creates or truncates the file specified by fileStr and
// writes the PDF document to it. This method will close f and the newly
// written file, even if an error is detected and no document is produced.
//
// Most examples demonstrate the use of this method.
func (f *Fpdf) OutputFileAndClose(fileStr string) error {
	if f.err == nil {
		pdfFile, err := os.Create(fileStr)
		if err == nil {
			f.Output(pdfFile)
			pdfFile.Close()
		} else {
			f.err = err
		}
	}
	return f.err
}

// Output sends the PDF document to the writer specified by w. No output will
// take place if an error has occurred in the document generation process. w
// remains open after this function returns. After returning, f is in a closed
// state and its methods should not be called.
func (f *Fpdf) Output(w io.Writer) error {
	if f.err != nil {
		return f.err
	}
	// dbg("Output")
	if f.state < 3 {
		f.Close()
	}
	_, err := f.buffer.WriteTo(w)
	if err != nil {
		f.err = err
	}
	return f.err
}

func (f *Fpdf) getpagesizestr(sizeStr string) (size SizeType) {
	if f.err != nil {
		return
	}
	sizeStr = strings.ToLower(sizeStr)
	// dbg("Size [%s]", sizeStr)
	var ok bool
	size, ok = f.stdPageSizes[sizeStr]
	if ok {
		// dbg("found %s", sizeStr)
		size.Wd /= f.k
		size.Ht /= f.k

	} else {
		f.err = fmt.Errorf("unknown page size %s", sizeStr)
	}
	return
}

// GetPageSizeStr returns the SizeType for the given sizeStr (that is A4, A3, etc..)
func (f *Fpdf) GetPageSizeStr(sizeStr string) (size SizeType) {
	return f.getpagesizestr(sizeStr)
}

func (f *Fpdf) _getpagesize(size SizeType) SizeType {
	if size.Wd > size.Ht {
		size.Wd, size.Ht = size.Ht, size.Wd
	}
	return size
}

func (f *Fpdf) beginpage(orientationStr string, size SizeType) {
	if f.err != nil {
		return
	}
	f.page++
	// add the default page boxes, if any exist, to the page
	f.pageBoxes[f.page] = make(map[string]PageBox)
	for box, pb := range f.defPageBoxes {
		f.pageBoxes[f.page][box] = pb
	}
	f.pages = append(f.pages, bytes.NewBufferString(""))
	f.pageLinks = append(f.pageLinks, make([]linkType, 0, 0))
	f.state = 2
	f.x = f.lMargin
	f.y = f.tMargin
	f.fontFamily = ""
	// Check page size and orientation
	if orientationStr == "" {
		orientationStr = f.defOrientation
	} else {
		orientationStr = strings.ToUpper(orientationStr[0:1])
	}
	if orientationStr != f.curOrientation || size.Wd != f.curPageSize.Wd || size.Ht != f.curPageSize.Ht {
		// New size or orientation
		if orientationStr == "P" {
			f.w = size.Wd
			f.h = size.Ht
		} else {
			f.w = size.Ht
			f.h = size.Wd
		}
		f.wPt = f.w * f.k
		f.hPt = f.h * f.k
		f.pageBreakTrigger = f.h - f.bMargin
		f.curOrientation = orientationStr
		f.curPageSize = size
	}
	if orientationStr != f.defOrientation || size.Wd != f.defPageSize.Wd || size.Ht != f.defPageSize.Ht {
		f.pageSizes[f.page] = SizeType{f.wPt, f.hPt}
	}
	return
}

func (f *Fpdf) endpage() {
	f.EndLayer()
	f.state = 1
}

// Load a font definition file from the given Reader
func (f *Fpdf) loadfont(r io.Reader) (def fontDefType) {
	if f.err != nil {
		return
	}
	// dbg("Loading font [%s]", fontStr)
	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	if err != nil {
		f.err = err
		return
	}
	err = json.Unmarshal(buf.Bytes(), &def)
	if err != nil {
		f.err = err
		return
	}

	if def.i, err = generateFontID(def); err != nil {
		f.err = err
	}
	// dump(def)
	return
}

// Escape special characters in strings
func (f *Fpdf) escape(s string) string {
	s = strings.Replace(s, "\\", "\\\\", -1)
	s = strings.Replace(s, "(", "\\(", -1)
	s = strings.Replace(s, ")", "\\)", -1)
	s = strings.Replace(s, "\r", "\\r", -1)
	return s
}

// textstring formats a text string
func (f *Fpdf) textstring(s string) string {
	if f.protect.encrypted {
		b := []byte(s)
		f.protect.rc4(uint32(f.n), &b)
		s = string(b)
	}
	return "(" + f.escape(s) + ")"
}

func blankCount(str string) (count int) {
	l := len(str)
	for j := 0; j < l; j++ {
		if byte(' ') == str[j] {
			count++
		}
	}
	return
}

// SetUnderlineThickness accepts a multiplier for adjusting the text underline
// thickness, defaulting to 1. See SetUnderlineThickness example.
func (f *Fpdf) SetUnderlineThickness(thickness float64) {
	f.userUnderlineThickness = thickness
}

// Underline text
func (f *Fpdf) dounderline(x, y float64, txt string) string {
	up := float64(f.currentFont.Up)
	ut := float64(f.currentFont.Ut) * f.userUnderlineThickness
	w := f.GetStringWidth(txt) + f.ws*float64(blankCount(txt))
	return sprintf("%.2f %.2f %.2f %.2f re f", x*f.k,
		(f.h-(y-up/1000*f.fontSize))*f.k, w*f.k, -ut/1000*f.fontSizePt)
}

func bufEqual(buf []byte, str string) bool {
	return string(buf[0:len(str)]) == str
}

func be16(buf []byte) int {
	return 256*int(buf[0]) + int(buf[1])
}

func (f *Fpdf) newImageInfo() *ImageInfoType {
	// default dpi to 72 unless told otherwise
	return &ImageInfoType{scale: f.k, dpi: 72}
}

// parsejpg extracts info from io.Reader with JPEG data
// Thank you, Bruno Michel, for providing this code.
func (f *Fpdf) parsejpg(r io.Reader) (info *ImageInfoType) {
	info = f.newImageInfo()
	var (
		data bytes.Buffer
		err  error
	)
	_, err = data.ReadFrom(r)
	if err != nil {
		f.err = err
		return
	}
	info.data = data.Bytes()

	config, err := jpeg.DecodeConfig(bytes.NewReader(info.data))
	if err != nil {
		f.err = err
		return
	}
	info.w = float64(config.Width)
	info.h = float64(config.Height)
	info.f = "DCTDecode"
	info.bpc = 8
	switch config.ColorModel {
	case color.GrayModel:
		info.cs = "DeviceGray"
	case color.YCbCrModel:
		info.cs = "DeviceRGB"
	case color.CMYKModel:
		info.cs = "DeviceCMYK"
	default:
		f.err = fmt.Errorf("image JPEG buffer has unsupported color space (%v)", config.ColorModel)
		return
	}
	return
}

// parsepng extracts info from a PNG data
func (f *Fpdf) parsepng(r io.Reader, readdpi bool) (info *ImageInfoType) {
	buf, err := bufferFromReader(r)
	if err != nil {
		f.err = err
		return
	}
	return f.parsepngstream(buf, readdpi)
}

func (f *Fpdf) readBeInt32(r io.Reader) (val int32) {
	err := binary.Read(r, binary.BigEndian, &val)
	if err != nil && err != io.EOF {
		f.err = err
	}
	return
}

func (f *Fpdf) readByte(r io.Reader) (val byte) {
	err := binary.Read(r, binary.BigEndian, &val)
	if err != nil {
		f.err = err
	}
	return
}

// parsegif extracts info from a GIF data (via PNG conversion)
func (f *Fpdf) parsegif(r io.Reader) (info *ImageInfoType) {
	data, err := bufferFromReader(r)
	if err != nil {
		f.err = err
		return
	}
	var img image.Image
	img, err = gif.Decode(data)
	if err != nil {
		f.err = err
		return
	}
	pngBuf := new(bytes.Buffer)
	err = png.Encode(pngBuf, img)
	if err != nil {
		f.err = err
		return
	}
	return f.parsepngstream(pngBuf, false)
}

// newobj begins a new object
func (f *Fpdf) newobj() {
	// dbg("newobj")
	f.n++
	for j := len(f.offsets); j <= f.n; j++ {
		f.offsets = append(f.offsets, 0)
	}
	f.offsets[f.n] = f.buffer.Len()
	f.outf("%d 0 obj", f.n)
}

func (f *Fpdf) putstream(b []byte) {
	// dbg("putstream")
	if f.protect.encrypted {
		f.protect.rc4(uint32(f.n), &b)
	}
	f.out("stream")
	f.out(string(b))
	f.out("endstream")
}

// out; Add a line to the document
func (f *Fpdf) out(s string) {
	if f.state == 2 {
		f.pages[f.page].WriteString(s)
		f.pages[f.page].WriteString("\n")
	} else {
		f.buffer.WriteString(s)
		f.buffer.WriteString("\n")
	}
}

// outbuf adds a buffered line to the document
func (f *Fpdf) outbuf(r io.Reader) {
	if f.state == 2 {
		f.pages[f.page].ReadFrom(r)
		f.pages[f.page].WriteString("\n")
	} else {
		f.buffer.ReadFrom(r)
		f.buffer.WriteString("\n")
	}
}

// RawWriteStr writes a string directly to the PDF generation buffer. This is a
// low-level function that is not required for normal PDF construction. An
// understanding of the PDF specification is needed to use this method
// correctly.
func (f *Fpdf) RawWriteStr(str string) {
	f.out(str)
}

// RawWriteBuf writes the contents of the specified buffer directly to the PDF
// generation buffer. This is a low-level function that is not required for
// normal PDF construction. An understanding of the PDF specification is needed
// to use this method correctly.
func (f *Fpdf) RawWriteBuf(r io.Reader) {
	f.outbuf(r)
}

// outf adds a formatted line to the document
func (f *Fpdf) outf(fmtStr string, args ...interface{}) {
	f.out(sprintf(fmtStr, args...))
}

// SetDefaultCatalogSort sets the default value of the catalog sort flag that
// will be used when initializing a new Fpdf instance. See SetCatalogSort() for
// more details.
func SetDefaultCatalogSort(flag bool) {
	gl.catalogSort = flag
}

// SetCatalogSort sets a flag that will be used, if true, to consistently order
// the document's internal resource catalogs. This method is typically only
// used for test purposes to facilitate PDF comparison.
func (f *Fpdf) SetCatalogSort(flag bool) {
	f.catalogSort = flag
}

// SetDefaultCreationDate sets the default value of the document creation date
// that will be used when initializing a new Fpdf instance. See
// SetCreationDate() for more details.
func SetDefaultCreationDate(tm time.Time) {
	gl.creationDate = tm
}

// SetCreationDate fixes the document's internal CreationDate value. By
// default, the time when the document is generated is used for this value.
// This method is typically only used for testing purposes to facilitate PDF
// comparison. Specify a zero-value time to revert to the default behavior.
func (f *Fpdf) SetCreationDate(tm time.Time) {
	f.creationDate = tm
}

// SetJavascript adds Adobe JavaScript to the document.
func (f *Fpdf) SetJavascript(script string) {
	f.javascript = &script
}

// RegisterAlias adds an (alias, replacement) pair to the document so we can
// replace all occurrences of that alias after writing but before the
// document is closed.
func (f *Fpdf) RegisterAlias(alias, replacement string) {
	f.aliasMap[alias] = replacement
}

func (f *Fpdf) replaceAliases() {
	for alias, replacement := range f.aliasMap {
		for n := 1; n <= f.page; n++ {
			s := f.pages[n].String()
			if strings.Contains(s, alias) {
				s = strings.Replace(s, alias, replacement, -1)
				f.pages[n].Truncate(0)
				f.pages[n].WriteString(s)
			}
		}
	}
}

func (f *Fpdf) putpages() {
	var wPt, hPt float64
	var pageSize SizeType
	// var linkList []linkType
	var ok bool
	nb := f.page
	if len(f.aliasNbPagesStr) > 0 {
		// Replace number of pages
		alias := utf8toutf16(f.aliasNbPagesStr, false)
		r := utf8toutf16(sprintf("%d", nb), false)
		f.RegisterAlias(alias, r)
		f.RegisterAlias(f.aliasNbPagesStr, sprintf("%d", nb))
	}
	f.replaceAliases()
	if f.defOrientation == "P" {
		wPt = f.defPageSize.Wd * f.k
		hPt = f.defPageSize.Ht * f.k
	} else {
		wPt = f.defPageSize.Ht * f.k
		hPt = f.defPageSize.Wd * f.k
	}
	for n := 1; n <= nb; n++ {
		// Page
		f.newobj()
		f.out("<</Type /Page")
		f.out("/Parent 1 0 R")
		pageSize, ok = f.pageSizes[n]
		if ok {
			f.outf("/MediaBox [0 0 %.2f %.2f]", pageSize.Wd, pageSize.Ht)
		}
		for t, pb := range f.pageBoxes[n] {
			f.outf("/%s [%.2f %.2f %.2f %.2f]", t, pb.X, pb.Y, pb.Wd, pb.Ht)
		}
		f.out("/Resources 2 0 R")
		// Links
		if len(f.pageLinks[n]) > 0 {
			var annots fmtBuffer
			annots.printf("/Annots [")
			for _, pl := range f.pageLinks[n] {
				annots.printf("<</Type /Annot /Subtype /Link /Rect [%.2f %.2f %.2f %.2f] /Border [0 0 0] ",
					pl.x, pl.y, pl.x+pl.wd, pl.y-pl.ht)
				if pl.link == 0 {
					annots.printf("/A <</S /URI /URI %s>>>>", f.textstring(pl.linkStr))
				} else {
					l := f.links[pl.link]
					var sz SizeType
					var h float64
					sz, ok = f.pageSizes[l.page]
					if ok {
						h = sz.Ht
					} else {
						h = hPt
					}
					// dbg("h [%.2f], l.y [%.2f] f.k [%.2f]\n", h, l.y, f.k)
					annots.printf("/Dest [%d 0 R /XYZ 0 %.2f null]>>", 1+2*l.page, h-l.y*f.k)
				}
			}
			annots.printf("]")
			f.out(annots.String())
		}
		if f.pdfVersion > "1.3" {
			f.out("/Group <</Type /Group /S /Transparency /CS /DeviceRGB>>")
		}
		f.outf("/Contents %d 0 R>>", f.n+1)
		f.out("endobj")
		// Page content
		f.newobj()
		if f.compress {
			data := sliceCompress(f.pages[n].Bytes())
			f.outf("<</Filter /FlateDecode /Length %d>>", len(data))
			f.putstream(data)
		} else {
			f.outf("<</Length %d>>", f.pages[n].Len())
			f.putstream(f.pages[n].Bytes())
		}
		f.out("endobj")
	}
	// Pages root
	f.offsets[1] = f.buffer.Len()
	f.out("1 0 obj")
	f.out("<</Type /Pages")
	var kids fmtBuffer
	kids.printf("/Kids [")
	for i := 0; i < nb; i++ {
		kids.printf("%d 0 R ", 3+2*i)
	}
	kids.printf("]")
	f.out(kids.String())
	f.outf("/Count %d", nb)
	f.outf("/MediaBox [0 0 %.2f %.2f]", wPt, hPt)
	f.out(">>")
	f.out("endobj")
}

func (f *Fpdf) putfonts() {
	if f.err != nil {
		return
	}
	nf := f.n
	for _, diff := range f.diffs {
		// Encodings
		f.newobj()
		f.outf("<</Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [%s]>>", diff)
		f.out("endobj")
	}
	{
		var fileList []string
		var info fontFileType
		var file string
		for file = range f.fontFiles {
			fileList = append(fileList, file)
		}
		if f.catalogSort {
			sort.SliceStable(fileList, func(i, j int) bool { return fileList[i] < fileList[j] })
		}
		for _, file = range fileList {
			info = f.fontFiles[file]
			if info.fontType != "UTF8" {
				f.newobj()
				info.n = f.n
				f.fontFiles[file] = info

				var font []byte

				if info.embedded {
					font = info.content
				} else {
					var err error
					font, err = f.loadFontFile(file)
					if err != nil {
						f.err = err
						return
					}
				}
				compressed := file[len(file)-2:] == ".z"
				if !compressed && info.length2 > 0 {
					buf := font[6:info.length1]
					buf = append(buf, font[6+info.length1+6:info.length2]...)
					font = buf
				}
				f.outf("<</Length %d", len(font))
				if compressed {
					f.out("/Filter /FlateDecode")
				}
				f.outf("/Length1 %d", info.length1)
				if info.length2 > 0 {
					f.outf("/Length2 %d /Length3 0", info.length2)
				}
				f.out(">>")
				f.putstream(font)
				f.out("endobj")
			}
		}
	}
	{
		var keyList []string
		var font fontDefType
		var key string
		for key = range f.fonts {
			keyList = append(keyList, key)
		}
		if f.catalogSort {
			sort.SliceStable(keyList, func(i, j int) bool { return keyList[i] < keyList[j] })
		}
		for _, key = range keyList {
			font = f.fonts[key]
			// Font objects
			font.N = f.n + 1
			f.fonts[key] = font
			tp := font.Tp
			name := font.Name
			switch tp {
			case "Core":
				// Core font
				f.newobj()
				f.out("<</Type /Font")
				f.outf("/BaseFont /%s", name)
				f.out("/Subtype /Type1")
				if name != "Symbol" && name != "ZapfDingbats" {
					f.out("/Encoding /WinAnsiEncoding")
				}
				f.out(">>")
				f.out("endobj")
			case "Type1":
				fallthrough
			case "TrueType":
				// Additional Type1 or TrueType/OpenType font
				f.newobj()
				f.out("<</Type /Font")
				f.outf("/BaseFont /%s", name)
				f.outf("/Subtype /%s", tp)
				f.out("/FirstChar 32 /LastChar 255")
				f.outf("/Widths %d 0 R", f.n+1)
				f.outf("/FontDescriptor %d 0 R", f.n+2)
				if font.DiffN > 0 {
					f.outf("/Encoding %d 0 R", nf+font.DiffN)
				} else {
					f.out("/Encoding /WinAnsiEncoding")
				}
				f.out(">>")
				f.out("endobj")
				// Widths
				f.newobj()
				var s fmtBuffer
				s.WriteString("[")
				for j := 32; j < 256; j++ {
					s.printf("%d ", font.Cw[j])
				}
				s.WriteString("]")
				f.out(s.String())
				f.out("endobj")
				// Descriptor
				f.newobj()
				s.Truncate(0)
				s.printf("<</Type /FontDescriptor /FontName /%s ", name)
				s.printf("/Ascent %d ", font.Desc.Ascent)
				s.printf("/Descent %d ", font.Desc.Descent)
				s.printf("/CapHeight %d ", font.Desc.CapHeight)
				s.printf("/Flags %d ", font.Desc.Flags)
				s.printf("/FontBBox [%d %d %d %d] ", font.Desc.FontBBox.Xmin, font.Desc.FontBBox.Ymin,
					font.Desc.FontBBox.Xmax, font.Desc.FontBBox.Ymax)
				s.printf("/ItalicAngle %d ", font.Desc.ItalicAngle)
				s.printf("/StemV %d ", font.Desc.StemV)
				s.printf("/MissingWidth %d ", font.Desc.MissingWidth)
				var suffix string
				if tp != "Type1" {
					suffix = "2"
				}
				s.printf("/FontFile%s %d 0 R>>", suffix, f.fontFiles[font.File].n)
				f.out(s.String())
				f.out("endobj")
			case "UTF8":
				fontName := "utf8" + font.Name
				usedRunes := font.usedRunes
				delete(usedRunes, 0)
				utf8FontStream := font.utf8File.GenerateСutFont(usedRunes)
				utf8FontSize := len(utf8FontStream)
				compressedFontStream := sliceCompress(utf8FontStream)
				CodeSignDictionary := font.utf8File.CodeSymbolDictionary
				delete(CodeSignDictionary, 0)

				f.newobj()
				f.out(fmt.Sprintf("<</Type /Font\n/Subtype /Type0\n/BaseFont /%s\n/Encoding /Identity-H\n/DescendantFonts [%d 0 R]\n/ToUnicode %d 0 R>>\n"+"endobj", fontName, f.n+1, f.n+2))

				f.newobj()
				f.out("<</Type /Font\n/Subtype /CIDFontType2\n/BaseFont /" + fontName + "\n" +
					"/CIDSystemInfo " + strconv.Itoa(f.n+2) + " 0 R\n/FontDescriptor " + strconv.Itoa(f.n+3) + " 0 R")
				if font.Desc.MissingWidth != 0 {
					f.out("/DW " + strconv.Itoa(font.Desc.MissingWidth) + "")
				}
				f.generateCIDFontMap(&font, font.utf8File.LastRune)
				f.out("/CIDToGIDMap " + strconv.Itoa(f.n+4) + " 0 R>>")
				f.out("endobj")

				f.newobj()
				f.out("<</Length " + strconv.Itoa(len(toUnicode)) + ">>")
				f.putstream([]byte(toUnicode))
				f.out("endobj")

				// CIDInfo
				f.newobj()
				f.out("<</Registry (Adobe)\n/Ordering (UCS)\n/Supplement 0>>")
				f.out("endobj")

				// Font descriptor
				f.newobj()
				var s fmtBuffer
				s.printf("<</Type /FontDescriptor /FontName /%s\n /Ascent %d", fontName, font.Desc.Ascent)
				s.printf(" /Descent %d", font.Desc.Descent)
				s.printf(" /CapHeight %d", font.Desc.CapHeight)
				v := font.Desc.Flags
				v = v | 4
				v = v &^ 32
				s.printf(" /Flags %d", v)
				s.printf("/FontBBox [%d %d %d %d] ", font.Desc.FontBBox.Xmin, font.Desc.FontBBox.Ymin,
					font.Desc.FontBBox.Xmax, font.Desc.FontBBox.Ymax)
				s.printf(" /ItalicAngle %d", font.Desc.ItalicAngle)
				s.printf(" /StemV %d", font.Desc.StemV)
				s.printf(" /MissingWidth %d", font.Desc.MissingWidth)
				s.printf("/FontFile2 %d 0 R", f.n+2)
				s.printf(">>")
				f.out(s.String())
				f.out("endobj")

				// Embed CIDToGIDMap
				cidToGidMap := make([]byte, 256*256*2)

				for cc, glyph := range CodeSignDictionary {
					cidToGidMap[cc*2] = byte(glyph >> 8)
					cidToGidMap[cc*2+1] = byte(glyph & 0xFF)
				}

				cidToGidMap = sliceCompress(cidToGidMap)
				f.newobj()
				f.out("<</Length " + strconv.Itoa(len(cidToGidMap)) + "/Filter /FlateDecode>>")
				f.putstream(cidToGidMap)
				f.out("endobj")

				//Font file
				f.newobj()
				f.out("<</Length " + strconv.Itoa(len(compressedFontStream)))
				f.out("/Filter /FlateDecode")
				f.out("/Length1 " + strconv.Itoa(utf8FontSize))
				f.out(">>")
				f.putstream(compressedFontStream)
				f.out("endobj")
			default:
				f.err = fmt.Errorf("unsupported font type: %s", tp)
				return
			}
		}
	}
	return
}

func (f *Fpdf) generateCIDFontMap(font *fontDefType, LastRune int) {
	rangeID := 0
	cidArray := make(map[int]*untypedKeyMap)
	cidArrayKeys := make([]int, 0)
	prevCid := -2
	prevWidth := -1
	interval := false
	startCid := 1
	cwLen := LastRune + 1

	// for each character
	for cid := startCid; cid < cwLen; cid++ {
		if font.Cw[cid] == 0x00 {
			continue
		}
		width := font.Cw[cid]
		if width == 65535 {
			width = 0
		}
		if numb, OK := font.usedRunes[cid]; cid > 255 && (!OK || numb == 0) {
			continue
		}

		if cid == prevCid+1 {
			if width == prevWidth {

				if width == cidArray[rangeID].get(0) {
					cidArray[rangeID].put(nil, width)
				} else {
					cidArray[rangeID].pop()
					rangeID = prevCid
					r := untypedKeyMap{
						valueSet: make([]int, 0),
						keySet:   make([]interface{}, 0),
					}
					cidArray[rangeID] = &r
					cidArrayKeys = append(cidArrayKeys, rangeID)
					cidArray[rangeID].put(nil, prevWidth)
					cidArray[rangeID].put(nil, width)
				}
				interval = true
				cidArray[rangeID].put("interval", 1)
			} else {
				if interval {
					// new range
					rangeID = cid
					r := untypedKeyMap{
						valueSet: make([]int, 0),
						keySet:   make([]interface{}, 0),
					}
					cidArray[rangeID] = &r
					cidArrayKeys = append(cidArrayKeys, rangeID)
					cidArray[rangeID].put(nil, width)
				} else {
					cidArray[rangeID].put(nil, width)
				}
				interval = false
			}
		} else {
			rangeID = cid
			r := untypedKeyMap{
				valueSet: make([]int, 0),
				keySet:   make([]interface{}, 0),
			}
			cidArray[rangeID] = &r
			cidArrayKeys = append(cidArrayKeys, rangeID)
			cidArray[rangeID].put(nil, width)
			interval = false
		}
		prevCid = cid
		prevWidth = width

	}
	previousKey := -1
	nextKey := -1
	isInterval := false
	for g := 0; g < len(cidArrayKeys); {
		key := cidArrayKeys[g]
		ws := *cidArray[key]
		cws := len(ws.keySet)
		if (key == nextKey) && (!isInterval) && (ws.getIndex("interval") < 0 || cws < 4) {
			if cidArray[key].getIndex("interval") >= 0 {
				cidArray[key].delete("interval")
			}
			cidArray[previousKey] = arrayMerge(cidArray[previousKey], cidArray[key])
			cidArrayKeys = remove(cidArrayKeys, key)
		} else {
			g++
			previousKey = key
		}
		nextKey = key + cws
		// ui := ws.getIndex("interval")
		// ui = ui + 1
		if ws.getIndex("interval") >= 0 {
			if cws > 3 {
				isInterval = true
			} else {
				isInterval = false
			}
			cidArray[key].delete("interval")
			nextKey--
		} else {
			isInterval = false
		}
	}
	var w fmtBuffer
	for _, k := range cidArrayKeys {
		ws := cidArray[k]
		if len(arrayCountValues(ws.valueSet)) == 1 {
			w.printf(" %d %d %d", k, k+len(ws.valueSet)-1, ws.get(0))
		} else {
			w.printf(" %d [ %s ]\n", k, implode(" ", ws.valueSet))
		}
	}
	f.out("/W [" + w.String() + " ]")
}

func implode(sep string, arr []int) string {
	var s fmtBuffer
	for i := 0; i < len(arr)-1; i++ {
		s.printf("%v", arr[i])
		s.printf(sep)
	}
	if len(arr) > 0 {
		s.printf("%v", arr[len(arr)-1])
	}
	return s.String()
}

func arrayCountValues(mp []int) map[int]int {
	answer := make(map[int]int)
	for _, v := range mp {
		answer[v] = answer[v] + 1
	}
	return answer
}

func (f *Fpdf) loadFontFile(name string) ([]byte, error) {
	if f.fontLoader != nil {
		reader, err := f.fontLoader.Open(name)
		if err == nil {
			data, err := ioutil.ReadAll(reader)
			if closer, ok := reader.(io.Closer); ok {
				closer.Close()
			}
			return data, err
		}
	}
	return ioutil.ReadFile(path.Join(f.fontpath, name))
}

func (f *Fpdf) putimages() {
	var keyList []string
	var key string
	for key = range f.images {
		keyList = append(keyList, key)
	}
	if f.catalogSort {
		sort.SliceStable(keyList, func(i, j int) bool { return f.images[keyList[i]].w < f.images[keyList[j]].w })
	}
	for _, key = range keyList {
		f.putimage(f.images[key])
	}
}

func (f *Fpdf) putimage(info *ImageInfoType) {
	f.newobj()
	info.n = f.n
	f.out("<</Type /XObject")
	f.out("/Subtype /Image")
	f.outf("/Width %d", int(info.w))
	f.outf("/Height %d", int(info.h))
	if info.cs == "Indexed" {
		f.outf("/ColorSpace [/Indexed /DeviceRGB %d %d 0 R]", len(info.pal)/3-1, f.n+1)
	} else {
		f.outf("/ColorSpace /%s", info.cs)
		if info.cs == "DeviceCMYK" {
			f.out("/Decode [1 0 1 0 1 0 1 0]")
		}
	}
	f.outf("/BitsPerComponent %d", info.bpc)
	if len(info.f) > 0 {
		f.outf("/Filter /%s", info.f)
	}
	if len(info.dp) > 0 {
		f.outf("/DecodeParms <<%s>>", info.dp)
	}
	if len(info.trns) > 0 {
		var trns fmtBuffer
		for _, v := range info.trns {
			trns.printf("%d %d ", v, v)
		}
		f.outf("/Mask [%s]", trns.String())
	}
	if info.smask != nil {
		f.outf("/SMask %d 0 R", f.n+1)
	}
	f.outf("/Length %d>>", len(info.data))
	f.putstream(info.data)
	f.out("endobj")
	// 	Soft mask
	if len(info.smask) > 0 {
		smask := &ImageInfoType{
			w:     info.w,
			h:     info.h,
			cs:    "DeviceGray",
			bpc:   8,
			f:     info.f,
			dp:    sprintf("/Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns %d", int(info.w)),
			data:  info.smask,
			scale: f.k,
		}
		f.putimage(smask)
	}
	// 	Palette
	if info.cs == "Indexed" {
		f.newobj()
		if f.compress {
			pal := sliceCompress(info.pal)
			f.outf("<</Filter /FlateDecode /Length %d>>", len(pal))
			f.putstream(pal)
		} else {
			f.outf("<</Length %d>>", len(info.pal))
			f.putstream(info.pal)
		}
		f.out("endobj")
	}
}

func (f *Fpdf) putxobjectdict() {
	{
		var image *ImageInfoType
		var key string
		var keyList []string
		for key = range f.images {
			keyList = append(keyList, key)
		}
		if f.catalogSort {
			sort.SliceStable(keyList, func(i, j int) bool { return f.images[keyList[i]].i < f.images[keyList[j]].i })
		}
		for _, key = range keyList {
			image = f.images[key]
			f.outf("/I%s %d 0 R", image.i, image.n)
		}
	}
	{
		var keyList []string
		var key string
		var tpl Template
		keyList = templateKeyList(f.templates, f.catalogSort)
		for _, key = range keyList {
			tpl = f.templates[key]
			// for _, tpl := range f.templates {
			id := tpl.ID()
			if objID, ok := f.templateObjects[id]; ok {
				f.outf("/TPL%s %d 0 R", id, objID)
			}
		}
	}
	{
		for tplName, objID := range f.importedTplObjs {
			// here replace obj id hash with n
			f.outf("%s %d 0 R", tplName, f.importedTplIDs[objID])
		}
	}
}

func (f *Fpdf) putresourcedict() {
	f.out("/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]")
	f.out("/Font <<")
	{
		var keyList []string
		var font fontDefType
		var key string
		for key = range f.fonts {
			keyList = append(keyList, key)
		}
		if f.catalogSort {
			sort.SliceStable(keyList, func(i, j int) bool { return f.fonts[keyList[i]].i < f.fonts[keyList[j]].i })
		}
		for _, key = range keyList {
			font = f.fonts[key]
			f.outf("/F%s %d 0 R", font.i, font.N)
		}
	}
	f.out(">>")
	f.out("/XObject <<")
	f.putxobjectdict()
	f.out(">>")
	count := len(f.blendList)
	if count > 1 {
		f.out("/ExtGState <<")
		for j := 1; j < count; j++ {
			f.outf("/GS%d %d 0 R", j, f.blendList[j].objNum)
		}
		f.out(">>")
	}
	count = len(f.gradientList)
	if count > 1 {
		f.out("/Shading <<")
		for j := 1; j < count; j++ {
			f.outf("/Sh%d %d 0 R", j, f.gradientList[j].objNum)
		}
		f.out(">>")
	}
	// Layers
	f.layerPutResourceDict()
	f.spotColorPutResourceDict()
}

func (f *Fpdf) putBlendModes() {
	count := len(f.blendList)
	for j := 1; j < count; j++ {
		bl := f.blendList[j]
		f.newobj()
		f.blendList[j].objNum = f.n
		f.outf("<</Type /ExtGState /ca %s /CA %s /BM /%s>>",
			bl.fillStr, bl.strokeStr, bl.modeStr)
		f.out("endobj")
	}
}

func (f *Fpdf) putGradients() {
	count := len(f.gradientList)
	for j := 1; j < count; j++ {
		var f1 int
		gr := f.gradientList[j]
		if gr.tp == 2 || gr.tp == 3 {
			f.newobj()
			f.outf("<</FunctionType 2 /Domain [0.0 1.0] /C0 [%s] /C1 [%s] /N 1>>", gr.clr1Str, gr.clr2Str)
			f.out("endobj")
			f1 = f.n
		}
		f.newobj()
		f.outf("<</ShadingType %d /ColorSpace /DeviceRGB", gr.tp)
		if gr.tp == 2 {
			f.outf("/Coords [%.5f %.5f %.5f %.5f] /Function %d 0 R /Extend [true true]>>",
				gr.x1, gr.y1, gr.x2, gr.y2, f1)
		} else if gr.tp == 3 {
			f.outf("/Coords [%.5f %.5f 0 %.5f %.5f %.5f] /Function %d 0 R /Extend [true true]>>",
				gr.x1, gr.y1, gr.x2, gr.y2, gr.r, f1)
		}
		f.out("endobj")
		f.gradientList[j].objNum = f.n
	}
}

func (f *Fpdf) putjavascript() {
	if f.javascript == nil {
		return
	}

	f.newobj()
	f.nJs = f.n
	f.out("<<")
	f.outf("/Names [(EmbeddedJS) %d 0 R]", f.n+1)
	f.out(">>")
	f.out("endobj")
	f.newobj()
	f.out("<<")
	f.out("/S /JavaScript")
	f.outf("/JS %s", f.textstring(*f.javascript))
	f.out(">>")
	f.out("endobj")
}

func (f *Fpdf) putresources() {
	if f.err != nil {
		return
	}
	f.layerPutLayers()
	f.putBlendModes()
	f.putGradients()
	f.putSpotColors()
	f.putfonts()
	if f.err != nil {
		return
	}
	f.putimages()
	f.putTemplates()
	f.putImportedTemplates() // gofpdi
	// 	Resource dictionary
	f.offsets[2] = f.buffer.Len()
	f.out("2 0 obj")
	f.out("<<")
	f.putresourcedict()
	f.out(">>")
	f.out("endobj")
	f.putjavascript()
	if f.protect.encrypted {
		f.newobj()
		f.protect.objNum = f.n
		f.out("<<")
		f.out("/Filter /Standard")
		f.out("/V 1")
		f.out("/R 2")
		f.outf("/O (%s)", f.escape(string(f.protect.oValue)))
		f.outf("/U (%s)", f.escape(string(f.protect.uValue)))
		f.outf("/P %d", f.protect.pValue)
		f.out(">>")
		f.out("endobj")
	}
	return
}

func (f *Fpdf) putinfo() {
	var tm time.Time
	if len(f.producer) > 0 {
		f.outf("/Producer %s", f.textstring(f.producer))
	}
	if len(f.title) > 0 {
		f.outf("/Title %s", f.textstring(f.title))
	}
	if len(f.subject) > 0 {
		f.outf("/Subject %s", f.textstring(f.subject))
	}
	if len(f.author) > 0 {
		f.outf("/Author %s", f.textstring(f.author))
	}
	if len(f.keywords) > 0 {
		f.outf("/Keywords %s", f.textstring(f.keywords))
	}
	if len(f.creator) > 0 {
		f.outf("/Creator %s", f.textstring(f.creator))
	}
	if f.creationDate.IsZero() {
		tm = time.Now()
	} else {
		tm = f.creationDate
	}
	f.outf("/CreationDate %s", f.textstring("D:"+tm.Format("20060102150405")))
}

func (f *Fpdf) putcatalog() {
	f.out("/Type /Catalog")
	f.out("/Pages 1 0 R")
	switch f.zoomMode {
	case "fullpage":
		f.out("/OpenAction [3 0 R /Fit]")
	case "fullwidth":
		f.out("/OpenAction [3 0 R /FitH null]")
	case "real":
		f.out("/OpenAction [3 0 R /XYZ null null 1]")
	}
	// } 	else if !is_string($this->zoomMode))
	// 		$this->out('/OpenAction [3 0 R /XYZ null null '.sprintf('%.2f',$this->zoomMode/100).']');
	switch f.layoutMode {
	case "single", "SinglePage":
		f.out("/PageLayout /SinglePage")
	case "continuous", "OneColumn":
		f.out("/PageLayout /OneColumn")
	case "two", "TwoColumnLeft":
		f.out("/PageLayout /TwoColumnLeft")
	case "TwoColumnRight":
		f.out("/PageLayout /TwoColumnRight")
	case "TwoPageLeft", "TwoPageRight":
		if f.pdfVersion < "1.5" {
			f.pdfVersion = "1.5"
		}
		f.out("/PageLayout /" + f.layoutMode)
	}
	// Bookmarks
	if len(f.outlines) > 0 {
		f.outf("/Outlines %d 0 R", f.outlineRoot)
		f.out("/PageMode /UseOutlines")
	}
	// Layers
	f.layerPutCatalog()
	// JavaScript
	if f.javascript != nil {
		f.outf("/Names <</JavaScript %d 0 R>>", f.nJs)
	}
}

func (f *Fpdf) putheader() {
	if len(f.blendMap) > 0 && f.pdfVersion < "1.4" {
		f.pdfVersion = "1.4"
	}
	f.outf("%%PDF-%s", f.pdfVersion)
}

func (f *Fpdf) puttrailer() {
	f.outf("/Size %d", f.n+1)
	f.outf("/Root %d 0 R", f.n)
	f.outf("/Info %d 0 R", f.n-1)
	if f.protect.encrypted {
		f.outf("/Encrypt %d 0 R", f.protect.objNum)
		f.out("/ID [()()]")
	}
}

func (f *Fpdf) putxmp() {
	if len(f.xmp) == 0 {
		return
	}
	f.newobj()
	f.outf("<< /Type /Metadata /Subtype /XML /Length %d >>", len(f.xmp))
	f.putstream(f.xmp)
	f.out("endobj")
}

func (f *Fpdf) putbookmarks() {
	nb := len(f.outlines)
	if nb > 0 {
		lru := make(map[int]int)
		level := 0
		for i, o := range f.outlines {
			if o.level > 0 {
				parent := lru[o.level-1]
				f.outlines[i].parent = parent
				f.outlines[parent].last = i
				if o.level > level {
					f.outlines[parent].first = i
				}
			} else {
				f.outlines[i].parent = nb
			}
			if o.level <= level && i > 0 {
				prev := lru[o.level]
				f.outlines[prev].next = i
				f.outlines[i].prev = prev
			}
			lru[o.level] = i
			level = o.level
		}
		n := f.n + 1
		for _, o := range f.outlines {
			f.newobj()
			f.outf("<</Title %s", f.textstring(o.text))
			f.outf("/Parent %d 0 R", n+o.parent)
			if o.prev != -1 {
				f.outf("/Prev %d 0 R", n+o.prev)
			}
			if o.next != -1 {
				f.outf("/Next %d 0 R", n+o.next)
			}
			if o.first != -1 {
				f.outf("/First %d 0 R", n+o.first)
			}
			if o.last != -1 {
				f.outf("/Last %d 0 R", n+o.last)
			}
			f.outf("/Dest [%d 0 R /XYZ 0 %.2f null]", 1+2*o.p, (f.h-o.y)*f.k)
			f.out("/Count 0>>")
			f.out("endobj")
		}
		f.newobj()
		f.outlineRoot = f.n
		f.outf("<</Type /Outlines /First %d 0 R", n)
		f.outf("/Last %d 0 R>>", n+lru[0])
		f.out("endobj")
	}
}

func (f *Fpdf) enddoc() {
	if f.err != nil {
		return
	}
	f.layerEndDoc()
	f.putheader()
	f.putpages()
	f.putresources()
	if f.err != nil {
		return
	}
	// Bookmarks
	f.putbookmarks()
	// Metadata
	f.putxmp()
	// 	Info
	f.newobj()
	f.out("<<")
	f.putinfo()
	f.out(">>")
	f.out("endobj")
	// 	Catalog
	f.newobj()
	f.out("<<")
	f.putcatalog()
	f.out(">>")
	f.out("endobj")
	// Cross-ref
	o := f.buffer.Len()
	f.out("xref")
	f.outf("0 %d", f.n+1)
	f.out("0000000000 65535 f ")
	for j := 1; j <= f.n; j++ {
		f.outf("%010d 00000 n ", f.offsets[j])
	}
	// Trailer
	f.out("trailer")
	f.out("<<")
	f.puttrailer()
	f.out(">>")
	f.out("startxref")
	f.outf("%d", o)
	f.out("%%EOF")
	f.state = 3
	return
}

// Path Drawing

// MoveTo moves the stylus to (x, y) without drawing the path from the
// previous point. Paths must start with a MoveTo to set the original
// stylus location or the result is undefined.
//
// Create a "path" by moving a virtual stylus around the page (with
// MoveTo, LineTo, CurveTo, CurveBezierCubicTo, ArcTo & ClosePath)
// then draw it or  fill it in (with DrawPath). The main advantage of
// using the path drawing routines rather than multiple Fpdf.Line is
// that PDF creates nice line joins at the angles, rather than just
// overlaying the lines.
func (f *Fpdf) MoveTo(x, y float64) {
	f.point(x, y)
	f.x, f.y = x, y
}

// LineTo creates a line from the current stylus location to (x, y), which
// becomes the new stylus location. Note that this only creates the line in
// the path; it does not actually draw the line on the page.
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) LineTo(x, y float64) {
	f.outf("%.2f %.2f l", x*f.k, (f.h-y)*f.k)
	f.x, f.y = x, y
}

// CurveTo creates a single-segment quadratic Bézier curve. The curve starts at
// the current stylus location and ends at the point (x, y). The control point
// (cx, cy) specifies the curvature. At the start point, the curve is tangent
// to the straight line between the current stylus location and the control
// point. At the end point, the curve is tangent to the straight line between
// the end point and the control point.
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) CurveTo(cx, cy, x, y float64) {
	f.outf("%.5f %.5f %.5f %.5f v", cx*f.k, (f.h-cy)*f.k, x*f.k, (f.h-y)*f.k)
	f.x, f.y = x, y
}

// CurveBezierCubicTo creates a single-segment cubic Bézier curve. The curve
// starts at the current stylus location and ends at the point (x, y). The
// control points (cx0, cy0) and (cx1, cy1) specify the curvature. At the
// current stylus, the curve is tangent to the straight line between the
// current stylus location and the control point (cx0, cy0). At the end point,
// the curve is tangent to the straight line between the end point and the
// control point (cx1, cy1).
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) CurveBezierCubicTo(cx0, cy0, cx1, cy1, x, y float64) {
	f.curve(cx0, cy0, cx1, cy1, x, y)
	f.x, f.y = x, y
}

// ClosePath creates a line from the current location to the last MoveTo point
// (if not the same) and mark the path as closed so the first and last lines
// join nicely.
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) ClosePath() {
	f.outf("h")
}

// DrawPath actually draws the path on the page.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D".
// Path-painting operators as defined in the PDF specification are also
// allowed: "S" (Stroke the path), "s" (Close and stroke the path),
// "f" (fill the path, using the nonzero winding number), "f*"
// (Fill the path, using the even-odd rule), "B" (Fill and then stroke
// the path, using the nonzero winding number rule), "B*" (Fill and
// then stroke the path, using the even-odd rule), "b" (Close, fill,
// and then stroke the path, using the nonzero winding number rule) and
// "b*" (Close, fill, and then stroke the path, using the even-odd
// rule).
// Drawing uses the current draw color, line width, and cap style
// centered on the
// path. Filling uses the current fill color.
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) DrawPath(styleStr string) {
	f.outf(fillDrawOp(styleStr))
}

// ArcTo draws an elliptical arc centered at point (x, y). rx and ry specify its
// horizontal and vertical radii. If the start of the arc is not at
// the current position, a connecting line will be drawn.
//
// degRotate specifies the angle that the arc will be rotated. degStart and
// degEnd specify the starting and ending angle of the arc. All angles are
// specified in degrees and measured counter-clockwise from the 3 o'clock
// position.
//
// styleStr can be "F" for filled, "D" for outlined only, or "DF" or "FD" for
// outlined and filled. An empty string will be replaced with "D". Drawing uses
// the current draw color, line width, and cap style centered on the arc's
// path. Filling uses the current fill color.
//
// The MoveTo() example demonstrates this method.
func (f *Fpdf) ArcTo(x, y, rx, ry, degRotate, degStart, degEnd float64) {
	f.arc(x, y, rx, ry, degRotate, degStart, degEnd, "", true)
}

func (f *Fpdf) arc(x, y, rx, ry, degRotate, degStart, degEnd float64,
	styleStr string, path bool) {
	x *= f.k
	y = (f.h - y) * f.k
	rx *= f.k
	ry *= f.k
	segments := int(degEnd-degStart) / 60
	if segments < 2 {
		segments = 2
	}
	angleStart := degStart * math.Pi / 180
	angleEnd := degEnd * math.Pi / 180
	angleTotal := angleEnd - angleStart
	dt := angleTotal / float64(segments)
	dtm := dt / 3
	if degRotate != 0 {
		a := -degRotate * math.Pi / 180
		f.outf("q %.5f %.5f %.5f %.5f %.5f %.5f cm",
			math.Cos(a), -1*math.Sin(a),
			math.Sin(a), math.Cos(a), x, y)
		x = 0
		y = 0
	}
	t := angleStart
	a0 := x + rx*math.Cos(t)
	b0 := y + ry*math.Sin(t)
	c0 := -rx * math.Sin(t)
	d0 := ry * math.Cos(t)
	sx := a0 / f.k // start point of arc
	sy := f.h - (b0 / f.k)
	if path {
		if f.x != sx || f.y != sy {
			// Draw connecting line to start point
			f.LineTo(sx, sy)
		}
	} else {
		f.point(sx, sy)
	}
	for j := 1; j <= segments; j++ {
		// Draw this bit of the total curve
		t = (float64(j) * dt) + angleStart
		a1 := x + rx*math.Cos(t)
		b1 := y + ry*math.Sin(t)
		c1 := -rx * math.Sin(t)
		d1 := ry * math.Cos(t)
		f.curve((a0+(c0*dtm))/f.k,
			f.h-((b0+(d0*dtm))/f.k),
			(a1-(c1*dtm))/f.k,
			f.h-((b1-(d1*dtm))/f.k),
			a1/f.k,
			f.h-(b1/f.k))
		a0 = a1
		b0 = b1
		c0 = c1
		d0 = d1
		if path {
			f.x = a1 / f.k
			f.y = f.h - (b1 / f.k)
		}
	}
	if !path {
		f.out(fillDrawOp(styleStr))
	}
	if degRotate != 0 {
		f.out("Q")
	}
}
