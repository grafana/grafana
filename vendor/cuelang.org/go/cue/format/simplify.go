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

package format

import (
	"strconv"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/internal"
)

// labelSimplifier rewrites string labels to identifiers if
// no identifiers will subsequently bind to the exposed label.
// In other words, string labels are only replaced if this does
// not change the semantics of the CUE code.
type labelSimplifier struct {
	parent *labelSimplifier
	scope  map[string]bool
}

func (s *labelSimplifier) processDecls(decls []ast.Decl) {
	sc := labelSimplifier{parent: s, scope: map[string]bool{}}
	for _, d := range decls {
		switch x := d.(type) {
		case *ast.Field:
			ast.Walk(x.Label, sc.markStrings, nil)
		}
	}

	for _, d := range decls {
		switch x := d.(type) {
		case *ast.Field:
			ast.Walk(x.Value, sc.markReferences, nil)
		default:
			ast.Walk(x, sc.markReferences, nil)
		}
	}

	for _, d := range decls {
		switch x := d.(type) {
		case *ast.Field:
			x.Label = astutil.Apply(x.Label, sc.replace, nil).(ast.Label)
		}
	}
}

func (s *labelSimplifier) markReferences(n ast.Node) bool {
	// Record strings at this level.
	switch x := n.(type) {
	case *ast.File:
		s.processDecls(x.Decls)
		return false

	case *ast.StructLit:
		s.processDecls(x.Elts)
		return false

	case *ast.SelectorExpr:
		ast.Walk(x.X, s.markReferences, nil)
		return false

	case *ast.Ident:
		for c := s; c != nil; c = c.parent {
			if _, ok := c.scope[x.Name]; ok {
				c.scope[x.Name] = false
				break
			}
		}
	}
	return true
}

func (s *labelSimplifier) markStrings(n ast.Node) bool {
	switch x := n.(type) {
	case *ast.BasicLit:
		str, err := strconv.Unquote(x.Value)
		if err != nil || !ast.IsValidIdent(str) || internal.IsDefOrHidden(str) {
			return false
		}
		s.scope[str] = true

	case *ast.Ident:
		s.scope[x.Name] = true

	case *ast.ListLit, *ast.Interpolation:
		return false
	}
	return true
}

func (s *labelSimplifier) replace(c astutil.Cursor) bool {
	switch x := c.Node().(type) {
	case *ast.BasicLit:
		str, err := strconv.Unquote(x.Value)
		if err == nil && s.scope[str] && !internal.IsDefOrHidden(str) {
			c.Replace(ast.NewIdent(str))
		}
	}
	return true
}
