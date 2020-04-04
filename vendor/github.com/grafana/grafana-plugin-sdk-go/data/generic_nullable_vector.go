package data

//go:generate genny -in=$GOFILE -out=nullable_vector.gen.go gen "gen=uint8,uint16,uint32,uint64,int8,int16,int32,int64,float32,float64,string,bool,time.Time"

type nullablegenVector []*gen

func newNullablegenVector(n int) *nullablegenVector {
	v := nullablegenVector(make([]*gen, n))
	return &v
}

func (v *nullablegenVector) Set(idx int, i interface{}) {
	(*v)[idx] = i.(*gen)
}

func (v *nullablegenVector) Append(i interface{}) {
	if i == nil {
		(*v) = append((*v), nil)
		return
	}
	(*v) = append((*v), i.(*gen))
}

func (v *nullablegenVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullablegenVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *gen
		return g
	}
	var g gen
	g = *(*v)[i]
	return &g
}

func (v *nullablegenVector) ConcreteAt(i int) (interface{}, bool) {
	var g gen
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullablegenVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullablegenVector) Len() int {
	return len((*v))
}

func (v *nullablegenVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullablegenVector) Extend(i int) {
	(*v) = append((*v), make([]*gen, i)...)
}
