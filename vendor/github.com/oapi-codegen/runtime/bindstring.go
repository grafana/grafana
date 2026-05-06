// Copyright 2019 DeepMap, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package runtime

import (
	"encoding"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"time"

	"github.com/oapi-codegen/runtime/types"
)

// BindStringToObject takes a string, and attempts to assign it to the destination
// interface via whatever type conversion is necessary. We have to do this
// via reflection instead of a much simpler type switch so that we can handle
// type aliases. This function was the easy way out, the better way, since we
// know the destination type each place that we use this, is to generate code
// to read each specific type.
func BindStringToObject(src string, dst interface{}) error {
	var err error

	v := reflect.ValueOf(dst)
	t := reflect.TypeOf(dst)

	// We need to dereference pointers
	if t.Kind() == reflect.Ptr {
		v = reflect.Indirect(v)
		t = v.Type()
	}

	// For some optional args
	if t.Kind() == reflect.Ptr {
		if v.IsNil() {
			v.Set(reflect.New(t.Elem()))
		}

		v = reflect.Indirect(v)
		t = v.Type()
	}

	// The resulting type must be settable. reflect will catch issues like
	// passing the destination by value.
	if !v.CanSet() {
		return errors.New("destination is not settable")
	}

	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		var val int64
		val, err = strconv.ParseInt(src, 10, 64)
		if err == nil {
			if v.OverflowInt(val) {
				err = fmt.Errorf("value '%s' overflows destination of type: %s", src, t.Kind())
			}
			if err == nil {
				v.SetInt(val)
			}
		}
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		var val uint64
		val, err = strconv.ParseUint(src, 10, 64)
		if err == nil {
			if v.OverflowUint(val) {
				err = fmt.Errorf("value '%s' overflows destination of type: %s", src, t.Kind())
			}
			v.SetUint(val)
		}
	case reflect.String:
		v.SetString(src)
		err = nil
	case reflect.Float64, reflect.Float32:
		var val float64
		val, err = strconv.ParseFloat(src, 64)
		if err == nil {
			if v.OverflowFloat(val) {
				err = fmt.Errorf("value '%s' overflows destination of type: %s", src, t.Kind())
			}
			v.SetFloat(val)
		}
	case reflect.Bool:
		var val bool
		val, err = strconv.ParseBool(src)
		if err == nil {
			v.SetBool(val)
		}
	case reflect.Array:
		if tu, ok := dst.(encoding.TextUnmarshaler); ok {
			if err := tu.UnmarshalText([]byte(src)); err != nil {
				return fmt.Errorf("error unmarshaling '%s' text as %T: %s", src, dst, err)
			}

			return nil
		}
		fallthrough
	case reflect.Struct:
		// if this is not of type Time or of type Date look to see if this is of type Binder.
		if dstType, ok := dst.(Binder); ok {
			return dstType.Bind(src)
		}

		if t.ConvertibleTo(reflect.TypeOf(time.Time{})) {
			// Don't fail on empty string.
			if src == "" {
				return nil
			}
			// Time is a special case of a struct that we handle
			parsedTime, err := time.Parse(time.RFC3339Nano, src)
			if err != nil {
				parsedTime, err = time.Parse(types.DateFormat, src)
				if err != nil {
					return fmt.Errorf("error parsing '%s' as RFC3339 or 2006-01-02 time: %s", src, err)
				}
			}
			// So, assigning this gets a little fun. We have a value to the
			// dereference destination. We can't do a conversion to
			// time.Time because the result isn't assignable, so we need to
			// convert pointers.
			if t != reflect.TypeOf(time.Time{}) {
				vPtr := v.Addr()
				vtPtr := vPtr.Convert(reflect.TypeOf(&time.Time{}))
				v = reflect.Indirect(vtPtr)
			}
			v.Set(reflect.ValueOf(parsedTime))
			return nil
		}

		if t.ConvertibleTo(reflect.TypeOf(types.Date{})) {
			// Don't fail on empty string.
			if src == "" {
				return nil
			}
			parsedTime, err := time.Parse(types.DateFormat, src)
			if err != nil {
				return fmt.Errorf("error parsing '%s' as date: %s", src, err)
			}
			parsedDate := types.Date{Time: parsedTime}

			// We have to do the same dance here to assign, just like with times
			// above.
			if t != reflect.TypeOf(types.Date{}) {
				vPtr := v.Addr()
				vtPtr := vPtr.Convert(reflect.TypeOf(&types.Date{}))
				v = reflect.Indirect(vtPtr)
			}
			v.Set(reflect.ValueOf(parsedDate))
			return nil
		}

		// We fall through to the error case below if we haven't handled the
		// destination type above.
		fallthrough
	default:
		// We've got a bunch of types unimplemented, don't fail silently.
		err = fmt.Errorf("can not bind to destination of type: %s", t.Kind())
	}
	if err != nil {
		return fmt.Errorf("error binding string parameter: %w", err)
	}
	return nil
}
