//go:build codecgen.exec
// +build codecgen.exec

// Copyright (c) 2012-2018 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

import (
	"encoding/base32"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"text/template"
	"time"
	"unicode"
	"unicode/utf8"
)

// ---------------------------------------------------
// codecgen supports the full cycle of reflection-based codec:
//   - RawExt
//   - Raw
//   - Extensions
//   - (Binary|Text|JSON)(Unm|M)arshal
//   - generic by-kind
//
// This means that, for dynamic things, we MUST use reflection to at least get the reflect.Type.
// In those areas, we try to only do reflection or interface-conversion when NECESSARY:
//   - Extensions, only if Extensions are configured.
//
// However, codecgen doesn't support the following:
//   - Canonical option. (codecgen IGNORES it currently)
//     This is just because it has not been implemented.
//   - MissingFielder implementation.
//     If a type implements MissingFielder, it is completely ignored by codecgen.
//
// During encode/decode, Selfer takes precedence.
// A type implementing Selfer will know how to encode/decode itself statically.
//
// The following field types are supported:
//
//	array: [n]T
//	slice: []T
//	map: map[K]V
//	primitive: [u]int[n], float(32|64), bool, string
//	struct
//
// ---------------------------------------------------
// Note that a Selfer cannot call (e|d).(En|De)code on itself,
// as this will cause a circular reference, as (En|De)code will call Selfer methods.
// Any type that implements Selfer must implement completely and not fallback to (En|De)code.
//
// In addition, code in this file manages the generation of fast-path implementations of
// encode/decode of slices/maps of primitive keys/values.
//
// Users MUST re-generate their implementations whenever the code shape changes.
// The generated code will panic if it was generated with a version older than the supporting library.
// ---------------------------------------------------
//
// codec framework is very feature rich.
// When encoding or decoding into an interface, it depends on the runtime type of the interface.
// The type of the interface may be a named type, an extension, etc.
// Consequently, we fallback to runtime codec for encoding/decoding interfaces.
// In addition, we fallback for any value which cannot be guaranteed at runtime.
// This allows us support ANY value, including any named types, specifically those which
// do not implement our interfaces (e.g. Selfer).
//
// This explains some slowness compared to other code generation codecs (e.g. msgp).
// This reduction in speed is only seen when your refers to interfaces,
// e.g. type T struct { A interface{}; B []interface{}; C map[string]interface{} }
//
// codecgen will panic if the file was generated with an old version of the library in use.
//
// Note:
//
//	It was a conscious decision to have gen.go always explicitly call EncodeNil or TryDecodeAsNil.
//	This way, there isn't a function call overhead just to see that we should not enter a block of code.
//
// GenVersion is the current version of codecgen.
//
// NOTE: Increment this value each time codecgen changes fundamentally.
// Fundamental changes are:
//   - helper methods change (signature change, new ones added, some removed, etc)
//   - codecgen command line changes
//
// v1: Initial Version
// v2:
// v3: Changes for Kubernetes:
//
//	changes in signature of some unpublished helper methods and codecgen cmdline arguments.
//
// v4: Removed separator support from (en|de)cDriver, and refactored codec(gen)
// v5: changes to support faster json decoding. Let encoder/decoder maintain state of collections.
// v6: removed unsafe from gen, and now uses codecgen.exec tag
// v7:
// v8: current - we now maintain compatibility with old generated code.
// v9: skipped
// v10: modified encDriver and decDriver interfaces. Remove deprecated methods after Jan 1, 2019
const (
	genCodecPkg        = "codec1978"
	genTempVarPfx      = "yy"
	genTopLevelVarName = "x"

	// ignore canBeNil parameter, and always set to true.
	// This is because nil can appear anywhere, so we should always check.
	genAnythingCanBeNil = true

	// if genUseOneFunctionForDecStructMap, make a single codecDecodeSelferFromMap function;
	// else make codecDecodeSelferFromMap{LenPrefix,CheckBreak} so that conditionals
	// are not executed a lot.
	//
	// From testing, it didn't make much difference in runtime, so keep as true (one function only)
	genUseOneFunctionForDecStructMap = true
)

type genStructMapStyle uint8

const (
	genStructMapStyleConsolidated genStructMapStyle = iota
	genStructMapStyleLenPrefix
	genStructMapStyleCheckBreak
)

