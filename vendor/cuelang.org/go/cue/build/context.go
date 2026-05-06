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

// Package build defines data types and utilities for defining CUE configuration
// instances.
//
// This package enforces the rules regarding packages and instances as defined
// in the spec, but it leaves any other details, as well as handling of modules,
// up to the implementation.
//
// A full implementation of instance loading can be found in the loader package.
//
// WARNING: this packages may change. It is fine to use load and cue, who both
// use this package.
package build

import (
	"context"

	"cuelang.org/go/cue/ast"
)

// A Context keeps track of state of building instances and caches work.
type Context struct {
	ctxt context.Context

	loader    LoadFunc
	parseFunc func(str string, src interface{}) (*ast.File, error)

	initialized bool

	imports map[string]*Instance
}

// NewInstance creates an instance for this Context.
func (c *Context) NewInstance(dir string, f LoadFunc) *Instance {
	if c == nil {
		c = &Context{}
	}
	if f == nil {
		f = c.loader
	}
	return &Instance{
		ctxt:     c,
		loadFunc: f,
		Dir:      dir,
	}
}

// Complete finishes the initialization of an instance. All files must have
// been added with AddFile before this call.
func (inst *Instance) Complete() error {
	if inst.done {
		return inst.Err
	}
	inst.done = true

	err := inst.complete()
	if err != nil {
		inst.ReportError(err)
	}
	if inst.Err != nil {
		inst.Incomplete = true
		return inst.Err
	}
	return nil
}

func (c *Context) init() {
	if !c.initialized {
		c.initialized = true
		c.ctxt = context.Background()
		c.imports = map[string]*Instance{}
	}
}

// Options:
// - certain parse modes
// - parallellism
// - error handler (allows cancelling the context)
// - file set.

// NewContext creates a new build context.
//
// All instances must be created with a context.
func NewContext(opts ...Option) *Context {
	c := &Context{}
	for _, o := range opts {
		o(c)
	}
	c.init()
	return c
}

// Option define build options.
type Option func(c *Context)

// Loader sets parsing options.
func Loader(f LoadFunc) Option {
	return func(c *Context) { c.loader = f }
}

// ParseFile is called to read and parse each file
// when building syntax tree.
// It must be safe to call ParseFile simultaneously from multiple goroutines.
// If ParseFile is nil, the loader will uses parser.ParseFile.
//
// ParseFile should parse the source from src and use filename only for
// recording position information.
//
// An application may supply a custom implementation of ParseFile
// to change the effective file contents or the behavior of the parser,
// or to modify the syntax tree. For example, changing the backwards
// compatibility.
func ParseFile(f func(filename string, src interface{}) (*ast.File, error)) Option {
	return func(c *Context) { c.parseFunc = f }
}
