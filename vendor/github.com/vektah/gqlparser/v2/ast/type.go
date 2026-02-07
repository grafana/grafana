package ast

func NonNullNamedType(named string, pos *Position) *Type {
	return &Type{NamedType: named, NonNull: true, Position: pos}
}

func NamedType(named string, pos *Position) *Type {
	return &Type{NamedType: named, NonNull: false, Position: pos}
}

func NonNullListType(elem *Type, pos *Position) *Type {
	return &Type{Elem: elem, NonNull: true, Position: pos}
}

func ListType(elem *Type, pos *Position) *Type {
	return &Type{Elem: elem, NonNull: false, Position: pos}
}

type Type struct {
	NamedType string
	Elem      *Type
	NonNull   bool
	Position  *Position `dump:"-" json:"-"`
}

func (t *Type) Name() string {
	if t.NamedType != "" {
		return t.NamedType
	}

	return t.Elem.Name()
}

func (t *Type) String() string {
	nn := ""
	if t.NonNull {
		nn = "!"
	}
	if t.NamedType != "" {
		return t.NamedType + nn
	}

	return "[" + t.Elem.String() + "]" + nn
}

func (t *Type) IsCompatible(other *Type) bool {
	if t.NamedType != other.NamedType {
		return false
	}

	if t.Elem != nil && other.Elem == nil {
		return false
	}

	if t.Elem != nil && !t.Elem.IsCompatible(other.Elem) {
		return false
	}

	if other.NonNull {
		return t.NonNull
	}

	return true
}

func (t *Type) Dump() string {
	return t.String()
}
