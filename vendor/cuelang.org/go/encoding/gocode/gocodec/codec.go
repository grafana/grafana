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

// Package codec converts Go to and from CUE and validates Go values based on
// CUE constraints.
//
// CUE constraints can be used to validate Go types as well as fill out
// missing struct fields that are implied from the constraints and the values
// already defined by the struct value.
package gocodec

import (
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/internal/value"
)

// Config has no options yet, but is defined for future extensibility.
type Config struct {
}

// A Codec decodes and encodes CUE from and to Go values and validates and
// completes Go values based on CUE templates.
type Codec struct {
	runtime *cue.Context
	mutex   sync.RWMutex
}

// New creates a new Codec for the given instance.
//
// It is safe to use the methods of Codec concurrently as long as the given
// Runtime is not used elsewhere while using Codec. However, only the concurrent
// use of Decode, Validate, and Complete is efficient.
func New(r *cue.Runtime, c *Config) *Codec {
	return &Codec{runtime: value.ConvertToContext(r)}
}

// ExtractType extracts a CUE value from a Go type.
//
// The type represented by x is converted as the underlying type. Specific
// values, such as map or slice elements or field values of structs are ignored.
// If x is of type reflect.Type, the type represented by x is extracted.
//
// Fields of structs can be annoted using additional constrains using the 'cue'
// field tag. The value of the tag is a CUE expression, which may contain
// references to the JSON name of other fields in a struct.
//
//	type Sum struct {
//	    A int `cue:"c-b" json:"a,omitempty"`
//	    B int `cue:"c-a" json:"b,omitempty"`
//	    C int `cue:"a+b" json:"c,omitempty"`
//	}
func (c *Codec) ExtractType(x interface{}) (cue.Value, error) {
	// ExtractType cannot introduce new fields on repeated calls. We could
	// consider optimizing the lock usage based on this property.
	c.mutex.Lock()
	defer c.mutex.Unlock()

	return fromGoType(c.runtime, x)
}

// TODO: allow extracting constraints and type info separately?

// Decode converts x to a CUE value.
//
// If x is of type reflect.Value it will convert the value represented by x.
func (c *Codec) Decode(x interface{}) (cue.Value, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Depending on the type, can introduce new labels on repeated calls.
	return fromGoValue(c.runtime, x, false)
}

// Encode converts v to a Go value.
func (c *Codec) Encode(v cue.Value, x interface{}) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return v.Decode(x)
}

var defaultCodec = New(value.ConvertToRuntime(cuecontext.New()), nil)

// Validate calls Validate on a default Codec for the type of x.
func Validate(x interface{}) error {
	c := defaultCodec
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	r := defaultCodec.runtime
	v, err := fromGoType(r, x)
	if err != nil {
		return err
	}
	w, err := fromGoValue(r, x, false)
	if err != nil {
		return err
	}
	v = v.Unify(w)
	if err := v.Validate(); err != nil {
		return err
	}
	return nil
}

// Validate checks whether x satisfies the constraints defined by v.
//
// The given value must be created using the same Runtime with which c was
// initialized.
func (c *Codec) Validate(v cue.Value, x interface{}) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	r := checkAndForkContext(c.runtime, v)
	w, err := fromGoValue(r, x, false)
	if err != nil {
		return err
	}
	return w.Unify(v).Err()
}

// Complete sets previously undefined values in x that can be uniquely
// determined form the constraints defined by v if validation passes, or returns
// an error, without modifying anything, otherwise.
//
// Only undefined values are modified. A value is considered undefined if it is
// pointer type and is nil or if it is a field with a zero value that has a json
// tag with the omitempty flag.
//
// The given value must be created using the same Runtime with which c was
// initialized.
//
// Complete does a JSON round trip. This means that data not preserved in such a
// round trip, such as the location name of a time.Time, is lost after a
// successful update.
func (c *Codec) Complete(v cue.Value, x interface{}) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	r := checkAndForkContext(c.runtime, v)
	w, err := fromGoValue(r, x, true)
	if err != nil {
		return err
	}

	w = w.Unify(v)
	if err := w.Validate(cue.Concrete(true)); err != nil {
		return err
	}
	return w.Decode(x)
}

func fromGoValue(r *cue.Context, x interface{}, allowDefault bool) (cue.Value, error) {
	v := value.FromGoValue(r, x, allowDefault)
	if err := v.Err(); err != nil {
		return v, err
	}
	return v, nil
}

func fromGoType(r *cue.Context, x interface{}) (cue.Value, error) {
	v := value.FromGoType(r, x)
	if err := v.Err(); err != nil {
		return v, err
	}
	return v, nil
}

func checkAndForkContext(r *cue.Context, v cue.Value) *cue.Context {
	rr := v.Context()
	if r != rr {
		panic("value not from same runtime")
	}
	return rr
}
