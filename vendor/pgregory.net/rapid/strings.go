// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"bytes"
	"fmt"
	"math"
	"regexp"
	"regexp/syntax"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"
)

var (
	defaultRunes = []rune{
		'A', 'a', '?',
		'~', '!', '@', '#', '$', '%', '^', '&', '*', '_', '-', '+', '=',
		'.', ',', ':', ';',
		' ', '\t', '\r', '\n',
		'/', '\\', '|',
		'(', '[', '{', '<',
		'\'', '"', '`',
		'\x00', '\x0B', '\x1B', '\x7F', // NUL, VT, ESC, DEL
		'\uFEFF', '\uFFFD', '\u202E', // BOM, replacement character, RTL override
		'Ⱥ', // In UTF-8, Ⱥ increases in length from 2 to 3 bytes when lowercased
	}

	// unicode.Categories without surrogates (which are not allowed in UTF-8), ordered by taste
	defaultTables = []*unicode.RangeTable{
		unicode.Lu, // Letter, uppercase        (1781)
		unicode.Ll, // Letter, lowercase        (2145)
		unicode.Lt, // Letter, titlecase          (31)
		unicode.Lm, // Letter, modifier          (250)
		unicode.Lo, // Letter, other          (121212)
		unicode.Nd, // Number, decimal digit     (610)
		unicode.Nl, // Number, letter            (236)
		unicode.No, // Number, other             (807)
		unicode.P,  // Punctuation               (788)
		unicode.Sm, // Symbol, math              (948)
		unicode.Sc, // Symbol, currency           (57)
		unicode.Sk, // Symbol, modifier          (121)
		unicode.So, // Symbol, other            (5984)
		unicode.Mn, // Mark, nonspacing         (1805)
		unicode.Me, // Mark, enclosing            (13)
		unicode.Mc, // Mark, spacing combining   (415)
		unicode.Z,  // Separator                  (19)
		unicode.Cc, // Other, control             (65)
		unicode.Cf, // Other, format             (152)
		unicode.Co, // Other, private use     (137468)
	}

	expandedTables  = sync.Map{} // *unicode.RangeTable / regexp name -> []rune
	compiledRegexps = sync.Map{} // regexp -> compiledRegexp
	regexpNames     = sync.Map{} // *regexp.Regexp -> string
	charClassGens   = sync.Map{} // regexp name -> *Generator

	anyRuneGen     = Rune()
	anyRuneGenNoNL = Rune().Filter(func(r rune) bool { return r != '\n' })
)

type compiledRegexp struct {
	syn *syntax.Regexp
	re  *regexp.Regexp
}

// Rune creates a rune generator. Rune is equivalent to [RuneFrom] with default set of runes and tables.
func Rune() *Generator[rune] {
	return runesFrom(true, defaultRunes, defaultTables...)
}

// RuneFrom creates a rune generator from provided runes and tables.
// RuneFrom panics if both runes and tables are empty. RuneFrom panics if tables contain an empty table.
func RuneFrom(runes []rune, tables ...*unicode.RangeTable) *Generator[rune] {
	return runesFrom(false, runes, tables...)
}

func runesFrom(default_ bool, runes []rune, tables ...*unicode.RangeTable) *Generator[rune] {
	if len(tables) == 0 {
		assertf(len(runes) > 0, "at least one rune should be specified")
	}
	if len(runes) == 0 {
		assertf(len(tables) > 0, "at least one *unicode.RangeTable should be specified")
	}

	var weights []int
	if len(runes) > 0 {
		weights = append(weights, len(tables))
	}
	for range tables {
		weights = append(weights, 1)
	}

	tables_ := make([][]rune, len(tables))
	for i := range tables {
		tables_[i] = expandRangeTable(tables[i], tables[i])
		assertf(len(tables_[i]) > 0, "empty *unicode.RangeTable %v", i)
	}

	return newGenerator[rune](&runeGen{
		die:      newLoadedDie(weights),
		runes:    runes,
		tables:   tables_,
		default_: default_,
	})
}

type runeGen struct {
	die      *loadedDie
	runes    []rune
	tables   [][]rune
	default_ bool
}

func (g *runeGen) String() string {
	if g.default_ {
		return "Rune()"
	} else {
		return fmt.Sprintf("Rune(%v runes, %v tables)", len(g.runes), len(g.tables))
	}
}

func (g *runeGen) value(t *T) rune {
	n := g.die.roll(t.s)

	runes := g.runes
	if len(g.runes) == 0 {
		runes = g.tables[n]
	} else if n > 0 {
		runes = g.tables[n-1]
	}

	return runes[genIndex(t.s, len(runes), true)]
}

// String is a shorthand for [StringOf]([Rune]()).
func String() *Generator[string] {
	return StringOf(anyRuneGen)
}

// StringN is a shorthand for [StringOfN]([Rune](), minRunes, maxRunes, maxLen).
func StringN(minRunes int, maxRunes int, maxLen int) *Generator[string] {
	return StringOfN(anyRuneGen, minRunes, maxRunes, maxLen)
}

