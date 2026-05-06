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
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/stats"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/compile"
)

type Config struct {
	Runtime    *Runtime
	Filename   string
	ImportPath string

	Counts *stats.Counts

	compile.Config
}

// Build builds b and all its transitive dependencies, insofar they have not
// been build yet.
func (x *Runtime) Build(cfg *Config, b *build.Instance) (v *adt.Vertex, errs errors.Error) {
	if err := b.Complete(); err != nil {
		return nil, b.Err
	}
	if v := x.getNodeFromInstance(b); v != nil {
		return v, b.Err
	}
	// TODO: clear cache of old implementation.
	// if s := b.ImportPath; s != "" {
	// 	// Use cached result, if available.
	// 	if v, err := x.LoadImport(s); v != nil || err != nil {
	// 		return v, err
	// 	}
	// }

	errs = b.Err

	// Build transitive dependencies.
	for _, file := range b.Files {
		file.VisitImports(func(d *ast.ImportDecl) {
			for _, s := range d.Specs {
				errs = errors.Append(errs, x.buildSpec(cfg, b, s))
			}
		})
	}

	err := x.ResolveFiles(b)
	errs = errors.Append(errs, err)

	var cc *compile.Config
	if cfg != nil {
		cc = &cfg.Config
	}
	if cfg != nil && cfg.ImportPath != "" {
		b.ImportPath = cfg.ImportPath
		b.PkgName = astutil.ImportPathName(b.ImportPath)
	}
	v, err = compile.Files(cc, x, b.ID(), b.Files...)
	errs = errors.Append(errs, err)

	errs = errors.Append(errs, x.injectImplementations(b, v))

	if errs != nil {
		v = adt.ToVertex(&adt.Bottom{Err: errs})
		b.Err = errs
	}

	x.AddInst(b.ImportPath, v, b)

	return v, errs
}

func dummyLoad(token.Pos, string) *build.Instance { return nil }

func (r *Runtime) Compile(cfg *Config, source interface{}) (*adt.Vertex, *build.Instance) {
	ctx := build.NewContext()
	var filename string
	if cfg != nil && cfg.Filename != "" {
		filename = cfg.Filename
	}
	p := ctx.NewInstance(filename, dummyLoad)
	if err := p.AddFile(filename, source); err != nil {
		return nil, p
	}
	v, _ := r.Build(cfg, p)
	return v, p
}

func (r *Runtime) CompileFile(cfg *Config, file *ast.File) (*adt.Vertex, *build.Instance) {
	ctx := build.NewContext()
	filename := file.Filename
	if cfg != nil && cfg.Filename != "" {
		filename = cfg.Filename
	}
	p := ctx.NewInstance(filename, dummyLoad)
	err := p.AddSyntax(file)
	if err != nil {
		return nil, p
	}
	_, p.PkgName, _ = internal.PackageInfo(file)
	v, _ := r.Build(cfg, p)
	return v, p
}

func (x *Runtime) buildSpec(cfg *Config, b *build.Instance, spec *ast.ImportSpec) (errs errors.Error) {
	info, err := astutil.ParseImportSpec(spec)
	if err != nil {
		return errors.Promote(err, "invalid import path")
	}

	pkg := b.LookupImport(info.ID)
	if pkg == nil {
		if strings.Contains(info.ID, ".") {
			return errors.Newf(spec.Pos(),
				"package %q imported but not defined in %s",
				info.ID, b.ImportPath)
		} else if x.index.builtinPaths[info.ID] == nil {
			return errors.Newf(spec.Pos(),
				"builtin package %q undefined", info.ID)
		}
		return nil
	}

	if v := x.getNodeFromInstance(pkg); v != nil {
		return pkg.Err
	}

	if _, err := x.Build(cfg, pkg); err != nil {
		return err
	}

	return nil
}
