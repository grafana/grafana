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

// Marshal encodes Raw to slice of bytes. Exists to fit gogo/protobuf custom
// type interface.
func (r Raw) Marshal() ([]byte, error) {
	if len(r) == 0 {
		return nil, nil
	}
	return r, nil
}

// MarshalTo exists to fit gogo/protobuf custom type interface.
func (r Raw) MarshalTo(data []byte) (n int, err error) {
	if len(r) == 0 {
		return 0, nil
	}
	copy(data, r)
	return len(r), nil
}

// Unmarshal exists to fit gogo/protobuf custom type interface.
func (r *Raw) Unmarshal(data []byte) error {
	if len(data) == 0 {
		r = nil
		return nil
	}
	id := Raw(make([]byte, len(data)))
	copy(id, data)
	*r = id
	return nil
}

// Size exists to fit gogo/protobuf custom type interface.
func (r *Raw) Size() int {
	if r == nil {
		return 0
	}
	return len(*r)
}

// MarshalJSON returns *r as the JSON encoding of r.
func (r Raw) MarshalJSON() ([]byte, error) {
	if r == nil {
		return []byte("null"), nil
	}
	return r, nil
}

// UnmarshalJSON sets *r to a copy of data.
func (r *Raw) UnmarshalJSON(data []byte) error {
	if r == nil {
		return errors.New("unmarshal Raw: UnmarshalJSON on nil pointer")
	}
	*r = append((*r)[0:0], data...)
	return nil
}

// Equal exists to fit gogo/protobuf custom type interface.
func (r Raw) Equal(other Raw) bool {
	return bytes.Equal(r[0:], other[0:])
}

// Compare exists to fit gogo/protobuf custom type interface.
func (r Raw) Compare(other Raw) int {
	return bytes.Compare(r[0:], other[0:])
}

type intn interface {
	Intn(n int) int
}

// NewPopulatedRaw required for gogoprotobuf custom type.
func NewPopulatedRaw(r intn) *Raw {
	v1 := r.Intn(100)
	data := make([]byte, v1)
	for i := 0; i < v1; i++ {
		data[i] = byte('a')
	}
	d := `{"key":"` + string(data) + `"}`
	raw := Raw(d)
	return &raw
}
