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

package cue

import (
	"fmt"
	"math/bits"
	"strconv"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/astinternal"
	"cuelang.org/go/internal/core/adt"
	"github.com/cockroachdb/apd/v2"
)

// SelectorType represents the kind of a selector. It indicates both the label
// type as well as whether it is a constraint or an actual value.
type SelectorType uint16

const (
	// StringLabel represents a regular non-definition field.
	StringLabel SelectorType = 1 << iota
	// IndexLabel represents a numeric index into an array.
	IndexLabel
	// DefinitionLabel represents a definition.
	DefinitionLabel
	// HiddenLabel represents a hidden non-definition field.
	HiddenLabel
	// HiddenDefinitionLabel represents a hidden definition.
	HiddenDefinitionLabel

	// OptionalConstraint represents an optional constraint (?).
	OptionalConstraint
	// PatternConstraint represents a selector of fields in a struct
	// or array that match a constraint.
	PatternConstraint

	InvalidSelectorType SelectorType = 0
)

// LabelType reports the label type of t.
func (t SelectorType) LabelType() SelectorType {
	return t & 0b0001_1111
}

// ConstraintType reports the constraint type of t.
func (t SelectorType) ConstraintType() SelectorType {
	return t & 0b0110_0000
}

var selectorTypeStrings = [...]string{
	"InvalidSelectorType",
	"StringLabel",
	"IndexLabel",
	"DefinitionLabel",
	"HiddenLabel",
	"HiddenDefinitionLabel",
	"OptionalConstraint",
	"PatternConstraint",
}

func (t SelectorType) String() string {
	if t.LabelType() == 0 && t.ConstraintType() == 0 {
		return "NoLabels"
	}
	single := bits.OnesCount16(uint16(t)) == 1
	var buf strings.Builder
	for i := range selectorTypeStrings[:len(selectorTypeStrings)-1] {
		if t&(SelectorType(1)<<i) == 0 {
			continue
		}
		if single {
			return selectorTypeStrings[i+1]
		}
		if buf.Len() > 0 {
			buf.WriteByte('|')
		}
		buf.WriteString(selectorTypeStrings[i+1])
	}
	return buf.String()
}

// IsHidden reports whether t describes a hidden field, regardless of
// whether or not this is a constraint.
func (t SelectorType) IsHidden() bool {
	t = t.LabelType()
	return t == HiddenLabel || t == HiddenDefinitionLabel
}

// IsDefinition reports whether t describes a definition, regardless of
// whether or not this is a constraint.
func (t SelectorType) IsDefinition() bool {
	t = t.LabelType()
	return t == HiddenDefinitionLabel || t == DefinitionLabel
}

// A Selector is a component of a path.
type Selector struct {
	sel selector
}

// String reports the CUE representation of a selector.
func (sel Selector) String() string {
	return sel.sel.String()
}

// Unquoted returns the unquoted value of a string label.
// It panics unless sel.LabelType is StringLabel and has a concrete name.
func (sel Selector) Unquoted() string {
	if sel.LabelType() != StringLabel ||
		sel.ConstraintType() >= PatternConstraint {
		panic("Selector.Unquoted invoked on non-string label")
	}
	switch s := sel.sel.(type) {
	case stringSelector:
		return string(s)
	case optionalSelector:
		return string(s.selector.(stringSelector))
	}
	panic(fmt.Sprintf("unreachable %T", sel.sel))
}

// IsConstraint reports whether s is optional or a pattern constraint.
// Fields that are constraints are considered non-existing and their
// values may be erroneous for a configuration to be valid..
func (sel Selector) IsConstraint() bool {
	return sel.Type().ConstraintType() != 0
}

// IsString reports whether sel represents an optional or regular member field.
func (sel Selector) IsString() bool {
	// TODO: consider deprecating this method. It is a bit wonkey now.
	t := sel.Type()
	t &^= OptionalConstraint
	return t == StringLabel
}

// IsDefinition reports whether sel is a non-hidden definition and non-constraint label type.
func (sel Selector) IsDefinition() bool {
	return sel.Type().IsDefinition()
}

// Type returns the type of the selector.
func (sel Selector) Type() SelectorType {
	return sel.sel.labelType() | sel.sel.constraintType()
}

// LabelType returns the type of the label part of a selector.
func (sel Selector) LabelType() SelectorType {
	return sel.sel.labelType()
}

// ConstraintType returns the type of the constraint part of a selector.
func (sel Selector) ConstraintType() SelectorType {
	return sel.sel.constraintType()
}

// PkgPath reports the package path associated with a hidden label or "" if
// this is not a hidden label.
func (sel Selector) PkgPath() string {
	s, _ := sel.sel.(scopedSelector)
	return s.pkg
}

