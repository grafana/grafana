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
	// TODO: remove this usage

	"os"
	"path"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// TODO: should be matched from module file only.
// The pattern is either "all" (all packages), "std" (standard packages),
// "cmd" (standard commands), or a path including "...".
func (l *loader) matchPackages(pattern, pkgName string) *match {
	// cfg := l.cfg
	m := &match{
		Pattern: pattern,
		Literal: false,
	}
	// match := func(string) bool { return true }
	// treeCanMatch := func(string) bool { return true }
	// if !isMetaPackage(pattern) {
	// 	match = matchPattern(pattern)
	// 	treeCanMatch = treeCanMatchPattern(pattern)
	// }

	// have := map[string]bool{
	// 	"builtin": true, // ignore pseudo-package that exists only for documentation
	// }

	// for _, src := range cfg.srcDirs() {
	// 	if pattern == "std" || pattern == "cmd" {
	// 		continue
	// 	}
	// 	src = filepath.Clean(src) + string(filepath.Separator)
	// 	root := src
	// 	if pattern == "cmd" {
	// 		root += "cmd" + string(filepath.Separator)
	// 	}
	// 	filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
	// 		if err != nil || path == src {
	// 			return nil
	// 		}

	// 		want := true
	// 		// Avoid .foo, _foo, and testdata directory trees.
	// 		_, elem := filepath.Split(path)
	// 		if strings.HasPrefix(elem, ".") || strings.HasPrefix(elem, "_") || elem == "testdata" {
	// 			want = false
	// 		}

	// 		name := filepath.ToSlash(path[len(src):])
	// 		if pattern == "std" && (!isStandardImportPath(name) || name == "cmd") {
	// 			// The name "std" is only the standard library.
	// 			// If the name is cmd, it's the root of the command tree.
	// 			want = false
	// 		}
	// 		if !treeCanMatch(name) {
	// 			want = false
	// 		}

	// 		if !fi.IsDir() {
	// 			if fi.Mode()&os.ModeSymlink != 0 && want {
	// 				if target, err := os.Stat(path); err == nil && target.IsDir() {
	// 					fmt.Fprintf(os.Stderr, "warning: ignoring symlink %s\n", path)
	// 				}
	// 			}
	// 			return nil
	// 		}
	// 		if !want {
	// 			return skipDir
	// 		}

	// 		if have[name] {
	// 			return nil
	// 		}
	// 		have[name] = true
	// 		if !match(name) {
	// 			return nil
	// 		}
	// 		pkg := l.importPkg(".", path)
	// 		if err := pkg.Error; err != nil {
	// 			if _, noGo := err.(*noCUEError); noGo {
	// 				return nil
	// 			}
	// 		}

	// 		// If we are expanding "cmd", skip main
	// 		// packages under cmd/vendor. At least as of
	// 		// March, 2017, there is one there for the
	// 		// vendored pprof tool.
	// 		if pattern == "cmd" && strings.HasPrefix(pkg.DisplayPath, "cmd/vendor") && pkg.PkgName == "main" {
	// 			return nil
	// 		}

	// 		m.Pkgs = append(m.Pkgs, pkg)
	// 		return nil
	// 	})
	// }
	return m
}

