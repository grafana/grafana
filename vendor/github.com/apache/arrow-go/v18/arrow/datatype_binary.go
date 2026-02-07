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

package arrow

// OffsetTraits is a convenient interface over the various type traits
// constants such as arrow.Int32Traits allowing types with offsets, like
// BinaryType, StringType, LargeBinaryType and LargeStringType to have
// a method to return information about their offset type and how many bytes
// would be required to allocate an offset buffer for them.
type OffsetTraits interface {
	// BytesRequired returns the number of bytes required to be allocated
	// in order to hold the passed in number of elements of this type.
	BytesRequired(int) int
}

type BinaryType struct{}

func (t *BinaryType) ID() Type            { return BINARY }
func (t *BinaryType) Name() string        { return "binary" }
func (t *BinaryType) String() string      { return "binary" }
func (t *BinaryType) binary()             {}
func (t *BinaryType) Fingerprint() string { return typeFingerprint(t) }
func (t *BinaryType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(),
		SpecFixedWidth(Int32SizeBytes), SpecVariableWidth()}}
}
func (t *BinaryType) OffsetTypeTraits() OffsetTraits { return Int32Traits }
func (BinaryType) IsUtf8() bool                      { return false }

type StringType struct{}

func (t *StringType) ID() Type            { return STRING }
func (t *StringType) Name() string        { return "utf8" }
func (t *StringType) String() string      { return "utf8" }
func (t *StringType) binary()             {}
func (t *StringType) Fingerprint() string { return typeFingerprint(t) }
func (t *StringType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(),
		SpecFixedWidth(Int32SizeBytes), SpecVariableWidth()}}
}
func (t *StringType) OffsetTypeTraits() OffsetTraits { return Int32Traits }
func (StringType) IsUtf8() bool                      { return true }

type LargeBinaryType struct{}

func (t *LargeBinaryType) ID() Type            { return LARGE_BINARY }
func (t *LargeBinaryType) Name() string        { return "large_binary" }
func (t *LargeBinaryType) String() string      { return "large_binary" }
func (t *LargeBinaryType) binary()             {}
func (t *LargeBinaryType) Fingerprint() string { return typeFingerprint(t) }
func (t *LargeBinaryType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(),
		SpecFixedWidth(Int64SizeBytes), SpecVariableWidth()}}
}
func (t *LargeBinaryType) OffsetTypeTraits() OffsetTraits { return Int64Traits }
func (LargeBinaryType) IsUtf8() bool                      { return false }

type LargeStringType struct{}

func (t *LargeStringType) ID() Type            { return LARGE_STRING }
func (t *LargeStringType) Name() string        { return "large_utf8" }
func (t *LargeStringType) String() string      { return "large_utf8" }
func (t *LargeStringType) binary()             {}
func (t *LargeStringType) Fingerprint() string { return typeFingerprint(t) }
func (t *LargeStringType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(),
		SpecFixedWidth(Int64SizeBytes), SpecVariableWidth()}}
}
func (t *LargeStringType) OffsetTypeTraits() OffsetTraits { return Int64Traits }
func (LargeStringType) IsUtf8() bool                      { return true }

type BinaryViewType struct{}

func (*BinaryViewType) ID() Type              { return BINARY_VIEW }
func (*BinaryViewType) Name() string          { return "binary_view" }
func (*BinaryViewType) String() string        { return "binary_view" }
func (*BinaryViewType) IsUtf8() bool          { return false }
func (*BinaryViewType) binary()               {}
func (*BinaryViewType) view()                 {}
func (t *BinaryViewType) Fingerprint() string { return typeFingerprint(t) }
func (*BinaryViewType) Layout() DataTypeLayout {
	variadic := SpecVariableWidth()
	return DataTypeLayout{
		Buffers:      []BufferSpec{SpecBitmap(), SpecFixedWidth(ViewHeaderSizeBytes)},
		VariadicSpec: &variadic,
	}
}

type StringViewType struct{}

func (*StringViewType) ID() Type              { return STRING_VIEW }
func (*StringViewType) Name() string          { return "string_view" }
func (*StringViewType) String() string        { return "string_view" }
func (*StringViewType) IsUtf8() bool          { return true }
func (*StringViewType) binary()               {}
func (*StringViewType) view()                 {}
func (t *StringViewType) Fingerprint() string { return typeFingerprint(t) }
func (*StringViewType) Layout() DataTypeLayout {
	variadic := SpecVariableWidth()
	return DataTypeLayout{
		Buffers:      []BufferSpec{SpecBitmap(), SpecFixedWidth(ViewHeaderSizeBytes)},
		VariadicSpec: &variadic,
	}
}

var (
	BinaryTypes = struct {
		Binary      BinaryDataType
		String      BinaryDataType
		LargeBinary BinaryDataType
		LargeString BinaryDataType
		BinaryView  BinaryDataType
		StringView  BinaryDataType
	}{
		Binary:      &BinaryType{},
		String:      &StringType{},
		LargeBinary: &LargeBinaryType{},
		LargeString: &LargeStringType{},
		BinaryView:  &BinaryViewType{},
		StringView:  &StringViewType{},
	}

	_ BinaryViewDataType = (*StringViewType)(nil)
	_ BinaryViewDataType = (*BinaryViewType)(nil)
)
