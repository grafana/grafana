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

// Package task provides a registry for tasks to be used by commands.
package task

import (
	"context"
	"io"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/value"
)

// A Context provides context for running a task.
type Context struct {
	Context context.Context

	Stdin  io.Reader
	Stdout io.Writer
	Stderr io.Writer
	Obj    cue.Value
	Err    errors.Error
}

func (c *Context) Lookup(field string) cue.Value {
	f := c.Obj.Lookup(field)
	if !f.Exists() {
		c.addErr(f, nil, "could not find field %q", field)
		return cue.Value{}
	}
	if err := f.Err(); err != nil {
		c.Err = errors.Append(c.Err, errors.Promote(err, "lookup"))
	}
	return f
}

func (c *Context) Int64(field string) int64 {
	f := c.Obj.Lookup(field)
	value, err := f.Int64()
	if err != nil {
		c.addErr(f, err, "invalid integer argument")
		return 0
	}
	return value
}

func (c *Context) String(field string) string {
	f := c.Obj.Lookup(field)
	value, err := f.String()
	if err != nil {
		c.addErr(f, err, "invalid string argument")
		return ""
	}
	return value
}

func (c *Context) Bytes(field string) []byte {
	f := c.Obj.Lookup(field)
	value, err := f.Bytes()
	if err != nil {
		c.addErr(f, err, "invalid bytes argument")
		return nil
	}
	return value
}

func (c *Context) addErr(v cue.Value, wrap error, format string, args ...interface{}) {

	err := &taskError{
		task:    c.Obj,
		v:       v,
		Message: errors.NewMessage(format, args),
	}
	c.Err = errors.Append(c.Err, errors.Wrap(err, wrap))
}

// taskError wraps some error values to retain position information about the
// error.
type taskError struct {
	task cue.Value
	v    cue.Value
	errors.Message
}

var _ errors.Error = &taskError{}

func (t *taskError) Path() (a []string) {
	for _, x := range t.v.Path().Selectors() {
		a = append(a, x.String())
	}
	return a
}

func (t *taskError) Position() token.Pos {
	return t.task.Pos()
}

func (t *taskError) InputPositions() (a []token.Pos) {
	_, nx := value.ToInternal(t.v)

	for _, x := range nx.Conjuncts {
		if src := x.Source(); src != nil {
			a = append(a, src.Pos())
		}
	}
	return a
}

// A RunnerFunc creates a Runner.
type RunnerFunc func(v cue.Value) (Runner, error)

// A Runner defines a command type.
type Runner interface {
	// Init is called with the original configuration before any task is run.
	// As a result, the configuration may be incomplete, but allows some
	// validation before tasks are kicked off.
	// Init(v cue.Value)

	// Runner runs given the current value and returns a new value which is to
	// be unified with the original result.
	Run(ctx *Context) (results interface{}, err error)
}

// Register registers a task for cue commands.
func Register(key string, f RunnerFunc) {
	runners.Store(key, f)
}

// Lookup returns the RunnerFunc for a key.
func Lookup(key string) RunnerFunc {
	v, ok := runners.Load(key)
	if !ok {
		return nil
	}
	return v.(RunnerFunc)
}

var runners sync.Map
