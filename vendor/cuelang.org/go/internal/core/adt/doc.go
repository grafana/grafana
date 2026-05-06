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

// Package adt represents partially and fully evaluated CUE types.
//
// This package introduces several categories of types that indicate some set of
// values that may be used in a certain situation. Concrete types may belong to
// multiple categories.
//
// # Abstract Types
//
// The following types describe the a place where a value may be used:
//
//	Decl       a value than can be used as a StructLit element.
//	Elem       a value than can be used as a ListLit element.
//	Expr       represents an Expr in the CUE grammar.
//	Value      a fully evaluated value that has no references (except for
//	           children in composite values).
//	Node       any of the above values.
//
// The following types categorize nodes by function:
//
//	Resolver   a reference to position in the result tree.
//	Evaluator  evaluates to 1 value.
//	Yielder    evaluates to 0 or more values.
//	Validator  validates another value.
//
// # Reference resolution algorithm
//
// A Resolver is resolved within the context of an Environment. In CUE, a
// reference is evaluated by substituting it with a copy of the value to which
// it refers. If the copied value itself contains references we can distinguish
// two different cases. References that refer to values within the copied
// reference (not regarding selectors) will henceforth point to the copied node.
// References that point to outside the referened value will keep referring to
// their original value.
//
//	a: b: {
//	  c: int
//	  d: c
//	  e: f
//	}
//	f: 4
//	g: a.b { // d.c points to inside the referred value, e.f, not.
//	  c: 3
//	}
//
// The implementation doesn't actually copy referred values, but rather resolves
// references with the aid of an Environment. During compile time, each
// references is associated with the label and a number indicating in which
// parent scope (offset from the current) this label needs to be looked up. An
// Environment keeps track of the point at which a value was referenced,
// providing enough information to look up the labeled value. This Environment
// is the identical for all references within a fields conjunct. Often, an
// Environment can even be shared among conjuncts.
//
// # Values
//
// Values are fully evaluated expressions. As this means that all references
// will have been eliminated, Values are fully defined without the need for an
// Environment. Additionally, Values represent a fully evaluated form, stripped
// of any comprehensions, optional fields or embeddings.
package adt
