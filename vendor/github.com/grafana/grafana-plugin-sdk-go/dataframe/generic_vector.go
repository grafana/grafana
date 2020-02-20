package dataframe

import (
	"github.com/cheekybits/genny/generic"
)

//go:generate genny -in=$GOFILE -out=vector.gen.go gen "gen=uint8,uint16,uint32,uint64,int8,int16,int32,int64,float32,float64,string,bool,time.Time"

type gen generic.Type

type genVector []gen

func newgenVector(n int) *genVector {
	v := genVector(make([]gen, n))
	return &v
}

func (v *genVector) Set(idx int, i interface{}) {
	(*v)[idx] = i.(gen)
}

func (v *genVector) Append(i interface{}) {
	(*v) = append((*v), i.(gen))
}

func (v *genVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *genVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *genVector) Len() int {
	return len((*v))
}

func (v *genVector) PrimitiveType() VectorPType {
	return vectorPType(v)
}

func (v *genVector) Extend(i int) {
	(*v) = append((*v), make([]gen, i)...)
}