var (
	errGenAllTypesSamePkg  = errors.New("All types must be in the same package")
	errGenExpectArrayOrMap = errors.New("unexpected type. Expecting array/map/slice")

	// base64 requires 64 unique characters in Go 1.22+, which is not possible for Go identifiers.
	genBase32enc  = base32.NewEncoding("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
	genQNameRegex = regexp.MustCompile(`[A-Za-z_.]+`)
)

type genBuf struct {
	buf []byte
}

func (x *genBuf) s(s string) *genBuf              { x.buf = append(x.buf, s...); return x }
func (x *genBuf) b(s []byte) *genBuf              { x.buf = append(x.buf, s...); return x }
func (x *genBuf) v() string                       { return string(x.buf) }
func (x *genBuf) f(s string, args ...interface{}) { x.s(fmt.Sprintf(s, args...)) }
func (x *genBuf) reset() {
	if x.buf != nil {
		x.buf = x.buf[:0]
	}
}

// genRunner holds some state used during a Gen run.
type genRunner struct {
	w io.Writer      // output
	c uint64         // counter used for generating varsfx
	t []reflect.Type // list of types to run selfer on

	tc reflect.Type     // currently running selfer on this type
	te map[uintptr]bool // types for which the encoder has been created
	td map[uintptr]bool // types for which the decoder has been created
	cp string           // codec import path

	im  map[string]reflect.Type // imports to add
	imn map[string]string       // package names of imports to add
	imc uint64                  // counter for import numbers

	is map[reflect.Type]struct{} // types seen during import search
	bp string                    // base PkgPath, for which we are generating for

	cpfx string // codec package prefix

	tm map[reflect.Type]struct{} // types for which enc/dec must be generated
	ts []reflect.Type            // types for which enc/dec must be generated

	xs string // top level variable/constant suffix
	hn string // fn helper type name

	ti *TypeInfos
	// rr *rand.Rand // random generator for file-specific types

	nx bool // no extensions
}

// Gen will write a complete go file containing Selfer implementations for each
// type passed. All the types must be in the same package.
//
// Library users: DO NOT USE IT DIRECTLY. IT WILL CHANGE CONTINUOUSLY WITHOUT NOTICE.
func Gen(w io.Writer, buildTags, pkgName, uid string, noExtensions bool,
	ti *TypeInfos, typ ...reflect.Type) {
	// All types passed to this method do not have a codec.Selfer method implemented directly.
	// codecgen already checks the AST and skips any types that define the codec.Selfer methods.
	// Consequently, there's no need to check and trim them if they implement codec.Selfer

	if len(typ) == 0 {
		return
	}
	x := genRunner{
		w:   w,
		t:   typ,
		te:  make(map[uintptr]bool),
		td:  make(map[uintptr]bool),
		im:  make(map[string]reflect.Type),
		imn: make(map[string]string),
		is:  make(map[reflect.Type]struct{}),
		tm:  make(map[reflect.Type]struct{}),
		ts:  []reflect.Type{},
		bp:  genImportPath(typ[0]),
		xs:  uid,
		ti:  ti,
		nx:  noExtensions,
	}
	if x.ti == nil {
		x.ti = defTypeInfos
	}
	if x.xs == "" {
		rr := rand.New(rand.NewSource(time.Now().UnixNano()))
		x.xs = strconv.FormatInt(rr.Int63n(9999), 10)
	}

	// gather imports first:
	x.cp = genImportPath(reflect.TypeOf(x))
	x.imn[x.cp] = genCodecPkg
	for _, t := range typ {
		// fmt.Printf("###########: PkgPath: '%v', Name: '%s'\n", genImportPath(t), t.Name())
		if genImportPath(t) != x.bp {
			panic(errGenAllTypesSamePkg)
		}
		x.genRefPkgs(t)
	}
	if buildTags != "" {
		x.line("// +build " + buildTags)
		x.line("")
	}
	x.line(`

// Code generated by codecgen - DO NOT EDIT.

`)
	x.line("package " + pkgName)
	x.line("")
	x.line("import (")
	if x.cp != x.bp {
		x.cpfx = genCodecPkg + "."
		x.linef("%s \"%s\"", genCodecPkg, x.cp)
	}
	// use a sorted set of im keys, so that we can get consistent output
	imKeys := make([]string, 0, len(x.im))
	for k := range x.im {
		imKeys = append(imKeys, k)
	}
	sort.Strings(imKeys)
	for _, k := range imKeys { // for k, _ := range x.im {
		if k == x.imn[k] {
			x.linef("\"%s\"", k)
		} else {
			x.linef("%s \"%s\"", x.imn[k], k)
		}
	}
	// add required packages
	for _, k := range [...]string{"runtime", "errors", "strconv"} { // "reflect", "fmt"
		if _, ok := x.im[k]; !ok {
			x.line("\"" + k + "\"")
		}
	}
	x.line(")")
	x.line("")

	x.line("const (")
	x.linef("// ----- content types ----")
	x.linef("codecSelferCcUTF8%s = %v", x.xs, int64(cUTF8))
	x.linef("codecSelferCcRAW%s = %v", x.xs, int64(cRAW))
	x.linef("// ----- value types used ----")
	for _, vt := range [...]valueType{
		valueTypeArray, valueTypeMap, valueTypeString,
		valueTypeInt, valueTypeUint, valueTypeFloat} {
		x.linef("codecSelferValueType%s%s = %v", vt.String(), x.xs, int64(vt))
	}

	x.linef("codecSelferBitsize%s = uint8(32 << (^uint(0) >> 63))", x.xs)
	x.line(")")
	x.line("var (")
	x.line("errCodecSelferOnlyMapOrArrayEncodeToStruct" + x.xs + " = errors.New(`only encoded map or array can be decoded into a struct`)")
	x.line(")")
	x.line("")

	x.hn = "codecSelfer" + x.xs
	x.line("type " + x.hn + " struct{}")
	x.line("")

	x.varsfxreset()
	x.line("func init() {")
	x.linef("if %sGenVersion != %v {", x.cpfx, genVersion)
	x.line("_, file, _, _ := runtime.Caller(0)")
	x.outf(`panic("codecgen version mismatch: current: %v, need " + strconv.FormatInt(int64(%sGenVersion), 10) + ". Re-generate file: " + file)`, genVersion, x.cpfx)
	// x.out(`panic(fmt.Errorf("codecgen version mismatch: current: %v, need %v. Re-generate file: %v", `)
	// x.linef(`%v, %sGenVersion, file))`, genVersion, x.cpfx)
	x.linef("}")
	x.line("if false { var _ byte = 0; // reference the types, but skip this branch at build/run time")
	// x.line("_ = strconv.ParseInt")
	var n int
	// for k, t := range x.im {
	for _, k := range imKeys {
		t := x.im[k]
		x.linef("var v%v %s.%s", n, x.imn[k], t.Name())
		n++
	}
	if n > 0 {
		x.out("_")
		for i := 1; i < n; i++ {
			x.out(", _")
		}
		x.out(" = v0")
		for i := 1; i < n; i++ {
			x.outf(", v%v", i)
		}
	}
	x.line("} ") // close if false
	x.line("}")  // close init
	x.line("")

	// generate rest of type info
	for _, t := range typ {
		x.tc = t
		x.selfer(true)
		x.selfer(false)
	}

	for _, t := range x.ts {
		rtid := rt2id(t)
		// generate enc functions for all these slice/map types.
		x.varsfxreset()
		x.linef("func (x %s) enc%s(v %s%s, e *%sEncoder) {", x.hn, x.genMethodNameT(t), x.arr2str(t, "*"), x.genTypeName(t), x.cpfx)
		x.genRequiredMethodVars(true)
		switch t.Kind() {
		case reflect.Array, reflect.Slice, reflect.Chan:
			x.encListFallback("v", t)
		case reflect.Map:
			x.encMapFallback("v", t)
		default:
			panic(errGenExpectArrayOrMap)
		}
		x.line("}")
		x.line("")

		// generate dec functions for all these slice/map types.
		x.varsfxreset()
		x.linef("func (x %s) dec%s(v *%s, d *%sDecoder) {", x.hn, x.genMethodNameT(t), x.genTypeName(t), x.cpfx)
		x.genRequiredMethodVars(false)
		switch t.Kind() {
		case reflect.Array, reflect.Slice, reflect.Chan:
			x.decListFallback("v", rtid, t)
		case reflect.Map:
			x.decMapFallback("v", rtid, t)
		default:
			panic(errGenExpectArrayOrMap)
		}
		x.line("}")
		x.line("")
	}

	x.line("")
}

func (x *genRunner) checkForSelfer(t reflect.Type, varname string) bool {
	// return varname != genTopLevelVarName && t != x.tc
	// the only time we checkForSelfer is if we are not at the TOP of the generated code.
	return varname != genTopLevelVarName
}

func (x *genRunner) arr2str(t reflect.Type, s string) string {
	if t.Kind() == reflect.Array {
		return s
	}
	return ""
}

func (x *genRunner) genRequiredMethodVars(encode bool) {
	x.line("var h " + x.hn)
	if encode {
		x.line("z, r := " + x.cpfx + "GenHelperEncoder(e)")
	} else {
		x.line("z, r := " + x.cpfx + "GenHelperDecoder(d)")
	}
	x.line("_, _, _ = h, z, r")
}

func (x *genRunner) genRefPkgs(t reflect.Type) {
	if _, ok := x.is[t]; ok {
		return
	}
	x.is[t] = struct{}{}
	tpkg, tname := genImportPath(t), t.Name()
	if tpkg != "" && tpkg != x.bp && tpkg != x.cp && tname != "" && tname[0] >= 'A' && tname[0] <= 'Z' {
		if _, ok := x.im[tpkg]; !ok {
			x.im[tpkg] = t
			if idx := strings.LastIndex(tpkg, "/"); idx < 0 {
				x.imn[tpkg] = tpkg
			} else {
				x.imc++
				x.imn[tpkg] = "pkg" + strconv.FormatUint(x.imc, 10) + "_" + genGoIdentifier(tpkg[idx+1:], false)
			}
		}
	}
	switch t.Kind() {
	case reflect.Array, reflect.Slice, reflect.Ptr, reflect.Chan:
		x.genRefPkgs(t.Elem())
	case reflect.Map:
		x.genRefPkgs(t.Elem())
		x.genRefPkgs(t.Key())
	case reflect.Struct:
		for i := 0; i < t.NumField(); i++ {
			if fname := t.Field(i).Name; fname != "" && fname[0] >= 'A' && fname[0] <= 'Z' {
				x.genRefPkgs(t.Field(i).Type)
			}
		}
	}
}

func (x *genRunner) varsfx() string {
	x.c++
	return strconv.FormatUint(x.c, 10)
}

func (x *genRunner) varsfxreset() {
	x.c = 0
}

func (x *genRunner) out(s string) {
	_, err := io.WriteString(x.w, s)
	if err != nil {
		panic(err)
	}
}

func (x *genRunner) outf(s string, params ...interface{}) {
	_, err := fmt.Fprintf(x.w, s, params...)
	if err != nil {
		panic(err)
	}
}

func (x *genRunner) line(s string) {
	x.out(s)
	if len(s) == 0 || s[len(s)-1] != '\n' {
		x.out("\n")
	}
}

func (x *genRunner) linef(s string, params ...interface{}) {
	x.outf(s, params...)
	if len(s) == 0 || s[len(s)-1] != '\n' {
		x.out("\n")
	}
}

func (x *genRunner) genTypeName(t reflect.Type) (n string) {
	// defer func() { fmt.Printf(">>>> ####: genTypeName: t: %v, name: '%s'\n", t, n) }()

	// if the type has a PkgPath, which doesn't match the current package,
	// then include it.
	// We cannot depend on t.String() because it includes current package,
	// or t.PkgPath because it includes full import path,
	//
	var ptrPfx string
	for t.Kind() == reflect.Ptr {
		ptrPfx += "*"
		t = t.Elem()
	}
	if tn := t.Name(); tn != "" {
		return ptrPfx + x.genTypeNamePrim(t)
	}
	switch t.Kind() {
	case reflect.Map:
		return ptrPfx + "map[" + x.genTypeName(t.Key()) + "]" + x.genTypeName(t.Elem())
	case reflect.Slice:
		return ptrPfx + "[]" + x.genTypeName(t.Elem())
	case reflect.Array:
		return ptrPfx + "[" + strconv.FormatInt(int64(t.Len()), 10) + "]" + x.genTypeName(t.Elem())
	case reflect.Chan:
		return ptrPfx + t.ChanDir().String() + " " + x.genTypeName(t.Elem())
	default:
		if t == intfTyp {
			return ptrPfx + "interface{}"
		} else {
			return ptrPfx + x.genTypeNamePrim(t)
		}
	}
}

func (x *genRunner) genTypeNamePrim(t reflect.Type) (n string) {
	if t.Name() == "" {
		return t.String()
	} else if genImportPath(t) == "" || genImportPath(t) == genImportPath(x.tc) {
		return t.Name()
	} else {
		return x.imn[genImportPath(t)] + "." + t.Name()
		// return t.String() // best way to get the package name inclusive
	}
}

func (x *genRunner) genZeroValueR(t reflect.Type) string {
	// if t is a named type, w
	switch t.Kind() {
	case reflect.Ptr, reflect.Interface, reflect.Chan, reflect.Func,
		reflect.Slice, reflect.Map, reflect.Invalid:
		return "nil"
	case reflect.Bool:
		return "false"
	case reflect.String:
		return `""`
	case reflect.Struct, reflect.Array:
		return x.genTypeName(t) + "{}"
	default: // all numbers
		return "0"
	}
}

func (x *genRunner) genMethodNameT(t reflect.Type) (s string) {
	return genMethodNameT(t, x.tc)
}

func (x *genRunner) selfer(encode bool) {
	t := x.tc
	t0 := t
	// always make decode use a pointer receiver,
	// and structs/arrays always use a ptr receiver (encode|decode)
	isptr := !encode || t.Kind() == reflect.Array || (t.Kind() == reflect.Struct && t != timeTyp)
	x.varsfxreset()

	fnSigPfx := "func (" + genTopLevelVarName + " "
	if isptr {
		fnSigPfx += "*"
	}
	fnSigPfx += x.genTypeName(t)
	x.out(fnSigPfx)

	if isptr {
		t = reflect.PtrTo(t)
	}
	if encode {
		x.line(") CodecEncodeSelf(e *" + x.cpfx + "Encoder) {")
		x.genRequiredMethodVars(true)
		x.encVar(genTopLevelVarName, t)
	} else {
		x.line(") CodecDecodeSelf(d *" + x.cpfx + "Decoder) {")
		x.genRequiredMethodVars(false)
		// do not use decVar, as there is no need to check TryDecodeAsNil
		// or way to elegantly handle that, and also setting it to a
		// non-nil value doesn't affect the pointer passed.
		// x.decVar(genTopLevelVarName, t, false)
		x.dec(genTopLevelVarName, t0, true)
	}
	x.line("}")
	x.line("")

	if encode || t0.Kind() != reflect.Struct {
		return
	}

	// write is containerMap
	if genUseOneFunctionForDecStructMap {
		x.out(fnSigPfx)
		x.line(") codecDecodeSelfFromMap(l int, d *" + x.cpfx + "Decoder) {")
		x.genRequiredMethodVars(false)
		x.decStructMap(genTopLevelVarName, "l", rt2id(t0), t0, genStructMapStyleConsolidated)
		x.line("}")
		x.line("")
	} else {
		x.out(fnSigPfx)
		x.line(") codecDecodeSelfFromMapLenPrefix(l int, d *" + x.cpfx + "Decoder) {")
		x.genRequiredMethodVars(false)
		x.decStructMap(genTopLevelVarName, "l", rt2id(t0), t0, genStructMapStyleLenPrefix)
		x.line("}")
		x.line("")

		x.out(fnSigPfx)
		x.line(") codecDecodeSelfFromMapCheckBreak(l int, d *" + x.cpfx + "Decoder) {")
		x.genRequiredMethodVars(false)
		x.decStructMap(genTopLevelVarName, "l", rt2id(t0), t0, genStructMapStyleCheckBreak)
		x.line("}")
		x.line("")
	}

	// write containerArray
	x.out(fnSigPfx)
	x.line(") codecDecodeSelfFromArray(l int, d *" + x.cpfx + "Decoder) {")
	x.genRequiredMethodVars(false)
	x.decStructArray(genTopLevelVarName, "l", "return", rt2id(t0), t0)
	x.line("}")
	x.line("")

}

// used for chan, array, slice, map
func (x *genRunner) xtraSM(varname string, t reflect.Type, encode, isptr bool) {
	var ptrPfx, addrPfx string
	if isptr {
		ptrPfx = "*"
	} else {
		addrPfx = "&"
	}
	if encode {
		x.linef("h.enc%s((%s%s)(%s), e)", x.genMethodNameT(t), ptrPfx, x.genTypeName(t), varname)
	} else {
		x.linef("h.dec%s((*%s)(%s%s), d)", x.genMethodNameT(t), x.genTypeName(t), addrPfx, varname)
	}
	x.registerXtraT(t)
}

func (x *genRunner) registerXtraT(t reflect.Type) {
	// recursively register the types
	if _, ok := x.tm[t]; ok {
		return
	}
	var tkey reflect.Type
	switch t.Kind() {
	case reflect.Chan, reflect.Slice, reflect.Array:
	case reflect.Map:
		tkey = t.Key()
	default:
		return
	}
	x.tm[t] = struct{}{}
	x.ts = append(x.ts, t)
	// check if this refers to any xtra types eg. a slice of array: add the array
	x.registerXtraT(t.Elem())
	if tkey != nil {
		x.registerXtraT(tkey)
	}
}

// encVar will encode a variable.
// The parameter, t, is the reflect.Type of the variable itself
func (x *genRunner) encVar(varname string, t reflect.Type) {
	// fmt.Printf(">>>>>> varname: %s, t: %v\n", varname, t)
	var checkNil bool
	switch t.Kind() {
	case reflect.Ptr, reflect.Interface, reflect.Slice, reflect.Map, reflect.Chan:
		checkNil = true
	}
	if checkNil {
		x.linef("if %s == nil { r.EncodeNil() } else { ", varname)
	}

	switch t.Kind() {
	case reflect.Ptr:
		telem := t.Elem()
		tek := telem.Kind()
		if tek == reflect.Array || (tek == reflect.Struct && telem != timeTyp) {
			x.enc(varname, genNonPtr(t))
			break
		}
		i := x.varsfx()
		x.line(genTempVarPfx + i + " := *" + varname)
		x.enc(genTempVarPfx+i, genNonPtr(t))
	case reflect.Struct, reflect.Array:
		if t == timeTyp {
			x.enc(varname, t)
			break
		}
		i := x.varsfx()
		x.line(genTempVarPfx + i + " := &" + varname)
		x.enc(genTempVarPfx+i, t)
	default:
		x.enc(varname, t)
	}

	if checkNil {
		x.line("}")
	}

}

// enc will encode a variable (varname) of type t, where t represents T.
// if t is !time.Time and t is of kind reflect.Struct or reflect.Array, varname is of type *T
// (to prevent copying),
// else t is of type T
func (x *genRunner) enc(varname string, t reflect.Type) {
	rtid := rt2id(t)
	ti2 := x.ti.get(rtid, t)
	// We call CodecEncodeSelf if one of the following are honored:
	//   - the type already implements Selfer, call that
	//   - the type has a Selfer implementation just created, use that
	//   - the type is in the list of the ones we will generate for, but it is not currently being generated

	mi := x.varsfx()
	// tptr := reflect.PtrTo(t)
	tk := t.Kind()
	if x.checkForSelfer(t, varname) {
		if tk == reflect.Array || (tk == reflect.Struct && rtid != timeTypId) { // varname is of type *T
			// if tptr.Implements(selferTyp) || t.Implements(selferTyp) {
			if ti2.isFlag(typeInfoFlagIsZeroerPtr) || ti2.isFlag(typeInfoFlagIsZeroer) {
				x.line(varname + ".CodecEncodeSelf(e)")
				return
			}
		} else { // varname is of type T
			if ti2.cs { // t.Implements(selferTyp) {
				x.line(varname + ".CodecEncodeSelf(e)")
				return
			} else if ti2.csp { // tptr.Implements(selferTyp) {
				x.linef("%ssf%s := &%s", genTempVarPfx, mi, varname)
				x.linef("%ssf%s.CodecEncodeSelf(e)", genTempVarPfx, mi)
				return
			}
		}

		if _, ok := x.te[rtid]; ok {
			x.line(varname + ".CodecEncodeSelf(e)")
			return
		}
	}

	inlist := false
	for _, t0 := range x.t {
		if t == t0 {
			inlist = true
			if x.checkForSelfer(t, varname) {
				x.line(varname + ".CodecEncodeSelf(e)")
				return
			}
			break
		}
	}

	var rtidAdded bool
	if t == x.tc {
		x.te[rtid] = true
		rtidAdded = true
	}

	// check if
	//   - type is time.Time, RawExt, Raw
	//   - the type implements (Text|JSON|Binary)(Unm|M)arshal

	x.line("if false {")           //start if block
	defer func() { x.line("}") }() //end if block

	if t == timeTyp {
		x.linef("} else if !z.EncBasicHandle().TimeNotBuiltin { r.EncodeTime(%s)", varname)
		// return
	}
	if t == rawTyp {
		x.linef("} else { z.EncRaw(%s)", varname)
		return
	}
	if t == rawExtTyp {
		x.linef("} else { r.EncodeRawExt(%s, e)", varname)
		return
	}
	// only check for extensions if the type is named, and has a packagePath.
	var arrayOrStruct = tk == reflect.Array || tk == reflect.Struct // meaning varname if of type *T
	if !x.nx && genImportPath(t) != "" && t.Name() != "" {
		yy := fmt.Sprintf("%sxt%s", genTempVarPfx, mi)
		x.linef("} else if %s := z.Extension(z.I2Rtid(%s)); %s != nil { z.EncExtension(%s, %s) ", yy, varname, yy, varname, yy)
	}
	if arrayOrStruct { // varname is of type *T
		if ti2.bm || ti2.bmp { // t.Implements(binaryMarshalerTyp) || tptr.Implements(binaryMarshalerTyp) {
			x.linef("} else if z.EncBinary() { z.EncBinaryMarshal(%v) ", varname)
		}
		if ti2.jm || ti2.jmp { // t.Implements(jsonMarshalerTyp) || tptr.Implements(jsonMarshalerTyp) {
			x.linef("} else if !z.EncBinary() && z.IsJSONHandle() { z.EncJSONMarshal(%v) ", varname)
		} else if ti2.tm || ti2.tmp { // t.Implements(textMarshalerTyp) || tptr.Implements(textMarshalerTyp) {
			x.linef("} else if !z.EncBinary() { z.EncTextMarshal(%v) ", varname)
		}
	} else { // varname is of type T
		if ti2.bm { // t.Implements(binaryMarshalerTyp) {
			x.linef("} else if z.EncBinary() { z.EncBinaryMarshal(%v) ", varname)
		} else if ti2.bmp { // tptr.Implements(binaryMarshalerTyp) {
			x.linef("} else if z.EncBinary() { z.EncBinaryMarshal(&%v) ", varname)
		}
		if ti2.jm { // t.Implements(jsonMarshalerTyp) {
			x.linef("} else if !z.EncBinary() && z.IsJSONHandle() { z.EncJSONMarshal(%v) ", varname)
		} else if ti2.jmp { // tptr.Implements(jsonMarshalerTyp) {
			x.linef("} else if !z.EncBinary() && z.IsJSONHandle() { z.EncJSONMarshal(&%v) ", varname)
		} else if ti2.tm { // t.Implements(textMarshalerTyp) {
			x.linef("} else if !z.EncBinary() { z.EncTextMarshal(%v) ", varname)
		} else if ti2.tmp { // tptr.Implements(textMarshalerTyp) {
			x.linef("} else if !z.EncBinary() { z.EncTextMarshal(&%v) ", varname)
		}
	}
	x.line("} else {")

	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		x.line("r.EncodeInt(int64(" + varname + "))")
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		x.line("r.EncodeUint(uint64(" + varname + "))")
	case reflect.Float32:
		x.line("r.EncodeFloat32(float32(" + varname + "))")
	case reflect.Float64:
		x.line("r.EncodeFloat64(float64(" + varname + "))")
	case reflect.Bool:
		x.line("r.EncodeBool(bool(" + varname + "))")
	case reflect.String:
		x.linef("if z.EncBasicHandle().StringToRaw { r.EncodeStringBytesRaw(z.BytesView(string(%s))) } else { r.EncodeStringEnc(codecSelferCcUTF8%s, string(%s)) }", varname, x.xs, varname)
	case reflect.Chan:
		x.xtraSM(varname, t, true, false)
		// x.encListFallback(varname, rtid, t)
	case reflect.Array:
		x.xtraSM(varname, t, true, true)
	case reflect.Slice:
		// if nil, call dedicated function
		// if a []uint8, call dedicated function
		// if a known fastpath slice, call dedicated function
		// else write encode function in-line.
		// - if elements are primitives or Selfers, call dedicated function on each member.
		// - else call Encoder.encode(XXX) on it.
		if rtid == uint8SliceTypId {
			x.line("r.EncodeStringBytesRaw([]byte(" + varname + "))")
		} else if fastpathAV.index(rtid) != -1 {
			g := x.newGenV(t)
			x.line("z.F." + g.MethodNamePfx("Enc", false) + "V(" + varname + ", e)")
		} else {
			x.xtraSM(varname, t, true, false)
			// x.encListFallback(varname, rtid, t)
		}
	case reflect.Map:
		// if nil, call dedicated function
		// if a known fastpath map, call dedicated function
		// else write encode function in-line.
		// - if elements are primitives or Selfers, call dedicated function on each member.
		// - else call Encoder.encode(XXX) on it.
		// x.line("if " + varname + " == nil { \nr.EncodeNil()\n } else { ")
		if fastpathAV.index(rtid) != -1 {
			g := x.newGenV(t)
			x.line("z.F." + g.MethodNamePfx("Enc", false) + "V(" + varname + ", e)")
		} else {
			x.xtraSM(varname, t, true, false)
			// x.encMapFallback(varname, rtid, t)
		}
	case reflect.Struct:
		if !inlist {
			delete(x.te, rtid)
			x.line("z.EncFallback(" + varname + ")")
			break
		}
		x.encStruct(varname, rtid, t)
	default:
		if rtidAdded {
			delete(x.te, rtid)
		}
		x.line("z.EncFallback(" + varname + ")")
	}
}

