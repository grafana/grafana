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

import (
	"bufio"
	"bytes"
	"compress/zlib"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
)

func round(f float64) int {
	if f < 0 {
		return -int(math.Floor(-f + 0.5))
	}
	return int(math.Floor(f + 0.5))
}

func sprintf(fmtStr string, args ...interface{}) string {
	return fmt.Sprintf(fmtStr, args...)
}

// fileExist returns true if the specified normal file exists
func fileExist(filename string) (ok bool) {
	info, err := os.Stat(filename)
	if err == nil {
		if ^os.ModePerm&info.Mode() == 0 {
			ok = true
		}
	}
	return ok
}

// fileSize returns the size of the specified file; ok will be false
// if the file does not exist or is not an ordinary file
func fileSize(filename string) (size int64, ok bool) {
	info, err := os.Stat(filename)
	ok = err == nil
	if ok {
		size = info.Size()
	}
	return
}

// bufferFromReader returns a new buffer populated with the contents of the specified Reader
func bufferFromReader(r io.Reader) (b *bytes.Buffer, err error) {
	b = new(bytes.Buffer)
	_, err = b.ReadFrom(r)
	return
}

// slicesEqual returns true if the two specified float slices are equal
func slicesEqual(a, b []float64) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// sliceCompress returns a zlib-compressed copy of the specified byte array
func sliceCompress(data []byte) []byte {
	var buf bytes.Buffer
	cmp, _ := zlib.NewWriterLevel(&buf, zlib.BestSpeed)
	cmp.Write(data)
	cmp.Close()
	return buf.Bytes()
}

// sliceUncompress returns an uncompressed copy of the specified zlib-compressed byte array
func sliceUncompress(data []byte) (outData []byte, err error) {
	inBuf := bytes.NewReader(data)
	r, err := zlib.NewReader(inBuf)
	defer r.Close()
	if err == nil {
		var outBuf bytes.Buffer
		_, err = outBuf.ReadFrom(r)
		if err == nil {
			outData = outBuf.Bytes()
		}
	}
	return
}

// utf8toutf16 converts UTF-8 to UTF-16BE; from http://www.fpdf.org/
func utf8toutf16(s string, withBOM ...bool) string {
	bom := true
	if len(withBOM) > 0 {
		bom = withBOM[0]
	}
	res := make([]byte, 0, 8)
	if bom {
		res = append(res, 0xFE, 0xFF)
	}
	nb := len(s)
	i := 0
	for i < nb {
		c1 := byte(s[i])
		i++
		switch {
		case c1 >= 224:
			// 3-byte character
			c2 := byte(s[i])
			i++
			c3 := byte(s[i])
			i++
			res = append(res, ((c1&0x0F)<<4)+((c2&0x3C)>>2),
				((c2&0x03)<<6)+(c3&0x3F))
		case c1 >= 192:
			// 2-byte character
			c2 := byte(s[i])
			i++
			res = append(res, ((c1 & 0x1C) >> 2),
				((c1&0x03)<<6)+(c2&0x3F))
		default:
			// Single-byte character
			res = append(res, 0, c1)
		}
	}
	return string(res)
}

// intIf returns a if cnd is true, otherwise b
func intIf(cnd bool, a, b int) int {
	if cnd {
		return a
	}
	return b
}

// strIf returns aStr if cnd is true, otherwise bStr
func strIf(cnd bool, aStr, bStr string) string {
	if cnd {
		return aStr
	}
	return bStr
}

// doNothing returns the passed string with no translation.
func doNothing(s string) string {
	return s
}

// Dump the internals of the specified values
// func dump(fileStr string, a ...interface{}) {
// 	fl, err := os.OpenFile(fileStr, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
// 	if err == nil {
// 		fmt.Fprintf(fl, "----------------\n")
// 		spew.Fdump(fl, a...)
// 		fl.Close()
// 	}
// }

func repClosure(m map[rune]byte) func(string) string {
	var buf bytes.Buffer
	return func(str string) string {
		var ch byte
		var ok bool
		buf.Truncate(0)
		for _, r := range str {
			if r < 0x80 {
				ch = byte(r)
			} else {
				ch, ok = m[r]
				if !ok {
					ch = byte('.')
				}
			}
			buf.WriteByte(ch)
		}
		return buf.String()
	}
}