// StringOf is a shorthand for [StringOfN](elem, -1, -1, -1).
func StringOf(elem *Generator[rune]) *Generator[string] {
	return StringOfN(elem, -1, -1, -1)
}

// StringOfN creates a UTF-8 string generator.
// If minRunes >= 0, generated strings have minimum minRunes runes.
// If maxRunes >= 0, generated strings have maximum maxRunes runes.
// If maxLen >= 0, generates strings have maximum length of maxLen.
// StringOfN panics if maxRunes >= 0 and minRunes > maxRunes.
// StringOfN panics if maxLen >= 0 and maxLen < maxRunes.
func StringOfN(elem *Generator[rune], minRunes int, maxRunes int, maxLen int) *Generator[string] {
	assertValidRange(minRunes, maxRunes)
	assertf(maxLen < 0 || maxLen >= maxRunes, "maximum length (%v) should not be less than maximum number of runes (%v)", maxLen, maxRunes)

	return newGenerator[string](&stringGen{
		elem:     elem,
		minRunes: minRunes,
		maxRunes: maxRunes,
		maxLen:   maxLen,
	})
}

type stringGen struct {
	elem     *Generator[rune]
	minRunes int
	maxRunes int
	maxLen   int
}

func (g *stringGen) String() string {
	if g.elem == anyRuneGen {
		if g.minRunes < 0 && g.maxRunes < 0 && g.maxLen < 0 {
			return "String()"
		} else {
			return fmt.Sprintf("StringN(minRunes=%v, maxRunes=%v, maxLen=%v)", g.minRunes, g.maxRunes, g.maxLen)
		}
	} else {
		if g.minRunes < 0 && g.maxRunes < 0 && g.maxLen < 0 {
			return fmt.Sprintf("StringOf(%v)", g.elem)
		} else {
			return fmt.Sprintf("StringOfN(%v, minRunes=%v, maxRunes=%v, maxLen=%v)", g.elem, g.minRunes, g.maxRunes, g.maxLen)
		}
	}
}

func (g *stringGen) value(t *T) string {
	repeat := newRepeat(g.minRunes, g.maxRunes, -1, g.elem.String())

	var b strings.Builder
	b.Grow(repeat.avg())

	maxLen := g.maxLen
	if maxLen < 0 {
		maxLen = math.MaxInt
	}

	for repeat.more(t.s) {
		r := g.elem.value(t)
		n := utf8.RuneLen(r)

		if n < 0 || b.Len()+n > maxLen {
			repeat.reject()
		} else {
			b.WriteRune(r)
		}
	}

	return b.String()
}

// StringMatching creates a UTF-8 string generator matching the provided [syntax.Perl] regular expression.
func StringMatching(expr string) *Generator[string] {
	compiled, err := compileRegexp(expr)
	assertf(err == nil, "%v", err)

	return newGenerator[string](&regexpStringGen{
		regexpGen{
			expr: expr,
			syn:  compiled.syn,
			re:   compiled.re,
		},
	})
}

// SliceOfBytesMatching creates a UTF-8 byte slice generator matching the provided [syntax.Perl] regular expression.
func SliceOfBytesMatching(expr string) *Generator[[]byte] {
	compiled, err := compileRegexp(expr)
	assertf(err == nil, "%v", err)

	return newGenerator[[]byte](&regexpSliceGen{
		regexpGen{
			expr: expr,
			syn:  compiled.syn,
			re:   compiled.re,
		},
	})
}

type runeWriter interface {
	WriteRune(r rune) (int, error)
}

type regexpGen struct {
	expr string
	syn  *syntax.Regexp
	re   *regexp.Regexp
}
type regexpStringGen struct{ regexpGen }
type regexpSliceGen struct{ regexpGen }

func (g *regexpStringGen) String() string {
	return fmt.Sprintf("StringMatching(%q)", g.expr)
}
func (g *regexpSliceGen) String() string {
	return fmt.Sprintf("SliceOfBytesMatching(%q)", g.expr)
}

func (g *regexpStringGen) maybeString(t *T) (string, bool) {
	b := &strings.Builder{}
	g.build(b, g.syn, t)
	v := b.String()

	if g.re.MatchString(v) {
		return v, true
	} else {
		return "", false
	}
}

func (g *regexpSliceGen) maybeSlice(t *T) ([]byte, bool) {
	b := &bytes.Buffer{}
	g.build(b, g.syn, t)
	v := b.Bytes()

	if g.re.Match(v) {
		return v, true
	} else {
		return nil, false
	}
}

func (g *regexpStringGen) value(t *T) string {
	return find(g.maybeString, t, small)
}
func (g *regexpSliceGen) value(t *T) []byte {
	return find(g.maybeSlice, t, small)
}

