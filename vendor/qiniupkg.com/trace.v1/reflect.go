package trace

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

func flattenValue(
	prefix string, v reflect.Value,
	f1 func(k, v string), f2 func(t time.Time, v string)) {

	switch o := v.Interface().(type) {
	case time.Time:
		f2(o, prefix)
		return
	case time.Duration:
		ms := float64(o.Nanoseconds()) / float64(time.Millisecond)
		f1(prefix, strconv.FormatFloat(ms, 'f', -1, 64))
		return
	case fmt.Stringer:
		f1(prefix, o.String())
		return
	}

	switch v.Kind() {
	case reflect.Ptr:
		flattenValue(prefix, v.Elem(), f1, f2)
	case reflect.Bool:
		f1(prefix, strconv.FormatBool(v.Bool()))
	case reflect.Float32, reflect.Float64:
		f1(prefix, strconv.FormatFloat(v.Float(), 'f', -1, 64))
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		f1(prefix, strconv.FormatInt(v.Int(), 10))
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		f1(prefix, strconv.FormatUint(v.Uint(), 10))
	case reflect.String:
		f1(prefix, v.String())
	case reflect.Struct:
		t := v.Type()
		for i := 0; i < t.NumField(); i++ {
			if t.Field(i).PkgPath != "" {
				continue
			}
			tag := t.Field(i).Tag.Get("trace")
			if tag == "" {
				continue
			}
			name, opts := parseTag(tag)
			if name == "" {
				name = strings.ToLower(t.Field(i).Name)
			}
			if opts.Contains("omitempty") && isEmptyValue(v.Field(i)) {
				continue
			}
			flattenValue(nest(prefix, name), v.Field(i), f1, f2)
		}
	case reflect.Map:
		// 忽略 key 为 time.Time 类型的情况
		for _, key := range v.MapKeys() {
			flattenValue("", key, func(_, k string) {
				flattenValue(nest(prefix, k), v.MapIndex(key), f1, f2)
			}, func(_ time.Time, _ string) {})
		}
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			flattenValue(nest(prefix, strconv.Itoa(i)), v.Index(i), f1, f2)
		}
	default:
		f1(prefix, fmt.Sprintf("%+v", v.Interface()))
	}
}

func nest(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "." + name
}

func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Interface, reflect.Ptr:
		return v.IsNil()
	}
	return false
}

type tagOptions string

// parseTag splits a struct field's json tag into its name and
// comma-separated options.
func parseTag(tag string) (string, tagOptions) {
	if idx := strings.Index(tag, ","); idx != -1 {
		return tag[:idx], tagOptions(tag[idx+1:])
	}
	return tag, tagOptions("")
}

// Contains reports whether a comma-separated list of options
// contains a particular substr flag. substr must be surrounded by a
// string boundary or commas.
func (o tagOptions) Contains(optionName string) bool {
	if len(o) == 0 {
		return false
	}
	s := string(o)
	for s != "" {
		var next string
		i := strings.Index(s, ",")
		if i >= 0 {
			s, next = s[:i], s[i+1:]
		}
		if s == optionName {
			return true
		}
		s = next
	}
	return false
}
