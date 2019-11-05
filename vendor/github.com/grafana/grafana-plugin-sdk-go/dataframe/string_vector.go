package dataframe

type stringVector []*string

func newStringVector(l int) *stringVector {
	v := make(stringVector, l)
	return &v
}

func (v *stringVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*string)
}

func (v *stringVector) Append(val interface{}) {
	*v = append(*v, val.(*string))
}

func (v *stringVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *stringVector) Len() int {
	return len(*v)
}
