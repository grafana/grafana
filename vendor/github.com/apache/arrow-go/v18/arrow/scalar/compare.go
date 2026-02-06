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

import "github.com/apache/arrow-go/v18/arrow"

// Equals returns true if two scalars are equal, which means they have the same
// datatype, validity and value.
func Equals(left, right Scalar) bool {
	if left == right {
		return true
	}

	if !arrow.TypeEqual(left.DataType(), right.DataType()) {
		return false
	}

	if left.IsValid() != right.IsValid() {
		return false
	}

	if !left.IsValid() {
		return true
	}

	return left.equals(right)
}

type equalOption struct {
	atol   float64 // absolute tolerance
	nansEq bool    // whether NaNs are considered equal
}

// EqualOption is a functional option type used to configure how Records and Arrays are compared.
type EqualOption func(*equalOption)

// WithNaNsEqual configures the comparison functions so that NaNs are considered equal.
func WithNaNsEqual(val bool) EqualOption {
	return func(eo *equalOption) {
		eo.nansEq = val
	}
}

// WithAbsTolerance configures the comparison functions so that 2 floating point values
// v1 and v2 are considered equal if |v1-v2| <= atol.
func WithAbsTolerance(atol float64) EqualOption {
	return func(eo *equalOption) {
		eo.atol = atol
	}
}

const defaultAbsoluteTolerance = 1e-5

type approxEqualScalar interface {
	approxEquals(Scalar, equalOption) bool
}

func ApproxEquals(left, right Scalar, opts ...EqualOption) bool {
	eq := equalOption{
		atol:   defaultAbsoluteTolerance,
		nansEq: false,
	}
	for _, opt := range opts {
		opt(&eq)
	}

	switch {
	case left == right:
		return true
	case !arrow.TypeEqual(left.DataType(), right.DataType()):
		return false
	case left.IsValid() != right.IsValid():
		return false
	case !left.IsValid():
		return true
	}

	if approx, ok := left.(approxEqualScalar); ok {
		return approx.approxEquals(right, eq)
	}

	return left.equals(right)
}
