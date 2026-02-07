package types

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.2.8

import (
	"github.com/jcmturner/gofork/encoding/asn1"
)

// NewKrbFlags returns an ASN1 BitString struct of the right size for KrbFlags.
func NewKrbFlags() asn1.BitString {
	f := asn1.BitString{}
	f.Bytes = make([]byte, 4)
	f.BitLength = len(f.Bytes) * 8
	return f
}

// SetFlags sets the flags of an ASN1 BitString.
func SetFlags(f *asn1.BitString, j []int) {
	for _, i := range j {
		SetFlag(f, i)
	}
}

// SetFlag sets a flag in an ASN1 BitString.
func SetFlag(f *asn1.BitString, i int) {
	for l := len(f.Bytes); l < 4; l++ {
		(*f).Bytes = append((*f).Bytes, byte(0))
		(*f).BitLength = len((*f).Bytes) * 8
	}
	//Which byte?
	b := i / 8
	//Which bit in byte
	p := uint(7 - (i - 8*b))
	(*f).Bytes[b] = (*f).Bytes[b] | (1 << p)
}

// UnsetFlags unsets flags in an ASN1 BitString.
func UnsetFlags(f *asn1.BitString, j []int) {
	for _, i := range j {
		UnsetFlag(f, i)
	}
}

// UnsetFlag unsets a flag in an ASN1 BitString.
func UnsetFlag(f *asn1.BitString, i int) {
	for l := len(f.Bytes); l < 4; l++ {
		(*f).Bytes = append((*f).Bytes, byte(0))
		(*f).BitLength = len((*f).Bytes) * 8
	}
	//Which byte?
	b := i / 8
	//Which bit in byte
	p := uint(7 - (i - 8*b))
	(*f).Bytes[b] = (*f).Bytes[b] &^ (1 << p)
}

// IsFlagSet tests if a flag is set in the ASN1 BitString.
func IsFlagSet(f *asn1.BitString, i int) bool {
	//Which byte?
	b := i / 8
	//Which bit in byte
	p := uint(7 - (i - 8*b))
	if (*f).Bytes[b]&(1<<p) != 0 {
		return true
	}
	return false
}
