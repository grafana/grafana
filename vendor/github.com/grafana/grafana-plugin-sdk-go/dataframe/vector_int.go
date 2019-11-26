package dataframe

type intVector []int64

func newIntVector(l int) *intVector {
	v := make(intVector, l)
	return &v
}

func (v *intVector) Set(i int, val interface{}) {
	(*v)[i] = val.(int64)
}

func (v *intVector) Append(val interface{}) {
	*v = append(*v, val.(int64))
}

func (v *intVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *intVector) Len() int {
	return len(*v)
}

func (v *intVector) PrimitiveType() VectorPType {
	return VectorPTypeInt64
}
