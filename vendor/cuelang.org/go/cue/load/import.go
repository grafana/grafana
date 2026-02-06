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

import (
	"fmt"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strings"

	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/filetypes"
)

// importPkg returns details about the CUE package named by the import path,
// interpreting local import paths relative to l.cfg.Dir.
// If the path is a local import path naming a package that can be imported
// using a standard import path, the returned package will set p.ImportPath
// to that path.
//
// In the directory and ancestor directories up to including one with a
// cue.mod file, all .cue files are considered part of the package except for:
//
//   - files starting with _ or . (likely editor temporary files)
//   - files with build constraints not satisfied by the context
//
// If an error occurs, importPkg sets the error in the returned instance,
// which then may contain partial information.
//
// pkgName indicates which packages to load. It supports the following
// values:
//
//	""      the default package for the directory, if only one
//	        is present.
//	_       anonymous files (which may be marked with _)
//	*       all packages
func (l *loader) importPkg(pos token.Pos, p *build.Instance) []*build.Instance {
	l.stk.Push(p.ImportPath)
	defer l.stk.Pop()

	cfg := l.cfg
	ctxt := &cfg.fileSystem

	if p.Err != nil {
		return []*build.Instance{p}
	}

	retErr := func(errs errors.Error) []*build.Instance {
		// XXX: move this loop to ReportError
		for _, err := range errors.Errors(errs) {
			p.ReportError(err)
		}
		return []*build.Instance{p}
	}

	if !strings.HasPrefix(p.Dir, cfg.ModuleRoot) {
		err := errors.Newf(token.NoPos, "module root not defined", p.DisplayPath)
		return retErr(err)
	}

	fp := newFileProcessor(cfg, p, l.tagger)

	if p.PkgName == "" {
		if l.cfg.Package == "*" {
			fp.ignoreOther = true
			fp.allPackages = true
			p.PkgName = "_"
		} else {
			p.PkgName = l.cfg.Package
		}
	}
	if p.PkgName != "" {
		// If we have an explicit package name, we can ignore other packages.
		fp.ignoreOther = true
	}

	var dirs [][2]string
	genDir := GenPath(cfg.ModuleRoot)
	if strings.HasPrefix(p.Dir, genDir) {
		dirs = append(dirs, [2]string{genDir, p.Dir})
		// TODO(legacy): don't support "pkg"
		// && p.PkgName != "_"
		if filepath.Base(genDir) != "pkg" {
			for _, sub := range []string{"pkg", "usr"} {
				rel, err := filepath.Rel(genDir, p.Dir)
				if err != nil {
					// should not happen
					return retErr(
						errors.Wrapf(err, token.NoPos, "invalid path"))
				}
				base := filepath.Join(cfg.ModuleRoot, modDir, sub)
				dir := filepath.Join(base, rel)
				dirs = append(dirs, [2]string{base, dir})
			}
		}
	} else {
		dirs = append(dirs, [2]string{cfg.ModuleRoot, p.Dir})
	}

	found := false
	for _, d := range dirs {
		info, err := ctxt.stat(d[1])
		if err == nil && info.IsDir() {
			found = true
			break
		}
	}

	if !found {
		return retErr(
			&PackageError{
				Message: errors.NewMessage("cannot find package %q",
					[]interface{}{p.DisplayPath}),
			})
	}

	// This algorithm assumes that multiple directories within cue.mod/*/
	// have the same module scope and that there are no invalid modules.
	inModule := false // if pkg == "_"
	for _, d := range dirs {
		if l.cfg.findRoot(d[1]) != "" {
			inModule = true
			break
		}
	}

	for _, d := range dirs {
		for dir := filepath.Clean(d[1]); ctxt.isDir(dir); {
			files, err := ctxt.readDir(dir)
			if err != nil && !os.IsNotExist(err) {
				return retErr(errors.Wrapf(err, pos, "import failed reading dir %v", dirs[0][1]))
			}
			for _, f := range files {
				if f.IsDir() {
					continue
				}
				if f.Name() == "-" {
					if _, err := cfg.fileSystem.stat("-"); !os.IsNotExist(err) {
						continue
					}
				}
				file, err := filetypes.ParseFile(f.Name(), filetypes.Input)
				if err != nil {
					p.UnknownFiles = append(p.UnknownFiles, &build.File{
						Filename:      f.Name(),
						ExcludeReason: errors.Newf(token.NoPos, "unknown filetype"),
					})
					continue // skip unrecognized file types
				}
				fp.add(pos, dir, file, importComment)
			}

			if p.PkgName == "" || !inModule || l.cfg.isRoot(dir) || dir == d[0] {
				break
			}

			// From now on we just ignore files that do not belong to the same
			// package.
			fp.ignoreOther = true

			parent, _ := filepath.Split(dir)
			parent = filepath.Clean(parent)

			if parent == dir || len(parent) < len(d[0]) {
				break
			}
			dir = parent
		}
	}

	all := []*build.Instance{}

	for _, p := range fp.pkgs {
		impPath, err := addImportQualifier(importPath(p.ImportPath), p.PkgName)
		p.ImportPath = string(impPath)
		if err != nil {
			p.ReportError(err)
		}

		all = append(all, p)
		rewriteFiles(p, cfg.ModuleRoot, false)
		if errs := fp.finalize(p); errs != nil {
			p.ReportError(errs)
			return all
		}

		l.addFiles(cfg.ModuleRoot, p)
		_ = p.Complete()
	}
	sort.Slice(all, func(i, j int) bool {
		return all[i].Dir < all[j].Dir
	})
	return all
}