func (x *genRunner) encZero(t reflect.Type) {
	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		x.line("r.EncodeInt(0)")
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		x.line("r.EncodeUint(0)")
	case reflect.Float32:
		x.line("r.EncodeFloat32(0)")
	case reflect.Float64:
		x.line("r.EncodeFloat64(0)")
	case reflect.Bool:
		x.line("r.EncodeBool(false)")
	case reflect.String:
		x.linef(`if z.EncBasicHandle().StringToRaw { r.EncodeStringBytesRaw([]byte{}) } else { r.EncodeStringEnc(codecSelferCcUTF8%s, "") }`, x.xs)
	default:
		x.line("r.EncodeNil()")
	}
}

func (x *genRunner) encOmitEmptyLine(t2 reflect.StructField, varname string, buf *genBuf) {
	// smartly check omitEmpty on a struct type, as it may contain uncomparable map/slice/etc.
	// also, for maps/slices/arrays, check if len ! 0 (not if == zero value)
	varname2 := varname + "." + t2.Name
	switch t2.Type.Kind() {
	case reflect.Struct:
		rtid2 := rt2id(t2.Type)
		ti2 := x.ti.get(rtid2, t2.Type)
		// fmt.Printf(">>>> structfield: omitempty: type: %s, field: %s\n", t2.Type.Name(), t2.Name)
		if ti2.rtid == timeTypId {
			buf.s("!(").s(varname2).s(".IsZero())")
			break
		}
		if ti2.isFlag(typeInfoFlagIsZeroerPtr) || ti2.isFlag(typeInfoFlagIsZeroer) {
			buf.s("!(").s(varname2).s(".IsZero())")
			break
		}
		if ti2.isFlag(typeInfoFlagComparable) {
			buf.s(varname2).s(" != ").s(x.genZeroValueR(t2.Type))
			break
		}
		// buf.s("(")
		buf.s("false")
		for i, n := 0, t2.Type.NumField(); i < n; i++ {
			f := t2.Type.Field(i)
			if f.PkgPath != "" { // unexported
				continue
			}
			buf.s(" || ")
			x.encOmitEmptyLine(f, varname2, buf)
		}
		//buf.s(")")
	case reflect.Bool:
		buf.s(varname2)
	case reflect.Map, reflect.Slice, reflect.Array, reflect.Chan:
		buf.s("len(").s(varname2).s(") != 0")
	default:
		buf.s(varname2).s(" != ").s(x.genZeroValueR(t2.Type))
	}
}

