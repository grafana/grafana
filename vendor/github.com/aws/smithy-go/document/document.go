package document

import (
	"fmt"
	"math/big"
	"strconv"
)

// Marshaler is an interface for a type that marshals a document to its protocol-specific byte representation and
// returns the resulting bytes. A non-nil error will be returned if an error is encountered during marshaling.
//
// Marshal supports basic scalars (int,uint,float,bool,string), big.Int, and big.Float, maps, slices, and structs.
// Anonymous nested types are flattened based on Go anonymous type visibility.
//
// When defining struct types. the `document` struct tag can be used to control how the value will be
// marshaled into the resulting protocol document.
//
//		// Field is ignored
//		Field int `document:"-"`
//
//		// Field object of key "myName"
//		Field int `document:"myName"`
//
//		// Field object key of key "myName", and
//		// Field is omitted if the field is a zero value for the type.
//		Field int `document:"myName,omitempty"`
//
//		// Field object key of "Field", and
//		// Field is omitted if the field is a zero value for the type.
//		Field int `document:",omitempty"`
//
// All struct fields, including anonymous fields, are marshaled unless the
// any of the following conditions are meet.
//
//		- the field is not exported
//		- document field tag is "-"
//		- document field tag specifies "omitempty", and is a zero value.
//
// Pointer and interface values are encoded as the value pointed to or
// contained in the interface. A nil value encodes as a null
// value unless `omitempty` struct tag is provided.
//
// Channel, complex, and function values are not encoded and will be skipped
// when walking the value to be marshaled.
//
// time.Time is not supported and will cause the Marshaler to return an error. These values should be represented
// by your application as a string or numerical representation.
//
// Errors that occur when marshaling will stop the marshaler, and return the error.
//
// Marshal cannot represent cyclic data structures and will not handle them.
// Passing cyclic structures to Marshal will result in an infinite recursion.
type Marshaler interface {
	MarshalSmithyDocument() ([]byte, error)
}

// Unmarshaler is an interface for a type that unmarshals a document from its protocol-specific representation, and
// stores the result into the value pointed by v. If v is nil or not a pointer then InvalidUnmarshalError will be
// returned.
//
// Unmarshaler supports the same encodings produced by a document Marshaler. This includes support for the `document`
// struct field tag for controlling how struct fields are unmarshaled.
//
// Both generic interface{} and concrete types are valid unmarshal destination types. When unmarshaling a document
// into an empty interface the Unmarshaler will store one of these values:
//   bool,                   for boolean values
//   document.Number,        for arbitrary-precision numbers (int64, float64, big.Int, big.Float)
//   string,                 for string values
//   []interface{},          for array values
//   map[string]interface{}, for objects
//   nil,                    for null values
//
// When unmarshaling, any error that occurs will halt the unmarshal and return the error.
type Unmarshaler interface {
	UnmarshalSmithyDocument(v interface{}) error
}

type noSerde interface {
	noSmithyDocumentSerde()
}

// NoSerde is a sentinel value to indicate that a given type should not be marshaled or unmarshaled
// into a protocol document.
type NoSerde struct{}

func (n NoSerde) noSmithyDocumentSerde() {}

var _ noSerde = (*NoSerde)(nil)

// IsNoSerde returns whether the given type implements the no smithy document serde interface.
func IsNoSerde(x interface{}) bool {
	_, ok := x.(noSerde)
	return ok
}

// Number is an arbitrary precision numerical value
type Number string

// Int64 returns the number as a string.
func (n Number) String() string {
	return string(n)
}

// Int64 returns the number as an int64.
func (n Number) Int64() (int64, error) {
	return n.intOfBitSize(64)
}

func (n Number) intOfBitSize(bitSize int) (int64, error) {
	return strconv.ParseInt(string(n), 10, bitSize)
}

// Uint64 returns the number as a uint64.
func (n Number) Uint64() (uint64, error) {
	return n.uintOfBitSize(64)
}

func (n Number) uintOfBitSize(bitSize int) (uint64, error) {
	return strconv.ParseUint(string(n), 10, bitSize)
}

// Float32 returns the number parsed as a 32-bit float, returns a float64.
func (n Number) Float32() (float64, error) {
	return n.floatOfBitSize(32)
}

// Float64 returns the number as a float64.
func (n Number) Float64() (float64, error) {
	return n.floatOfBitSize(64)
}

// Float64 returns the number as a float64.
func (n Number) floatOfBitSize(bitSize int) (float64, error) {
	return strconv.ParseFloat(string(n), bitSize)
}

// BigFloat attempts to convert the number to a big.Float, returns an error if the operation fails.
func (n Number) BigFloat() (*big.Float, error) {
	f, ok := (&big.Float{}).SetString(string(n))
	if !ok {
		return nil, fmt.Errorf("failed to convert to big.Float")
	}
	return f, nil
}

// BigInt attempts to convert the number to a big.Int, returns an error if the operation fails.
func (n Number) BigInt() (*big.Int, error) {
	f, ok := (&big.Int{}).SetString(string(n), 10)
	if !ok {
		return nil, fmt.Errorf("failed to convert to big.Float")
	}
	return f, nil
}
