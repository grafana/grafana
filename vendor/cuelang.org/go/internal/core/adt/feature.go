// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package adt

import (
	"fmt"
	"strconv"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

// A Feature is an encoded form of a label which comprises a compact
// representation of an integer or string label as well as a label type.
type Feature uint32

// TODO: create labels such that list are sorted first (or last with index.)

// InvalidLabel is an encoding of an erroneous label.
const (
	InvalidLabel Feature = 0

	// MaxIndex indicates the maximum number of unique strings that are used for
	// labels within this CUE implementation.
	MaxIndex = 1<<(32-indexShift) - 1
)

// These labels can be used for wildcard queries.
var (
	AnyDefinition Feature = makeLabel(MaxIndex, DefinitionLabel)
	AnyHidden     Feature = makeLabel(MaxIndex, HiddenLabel)
	AnyString     Feature = makeLabel(MaxIndex, StringLabel)
	AnyIndex      Feature = makeLabel(MaxIndex, IntLabel)
)

// A StringIndexer coverts strings to and from an index that is unique for a
// given string.
type StringIndexer interface {
	// ToIndex returns a unique positive index for s (0 < index < 2^28-1).
	//
	// For each pair of strings s and t it must return the same index if and
	// only if s == t.
	StringToIndex(s string) (index int64)

	// ToString returns a string s for index such that ToIndex(s) == index.
	IndexToString(index int64) string

	// NextUniqueID returns a new unique identifier.
	NextUniqueID() uint64
}

// SelectorString reports the shortest string representation of f when used as a
// selector.
func (f Feature) SelectorString(index StringIndexer) string {
	x := f.safeIndex()
	switch f.Typ() {
	case IntLabel:
		if f == AnyIndex {
			return "_"
		}
		return strconv.Itoa(int(x))
	case StringLabel:
		s := index.IndexToString(x)
		if ast.IsValidIdent(s) && !internal.IsDefOrHidden(s) {
			return s
		}
		if f == AnyString {
			return "_"
		}
		return literal.String.Quote(s)
	default:
		return f.IdentString(index)
	}
}

// IdentString reports the identifier of f. The result is undefined if f
// is not an identifier label.
func (f Feature) IdentString(index StringIndexer) string {
	s := index.IndexToString(f.safeIndex())
	if f.IsHidden() || f.IsLet() {
		if p := strings.IndexByte(s, '\x00'); p >= 0 {
			s = s[:p]
		}
	}
	return s
}

// PkgID returns the package identifier, composed of the module and package
// name, associated with this identifier. It will return "" if this is not
// a hidden label.
func (f Feature) PkgID(index StringIndexer) string {
	if !f.IsHidden() {
		return ""
	}
	s := index.IndexToString(f.safeIndex())
	if p := strings.IndexByte(s, '\x00'); p >= 0 {
		s = s[p+1:]
	}
	return s
}

// StringValue reports the string value of f, which must be a string label.
func (f Feature) StringValue(index StringIndexer) string {
	if !f.IsString() {
		panic("not a string label")
	}
	x := f.safeIndex()
	return index.IndexToString(x)
}

// RawString reports the underlying string value of f without interpretation.
func (f Feature) RawString(index StringIndexer) string {
	x := f.safeIndex()
	return index.IndexToString(x)
}

// ToValue converts a label to a value, which will be a Num for integer labels
// and a String for string labels. It panics when f is not a regular label.
func (f Feature) ToValue(ctx *OpContext) Value {
	if !f.IsRegular() {
		panic("not a regular label")
	}
	// TODO: Handle special regular values: invalid and AnyRegular.
	if f.IsInt() {
		return ctx.NewInt64(int64(f.Index()))
	}
	x := f.safeIndex()
	str := ctx.IndexToString(x)
	return ctx.NewString(str)
}

// StringLabel converts s to a string label.
func (c *OpContext) StringLabel(s string) Feature {
	return labelFromValue(c, nil, &String{Str: s})
}

// MakeStringLabel creates a label for the given string.
func MakeStringLabel(r StringIndexer, s string) Feature {
	i := r.StringToIndex(s)

	// TODO: set position if it exists.
	f, err := MakeLabel(nil, i, StringLabel)
	if err != nil {
		panic("out of free string slots")
	}
	return f
}

// MakeIdentLabel creates a label for the given identifier.
func MakeIdentLabel(r StringIndexer, s, pkgpath string) Feature {
	t := StringLabel
	switch {
	case strings.HasPrefix(s, "_#"):
		t = HiddenDefinitionLabel
		s = HiddenKey(s, pkgpath)
	case strings.HasPrefix(s, "#"):
		t = DefinitionLabel
	case strings.HasPrefix(s, "_"):
		s = HiddenKey(s, pkgpath)
		t = HiddenLabel
	}
	i := r.StringToIndex(s)
	f, err := MakeLabel(nil, i, t)
	if err != nil {
		panic("out of free string slots")
	}
	return f
}

// HiddenKey constructs the uniquely identifying string for a hidden fields and
// its package.
func HiddenKey(s, pkgPath string) string {
	// TODO: Consider just using space instead of \x00.
	return fmt.Sprintf("%s\x00%s", s, pkgPath)
}

// MakeNamedLabel creates a feature for the given name and feature type.
func MakeNamedLabel(r StringIndexer, t FeatureType, s string) Feature {
	i := r.StringToIndex(s)
	f, err := MakeLabel(nil, i, t)
	if err != nil {
		panic("out of free string slots")
	}
	return f
}

// MakeLetLabel creates a label for the given let identifier s.
//
// A let declaration is always logically unique within its scope and will never
// unify with a let field of another struct. This is enforced by ensuring that
// the let identifier is unique across an entire configuration. This, in turn,
// is done by adding a unique number to each let identifier.
func MakeLetLabel(r StringIndexer, s string) Feature {
	id := r.NextUniqueID()
	s = fmt.Sprintf("%s\x00%X", s, id)
	i := r.StringToIndex(s)
	f, err := MakeLabel(nil, i, LetLabel)
	if err != nil {
		panic("out of free string slots")
	}
	return f
}

// MakeIntLabel creates an integer label.
func MakeIntLabel(t FeatureType, i int64) Feature {
	f, err := MakeLabel(nil, i, t)
	if err != nil {
		panic("index out of range")
	}
	return f
}

const msgGround = "invalid non-ground value %s (must be concrete %s)"

func labelFromValue(c *OpContext, src Expr, v Value) Feature {
	v, _ = c.getDefault(v)

	var i int64
	var t FeatureType
	if isError(v) {
		return InvalidLabel
	}
	switch v.Kind() {
	case IntKind, NumKind:
		x, _ := Unwrap(v).(*Num)
		if x == nil {
			c.addErrf(IncompleteError, pos(v), msgGround, v, "int")
			return InvalidLabel
		}
		t = IntLabel
		var err error
		i, err = x.X.Int64()
		if err != nil || x.K != IntKind {
			if src == nil {
				src = v
			}
			c.AddErrf("invalid index %v: %v", src, err)
			return InvalidLabel
		}
		if i < 0 {
			switch src.(type) {
			case nil, *Num, *UnaryExpr:
				// If the value is a constant, we know it is always an error.
				// UnaryExpr is an approximation for a constant value here.
				c.AddErrf("invalid index %s (index must be non-negative)", x)
			default:
				// Use a different message is it is the result of evaluation.
				c.AddErrf("index %s out of range [%s]", src, x)
			}
			return InvalidLabel
		}

	case StringKind:
		x, _ := Unwrap(v).(*String)
		if x == nil {
			c.addErrf(IncompleteError, pos(v), msgGround, v, "string")
			return InvalidLabel
		}
		t = StringLabel
		i = c.StringToIndex(x.Str)

	default:
		if src != nil {
			c.AddErrf("invalid index %s (invalid type %v)", src, v.Kind())
		} else {
			c.AddErrf("invalid index type %v", v.Kind())
		}
		return InvalidLabel
	}

	// TODO: set position if it exists.
	f, err := MakeLabel(nil, i, t)
	if err != nil {
		c.AddErr(err)
	}
	return f
}

// MakeLabel creates a label. It reports an error if the index is out of range.
func MakeLabel(src ast.Node, index int64, f FeatureType) (Feature, errors.Error) {
	if 0 > index || index > MaxIndex-1 {
		p := token.NoPos
		if src != nil {
			p = src.Pos()
		}
		return InvalidLabel,
			errors.Newf(p, "int label out of range (%d not >=0 and <= %d)",
				index, MaxIndex-1)
	}
	return Feature(index)<<indexShift | Feature(f), nil
}

func makeLabel(index int64, f FeatureType) Feature {
	return Feature(index)<<indexShift | Feature(f)
}

// A FeatureType indicates the type of label.
type FeatureType int8

const (
	InvalidLabelType FeatureType = iota
	StringLabel
	IntLabel
	DefinitionLabel
	HiddenLabel
	HiddenDefinitionLabel
	LetLabel
)

const (
	fTypeMask Feature = 0b1111

	indexShift = 4
)

func (f FeatureType) IsDef() bool {
	return f == DefinitionLabel || f == HiddenDefinitionLabel
}

func (f FeatureType) IsHidden() bool {
	return f == HiddenLabel || f == HiddenDefinitionLabel
}

func (f FeatureType) IsLet() bool {
	return f == LetLabel
}

// IsValid reports whether f is a valid label.
func (f Feature) IsValid() bool { return f != InvalidLabel }

// Typ reports the type of label.
func (f Feature) Typ() FeatureType { return FeatureType(f & fTypeMask) }

// IsRegular reports whether a label represents a data field.
func (f Feature) IsRegular() bool {
	t := f.Typ()
	return t == IntLabel || t == StringLabel
}

// IsString reports whether a label represents a regular field.
func (f Feature) IsString() bool { return f.Typ() == StringLabel }

// IsDef reports whether the label is a definition (an identifier starting with
// # or _#.
func (f Feature) IsDef() bool {
	return f.Typ().IsDef()
}

// IsInt reports whether this is an integer index.
func (f Feature) IsInt() bool { return f.Typ() == IntLabel }

// IsHidden reports whether this label is hidden (an identifier starting with
// _ or #_).
func (f Feature) IsHidden() bool {
	return f.Typ().IsHidden()
}

// IsLet reports whether this label is a let field (like `let X = value`).
func (f Feature) IsLet() bool {
	return f.Typ().IsLet()
}

// Index reports the abstract index associated with f.
func (f Feature) Index() int {
	return int(f >> indexShift)
}

// SafeIndex reports the abstract index associated with f, setting MaxIndex to 0.
func (f Feature) safeIndex() int64 {
	x := int(f >> indexShift)
	if x == MaxIndex {
		x = 0 // Safety, MaxIndex means any
	}
	return int64(x)
}

// TODO: should let declarations be implemented as fields?
// func (f Feature) isLet() bool  { return f.typ() == letLabel }
