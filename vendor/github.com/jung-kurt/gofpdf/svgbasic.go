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
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
)

var pathCmdSub *strings.Replacer

func init() {
	// Handle permitted constructions like "100L200,230"
	pathCmdSub = strings.NewReplacer(",", " ",
		"L", " L ", "l", " l ",
		"C", " C ", "c", " c ",
		"M", " M ", "m", " m ",
		"H", " H ", "h", " h ",
		"V", " V ", "v", " v ",
		"Q", " Q ", "q", " q ",
		"Z", " Z ", "z", " z ")
}

// SVGBasicSegmentType describes a single curve or position segment
type SVGBasicSegmentType struct {
	Cmd byte // See http://www.w3.org/TR/SVG/paths.html for path command structure
	Arg [6]float64
}

func absolutizePath(segs []SVGBasicSegmentType) {
	var x, y float64
	var segPtr *SVGBasicSegmentType
	adjust := func(pos int, adjX, adjY float64) {
		segPtr.Arg[pos] += adjX
		segPtr.Arg[pos+1] += adjY
	}
	for j, seg := range segs {
		segPtr = &segs[j]
		if j == 0 && seg.Cmd == 'm' {
			segPtr.Cmd = 'M'
		}
		switch segPtr.Cmd {
		case 'M':
			x = seg.Arg[0]
			y = seg.Arg[1]
		case 'm':
			adjust(0, x, y)
			segPtr.Cmd = 'M'
			x = segPtr.Arg[0]
			y = segPtr.Arg[1]
		case 'L':
			x = seg.Arg[0]
			y = seg.Arg[1]
		case 'l':
			adjust(0, x, y)
			segPtr.Cmd = 'L'
			x = segPtr.Arg[0]
			y = segPtr.Arg[1]
		case 'C':
			x = seg.Arg[4]
			y = seg.Arg[5]
		case 'c':
			adjust(0, x, y)
			adjust(2, x, y)
			adjust(4, x, y)
			segPtr.Cmd = 'C'
			x = segPtr.Arg[4]
			y = segPtr.Arg[5]
		case 'Q':
			x = seg.Arg[2]
			y = seg.Arg[3]
		case 'q':
			adjust(0, x, y)
			adjust(2, x, y)
			segPtr.Cmd = 'Q'
			x = segPtr.Arg[2]
			y = segPtr.Arg[3]
		case 'H':
			x = seg.Arg[0]
		case 'h':
			segPtr.Arg[0] += x
			segPtr.Cmd = 'H'
			x += seg.Arg[0]
		case 'V':
			y = seg.Arg[0]
		case 'v':
			segPtr.Arg[0] += y
			segPtr.Cmd = 'V'
			y += seg.Arg[0]
		case 'z':
			segPtr.Cmd = 'Z'
		}
	}
}

func pathParse(pathStr string) (segs []SVGBasicSegmentType, err error) {
	var seg SVGBasicSegmentType
	var j, argJ, argCount, prevArgCount int
	setup := func(n int) {
		// It is not strictly necessary to clear arguments, but result may be clearer
		// to caller
		for j := 0; j < len(seg.Arg); j++ {
			seg.Arg[j] = 0.0
		}
		argJ = 0
		argCount = n
		prevArgCount = n
	}
	var str string
	var c byte
	pathStr = pathCmdSub.Replace(pathStr)
	strList := strings.Fields(pathStr)
	count := len(strList)
	for j = 0; j < count && err == nil; j++ {
		str = strList[j]
		if argCount == 0 { // Look for path command or argument continuation
			c = str[0]
			if c == '-' || (c >= '0' && c <= '9') { // More arguments
				if j > 0 {
					setup(prevArgCount)
					// Repeat previous action
					if seg.Cmd == 'M' {
						seg.Cmd = 'L'
					} else if seg.Cmd == 'm' {
						seg.Cmd = 'l'
					}
				} else {
					err = fmt.Errorf("expecting SVG path command at first position, got %s", str)
				}
			}
		}
		if err == nil {
			if argCount == 0 {
				seg.Cmd = str[0]
				switch seg.Cmd {
				case 'M', 'm': // Absolute/relative moveto: x, y
					setup(2)
				case 'C', 'c': // Absolute/relative Bézier curve: cx0, cy0, cx1, cy1, x1, y1
					setup(6)
				case 'H', 'h': // Absolute/relative horizontal line to: x
					setup(1)
				case 'L', 'l': // Absolute/relative lineto: x, y
					setup(2)
				case 'Q', 'q': // Absolute/relative quadratic curve: x0, y0, x1, y1
					setup(4)
				case 'V', 'v': // Absolute/relative vertical line to: y
					setup(1)
				case 'Z', 'z': // closepath instruction (takes no arguments)
					segs = append(segs, seg)
				default:
					err = fmt.Errorf("expecting SVG path command at position %d, got %s", j, str)
				}
			} else {
				seg.Arg[argJ], err = strconv.ParseFloat(str, 64)
				if err == nil {
					argJ++
					argCount--
					if argCount == 0 {
						segs = append(segs, seg)
					}
				}
			}
		}
	}
	if err == nil {
		if argCount == 0 {
			absolutizePath(segs)
		} else {
			err = fmt.Errorf("expecting additional (%d) numeric arguments", argCount)
		}
	}
	return
}

// SVGBasicType aggregates the information needed to describe a multi-segment
// basic vector image
type SVGBasicType struct {
	Wd, Ht   float64
	Segments [][]SVGBasicSegmentType
}

// SVGBasicParse parses a simple scalable vector graphics (SVG) buffer into a
// descriptor. Only a small subset of the SVG standard, in particular the path
// information generated by jSignature, is supported. The returned path data
// includes only the commands 'M' (absolute moveto: x, y), 'L' (absolute
// lineto: x, y), 'C' (absolute cubic Bézier curve: cx0, cy0, cx1, cy1,
// x1,y1), 'Q' (absolute quadratic Bézier curve: x0, y0, x1, y1) and 'Z'
// (closepath).
func SVGBasicParse(buf []byte) (sig SVGBasicType, err error) {
	type pathType struct {
		D string `xml:"d,attr"`
	}
	type srcType struct {
		Wd    float64    `xml:"width,attr"`
		Ht    float64    `xml:"height,attr"`
		Paths []pathType `xml:"path"`
	}
	var src srcType
	err = xml.Unmarshal(buf, &src)
	if err == nil {
		if src.Wd > 0 && src.Ht > 0 {
			sig.Wd, sig.Ht = src.Wd, src.Ht
			var segs []SVGBasicSegmentType
			for _, path := range src.Paths {
				if err == nil {
					segs, err = pathParse(path.D)
					if err == nil {
						sig.Segments = append(sig.Segments, segs)
					}
				}
			}
		} else {
			err = fmt.Errorf("unacceptable values for basic SVG extent: %.2f x %.2f",
				sig.Wd, sig.Ht)
		}
	}
	return
}

// SVGBasicFileParse parses a simple scalable vector graphics (SVG) file into a
// basic descriptor. The SVGBasicWrite() example demonstrates this method.
func SVGBasicFileParse(svgFileStr string) (sig SVGBasicType, err error) {
	var buf []byte
	buf, err = ioutil.ReadFile(svgFileStr)
	if err == nil {
		sig, err = SVGBasicParse(buf)
	}
	return
}