func (x *genRunner) encStruct(varname string, rtid uintptr, t reflect.Type) {
	// Use knowledge from structfieldinfo (mbs, encodable fields. Ignore omitempty. )
	// replicate code in kStruct i.e. for each field, deref type to non-pointer, and call x.enc on it

	// if t === type currently running selfer on, do for all
	ti := x.ti.get(rtid, t)
	i := x.varsfx()
	sepVarname := genTempVarPfx + "sep" + i
	numfieldsvar := genTempVarPfx + "q" + i
	ti2arrayvar := genTempVarPfx + "r" + i
	struct2arrvar := genTempVarPfx + "2arr" + i

	x.line(sepVarname + " := !z.EncBinary()")
	x.linef("%s := z.EncBasicHandle().StructToArray", struct2arrvar)
	x.linef("_, _ = %s, %s", sepVarname, struct2arrvar)
	x.linef("const %s bool = %v // struct tag has 'toArray'", ti2arrayvar, ti.toArray)

	tisfi := ti.sfiSrc // always use sequence from file. decStruct expects same thing.

	// var nn int
	// due to omitEmpty, we need to calculate the
	// number of non-empty things we write out first.
	// This is required as we need to pre-determine the size of the container,
	// to support length-prefixing.
	if ti.anyOmitEmpty {
		x.linef("var %s = [%v]bool{ // should field at this index be written?", numfieldsvar, len(tisfi))

		for j, si := range tisfi {
			_ = j
			if !si.omitEmpty() {
				// x.linef("%s[%v] = true // %s", numfieldsvar, j, si.fieldName)
				x.linef("true, // %s", si.fieldName)
				// nn++
				continue
			}
			var t2 reflect.StructField
			var omitline genBuf
			{
				t2typ := t
				varname3 := varname
				// go through the loop, record the t2 field explicitly,
				// and gather the omit line if embedded in pointers.
				for ij, ix := range si.is {
					if uint8(ij) == si.nis {
						break
					}
					for t2typ.Kind() == reflect.Ptr {
						t2typ = t2typ.Elem()
					}
					t2 = t2typ.Field(int(ix))
					t2typ = t2.Type
					varname3 = varname3 + "." + t2.Name
					// do not include actual field in the omit line.
					// that is done subsequently (right after - below).
					if uint8(ij+1) < si.nis && t2typ.Kind() == reflect.Ptr {
						omitline.s(varname3).s(" != nil && ")
					}
				}
			}
			x.encOmitEmptyLine(t2, varname, &omitline)
			x.linef("%s, // %s", omitline.v(), si.fieldName)
		}
		x.line("}")
		x.linef("_ = %s", numfieldsvar)
	}
	// x.linef("var %snn%s int", genTempVarPfx, i)
	x.linef("if %s || %s {", ti2arrayvar, struct2arrvar) // if ti.toArray {
	x.linef("r.WriteArrayStart(%d)", len(tisfi))
	x.linef("} else {") // if not ti.toArray
	if ti.anyOmitEmpty {
		// nn = 0
		// x.linef("var %snn%s = %v", genTempVarPfx, i, nn)
		x.linef("var %snn%s int", genTempVarPfx, i)
		x.linef("for _, b := range %s { if b { %snn%s++ } }", numfieldsvar, genTempVarPfx, i)
		x.linef("r.WriteMapStart(%snn%s)", genTempVarPfx, i)
		x.linef("%snn%s = %v", genTempVarPfx, i, 0)
	} else {
		x.linef("r.WriteMapStart(%d)", len(tisfi))
	}
	x.line("}") // close if not StructToArray

	for j, si := range tisfi {
		i := x.varsfx()
		isNilVarName := genTempVarPfx + "n" + i
		var labelUsed bool
		var t2 reflect.StructField
		{
			t2typ := t
			varname3 := varname
			for ij, ix := range si.is {
				if uint8(ij) == si.nis {
					break
				}
				for t2typ.Kind() == reflect.Ptr {
					t2typ = t2typ.Elem()
				}
				t2 = t2typ.Field(int(ix))
				t2typ = t2.Type
				varname3 = varname3 + "." + t2.Name
				if t2typ.Kind() == reflect.Ptr {
					if !labelUsed {
						x.line("var " + isNilVarName + " bool")
					}
					x.line("if " + varname3 + " == nil { " + isNilVarName + " = true ")
					x.line("goto LABEL" + i)
					x.line("}")
					labelUsed = true
					// "varname3 = new(" + x.genTypeName(t3.Elem()) + ") }")
				}
			}
			// t2 = t.FieldByIndex(si.is)
		}
		if labelUsed {
			x.line("LABEL" + i + ":")
		}
		// if the type of the field is a Selfer, or one of the ones

		x.linef("if %s || %s {", ti2arrayvar, struct2arrvar) // if ti.toArray
		if labelUsed {
			x.linef("if %s { r.WriteArrayElem(); r.EncodeNil() } else { ", isNilVarName)
		}
		x.line("r.WriteArrayElem()")
		if si.omitEmpty() {
			x.linef("if %s[%v] {", numfieldsvar, j)
		}
		x.encVar(varname+"."+t2.Name, t2.Type)
		if si.omitEmpty() {
			x.linef("} else {")
			x.encZero(t2.Type)
			x.linef("}")
		}
		if labelUsed {
			x.line("}")
		}

		x.linef("} else {") // if not ti.toArray

		if si.omitEmpty() {
			x.linef("if %s[%v] {", numfieldsvar, j)
		}
		x.line("r.WriteMapElemKey()")

		// emulate EncStructFieldKey
		switch ti.keyType {
		case valueTypeInt:
			x.linef("r.EncodeInt(z.M.Int(strconv.ParseInt(`%s`, 10, 64)))", si.encName)
		case valueTypeUint:
			x.linef("r.EncodeUint(z.M.Uint(strconv.ParseUint(`%s`, 10, 64)))", si.encName)
		case valueTypeFloat:
			x.linef("r.EncodeFloat64(z.M.Float(strconv.ParseFloat(`%s`, 64)))", si.encName)
		default: // string
			if si.encNameAsciiAlphaNum {
				x.linef(`if z.IsJSONHandle() { z.WriteStr("\"%s\"") } else { `, si.encName)
			}
			x.linef("r.EncodeStringEnc(codecSelferCcUTF8%s, `%s`)", x.xs, si.encName)
			if si.encNameAsciiAlphaNum {
				x.linef("}")
			}
		}
		// x.linef("r.EncStructFieldKey(codecSelferValueType%s%s, `%s`)", ti.keyType.String(), x.xs, si.encName)
		x.line("r.WriteMapElemValue()")
		if labelUsed {
			x.line("if " + isNilVarName + " { r.EncodeNil() } else { ")
			x.encVar(varname+"."+t2.Name, t2.Type)
			x.line("}")
		} else {
			x.encVar(varname+"."+t2.Name, t2.Type)
		}
		if si.omitEmpty() {
			x.line("}")
		}
		x.linef("} ") // end if/else ti.toArray
	}
	x.linef("if %s || %s {", ti2arrayvar, struct2arrvar) // if ti.toArray {
	x.line("r.WriteArrayEnd()")
	x.line("} else {")
	x.line("r.WriteMapEnd()")
	x.line("}")

}

