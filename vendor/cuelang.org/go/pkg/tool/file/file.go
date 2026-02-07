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

package file

import (
	"io/ioutil"
	"os"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/task"
)

func init() {
	task.Register("tool/file.Read", newReadCmd)
	task.Register("tool/file.Append", newAppendCmd)
	task.Register("tool/file.Create", newCreateCmd)
	task.Register("tool/file.Glob", newGlobCmd)
	task.Register("tool/file.Mkdir", newMkdirCmd)
	task.Register("tool/file.MkdirTemp", newMkdirTempCmd)
	task.Register("tool/file.RemoveAll", newRemoveAllCmd)
}

func newReadCmd(v cue.Value) (task.Runner, error)      { return &cmdRead{}, nil }
func newAppendCmd(v cue.Value) (task.Runner, error)    { return &cmdAppend{}, nil }
func newCreateCmd(v cue.Value) (task.Runner, error)    { return &cmdCreate{}, nil }
func newGlobCmd(v cue.Value) (task.Runner, error)      { return &cmdGlob{}, nil }
func newMkdirCmd(v cue.Value) (task.Runner, error)     { return &cmdMkdir{}, nil }
func newMkdirTempCmd(v cue.Value) (task.Runner, error) { return &cmdMkdirTemp{}, nil }
func newRemoveAllCmd(v cue.Value) (task.Runner, error) { return &cmdRemoveAll{}, nil }

type cmdRead struct{}
type cmdAppend struct{}
type cmdCreate struct{}
type cmdGlob struct{}
type cmdMkdir struct{}
type cmdMkdirTemp struct{}
type cmdRemoveAll struct{}

func (c *cmdRead) Run(ctx *task.Context) (res interface{}, err error) {
	filename := ctx.String("filename")
	if ctx.Err != nil {
		return nil, ctx.Err
	}

	b, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	update := map[string]interface{}{"contents": b}

	switch v := ctx.Lookup("contents"); v.IncompleteKind() {
	case cue.BytesKind:
		// already set above
	case cue.StringKind:
		update["contents"] = string(b)
	}
	return update, nil
}

func (c *cmdAppend) Run(ctx *task.Context) (res interface{}, err error) {
	var (
		filename = filepath.FromSlash(ctx.String("filename"))
		mode     = ctx.Int64("permissions")
		b        = ctx.Bytes("contents")
	)
	if ctx.Err != nil {
		return nil, ctx.Err
	}

	f, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, os.FileMode(mode))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := f.Write(b); err != nil {
		return nil, err
	}
	return nil, nil
}

func (c *cmdCreate) Run(ctx *task.Context) (res interface{}, err error) {
	var (
		filename = filepath.FromSlash(ctx.String("filename"))
		mode     = ctx.Int64("permissions")
		b        = ctx.Bytes("contents")
	)
	if ctx.Err != nil {
		return nil, ctx.Err
	}

	return nil, ioutil.WriteFile(filename, b, os.FileMode(mode))
}

func (c *cmdGlob) Run(ctx *task.Context) (res interface{}, err error) {
	glob := ctx.String("glob")
	if ctx.Err != nil {
		return nil, ctx.Err
	}
	m, err := filepath.Glob(glob)
	for i, s := range m {
		m[i] = filepath.ToSlash(s)
	}
	files := map[string]interface{}{"files": m}
	return files, err
}

func (c *cmdMkdir) Run(ctx *task.Context) (res interface{}, err error) {
	path := ctx.String("path")
	mode := ctx.Int64("permissions")
	createParents, _ := ctx.Lookup("createParents").Bool()

	if ctx.Err != nil {
		return nil, ctx.Err
	}

	if createParents {
		if err := os.MkdirAll(path, os.FileMode(mode)); err != nil {
			return nil, errors.Wrapf(err, ctx.Obj.Pos(), "failed to create directory")
		}
	} else {
		dir, err := os.Stat(path)
		if err == nil && dir.IsDir() {
			return nil, nil
		}
		if err := os.Mkdir(path, os.FileMode(mode)); err != nil {
			return nil, errors.Wrapf(err, ctx.Obj.Pos(), "failed to create directory")
		}
	}

	return nil, nil
}

func (c *cmdMkdirTemp) Run(ctx *task.Context) (res interface{}, err error) {
	dir := ctx.String("dir")
	pattern := ctx.String("pattern")

	if ctx.Err != nil {
		return nil, ctx.Err
	}

	path, err := os.MkdirTemp(dir, pattern)
	if err != nil {
		return nil, errors.Wrapf(err, ctx.Obj.Pos(), "failed to create temporary directory")
	}

	return map[string]interface{}{"path": path}, nil
}

func (c *cmdRemoveAll) Run(ctx *task.Context) (res interface{}, err error) {
	path := ctx.String("path")

	if ctx.Err != nil {
		return nil, ctx.Err
	}

	if _, err := os.Stat(path); err != nil {
		return map[string]interface{}{"success": false}, nil
	}

	if err := os.RemoveAll(path); err != nil {
		return nil, errors.Wrapf(err, ctx.Obj.Pos(), "failed to remove path")
	}

	return map[string]interface{}{"success": true}, nil
}
