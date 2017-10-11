// Copyright 2011 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
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

package oglematchers

import (
	"errors"
	"fmt"
	"math"
	"reflect"
)

// LessThan returns a matcher that matches integer, floating point, or strings
// values v such that v < x. Comparison is not defined between numeric and
// string types, but is defined between all integer and floating point types.
//
// x must itself be an integer, floating point, or string type; otherwise,
// LessThan will panic.
func LessThan(x interface{}) Matcher {
	v := reflect.ValueOf(x)
	kind := v.Kind()

	switch {
	case isInteger(v):
	case isFloat(v):
	case kind == reflect.String:

	default:
		panic(fmt.Sprintf("LessThan: unexpected kind %v", kind))
	}

	return &lessThanMatcher{v}
}

type lessThanMatcher struct {
	limit reflect.Value
}

func (m *lessThanMatcher) Description() string {
	// Special case: make it clear that strings are strings.
	if m.limit.Kind() == reflect.String {
		return fmt.Sprintf("less than \"%s\"", m.limit.String())
	}

	return fmt.Sprintf("less than %v", m.limit.Interface())
}

func compareIntegers(v1, v2 reflect.Value) (err error) {
	err = errors.New("")

	switch {
	case isSignedInteger(v1) && isSignedInteger(v2):
		if v1.Int() < v2.Int() {
			err = nil
		}
		return

	case isSignedInteger(v1) && isUnsignedInteger(v2):
		if v1.Int() < 0 || uint64(v1.Int()) < v2.Uint() {
			err = nil
		}
		return

	case isUnsignedInteger(v1) && isSignedInteger(v2):
		if v1.Uint() <= math.MaxInt64 && int64(v1.Uint()) < v2.Int() {
			err = nil
		}
		return

	case isUnsignedInteger(v1) && isUnsignedInteger(v2):
		if v1.Uint() < v2.Uint() {
			err = nil
		}
		return
	}

	panic(fmt.Sprintf("compareIntegers: %v %v", v1, v2))
}

func getFloat(v reflect.Value) float64 {
	switch {
	case isSignedInteger(v):
		return float64(v.Int())

	case isUnsignedInteger(v):
		return float64(v.Uint())

	case isFloat(v):
		return v.Float()
	}

	panic(fmt.Sprintf("getFloat: %v", v))
}

func (m *lessThanMatcher) Matches(c interface{}) (err error) {
	v1 := reflect.ValueOf(c)
	v2 := m.limit

	err = errors.New("")

	// Handle strings as a special case.
	if v1.Kind() == reflect.String && v2.Kind() == reflect.String {
		if v1.String() < v2.String() {
			err = nil
		}
		return
	}

	// If we get here, we require that we are dealing with integers or floats.
	v1Legal := isInteger(v1) || isFloat(v1)
	v2Legal := isInteger(v2) || isFloat(v2)
	if !v1Legal || !v2Legal {
		err = NewFatalError("which is not comparable")
		return
	}

	// Handle the various comparison cases.
	switch {
	// Both integers
	case isInteger(v1) && isInteger(v2):
		return compareIntegers(v1, v2)

	// At least one float32
	case v1.Kind() == reflect.Float32 || v2.Kind() == reflect.Float32:
		if float32(getFloat(v1)) < float32(getFloat(v2)) {
			err = nil
		}
		return

	// At least one float64
	case v1.Kind() == reflect.Float64 || v2.Kind() == reflect.Float64:
		if getFloat(v1) < getFloat(v2) {
			err = nil
		}
		return
	}

	// We shouldn't get here.
	panic(fmt.Sprintf("lessThanMatcher.Matches: Shouldn't get here: %v %v", v1, v2))
}
