// Copyright 2019 CUE Authors
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

package openapi

import (
	"fmt"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/encoding/json"
)

// An OrderedMap is a set of key-value pairs that preserves the order in which
// items were added. It marshals to JSON as an object.
//
// Deprecated: the API now returns an ast.File. This allows OpenAPI to be
// represented as JSON, YAML, or CUE data, in addition to being able to use
// all the ast-related tooling.
type OrderedMap ast.StructLit

// KeyValue associates a value with a key.
type KeyValue struct {
	Key   string
	Value interface{}
}

// TODO: these functions are here to support backwards compatibility with Istio.
// At some point, once this is removed from Istio, this can be removed.

func fromLegacy(x interface{}) ast.Expr {
	switch x := x.(type) {
	case *OrderedMap:
		return (*ast.StructLit)(x)
	case []*OrderedMap:
		a := make([]ast.Expr, len(x))
		for i, v := range x {
			a[i] = fromLegacy(v)
		}
		return ast.NewList(a...)
	case string:
		return ast.NewString(x)
	case ast.Expr:
		return x
	default:
		panic(fmt.Sprintf("unsupported type %T", x))
	}
}

func toLegacy(x ast.Expr) interface{} {
	switch x := x.(type) {
	case *ast.StructLit:
		return (*OrderedMap)(x)
	case *ast.ListLit:
		a := make([]*OrderedMap, len(x.Elts))
		for i, v := range x.Elts {
			e, ok := v.(*ast.StructLit)
			if !ok {
				return x
			}
			a[i] = (*OrderedMap)(e)
		}
		return a
	case *ast.BasicLit:
		if x.Kind == token.STRING {
			str, err := literal.Unquote(x.Value)
			if err != nil {
				return x
			}
			return str
		}
	}
	return x
}

func (m *OrderedMap) len() int {
	return len(m.Elts)
}

// Pairs returns the KeyValue pairs associated with m.
func (m *OrderedMap) Pairs() []KeyValue {
	kvs := make([]KeyValue, len(m.Elts))
	for i, e := range m.Elts {
		kvs[i].Key = label(e)
		kvs[i].Value = toLegacy(e.(*ast.Field).Value)
	}
	return kvs
}

func (m *OrderedMap) find(key string) *ast.Field {
	for _, v := range m.Elts {
		f, ok := v.(*ast.Field)
		if !ok {
			continue
		}
		s, _, err := ast.LabelName(f.Label)
		if err == nil && s == key {
			return f
		}
	}
	return nil
}

// Set sets a key value pair. If a pair with the same key already existed, it
// will be replaced with the new value. Otherwise, the new value is added to
// the end. The value must be of type string, ast.Expr, or *OrderedMap.
//
// Deprecated: use cuelang.org/go/cue/ast to manipulate ASTs.
func (m *OrderedMap) Set(key string, x interface{}) {
	switch x := x.(type) {
	case *OrderedMap:
		m.setExpr(key, (*ast.StructLit)(x))
	case string:
		m.setExpr(key, ast.NewString(x))
	case ast.Expr:
		m.setExpr(key, x)
	default:
		v, err := toCUE("Set", x)
		if err != nil {
			panic(err)
		}
		m.setExpr(key, v)
	}
}

func (m *OrderedMap) setExpr(key string, expr ast.Expr) {
	if f := m.find(key); f != nil {
		f.Value = expr
		return
	}
	m.Elts = append(m.Elts, &ast.Field{
		Label: ast.NewString(key),
		Value: expr,
	})
}

// SetAll replaces existing key-value pairs with the given ones. The keys must
// be unique.
func (m *OrderedMap) SetAll(kvs []KeyValue) {
	var a []ast.Decl
	for _, kv := range kvs {
		a = append(a, &ast.Field{
			Label: ast.NewString(kv.Key),
			Value: fromLegacy(kv.Value),
		})
	}
	m.Elts = a
}

// exists reports whether a key-value pair exists for the given key.
func (m *OrderedMap) exists(key string) bool {
	return m.find(key) != nil
}

// exists reports whether a key-value pair exists for the given key.
func (m *OrderedMap) getMap(key string) *OrderedMap {
	f := m.find(key)
	if f == nil {
		return nil
	}
	return (*OrderedMap)(f.Value.(*ast.StructLit))
}

// MarshalJSON implements json.Marshaler.
func (m *OrderedMap) MarshalJSON() (b []byte, err error) {
	// This is a pointer receiever to enforce that we only store pointers to
	// OrderedMap in the output.
	return json.Encode((*ast.StructLit)(m))
}
