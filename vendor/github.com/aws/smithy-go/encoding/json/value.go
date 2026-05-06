package json

import (
	"bytes"
	"encoding/base64"
	"math/big"
	"strconv"

	"github.com/aws/smithy-go/encoding"
)

// Value represents a JSON Value type
// JSON Value types: Object, Array, String, Number, Boolean, and Null
type Value struct {
	w       *bytes.Buffer
	scratch *[]byte
}

// newValue returns a new Value encoder
func newValue(w *bytes.Buffer, scratch *[]byte) Value {
	return Value{w: w, scratch: scratch}
}

// String encodes v as a JSON string
func (jv Value) String(v string) {
	escapeStringBytes(jv.w, []byte(v))
}

// Byte encodes v as a JSON number
func (jv Value) Byte(v int8) {
	jv.Long(int64(v))
}

// Short encodes v as a JSON number
func (jv Value) Short(v int16) {
	jv.Long(int64(v))
}

// Integer encodes v as a JSON number
func (jv Value) Integer(v int32) {
	jv.Long(int64(v))
}

// Long encodes v as a JSON number
func (jv Value) Long(v int64) {
	*jv.scratch = strconv.AppendInt((*jv.scratch)[:0], v, 10)
	jv.w.Write(*jv.scratch)
}

// ULong encodes v as a JSON number
func (jv Value) ULong(v uint64) {
	*jv.scratch = strconv.AppendUint((*jv.scratch)[:0], v, 10)
	jv.w.Write(*jv.scratch)
}

// Float encodes v as a JSON number
func (jv Value) Float(v float32) {
	jv.float(float64(v), 32)
}

// Double encodes v as a JSON number
func (jv Value) Double(v float64) {
	jv.float(v, 64)
}

func (jv Value) float(v float64, bits int) {
	*jv.scratch = encoding.EncodeFloat((*jv.scratch)[:0], v, bits)
	jv.w.Write(*jv.scratch)
}

// Boolean encodes v as a JSON boolean
func (jv Value) Boolean(v bool) {
	*jv.scratch = strconv.AppendBool((*jv.scratch)[:0], v)
	jv.w.Write(*jv.scratch)
}

// Base64EncodeBytes writes v as a base64 value in JSON string
func (jv Value) Base64EncodeBytes(v []byte) {
	encodeByteSlice(jv.w, (*jv.scratch)[:0], v)
}

// Write writes v directly to the JSON document
func (jv Value) Write(v []byte) {
	jv.w.Write(v)
}

// Array returns a new Array encoder
func (jv Value) Array() *Array {
	return newArray(jv.w, jv.scratch)
}

// Object returns a new Object encoder
func (jv Value) Object() *Object {
	return newObject(jv.w, jv.scratch)
}

// Null encodes a null JSON value
func (jv Value) Null() {
	jv.w.WriteString(null)
}

// BigInteger encodes v as JSON value
func (jv Value) BigInteger(v *big.Int) {
	jv.w.Write([]byte(v.Text(10)))
}

// BigDecimal encodes v as JSON value
func (jv Value) BigDecimal(v *big.Float) {
	if i, accuracy := v.Int64(); accuracy == big.Exact {
		jv.Long(i)
		return
	}
	// TODO: Should this try to match ES6 ToString similar to stdlib JSON?
	jv.w.Write([]byte(v.Text('e', -1)))
}

// Based on encoding/json encodeByteSlice from the Go Standard Library
// https://golang.org/src/encoding/json/encode.go
func encodeByteSlice(w *bytes.Buffer, scratch []byte, v []byte) {
	if v == nil {
		w.WriteString(null)
		return
	}

	w.WriteRune(quote)

	encodedLen := base64.StdEncoding.EncodedLen(len(v))
	if encodedLen <= len(scratch) {
		// If the encoded bytes fit in e.scratch, avoid an extra
		// allocation and use the cheaper Encoding.Encode.
		dst := scratch[:encodedLen]
		base64.StdEncoding.Encode(dst, v)
		w.Write(dst)
	} else if encodedLen <= 1024 {
		// The encoded bytes are short enough to allocate for, and
		// Encoding.Encode is still cheaper.
		dst := make([]byte, encodedLen)
		base64.StdEncoding.Encode(dst, v)
		w.Write(dst)
	} else {
		// The encoded bytes are too long to cheaply allocate, and
		// Encoding.Encode is no longer noticeably cheaper.
		enc := base64.NewEncoder(base64.StdEncoding, w)
		enc.Write(v)
		enc.Close()
	}

	w.WriteRune(quote)
}
