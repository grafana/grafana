/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package sqltypes implements interfaces and types that represent SQL values.
package sqltypes

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/dolthub/vitess/go/bytes2"
	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

var (
	// NULL represents the NULL value.
	NULL = Value{}

	// DontEscape tells you if a character should not be escaped.
	DontEscape = byte(255)

	nullstr = []byte("null")
)

// BinWriter interface is used for encoding values.
// Types like bytes.Buffer conform to this interface.
// We expect the writer objects to be in-memory buffers.
// So, we don't expect the write operations to fail.
type BinWriter interface {
	Write([]byte) (int, error)
}

// Value can store any SQL value. If the value represents
// an integral type, the bytes are always stored as a canonical
// representation that matches how MySQL returns such values.
type Value struct {
	typ querypb.Type
	val []byte
}

// NewValue builds a Value using typ and val. If the value and typ
// don't match, it returns an error.
func NewValue(typ querypb.Type, val []byte) (v Value, err error) {
	switch {
	case IsSigned(typ):
		if _, err := strconv.ParseInt(string(val), 0, 64); err != nil {
			return NULL, err
		}
		return MakeTrusted(typ, val), nil
	case IsUnsigned(typ):
		if _, err := strconv.ParseUint(string(val), 0, 64); err != nil {
			return NULL, err
		}
		return MakeTrusted(typ, val), nil
	case IsFloat(typ) || typ == Decimal:
		if _, err := strconv.ParseFloat(string(val), 64); err != nil {
			return NULL, err
		}
		return MakeTrusted(typ, val), nil
	case IsQuoted(typ) || typ == Bit || typ == Null:
		return MakeTrusted(typ, val), nil
	}
	// All other types are unsafe or invalid.
	return NULL, fmt.Errorf("invalid type specified for MakeValue: %v", typ)
}

// MakeTrusted makes a new Value based on the type.
// This function should only be used if you know the value
// and type conform to the rules. Every place this function is
// called, a comment is needed that explains why it's justified.
// Exceptions: The current package and mysql package do not need
// comments. Other packages can also use the function to create
// VarBinary or VarChar values.
func MakeTrusted(typ querypb.Type, val []byte) Value {

	if typ == Null {
		return NULL
	}

	return Value{typ: typ, val: val}
}

// NewInt64 builds an Int64 Value.
func NewInt64(v int64) Value {
	return MakeTrusted(Int64, strconv.AppendInt(nil, v, 10))
}

// NewInt8 builds an Int8 Value.
func NewInt8(v int8) Value {
	return MakeTrusted(Int8, strconv.AppendInt(nil, int64(v), 10))
}

// NewInt32 builds an Int64 Value.
func NewInt32(v int32) Value {
	return MakeTrusted(Int32, strconv.AppendInt(nil, int64(v), 10))
}

// NewUint64 builds an Uint64 Value.
func NewUint64(v uint64) Value {
	return MakeTrusted(Uint64, strconv.AppendUint(nil, v, 10))
}

// NewUint32 builds an Uint32 Value.
func NewUint32(v uint32) Value {
	return MakeTrusted(Uint32, strconv.AppendUint(nil, uint64(v), 10))
}

// NewFloat64 builds an Float64 Value.
func NewFloat64(v float64) Value {
	return MakeTrusted(Float64, strconv.AppendFloat(nil, v, 'g', -1, 64))
}

// NewVarChar builds a VarChar Value.
func NewVarChar(v string) Value {
	return MakeTrusted(VarChar, []byte(v))
}

// NewVarBinary builds a VarBinary Value.
// The input is a string because it's the most common use case.
func NewVarBinary(v string) Value {
	return MakeTrusted(VarBinary, []byte(v))
}

// NewIntegral builds an integral type from a string representation.
// The type will be Int64 or Uint64. Int64 will be preferred where possible.
func NewIntegral(val string) (n Value, err error) {
	signed, err := strconv.ParseInt(val, 0, 64)
	if err == nil {
		return MakeTrusted(Int64, strconv.AppendInt(nil, signed, 10)), nil
	}
	unsigned, err := strconv.ParseUint(val, 0, 64)
	if err != nil {
		return Value{}, err
	}
	return MakeTrusted(Uint64, strconv.AppendUint(nil, unsigned, 10)), nil
}

// InterfaceToValue builds a value from a go type.
// Supported types are nil, int64, uint64, float64,
// string and []byte.
// This function is deprecated. Use the type-specific
// functions instead.
func InterfaceToValue(goval interface{}) (Value, error) {
	switch goval := goval.(type) {
	case nil:
		return NULL, nil
	case []byte:
		return MakeTrusted(VarBinary, goval), nil
	case int64:
		return NewInt64(goval), nil
	case uint64:
		return NewUint64(goval), nil
	case float64:
		return NewFloat64(goval), nil
	case string:
		return NewVarChar(goval), nil
	default:
		return NULL, fmt.Errorf("unexpected type %T: %v", goval, goval)
	}
}

// Type returns the type of Value.
func (v Value) Type() querypb.Type {
	return v.typ
}

// Raw returns the internal representation of the value. For newer types,
// this may not match MySQL's representation.
func (v Value) Raw() []byte {
	return v.val
}

// ToBytes returns the value as MySQL would return it as []byte.
// In contrast, Raw returns the internal representation of the Value, which may not
// match MySQL's representation for newer types.
// If the value is not convertible like in the case of Expression, it returns nil.
func (v Value) ToBytes() []byte {
	if v.typ == Expression {
		return nil
	}
	return v.val
}