// Index returns the index of the selector. It panics
// unless sel.Type is SelIndex.
func (sel Selector) Index() int {
	s, ok := sel.sel.(indexSelector)
	if !ok {
		panic("Index called on non-index selector")
	}
	return adt.Feature(s).Index()
}

var (

	// AnyDefinition can be used to ask for any definition.
	//
	// In paths it is used to select constraints that apply to all elements.
	// AnyDefinition = anyDefinition
	anyDefinition = Selector{sel: anySelector(adt.AnyDefinition)}
	// AnyIndex can be used to ask for any index.
	//
	// In paths it is used to select constraints that apply to all elements.
	AnyIndex = anyIndex
	anyIndex = Selector{sel: anySelector(adt.AnyIndex)}

	// AnyString can be used to ask for any regular string field.
	//
	// In paths it is used to select constraints that apply to all elements.
	AnyString = anyString
	anyString = Selector{sel: anySelector(adt.AnyString)}
)

// Optional converts sel into an optional equivalent.
// It's a no-op if the selector is already optional.
//
//	foo -> foo?
func (sel Selector) Optional() Selector {
	return wrapOptional(sel)
}

type selector interface {
	String() string

	feature(ctx adt.Runtime) adt.Feature
	labelType() SelectorType
	constraintType() SelectorType
	optional() bool
}

// A Path is series of selectors to query a CUE value.
type Path struct {
	path []Selector
}

// MakePath creates a Path from a sequence of selectors.
func MakePath(selectors ...Selector) Path {
	return Path{path: selectors}
}

// pathToString is a utility function for creating debugging info.
func pathToStrings(p Path) (a []string) {
	for _, sel := range p.Selectors() {
		a = append(a, sel.String())
	}
	return a
}

// ParsePath parses a CUE expression into a Path. Any error resulting from
// this conversion can be obtained by calling Err on the result.
//
// Unlike with normal CUE expressions, the first element of the path may be
// a string literal.
//
// A path may not contain hidden fields. To create a path with hidden fields,
// use MakePath and Ident.
func ParsePath(s string) Path {
	if s == "" {
		return Path{}
	}
	expr, err := parser.ParseExpr("", s)
	if err != nil {
		return MakePath(Selector{pathError{errors.Promote(err, "invalid path")}})
	}

	p := Path{path: toSelectors(expr)}
	for _, sel := range p.path {
		if sel.Type().IsHidden() {
			return MakePath(Selector{pathError{errors.Newf(token.NoPos,
				"invalid path: hidden fields not allowed in path %s", s)}})
		}
	}
	return p
}

// Selectors reports the individual selectors of a path.
func (p Path) Selectors() []Selector {
	return p.path
}

// String reports the CUE representation of p.
func (p Path) String() string {
	if err := p.Err(); err != nil {
		return "_|_"
	}

	b := &strings.Builder{}
	for i, sel := range p.path {
		switch {
		case sel.Type() == IndexLabel:
			// TODO: use '.' in all cases, once supported.
			b.WriteByte('[')
			b.WriteString(sel.sel.String())
			b.WriteByte(']')
			continue
		case i > 0:
			b.WriteByte('.')
		}

		b.WriteString(sel.sel.String())
	}
	return b.String()
}

// Optional returns the optional form of a Path. For instance,
//
//	foo.bar  --> foo?.bar?
func (p Path) Optional() Path {
	q := make([]Selector, 0, len(p.path))
	for _, s := range p.path {
		q = appendSelector(q, wrapOptional(s))
	}
	return Path{path: q}
}

func toSelectors(expr ast.Expr) []Selector {
	switch x := expr.(type) {
	case *ast.Ident:
		return []Selector{Label(x)}

	case *ast.BasicLit:
		return []Selector{basicLitSelector(x)}

	case *ast.IndexExpr:
		a := toSelectors(x.X)
		var sel Selector
		if b, ok := x.Index.(*ast.BasicLit); !ok {
			sel = Selector{pathError{
				errors.Newf(token.NoPos, "non-constant expression %s",
					astinternal.DebugStr(x.Index))}}
		} else {
			sel = basicLitSelector(b)
		}
		return appendSelector(a, sel)

	case *ast.SelectorExpr:
		a := toSelectors(x.X)
		return appendSelector(a, Label(x.Sel))

	default:
		return []Selector{{pathError{
			errors.Newf(token.NoPos, "invalid label %s ", astinternal.DebugStr(x)),
		}}}
	}
}

// appendSelector is like append(a, sel), except that it collects errors
// in a one-element slice.
func appendSelector(a []Selector, sel Selector) []Selector {
	err, isErr := sel.sel.(pathError)
	if len(a) == 1 {
		if p, ok := a[0].sel.(pathError); ok {
			if isErr {
				p.Error = errors.Append(p.Error, err.Error)
			}
			return a
		}
	}
	if isErr {
		return []Selector{sel}
	}
	return append(a, sel)
}

