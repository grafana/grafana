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

//go:build go1.18

package scalar

import (
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"golang.org/x/exp/constraints"
)

type primitives interface {
	bool | float16.Num | decimal128.Num |
		decimal256.Num | constraints.Integer | constraints.Float |
		arrow.DayTimeInterval | arrow.MonthInterval | arrow.MonthDayNanoInterval
}

type builder[T primitives | []byte] interface {
	AppendNull()
	UnsafeAppend(T)
	UnsafeAppendBoolToBitmap(bool)
}

type binaryBuilder interface {
	builder[[]byte]
	ReserveData(int)
}

func appendPrimitive[T primitives, B builder[T]](bldr B, scalars []Scalar) {
	for _, sc := range scalars {
		if sc.IsValid() {
			bldr.UnsafeAppend(sc.value().(T))
		} else {
			bldr.UnsafeAppendBoolToBitmap(false)
		}
	}
}

func appendBinary(bldr binaryBuilder, scalars []Scalar) {
	var dataSize int
	for _, s := range scalars {
		s := s.(BinaryScalar)
		if s.IsValid() {
			dataSize += len(s.Data())
		}
	}

	bldr.ReserveData(dataSize)
	for _, sc := range scalars {
		s := sc.(BinaryScalar)
		if s.IsValid() {
			bldr.UnsafeAppend(s.Data())
		} else {
			bldr.AppendNull()
		}
	}
}

type extbuilder interface {
	array.Builder
	StorageBuilder() array.Builder
}