// UnicodeTranslator returns a function that can be used to translate, where
// possible, utf-8 strings to a form that is compatible with the specified code
// page. The returned function accepts a string and returns a string.
//
// r is a reader that should read a buffer made up of content lines that
// pertain to the code page of interest. Each line is made up of three
// whitespace separated fields. The first begins with "!" and is followed by
// two hexadecimal digits that identify the glyph position in the code page of
// interest. The second field begins with "U+" and is followed by the unicode
// code point value. The third is the glyph name. A number of these code page
// map files are packaged with the gfpdf library in the font directory.
//
// An error occurs only if a line is read that does not conform to the expected
// format. In this case, the returned function is valid but does not perform
// any rune translation.
func UnicodeTranslator(r io.Reader) (f func(string) string, err error) {
	m := make(map[rune]byte)
	var uPos, cPos uint32
	var lineStr, nameStr string
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		lineStr = sc.Text()
		lineStr = strings.TrimSpace(lineStr)
		if len(lineStr) > 0 {
			_, err = fmt.Sscanf(lineStr, "!%2X U+%4X %s", &cPos, &uPos, &nameStr)
			if err == nil {
				if cPos >= 0x80 {
					m[rune(uPos)] = byte(cPos)
				}
			}
		}
	}
	if err == nil {
		f = repClosure(m)
	} else {
		f = doNothing
	}
	return
}

// UnicodeTranslatorFromFile returns a function that can be used to translate,
// where possible, utf-8 strings to a form that is compatible with the
// specified code page. See UnicodeTranslator for more details.
//
// fileStr identifies a font descriptor file that maps glyph positions to names.
//
// If an error occurs reading the file, the returned function is valid but does
// not perform any rune translation.
func UnicodeTranslatorFromFile(fileStr string) (f func(string) string, err error) {
	var fl *os.File
	fl, err = os.Open(fileStr)
	if err == nil {
		f, err = UnicodeTranslator(fl)
		fl.Close()
	} else {
		f = doNothing
	}
	return
}

// UnicodeTranslatorFromDescriptor returns a function that can be used to
// translate, where possible, utf-8 strings to a form that is compatible with
// the specified code page. See UnicodeTranslator for more details.
//
// cpStr identifies a code page. A descriptor file in the font directory, set
// with the fontDirStr argument in the call to New(), should have this name
// plus the extension ".map". If cpStr is empty, it will be replaced with
// "cp1252", the gofpdf code page default.
//
// If an error occurs reading the descriptor, the returned function is valid
// but does not perform any rune translation.
//
// The CellFormat_codepage example demonstrates this method.
func (f *Fpdf) UnicodeTranslatorFromDescriptor(cpStr string) (rep func(string) string) {
	var str string
	var ok bool
	if f.err == nil {
		if len(cpStr) == 0 {
			cpStr = "cp1252"
		}
		str, ok = embeddedMapList[cpStr]
		if ok {
			rep, f.err = UnicodeTranslator(strings.NewReader(str))
		} else {
			rep, f.err = UnicodeTranslatorFromFile(filepath.Join(f.fontpath, cpStr) + ".map")
		}
	} else {
		rep = doNothing
	}
	return
}

// Transform moves a point by given X, Y offset
func (p *PointType) Transform(x, y float64) PointType {
	return PointType{p.X + x, p.Y + y}
}

// Orientation returns the orientation of a given size:
// "P" for portrait, "L" for landscape
func (s *SizeType) Orientation() string {
	if s == nil || s.Ht == s.Wd {
		return ""
	}
	if s.Wd > s.Ht {
		return "L"
	}
	return "P"
}

// ScaleBy expands a size by a certain factor
func (s *SizeType) ScaleBy(factor float64) SizeType {
	return SizeType{s.Wd * factor, s.Ht * factor}
}

// ScaleToWidth adjusts the height of a size to match the given width
func (s *SizeType) ScaleToWidth(width float64) SizeType {
	height := s.Ht * width / s.Wd
	return SizeType{width, height}
}

// ScaleToHeight adjusts the width of a size to match the given height
func (s *SizeType) ScaleToHeight(height float64) SizeType {
	width := s.Wd * height / s.Ht
	return SizeType{width, height}
}

