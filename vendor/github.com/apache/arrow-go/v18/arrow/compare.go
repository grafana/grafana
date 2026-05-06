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

import (
	"reflect"
)

type typeEqualsConfig struct {
	metadata bool
}

// TypeEqualOption is a functional option type used for configuring type
// equality checks.
type TypeEqualOption func(*typeEqualsConfig)

// CheckMetadata is an option for TypeEqual that allows checking for metadata
// equality besides type equality. It only makes sense for types with metadata.
func CheckMetadata() TypeEqualOption {
	return func(cfg *typeEqualsConfig) {
		cfg.metadata = true
	}
}

// TypeEqual checks if two DataType are the same, optionally checking metadata
// equality for STRUCT types.
func TypeEqual(left, right DataType, opts ...TypeEqualOption) bool {
	var cfg typeEqualsConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	switch {
	case left == nil || right == nil:
		return left == nil && right == nil
	case left.ID() != right.ID():
		return false
	}

	switch l := left.(type) {
	case ExtensionType:
		return l.ExtensionEquals(right.(ExtensionType))
	case *ListType:
		if !TypeEqual(l.Elem(), right.(*ListType).Elem(), opts...) {
			return false
		}
		if cfg.metadata && !l.elem.Metadata.Equal(right.(*ListType).elem.Metadata) {
			return false
		}
		return l.elem.Nullable == right.(*ListType).elem.Nullable
	case *FixedSizeListType:
		if !TypeEqual(l.Elem(), right.(*FixedSizeListType).Elem(), opts...) {
			return false
		}
		if cfg.metadata && !l.elem.Metadata.Equal(right.(*FixedSizeListType).elem.Metadata) {
			return false
		}
		return l.n == right.(*FixedSizeListType).n && l.elem.Nullable == right.(*FixedSizeListType).elem.Nullable
	case *MapType:
		if !TypeEqual(l.KeyType(), right.(*MapType).KeyType(), opts...) {
			return false
		}
		if !TypeEqual(l.ItemType(), right.(*MapType).ItemType(), opts...) {
			return false
		}
		if l.KeyField().Nullable != right.(*MapType).KeyField().Nullable {
			return false
		}
		if l.ItemField().Nullable != right.(*MapType).ItemField().Nullable {
			return false
		}
		if cfg.metadata {
			if !l.KeyField().Metadata.Equal(right.(*MapType).KeyField().Metadata) {
				return false
			}
			if !l.ItemField().Metadata.Equal(right.(*MapType).ItemField().Metadata) {
				return false
			}
		}
		return true
	case *StructType:
		r := right.(*StructType)
		switch {
		case len(l.fields) != len(r.fields):
			return false
		case !reflect.DeepEqual(l.index, r.index):
			return false
		}
		for i := range l.fields {
			leftField, rightField := l.fields[i], r.fields[i]
			switch {
			case leftField.Name != rightField.Name:
				return false
			case leftField.Nullable != rightField.Nullable:
				return false
			case !TypeEqual(leftField.Type, rightField.Type, opts...):
				return false
			case cfg.metadata && !leftField.Metadata.Equal(rightField.Metadata):
				return false
			}
		}
		return true
	case UnionType:
		r := right.(UnionType)
		if l.Mode() != r.Mode() {
			return false
		}

		if !reflect.DeepEqual(l.ChildIDs(), r.ChildIDs()) {
			return false
		}

		for i := range l.Fields() {
			leftField, rightField := l.Fields()[i], r.Fields()[i]
			switch {
			case leftField.Name != rightField.Name:
				return false
			case leftField.Nullable != rightField.Nullable:
				return false
			case !TypeEqual(leftField.Type, rightField.Type, opts...):
				return false
			case cfg.metadata && !leftField.Metadata.Equal(rightField.Metadata):
				return false
			case l.TypeCodes()[i] != r.TypeCodes()[i]:
				return false
			}
		}
		return true
	case *TimestampType:
		r := right.(*TimestampType)
		return l.Unit == r.Unit && l.TimeZone == r.TimeZone
	case *RunEndEncodedType:
		r := right.(*RunEndEncodedType)
		return TypeEqual(l.Encoded(), r.Encoded(), opts...) &&
			TypeEqual(l.runEnds, r.runEnds, opts...)
	default:
		return reflect.DeepEqual(left, right)
	}
}
