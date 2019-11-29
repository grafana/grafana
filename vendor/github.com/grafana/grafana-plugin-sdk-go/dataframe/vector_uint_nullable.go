package dataframe

type nullableUintVector []*uint64

func newNullableUintVector(l int) *nullableUintVector {
	v := make(nullableUintVector, l)
	return &v
}

func (v *nullableUintVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*uint64)
}

func (v *nullableUintVector) Append(val interface{}) {
	*v = append(*v, val.(*uint64))
}

func (v *nullableUintVector) At(i int) interface{} { return (*v)[i] }

func (v *nullableUintVector) Len() int { return len(*v) }

func (v *nullableUintVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableUInt64
}