//The untypedKeyMap structure and its methods are copyrighted 2019 by Arteom Korotkiy (Gmail: arteomkorotkiy).
//Imitation of untyped Map Array
type untypedKeyMap struct {
	keySet   []interface{}
	valueSet []int
}

//Get position of key=>value in PHP Array
func (pa *untypedKeyMap) getIndex(key interface{}) int {
	if key != nil {
		for i, mKey := range pa.keySet {
			if mKey == key {
				return i
			}
		}
		return -1
	}
	return -1
}

//Put key=>value in PHP Array
func (pa *untypedKeyMap) put(key interface{}, value int) {
	if key == nil {
		var i int
		for n := 0; ; n++ {
			i = pa.getIndex(n)
			if i < 0 {
				key = n
				break
			}
		}
		pa.keySet = append(pa.keySet, key)
		pa.valueSet = append(pa.valueSet, value)
	} else {
		i := pa.getIndex(key)
		if i < 0 {
			pa.keySet = append(pa.keySet, key)
			pa.valueSet = append(pa.valueSet, value)
		} else {
			pa.valueSet[i] = value
		}
	}
}

//Delete value in PHP Array
func (pa *untypedKeyMap) delete(key interface{}) {
	if pa == nil || pa.keySet == nil || pa.valueSet == nil {
		return
	}
	i := pa.getIndex(key)
	if i >= 0 {
		if i == 0 {
			pa.keySet = pa.keySet[1:]
			pa.valueSet = pa.valueSet[1:]
		} else if i == len(pa.keySet)-1 {
			pa.keySet = pa.keySet[:len(pa.keySet)-1]
			pa.valueSet = pa.valueSet[:len(pa.valueSet)-1]
		} else {
			pa.keySet = append(pa.keySet[:i], pa.keySet[i+1:]...)
			pa.valueSet = append(pa.valueSet[:i], pa.valueSet[i+1:]...)
		}
	}
}

//Get value from PHP Array
func (pa *untypedKeyMap) get(key interface{}) int {
	i := pa.getIndex(key)
	if i >= 0 {
		return pa.valueSet[i]
	}
	return 0
}

//Imitation of PHP function pop()
func (pa *untypedKeyMap) pop() {
	pa.keySet = pa.keySet[:len(pa.keySet)-1]
	pa.valueSet = pa.valueSet[:len(pa.valueSet)-1]
}

//Imitation of PHP function array_merge()
func arrayMerge(arr1, arr2 *untypedKeyMap) *untypedKeyMap {
	answer := untypedKeyMap{}
	if arr1 == nil && arr2 == nil {
		answer = untypedKeyMap{
			make([]interface{}, 0),
			make([]int, 0),
		}
	} else if arr2 == nil {
		answer.keySet = arr1.keySet[:]
		answer.valueSet = arr1.valueSet[:]
	} else if arr1 == nil {
		answer.keySet = arr2.keySet[:]
		answer.valueSet = arr2.valueSet[:]
	} else {
		answer.keySet = arr1.keySet[:]
		answer.valueSet = arr1.valueSet[:]
		for i := 0; i < len(arr2.keySet); i++ {
			if arr2.keySet[i] == "interval" {
				if arr1.getIndex("interval") < 0 {
					answer.put("interval", arr2.valueSet[i])
				}
			} else {
				answer.put(nil, arr2.valueSet[i])
			}
		}
	}
	return &answer
}

func remove(arr []int, key int) []int {
	n := 0
	for i, mKey := range arr {
		if mKey == key {
			n = i
		}
	}
	if n == 0 {
		return arr[1:]
	} else if n == len(arr)-1 {
		return arr[:len(arr)-1]
	}
	return append(arr[:n], arr[n+1:]...)
}

func isChinese(rune2 rune) bool {
	// chinese unicode: 4e00-9fa5
	if rune2 >= rune(0x4e00) && rune2 <= rune(0x9fa5) {
		return true
	}
	return false
}

// Condition font family string to PDF name compliance. See section 5.3 (Names)
// in https://resources.infosecinstitute.com/pdf-file-format-basic-structure/
func fontFamilyEscape(familyStr string) (escStr string) {
	escStr = strings.Replace(familyStr, " ", "#20", -1)
	// Additional replacements can take place here
	return
}
