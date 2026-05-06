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

package internal

import (
	"fmt"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
)

type Bottomer interface {
	error
	Bottom() *adt.Bottom
}

type callError struct {
	b *adt.Bottom
}

func (e *callError) Error() string {
	return fmt.Sprint(e.b)
}

func (c *CallCtxt) errf(underlying error, format string, args ...interface{}) {
	var errs errors.Error
	var code adt.ErrorCode
	switch x := underlying.(type) {
	case nil:
	case Bottomer:
		b := x.Bottom()
		errs = b.Err
		code = b.Code
	case errors.Error:
		errs = x
	case error:
		errs = errors.Promote(x, "")
	}
	vErr := c.ctx.NewPosf(c.Pos(), format, args...)
	c.Err = &callError{&adt.Bottom{Code: code, Err: errors.Wrap(vErr, errs)}}
}

func (c *CallCtxt) errcf(code adt.ErrorCode, format string, args ...interface{}) {
	err := c.ctx.NewErrf(format, args...)
	err.Code = code
	c.Err = &callError{err}
}

func wrapCallErr(c *CallCtxt, b *adt.Bottom) *adt.Bottom {
	var err errors.Error
	for _, e := range errors.Errors(b.Err) {
		ne := c.ctx.Newf("error in call to %s", c.builtin.name(c.ctx))
		err = errors.Append(err, errors.Wrap(ne, e))
	}
	return &adt.Bottom{Code: b.Code, Err: err}
}

func (c *CallCtxt) invalidArgType(arg adt.Value, i int, typ string, err error) {
	if ve, ok := err.(Bottomer); ok && ve.Bottom().IsIncomplete() {
		c.Err = ve
		return
	}
	if b, ok := adt.Unwrap(arg).(*adt.Bottom); ok {
		c.Err = b
		return
	}
	// TODO: make these permanent errors if the value did not originate from
	// a reference.
	if err != nil {
		c.errf(err,
			"cannot use %s (type %s) as %s in argument %d to %s",
			arg, arg.Kind(), typ, i, c.Name())
	} else {
		c.errf(err,
			"cannot use %s (type %s) as %s in argument %d to %s",
			arg, arg.Kind(), typ, i, c.Name())
	}
}
