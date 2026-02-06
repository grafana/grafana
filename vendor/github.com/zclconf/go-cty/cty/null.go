package cty

// NullVal returns a null value of the given type. A null can be created of any
// type, but operations on such values will always panic. Calling applications
// are encouraged to use nulls only sparingly, particularly when user-provided
// expressions are to be evaluated, since the precence of nulls creates a
// much higher chance of evaluation errors that can't be caught by a type
// checker.
func NullVal(t Type) Value {
	return Value{
		ty: t,
		v:  nil,
	}
}