// matchPackagesInFS is like allPackages but is passed a pattern
// beginning ./ or ../, meaning it should scan the tree rooted
// at the given directory. There are ... in the pattern too.
// (See go help packages for pattern syntax.)
func (l *loader) matchPackagesInFS(pattern, pkgName string) *match {
	c := l.cfg
	m := &match{
		Pattern: pattern,
		Literal: false,
	}

	// Find directory to begin the scan.
	// Could be smarter but this one optimization
	// is enough for now, since ... is usually at the
	// end of a path.
	i := strings.Index(pattern, "...")
	dir, _ := path.Split(pattern[:i])

	root := l.abs(dir)

	// Find new module root from here or check there are no additional
	// cue.mod files between here and the next module.

	if !hasFilepathPrefix(root, c.ModuleRoot) {
		m.Err = errors.Newf(token.NoPos,
			"cue: pattern %s refers to dir %s, outside module root %s",
			pattern, root, c.ModuleRoot)
		return m
	}

	pkgDir := filepath.Join(root, modDir)
	// TODO(legacy): remove
	pkgDir2 := filepath.Join(root, "pkg")

	_ = c.fileSystem.walk(root, func(path string, fi os.FileInfo, err errors.Error) errors.Error {
		if err != nil || !fi.IsDir() {
			return nil
		}
		if path == pkgDir || path == pkgDir2 {
			return skipDir
		}

		top := path == root

		// Avoid .foo, _foo, and testdata directory trees, but do not avoid "." or "..".
		_, elem := filepath.Split(path)
		dot := strings.HasPrefix(elem, ".") && elem != "." && elem != ".."
		if dot || strings.HasPrefix(elem, "_") || (elem == "testdata" && !top) {
			return skipDir
		}

		if !top {
			// Ignore other modules found in subdirectories.
			if _, err := c.fileSystem.stat(filepath.Join(path, modDir)); err == nil {
				return skipDir
			}
		}

		// name := prefix + filepath.ToSlash(path)
		// if !match(name) {
		// 	return nil
		// }

		// We keep the directory if we can import it, or if we can't import it
		// due to invalid CUE source files. This means that directories
		// containing parse errors will be built (and fail) instead of being
		// silently skipped as not matching the pattern.
		// Do not take root, as we want to stay relative
		// to one dir only.
		relPath, e := filepath.Rel(c.Dir, path)
		if e != nil {
			panic(err) // Should never happen because c.Dir is absolute.
		}
		relPath = "./" + filepath.ToSlash(relPath)
		// TODO: consider not doing these checks here.
		inst := l.newRelInstance(token.NoPos, relPath, pkgName)
		pkgs := l.importPkg(token.NoPos, inst)
		for _, p := range pkgs {
			if err := p.Err; err != nil && (p == nil || len(p.InvalidFiles) == 0) {
				switch err.(type) {
				case nil:
					break
				case *NoFilesError:
					if c.DataFiles && len(p.OrphanedFiles) > 0 {
						break
					}
					return nil
				default:
					m.Err = errors.Append(m.Err, err)
				}
			}
		}

		m.Pkgs = append(m.Pkgs, pkgs...)
		return nil
	})
	return m
}

// importPaths returns the matching paths to use for the given command line.
// It calls ImportPathsQuiet and then WarnUnmatched.
func (l *loader) importPaths(patterns []string) []*match {
	matches := l.importPathsQuiet(patterns)
	warnUnmatched(matches)
	return matches
}

// importPathsQuiet is like ImportPaths but does not warn about patterns with no matches.
func (l *loader) importPathsQuiet(patterns []string) []*match {
	var out []*match
	for _, a := range cleanPatterns(patterns) {
		if isMetaPackage(a) {
			out = append(out, l.matchPackages(a, l.cfg.Package))
			continue
		}

		orig := a
		pkgName := l.cfg.Package
		switch p := strings.IndexByte(a, ':'); {
		case p < 0:
		case p == 0:
			pkgName = a[1:]
			a = "."
		default:
			pkgName = a[p+1:]
			a = a[:p]
		}
		if pkgName == "*" {
			pkgName = ""
		}

		if strings.Contains(a, "...") {
			if isLocalImport(a) {
				out = append(out, l.matchPackagesInFS(a, pkgName))
			} else {
				out = append(out, l.matchPackages(a, pkgName))
			}
			continue
		}

		var p *build.Instance
		if isLocalImport(a) {
			p = l.newRelInstance(token.NoPos, a, pkgName)
		} else {
			p = l.newInstance(token.NoPos, importPath(orig))
		}

		pkgs := l.importPkg(token.NoPos, p)
		out = append(out, &match{Pattern: a, Literal: true, Pkgs: pkgs})
	}
	return out
}
