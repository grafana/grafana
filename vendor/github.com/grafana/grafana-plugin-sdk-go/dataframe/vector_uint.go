package dataframe

type uintVector []uint64

func newUintVector(l int) *uintVector {
	v := make(uintVector, l)
	return &v
}

func (v *uintVector) Set(i int, val interface{}) {
	(*v)[i] = val.(uint64)
}

func (v *uintVector) Append(val interface{}) {
	*v = append(*v, val.(uint64))
}

func (v *uintVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *uintVector) Len() int {
	return len(*v)
}

func (v *uintVector) PrimitiveType() VectorPType {
	return VectorPTypeUint64
}
