package dataframe

type floatVector []*float64

func newFloatVector(l int) *floatVector {
	v := make(floatVector, l)
	return &v
}

func (v *floatVector) Set(i int, val interface{}) {
	(*v)[i] = val.(*float64)
}

func (v *floatVector) Append(val interface{}) {
	*v = append(*v, val.(*float64))
}

func (v *floatVector) At(i int) interface{} { return (*v)[i] }

func (v *floatVector) Len() int { return len(*v) }
