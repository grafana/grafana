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

package internal

import (
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
)

const CurMetadataVersion = flatbuf.MetadataVersionV5

// DefaultHasValidityBitmap is a convenience function equivalent to
// calling HasValidityBitmap with CurMetadataVersion.
func DefaultHasValidityBitmap(id arrow.Type) bool { return HasValidityBitmap(id, CurMetadataVersion) }

// HasValidityBitmap returns whether the given type at the provided version is
// expected to have a validity bitmap in it's representation.
//
// Typically this is necessary because of the change between V4 and V5
// where union types no longer have validity bitmaps.
func HasValidityBitmap(id arrow.Type, version flatbuf.MetadataVersion) bool {
	// in <=V4 Null types had no validity bitmap
	// in >=V5 Null and Union types have no validity bitmap
	if version < flatbuf.MetadataVersionV5 {
		return id != arrow.NULL
	}

	switch id {
	case arrow.NULL, arrow.DENSE_UNION, arrow.SPARSE_UNION, arrow.RUN_END_ENCODED:
		return false
	}
	return true
}

// HasBufferSizesBuffer returns whether a given type has an extra buffer
// in the C ABI to store the sizes of other buffers. Currently this is only
// StringView and BinaryView.
func HasBufferSizesBuffer(id arrow.Type) bool {
	switch id {
	case arrow.STRING_VIEW, arrow.BINARY_VIEW:
		return true
	default:
		return false
	}
}
