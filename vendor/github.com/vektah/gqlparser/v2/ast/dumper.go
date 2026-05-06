package ast

import (
	"bytes"
	"fmt"
	"reflect"
	"strconv"
	"strings"
)

// Dump turns ast into a stable string format for assertions in tests
func Dump(i interface{}) string {
	v := reflect.ValueOf(i)

	d := dumper{Buffer: &bytes.Buffer{}}
	d.dump(v)

	return d.String()
}

type dumper struct {
	*bytes.Buffer
	indent int
}

type Dumpable interface {
	Dump() string
}

func (d *dumper) dump(v reflect.Value) {
	if dumpable, isDumpable := v.Interface().(Dumpable); isDumpable {
		d.WriteString(dumpable.Dump())
		return
	}
	switch v.Kind() {
	case reflect.Bool:
		if v.Bool() {
			d.WriteString("true")
		} else {
			d.WriteString("false")
		}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		fmt.Fprintf(d, "%d", v.Int())

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		fmt.Fprintf(d, "%d", v.Uint())

	case reflect.Float32, reflect.Float64:
		fmt.Fprintf(d, "%.2f", v.Float())

	case reflect.String:
		if v.Type().Name() != "string" {
			d.WriteString(v.Type().Name() + "(" + strconv.Quote(v.String()) + ")")
		} else {
			d.WriteString(strconv.Quote(v.String()))
		}

	case reflect.Array, reflect.Slice:
		d.dumpArray(v)

	case reflect.Interface, reflect.Ptr:
		d.dumpPtr(v)

	case reflect.Struct:
		d.dumpStruct(v)

	default:
		panic(fmt.Errorf("unsupported kind: %s\n buf: %s", v.Kind().String(), d.String()))
	}
}

func (d *dumper) writeIndent() {
	d.WriteString(strings.Repeat("  ", d.indent))
}

func (d *dumper) nl() {
	d.WriteByte('\n')
	d.writeIndent()
}

func typeName(t reflect.Type) string {
	if t.Kind() == reflect.Ptr {
		return typeName(t.Elem())
	}
	return t.Name()
}

func (d *dumper) dumpArray(v reflect.Value) {
	d.WriteString("[" + typeName(v.Type().Elem()) + "]")

	for i := 0; i < v.Len(); i++ {
		d.nl()
		d.WriteString("- ")
		d.indent++
		d.dump(v.Index(i))
		d.indent--
	}
}

func (d *dumper) dumpStruct(v reflect.Value) {
	d.WriteString("<" + v.Type().Name() + ">")
	d.indent++

	typ := v.Type()
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		if typ.Field(i).Tag.Get("dump") == "-" {
			continue
		}

		if isZero(f) {
			continue
		}
		d.nl()
		d.WriteString(typ.Field(i).Name)
		d.WriteString(": ")
		d.dump(v.Field(i))
	}

	d.indent--
}

func isZero(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		return v.IsNil()
	case reflect.Func, reflect.Map:
		return v.IsNil()

	case reflect.Array, reflect.Slice:
		if v.IsNil() {
			return true
		}
		z := true
		for i := 0; i < v.Len(); i++ {
			z = z && isZero(v.Index(i))
		}
		return z
	case reflect.Struct:
		z := true
		for i := 0; i < v.NumField(); i++ {
			z = z && isZero(v.Field(i))
		}
		return z
	case reflect.String:
		return v.String() == ""
	}

	// Compare other types directly:
	return reflect.DeepEqual(v.Interface(), reflect.Zero(v.Type()))
}

func (d *dumper) dumpPtr(v reflect.Value) {
	if v.IsNil() {
		d.WriteString("nil")
		return
	}
	d.dump(v.Elem())
}
