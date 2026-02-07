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

package astutil

import (
	"path"
	"strconv"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
)

// ImportPathName derives the package name from the given import path.
//
// Examples:
//
//	string           string
//	foo.com/bar      bar
//	foo.com/bar:baz  baz
func ImportPathName(id string) string {
	name := path.Base(id)
	if p := strings.LastIndexByte(name, ':'); p > 0 {
		name = name[p+1:]
	}
	return name
}

// ImportInfo describes the information contained in an ImportSpec.
type ImportInfo struct {
	Ident   string // identifier used to refer to the import
	PkgName string // name of the package
	ID      string // full import path, including the name
	Dir     string // import path, excluding the name
}

// ParseImportSpec returns the name and full path of an ImportSpec.
func ParseImportSpec(spec *ast.ImportSpec) (info ImportInfo, err error) {
	str, err := strconv.Unquote(spec.Path.Value)
	if err != nil {
		return info, err
	}

	info.ID = str

	if p := strings.LastIndexByte(str, ':'); p > 0 {
		info.Dir = str[:p]
		info.PkgName = str[p+1:]
	} else {
		info.Dir = str
		info.PkgName = path.Base(str)
	}

	if spec.Name != nil {
		info.Ident = spec.Name.Name
	} else {
		info.Ident = info.PkgName
	}

	return info, nil
}

// CopyComments associates comments of one node with another.
// It may change the relative position of comments.
func CopyComments(to, from ast.Node) {
	if from == nil {
		return
	}
	ast.SetComments(to, from.Comments())
}

// CopyPosition sets the position of one node to another.
func CopyPosition(to, from ast.Node) {
	if from == nil {
		return
	}
	ast.SetPos(to, from.Pos())
}

// CopyMeta copies comments and position information from one node to another.
// It returns the destination node.
func CopyMeta(to, from ast.Node) ast.Node {
	if from == nil {
		return to
	}
	ast.SetComments(to, from.Comments())
	ast.SetPos(to, from.Pos())
	return to
}

// insertImport looks up an existing import with the given name and path or will
// add spec if it doesn't exist. It returns a spec in decls matching spec.
func insertImport(decls *[]ast.Decl, spec *ast.ImportSpec) *ast.ImportSpec {
	x, _ := ParseImportSpec(spec)

	a := *decls

	var imports *ast.ImportDecl
	var orig *ast.ImportSpec

	p := 0
outer:
	for i := 0; i < len(a); i++ {
		d := a[i]
		switch t := d.(type) {
		default:
			break outer

		case *ast.Package:
			p = i + 1
		case *ast.CommentGroup:
			p = i + 1
		case *ast.Attribute:
			continue
		case *ast.ImportDecl:
			p = i + 1
			imports = t
			for _, s := range t.Specs {
				y, _ := ParseImportSpec(s)
				if y.ID != x.ID {
					continue
				}
				orig = s
				if x.Ident == "" || y.Ident == x.Ident {
					return s
				}
			}
		}
	}

	// Import not found, add one.
	if imports == nil {
		imports = &ast.ImportDecl{}
		preamble := append(a[:p:p], imports)
		a = append(preamble, a[p:]...)
		*decls = a
	}

	if orig != nil {
		CopyComments(spec, orig)
	}
	imports.Specs = append(imports.Specs, spec)
	ast.SetRelPos(imports.Specs[0], token.NoRelPos)

	return spec
}
