/*
 * Copyright (c) 2013-2016 Kurt Jung (Gmail: kurt.w.jung)
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
	"bytes"
	"fmt"
	"strings"
)

func (f *Fpdf) pngColorSpace(ct byte) (colspace string, colorVal int) {
	colorVal = 1
	switch ct {
	case 0, 4:
		colspace = "DeviceGray"
	case 2, 6:
		colspace = "DeviceRGB"
		colorVal = 3
	case 3:
		colspace = "Indexed"
	default:
		f.err = fmt.Errorf("unknown color type in PNG buffer: %d", ct)
	}
	return
}

func (f *Fpdf) parsepngstream(buf *bytes.Buffer, readdpi bool) (info *ImageInfoType) {
	info = f.newImageInfo()
	// 	Check signature
	if string(buf.Next(8)) != "\x89PNG\x0d\x0a\x1a\x0a" {
		f.err = fmt.Errorf("not a PNG buffer")
		return
	}
	// Read header chunk
	_ = buf.Next(4)
	if string(buf.Next(4)) != "IHDR" {
		f.err = fmt.Errorf("incorrect PNG buffer")
		return
	}
	w := f.readBeInt32(buf)
	h := f.readBeInt32(buf)
	bpc := f.readByte(buf)
	if bpc > 8 {
		f.err = fmt.Errorf("16-bit depth not supported in PNG file")
	}
	ct := f.readByte(buf)
	var colspace string
	var colorVal int
	colspace, colorVal = f.pngColorSpace(ct)
	if f.err != nil {
		return
	}
	if f.readByte(buf) != 0 {
		f.err = fmt.Errorf("'unknown compression method in PNG buffer")
		return
	}
	if f.readByte(buf) != 0 {
		f.err = fmt.Errorf("'unknown filter method in PNG buffer")
		return
	}
	if f.readByte(buf) != 0 {
		f.err = fmt.Errorf("interlacing not supported in PNG buffer")
		return
	}
	_ = buf.Next(4)
	dp := sprintf("/Predictor 15 /Colors %d /BitsPerComponent %d /Columns %d", colorVal, bpc, w)
	// Scan chunks looking for palette, transparency and image data
	pal := make([]byte, 0, 32)
	var trns []int
	data := make([]byte, 0, 32)
	loop := true
	for loop {
		n := int(f.readBeInt32(buf))
		// dbg("Loop [%d]", n)
		switch string(buf.Next(4)) {
		case "PLTE":
			// dbg("PLTE")
			// Read palette
			pal = buf.Next(n)
			_ = buf.Next(4)
		case "tRNS":
			// dbg("tRNS")
			// Read transparency info
			t := buf.Next(n)
			switch ct {
			case 0:
				trns = []int{int(t[1])} // ord(substr($t,1,1)));
			case 2:
				trns = []int{int(t[1]), int(t[3]), int(t[5])} // array(ord(substr($t,1,1)), ord(substr($t,3,1)), ord(substr($t,5,1)));
			default:
				pos := strings.Index(string(t), "\x00")
				if pos >= 0 {
					trns = []int{pos} // array($pos);
				}
			}
			_ = buf.Next(4)
		case "IDAT":
			// dbg("IDAT")
			// Read image data block
			data = append(data, buf.Next(n)...)
			_ = buf.Next(4)
		case "IEND":
			// dbg("IEND")
			loop = false
		case "pHYs":
			// dbg("pHYs")
			// png files theoretically support different x/y dpi
			// but we ignore files like this
			// but if they're the same then we can stamp our info
			// object with it
			x := int(f.readBeInt32(buf))
			y := int(f.readBeInt32(buf))
			units := buf.Next(1)[0]
			// fmt.Printf("got a pHYs block, x=%d, y=%d, u=%d, readdpi=%t\n",
			// x, y, int(units), readdpi)
			// only modify the info block if the user wants us to
			if x == y && readdpi {
				switch units {
				// if units is 1 then measurement is px/meter
				case 1:
					info.dpi = float64(x) / 39.3701 // inches per meter
				default:
					info.dpi = float64(x)
				}
			}
			_ = buf.Next(4)
		default:
			// dbg("default")
			_ = buf.Next(n + 4)
		}
		if loop {
			loop = n > 0
		}
	}
	if colspace == "Indexed" && len(pal) == 0 {
		f.err = fmt.Errorf("missing palette in PNG buffer")
	}
	info.w = float64(w)
	info.h = float64(h)
	info.cs = colspace
	info.bpc = int(bpc)
	info.f = "FlateDecode"
	info.dp = dp
	info.pal = pal
	info.trns = trns
	// dbg("ct [%d]", ct)
	if ct >= 4 {
		// Separate alpha and color channels
		var err error
		data, err = sliceUncompress(data)
		if err != nil {
			f.err = err
			return
		}
		var color, alpha bytes.Buffer
		if ct == 4 {
			// Gray image
			width := int(w)
			height := int(h)
			length := 2 * width
			var pos, elPos int
			for i := 0; i < height; i++ {
				pos = (1 + length) * i
				color.WriteByte(data[pos])
				alpha.WriteByte(data[pos])
				elPos = pos + 1
				for k := 0; k < width; k++ {
					color.WriteByte(data[elPos])
					alpha.WriteByte(data[elPos+1])
					elPos += 2
				}
			}
		} else {
			// RGB image
			width := int(w)
			height := int(h)
			length := 4 * width
			var pos, elPos int
			for i := 0; i < height; i++ {
				pos = (1 + length) * i
				color.WriteByte(data[pos])
				alpha.WriteByte(data[pos])
				elPos = pos + 1
				for k := 0; k < width; k++ {
					color.Write(data[elPos : elPos+3])
					alpha.WriteByte(data[elPos+3])
					elPos += 4
				}
			}
		}
		data = sliceCompress(color.Bytes())
		info.smask = sliceCompress(alpha.Bytes())
		if f.pdfVersion < "1.4" {
			f.pdfVersion = "1.4"
		}
	}
	info.data = data
	return
}
