package query

import (
	"math/big"
	"net/url"

	"github.com/aws/smithy-go/encoding/httpbinding"
)

// Value represents a Query Value type.
type Value struct {
	// The query values to add the value to.
	values url.Values
	// The value's key, which will form the prefix for complex types.
	key string
	// Whether the value should be flattened or not if it's a flattenable type.
	flat       bool
	queryValue httpbinding.QueryValue
}

func newValue(values url.Values, key string, flat bool) Value {
	return Value{
		values:     values,
		key:        key,
		flat:       flat,
		queryValue: httpbinding.NewQueryValue(values, key, false),
	}
}

func newBaseValue(values url.Values) Value {
	return Value{
		values:     values,
		queryValue: httpbinding.NewQueryValue(nil, "", false),
	}
}

// Array returns a new Array encoder.
func (qv Value) Array(locationName string) *Array {
	return newArray(qv.values, qv.key, qv.flat, locationName)
}

// Object returns a new Object encoder.
func (qv Value) Object() *Object {
	return newObject(qv.values, qv.key)
}

// Map returns a new Map encoder.
func (qv Value) Map(keyLocationName string, valueLocationName string) *Map {
	return newMap(qv.values, qv.key, qv.flat, keyLocationName, valueLocationName)
}

// Base64EncodeBytes encodes v as a base64 query string value.
// This is intended to enable compatibility with the JSON encoder.
func (qv Value) Base64EncodeBytes(v []byte) {
	qv.queryValue.Blob(v)
}

// Boolean encodes v as a query string value
func (qv Value) Boolean(v bool) {
	qv.queryValue.Boolean(v)
}

// String encodes v as a query string value
func (qv Value) String(v string) {
	qv.queryValue.String(v)
}

// Byte encodes v as a query string value
func (qv Value) Byte(v int8) {
	qv.queryValue.Byte(v)
}

// Short encodes v as a query string value
func (qv Value) Short(v int16) {
	qv.queryValue.Short(v)
}

// Integer encodes v as a query string value
func (qv Value) Integer(v int32) {
	qv.queryValue.Integer(v)
}

// Long encodes v as a query string value
func (qv Value) Long(v int64) {
	qv.queryValue.Long(v)
}

// Float encodes v as a query string value
func (qv Value) Float(v float32) {
	qv.queryValue.Float(v)
}

// Double encodes v as a query string value
func (qv Value) Double(v float64) {
	qv.queryValue.Double(v)
}

// BigInteger encodes v as a query string value
func (qv Value) BigInteger(v *big.Int) {
	qv.queryValue.BigInteger(v)
}

// BigDecimal encodes v as a query string value
func (qv Value) BigDecimal(v *big.Float) {
	qv.queryValue.BigDecimal(v)
}
