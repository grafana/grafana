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
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
)

// ToFile converts an expression to a File. It will create an import section for
// any of the identifiers in x that refer to an import and will unshadow
// references as appropriate.
func ToFile(x ast.Expr) (*ast.File, error) {
	var f *ast.File
	if st, ok := x.(*ast.StructLit); ok {
		f = &ast.File{Decls: st.Elts}
	} else {
		ast.SetRelPos(x, token.NoSpace)
		f = &ast.File{Decls: []ast.Decl{&ast.EmbedDecl{Expr: x}}}
	}

	if err := Sanitize(f); err != nil {
		return nil, err
	}
	return f, nil
}
