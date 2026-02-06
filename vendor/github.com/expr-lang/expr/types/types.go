package types

import (
	"fmt"
	"reflect"
	"strings"

	. "github.com/expr-lang/expr/checker/nature"
)

// Type is a type that can be used to represent a value.
type Type interface {
	Nature() Nature
	Equal(Type) bool
	String() string
}

var (
	Int     = TypeOf(0)
	Int8    = TypeOf(int8(0))
	Int16   = TypeOf(int16(0))
	Int32   = TypeOf(int32(0))
	Int64   = TypeOf(int64(0))
	Uint    = TypeOf(uint(0))
	Uint8   = TypeOf(uint8(0))
	Uint16  = TypeOf(uint16(0))
	Uint32  = TypeOf(uint32(0))
	Uint64  = TypeOf(uint64(0))
	Float   = TypeOf(float32(0))
	Float64 = TypeOf(float64(0))
	String  = TypeOf("")
	Bool    = TypeOf(true)
	Nil     = nilType{}
	Any     = anyType{}
)

func TypeOf(v any) Type {
	if v == nil {
		return Nil
	}
	return rtype{t: reflect.TypeOf(v)}
}

type anyType struct{}

func (anyType) Nature() Nature {
	return FromType(nil)
}

func (anyType) Equal(t Type) bool {
	return true
}

func (anyType) String() string {
	return "any"
}

type nilType struct{}

func (nilType) Nature() Nature {
	return NatureOf(nil)
}

func (nilType) Equal(t Type) bool {
	if t == Any {
		return true
	}
	return t == Nil
}

func (nilType) String() string {
	return "nil"
}

type rtype struct {
	t reflect.Type
}

func (r rtype) Nature() Nature {
	return FromType(r.t)
}

func (r rtype) Equal(t Type) bool {
	if t == Any {
		return true
	}
	if rt, ok := t.(rtype); ok {
		return r.t.String() == rt.t.String()
	}
	return false
}

func (r rtype) String() string {
	return r.t.String()
}

// Map represents a map[string]any type with defined keys.
type Map map[string]Type

const Extra = "[[__extra_keys__]]"

func (m Map) Nature() Nature {
	nt := NatureOf(map[string]any{})
	if nt.TypeData == nil {
		nt.TypeData = new(TypeData)
	}
	nt.Fields = make(map[string]Nature, len(m))
	nt.Strict = true
	for k, v := range m {
		if k == Extra {
			nt.Strict = false
			natureOfDefaultValue := v.Nature()
			nt.DefaultMapValue = &natureOfDefaultValue
			continue
		}
		nt.Fields[k] = v.Nature()
	}
	return nt
}

func (m Map) Equal(t Type) bool {
	if t == Any {
		return true
	}
	mt, ok := t.(Map)
	if !ok {
		return false
	}
	if len(m) != len(mt) {
		return false
	}
	for k, v := range m {
		if !v.Equal(mt[k]) {
			return false
		}
	}
	return true
}

func (m Map) String() string {
	pairs := make([]string, 0, len(m))
	for k, v := range m {
		pairs = append(pairs, fmt.Sprintf("%s: %s", k, v.String()))
	}
	return fmt.Sprintf("Map{%s}", strings.Join(pairs, ", "))
}

// Array returns a type that represents an array of the given type.
func Array(of Type) Type {
	return array{of}
}

type array struct {
	of Type
}

func (a array) Nature() Nature {
	of := a.of.Nature()
	nt := NatureOf([]any{})
	if nt.TypeData == nil {
		nt.TypeData = new(TypeData)
	}
	nt.Fields = make(map[string]Nature, 1)
	nt.Ref = &of
	return nt
}

func (a array) Equal(t Type) bool {
	if t == Any {
		return true
	}
	at, ok := t.(array)
	if !ok {
		return false
	}
	if a.of.Equal(at.of) {
		return true
	}
	return false
}

func (a array) String() string {
	return fmt.Sprintf("Array{%s}", a.of.String())
}
