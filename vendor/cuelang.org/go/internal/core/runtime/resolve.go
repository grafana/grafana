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

package runtime

import (
	"path"
	"strconv"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal"
)

// TODO(resolve): this is also done in compile, do we need both?
func (r *Runtime) ResolveFiles(p *build.Instance) (errs errors.Error) {
	idx := r.index

	// Link top-level declarations. As top-level entries get unified, an entry
	// may be linked to any top-level entry of any of the files.
	allFields := map[string]ast.Node{}
	for _, f := range p.Files {
		if p := internal.GetPackageInfo(f); p.IsAnonymous() {
			continue
		}
		for _, d := range f.Decls {
			if f, ok := d.(*ast.Field); ok && f.Value != nil {
				if ident, ok := f.Label.(*ast.Ident); ok {
					allFields[ident.Name] = f.Value
				}
			}
		}
	}
	for _, f := range p.Files {
		if p := internal.GetPackageInfo(f); p.IsAnonymous() {
			continue
		}
		err := resolveFile(idx, f, p, allFields)
		errs = errors.Append(errs, err)
	}
	return errs
}

func resolveFile(
	idx *index,
	f *ast.File,
	p *build.Instance,
	allFields map[string]ast.Node,
) errors.Error {
	unresolved := map[string][]*ast.Ident{}
	for _, u := range f.Unresolved {
		unresolved[u.Name] = append(unresolved[u.Name], u)
	}
	fields := map[string]ast.Node{}
	for _, d := range f.Decls {
		if f, ok := d.(*ast.Field); ok && f.Value != nil {
			if ident, ok := f.Label.(*ast.Ident); ok {
				fields[ident.Name] = d
			}
		}
	}
	var errs errors.Error

	specs := []*ast.ImportSpec{}

	for _, spec := range f.Imports {
		id, err := strconv.Unquote(spec.Path.Value)
		if err != nil {
			continue // quietly ignore the error
		}
		name := path.Base(id)
		if imp := p.LookupImport(id); imp != nil {
			name = imp.PkgName
		} else if _, ok := idx.builtinPaths[id]; !ok {
			errs = errors.Append(errs,
				nodeErrorf(spec, "package %q not found", id))
			continue
		}
		if spec.Name != nil {
			name = spec.Name.Name
		}
		if n, ok := fields[name]; ok {
			errs = errors.Append(errs, nodeErrorf(spec,
				"%s redeclared as imported package name\n"+
					"\tprevious declaration at %v", name, lineStr(idx, n)))
			continue
		}
		fields[name] = spec
		used := false
		for _, u := range unresolved[name] {
			used = true
			u.Node = spec
		}
		if !used {
			specs = append(specs, spec)
		}
	}

	// Verify each import is used.
	if len(specs) > 0 {
		// Find references to imports. This assumes that identifiers in labels
		// are not resolved or that such errors are caught elsewhere.
		ast.Walk(f, nil, func(n ast.Node) {
			if x, ok := n.(*ast.Ident); ok {
				// As we also visit labels, most nodes will be nil.
				if x.Node == nil {
					return
				}
				for i, s := range specs {
					if s == x.Node {
						specs[i] = nil
						return
					}
				}
			}
		})

		// Add errors for unused imports.
		for _, spec := range specs {
			if spec == nil {
				continue
			}
			if spec.Name == nil {
				errs = errors.Append(errs, nodeErrorf(spec,
					"imported and not used: %s", spec.Path.Value))
			} else {
				errs = errors.Append(errs, nodeErrorf(spec,
					"imported and not used: %s as %s", spec.Path.Value, spec.Name))
			}
		}
	}

	k := 0
	for _, u := range f.Unresolved {
		if u.Node != nil {
			continue
		}
		if n, ok := allFields[u.Name]; ok {
			u.Node = n
			u.Scope = f
			continue
		}
		f.Unresolved[k] = u
		k++
	}
	f.Unresolved = f.Unresolved[:k]
	// TODO: also need to resolve types.
	// if len(f.Unresolved) > 0 {
	// 	n := f.Unresolved[0]
	// 	return ctx.mkErr(newBase(n), "unresolved reference %s", n.Name)
	// }
	return errs
}

func lineStr(idx *index, n ast.Node) string {
	return n.Pos().String()
}
