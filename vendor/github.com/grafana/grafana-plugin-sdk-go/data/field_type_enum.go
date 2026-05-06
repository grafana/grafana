package data

// this supports the enum type
// it is different than the rest since it is backed by
// a uint16 but maps to the EnumItemIndex type, and has special semantics and interacts with the metadata
// Unlike the other fields it can not be easily generated

type enumVector []EnumItemIndex

type EnumItemIndex uint16

func newEnumVector(n int) *enumVector {
	v := enumVector(make([]EnumItemIndex, n))
	return &v
}

func newEnumVectorWithValues(s []EnumItemIndex) *enumVector {
	v := make([]EnumItemIndex, len(s))
	copy(v, s)
	return (*enumVector)(&v)
}

func (v *enumVector) Set(idx int, i interface{}) {
	(*v)[idx] = i.(EnumItemIndex)
}

func (v *enumVector) SetConcrete(idx int, i interface{}) {
	v.Set(idx, i)
}

func (v *enumVector) Append(i interface{}) {
	*v = append(*v, i.(EnumItemIndex))
}

func (v *enumVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *enumVector) NilAt(_ int) bool {
	return false
}

func (v *enumVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *enumVector) Len() int {
	return len(*v)
}

func (v *enumVector) CopyAt(i int) interface{} {
	return (*v)[i]
}

func (v *enumVector) ConcreteAt(i int) (interface{}, bool) {
	return v.At(i), true
}

func (v *enumVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *enumVector) Extend(i int) {
	*v = append(*v, make([]EnumItemIndex, i)...)
}

func (v *enumVector) Insert(i int, val interface{}) {
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

func (v *enumVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}

type nullableEnumVector []*EnumItemIndex

func newNullableEnumVector(n int) *nullableEnumVector {
	v := nullableEnumVector(make([]*EnumItemIndex, n))
	return &v
}

func newNullableEnumVectorWithValues(s []*EnumItemIndex) *nullableEnumVector {
	v := make([]*EnumItemIndex, len(s))
	copy(v, s)
	return (*nullableEnumVector)(&v)
}

func (v *nullableEnumVector) Set(idx int, i interface{}) {
	if i == nil {
		(*v)[idx] = nil
		return
	}
	(*v)[idx] = i.(*EnumItemIndex)
}

func (v *nullableEnumVector) SetConcrete(idx int, i interface{}) {
	val := i.(EnumItemIndex)
	(*v)[idx] = &val
}

func (v *nullableEnumVector) Append(i interface{}) {
	if i == nil {
		*v = append(*v, nil)
		return
	}
	*v = append(*v, i.(*EnumItemIndex))
}

func (v *nullableEnumVector) At(i int) interface{} {
	return (*v)[i]
}

func (v *nullableEnumVector) NilAt(i int) bool {
	return (*v)[i] == nil
}

func (v *nullableEnumVector) CopyAt(i int) interface{} {
	if (*v)[i] == nil {
		var g *EnumItemIndex
		return g
	}
	g := *(*v)[i]
	return &g
}

func (v *nullableEnumVector) ConcreteAt(i int) (interface{}, bool) {
	var g EnumItemIndex
	val := (*v)[i]
	if val == nil {
		return g, false
	}
	g = *val
	return g, true
}

func (v *nullableEnumVector) PointerAt(i int) interface{} {
	return &(*v)[i]
}

func (v *nullableEnumVector) Len() int {
	return len(*v)
}

func (v *nullableEnumVector) Type() FieldType {
	return vectorFieldType(v)
}

func (v *nullableEnumVector) Extend(i int) {
	*v = append(*v, make([]*EnumItemIndex, i)...)
}

func (v *nullableEnumVector) Insert(i int, val interface{}) {
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

func (v *nullableEnumVector) Delete(i int) {
	*v = append((*v)[:i], (*v)[i+1:]...)
}
