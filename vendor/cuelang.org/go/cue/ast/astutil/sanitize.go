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

package astutil

import (
	"fmt"
	"math/rand"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// TODO:
// - handle comprehensions
// - change field from foo to "foo" if it isn't referenced, rather than
//   relying on introducing a unique alias.
// - change a predeclared identifier reference to use the __ident form,
//   instead of introducing an alias.

// Sanitize rewrites File f in place to be well formed after automated
// construction of an AST.
//
// Rewrites:
//   - auto inserts imports associated with Idents
//   - unshadows imports associated with idents
//   - unshadows references for identifiers that were already resolved.
func Sanitize(f *ast.File) error {
	z := &sanitizer{
		file: f,
		rand: rand.New(rand.NewSource(808)),

		names:      map[string]bool{},
		importMap:  map[string]*ast.ImportSpec{},
		referenced: map[ast.Node]bool{},
		altMap:     map[ast.Node]string{},
	}

	// Gather all names.
	walk(&scope{
		errFn:   z.errf,
		nameFn:  z.addName,
		identFn: z.markUsed,
	}, f)
	if z.errs != nil {
		return z.errs
	}

	// Add imports and unshadow.
	s := &scope{
		file:    f,
		errFn:   z.errf,
		identFn: z.handleIdent,
		index:   make(map[string]entry),
	}
	z.fileScope = s
	walk(s, f)
	if z.errs != nil {
		return z.errs
	}

	z.cleanImports()

	return z.errs
}

type sanitizer struct {
	file      *ast.File
	fileScope *scope

	rand *rand.Rand

	// names is all used names. Can be used to determine a new unique name.
	names      map[string]bool
	referenced map[ast.Node]bool

	// altMap defines an alternative name for an existing entry link (a field,
	// alias or let clause). As new names are globally unique, they can be
	// safely reused for any unshadowing.
	altMap    map[ast.Node]string
	importMap map[string]*ast.ImportSpec

	errs errors.Error
}

func (z *sanitizer) errf(p token.Pos, msg string, args ...interface{}) {
	z.errs = errors.Append(z.errs, errors.Newf(p, msg, args...))
}

func (z *sanitizer) addName(name string) {
	z.names[name] = true
}

func (z *sanitizer) addRename(base string, n ast.Node) (alt string, new bool) {
	if name, ok := z.altMap[n]; ok {
		return name, false
	}

	name := z.uniqueName(base, false)
	z.altMap[n] = name
	return name, true
}

func (z *sanitizer) unshadow(parent ast.Node, base string, link ast.Node) string {
	name, ok := z.altMap[link]
	if !ok {
		name = z.uniqueName(base, false)
		z.altMap[link] = name

		// Insert new let clause at top to refer to a declaration in possible
		// other files.
		let := &ast.LetClause{
			Ident: ast.NewIdent(name),
			Expr:  ast.NewIdent(base),
		}

		var decls *[]ast.Decl

		switch x := parent.(type) {
		case *ast.File:
			decls = &x.Decls
		case *ast.StructLit:
			decls = &x.Elts
		default:
			panic(fmt.Sprintf("impossible scope type %T", parent))
		}

		i := 0
		for ; i < len(*decls); i++ {
			if (*decls)[i] == link {
				break
			}
			if f, ok := (*decls)[i].(*ast.Field); ok && f.Label == link {
				break
			}
		}

		if i > 0 {
			ast.SetRelPos(let, token.NewSection)
		}

		a := append((*decls)[:i:i], let)
		*decls = append(a, (*decls)[i:]...)
	}
	return name
}

func (z *sanitizer) markUsed(s *scope, n *ast.Ident) bool {
	if n.Node != nil {
		return false
	}
	_, _, entry := s.lookup(n.String())
	z.referenced[entry.link] = true
	return true
}

func (z *sanitizer) cleanImports() {
	z.file.VisitImports(func(d *ast.ImportDecl) {
		k := 0
		for _, s := range d.Specs {
			if _, ok := z.referenced[s]; ok {
				d.Specs[k] = s
				k++
			}
		}
		d.Specs = d.Specs[:k]
	})
}

func (z *sanitizer) handleIdent(s *scope, n *ast.Ident) bool {
	if n.Node == nil {
		return true
	}

	_, _, node := s.lookup(n.Name)
	if node.node == nil {
		spec, ok := n.Node.(*ast.ImportSpec)
		if !ok {
			// Clear node. A reference may have been moved to a different
			// file. If not, it should be an error.
			n.Node = nil
			n.Scope = nil
			return false
		}

		_ = z.addImport(spec)
		info, _ := ParseImportSpec(spec)
		z.fileScope.insert(info.Ident, spec, spec)
		return true
	}

	if x, ok := n.Node.(*ast.ImportSpec); ok {
		xi, _ := ParseImportSpec(x)

		if y, ok := node.node.(*ast.ImportSpec); ok {
			yi, _ := ParseImportSpec(y)
			if xi.ID == yi.ID { // name must be identical as a result of lookup.
				z.referenced[y] = true
				n.Node = x
				n.Scope = nil
				return false
			}
		}

		// Either:
		// - the import is shadowed
		// - an incorrect import is matched
		// In all cases we need to create a new import with a unique name or
		// use a previously created one.
		spec := z.importMap[xi.ID]
		if spec == nil {
			name := z.uniqueName(xi.Ident, false)
			spec = z.addImport(&ast.ImportSpec{
				Name: ast.NewIdent(name),
				Path: x.Path,
			})
			z.importMap[xi.ID] = spec
			z.fileScope.insert(name, spec, spec)
		}

		info, _ := ParseImportSpec(spec)
		// TODO(apply): replace n itself directly
		n.Name = info.Ident
		n.Node = spec
		n.Scope = nil
		return false
	}

	if node.node == n.Node {
		return true
	}

	// n.Node != node and are both not nil and n.Node is not an ImportSpec.
	// This means that either n.Node is illegal or shadowed.
	// Look for the scope in which n.Node is defined and add an alias or let.

	parent, e, ok := s.resolveScope(n.Name, n.Node)
	if !ok {
		// The node isn't within a legal scope within this file. It may only
		// possibly shadow a value of another file. We add a top-level let
		// clause to refer to this value.

		// TODO(apply): better would be to have resolve use Apply so that we can replace
		// the entire ast.Ident, rather than modifying it.
		// TODO: resolve to new node or rely on another pass of Resolve?
		n.Name = z.unshadow(z.file, n.Name, n)
		n.Node = nil
		n.Scope = nil

		return false
	}

	var name string
	// var isNew bool
	switch x := e.link.(type) {
	case *ast.Field: // referring to regular field.
		name, ok = z.altMap[x]
		if ok {
			break
		}
		// If this field has not alias, introduce one with a unique name.
		// If this has an alias, also introduce a new name. There is a
		// possibility that the alias can be used, but it is easier to just
		// assign a new name, assuming this case is rather rare.
		switch y := x.Label.(type) {
		case *ast.Alias:
			name = z.unshadow(parent, y.Ident.Name, y)

		case *ast.Ident:
			var isNew bool
			name, isNew = z.addRename(y.Name, x)
			if isNew {
				ident := ast.NewIdent(name)
				// Move formatting and comments from original label to alias
				// identifier.
				CopyMeta(ident, y)
				ast.SetRelPos(y, token.NoRelPos)
				ast.SetComments(y, nil)
				x.Label = &ast.Alias{Ident: ident, Expr: y}
			}

		default:
			// This is an illegal reference.
			return false
		}

	case *ast.LetClause:
		name = z.unshadow(parent, x.Ident.Name, x)

	case *ast.Alias:
		name = z.unshadow(parent, x.Ident.Name, x)

	default:
		panic(fmt.Sprintf("unexpected link type %T", e.link))
	}

	// TODO(apply): better would be to have resolve use Apply so that we can replace
	// the entire ast.Ident, rather than modifying it.
	n.Name = name
	n.Node = nil
	n.Scope = nil

	return true
}

// uniqueName returns a new name globally unique name of the form
// base_XX ... base_XXXXXXXXXXXXXX or _base or the same pattern with a '_'
// prefix if hidden is true.
//
// It prefers short extensions over large ones, while ensuring the likelihood of
// fast termination is high. There are at least two digits to make it visually
// clearer this concerns a generated number.
func (z *sanitizer) uniqueName(base string, hidden bool) string {
	if hidden && !strings.HasPrefix(base, "_") {
		base = "_" + base
		if !z.names[base] {
			z.names[base] = true
			return base
		}
	}

	// TODO(go1.13): const mask = 0xff_ffff_ffff_ffff
	const mask = 0xffffffffffffff // max bits; stay clear of int64 overflow
	const shift = 4               // rate of growth
	for n := int64(0x10); ; n = int64(mask&((n<<shift)-1)) + 1 {
		num := z.rand.Intn(int(n))
		name := fmt.Sprintf("%s_%01X", base, num)
		if !z.names[name] {
			z.names[name] = true
			return name
		}
	}
}

func (z *sanitizer) addImport(spec *ast.ImportSpec) *ast.ImportSpec {
	spec = insertImport(&z.file.Decls, spec)
	z.referenced[spec] = true
	return spec
}
