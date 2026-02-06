package protocol

import (
	"bytes"
	"errors"
)

// Raw type used by Centrifuge protocol as a type for fields in structs which
// value we want to stay untouched. For example custom application specific JSON
// payload data in published message. This is very similar to json.RawMessage
// type but have some extra methods to fit gogo/protobuf custom type interface.
type Raw []byte

// MarshalJSON returns *r as the JSON encoding of r.
func (r Raw) MarshalJSON() ([]byte, error) {
	if r == nil {
		return []byte("null"), nil
	}
	if !bytes.Contains(r, []byte("\n")) {
		return r, nil
	}
	return bytes.ReplaceAll(r, []byte("\n"), []byte("")), nil
}

// UnmarshalJSON sets *r to a copy of data.
func (r *Raw) UnmarshalJSON(data []byte) error {
	if r == nil {
		return errors.New("unmarshal Raw: UnmarshalJSON on nil pointer")
	}
	*r = append((*r)[0:0], data...)
	return nil
}
