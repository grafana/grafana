package dataframe

// Vector represents a collection of Elements.
type Vector interface {
	Set(idx int, i interface{})
	Append(i interface{})
	At(i int) interface{}
	Len() int
}

func newVector(t FieldType, n int) Vector {
	switch t {
	case FieldTypeNumber:
		return newFloatVector(n)
	case FieldTypeTime:
		return newTimeVector(n)
	case FieldTypeString:
		return newStringVector(n)
	case FieldTypeBoolean:
		return newBoolVector(n)
	default:
		return nil
	}
}
