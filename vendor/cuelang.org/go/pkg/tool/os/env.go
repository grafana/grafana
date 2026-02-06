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

package os

import (
	"os"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/cli"
	"cuelang.org/go/internal/task"
)

func init() {
	task.Register("tool/os.Getenv", newGetenvCmd)
	task.Register("tool/os.Environ", newEnvironCmd)

	// TODO:
	// Tasks:
	// - Exit?
	// - Getwd/ Setwd (or in tool/file?)

	// Functions:
	// - Hostname
	// - UserCache/Home/Config (or in os/user?)
}

type getenvCmd struct{}

func newGetenvCmd(v cue.Value) (task.Runner, error) {
	return &getenvCmd{}, nil
}

func (c *getenvCmd) Run(ctx *task.Context) (res interface{}, err error) {
	iter, err := ctx.Obj.Fields()
	if err != nil {
		return nil, err
	}

	update := map[string]interface{}{}

	for iter.Next() {
		name := iter.Label()
		if strings.HasPrefix(name, "$") {
			continue
		}
		v := iter.Value()

		if err := v.Err(); err != nil {
			return nil, err
		}

		if err := validateEntry(name, v); err != nil {
			return nil, err
		}

		str, ok := os.LookupEnv(name)
		if !ok {
			update[name] = nil
			continue
		}
		x, err := fromString(name, str, v)
		if err != nil {
			return nil, err
		}
		update[name] = x
	}

	return update, nil
}

type environCmd struct{}

func newEnvironCmd(v cue.Value) (task.Runner, error) {
	return &environCmd{}, nil
}

func (c *environCmd) Run(ctx *task.Context) (res interface{}, err error) {
	iter, err := ctx.Obj.Fields()
	if err != nil {
		return nil, err
	}

	update := map[string]interface{}{}

	for _, kv := range os.Environ() {
		a := strings.SplitN(kv, "=", 2)

		name := a[0]
		str := a[1]

		if v := ctx.Obj.Lookup(name); v.Exists() {
			update[name], err = fromString(name, str, v)
			if err != nil {
				return nil, err
			}
		} else {
			update[name] = str
		}
	}

	for iter.Next() {
		name := iter.Label()
		if strings.HasPrefix(name, "$") {
			continue
		}
		v := iter.Value()
		if err := v.Err(); err != nil {
			return nil, err
		}
		if err := validateEntry(name, v); err != nil {
			return nil, err
		}
		if _, ok := update[name]; !ok {
			update[name] = nil
		}
	}

	return update, nil
}

func validateEntry(name string, v cue.Value) error {
	if k := v.IncompleteKind(); k&^(cue.NumberKind|cue.NullKind|cue.BoolKind|cue.StringKind) != 0 {
		return errors.Newf(v.Pos(),
			"invalid type %s for environment variable %s", k, name)
	}
	return nil
}

func fromString(name, str string, v cue.Value) (x ast.Node, err error) {
	k := v.IncompleteKind()
	return cli.ParseValue(v.Pos(), name, str, k)
}
