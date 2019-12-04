package dataframe

type nullableStringVector []*string

func newNullableStringVector(l int) *nullableStringVector {
	v := make(nullableStringVector, l)
	return &v
}

func (v *nullableStringVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*string)
}

func (v *nullableStringVector) Append(val interface{}) {
	*v = append(*v, val.(*string))
}

func (v *nullableStringVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableStringVector) Len() int {
	return len(*v)
}

func (v *nullableStringVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableString
}