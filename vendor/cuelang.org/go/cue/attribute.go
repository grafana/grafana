// Copyright 2021 CUE Authors
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

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/export"
)

// Attribute returns the attribute data for the given key.
// The returned attribute will return an error for any of its methods if there
// is no attribute for the requested key.
func (v Value) Attribute(key string) Attribute {
	// look up the attributes
	if v.v == nil {
		return nonExistAttr(key)
	}
	// look up the attributes
	for _, a := range export.ExtractFieldAttrs(v.v) {
		k, _ := a.Split()
		if key != k {
			continue
		}
		return newAttr(internal.FieldAttr, a)
	}

	return nonExistAttr(key)
}

func newAttr(k internal.AttrKind, a *ast.Attribute) Attribute {
	key, body := a.Split()
	x := internal.ParseAttrBody(token.NoPos, body)
	x.Name = key
	x.Kind = k
	return Attribute{x}
}

func nonExistAttr(key string) Attribute {
	a := internal.NewNonExisting(key)
	a.Name = key
	a.Kind = internal.FieldAttr
	return Attribute{a}
}

// Attributes reports all field attributes for the Value.
//
// To retrieve attributes of multiple kinds, you can bitwise-or kinds together.
// Use ValueKind to query attributes associated with a value.
func (v Value) Attributes(mask AttrKind) []Attribute {
	if v.v == nil {
		return nil
	}

	attrs := []Attribute{}

	if mask&FieldAttr != 0 {
		for _, a := range export.ExtractFieldAttrs(v.v) {
			attrs = append(attrs, newAttr(internal.FieldAttr, a))
		}
	}

	if mask&DeclAttr != 0 {
		for _, a := range export.ExtractDeclAttrs(v.v) {
			attrs = append(attrs, newAttr(internal.DeclAttr, a))
		}
	}

	return attrs
}

// AttrKind indicates the location of an attribute within CUE source.
type AttrKind int

const (
	// FieldAttr indicates a field attribute.
	// foo: bar @attr()
	FieldAttr AttrKind = AttrKind(internal.FieldAttr)

	// DeclAttr indicates a declaration attribute.
	// foo: {
	//     @attr()
	// }
	DeclAttr AttrKind = AttrKind(internal.DeclAttr)

	// A ValueAttr is a bit mask to request any attribute that is locally
	// associated with a field, instead of, for instance, an entire file.
	ValueAttr AttrKind = FieldAttr | DeclAttr

	// TODO: Possible future attr kinds
	// ElemAttr (is a ValueAttr)
	// FileAttr (not a ValueAttr)

	// TODO: Merge: merge namesake attributes.
)

// An Attribute contains meta data about a field.
type Attribute struct {
	attr internal.Attr
}

// Format implements fmt.Formatter.
func (a Attribute) Format(w fmt.State, verb rune) {
	fmt.Fprintf(w, "@%s(%s)", a.attr.Name, a.attr.Body)
}

var _ fmt.Formatter = &Attribute{}

// Name returns the name of the attribute, for instance, "json" for @json(...).
func (a *Attribute) Name() string {
	return a.attr.Name
}

// Contents reports the full contents of an attribute within parentheses, so
// contents in @attr(contents).
func (a *Attribute) Contents() string {
	return a.attr.Body
}

// NumArgs reports the number of arguments parsed for this attribute.
func (a *Attribute) NumArgs() int {
	return len(a.attr.Fields)
}

// Arg reports the contents of the ith comma-separated argument of a.
//
// If the argument contains an unescaped equals sign, it returns a key-value
// pair. Otherwise it returns the contents in value.
func (a *Attribute) Arg(i int) (key, value string) {
	f := a.attr.Fields[i]
	return f.Key(), f.Value()
}

// RawArg reports the raw contents of the ith comma-separated argument of a,
// including surrounding spaces.
func (a *Attribute) RawArg(i int) string {
	return a.attr.Fields[i].Text()
}

// Kind reports the type of location within CUE source where the attribute
// was specified.
func (a *Attribute) Kind() AttrKind {
	return AttrKind(a.attr.Kind)
}

// Err returns the error associated with this Attribute or nil if this
// attribute is valid.
func (a *Attribute) Err() error {
	return a.attr.Err
}

// String reports the possibly empty string value at the given position or
// an error the attribute is invalid or if the position does not exist.
func (a *Attribute) String(pos int) (string, error) {
	return a.attr.String(pos)
}

// Int reports the integer at the given position or an error if the attribute is
// invalid, the position does not exist, or the value at the given position is
// not an integer.
func (a *Attribute) Int(pos int) (int64, error) {
	return a.attr.Int(pos)
}

// Flag reports whether an entry with the given name exists at position pos or
// onwards or an error if the attribute is invalid or if the first pos-1 entries
// are not defined.
func (a *Attribute) Flag(pos int, key string) (bool, error) {
	return a.attr.Flag(pos, key)
}

// Lookup searches for an entry of the form key=value from position pos onwards
// and reports the value if found. It reports an error if the attribute is
// invalid or if the first pos-1 entries are not defined.
func (a *Attribute) Lookup(pos int, key string) (val string, found bool, err error) {
	val, found, err = a.attr.Lookup(pos, key)

	// TODO: remove at some point. This is an ugly hack to simulate the old
	// behavior of protobufs.
	if !found && a.attr.Name == "protobuf" && key == "type" {
		val, err = a.String(1)
		found = err == nil
	}
	return val, found, err
}
