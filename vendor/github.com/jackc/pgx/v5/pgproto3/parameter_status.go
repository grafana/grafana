package pgproto3

import (
	"bytes"
	"encoding/json"
)

type ParameterStatus struct {
	Name  string
	Value string
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ParameterStatus) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ParameterStatus) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	b, err := buf.ReadBytes(0)
	if err != nil {
		return err
	}
	name := string(b[:len(b)-1])

	b, err = buf.ReadBytes(0)
	if err != nil {
		return err
	}
	value := string(b[:len(b)-1])

	*dst = ParameterStatus{Name: name, Value: value}
	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ParameterStatus) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'S')
	dst = append(dst, src.Name...)
	dst = append(dst, 0)
	dst = append(dst, src.Value...)
	dst = append(dst, 0)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (ps ParameterStatus) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type  string
		Name  string
		Value string
	}{
		Type:  "ParameterStatus",
		Name:  ps.Name,
		Value: ps.Value,
	})
}
