// Copyright 2018 The CUE Authors
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
	"math/bits"
	"strings"
)

// Concreteness is a measure of the level of concreteness of a value, where
// lower values mean more concrete.
type Concreteness int

const (
	BottomLevel Concreteness = iota

	// Concrete indicates a concrete scalar value, list or struct.
	Concrete

	// Constraint indicates a non-concrete scalar value that is more specific,
	// than a top-level type.
	Constraint

	// PrimitiveType indicates a top-level specific type, for instance, string,
	// bytes, number, or bool.
	Type

	// Any indicates any value, or top.
	Any
)

// IsConcrete returns whether a value is concrete.
func IsConcrete(v Value) bool {
	if x, ok := v.(*Vertex); ok {
		return x.IsConcrete()
	}
	if v == nil {
		return false
	}
	return v.Concreteness() <= Concrete
}

// Kind reports the Value kind.
type Kind uint16

const (
	NullKind Kind = (1 << iota)
	BoolKind
	IntKind
	FloatKind
	StringKind
	BytesKind
	FuncKind
	ListKind
	StructKind

	allKinds

	_numberKind

	NumberKind = IntKind | FloatKind

	BottomKind Kind = 0

	NumKind          = IntKind | FloatKind
	TopKind     Kind = (allKinds - 1) // all kinds, but not references
	ScalarKinds      = NullKind | BoolKind |
		IntKind | FloatKind | StringKind | BytesKind

	CompositKind = StructKind | ListKind
)

func kind(v Value) Kind {
	if v == nil {
		return BottomKind
	}
	return v.Kind()
}

// IsAnyOf reports whether k is any of the given kinds.
//
// For instances, k.IsAnyOf(String|Bytes) reports whether k overlaps with
// the String or Bytes kind.
func (k Kind) IsAnyOf(of Kind) bool {
	return k&of != BottomKind
}

// CanString reports whether the given type can convert to a string.
func (k Kind) CanString() bool {
	return k&StringKind|ScalarKinds != BottomKind
}

// String returns the representation of the Kind as
// a CUE expression. For example:
//
//	(IntKind|ListKind).String()
//
// will return:
//
//	(int|[...])
func (k Kind) String() string {
	return toString(k, kindStrs)
}

// TypeString is like String, but returns a string representation of a valid
// CUE type.
func (k Kind) TypeString() string {
	return toString(k, typeStrs)
}

func toString(k Kind, m map[Kind]string) string {
	if k == BottomKind {
		return "_|_"
	}
	if k == TopKind {
		return "_"
	}
	if (k & NumberKind) == NumberKind {
		k = (k &^ NumberKind) | _numberKind
	}
	var buf strings.Builder
	multiple := bits.OnesCount(uint(k)) > 1
	if multiple {
		buf.WriteByte('(')
	}
	for count := 0; ; count++ {
		n := bits.TrailingZeros(uint(k))
		if n == bits.UintSize {
			break
		}
		bit := Kind(1 << uint(n))
		k &^= bit
		s, ok := m[bit]
		if !ok {
			s = fmt.Sprintf("bad(%d)", n)
		}
		if count > 0 {
			buf.WriteByte('|')
		}
		buf.WriteString(s)
	}
	if multiple {
		buf.WriteByte(')')
	}
	return buf.String()
}

var kindStrs = map[Kind]string{
	NullKind:    "null",
	BoolKind:    "bool",
	IntKind:     "int",
	FloatKind:   "float",
	StringKind:  "string",
	BytesKind:   "bytes",
	FuncKind:    "func",
	StructKind:  "struct",
	ListKind:    "list",
	_numberKind: "number",
}

// used to generate a parseable CUE type.
var typeStrs = map[Kind]string{
	NullKind:    "null",
	BoolKind:    "bool",
	IntKind:     "int",
	FloatKind:   "float",
	StringKind:  "string",
	BytesKind:   "bytes",
	FuncKind:    "_",
	StructKind:  "{...}",
	ListKind:    "[...]",
	_numberKind: "number",
}
