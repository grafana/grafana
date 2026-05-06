package json

import (
	"github.com/zclconf/go-cty/cty"
)

// MarshalType returns a JSON serialization of the given type.
//
// This is just a thin wrapper around t.MarshalJSON, for symmetry with
// UnmarshalType.
func MarshalType(t cty.Type) ([]byte, error) {
	return t.MarshalJSON()
}

// UnmarshalType decodes a JSON serialization of the given type as produced
// by either Type.MarshalJSON or MarshalType.
//
// This is a convenience wrapper around Type.UnmarshalJSON.
func UnmarshalType(buf []byte) (cty.Type, error) {
	var t cty.Type
	err := t.UnmarshalJSON(buf)
	return t, err
}
