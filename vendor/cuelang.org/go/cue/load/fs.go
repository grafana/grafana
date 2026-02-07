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
	"bytes"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

type overlayFile struct {
	basename string
	contents []byte
	file     *ast.File
	modtime  time.Time
	isDir    bool
}

func (f *overlayFile) Name() string       { return f.basename }
func (f *overlayFile) Size() int64        { return int64(len(f.contents)) }
func (f *overlayFile) Mode() os.FileMode  { return 0644 }
func (f *overlayFile) ModTime() time.Time { return f.modtime }
func (f *overlayFile) IsDir() bool        { return f.isDir }
func (f *overlayFile) Sys() interface{}   { return nil }

// A fileSystem specifies the supporting context for a build.
type fileSystem struct {
	overlayDirs map[string]map[string]*overlayFile
	cwd         string
}

func (fs *fileSystem) getDir(dir string, create bool) map[string]*overlayFile {
	dir = filepath.Clean(dir)
	m, ok := fs.overlayDirs[dir]
	if !ok && create {
		m = map[string]*overlayFile{}
		fs.overlayDirs[dir] = m
	}
	return m
}

func (fs *fileSystem) init(c *Config) error {
	fs.cwd = c.Dir

	overlay := c.Overlay
	fs.overlayDirs = map[string]map[string]*overlayFile{}

	// Organize overlay
	for filename, src := range overlay {
		// TODO: do we need to further clean the path or check that the
		// specified files are within the root/ absolute files?
		dir, base := filepath.Split(filename)
		m := fs.getDir(dir, true)

		b, file, err := src.contents()
		if err != nil {
			return err
		}
		m[base] = &overlayFile{
			basename: base,
			contents: b,
			file:     file,
			modtime:  time.Now(),
		}

		for {
			prevdir := dir
			dir, base = filepath.Split(filepath.Dir(dir))
			if dir == prevdir || dir == "" {
				break
			}
			m := fs.getDir(dir, true)
			if m[base] == nil {
				m[base] = &overlayFile{
					basename: base,
					modtime:  time.Now(),
					isDir:    true,
				}
			}
		}
	}
	return nil
}

func (fs *fileSystem) joinPath(elem ...string) string {
	return filepath.Join(elem...)
}

func (fs *fileSystem) splitPathList(s string) []string {
	return filepath.SplitList(s)
}

func (fs *fileSystem) isAbsPath(path string) bool {
	return filepath.IsAbs(path)
}

func (fs *fileSystem) makeAbs(path string) string {
	if fs.isAbsPath(path) {
		return path
	}
	return filepath.Clean(filepath.Join(fs.cwd, path))
}

func (fs *fileSystem) isDir(path string) bool {
	path = fs.makeAbs(path)
	if fs.getDir(path, false) != nil {
		return true
	}
	fi, err := os.Stat(path)
	return err == nil && fi.IsDir()
}

func (fs *fileSystem) hasSubdir(root, dir string) (rel string, ok bool) {
	// Try using paths we received.
	if rel, ok = hasSubdir(root, dir); ok {
		return
	}

	// Try expanding symlinks and comparing
	// expanded against unexpanded and
	// expanded against expanded.
	rootSym, _ := filepath.EvalSymlinks(root)
	dirSym, _ := filepath.EvalSymlinks(dir)

	if rel, ok = hasSubdir(rootSym, dir); ok {
		return
	}
	if rel, ok = hasSubdir(root, dirSym); ok {
		return
	}
	return hasSubdir(rootSym, dirSym)
}

func hasSubdir(root, dir string) (rel string, ok bool) {
	const sep = string(filepath.Separator)
	root = filepath.Clean(root)
	if !strings.HasSuffix(root, sep) {
		root += sep
	}
	dir = filepath.Clean(dir)
	if !strings.HasPrefix(dir, root) {
		return "", false
	}
	return filepath.ToSlash(dir[len(root):]), true
}

func (fs *fileSystem) readDir(path string) ([]os.FileInfo, errors.Error) {
	path = fs.makeAbs(path)
	m := fs.getDir(path, false)
	items, err := ioutil.ReadDir(path)
	if err != nil {
		if !os.IsNotExist(err) || m == nil {
			return nil, errors.Wrapf(err, token.NoPos, "readDir")
		}
	}
	if m != nil {
		done := map[string]bool{}
		for i, fi := range items {
			done[fi.Name()] = true
			if o := m[fi.Name()]; o != nil {
				items[i] = o
			}
		}
		for _, o := range m {
			if !done[o.Name()] {
				items = append(items, o)
			}
		}
		sort.Slice(items, func(i, j int) bool {
			return items[i].Name() < items[j].Name()
		})
	}
	return items, nil
}

func (fs *fileSystem) getOverlay(path string) *overlayFile {
	dir, base := filepath.Split(path)
	if m := fs.getDir(dir, false); m != nil {
		return m[base]
	}
	return nil
}

func (fs *fileSystem) stat(path string) (os.FileInfo, errors.Error) {
	path = fs.makeAbs(path)
	if fi := fs.getOverlay(path); fi != nil {
		return fi, nil
	}
	fi, err := os.Stat(path)
	if err != nil {
		return nil, errors.Wrapf(err, token.NoPos, "stat")
	}
	return fi, nil
}

func (fs *fileSystem) lstat(path string) (os.FileInfo, errors.Error) {
	path = fs.makeAbs(path)
	if fi := fs.getOverlay(path); fi != nil {
		return fi, nil
	}
	fi, err := os.Lstat(path)
	if err != nil {
		return nil, errors.Wrapf(err, token.NoPos, "stat")
	}
	return fi, nil
}

func (fs *fileSystem) openFile(path string) (io.ReadCloser, errors.Error) {
	path = fs.makeAbs(path)
	if fi := fs.getOverlay(path); fi != nil {
		return ioutil.NopCloser(bytes.NewReader(fi.contents)), nil
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, errors.Wrapf(err, token.NoPos, "load")
	}
	return f, nil
}

var skipDir = errors.Newf(token.NoPos, "skip directory")

type walkFunc func(path string, info os.FileInfo, err errors.Error) errors.Error

func (fs *fileSystem) walk(root string, f walkFunc) error {
	fi, err := fs.lstat(root)
	if err != nil {
		err = f(root, fi, err)
	} else if !fi.IsDir() {
		return errors.Newf(token.NoPos, "path %q is not a directory", root)
	} else {
		err = fs.walkRec(root, fi, f)
	}
	if err == skipDir {
		return nil
	}
	return err

}

func (fs *fileSystem) walkRec(path string, info os.FileInfo, f walkFunc) errors.Error {
	if !info.IsDir() {
		return f(path, info, nil)
	}

	dir, err := fs.readDir(path)
	err1 := f(path, info, err)

	// If err != nil, walk can't walk into this directory.
	// err1 != nil means walkFn want walk to skip this directory or stop walking.
	// Therefore, if one of err and err1 isn't nil, walk will return.
	if err != nil || err1 != nil {
		// The caller's behavior is controlled by the return value, which is decided
		// by walkFn. walkFn may ignore err and return nil.
		// If walkFn returns SkipDir, it will be handled by the caller.
		// So walk should return whatever walkFn returns.
		return err1
	}

	for _, info := range dir {
		filename := fs.joinPath(path, info.Name())
		err = fs.walkRec(filename, info, f)
		if err != nil {
			if !info.IsDir() || err != skipDir {
				return err
			}
		}
	}
	return nil
}
