// Copyright (c) 2012-2018 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

import (
	"bytes"
	"errors"
	"go/format"
	"io"
	"io/ioutil"
	"strings"
	"sync"
	"text/template"
)

const genVersion = 10

func genInternalEncCommandAsString(s string, vname string) string {
	switch s {
	case "uint", "uint8", "uint16", "uint32", "uint64":
		return "ee.EncodeUint(uint64(" + vname + "))"
	case "int", "int8", "int16", "int32", "int64":
		return "ee.EncodeInt(int64(" + vname + "))"
	case "string":
		return "if e.h.StringToRaw { ee.EncodeStringBytesRaw(bytesView(" + vname + ")) " +
			"} else { ee.EncodeStringEnc(cUTF8, " + vname + ") }"
	case "float32":
		return "ee.EncodeFloat32(" + vname + ")"
	case "float64":
		return "ee.EncodeFloat64(" + vname + ")"
	case "bool":
		return "ee.EncodeBool(" + vname + ")"
	// case "symbol":
	// 	return "ee.EncodeSymbol(" + vname + ")"
	default:
		return "e.encode(" + vname + ")"
	}
}

func genInternalDecCommandAsString(s string) string {
	switch s {
	case "uint":
		return "uint(chkOvf.UintV(dd.DecodeUint64(), uintBitsize))"
	case "uint8":
		return "uint8(chkOvf.UintV(dd.DecodeUint64(), 8))"
	case "uint16":
		return "uint16(chkOvf.UintV(dd.DecodeUint64(), 16))"
	case "uint32":
		return "uint32(chkOvf.UintV(dd.DecodeUint64(), 32))"
	case "uint64":
		return "dd.DecodeUint64()"
	case "uintptr":
		return "uintptr(chkOvf.UintV(dd.DecodeUint64(), uintBitsize))"
	case "int":
		return "int(chkOvf.IntV(dd.DecodeInt64(), intBitsize))"
	case "int8":
		return "int8(chkOvf.IntV(dd.DecodeInt64(), 8))"
	case "int16":
		return "int16(chkOvf.IntV(dd.DecodeInt64(), 16))"
	case "int32":
		return "int32(chkOvf.IntV(dd.DecodeInt64(), 32))"
	case "int64":
		return "dd.DecodeInt64()"

	case "string":
		return "dd.DecodeString()"
	case "float32":
		return "float32(chkOvf.Float32V(dd.DecodeFloat64()))"
	case "float64":
		return "dd.DecodeFloat64()"
	case "bool":
		return "dd.DecodeBool()"
	default:
		panic(errors.New("gen internal: unknown type for decode: " + s))
	}
}

func genInternalZeroValue(s string) string {
	switch s {
	case "interface{}", "interface {}":
		return "nil"
	case "bool":
		return "false"
	case "string":
		return `""`
	default:
		return "0"
	}
}

var genInternalNonZeroValueIdx [5]uint64
var genInternalNonZeroValueStrs = [2][5]string{
	{`"string-is-an-interface"`, "true", `"some-string"`, "11.1", "33"},
	{`"string-is-an-interface-2"`, "true", `"some-string-2"`, "22.2", "44"},
}

func genInternalNonZeroValue(s string) string {
	switch s {
	case "interface{}", "interface {}":
		genInternalNonZeroValueIdx[0]++
		return genInternalNonZeroValueStrs[genInternalNonZeroValueIdx[0]%2][0] // return string, to remove ambiguity
	case "bool":
		genInternalNonZeroValueIdx[1]++
		return genInternalNonZeroValueStrs[genInternalNonZeroValueIdx[1]%2][1]
	case "string":
		genInternalNonZeroValueIdx[2]++
		return genInternalNonZeroValueStrs[genInternalNonZeroValueIdx[2]%2][2]
	case "float32", "float64", "float", "double":
		genInternalNonZeroValueIdx[3]++
		return genInternalNonZeroValueStrs[genInternalNonZeroValueIdx[3]%2][3]
	default:
		genInternalNonZeroValueIdx[4]++
		return genInternalNonZeroValueStrs[genInternalNonZeroValueIdx[4]%2][4]
	}
}

func genInternalSortType(s string, elem bool) string {
	for _, v := range [...]string{"int", "uint", "float", "bool", "string"} {
		if strings.HasPrefix(s, v) {
			if elem {
				if v == "int" || v == "uint" || v == "float" {
					return v + "64"
				} else {
					return v
				}
			}
			return v + "Slice"
		}
	}
	panic("sorttype: unexpected type: " + s)
}