func (x *genRunner) encListFallback(varname string, t reflect.Type) {
	elemBytes := t.Elem().Kind() == reflect.Uint8
	if t.AssignableTo(uint8SliceTyp) {
		x.linef("r.EncodeStringBytesRaw([]byte(%s))", varname)
		return
	}
	if t.Kind() == reflect.Array && elemBytes {
		x.linef("r.EncodeStringBytesRaw(((*[%d]byte)(%s))[:])", t.Len(), varname)
		return
	}
	i := x.varsfx()
	if t.Kind() == reflect.Chan {
		type ts struct {
			Label, Chan, Slice, Sfx string
		}
		tm, err := template.New("").Parse(genEncChanTmpl)
		if err != nil {
			panic(err)
		}
		x.linef("if %s == nil { r.EncodeNil() } else { ", varname)
		x.linef("var sch%s []%s", i, x.genTypeName(t.Elem()))
		err = tm.Execute(x.w, &ts{"Lsch" + i, varname, "sch" + i, i})
		if err != nil {
			panic(err)
		}
		// x.linef("%s = sch%s", varname, i)
		if elemBytes {
			x.linef("r.EncodeStringBytesRaw([]byte(%s))", "sch"+i)
			x.line("}")
			return
		}
		varname = "sch" + i
	}

	x.line("r.WriteArrayStart(len(" + varname + "))")
	x.linef("for _, %sv%s := range %s {", genTempVarPfx, i, varname)
	x.line("r.WriteArrayElem()")

	x.encVar(genTempVarPfx+"v"+i, t.Elem())
	x.line("}")
	x.line("r.WriteArrayEnd()")
	if t.Kind() == reflect.Chan {
		x.line("}")
	}
}

func (x *genRunner) encMapFallback(varname string, t reflect.Type) {
	// TODO: expand this to handle canonical.
	i := x.varsfx()
	x.line("r.WriteMapStart(len(" + varname + "))")
	x.linef("for %sk%s, %sv%s := range %s {", genTempVarPfx, i, genTempVarPfx, i, varname)
	x.line("r.WriteMapElemKey()")
	x.encVar(genTempVarPfx+"k"+i, t.Key())
	x.line("r.WriteMapElemValue()")
	x.encVar(genTempVarPfx+"v"+i, t.Elem())
	x.line("}")
	x.line("r.WriteMapEnd()")
}

func (x *genRunner) decVarInitPtr(varname, nilvar string, t reflect.Type, si *structFieldInfo,
	newbuf, nilbuf *genBuf) (t2 reflect.StructField) {
	//we must accommodate anonymous fields, where the embedded field is a nil pointer in the value.
	// t2 = t.FieldByIndex(si.is)
	t2typ := t
	varname3 := varname
	t2kind := t2typ.Kind()
	var nilbufed bool
	if si != nil {
		for ij, ix := range si.is {
			if uint8(ij) == si.nis {
				break
			}
			for t2typ.Kind() == reflect.Ptr {
				t2typ = t2typ.Elem()
			}
			t2 = t2typ.Field(int(ix))
			t2typ = t2.Type
			varname3 = varname3 + "." + t2.Name
			t2kind = t2typ.Kind()
			if t2kind != reflect.Ptr {
				continue
			}
			if newbuf != nil {
				newbuf.f("if %s == nil { %s = new(%s) }\n", varname3, varname3, x.genTypeName(t2typ.Elem()))
			}
			if nilbuf != nil {
				if !nilbufed {
					nilbuf.s("if true")
					nilbufed = true
				}
				nilbuf.s(" && ").s(varname3).s(" != nil")
			}
		}
	}
	// if t2typ.Kind() == reflect.Ptr {
	// 	varname3 = varname3 + t2.Name
	// }
	if nilbuf != nil {
		if nilbufed {
			nilbuf.s(" { ")
		}
		if nilvar != "" {
			nilbuf.s(nilvar).s(" = true")
		} else if tk := t2typ.Kind(); tk == reflect.Ptr {
			if strings.IndexByte(varname3, '.') != -1 || strings.IndexByte(varname3, '[') != -1 {
				nilbuf.s(varname3).s(" = nil")
			} else {
				nilbuf.s("*").s(varname3).s(" = ").s(x.genZeroValueR(t2typ.Elem()))
			}
		} else {
			nilbuf.s(varname3).s(" = ").s(x.genZeroValueR(t2typ))
		}
		if nilbufed {
			nilbuf.s("}")
		}
	}
	return t2
}

