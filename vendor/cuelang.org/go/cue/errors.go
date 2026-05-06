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

package cue

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/runtime"
)

func (v Value) toErr(b *adt.Bottom) (err errors.Error) {
	errs := errors.Errors(b.Err)
	if len(errs) > 1 {
		for _, e := range errs {
			bb := *b
			bb.Err = e
			err = errors.Append(err, &valueError{v: v, err: &bb})
		}
		return err
	}
	return &valueError{v: v, err: b}
}

var _ errors.Error = &valueError{}

// A valueError is returned as a result of evaluating a value.
type valueError struct {
	v   Value
	err *adt.Bottom
}

func (e *valueError) Unwrap() error {
	if e.err.Err == nil {
		return nil
	}
	return errors.Unwrap(e.err.Err)
}

func (e *valueError) Bottom() *adt.Bottom { return e.err }

func (e *valueError) Error() string {
	return errors.String(e)
}

func (e *valueError) Position() token.Pos {
	if e.err.Err != nil {
		return e.err.Err.Position()
	}
	src := e.err.Source()
	if src == nil {
		return token.NoPos
	}
	return src.Pos()
}

func (e *valueError) InputPositions() []token.Pos {
	if e.err.Err == nil {
		return nil
	}
	return e.err.Err.InputPositions()
}

func (e *valueError) Msg() (string, []interface{}) {
	if e.err.Err == nil {
		return "", nil
	}
	return e.err.Err.Msg()
}

func (e *valueError) Path() (a []string) {
	if e.err.Err != nil {
		a = e.err.Err.Path()
		if a != nil {
			return a
		}
	}
	return pathToStrings(e.v.Path())
}

var errNotExists = &adt.Bottom{
	Code:      adt.IncompleteError,
	NotExists: true,
	Err:       errors.Newf(token.NoPos, "undefined value"),
}

func mkErr(idx *runtime.Runtime, src adt.Node, args ...interface{}) *adt.Bottom {
	var e *adt.Bottom
	var code adt.ErrorCode = -1
outer:
	for i, a := range args {
		switch x := a.(type) {
		case adt.ErrorCode:
			code = x
		case *adt.Bottom:
			e = adt.CombineErrors(nil, e, x)
		case []*adt.Bottom:
			for _, b := range x {
				e = adt.CombineErrors(nil, e, b)
			}
		case errors.Error:
			e = adt.CombineErrors(nil, e, &adt.Bottom{Err: x})
		case adt.Expr:
		case string:
			args := args[i+1:]
			// Do not expand message so that errors can be localized.
			pos := pos(src)
			if code < 0 {
				code = 0
			}
			e = adt.CombineErrors(nil, e, &adt.Bottom{
				Code: code,
				Err:  errors.Newf(pos, x, args...),
			})
			break outer
		}
	}
	if code >= 0 {
		e.Code = code
	}
	return e
}
