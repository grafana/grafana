package dataframe

type boolVector []*bool

func newBoolVector(l int) *boolVector {
	v := make(boolVector, l)
	return &v
}

func (v *boolVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*bool)
}

func (v *boolVector) Append(val interface{}) {
	*v = append(*v, val.(*bool))
}

func (v *boolVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *boolVector) Len() int {
	return len(*v)
}
