/*
 * This file evolved from the MIT licensed: https://github.com/hairyhenderson/gomplate
 */

/*
The MIT License (MIT)

# Copyright (c) 2016-2023 Dave Henderson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
package gomplate

import (
	"fmt"
	"reflect"
)

func CreateCollFuncs() Namespace {
	return Namespace{"coll", &CollFuncs{}}
}

// Collection Functions.
type CollFuncs struct {
}

func (CollFuncs) Dict(in ...any) (map[string]any, error) {
	dict := map[string]interface{}{}
	lenv := len(in)
	for i := 0; i < lenv; i += 2 {
		key := toString(in[i])
		if i+1 >= lenv {
			dict[key] = ""
			continue
		}
		dict[key] = in[i+1]
	}
	return dict, nil
}

func (CollFuncs) Slice(args ...any) []any {
	return args
}

func (CollFuncs) Append(v any, list any) ([]any, error) {
	l, err := interfaceSlice(list)
	if err != nil {
		return nil, err
	}

	return append(l, v), nil
}

// interfaceSlice converts an array or slice of any type into an []interface{}
// for use in functions that expect this.
func interfaceSlice(slice interface{}) ([]interface{}, error) {
	// avoid all this nonsense if this is already a []interface{}...
	if s, ok := slice.([]interface{}); ok {
		return s, nil
	}
	s := reflect.ValueOf(slice)
	kind := s.Kind()
	//nolint:exhaustive // Only checking for slice/array types, default handles all others
	switch kind {
	case reflect.Slice, reflect.Array:
		l := s.Len()
		ret := make([]interface{}, l)
		for i := 0; i < l; i++ {
			ret[i] = s.Index(i).Interface()
		}
		return ret, nil
	default:
		return nil, fmt.Errorf("expected an array or slice, but got a %T", s)
	}
}