// decVar takes a variable called varname, of type t
func (x *genRunner) decVarMain(varname, rand string, t reflect.Type, checkNotNil bool) {
	// We only encode as nil if a nillable value.
	// This removes some of the wasted checks for TryDecodeAsNil.
	// We need to think about this more, to see what happens if omitempty, etc
	// cause a nil value to be stored when something is expected.
	// This could happen when decoding from a struct encoded as an array.
	// For that, decVar should be called with canNil=true, to force true as its value.
	var varname2 string
	if t.Kind() != reflect.Ptr {
		if t.PkgPath() != "" || !x.decTryAssignPrimitive(varname, t, false) {
			x.dec(varname, t, false)
		}
	} else {
		if checkNotNil {
			x.linef("if %s == nil { %s = new(%s) }", varname, varname, x.genTypeName(t.Elem()))
		}
		// Ensure we set underlying ptr to a non-nil value (so we can deref to it later).
		// There's a chance of a **T in here which is nil.
		var ptrPfx string
		for t = t.Elem(); t.Kind() == reflect.Ptr; t = t.Elem() {
			ptrPfx += "*"
			if checkNotNil {
				x.linef("if %s%s == nil { %s%s = new(%s)}",
					ptrPfx, varname, ptrPfx, varname, x.genTypeName(t))
			}
		}
		// Should we create temp var if a slice/map indexing? No. dec(...) can now handle it.

		if ptrPfx == "" {
			x.dec(varname, t, true)
		} else {
			varname2 = genTempVarPfx + "z" + rand
			x.line(varname2 + " := " + ptrPfx + varname)
			x.dec(varname2, t, true)
		}
	}
}

// decVar takes a variable called varname, of type t
func (x *genRunner) decVar(varname, nilvar string, t reflect.Type, canBeNil, checkNotNil bool) {
	i := x.varsfx()

	// We only encode as nil if a nillable value.
	// This removes some of the wasted checks for TryDecodeAsNil.
	// We need to think about this more, to see what happens if omitempty, etc
	// cause a nil value to be stored when something is expected.
	// This could happen when decoding from a struct encoded as an array.
	// For that, decVar should be called with canNil=true, to force true as its value.

	if !canBeNil {
		canBeNil = genAnythingCanBeNil || !genIsImmutable(t)
	}

	if canBeNil {
		var buf genBuf
		x.decVarInitPtr(varname, nilvar, t, nil, nil, &buf)
		x.linef("if r.TryDecodeAsNil() { %s } else {", buf.buf)
	} else {
		x.line("// cannot be nil")
	}

	x.decVarMain(varname, i, t, checkNotNil)

	if canBeNil {
		x.line("} ")
	}
}

// dec will decode a variable (varname) of type t or ptrTo(t) if isptr==true.
// t is always a basetype (i.e. not of kind reflect.Ptr).
func (x *genRunner) dec(varname string, t reflect.Type, isptr bool) {
	// assumptions:
	//   - the varname is to a pointer already. No need to take address of it
	//   - t is always a baseType T (not a *T, etc).
	rtid := rt2id(t)
	ti2 := x.ti.get(rtid, t)
	// tptr := reflect.PtrTo(t)
	if x.checkForSelfer(t, varname) {
		if ti2.cs || ti2.csp { // t.Implements(selferTyp) || tptr.Implements(selferTyp) {
			x.line(varname + ".CodecDecodeSelf(d)")
			return
		}
		if _, ok := x.td[rtid]; ok {
			x.line(varname + ".CodecDecodeSelf(d)")
			return
		}
	}

	inlist := false
	for _, t0 := range x.t {
		if t == t0 {
			inlist = true
			if x.checkForSelfer(t, varname) {
				x.line(varname + ".CodecDecodeSelf(d)")
				return
			}
			break
		}
	}

	var rtidAdded bool
	if t == x.tc {
		x.td[rtid] = true
		rtidAdded = true
	}

	// check if
	//   - type is time.Time, Raw, RawExt
	//   - the type implements (Text|JSON|Binary)(Unm|M)arshal

	mi := x.varsfx()
	// x.linef("%sm%s := z.DecBinary()", genTempVarPfx, mi)
	// x.linef("_ = %sm%s", genTempVarPfx, mi)
	x.line("if false {")           //start if block
	defer func() { x.line("}") }() //end if block

	var ptrPfx, addrPfx string
	if isptr {
		ptrPfx = "*"
	} else {
		addrPfx = "&"
	}
	if t == timeTyp {
		x.linef("} else if !z.DecBasicHandle().TimeNotBuiltin { %s%v = r.DecodeTime()", ptrPfx, varname)
		// return
	}
	if t == rawTyp {
		x.linef("} else { %s%v = z.DecRaw()", ptrPfx, varname)
		return
	}

	if t == rawExtTyp {
		x.linef("} else { r.DecodeExt(%s%v, 0, nil)", addrPfx, varname)
		return
	}

	// only check for extensions if the type is named, and has a packagePath.
	if !x.nx && genImportPath(t) != "" && t.Name() != "" {
		// first check if extensions are configued, before doing the interface conversion
		// x.linef("} else if z.HasExtensions() && z.DecExt(%s) {", varname)
		yy := fmt.Sprintf("%sxt%s", genTempVarPfx, mi)
		x.linef("} else if %s := z.Extension(z.I2Rtid(%s)); %s != nil { z.DecExtension(%s, %s) ", yy, varname, yy, varname, yy)
	}

	if ti2.bu || ti2.bup { // t.Implements(binaryUnmarshalerTyp) || tptr.Implements(binaryUnmarshalerTyp) {
		x.linef("} else if z.DecBinary() { z.DecBinaryUnmarshal(%s%v) ", addrPfx, varname)
	}
	if ti2.ju || ti2.jup { // t.Implements(jsonUnmarshalerTyp) || tptr.Implements(jsonUnmarshalerTyp) {
		x.linef("} else if !z.DecBinary() && z.IsJSONHandle() { z.DecJSONUnmarshal(%s%v)", addrPfx, varname)
	} else if ti2.tu || ti2.tup { // t.Implements(textUnmarshalerTyp) || tptr.Implements(textUnmarshalerTyp) {
		x.linef("} else if !z.DecBinary() { z.DecTextUnmarshal(%s%v)", addrPfx, varname)
	}

	x.line("} else {")

	if x.decTryAssignPrimitive(varname, t, isptr) {
		return
	}

	switch t.Kind() {
	case reflect.Array, reflect.Chan:
		x.xtraSM(varname, t, false, isptr)
	case reflect.Slice:
		// if a []uint8, call dedicated function
		// if a known fastpath slice, call dedicated function
		// else write encode function in-line.
		// - if elements are primitives or Selfers, call dedicated function on each member.
		// - else call Encoder.encode(XXX) on it.
		if rtid == uint8SliceTypId {
			x.linef("%s%s = r.DecodeBytes(%s(%s[]byte)(%s), false)",
				ptrPfx, varname, ptrPfx, ptrPfx, varname)
		} else if fastpathAV.index(rtid) != -1 {
			g := x.newGenV(t)
			x.linef("z.F.%sX(%s%s, d)", g.MethodNamePfx("Dec", false), addrPfx, varname)
		} else {
			x.xtraSM(varname, t, false, isptr)
			// x.decListFallback(varname, rtid, false, t)
		}
	case reflect.Map:
		// if a known fastpath map, call dedicated function
		// else write encode function in-line.
		// - if elements are primitives or Selfers, call dedicated function on each member.
		// - else call Encoder.encode(XXX) on it.
		if fastpathAV.index(rtid) != -1 {
			g := x.newGenV(t)
			x.linef("z.F.%sX(%s%s, d)", g.MethodNamePfx("Dec", false), addrPfx, varname)
		} else {
			x.xtraSM(varname, t, false, isptr)
			// x.decMapFallback(varname, rtid, t)
		}
	case reflect.Struct:
		if inlist {
			// no need to create temp variable if isptr, or x.F or x[F]
			if isptr || strings.IndexByte(varname, '.') != -1 || strings.IndexByte(varname, '[') != -1 {
				x.decStruct(varname, rtid, t)
			} else {
				varname2 := genTempVarPfx + "j" + mi
				x.line(varname2 + " := &" + varname)
				x.decStruct(varname2, rtid, t)
			}
		} else {
			// delete(x.td, rtid)
			x.line("z.DecFallback(" + addrPfx + varname + ", false)")
		}
	default:
		if rtidAdded {
			delete(x.te, rtid)
		}
		x.line("z.DecFallback(" + addrPfx + varname + ", true)")
	}
}

