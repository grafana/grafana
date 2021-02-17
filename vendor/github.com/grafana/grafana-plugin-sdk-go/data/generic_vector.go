package data

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

func (v *genVector) SetConcrete(idx int, i interface{}) {
	v.Set(idx, i)
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

func (v *genVector) CopyAt(i int) interface{} {
	var g gen
	g = (*v)[i]
	return g
}

func (v *genVector) ConcreteAt(i int) (interface{}, bool) {
	return v.At(i), true
}

func (v *genVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *genVector) Extend(i int) {
	(*v) = append((*v), make([]gen, i)...)
}

func (v *genVector) Insert(i int, val interface{}) {
	switch {
	case i < v.Len():
		v.Extend(1)
		copy((*v)[i+1:], (*v)[i:])
		v.Set(i, val)
	case i == v.Len():
		v.Append(val)
	case i > v.Len():
		panic("Invalid index; vector length should be greater or equal to that index")
	}
}

func (v *genVector) Delete(i int) {
	(*v) = append((*v)[:i], (*v)[i+1:]...)
}
