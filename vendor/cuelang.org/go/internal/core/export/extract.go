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

package export

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
)

// ExtractDoc collects documentation strings for a field.
//
// Comments are attached to a field with a field shorthand belong to the
// child node. So in the following the comment is attached to field bar.
//
//	// comment
//	foo: bar: 2
func ExtractDoc(v *adt.Vertex) (docs []*ast.CommentGroup) {
	return extractDocs(v, v.Conjuncts)
}

func extractDocs(v *adt.Vertex, a []adt.Conjunct) (docs []*ast.CommentGroup) {
	fields := []*ast.Field{}

	// Collect docs directly related to this Vertex.
	for _, x := range a {
		// TODO: Is this still being used?
		if v, ok := x.Elem().(*adt.Vertex); ok {
			docs = append(docs, extractDocs(v, v.Conjuncts)...)
			continue
		}

		switch f := x.Field().Source().(type) {
		case *ast.Field:
			if hasShorthandValue(f) {
				continue
			}
			fields = append(fields, f)
			for _, cg := range f.Comments() {
				if !containsDoc(docs, cg) && cg.Doc {
					docs = append(docs, cg)
				}
			}

		case *ast.File:
			if c := internal.FileComment(f); c != nil {
				docs = append(docs, c)
			}
		}
	}

	if v == nil {
		return docs
	}

	// Collect docs from parent scopes in collapsed fields.
	for p := v.Parent; p != nil; p = p.Parent {

		newFields := []*ast.Field{}

		for _, x := range p.Conjuncts {
			f, ok := x.Source().(*ast.Field)
			if !ok || !hasShorthandValue(f) {
				continue
			}

			nested := nestedField(f)
			for _, child := range fields {
				if nested == child {
					newFields = append(newFields, f)
					for _, cg := range f.Comments() {
						if !containsDoc(docs, cg) && cg.Doc {
							docs = append(docs, cg)
						}
					}
				}
			}
		}

		fields = newFields
	}
	return docs
}

// hasShorthandValue reports whether this field has a struct value that will
// be rendered as a shorthand, for instance:
//
//	f: g: 2
func hasShorthandValue(f *ast.Field) bool {
	if f = nestedField(f); f == nil {
		return false
	}

	// Not a regular field, but shorthand field.
	// TODO: Should we return here? For now mimic old implementation.
	if _, _, err := ast.LabelName(f.Label); err != nil {
		return false
	}

	return true
}

// nestedField returns the child field of a field shorthand.
func nestedField(f *ast.Field) *ast.Field {
	s, _ := f.Value.(*ast.StructLit)
	if s == nil ||
		len(s.Elts) != 1 ||
		s.Lbrace != token.NoPos ||
		s.Rbrace != token.NoPos {
		return nil
	}

	f, _ = s.Elts[0].(*ast.Field)
	return f
}

func containsDoc(a []*ast.CommentGroup, cg *ast.CommentGroup) bool {
	for _, c := range a {
		if c == cg {
			return true
		}
	}

	for _, c := range a {
		if c.Text() == cg.Text() {
			return true
		}
	}

	return false
}

func ExtractFieldAttrs(v *adt.Vertex) (attrs []*ast.Attribute) {
	for _, x := range v.Conjuncts {
		attrs = extractFieldAttrs(attrs, x.Field())
	}
	return attrs
}

// extractFieldAttrs extracts the fields from n and appends unique entries to
// attrs.
//
// The value of n should be obtained from the Conjunct.Field method if the
// source for n is a Conjunct so that Comprehensions are properly unwrapped.
func extractFieldAttrs(attrs []*ast.Attribute, n adt.Node) []*ast.Attribute {
	if f, ok := n.Source().(*ast.Field); ok {
		for _, a := range f.Attrs {
			if !containsAttr(attrs, a) {
				attrs = append(attrs, a)
			}
		}
	}
	return attrs
}

func ExtractDeclAttrs(v *adt.Vertex) (attrs []*ast.Attribute) {
	for _, st := range v.Structs {
		if src := st.StructLit; src != nil {
			attrs = extractDeclAttrs(attrs, src.Src)
		}
	}
	return attrs
}

func extractDeclAttrs(attrs []*ast.Attribute, n ast.Node) []*ast.Attribute {
	switch x := n.(type) {
	case nil:
	case *ast.File:
		info := internal.GetPackageInfo(x)
		attrs = appendDeclAttrs(attrs, x.Decls[info.Index:])
	case *ast.StructLit:
		attrs = appendDeclAttrs(attrs, x.Elts)
	}
	return attrs
}

func appendDeclAttrs(a []*ast.Attribute, decls []ast.Decl) []*ast.Attribute {
	for _, d := range decls {
		if attr, ok := d.(*ast.Attribute); ok && !containsAttr(a, attr) {
			a = append(a, attr)
		}
	}
	return a
}

func containsAttr(a []*ast.Attribute, x *ast.Attribute) bool {
	for _, e := range a {
		if e.Text == x.Text {
			return true
		}
	}
	return false
}
