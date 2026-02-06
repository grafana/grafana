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

package decimal

// Traits is a convenience for building generic objects for operating on
// Decimal values to get around the limitations of Go generics. By providing this
// interface a generic object can handle producing the proper types to generate
// new decimal values.
type Traits[T DecimalTypes] interface {
	BytesRequired(int) int
	FromString(string, int32, int32) (T, error)
	FromFloat64(float64, int32, int32) (T, error)
}

var (
	Dec32Traits  dec32Traits
	Dec64Traits  dec64Traits
	Dec128Traits dec128Traits
	Dec256Traits dec256Traits
)

type (
	dec32Traits  struct{}
	dec64Traits  struct{}
	dec128Traits struct{}
	dec256Traits struct{}
)

func (dec32Traits) BytesRequired(n int) int  { return 4 * n }
func (dec64Traits) BytesRequired(n int) int  { return 8 * n }
func (dec128Traits) BytesRequired(n int) int { return 16 * n }
func (dec256Traits) BytesRequired(n int) int { return 32 * n }

func (dec32Traits) FromString(v string, prec, scale int32) (Decimal32, error) {
	return Decimal32FromString(v, prec, scale)
}

func (dec64Traits) FromString(v string, prec, scale int32) (Decimal64, error) {
	return Decimal64FromString(v, prec, scale)
}

func (dec128Traits) FromString(v string, prec, scale int32) (Decimal128, error) {
	return Decimal128FromString(v, prec, scale)
}

func (dec256Traits) FromString(v string, prec, scale int32) (Decimal256, error) {
	return Decimal256FromString(v, prec, scale)
}

func (dec32Traits) FromFloat64(v float64, prec, scale int32) (Decimal32, error) {
	return Decimal32FromFloat(v, prec, scale)
}

func (dec64Traits) FromFloat64(v float64, prec, scale int32) (Decimal64, error) {
	return Decimal64FromFloat(v, prec, scale)
}

func (dec128Traits) FromFloat64(v float64, prec, scale int32) (Decimal128, error) {
	return Decimal128FromFloat(v, prec, scale)
}

func (dec256Traits) FromFloat64(v float64, prec, scale int32) (Decimal256, error) {
	return Decimal256FromFloat(v, prec, scale)
}