func (x *genRunner) decTryAssignPrimitive(varname string, t reflect.Type, isptr bool) (done bool) {
	// This should only be used for exact primitives (ie un-named types).
	// Named types may be implementations of Selfer, Unmarshaler, etc.
	// They should be handled by dec(...)

	var ptr string
	if isptr {
		ptr = "*"
	}
	switch t.Kind() {
	case reflect.Int:
		x.linef("%s%s = (%s)(z.C.IntV(r.DecodeInt64(), codecSelferBitsize%s))", ptr, varname, x.genTypeName(t), x.xs)
	case reflect.Int8:
		x.linef("%s%s = (%s)(z.C.IntV(r.DecodeInt64(), 8))", ptr, varname, x.genTypeName(t))
	case reflect.Int16:
		x.linef("%s%s = (%s)(z.C.IntV(r.DecodeInt64(), 16))", ptr, varname, x.genTypeName(t))
	case reflect.Int32:
		x.linef("%s%s = (%s)(z.C.IntV(r.DecodeInt64(), 32))", ptr, varname, x.genTypeName(t))
	case reflect.Int64:
		x.linef("%s%s = (%s)(r.DecodeInt64())", ptr, varname, x.genTypeName(t))

	case reflect.Uint:
		x.linef("%s%s = (%s)(z.C.UintV(r.DecodeUint64(), codecSelferBitsize%s))", ptr, varname, x.genTypeName(t), x.xs)
	case reflect.Uint8:
		x.linef("%s%s = (%s)(z.C.UintV(r.DecodeUint64(), 8))", ptr, varname, x.genTypeName(t))
	case reflect.Uint16:
		x.linef("%s%s = (%s)(z.C.UintV(r.DecodeUint64(), 16))", ptr, varname, x.genTypeName(t))
	case reflect.Uint32:
		x.linef("%s%s = (%s)(z.C.UintV(r.DecodeUint64(), 32))", ptr, varname, x.genTypeName(t))
	case reflect.Uint64:
		x.linef("%s%s = (%s)(r.DecodeUint64())", ptr, varname, x.genTypeName(t))
	case reflect.Uintptr:
		x.linef("%s%s = (%s)(z.C.UintV(r.DecodeUint64(), codecSelferBitsize%s))", ptr, varname, x.genTypeName(t), x.xs)

	case reflect.Float32:
		x.linef("%s%s = (%s)(r.DecodeFloat32As64())", ptr, varname, x.genTypeName(t))
	case reflect.Float64:
		x.linef("%s%s = (%s)(r.DecodeFloat64())", ptr, varname, x.genTypeName(t))

	case reflect.Bool:
		x.linef("%s%s = (%s)(r.DecodeBool())", ptr, varname, x.genTypeName(t))
	case reflect.String:
		x.linef("%s%s = (%s)(r.DecodeString())", ptr, varname, x.genTypeName(t))
	default:
		return false
	}
	return true
}

func (x *genRunner) decListFallback(varname string, rtid uintptr, t reflect.Type) {
	if t.AssignableTo(uint8SliceTyp) {
		x.line("*" + varname + " = r.DecodeBytes(*((*[]byte)(" + varname + ")), false)")
		return
	}
	if t.Kind() == reflect.Array && t.Elem().Kind() == reflect.Uint8 {
		x.linef("r.DecodeBytes( ((*[%d]byte)(%s))[:], true)", t.Len(), varname)
		return
	}
	type tstruc struct {
		TempVar   string
		Rand      string
		Varname   string
		CTyp      string
		Typ       string
		Immutable bool
		Size      int
	}
	telem := t.Elem()
	ts := tstruc{genTempVarPfx, x.varsfx(), varname, x.genTypeName(t), x.genTypeName(telem), genIsImmutable(telem), int(telem.Size())}

	funcs := make(template.FuncMap)

	funcs["decLineVar"] = func(varname string) string {
		x.decVar(varname, "", telem, false, true)
		return ""
	}
	funcs["var"] = func(s string) string {
		return ts.TempVar + s + ts.Rand
	}
	funcs["zero"] = func() string {
		return x.genZeroValueR(telem)
	}
	funcs["isArray"] = func() bool {
		return t.Kind() == reflect.Array
	}
	funcs["isSlice"] = func() bool {
		return t.Kind() == reflect.Slice
	}
	funcs["isChan"] = func() bool {
		return t.Kind() == reflect.Chan
	}
	tm, err := template.New("").Funcs(funcs).Parse(genDecListTmpl)
	if err != nil {
		panic(err)
	}
	if err = tm.Execute(x.w, &ts); err != nil {
		panic(err)
	}
}

func (x *genRunner) decMapFallback(varname string, rtid uintptr, t reflect.Type) {
	type tstruc struct {
		TempVar string
		Sfx     string
		Rand    string
		Varname string
		KTyp    string
		Typ     string
		Size    int
	}
	telem := t.Elem()
	tkey := t.Key()
	ts := tstruc{
		genTempVarPfx, x.xs, x.varsfx(), varname, x.genTypeName(tkey),
		x.genTypeName(telem), int(telem.Size() + tkey.Size()),
	}

	funcs := make(template.FuncMap)
	funcs["decElemZero"] = func() string {
		return x.genZeroValueR(telem)
	}
	funcs["decElemKindImmutable"] = func() bool {
		return genIsImmutable(telem)
	}
	funcs["decElemKindPtr"] = func() bool {
		return telem.Kind() == reflect.Ptr
	}
	funcs["decElemKindIntf"] = func() bool {
		return telem.Kind() == reflect.Interface
	}
	funcs["decLineVarK"] = func(varname string) string {
		x.decVar(varname, "", tkey, false, true)
		return ""
	}
	funcs["decLineVar"] = func(varname, decodedNilVarname string) string {
		x.decVar(varname, decodedNilVarname, telem, false, true)
		return ""
	}
	funcs["var"] = func(s string) string {
		return ts.TempVar + s + ts.Rand
	}

	tm, err := template.New("").Funcs(funcs).Parse(genDecMapTmpl)
	if err != nil {
		panic(err)
	}
	if err = tm.Execute(x.w, &ts); err != nil {
		panic(err)
	}
}

func (x *genRunner) decStructMapSwitch(kName string, varname string, rtid uintptr, t reflect.Type) {
	ti := x.ti.get(rtid, t)
	tisfi := ti.sfiSrc // always use sequence from file. decStruct expects same thing.
	x.line("switch (" + kName + ") {")
	var newbuf, nilbuf genBuf
	for _, si := range tisfi {
		x.line("case \"" + si.encName + "\":")
		newbuf.reset()
		nilbuf.reset()
		t2 := x.decVarInitPtr(varname, "", t, si, &newbuf, &nilbuf)
		x.linef("if r.TryDecodeAsNil() { %s } else { %s", nilbuf.buf, newbuf.buf)
		x.decVarMain(varname+"."+t2.Name, x.varsfx(), t2.Type, false)
		x.line("}")
	}
	x.line("default:")
	// pass the slice here, so that the string will not escape, and maybe save allocation
	x.line("z.DecStructFieldNotFound(-1, " + kName + ")")
	x.line("} // end switch " + kName)
}

func (x *genRunner) decStructMap(varname, lenvarname string, rtid uintptr, t reflect.Type, style genStructMapStyle) {
	tpfx := genTempVarPfx
	ti := x.ti.get(rtid, t)
	i := x.varsfx()
	kName := tpfx + "s" + i

	switch style {
	case genStructMapStyleLenPrefix:
		x.linef("for %sj%s := 0; %sj%s < %s; %sj%s++ {", tpfx, i, tpfx, i, lenvarname, tpfx, i)
	case genStructMapStyleCheckBreak:
		x.linef("for %sj%s := 0; !r.CheckBreak(); %sj%s++ {", tpfx, i, tpfx, i)
	default: // 0, otherwise.
		x.linef("var %shl%s bool = %s >= 0", tpfx, i, lenvarname) // has length
		x.linef("for %sj%s := 0; ; %sj%s++ {", tpfx, i, tpfx, i)
		x.linef("if %shl%s { if %sj%s >= %s { break }", tpfx, i, tpfx, i, lenvarname)
		x.line("} else { if r.CheckBreak() { break }; }")
	}
	x.line("r.ReadMapElemKey()")

	// emulate decstructfieldkey
	switch ti.keyType {
	case valueTypeInt:
		x.linef("%s := z.StringView(strconv.AppendInt(z.DecScratchArrayBuffer()[:0], r.DecodeInt64(), 10))", kName)
	case valueTypeUint:
		x.linef("%s := z.StringView(strconv.AppendUint(z.DecScratchArrayBuffer()[:0], r.DecodeUint64(), 10))", kName)
	case valueTypeFloat:
		x.linef("%s := z.StringView(strconv.AppendFloat(z.DecScratchArrayBuffer()[:0], r.DecodeFloat64(), 'f', -1, 64))", kName)
	default: // string
		x.linef("%s := z.StringView(r.DecodeStringAsBytes())", kName)
	}
	// x.linef("%s := z.StringView(r.DecStructFieldKey(codecSelferValueType%s%s, z.DecScratchArrayBuffer()))", kName, ti.keyType.String(), x.xs)

	x.line("r.ReadMapElemValue()")
	x.decStructMapSwitch(kName, varname, rtid, t)

	x.line("} // end for " + tpfx + "j" + i)
	x.line("r.ReadMapEnd()")
}

