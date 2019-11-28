package dataframe

import (
	"time"
)

type nullableTimeVector []*time.Time

func newNullableTimeVector(l int) *nullableTimeVector {
	v := make(nullableTimeVector, l)
	return &v
}

func (v *nullableTimeVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*time.Time)
}

func (v *nullableTimeVector) Append(val interface{}) {
	*v = append(*v, val.(*time.Time))
}

func (v *nullableTimeVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableTimeVector) Len() int {
	return len(*v)
}

func (v *nullableTimeVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableTime
}
