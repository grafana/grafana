package ndr

import (
	"errors"
	"fmt"
	"reflect"
)

// Union interface must be implemented by structs that will be unmarshaled into from the NDR byte stream union representation.
// The union's discriminating tag will be passed to the SwitchFunc method.
// The discriminating tag field must have the struct tag: `ndr:"unionTag"`
// If the union is encapsulated the discriminating tag field must have the struct tag: `ndr:"encapsulated"`
// The possible value fields that can be selected from must have the struct tag: `ndr:"unionField"`
type Union interface {
	SwitchFunc(t interface{}) string
}

// Union related constants such as struct tag values
const (
	unionSelectionFuncName = "SwitchFunc"
	TagEncapsulated        = "encapsulated"
	TagUnionTag            = "unionTag"
	TagUnionField          = "unionField"
)

func (dec *Decoder) isUnion(field reflect.Value, tag reflect.StructTag) (r reflect.Value) {
	ndrTag := parseTags(tag)
	if !ndrTag.HasValue(TagUnionTag) {
		return
	}
	r = field
	// For a non-encapsulated union, the discriminant is marshalled into the transmitted data stream twice: once as the
	// field or parameter, which is referenced by the switch_is construct, in the procedure argument list; and once as
	// the first part of the union representation.
	if !ndrTag.HasValue(TagEncapsulated) {
		dec.r.Discard(int(r.Type().Size()))
	}
	return
}

// unionSelectedField returns the field name of which of the union values to fill
func unionSelectedField(union, discriminant reflect.Value) (string, error) {
	if !union.Type().Implements(reflect.TypeOf(new(Union)).Elem()) {
		return "", errors.New("struct does not implement union interface")
	}
	args := []reflect.Value{discriminant}
	// Call the SelectFunc of the union struct to find the name of the field to fill with the value selected.
	sf := union.MethodByName(unionSelectionFuncName)
	if !sf.IsValid() {
		return "", fmt.Errorf("could not find a selection function called %s in the unions struct representation", unionSelectionFuncName)
	}
	f := sf.Call(args)
	if f[0].Kind() != reflect.String || f[0].String() == "" {
		return "", fmt.Errorf("the union select function did not return a string for the name of the field to fill")
	}
	return f[0].String(), nil
}
