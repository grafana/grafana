package gocty

import (
	"math/big"
	"reflect"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/set"
)

var valueType = reflect.TypeOf(cty.Value{})
var typeType = reflect.TypeOf(cty.Type{})

var setType = reflect.TypeOf(set.Set[interface{}]{})

var bigFloatType = reflect.TypeOf(big.Float{})
var bigIntType = reflect.TypeOf(big.Int{})

var emptyInterfaceType = reflect.TypeOf(interface{}(nil))

var stringType = reflect.TypeOf("")

// structTagIndices interrogates the fields of the given type (which must
// be a struct type, or we'll panic) and returns a map from the cty
// attribute names declared via struct tags to the indices of the
// fields holding those tags.
//
// This function will panic if two fields within the struct are tagged with
// the same cty attribute name.
func structTagIndices(st reflect.Type) map[string]int {
	ct := st.NumField()
	ret := make(map[string]int, ct)

	for i := 0; i < ct; i++ {
		field := st.Field(i)
		attrName := field.Tag.Get("cty")
		if attrName != "" {
			ret[attrName] = i
		}
	}

	return ret
}
