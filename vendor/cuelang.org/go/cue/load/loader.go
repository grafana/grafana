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

package load

// Files in this package are to a large extent based on Go files from the following
// Go packages:
//    - cmd/go/internal/load
//    - go/build

import (
	"path/filepath"

	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/encoding"

	// Trigger the unconditional loading of all core builtin packages if load
	// is used. This was deemed the simplest way to avoid having to import
	// this line explicitly, and thus breaking existing code, for the majority
	// of cases, while not introducing an import cycle.
	_ "cuelang.org/go/pkg"
)

type loader struct {
	cfg      *Config
	tagger   *tagger
	stk      importStack
	loadFunc build.LoadFunc
}

func newLegacyLoader(c *Config, tg *tagger) *loader {
	l := &loader{
		cfg:    c,
		tagger: tg,
	}
	l.loadFunc = l._loadFunc
	return l
}

func (l *loader) buildLoadFunc() build.LoadFunc {
	return l.loadFunc
}

func (l *loader) abs(filename string) string {
	if !isLocalImport(filename) {
		return filename
	}
	return filepath.Join(l.cfg.Dir, filename)
}

func (l *loader) errPkgf(importPos []token.Pos, format string, args ...interface{}) *PackageError {
	err := &PackageError{
		ImportStack: l.stk.Copy(),
		Message:     errors.NewMessage(format, args),
	}
	err.fillPos(l.cfg.Dir, importPos)
	return err
}

// cueFilesPackage creates a package for building a collection of CUE files
// (typically named on the command line).
func (l *loader) cueFilesPackage(files []*build.File) *build.Instance {
	cfg := l.cfg
	cfg.filesMode = true
	// ModInit() // TODO: support modules
	pkg := l.cfg.Context.NewInstance(cfg.Dir, l.loadFunc)

	for _, bf := range files {
		f := bf.Filename
		if f == "-" {
			continue
		}
		if !filepath.IsAbs(f) {
			f = filepath.Join(cfg.Dir, f)
		}
		fi, err := cfg.fileSystem.stat(f)
		if err != nil {
			return cfg.newErrInstance(errors.Wrapf(err, token.NoPos, "could not find file %v", f))
		}
		if fi.IsDir() {
			return cfg.newErrInstance(errors.Newf(token.NoPos, "file is a directory %v", f))
		}
	}

	fp := newFileProcessor(cfg, pkg, l.tagger)
	for _, file := range files {
		fp.add(token.NoPos, cfg.Dir, file, allowAnonymous)
	}

	// TODO: ModImportFromFiles(files)
	pkg.Dir = cfg.Dir
	rewriteFiles(pkg, pkg.Dir, true)
	for _, err := range errors.Errors(fp.finalize(pkg)) { // ImportDir(&ctxt, dir, 0)
		var x *NoFilesError
		if len(pkg.OrphanedFiles) == 0 || !errors.As(err, &x) {
			pkg.ReportError(err)
		}
	}
	// TODO: Support module importing.
	// if ModDirImportPath != nil {
	// 	// Use the effective import path of the directory
	// 	// for deciding visibility during pkg.load.
	// 	bp.ImportPath = ModDirImportPath(dir)
	// }

	l.addFiles(cfg.Dir, pkg)

	pkg.User = true
	l.stk.Push("user")
	_ = pkg.Complete()
	l.stk.Pop()
	pkg.User = true
	//pkg.LocalPrefix = dirToImportPath(dir)
	pkg.DisplayPath = "command-line-arguments"

	return pkg
}

func (l *loader) addFiles(dir string, p *build.Instance) {
	for _, f := range p.BuildFiles {
		d := encoding.NewDecoder(f, &encoding.Config{
			Stdin:     l.cfg.stdin(),
			ParseFile: l.cfg.ParseFile,
		})
		for ; !d.Done(); d.Next() {
			_ = p.AddSyntax(d.File())
		}
		if err := d.Err(); err != nil {
			p.ReportError(errors.Promote(err, "load"))
		}
		d.Close()
	}
}
