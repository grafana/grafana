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

package cue

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/runtime"
)

// A Runtime is used for creating CUE Values.
//
// Any operation that involves two Values or Instances should originate from
// the same Runtime.
//
// The zero value of Runtime works for legacy reasons, but
// should not be used. It may panic at some point.
//
// Deprecated: use Context.
type Runtime runtime.Runtime

func (r *Runtime) runtime() *runtime.Runtime {
	rt := (*runtime.Runtime)(r)
	rt.Init()
	return rt
}

type hiddenRuntime = Runtime

func (r *Runtime) complete(p *build.Instance, v *adt.Vertex) (*Instance, error) {
	idx := r.runtime()
	inst := getImportFromBuild(idx, p, v)
	inst.ImportPath = p.ImportPath
	if inst.Err != nil {
		return nil, inst.Err
	}
	return inst, nil
}

// Compile compiles the given source into an Instance. The source code may be
// provided as a string, byte slice, io.Reader. The name is used as the file
// name in position information. The source may import builtin packages. Use
// Build to allow importing non-builtin packages.
//
// Deprecated: use Parse or ParseBytes. The use of Instance is being phased out.
func (r *hiddenRuntime) Compile(filename string, source interface{}) (*Instance, error) {
	cfg := &runtime.Config{Filename: filename}
	v, p := r.runtime().Compile(cfg, source)
	return r.complete(p, v)
}

// CompileFile compiles the given source file into an Instance. The source may
// import builtin packages. Use Build to allow importing non-builtin packages.
//
// Deprecated: use BuildFile. The use of Instance is being phased out.
func (r *hiddenRuntime) CompileFile(file *ast.File) (*Instance, error) {
	v, p := r.runtime().CompileFile(nil, file)
	return r.complete(p, v)
}

// CompileExpr compiles the given source expression into an Instance. The source
// may import builtin packages. Use Build to allow importing non-builtin
// packages.
//
// Deprecated: use BuildExpr. The use of Instance is being phased out.
func (r *hiddenRuntime) CompileExpr(expr ast.Expr) (*Instance, error) {
	f, err := astutil.ToFile(expr)
	if err != nil {
		return nil, err
	}
	v := (*Context)(r).BuildExpr(expr)
	err = v.Err()
	inst := &Instance{
		index: r.runtime(),
		root:  v.v,
		inst: &build.Instance{
			Files: []*ast.File{f},
		},
		Err:        errors.Promote(err, ""),
		Incomplete: err != nil,
	}
	return inst, err
}

// Parse parses a CUE source value into a CUE Instance. The source code may be
// provided as a string, byte slice, or io.Reader. The name is used as the file
// name in position information. The source may import builtin packages.
//
// Deprecated: use CompileString or CompileBytes.  The use of Instance is being
// phased out.
func (r *hiddenRuntime) Parse(name string, source interface{}) (*Instance, error) {
	return r.Compile(name, source)
}

// Build creates an Instance from the given build.Instance. A returned Instance
// may be incomplete, in which case its Err field is set.
//
// Deprecated: use Context.BuildInstance. The use of Instance is being phased
// out.
func (r *hiddenRuntime) Build(p *build.Instance) (*Instance, error) {
	v, _ := r.runtime().Build(nil, p)
	return r.complete(p, v)
}

// Deprecated: use cuecontext.Context.BuildInstances. The use of Instance is
// being phased out.
func Build(instances []*build.Instance) []*Instance {
	if len(instances) == 0 {
		panic("cue: list of instances must not be empty")
	}
	var r Runtime
	a, _ := r.build(instances)
	return a
}

func (r *hiddenRuntime) build(instances []*build.Instance) ([]*Instance, error) {
	index := r.runtime()

	loaded := []*Instance{}

	var errs errors.Error

	for _, p := range instances {
		v, _ := index.Build(nil, p)
		i := getImportFromBuild(index, p, v)
		errs = errors.Append(errs, i.Err)
		loaded = append(loaded, i)
	}

	// TODO: insert imports
	return loaded, errs
}

// FromExpr creates an instance from an expression.
// Any references must be resolved beforehand.
//
// Deprecated: use CompileExpr
func (r *hiddenRuntime) FromExpr(expr ast.Expr) (*Instance, error) {
	return r.CompileFile(&ast.File{
		Decls: []ast.Decl{&ast.EmbedDecl{Expr: expr}},
	})
}
