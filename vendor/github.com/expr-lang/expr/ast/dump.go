package ast

import (
	"fmt"
	"reflect"
	"regexp"
)

func Dump(node Node) string {
	return dump(reflect.ValueOf(node), "")
}

func dump(v reflect.Value, ident string) string {
	if !v.IsValid() {
		return "nil"
	}
	t := v.Type()
	switch t.Kind() {
	case reflect.Struct:
		out := t.Name() + "{\n"
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if isPrivate(f.Name) {
				continue
			}
			s := v.Field(i)
			out += fmt.Sprintf("%v%v: %v,\n", ident+"\t", f.Name, dump(s, ident+"\t"))
		}
		return out + ident + "}"
	case reflect.Slice:
		if v.Len() == 0 {
			return t.String() + "{}"
		}
		out := t.String() + "{\n"
		for i := 0; i < v.Len(); i++ {
			s := v.Index(i)
			out += fmt.Sprintf("%v%v,", ident+"\t", dump(s, ident+"\t"))
			if i+1 < v.Len() {
				out += "\n"
			}
		}
		return out + "\n" + ident + "}"
	case reflect.Ptr:
		return dump(v.Elem(), ident)
	case reflect.Interface:
		return dump(reflect.ValueOf(v.Interface()), ident)

	case reflect.String:
		return fmt.Sprintf("%q", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

var isCapital = regexp.MustCompile("^[A-Z]")

func isPrivate(s string) bool {
	return !isCapital.Match([]byte(s))
}