func appendToBldr(bldr array.Builder, scalars []Scalar) error {
	if len(scalars) == 0 {
		return nil
	}

	ty := bldr.Type()
	bldr.Reserve(len(scalars))
	switch bldr := bldr.(type) {
	case extbuilder:
		baseScalars := make([]Scalar, len(scalars))
		for i, sc := range scalars {
			baseScalars[i] = sc.(*Extension).Value
		}

		return appendToBldr(bldr.StorageBuilder(), baseScalars)
	case *array.BooleanBuilder:
		appendPrimitive(bldr, scalars)
	case *array.Decimal128Builder:
		appendPrimitive(bldr, scalars)
	case *array.Decimal256Builder:
		appendPrimitive(bldr, scalars)
	case *array.FixedSizeBinaryBuilder:
		for _, sc := range scalars {
			s := sc.(*FixedSizeBinary)
			if s.Valid {
				bldr.UnsafeAppend(s.Value.Bytes())
			} else {
				bldr.UnsafeAppendBoolToBitmap(false)
			}
		}
	case *array.Int8Builder:
		appendPrimitive(bldr, scalars)
	case *array.Uint8Builder:
		appendPrimitive(bldr, scalars)
	case *array.Int16Builder:
		appendPrimitive(bldr, scalars)
	case *array.Uint16Builder:
		appendPrimitive(bldr, scalars)
	case *array.Int32Builder:
		appendPrimitive(bldr, scalars)
	case *array.Uint32Builder:
		appendPrimitive(bldr, scalars)
	case *array.Int64Builder:
		appendPrimitive(bldr, scalars)
	case *array.Uint64Builder:
		appendPrimitive(bldr, scalars)
	case *array.Float16Builder:
		appendPrimitive(bldr, scalars)
	case *array.Float32Builder:
		appendPrimitive(bldr, scalars)
	case *array.Float64Builder:
		appendPrimitive(bldr, scalars)
	case *array.Date32Builder:
		appendPrimitive(bldr, scalars)
	case *array.Date64Builder:
		appendPrimitive(bldr, scalars)
	case *array.Time32Builder:
		appendPrimitive(bldr, scalars)
	case *array.Time64Builder:
		appendPrimitive(bldr, scalars)
	case *array.DayTimeIntervalBuilder:
		appendPrimitive(bldr, scalars)
	case *array.MonthIntervalBuilder:
		appendPrimitive(bldr, scalars)
	case *array.MonthDayNanoIntervalBuilder:
		appendPrimitive(bldr, scalars)
	case *array.DurationBuilder:
		appendPrimitive(bldr, scalars)
	case *array.TimestampBuilder:
		appendPrimitive(bldr, scalars)
	case array.StringLikeBuilder:
		appendBinary(bldr, scalars)
	case *array.BinaryBuilder:
		appendBinary(bldr, scalars)
	case array.ListLikeBuilder:
		var numChildren int
		for _, s := range scalars {
			if !s.IsValid() {
				continue
			}
			numChildren += s.(ListScalar).GetList().Len()
		}
		bldr.ValueBuilder().Reserve(numChildren)

		for _, s := range scalars {
			bldr.Append(s.IsValid())
			if s.IsValid() {
				list := s.(ListScalar).GetList()
				for i := 0; i < list.Len(); i++ {
					sc, err := GetScalar(list, i)
					if err != nil {
						return err
					}
					if err := Append(bldr.ValueBuilder(), sc); err != nil {
						return err
					}
				}
			}
		}
	case *array.StructBuilder:
		for _, sc := range scalars {
			s := sc.(*Struct)
			for i := 0; i < bldr.NumField(); i++ {
				if !s.Valid || s.Value[i] == nil {
					bldr.FieldBuilder(i).UnsafeAppendBoolToBitmap(false)
				} else {
					if err := Append(bldr.FieldBuilder(i), s.Value[i]); err != nil {
						return err
					}
				}
			}
			bldr.UnsafeAppendBoolToBitmap(s.Valid)
		}
	case *array.SparseUnionBuilder:
		ty := ty.(*arrow.SparseUnionType)
		for i := 0; i < bldr.NumChildren(); i++ {
			bldr.Child(i).Reserve(len(scalars))
		}

		for _, s := range scalars {
			// for each scalar
			// 1. append the type code
			// 2. append the value to the corresponding child
			// 3. append null to the other children
			s := s.(*SparseUnion)
			bldr.Append(s.TypeCode)
			for i := range ty.Fields() {
				child := bldr.Child(i)
				if s.ChildID == i {
					if s.Valid {
						if err := Append(child, s.Value[i]); err != nil {
							return err
						}
					} else {
						child.UnsafeAppendBoolToBitmap(false)
					}
				} else {
					child.UnsafeAppendBoolToBitmap(false)
				}
			}
		}
	case *array.DenseUnionBuilder:
		ty := ty.(*arrow.DenseUnionType)
		for i := 0; i < bldr.NumChildren(); i++ {
			bldr.Child(i).Reserve(len(scalars))
		}

		for _, s := range scalars {
			s := s.(*DenseUnion)
			fieldIndex := ty.ChildIDs()[s.TypeCode]
			bldr.Append(s.TypeCode)

			for i := range ty.Fields() {
				child := bldr.Child(i)
				if i == fieldIndex {
					if s.Valid {
						if err := Append(child, s.Value); err != nil {
							return err
						}
					} else {
						child.UnsafeAppendBoolToBitmap(false)
					}
				}
			}
		}
	default:
		return fmt.Errorf("%w: append scalar for type %s", arrow.ErrNotImplemented, ty)
	}

	return nil
}

// Append requires the passed in builder and scalar to have the same datatype
// otherwise it will return an error. Will return arrow.ErrNotImplemented if
// the type hasn't been implemented for this.
//
// NOTE only available in go1.18+
func Append(bldr array.Builder, s Scalar) error {
	return AppendSlice(bldr, []Scalar{s})
}

// AppendSlice requires the passed in builder and all scalars in the slice
// to have the same datatype otherwise it will return an error. Will return
// arrow.ErrNotImplemented if the type hasn't been implemented for this.
//
// NOTE only available in go1.18+
func AppendSlice(bldr array.Builder, scalars []Scalar) error {
	if len(scalars) == 0 {
		return nil
	}

	ty := bldr.Type()
	for _, sc := range scalars {
		if !arrow.TypeEqual(ty, sc.DataType()) {
			return fmt.Errorf("%w: cannot append scalar of type %s to builder for type %s",
				arrow.ErrInvalid, scalars[0].DataType(), bldr.Type())
		}
	}

	return appendToBldr(bldr, scalars)
}
