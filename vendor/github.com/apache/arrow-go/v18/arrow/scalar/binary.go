// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package scalar

import (
	"bytes"
	"fmt"
	"unicode/utf8"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

type BinaryScalar interface {
	Scalar

	Retain()
	Release()
	Buffer() *memory.Buffer
	Data() []byte
}

type Binary struct {
	scalar

	Value *memory.Buffer
}

func (b *Binary) Retain() {
	if b.Value != nil {
		b.Value.Retain()
	}
}

func (b *Binary) Release() {
	if b.Value != nil {
		b.Value.Release()
	}
}

func (b *Binary) value() interface{} { return b.Value }
func (b *Binary) Data() []byte       { return b.Value.Bytes() }
func (b *Binary) equals(rhs Scalar) bool {
	return bytes.Equal(b.Value.Bytes(), rhs.(BinaryScalar).Data())
}
func (b *Binary) Buffer() *memory.Buffer { return b.Value }
func (b *Binary) String() string {
	if !b.Valid {
		return "null"
	}

	return string(b.Value.Bytes())
}

func (b *Binary) CastTo(to arrow.DataType) (Scalar, error) {
	if !b.Valid {
		return MakeNullScalar(to), nil
	}

	switch to.ID() {
	case arrow.BINARY:
		return NewBinaryScalar(b.Value, b.Type), nil
	case arrow.LARGE_BINARY:
		return NewLargeBinaryScalar(b.Value), nil
	case arrow.STRING:
		return NewStringScalarFromBuffer(b.Value), nil
	case arrow.LARGE_STRING:
		return NewLargeStringScalarFromBuffer(b.Value), nil
	case arrow.FIXED_SIZE_BINARY:
		if b.Value.Len() == to.(*arrow.FixedSizeBinaryType).ByteWidth {
			return NewFixedSizeBinaryScalar(b.Value, to), nil
		}
	}

	return nil, fmt.Errorf("cannot cast non-null binary scalar to type %s", to)
}

func (b *Binary) Validate() (err error) {
	err = b.scalar.Validate()
	if err == nil {
		err = validateOptional(&b.scalar, b.Value, "value")
	}
	return
}

func (b *Binary) ValidateFull() error {
	return b.Validate()
}

func NewBinaryScalar(val *memory.Buffer, typ arrow.DataType) *Binary {
	val.Retain()
	return &Binary{scalar{typ, true}, val}
}

type LargeBinary struct {
	*Binary
}

func NewLargeBinaryScalar(val *memory.Buffer) *LargeBinary {
	return &LargeBinary{NewBinaryScalar(val, arrow.BinaryTypes.LargeBinary)}
}

type String struct {
	*Binary
}

func (s *String) Validate() error {
	return s.Binary.Validate()
}

func (s *String) ValidateFull() (err error) {
	if err = s.Validate(); err != nil {
		return
	}
	if s.Valid && !utf8.ValidString(string(s.Value.Bytes())) {
		err = fmt.Errorf("%s scalar contains invalid utf8 data", s.Type)
	}
	return
}

func (s *String) CastTo(to arrow.DataType) (Scalar, error) {
	if !s.Valid {
		return MakeNullScalar(to), nil
	}

	if to.ID() == arrow.FIXED_SIZE_BINARY {
		if s.Value.Len() == to.(*arrow.FixedSizeBinaryType).ByteWidth {
			return NewFixedSizeBinaryScalar(s.Value, to), nil
		}
		return nil, fmt.Errorf("cannot convert string scalar of %s to type %s", string(s.Value.Bytes()), to)
	}

	return ParseScalar(to, string(s.Value.Bytes()))
}

func NewStringScalar(val string) *String {
	buf := memory.NewBufferBytes([]byte(val))
	defer buf.Release()
	return NewStringScalarFromBuffer(buf)
}

func NewStringScalarFromBuffer(val *memory.Buffer) *String {
	// NewBinaryScalar will call Retain on val, so we don't have to
	return &String{NewBinaryScalar(val, arrow.BinaryTypes.String)}
}

// alias the String struct we are embedding so it doesn't hide the
// String() function that we want to expose
type stringScalar = String

type LargeString struct {
	*stringScalar
}

func NewLargeStringScalar(val string) *LargeString {
	buf := memory.NewBufferBytes([]byte(val))
	defer buf.Release()
	return NewLargeStringScalarFromBuffer(buf)
}

func NewLargeStringScalarFromBuffer(val *memory.Buffer) *LargeString {
	// NewBinaryScalar will call retain on val, so we don't have to
	return &LargeString{stringScalar: &String{NewBinaryScalar(val, arrow.BinaryTypes.LargeString)}}
}

type FixedSizeBinary struct {
	*Binary
}

func (b *FixedSizeBinary) Validate() (err error) {
	if err = b.Binary.Validate(); err != nil {
		return
	}

	if b.Valid {
		width := b.Type.(*arrow.FixedSizeBinaryType).ByteWidth
		if b.Value.Len() != width {
			err = fmt.Errorf("%s scalar should have a value of size %d, got %d", b.Type, width, b.Value.Len())
		}
	}
	return
}

func (b *FixedSizeBinary) ValidateFull() error { return b.Validate() }

func NewFixedSizeBinaryScalar(val *memory.Buffer, typ arrow.DataType) *FixedSizeBinary {
	// NewBinaryScalar will call Retain on val, so we don't have to
	return &FixedSizeBinary{NewBinaryScalar(val, typ)}
}
