/*
 * Copyright (c) 2014 Kurt Jung (Gmail: kurt.w.jung)
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

import (
	"regexp"
	"strings"
)

// HTMLBasicSegmentType defines a segment of literal text in which the current
// attributes do not vary, or an open tag or a close tag.
type HTMLBasicSegmentType struct {
	Cat  byte              // 'O' open tag, 'C' close tag, 'T' text
	Str  string            // Literal text unchanged, tags are lower case
	Attr map[string]string // Attribute keys are lower case
}

// HTMLBasicTokenize returns a list of HTML tags and literal elements. This is
// done with regular expressions, so the result is only marginally better than
// useless.
func HTMLBasicTokenize(htmlStr string) (list []HTMLBasicSegmentType) {
	// This routine is adapted from http://www.fpdf.org/
	list = make([]HTMLBasicSegmentType, 0, 16)
	htmlStr = strings.Replace(htmlStr, "\n", " ", -1)
	htmlStr = strings.Replace(htmlStr, "\r", "", -1)
	tagRe, _ := regexp.Compile(`(?U)<.*>`)
	attrRe, _ := regexp.Compile(`([^=]+)=["']?([^"']+)`)
	capList := tagRe.FindAllStringIndex(htmlStr, -1)
	if capList != nil {
		var seg HTMLBasicSegmentType
		var parts []string
		pos := 0
		for _, cap := range capList {
			if pos < cap[0] {
				seg.Cat = 'T'
				seg.Str = htmlStr[pos:cap[0]]
				seg.Attr = nil
				list = append(list, seg)
			}
			if htmlStr[cap[0]+1] == '/' {
				seg.Cat = 'C'
				seg.Str = strings.ToLower(htmlStr[cap[0]+2 : cap[1]-1])
				seg.Attr = nil
				list = append(list, seg)
			} else {
				// Extract attributes
				parts = strings.Split(htmlStr[cap[0]+1:cap[1]-1], " ")
				if len(parts) > 0 {
					for j, part := range parts {
						if j == 0 {
							seg.Cat = 'O'
							seg.Str = strings.ToLower(parts[0])
							seg.Attr = make(map[string]string)
						} else {
							attrList := attrRe.FindAllStringSubmatch(part, -1)
							if attrList != nil {
								for _, attr := range attrList {
									seg.Attr[strings.ToLower(attr[1])] = attr[2]
								}
							}
						}
					}
					list = append(list, seg)
				}
			}
			pos = cap[1]
		}
		if len(htmlStr) > pos {
			seg.Cat = 'T'
			seg.Str = htmlStr[pos:]
			seg.Attr = nil
			list = append(list, seg)
		}
	} else {
		list = append(list, HTMLBasicSegmentType{Cat: 'T', Str: htmlStr, Attr: nil})
	}
	return
}

// HTMLBasicType is used for rendering a very basic subset of HTML. It supports
// only hyperlinks and bold, italic and underscore attributes. In the Link
// structure, the ClrR, ClrG and ClrB fields (0 through 255) define the color
// of hyperlinks. The Bold, Italic and Underscore values define the hyperlink
// style.
type HTMLBasicType struct {
	pdf  *Fpdf
	Link struct {
		ClrR, ClrG, ClrB         int
		Bold, Italic, Underscore bool
	}
}

// HTMLBasicNew returns an instance that facilitates writing basic HTML in the
// specified PDF file.
func (f *Fpdf) HTMLBasicNew() (html HTMLBasicType) {
	html.pdf = f
	html.Link.ClrR, html.Link.ClrG, html.Link.ClrB = 0, 0, 128
	html.Link.Bold, html.Link.Italic, html.Link.Underscore = false, false, true
	return
}

// Write prints text from the current position using the currently selected
// font. See HTMLBasicNew() to create a receiver that is associated with the
// PDF document instance. The text can be encoded with a basic subset of HTML
// that includes hyperlinks and tags for italic (I), bold (B), underscore
// (U) and center (CENTER) attributes. When the right margin is reached a line
// break occurs and text continues from the left margin. Upon method exit, the
// current position is left at the end of the text.
//
// lineHt indicates the line height in the unit of measure specified in New().
func (html *HTMLBasicType) Write(lineHt float64, htmlStr string) {
	var boldLvl, italicLvl, underscoreLvl, linkBold, linkItalic, linkUnderscore int
	var textR, textG, textB = html.pdf.GetTextColor()
	var hrefStr string
	if html.Link.Bold {
		linkBold = 1
	}
	if html.Link.Italic {
		linkItalic = 1
	}
	if html.Link.Underscore {
		linkUnderscore = 1
	}
	setStyle := func(boldAdj, italicAdj, underscoreAdj int) {
		styleStr := ""
		boldLvl += boldAdj
		if boldLvl > 0 {
			styleStr += "B"
		}
		italicLvl += italicAdj
		if italicLvl > 0 {
			styleStr += "I"
		}
		underscoreLvl += underscoreAdj
		if underscoreLvl > 0 {
			styleStr += "U"
		}
		html.pdf.SetFont("", styleStr, 0)
	}
	putLink := func(urlStr, txtStr string) {
		// Put a hyperlink
		html.pdf.SetTextColor(html.Link.ClrR, html.Link.ClrG, html.Link.ClrB)
		setStyle(linkBold, linkItalic, linkUnderscore)
		html.pdf.WriteLinkString(lineHt, txtStr, urlStr)
		setStyle(-linkBold, -linkItalic, -linkUnderscore)
		html.pdf.SetTextColor(textR, textG, textB)
	}
	list := HTMLBasicTokenize(htmlStr)
	var ok bool
	alignStr := "L"
	for _, el := range list {
		switch el.Cat {
		case 'T':
			if len(hrefStr) > 0 {
				putLink(hrefStr, el.Str)
				hrefStr = ""
			} else {
				if alignStr == "C" || alignStr == "R" {
					html.pdf.WriteAligned(0, lineHt, el.Str, alignStr)
				} else {
					html.pdf.Write(lineHt, el.Str)
				}
			}
		case 'O':
			switch el.Str {
			case "b":
				setStyle(1, 0, 0)
			case "i":
				setStyle(0, 1, 0)
			case "u":
				setStyle(0, 0, 1)
			case "br":
				html.pdf.Ln(lineHt)
			case "center":
				html.pdf.Ln(lineHt)
				alignStr = "C"
			case "right":
				html.pdf.Ln(lineHt)
				alignStr = "R"
			case "left":
				html.pdf.Ln(lineHt)
				alignStr = "L"
			case "a":
				hrefStr, ok = el.Attr["href"]
				if !ok {
					hrefStr = ""
				}
			}
		case 'C':
			switch el.Str {
			case "b":
				setStyle(-1, 0, 0)
			case "i":
				setStyle(0, -1, 0)
			case "u":
				setStyle(0, 0, -1)
			case "center":
				html.pdf.Ln(lineHt)
				alignStr = "L"
			case "right":
				html.pdf.Ln(lineHt)
				alignStr = "L"
			}
		}
	}
}
