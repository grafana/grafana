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

// Package subsume defines various subsumption relations.
package subsume

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
)

// Profile configures the type of subsumption. One should typically use one
// of the preconfigured profiles.
type Profile struct {
	// Final indicates subsumption should only consider fields that are relevant
	// to data mode, and ignore definitions, hidden fields, pattern constraints
	// and additional constraints.
	Final bool

	// Defaults indicate that default values should be used for the subsumed
	// value.
	Defaults bool

	// LeftDefaults indicates that the default value of the subsuming value
	// needs to be taken. This is necessary for simplifications like trim
	// and simplifying disjunctions.
	LeftDefault bool

	// Ignore optional fields.
	IgnoreOptional bool

	// IgnoreClosedness ignores closedness of structs and is used for comparing
	// APIs.
	IgnoreClosedness bool
}

var Simplify = Profile{
	LeftDefault: true,
}

var CUE = Profile{}

// Final checks subsumption interpreting the subsumed value as data.
var Final = Profile{
	Final:    true,
	Defaults: true,
}

// FinalOpen exists as an artifact of the old API. One should probably not use
// this.
var FinalOpen = Profile{
	Final:            true,
	Defaults:         true,
	IgnoreClosedness: true,
}

// API is subsumption used for APIs.
var API = Profile{
	IgnoreClosedness: true,
}

// Value subsumes two values based on their logical (evaluated) values.
func Value(ctx *adt.OpContext, a, b adt.Value) errors.Error {
	return CUE.Value(ctx, a, b)
}

func (p *Profile) Value(ctx *adt.OpContext, a, b adt.Value) errors.Error {
	s := subsumer{ctx: ctx, Profile: *p}
	if !s.values(a, b) {
		return s.getError()
	}
	return nil // ignore errors here even if there are some.
}

// Check reports whether b is an instance of a.
func (p *Profile) Check(ctx *adt.OpContext, a, b adt.Value) bool {
	s := subsumer{ctx: ctx, Profile: *p}
	return s.values(a, b)
}

func isBottom(x adt.Node) bool {
	b, _ := x.(*adt.Bottom)
	return b != nil
}

type subsumer struct {
	ctx  *adt.OpContext
	errs errors.Error

	Profile

	inexact bool // If true, the result could be a false negative.
	missing adt.Feature
	gt      adt.Value
	lt      adt.Value
}

func (s *subsumer) errf(msg string, args ...interface{}) {
	b := s.ctx.NewErrf(msg, args...)
	s.errs = errors.Append(s.errs, b.Err)
}

func unifyValue(c *adt.OpContext, a, b adt.Value) adt.Value {
	v := &adt.Vertex{}
	v.AddConjunct(adt.MakeRootConjunct(c.Env(0), a))
	v.AddConjunct(adt.MakeRootConjunct(c.Env(0), b))
	x, _ := c.Evaluate(c.Env(0), v)
	return x
}

func (s *subsumer) getError() (err errors.Error) {
	c := s.ctx
	// src := binSrc(token.NoPos, opUnify, gt, lt)
	if s.gt != nil && s.lt != nil {
		// src := binSrc(token.NoPos, opUnify, s.gt, s.lt)
		if s.missing != 0 {
			s.errf("missing field %q", s.missing.SelectorString(c))
		} else if b, ok := unifyValue(c, s.gt, s.lt).(*adt.Bottom); !ok {
			s.errf("value not an instance")
		} else {
			s.errs = errors.Append(s.errs, b.Err)
		}
	}
	if s.errs == nil {
		s.errf("value not an instance")
	}
	err = s.errs
	if s.inexact {
		err = internal.DecorateError(internal.ErrInexact, err)
	}
	return err
}