// _loadFunc is the method used for the value of l.loadFunc.
func (l *loader) _loadFunc(pos token.Pos, path string) *build.Instance {
	impPath := importPath(path)
	if isLocalImport(path) {
		return l.cfg.newErrInstance(errors.Newf(pos, "relative import paths not allowed (%q)", path))
	}

	// is it a builtin?
	if strings.IndexByte(strings.Split(path, "/")[0], '.') == -1 {
		if l.cfg.StdRoot != "" {
			p := l.newInstance(pos, impPath)
			_ = l.importPkg(pos, p)
			return p
		}
		return nil
	}

	p := l.newInstance(pos, impPath)
	_ = l.importPkg(pos, p)
	return p
}

// newRelInstance returns a build instance from the given
// relative import path.
func (l *loader) newRelInstance(pos token.Pos, path, pkgName string) *build.Instance {
	if !isLocalImport(path) {
		panic(fmt.Errorf("non-relative import path %q passed to newRelInstance", path))
	}
	fs := l.cfg.fileSystem

	var err errors.Error
	dir := path

	p := l.cfg.Context.NewInstance(path, l.loadFunc)
	p.PkgName = pkgName
	p.DisplayPath = filepath.ToSlash(path)
	// p.ImportPath = string(dir) // compute unique ID.
	p.Root = l.cfg.ModuleRoot
	p.Module = l.cfg.Module

	dir = filepath.Join(l.cfg.Dir, filepath.FromSlash(path))

	if path != cleanImport(path) {
		err = errors.Append(err, l.errPkgf(nil,
			"non-canonical import path: %q should be %q", path, pathpkg.Clean(path)))
	}

	if importPath, e := l.importPathFromAbsDir(fsPath(dir), path); e != nil {
		// Detect later to keep error messages consistent.
	} else {
		p.ImportPath = string(importPath)
	}

	p.Dir = dir

	if fs.isAbsPath(path) || strings.HasPrefix(path, "/") {
		err = errors.Append(err, errors.Newf(pos,
			"absolute import path %q not allowed", path))
	}
	if err != nil {
		p.Err = errors.Append(p.Err, err)
		p.Incomplete = true
	}

	return p
}

func (l *loader) importPathFromAbsDir(absDir fsPath, key string) (importPath, errors.Error) {
	if l.cfg.ModuleRoot == "" {
		return "", errors.Newf(token.NoPos,
			"cannot determine import path for %q (root undefined)", key)
	}

	dir := filepath.Clean(string(absDir))
	if !strings.HasPrefix(dir, l.cfg.ModuleRoot) {
		return "", errors.Newf(token.NoPos,
			"cannot determine import path for %q (dir outside of root)", key)
	}

	pkg := filepath.ToSlash(dir[len(l.cfg.ModuleRoot):])
	switch {
	case strings.HasPrefix(pkg, "/cue.mod/"):
		pkg = pkg[len("/cue.mod/"):]
		if pkg == "" {
			return "", errors.Newf(token.NoPos,
				"invalid package %q (root of %s)", key, modDir)
		}

		// TODO(legacy): remove.
	case strings.HasPrefix(pkg, "/pkg/"):
		pkg = pkg[len("/pkg/"):]
		if pkg == "" {
			return "", errors.Newf(token.NoPos,
				"invalid package %q (root of %s)", key, pkgDir)
		}

	case l.cfg.Module == "":
		return "", errors.Newf(token.NoPos,
			"cannot determine import path for %q (no module)", key)
	default:
		pkg = l.cfg.Module + pkg
	}

	name := l.cfg.Package
	switch name {
	case "_", "*":
		name = ""
	}

	return addImportQualifier(importPath(pkg), name)
}

func (l *loader) newInstance(pos token.Pos, p importPath) *build.Instance {
	dir, name, err := l.cfg.absDirFromImportPath(pos, p)
	i := l.cfg.Context.NewInstance(dir, l.loadFunc)
	i.Dir = dir
	i.PkgName = name
	i.DisplayPath = string(p)
	i.ImportPath = string(p)
	i.Root = l.cfg.ModuleRoot
	i.Module = l.cfg.Module
	i.Err = errors.Append(i.Err, err)

	return i
}
