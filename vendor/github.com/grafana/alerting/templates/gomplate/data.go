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
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"

	"gopkg.in/yaml.v3"
)

func CreateDataFuncs() Namespace {
	return Namespace{"data", &DataFuncs{}}
}

// Data Functions.
type DataFuncs struct {
}

func (f *DataFuncs) JSON(in any) (any, error) {
	return JSON(toString(in))
}

func (f *DataFuncs) ToJSON(in any) (string, error) {
	return toJSON(in)
}

func (f *DataFuncs) ToJSONPretty(indent string, in any) (string, error) {
	return toJSONPretty(indent, in)
}

// JSON - Unmarshal a JSON Object. Can be ejson-encrypted.
func JSON(in string) (any, error) {
	var out any
	err := yaml.Unmarshal([]byte(in), &out)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal object %s: %w", in, err)
	}

	return out, err
}

// toJSON - Stringify a struct as JSON
func toJSON(in any) (string, error) {
	s, err := json.Marshal(in) // We use json.Marshal here instead of ugorji/go/codec used in gomplate as there are nil<->zero decoding differences between them. See https://github.com/ugorji/go/issues/386.
	if err != nil {
		return "", err
	}
	return string(s), nil
}

// toJSONPretty - Stringify a struct as JSON (indented)
func toJSONPretty(indent string, in any) (string, error) {
	out := new(bytes.Buffer)
	b, err := json.Marshal(in) // We use json.Marshal here instead of ugorji/go/codec used in gomplate as there are nil<->zero decoding differences between them. See https://github.com/ugorji/go/issues/386.
	if err != nil {
		return "", err
	}
	err = json.Indent(out, b, "", indent)
	if err != nil {
		return "", fmt.Errorf("unable to indent JSON %s: %w", b, err)
	}

	return out.String(), nil
}

func toString(in any) string {
	if in == nil {
		return "nil"
	}
	if s, ok := in.(string); ok {
		return s
	}
	if s, ok := in.(fmt.Stringer); ok {
		return s.String()
	}
	if s, ok := in.([]byte); ok {
		return string(s)
	}

	v, ok := printableValue(reflect.ValueOf(in))
	if ok {
		in = v
	}

	return fmt.Sprint(in)
}