func (x *genRunner) decStructArray(varname, lenvarname, breakString string, rtid uintptr, t reflect.Type) {
	tpfx := genTempVarPfx
	i := x.varsfx()
	ti := x.ti.get(rtid, t)
	tisfi := ti.sfiSrc // always use sequence from file. decStruct expects same thing.
	x.linef("var %sj%s int", tpfx, i)
	x.linef("var %sb%s bool", tpfx, i)                        // break
	x.linef("var %shl%s bool = %s >= 0", tpfx, i, lenvarname) // has length
	var newbuf, nilbuf genBuf
	for _, si := range tisfi {
		x.linef("%sj%s++; if %shl%s { %sb%s = %sj%s > %s } else { %sb%s = r.CheckBreak() }",
			tpfx, i, tpfx, i, tpfx, i,
			tpfx, i, lenvarname, tpfx, i)
		x.linef("if %sb%s { r.ReadArrayEnd(); %s }", tpfx, i, breakString)
		x.line("r.ReadArrayElem()")
		newbuf.reset()
		nilbuf.reset()
		t2 := x.decVarInitPtr(varname, "", t, si, &newbuf, &nilbuf)
		x.linef("if r.TryDecodeAsNil() { %s } else { %s", nilbuf.buf, newbuf.buf)
		x.decVarMain(varname+"."+t2.Name, x.varsfx(), t2.Type, false)
		x.line("}")
	}
	// read remaining values and throw away.
	x.line("for {")
	x.linef("%sj%s++; if %shl%s { %sb%s = %sj%s > %s } else { %sb%s = r.CheckBreak() }",
		tpfx, i, tpfx, i, tpfx, i,
		tpfx, i, lenvarname, tpfx, i)
	x.linef("if %sb%s { break }", tpfx, i)
	x.line("r.ReadArrayElem()")
	x.linef(`z.DecStructFieldNotFound(%sj%s - 1, "")`, tpfx, i)
	x.line("}")
	x.line("r.ReadArrayEnd()")
}

func (x *genRunner) decStruct(varname string, rtid uintptr, t reflect.Type) {
	// varname MUST be a ptr, or a struct field or a slice element.
	i := x.varsfx()
	x.linef("%sct%s := r.ContainerType()", genTempVarPfx, i)
	x.linef("if %sct%s == codecSelferValueTypeMap%s {", genTempVarPfx, i, x.xs)
	x.line(genTempVarPfx + "l" + i + " := r.ReadMapStart()")
	x.linef("if %sl%s == 0 {", genTempVarPfx, i)
	x.line("r.ReadMapEnd()")
	if genUseOneFunctionForDecStructMap {
		x.line("} else { ")
		x.linef("%s.codecDecodeSelfFromMap(%sl%s, d)", varname, genTempVarPfx, i)
	} else {
		x.line("} else if " + genTempVarPfx + "l" + i + " > 0 { ")
		x.line(varname + ".codecDecodeSelfFromMapLenPrefix(" + genTempVarPfx + "l" + i + ", d)")
		x.line("} else {")
		x.line(varname + ".codecDecodeSelfFromMapCheckBreak(" + genTempVarPfx + "l" + i + ", d)")
	}
	x.line("}")

	// else if container is array
	x.linef("} else if %sct%s == codecSelferValueTypeArray%s {", genTempVarPfx, i, x.xs)
	x.line(genTempVarPfx + "l" + i + " := r.ReadArrayStart()")
	x.linef("if %sl%s == 0 {", genTempVarPfx, i)
	x.line("r.ReadArrayEnd()")
	x.line("} else { ")
	x.linef("%s.codecDecodeSelfFromArray(%sl%s, d)", varname, genTempVarPfx, i)
	x.line("}")
	// else panic
	x.line("} else { ")
	x.line("panic(errCodecSelferOnlyMapOrArrayEncodeToStruct" + x.xs + ")")
	x.line("} ")
}

// --------

func (x *genRunner) newGenV(t reflect.Type) (v genV) {
	switch t.Kind() {
	case reflect.Slice, reflect.Array:
		te := t.Elem()
		v.Elem = x.genTypeName(te)
		v.Size = int(te.Size())
	case reflect.Map:
		te, tk := t.Elem(), t.Key()
		v.Elem = x.genTypeName(te)
		v.MapKey = x.genTypeName(tk)
		v.Size = int(te.Size() + tk.Size())
	default:
		panic("unexpected type for newGenV. Requires map or slice type")
	}
	return
}

func (x *genV) MethodNamePfx(prefix string, prim bool) string {
	var name []byte
	if prefix != "" {
		name = append(name, prefix...)
	}
	if prim {
		name = append(name, genTitleCaseName(x.Primitive)...)
	} else {
		if x.MapKey == "" {
			name = append(name, "Slice"...)
		} else {
			name = append(name, "Map"...)
			name = append(name, genTitleCaseName(x.MapKey)...)
		}
		name = append(name, genTitleCaseName(x.Elem)...)
	}
	return string(name)

}

// genImportPath returns import path of a non-predeclared named typed, or an empty string otherwise.
//
// This handles the misbehaviour that occurs when 1.5-style vendoring is enabled,
// where PkgPath returns the full path, including the vendoring pre-fix that should have been stripped.
// We strip it here.
func genImportPath(t reflect.Type) (s string) {
	s = t.PkgPath()
	s = genStripVendor(s)
	return
}

// A go identifier is (letter|_)[letter|number|_]*
func genGoIdentifier(s string, checkFirstChar bool) string {
	b := make([]byte, 0, len(s))
	t := make([]byte, 4)
	var n int
	for i, r := range s {
		if checkFirstChar && i == 0 && !unicode.IsLetter(r) {
			b = append(b, '_')
		}
		// r must be unicode_letter, unicode_digit or _
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			n = utf8.EncodeRune(t, r)
			b = append(b, t[:n]...)
		} else {
			b = append(b, '_')
		}
	}
	return string(b)
}

func genNonPtr(t reflect.Type) reflect.Type {
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t
}

func genTitleCaseName(s string) string {
	switch s {
	case "interface{}", "interface {}":
		return "Intf"
	default:
		return strings.ToUpper(s[0:1]) + s[1:]
	}
}

func genMethodNameT(t reflect.Type, tRef reflect.Type) (n string) {
	var ptrPfx string
	for t.Kind() == reflect.Ptr {
		ptrPfx += "Ptrto"
		t = t.Elem()
	}
	tstr := t.String()
	if tn := t.Name(); tn != "" {
		if tRef != nil && genImportPath(t) == genImportPath(tRef) {
			return ptrPfx + tn
		} else {
			if genQNameRegex.MatchString(tstr) {
				return ptrPfx + strings.Replace(tstr, ".", "_", 1000)
			} else {
				return ptrPfx + genCustomTypeName(tstr)
			}
		}
	}
	switch t.Kind() {
	case reflect.Map:
		return ptrPfx + "Map" + genMethodNameT(t.Key(), tRef) + genMethodNameT(t.Elem(), tRef)
	case reflect.Slice:
		return ptrPfx + "Slice" + genMethodNameT(t.Elem(), tRef)
	case reflect.Array:
		return ptrPfx + "Array" + strconv.FormatInt(int64(t.Len()), 10) + genMethodNameT(t.Elem(), tRef)
	case reflect.Chan:
		var cx string
		switch t.ChanDir() {
		case reflect.SendDir:
			cx = "ChanSend"
		case reflect.RecvDir:
			cx = "ChanRecv"
		default:
			cx = "Chan"
		}
		return ptrPfx + cx + genMethodNameT(t.Elem(), tRef)
	default:
		if t == intfTyp {
			return ptrPfx + "Interface"
		} else {
			if tRef != nil && genImportPath(t) == genImportPath(tRef) {
				if t.Name() != "" {
					return ptrPfx + t.Name()
				} else {
					return ptrPfx + genCustomTypeName(tstr)
				}
			} else {
				// best way to get the package name inclusive
				// return ptrPfx + strings.Replace(tstr, ".", "_", 1000)
				// return ptrPfx + genBase32enc.EncodeToString([]byte(tstr))
				if t.Name() != "" && genQNameRegex.MatchString(tstr) {
					return ptrPfx + strings.Replace(tstr, ".", "_", 1000)
				} else {
					return ptrPfx + genCustomTypeName(tstr)
				}
			}
		}
	}
}

// genCustomNameForType base32encodes the t.String() value in such a way
// that it can be used within a function name.
func genCustomTypeName(tstr string) string {
	len2 := genBase32enc.EncodedLen(len(tstr))
	bufx := make([]byte, len2)
	genBase32enc.Encode(bufx, []byte(tstr))
	for i := len2 - 1; i >= 0; i-- {
		if bufx[i] == '=' {
			len2--
		} else {
			break
		}
	}
	return string(bufx[:len2])
}

func genIsImmutable(t reflect.Type) (v bool) {
	return isImmutableKind(t.Kind())
}

func genStripVendor(s string) string {
	// HACK: Misbehaviour occurs in go 1.5. May have to re-visit this later.
	// if s contains /vendor/ OR startsWith vendor/, then return everything after it.
	const vendorStart = "vendor/"
	const vendorInline = "/vendor/"
	if i := strings.LastIndex(s, vendorInline); i >= 0 {
		s = s[i+len(vendorInline):]
	} else if strings.HasPrefix(s, vendorStart) {
		s = s[len(vendorStart):]
	}
	return s
}
