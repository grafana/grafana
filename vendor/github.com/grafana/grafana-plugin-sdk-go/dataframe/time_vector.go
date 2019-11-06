package dataframe

import (
	"time"
)

type timeVector []*time.Time

func newTimeVector(l int) *timeVector {
	v := make(timeVector, l)
	return &v
}

func (v *timeVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*time.Time)
}

func (v *timeVector) Append(val interface{}) {
	*v = append(*v, val.(*time.Time))
}

func (v *timeVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *timeVector) Len() int {
	return len(*v)
}
