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
	"sync"

	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
)

type PackageFunc func(ctx adt.Runtime) (*adt.Vertex, errors.Error)

func RegisterBuiltin(importPath string, f PackageFunc) {
	sharedIndex.RegisterBuiltin(importPath, f)
}

func (x *index) RegisterBuiltin(importPath string, f PackageFunc) {
	if x.builtinPaths == nil {
		x.builtinPaths = map[string]PackageFunc{}
		x.builtinShort = map[string]string{}
	}
	x.builtinPaths[importPath] = f
	base := path.Base(importPath)
	if _, ok := x.builtinShort[base]; ok {
		importPath = "" // Don't allow ambiguous base paths.
	}
	x.builtinShort[base] = importPath
}

var SharedRuntime = &Runtime{index: sharedIndex}

// BuiltinPackagePath converts a short-form builtin package identifier to its
// full path or "" if this doesn't exist.
func (x *Runtime) BuiltinPackagePath(path string) string {
	return x.index.shortBuiltinToPath(path)
}

// sharedIndex is used for indexing builtins and any other labels common to
// all instances.
var sharedIndex = newIndex()

// index maps conversions from label names to internal codes.
//
// All instances belonging to the same package should share this index.
type index struct {
	// lock is used to guard imports-related maps.
	// TODO: makes these per cuecontext.
	lock           sync.RWMutex
	imports        map[*adt.Vertex]*build.Instance
	importsByPath  map[string]*adt.Vertex
	importsByBuild map[*build.Instance]*adt.Vertex

	nextUniqueID uint64

	// These are initialized during Go package initialization time and do not
	// need to be guarded.
	builtinPaths map[string]PackageFunc // Full path
	builtinShort map[string]string      // Commandline shorthand

	typeCache sync.Map // map[reflect.Type]evaluated
}

func (i *index) getNextUniqueID() uint64 {
	// TODO: use atomic increment instead.
	i.lock.Lock()
	i.nextUniqueID++
	x := i.nextUniqueID
	i.lock.Unlock()
	return x
}

func newIndex() *index {
	i := &index{
		imports:        map[*adt.Vertex]*build.Instance{},
		importsByPath:  map[string]*adt.Vertex{},
		importsByBuild: map[*build.Instance]*adt.Vertex{},
	}
	return i
}

func (x *index) shortBuiltinToPath(id string) string {
	if x == nil || x.builtinPaths == nil {
		return ""
	}
	return x.builtinShort[id]
}

func (r *Runtime) AddInst(path string, key *adt.Vertex, p *build.Instance) {
	r.index.lock.Lock()
	defer r.index.lock.Unlock()

	x := r.index
	if key == nil {
		panic("key must not be nil")
	}
	x.imports[key] = p
	x.importsByBuild[p] = key
	if path != "" {
		x.importsByPath[path] = key
	}
}

func (r *Runtime) GetInstanceFromNode(key *adt.Vertex) *build.Instance {
	r.index.lock.RLock()
	defer r.index.lock.RUnlock()

	return r.index.imports[key]
}

func (r *Runtime) getNodeFromInstance(key *build.Instance) *adt.Vertex {
	r.index.lock.RLock()
	defer r.index.lock.RUnlock()

	return r.index.importsByBuild[key]
}

func (r *Runtime) LoadImport(importPath string) *adt.Vertex {
	r.index.lock.Lock()
	defer r.index.lock.Unlock()

	x := r.index

	key := x.importsByPath[importPath]
	if key != nil {
		return key
	}

	if x.builtinPaths != nil {
		if f := x.builtinPaths[importPath]; f != nil {
			p, err := f(r)
			if err != nil {
				return adt.ToVertex(&adt.Bottom{Err: err})
			}
			inst := &build.Instance{
				ImportPath: importPath,
				PkgName:    path.Base(importPath),
			}
			x.imports[p] = inst
			x.importsByPath[importPath] = p
			x.importsByBuild[inst] = p
			return p
		}
	}

	return key
}