func basicLitSelector(b *ast.BasicLit) Selector {
	switch b.Kind {
	case token.INT:
		var n literal.NumInfo
		if err := literal.ParseNum(b.Value, &n); err != nil {
			return Selector{pathError{
				errors.Newf(token.NoPos, "invalid string index %s", b.Value),
			}}
		}
		var d apd.Decimal
		_ = n.Decimal(&d)
		i, err := d.Int64()
		if err != nil {
			return Selector{pathError{
				errors.Newf(token.NoPos, "integer %s out of range", b.Value),
			}}
		}
		return Index(int(i))

	case token.STRING:
		info, _, _, _ := literal.ParseQuotes(b.Value, b.Value)
		if !info.IsDouble() {
			return Selector{pathError{
				errors.Newf(token.NoPos, "invalid string index %s", b.Value)}}
		}
		s, _ := literal.Unquote(b.Value)
		return Selector{stringSelector(s)}

	default:
		return Selector{pathError{
			errors.Newf(token.NoPos, "invalid literal %s", b.Value),
		}}
	}
}

// Label converts an AST label to a Selector.
func Label(label ast.Label) Selector {
	switch x := label.(type) {
	case *ast.Ident:
		switch s := x.Name; {
		case strings.HasPrefix(s, "_"):
			// TODO: extract package from a bound identifier.
			return Selector{pathError{errors.Newf(token.NoPos,
				"invalid path: hidden label %s not allowed", s),
			}}
		case strings.HasPrefix(s, "#"):
			return Selector{definitionSelector(x.Name)}
		default:
			return Selector{stringSelector(x.Name)}
		}

	case *ast.BasicLit:
		return basicLitSelector(x)

	default:
		return Selector{pathError{
			errors.Newf(token.NoPos, "invalid label %s ", astinternal.DebugStr(x)),
		}}
	}
}

// Err reports errors that occurred when generating the path.
func (p Path) Err() error {
	var errs errors.Error
	for _, x := range p.path {
		if err, ok := x.sel.(pathError); ok {
			errs = errors.Append(errs, err.Error)
		}
	}
	return errs
}

func isHiddenOrDefinition(s string) bool {
	return strings.HasPrefix(s, "#") || strings.HasPrefix(s, "_")
}

// Hid returns a selector for a hidden field. It panics is pkg is empty.
// Hidden fields are scoped by package, and pkg indicates for which package
// the hidden field must apply.For anonymous packages, it must be set to "_".
func Hid(name, pkg string) Selector {
	if !ast.IsValidIdent(name) {
		panic(fmt.Sprintf("invalid identifier %s", name))
	}
	if !strings.HasPrefix(name, "_") {
		panic(fmt.Sprintf("%s is not a hidden field identifier", name))
	}
	if pkg == "" {
		panic(fmt.Sprintf("missing package for hidden identifier %s", name))
	}
	return Selector{scopedSelector{name, pkg}}
}

type scopedSelector struct {
	name, pkg string
}

// String returns the CUE representation of the definition.
func (s scopedSelector) String() string {
	return s.name
}
func (scopedSelector) optional() bool { return false }

func (s scopedSelector) labelType() SelectorType {
	if strings.HasPrefix(s.name, "_#") {
		return HiddenDefinitionLabel
	}
	return HiddenLabel
}
func (s scopedSelector) constraintType() SelectorType { return 0 }

func (s scopedSelector) feature(r adt.Runtime) adt.Feature {
	return adt.MakeIdentLabel(r, s.name, s.pkg)
}

// A Def marks a string as a definition label. An # will be added if a string is
// not prefixed with a #. It will panic if s cannot be written as a valid
// identifier.
func Def(s string) Selector {
	if !strings.HasPrefix(s, "#") && !strings.HasPrefix(s, "_#") {
		s = "#" + s
	}
	if !ast.IsValidIdent(s) {
		panic(fmt.Sprintf("invalid definition %s", s))
	}
	return Selector{definitionSelector(s)}
}

type definitionSelector string

// String returns the CUE representation of the definition.
func (d definitionSelector) String() string {
	return string(d)
}

func (d definitionSelector) optional() bool { return false }

func (d definitionSelector) labelType() SelectorType {
	return DefinitionLabel
}

func (s definitionSelector) constraintType() SelectorType { return 0 }

func (d definitionSelector) feature(r adt.Runtime) adt.Feature {
	return adt.MakeIdentLabel(r, string(d), "")
}

// A Str is a CUE string label. Definition selectors are defined with Def.
func Str(s string) Selector {
	return Selector{stringSelector(s)}
}