type genV struct {
	// genV is either a primitive (Primitive != "") or a map (MapKey != "") or a slice
	MapKey    string
	Elem      string
	Primitive string
	Size      int
}

type genInternal struct {
	Version int
	Values  []genV
}

func (x genInternal) FastpathLen() (l int) {
	for _, v := range x.Values {
		if v.Primitive == "" && !(v.MapKey == "" && v.Elem == "uint8") {
			l++
		}
	}
	return
}

// var genInternalMu sync.Mutex
var genInternalV = genInternal{Version: genVersion}
var genInternalTmplFuncs template.FuncMap
var genInternalOnce sync.Once

func genInternalInit() {
	types := [...]string{
		"interface{}",
		"string",
		"float32",
		"float64",
		"uint",
		"uint8",
		"uint16",
		"uint32",
		"uint64",
		"uintptr",
		"int",
		"int8",
		"int16",
		"int32",
		"int64",
		"bool",
	}
	// keep as slice, so it is in specific iteration order.
	// Initial order was uint64, string, interface{}, int, int64
	mapvaltypes := [...]string{
		"interface{}",
		"string",
		"uint",
		"uint8",
		"uint16",
		"uint32",
		"uint64",
		"uintptr",
		"int",
		"int8",
		"int16",
		"int32",
		"int64",
		"float32",
		"float64",
		"bool",
	}
	wordSizeBytes := int(intBitsize) / 8

	mapvaltypes2 := map[string]int{
		"interface{}": 2 * wordSizeBytes,
		"string":      2 * wordSizeBytes,
		"uint":        1 * wordSizeBytes,
		"uint8":       1,
		"uint16":      2,
		"uint32":      4,
		"uint64":      8,
		"uintptr":     1 * wordSizeBytes,
		"int":         1 * wordSizeBytes,
		"int8":        1,
		"int16":       2,
		"int32":       4,
		"int64":       8,
		"float32":     4,
		"float64":     8,
		"bool":        1,
	}
	var gt = genInternal{Version: genVersion}

	// For each slice or map type, there must be a (symmetrical) Encode and Decode fast-path function
	for _, s := range types {
		gt.Values = append(gt.Values, genV{Primitive: s, Size: mapvaltypes2[s]})
		// if s != "uint8" { // do not generate fast path for slice of bytes. Treat specially already.
		// 	gt.Values = append(gt.Values, genV{Elem: s, Size: mapvaltypes2[s]})
		// }
		gt.Values = append(gt.Values, genV{Elem: s, Size: mapvaltypes2[s]})
		if _, ok := mapvaltypes2[s]; !ok {
			gt.Values = append(gt.Values, genV{MapKey: s, Elem: s, Size: 2 * mapvaltypes2[s]})
		}
		for _, ms := range mapvaltypes {
			gt.Values = append(gt.Values, genV{MapKey: s, Elem: ms, Size: mapvaltypes2[s] + mapvaltypes2[ms]})
		}
	}

	funcs := make(template.FuncMap)
	// funcs["haspfx"] = strings.HasPrefix
	funcs["encmd"] = genInternalEncCommandAsString
	funcs["decmd"] = genInternalDecCommandAsString
	funcs["zerocmd"] = genInternalZeroValue
	funcs["nonzerocmd"] = genInternalNonZeroValue
	funcs["hasprefix"] = strings.HasPrefix
	funcs["sorttype"] = genInternalSortType

	genInternalV = gt
	genInternalTmplFuncs = funcs
}

// genInternalGoFile is used to generate source files from templates.
// It is run by the program author alone.
// Unfortunately, it has to be exported so that it can be called from a command line tool.
// *** DO NOT USE ***
func genInternalGoFile(r io.Reader, w io.Writer) (err error) {
	genInternalOnce.Do(genInternalInit)

	gt := genInternalV

	t := template.New("").Funcs(genInternalTmplFuncs)

	tmplstr, err := ioutil.ReadAll(r)
	if err != nil {
		return
	}

	if t, err = t.Parse(string(tmplstr)); err != nil {
		return
	}

	var out bytes.Buffer
	err = t.Execute(&out, gt)
	if err != nil {
		return
	}

	bout, err := format.Source(out.Bytes())
	if err != nil {
		w.Write(out.Bytes()) // write out if error, so we can still see.
		// w.Write(bout) // write out if error, as much as possible, so we can still see.
		return
	}
	w.Write(bout)
	return
}
