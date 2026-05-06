/*
 * Copyright (c) 2013 Kurt Jung (Gmail: kurt.w.jung)
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

// Utility to generate font definition files

// Version: 1.2
// Date:    2011-06-18
// Author:  Olivier PLATHEY
// Port to Go: Kurt Jung, 2013-07-15

import (
	"bufio"
	"compress/zlib"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func baseNoExt(fileStr string) string {
	str := filepath.Base(fileStr)
	extLen := len(filepath.Ext(str))
	if extLen > 0 {
		str = str[:len(str)-extLen]
	}
	return str
}

func loadMap(encodingFileStr string) (encList encListType, err error) {
	// printf("Encoding file string [%s]\n", encodingFileStr)
	var f *os.File
	// f, err = os.Open(encodingFilepath(encodingFileStr))
	f, err = os.Open(encodingFileStr)
	if err == nil {
		defer f.Close()
		for j := range encList {
			encList[j].uv = -1
			encList[j].name = ".notdef"
		}
		scanner := bufio.NewScanner(f)
		var enc encType
		var pos int
		for scanner.Scan() {
			// "!3F U+003F question"
			_, err = fmt.Sscanf(scanner.Text(), "!%x U+%x %s", &pos, &enc.uv, &enc.name)
			if err == nil {
				if pos < 256 {
					encList[pos] = enc
				} else {
					err = fmt.Errorf("map position 0x%2X exceeds 0xFF", pos)
					return
				}
			} else {
				return
			}
		}
		if err = scanner.Err(); err != nil {
			return
		}
	}
	return
}

// getInfoFromTrueType returns information from a TrueType font
func getInfoFromTrueType(fileStr string, msgWriter io.Writer, embed bool, encList encListType) (info fontInfoType, err error) {
	info.Widths = make([]int, 256)
	var ttf TtfType
	ttf, err = TtfParse(fileStr)
	if err != nil {
		return
	}
	if embed {
		if !ttf.Embeddable {
			err = fmt.Errorf("font license does not allow embedding")
			return
		}
		info.Data, err = ioutil.ReadFile(fileStr)
		if err != nil {
			return
		}
		info.OriginalSize = len(info.Data)
	}
	k := 1000.0 / float64(ttf.UnitsPerEm)
	info.FontName = ttf.PostScriptName
	info.Bold = ttf.Bold
	info.Desc.ItalicAngle = int(ttf.ItalicAngle)
	info.IsFixedPitch = ttf.IsFixedPitch
	info.Desc.Ascent = round(k * float64(ttf.TypoAscender))
	info.Desc.Descent = round(k * float64(ttf.TypoDescender))
	info.UnderlineThickness = round(k * float64(ttf.UnderlineThickness))
	info.UnderlinePosition = round(k * float64(ttf.UnderlinePosition))
	info.Desc.FontBBox = fontBoxType{
		round(k * float64(ttf.Xmin)),
		round(k * float64(ttf.Ymin)),
		round(k * float64(ttf.Xmax)),
		round(k * float64(ttf.Ymax)),
	}
	// printf("FontBBox\n")
	// dump(info.Desc.FontBBox)
	info.Desc.CapHeight = round(k * float64(ttf.CapHeight))
	info.Desc.MissingWidth = round(k * float64(ttf.Widths[0]))
	var wd int
	for j := 0; j < len(info.Widths); j++ {
		wd = info.Desc.MissingWidth
		if encList[j].name != ".notdef" {
			uv := encList[j].uv
			pos, ok := ttf.Chars[uint16(uv)]
			if ok {
				wd = round(k * float64(ttf.Widths[pos]))
			} else {
				fmt.Fprintf(msgWriter, "Character %s is missing\n", encList[j].name)
			}
		}
		info.Widths[j] = wd
	}
	// printf("getInfoFromTrueType/FontBBox\n")
	// dump(info.Desc.FontBBox)
	return
}

type segmentType struct {
	marker uint8
	tp     uint8
	size   uint32
	data   []byte
}

func segmentRead(r io.Reader) (s segmentType, err error) {
	if err = binary.Read(r, binary.LittleEndian, &s.marker); err != nil {
		return
	}
	if s.marker != 128 {
		err = fmt.Errorf("font file is not a valid binary Type1")
		return
	}
	if err = binary.Read(r, binary.LittleEndian, &s.tp); err != nil {
		return
	}
	if err = binary.Read(r, binary.LittleEndian, &s.size); err != nil {
		return
	}
	s.data = make([]byte, s.size)
	_, err = r.Read(s.data)
	return
}

// -rw-r--r-- 1 root root  9532 2010-04-22 11:27 /usr/share/fonts/type1/mathml/Symbol.afm
// -rw-r--r-- 1 root root 37744 2010-04-22 11:27 /usr/share/fonts/type1/mathml/Symbol.pfb

// getInfoFromType1 return information from a Type1 font
func getInfoFromType1(fileStr string, msgWriter io.Writer, embed bool, encList encListType) (info fontInfoType, err error) {
	info.Widths = make([]int, 256)
	if embed {
		var f *os.File
		f, err = os.Open(fileStr)
		if err != nil {
			return
		}
		defer f.Close()
		// Read first segment
		var s1, s2 segmentType
		s1, err = segmentRead(f)
		if err != nil {
			return
		}
		s2, err = segmentRead(f)
		if err != nil {
			return
		}
		info.Data = s1.data
		info.Data = append(info.Data, s2.data...)
		info.Size1 = s1.size
		info.Size2 = s2.size
	}
	afmFileStr := fileStr[0:len(fileStr)-3] + "afm"
	size, ok := fileSize(afmFileStr)
	if !ok {
		err = fmt.Errorf("font file (ATM) %s not found", afmFileStr)
		return
	} else if size == 0 {
		err = fmt.Errorf("font file (AFM) %s empty or not readable", afmFileStr)
		return
	}
	var f *os.File
	f, err = os.Open(afmFileStr)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	var fields []string
	var wd int
	var wt, name string
	wdMap := make(map[string]int)
	for scanner.Scan() {
		fields = strings.Fields(strings.TrimSpace(scanner.Text()))
		// Comment Generated by FontForge 20080203
		// FontName Symbol
		// C 32 ; WX 250 ; N space ; B 0 0 0 0 ;
		if len(fields) >= 2 {
			switch fields[0] {
			case "C":
				if wd, err = strconv.Atoi(fields[4]); err == nil {
					name = fields[7]
					wdMap[name] = wd
				}
			case "FontName":
				info.FontName = fields[1]
			case "Weight":
				wt = strings.ToLower(fields[1])
			case "ItalicAngle":
				info.Desc.ItalicAngle, err = strconv.Atoi(fields[1])
			case "Ascender":
				info.Desc.Ascent, err = strconv.Atoi(fields[1])
			case "Descender":
				info.Desc.Descent, err = strconv.Atoi(fields[1])
			case "UnderlineThickness":
				info.UnderlineThickness, err = strconv.Atoi(fields[1])
			case "UnderlinePosition":
				info.UnderlinePosition, err = strconv.Atoi(fields[1])
			case "IsFixedPitch":
				info.IsFixedPitch = fields[1] == "true"
			case "FontBBox":
				if info.Desc.FontBBox.Xmin, err = strconv.Atoi(fields[1]); err == nil {
					if info.Desc.FontBBox.Ymin, err = strconv.Atoi(fields[2]); err == nil {
						if info.Desc.FontBBox.Xmax, err = strconv.Atoi(fields[3]); err == nil {
							info.Desc.FontBBox.Ymax, err = strconv.Atoi(fields[4])
						}
					}
				}
			case "CapHeight":
				info.Desc.CapHeight, err = strconv.Atoi(fields[1])
			case "StdVW":
				info.Desc.StemV, err = strconv.Atoi(fields[1])
			}
		}
		if err != nil {
			return
		}
	}
	if err = scanner.Err(); err != nil {
		return
	}
	if info.FontName == "" {
		err = fmt.Errorf("the field FontName missing in AFM file %s", afmFileStr)
		return
	}
	info.Bold = wt == "bold" || wt == "black"
	var missingWd int
	missingWd, ok = wdMap[".notdef"]
	if ok {
		info.Desc.MissingWidth = missingWd
	}
	for j := 0; j < len(info.Widths); j++ {
		info.Widths[j] = info.Desc.MissingWidth
	}
	for j := 0; j < len(info.Widths); j++ {
		name = encList[j].name
		if name != ".notdef" {
			wd, ok = wdMap[name]
			if ok {
				info.Widths[j] = wd
			} else {
				fmt.Fprintf(msgWriter, "Character %s is missing\n", name)
			}
		}
	}
	// printf("getInfoFromType1/FontBBox\n")
	// dump(info.Desc.FontBBox)
	return
}

func makeFontDescriptor(info *fontInfoType) {
	if info.Desc.CapHeight == 0 {
		info.Desc.CapHeight = info.Desc.Ascent
	}
	info.Desc.Flags = 1 << 5
	if info.IsFixedPitch {
		info.Desc.Flags |= 1
	}
	if info.Desc.ItalicAngle != 0 {
		info.Desc.Flags |= 1 << 6
	}
	if info.Desc.StemV == 0 {
		if info.Bold {
			info.Desc.StemV = 120
		} else {
			info.Desc.StemV = 70
		}
	}
	// printf("makeFontDescriptor/FontBBox\n")
	// dump(info.Desc.FontBBox)
}

// makeFontEncoding builds differences from reference encoding
func makeFontEncoding(encList encListType, refEncFileStr string) (diffStr string, err error) {
	var refList encListType
	if refList, err = loadMap(refEncFileStr); err != nil {
		return
	}
	var buf fmtBuffer
	last := 0
	for j := 32; j < 256; j++ {
		if encList[j].name != refList[j].name {
			if j != last+1 {
				buf.printf("%d ", j)
			}
			last = j
			buf.printf("/%s ", encList[j].name)
		}
	}
	diffStr = strings.TrimSpace(buf.String())
	return
}

func makeDefinitionFile(fileStr, tpStr, encodingFileStr string, embed bool, encList encListType, info fontInfoType) error {
	var err error
	var def fontDefType
	def.Tp = tpStr
	def.Name = info.FontName
	makeFontDescriptor(&info)
	def.Desc = info.Desc
	// printf("makeDefinitionFile/FontBBox\n")
	// dump(def.Desc.FontBBox)
	def.Up = info.UnderlinePosition
	def.Ut = info.UnderlineThickness
	def.Cw = info.Widths
	def.Enc = baseNoExt(encodingFileStr)
	// fmt.Printf("encodingFileStr [%s], def.Enc [%s]\n", encodingFileStr, def.Enc)
	// fmt.Printf("reference [%s]\n", filepath.Join(filepath.Dir(encodingFileStr), "cp1252.map"))
	def.Diff, err = makeFontEncoding(encList, filepath.Join(filepath.Dir(encodingFileStr), "cp1252.map"))
	if err != nil {
		return err
	}
	def.File = info.File
	def.Size1 = int(info.Size1)
	def.Size2 = int(info.Size2)
	def.OriginalSize = info.OriginalSize
	// printf("Font definition file [%s]\n", fileStr)
	var buf []byte
	buf, err = json.Marshal(def)
	if err != nil {
		return err
	}
	var f *os.File
	f, err = os.Create(fileStr)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(buf)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}

	return err
}

// MakeFont generates a font definition file in JSON format. A definition file
// of this type is required to use non-core fonts in the PDF documents that
// gofpdf generates. See the makefont utility in the gofpdf package for a
// command line interface to this function.
//
// fontFileStr is the name of the TrueType file (extension .ttf), OpenType file
// (extension .otf) or binary Type1 file (extension .pfb) from which to
// generate a definition file. If an OpenType file is specified, it must be one
// that is based on TrueType outlines, not PostScript outlines; this cannot be
// determined from the file extension alone. If a Type1 file is specified, a
// metric file with the same pathname except with the extension .afm must be
// present.
//
// encodingFileStr is the name of the encoding file that corresponds to the
// font.
//
// dstDirStr is the name of the directory in which to save the definition file
// and, if embed is true, the compressed font file.
//
// msgWriter is the writer that is called to display messages throughout the
// process. Use nil to turn off messages.
//
// embed is true if the font is to be embedded in the PDF files.
func MakeFont(fontFileStr, encodingFileStr, dstDirStr string, msgWriter io.Writer, embed bool) error {
	if msgWriter == nil {
		msgWriter = ioutil.Discard
	}
	if !fileExist(fontFileStr) {
		return fmt.Errorf("font file not found: %s", fontFileStr)
	}
	extStr := strings.ToLower(fontFileStr[len(fontFileStr)-3:])
	// printf("Font file extension [%s]\n", extStr)
	var tpStr string
	switch extStr {
	case "ttf":
		fallthrough
	case "otf":
		tpStr = "TrueType"
	case "pfb":
		tpStr = "Type1"
	default:
		return fmt.Errorf("unrecognized font file extension: %s", extStr)
	}

	var info fontInfoType
	encList, err := loadMap(encodingFileStr)
	if err != nil {
		return err
	}
	// printf("Encoding table\n")
	// dump(encList)
	if tpStr == "TrueType" {
		info, err = getInfoFromTrueType(fontFileStr, msgWriter, embed, encList)
		if err != nil {
			return err
		}
	} else {
		info, err = getInfoFromType1(fontFileStr, msgWriter, embed, encList)
		if err != nil {
			return err
		}
	}
	baseStr := baseNoExt(fontFileStr)
	// fmt.Printf("Base [%s]\n", baseStr)
	if embed {
		var f *os.File
		info.File = baseStr + ".z"
		zFileStr := filepath.Join(dstDirStr, info.File)
		f, err = os.Create(zFileStr)
		if err != nil {
			return err
		}
		defer f.Close()
		cmp := zlib.NewWriter(f)
		_, err = cmp.Write(info.Data)
		if err != nil {
			return err
		}
		err = cmp.Close()
		if err != nil {
			return err
		}
		fmt.Fprintf(msgWriter, "Font file compressed: %s\n", zFileStr)
	}
	defFileStr := filepath.Join(dstDirStr, baseStr+".json")
	err = makeDefinitionFile(defFileStr, tpStr, encodingFileStr, embed, encList, info)
	if err != nil {
		return err
	}
	fmt.Fprintf(msgWriter, "Font definition file successfully generated: %s\n", defFileStr)
	return nil
}