type stringSelector string

func (s stringSelector) String() string {
	str := string(s)
	if isHiddenOrDefinition(str) || !ast.IsValidIdent(str) {
		return literal.Label.Quote(str)
	}
	return str
}

func (s stringSelector) optional() bool               { return false }
func (s stringSelector) labelType() SelectorType      { return StringLabel }
func (s stringSelector) constraintType() SelectorType { return 0 }

func (s stringSelector) feature(r adt.Runtime) adt.Feature {
	return adt.MakeStringLabel(r, string(s))
}

// An Index selects a list element by index.
func Index(x int) Selector {
	f, err := adt.MakeLabel(nil, int64(x), adt.IntLabel)
	if err != nil {
		return Selector{pathError{err}}
	}
	return Selector{indexSelector(f)}
}

type indexSelector adt.Feature

func (s indexSelector) String() string {
	return strconv.Itoa(adt.Feature(s).Index())
}

func (s indexSelector) labelType() SelectorType      { return IndexLabel }
func (s indexSelector) constraintType() SelectorType { return 0 }

func (s indexSelector) optional() bool { return false }

func (s indexSelector) feature(r adt.Runtime) adt.Feature {
	return adt.Feature(s)
}

// an anySelector represents a wildcard option of a particular type.
type anySelector adt.Feature

func (s anySelector) String() string { return "[_]" }
func (s anySelector) optional() bool { return true }
func (s anySelector) labelType() SelectorType {
	// FeatureTypes are numbered sequentially. SelectorType is a bitmap. As they
	// are defined in the same order, we can go from FeatureType to SelectorType
	// by left shifting. As valid FeatureTypes starts at 1, we need to end with
	// a final right shift.
	return SelectorType((1 << adt.Feature(s).Typ()) >> 1)
}
func (s anySelector) constraintType() SelectorType { return PatternConstraint }

func (s anySelector) feature(r adt.Runtime) adt.Feature {
	return adt.Feature(s)
}

// TODO: allow import paths to be represented?
//
// // ImportPath defines a lookup at the root of an instance. It must be the first
// // element of a Path.
//
//	func ImportPath(s string) Selector {
//		return importSelector(s)
//	}
type optionalSelector struct {
	selector
}

func (s optionalSelector) labelType() SelectorType {
	return s.selector.labelType()
}

func (s optionalSelector) constraintType() SelectorType {
	return OptionalConstraint
}

func wrapOptional(sel Selector) Selector {
	if !sel.sel.optional() {
		sel = Selector{optionalSelector{sel.sel}}
	}
	return sel
}

// func isOptional(sel selector) bool {
// 	_, ok := sel.(optionalSelector)
// 	return ok
// }

func (s optionalSelector) optional() bool { return true }

func (s optionalSelector) String() string {
	return s.selector.String() + "?"
}

// TODO: allow looking up in parent scopes?

// // Parent returns a Selector for looking up in the parent of a current node.
// // Parent selectors may only occur at the start of a Path.
// func Parent() Selector {
// 	return parentSelector{}
// }

// type parentSelector struct{}

// func (p parentSelector) String() string { return "__up" }
// func (p parentSelector) feature(r adt.Runtime) adt.Feature {
// 	return adt.InvalidLabel
// }

type pathError struct {
	errors.Error
}

func (p pathError) String() string               { return "" }
func (p pathError) optional() bool               { return false }
func (p pathError) labelType() SelectorType      { return InvalidSelectorType }
func (p pathError) constraintType() SelectorType { return 0 }
func (p pathError) feature(r adt.Runtime) adt.Feature {
	return adt.InvalidLabel
}

func valueToSel(v adt.Value) Selector {
	switch x := adt.Unwrap(v).(type) {
	case *adt.Num:
		i, err := x.X.Int64()
		if err != nil {
			return Selector{&pathError{errors.Promote(err, "invalid number")}}
		}
		return Index(int(i))
	case *adt.String:
		return Str(x.Str)
	default:
		return Selector{pathError{errors.Newf(token.NoPos, "dynamic selector")}}
	}
}

func featureToSel(f adt.Feature, r adt.Runtime) Selector {
	switch f.Typ() {
	case adt.StringLabel:
		return Str(f.StringValue(r))
	case adt.IntLabel:
		return Index(f.Index())
	case adt.DefinitionLabel:
		return Def(f.IdentString(r))
	case adt.HiddenLabel, adt.HiddenDefinitionLabel:
		ident := f.IdentString(r)
		pkg := f.PkgID(r)
		return Hid(ident, pkg)
	}
	return Selector{pathError{
		errors.Newf(token.NoPos, "unexpected feature type %v", f.Typ()),
	}}
}
