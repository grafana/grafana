package dataframe

type nullableBoolVector []*bool

func newNullableBoolVector(l int) *nullableBoolVector {
	v := make(nullableBoolVector, l)
	return &v
}

func (v *nullableBoolVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*bool)
}

func (v *nullableBoolVector) Append(val interface{}) {
	*v = append(*v, val.(*bool))
}

func (v *nullableBoolVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableBoolVector) Len() int {
	return len(*v)
}

func (v *nullableBoolVector) PrimitiveType() VectorPType {
	return VectorPTypeNullableBool
}
