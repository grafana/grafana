package dataframe

type nullableFloatVector []*float64

func newNullableFloatVector(l int) *nullableFloatVector {
	v := make(nullableFloatVector, l)
	return &v
}

func (v *nullableFloatVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*float64)
}

func (v *nullableFloatVector) Append(val interface{}) {
	*v = append(*v, val.(*float64))
}

func (v *nullableFloatVector) At(i int) interface{} { return (*v)[i] }

func (v *nullableFloatVector) Len() int { return len(*v) }

func (v *nullableFloatVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableFloat64
}
