package json

import (
	"github.com/zclconf/go-cty/cty"
)

// SimpleJSONValue is a wrapper around cty.Value that adds implementations of
// json.Marshaler and json.Unmarshaler for simple-but-type-lossy automatic
// encoding and decoding of values.
//
// The couplet Marshal and Unmarshal both take extra type information to
// inform the encoding and decoding process so that all of the cty types
// can be represented even though JSON's type system is a subset.
//
// SimpleJSONValue instead takes the approach of discarding the value's type
// information and then deriving a new type from the stored structure when
// decoding. This results in the same data being returned but not necessarily
// with exactly the same type.
//
// For information on how types are inferred when decoding, see the
// documentation of the function ImpliedType.
type SimpleJSONValue struct {
	cty.Value
}

// MarshalJSON is an implementation of json.Marshaler. See the documentation
// of SimpleJSONValue for more information.
func (v SimpleJSONValue) MarshalJSON() ([]byte, error) {
	return Marshal(v.Value, v.Type())
}

// UnmarshalJSON is an implementation of json.Unmarshaler. See the
// documentation of SimpleJSONValue for more information.
func (v *SimpleJSONValue) UnmarshalJSON(buf []byte) error {
	t, err := ImpliedType(buf)
	if err != nil {
		return err
	}
	v.Value, err = Unmarshal(buf, t)
	return err
}
