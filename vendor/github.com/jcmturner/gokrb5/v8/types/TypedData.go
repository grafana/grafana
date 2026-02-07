package types

import "github.com/jcmturner/gofork/encoding/asn1"

// TypedData implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.9.1
type TypedData struct {
	DataType  int32  `asn1:"explicit,tag:0"`
	DataValue []byte `asn1:"optional,explicit,tag:1"`
}

// TypedDataSequence implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.9.1
type TypedDataSequence []TypedData

// Unmarshal bytes into the TypedDataSequence.
func (a *TypedDataSequence) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}