// Len returns the length.
func (v Value) Len() int {
	return len(v.val)
}

// ToString returns the value as MySQL would return it as string.
// If the value is not convertible like in the case of Expression, it returns nil.
func (v Value) ToString() string {
	if v.typ == Expression {
		return ""
	}
	return string(v.val)
}

// String returns a printable version of the value.
func (v Value) String() string {
	if v.typ == Null {
		return "NULL"
	}
	if v.IsQuoted() || v.typ == Bit {
		return fmt.Sprintf("%v(%q)", v.typ, v.val)
	}
	return fmt.Sprintf("%v(%s)", v.typ, bytes.Clone(v.val))
}

// EncodeSQL encodes the value into an SQL statement. Can be binary.
func (v Value) EncodeSQL(b BinWriter) {
	switch {
	case v.typ == Null:
		b.Write(nullstr)
	case v.IsQuoted():
		encodeBytesSQL(v.val, b)
	case v.typ == Bit:
		encodeBytesSQLBits(v.val, b)
	default:
		b.Write(v.val)
	}
}

// EncodeASCII encodes the value using 7-bit clean ascii bytes.
func (v Value) EncodeASCII(b BinWriter) {
	switch {
	case v.typ == Null:
		b.Write(nullstr)
	case v.IsQuoted() || v.typ == Bit:
		encodeBytesASCII(v.val, b)
	default:
		b.Write(v.val)
	}
}

// IsNull returns true if Value is null.
func (v Value) IsNull() bool {
	return v.typ == Null
}

// IsIntegral returns true if Value is an integral.
func (v Value) IsIntegral() bool {
	return IsIntegral(v.typ)
}

// IsSigned returns true if Value is a signed integral.
func (v Value) IsSigned() bool {
	return IsSigned(v.typ)
}

// IsUnsigned returns true if Value is an unsigned integral.
func (v Value) IsUnsigned() bool {
	return IsUnsigned(v.typ)
}

// IsFloat returns true if Value is a float.
func (v Value) IsFloat() bool {
	return IsFloat(v.typ)
}

// IsQuoted returns true if Value must be SQL-quoted.
func (v Value) IsQuoted() bool {
	return IsQuoted(v.typ)
}

// IsText returns true if Value is a collatable text.
func (v Value) IsText() bool {
	return IsText(v.typ)
}

// IsBinary returns true if Value is binary.
func (v Value) IsBinary() bool {
	return IsBinary(v.typ)
}

// MarshalJSON should only be used for testing.
// It's not a complete implementation.
func (v Value) MarshalJSON() ([]byte, error) {
	switch {
	case v.IsQuoted() || v.typ == Bit:
		return json.Marshal(v.ToString())
	case v.typ == Null:
		return nullstr, nil
	}
	return v.val, nil
}

// UnmarshalJSON should only be used for testing.
// It's not a complete implementation.
func (v *Value) UnmarshalJSON(b []byte) error {
	if len(b) == 0 {
		return fmt.Errorf("error unmarshaling empty bytes")
	}
	var val interface{}
	var err error
	switch b[0] {
	case '-':
		var ival int64
		err = json.Unmarshal(b, &ival)
		val = ival
	case '"':
		var bval []byte
		err = json.Unmarshal(b, &bval)
		val = bval
	case 'n': // null
		err = json.Unmarshal(b, &val)
	default:
		var uval uint64
		err = json.Unmarshal(b, &uval)
		val = uval
	}
	if err != nil {
		return err
	}
	*v, err = InterfaceToValue(val)
	return err
}

func encodeBytesSQL(val []byte, b BinWriter) {
	buf := &bytes2.Buffer{}
	buf.WriteByte('\'')
	for _, ch := range val {
		if encodedChar := SQLEncodeMap[ch]; encodedChar == DontEscape {
			buf.WriteByte(ch)
		} else {
			buf.WriteByte('\\')
			buf.WriteByte(encodedChar)
		}
	}
	buf.WriteByte('\'')
	b.Write(buf.Bytes())
}

func encodeBytesSQLBits(val []byte, b BinWriter) {
	fmt.Fprint(b, "b'")
	for _, ch := range val {
		fmt.Fprintf(b, "%08b", ch)
	}
	fmt.Fprint(b, "'")
}

func encodeBytesASCII(val []byte, b BinWriter) {
	buf := &bytes2.Buffer{}
	buf.WriteByte('\'')
	encoder := base64.NewEncoder(base64.StdEncoding, buf)
	encoder.Write(val)
	encoder.Close()
	buf.WriteByte('\'')
	b.Write(buf.Bytes())
}

// SQLEncodeMap specifies how to escape binary data with '\'.
// Complies to http://dev.mysql.com/doc/refman/5.1/en/string-syntax.html
var SQLEncodeMap [256]byte

// SQLDecodeMap is the reverse of SQLEncodeMap
var SQLDecodeMap [256]byte

var encodeRef = map[byte]byte{
	'\x00': '0',
	'\'':   '\'',
	'"':    '"',
	'\b':   'b',
	'\n':   'n',
	'\r':   'r',
	'\t':   't',
	26:     'Z', // ctl-Z
	'\\':   '\\',
}

func init() {
	for i := range SQLEncodeMap {
		SQLEncodeMap[i] = DontEscape
		SQLDecodeMap[i] = DontEscape
	}
	for i := range SQLEncodeMap {
		if to, ok := encodeRef[byte(i)]; ok {
			SQLEncodeMap[byte(i)] = to
			SQLDecodeMap[to] = byte(i)
		}
	}
}
