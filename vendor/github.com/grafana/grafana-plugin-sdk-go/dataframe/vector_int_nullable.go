package dataframe

type nullableIntVector []*int64

func newNullableIntVector(l int) *nullableIntVector {
	v := make(nullableIntVector, l)
	return &v
}

func (v *nullableIntVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*int64)
}

func (v *nullableIntVector) Append(val interface{}) {
	*v = append(*v, val.(*int64))
}

func (v *nullableIntVector) At(i int) interface{} { return (*v)[i] }

func (v *nullableIntVector) Len() int { return len(*v) }

func (v *nullableIntVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableInt64
}
