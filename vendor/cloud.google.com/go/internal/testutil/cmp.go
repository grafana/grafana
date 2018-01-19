// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package testutil

import (
	"fmt"
	"math"
	"reflect"
	"unicode"
	"unicode/utf8"

	"github.com/golang/protobuf/proto"
	"github.com/google/go-cmp/cmp"
)

var (
	alwaysEqual = cmp.Comparer(func(_, _ interface{}) bool { return true })

	defaultCmpOptions = []cmp.Option{
		// Use proto.Equal for protobufs
		cmp.Comparer(proto.Equal),
		// NaNs compare equal
		cmp.FilterValues(func(x, y float64) bool {
			return math.IsNaN(x) && math.IsNaN(y)
		}, alwaysEqual),
		cmp.FilterValues(func(x, y float32) bool {
			return math.IsNaN(float64(x)) && math.IsNaN(float64(y))
		}, alwaysEqual),
	}
)

// Equal tests two values for equality.
func Equal(x, y interface{}, opts ...cmp.Option) bool {
	// Put default options at the end. Order doesn't matter.
	opts = append(opts[:len(opts):len(opts)], defaultCmpOptions...)
	return cmp.Equal(x, y, opts...)
}

// Diff reports the differences between two values.
// Diff(x, y) == "" iff Equal(x, y).
func Diff(x, y interface{}, opts ...cmp.Option) string {
	// Put default options at the end. Order doesn't matter.
	opts = append(opts[:len(opts):len(opts)], defaultCmpOptions...)
	return cmp.Diff(x, y, opts...)
}

// TODO(jba): remove the code below when cmpopts becomes available.

// IgnoreUnexported returns an Option that only ignores the immediate unexported
// fields of a struct, including anonymous fields of unexported types.
// In particular, unexported fields within the struct's exported fields
// of struct types, including anonymous fields, will not be ignored unless the
// type of the field itself is also passed to IgnoreUnexported.
func IgnoreUnexported(typs ...interface{}) cmp.Option {
	ux := newUnexportedFilter(typs...)
	return cmp.FilterPath(ux.filter, cmp.Ignore())
}

type unexportedFilter struct{ m map[reflect.Type]bool }

func newUnexportedFilter(typs ...interface{}) unexportedFilter {
	ux := unexportedFilter{m: make(map[reflect.Type]bool)}
	for _, typ := range typs {
		t := reflect.TypeOf(typ)
		if t == nil || t.Kind() != reflect.Struct {
			panic(fmt.Sprintf("invalid struct type: %T", typ))
		}
		ux.m[t] = true
	}
	return ux
}
func (xf unexportedFilter) filter(p cmp.Path) bool {
	if len(p) < 2 {
		return false
	}
	sf, ok := p[len(p)-1].(cmp.StructField)
	if !ok {
		return false
	}
	return xf.m[p[len(p)-2].Type()] && !isExported(sf.Name())
}

// isExported reports whether the identifier is exported.
func isExported(id string) bool {
	r, _ := utf8.DecodeRuneInString(id)
	return unicode.IsUpper(r)
}