func (g *regexpGen) build(w runeWriter, re *syntax.Regexp, t *T) {
	i := t.s.beginGroup(re.Op.String(), false)

	switch re.Op {
	case syntax.OpNoMatch:
		panic(invalidData("no possible regexp match"))
	case syntax.OpEmptyMatch:
		t.s.drawBits(0)
	case syntax.OpLiteral:
		t.s.drawBits(0)
		for _, r := range re.Rune {
			_, _ = w.WriteRune(maybeFoldCase(t.s, r, re.Flags))
		}
	case syntax.OpCharClass, syntax.OpAnyCharNotNL, syntax.OpAnyChar:
		sub := anyRuneGen
		switch re.Op {
		case syntax.OpCharClass:
			sub = charClassGen(re)
		case syntax.OpAnyCharNotNL:
			sub = anyRuneGenNoNL
		}
		r := sub.value(t)
		_, _ = w.WriteRune(maybeFoldCase(t.s, r, re.Flags))
	case syntax.OpBeginLine, syntax.OpEndLine,
		syntax.OpBeginText, syntax.OpEndText,
		syntax.OpWordBoundary, syntax.OpNoWordBoundary:
		t.s.drawBits(0) // do nothing and hope that find() is enough
	case syntax.OpCapture:
		g.build(w, re.Sub[0], t)
	case syntax.OpStar, syntax.OpPlus, syntax.OpQuest, syntax.OpRepeat:
		min, max := re.Min, re.Max
		switch re.Op {
		case syntax.OpStar:
			min, max = 0, -1
		case syntax.OpPlus:
			min, max = 1, -1
		case syntax.OpQuest:
			min, max = 0, 1
		}
		repeat := newRepeat(min, max, -1, regexpName(re.Sub[0]))
		for repeat.more(t.s) {
			g.build(w, re.Sub[0], t)
		}
	case syntax.OpConcat:
		for _, sub := range re.Sub {
			g.build(w, sub, t)
		}
	case syntax.OpAlternate:
		ix := genIndex(t.s, len(re.Sub), true)
		g.build(w, re.Sub[ix], t)
	default:
		assertf(false, "invalid regexp op %v", re.Op)
	}

	t.s.endGroup(i, false)
}

func maybeFoldCase(s bitStream, r rune, flags syntax.Flags) rune {
	n := uint64(0)
	if flags&syntax.FoldCase != 0 {
		n, _, _ = genUintN(s, 4, false)
	}

	for i := 0; i < int(n); i++ {
		r = unicode.SimpleFold(r)
	}

	return r
}

func expandRangeTable(t *unicode.RangeTable, key any) []rune {
	cached, ok := expandedTables.Load(key)
	if ok {
		return cached.([]rune)
	}

	n := 0
	for _, r := range t.R16 {
		n += int(r.Hi-r.Lo)/int(r.Stride) + 1
	}
	for _, r := range t.R32 {
		n += int(r.Hi-r.Lo)/int(r.Stride) + 1
	}

	ret := make([]rune, 0, n)
	for _, r := range t.R16 {
		for i := uint32(r.Lo); i <= uint32(r.Hi); i += uint32(r.Stride) {
			ret = append(ret, rune(i))
		}
	}
	for _, r := range t.R32 {
		for i := uint64(r.Lo); i <= uint64(r.Hi); i += uint64(r.Stride) {
			ret = append(ret, rune(i))
		}
	}
	expandedTables.Store(key, ret)

	return ret
}

func compileRegexp(expr string) (compiledRegexp, error) {
	cached, ok := compiledRegexps.Load(expr)
	if ok {
		return cached.(compiledRegexp), nil
	}

	syn, err := syntax.Parse(expr, syntax.Perl)
	if err != nil {
		return compiledRegexp{}, fmt.Errorf("failed to parse regexp %q: %v", expr, err)
	}

	re, err := regexp.Compile(expr)
	if err != nil {
		return compiledRegexp{}, fmt.Errorf("failed to compile regexp %q: %v", expr, err)
	}

	ret := compiledRegexp{syn, re}
	compiledRegexps.Store(expr, ret)

	return ret, nil
}

func regexpName(re *syntax.Regexp) string {
	cached, ok := regexpNames.Load(re)
	if ok {
		return cached.(string)
	}

	s := re.String()
	regexpNames.Store(re, s)

	return s
}

func charClassGen(re *syntax.Regexp) *Generator[rune] {
	cached, ok := charClassGens.Load(regexpName(re))
	if ok {
		return cached.(*Generator[rune])
	}

	t := &unicode.RangeTable{R32: make([]unicode.Range32, 0, len(re.Rune)/2)}
	for i := 0; i < len(re.Rune); i += 2 {
		// not a valid unicode.Range32, since it requires that Lo and Hi must always be >= 1<<16
		// however, we don't really care, since the only use of these ranges is as input to expandRangeTable
		t.R32 = append(t.R32, unicode.Range32{
			Lo:     uint32(re.Rune[i]),
			Hi:     uint32(re.Rune[i+1]),
			Stride: 1,
		})
	}

	g := newGenerator[rune](&runeGen{
		die:    newLoadedDie([]int{1}),
		tables: [][]rune{expandRangeTable(t, regexpName(re))},
	})
	charClassGens.Store(regexpName(re), g)

	return g
}
