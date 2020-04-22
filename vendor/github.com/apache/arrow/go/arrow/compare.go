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
// equality besides type equality. It only makes sense for STRUCT type.
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
		return false
	case left.ID() != right.ID():
		return false
	}

	// StructType is the only type that has metadata.
	l, ok := left.(*StructType)
	if !ok || cfg.metadata {
		return reflect.DeepEqual(left, right)
	}

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
		}
	}
	return true
}
