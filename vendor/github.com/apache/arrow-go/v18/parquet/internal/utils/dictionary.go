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

package utils

import (
	"math"

	"github.com/apache/arrow-go/v18/parquet"
)

// IndexType is the type we're going to use for Dictionary indexes, currently
// an alias to int32
type IndexType = int32

// Max and Min constants for the IndexType
const (
	MaxIndexType = math.MaxInt32
	MinIndexType = math.MinInt32
)

type DictionaryConverter[T parquet.ColumnTypes | uint64] interface {
	// Copy populates the input slice by the dictionary values at the indexes from the IndexType slice
	Copy([]T, []IndexType) error
	// Fill fills the input slice with the value specified by the dictionary index passed in.
	Fill([]T, IndexType) error
	// FillZero fills the input slice with the zero value for the given type.
	FillZero([]T)
	// IsValid validates that all of the indexes passed in are valid indexes for the dictionary
	IsValid(...IndexType) bool
	// IsValidSingle validates that the index passed in is a valid index for the dictionary
	// This is an optimisation, to avoid allocating a slice for a single value
	IsValidSingle(IndexType) bool
}

// converter for getspaced that handles runs that get returned directly
// as output, rather than using a dictionary
type plainConverter[T ~uint64] struct{}

func (plainConverter[T]) IsValid(...IndexType) bool { return true }

func (plainConverter[T]) IsValidSingle(IndexType) bool { return true }

func (plainConverter[T]) Fill(values []T, val IndexType) error {
	if len(values) == 0 {
		return nil
	}
	values[0] = T(val)
	for i := 1; i < len(values); i *= 2 {
		copy(values[i:], values[0:i])
	}
	return nil
}

func (plainConverter[T]) FillZero(values []T) {
	if len(values) == 0 {
		return
	}
	var zero T
	values[0] = zero
	for i := 1; i < len(values); i *= 2 {
		copy(values[i:], values[0:i])
	}
}

func (plainConverter[T]) Copy(out []T, values []IndexType) error {
	for i := range values {
		out[i] = T(values[i])
	}
	return nil
}
