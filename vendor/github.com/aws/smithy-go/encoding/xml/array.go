package xml

// arrayMemberWrapper is the default member wrapper tag name for XML Array type
var arrayMemberWrapper = StartElement{
	Name: Name{Local: "member"},
}

// Array represents the encoding of a XML array type
type Array struct {
	w       writer
	scratch *[]byte

	// member start element is the array member wrapper start element
	memberStartElement StartElement

	// isFlattened indicates if the array is a flattened array.
	isFlattened bool
}

// newArray returns an array encoder.
// It also takes in the  member start element, array start element.
// It takes in a isFlattened bool, indicating that an array is flattened array.
//
// A wrapped array ["value1", "value2"] is represented as
// `<List><member>value1</member><member>value2</member></List>`.

// A flattened array `someList: ["value1", "value2"]` is represented as
// `<someList>value1</someList><someList>value2</someList>`.
func newArray(w writer, scratch *[]byte, memberStartElement StartElement, arrayStartElement StartElement, isFlattened bool) *Array {
	var memberWrapper = memberStartElement
	if isFlattened {
		memberWrapper = arrayStartElement
	}

	return &Array{
		w:                  w,
		scratch:            scratch,
		memberStartElement: memberWrapper,
		isFlattened:        isFlattened,
	}
}

// Member adds a new member to the XML array.
// It returns a Value encoder.
func (a *Array) Member() Value {
	v := newValue(a.w, a.scratch, a.memberStartElement)
	v.isFlattened = a.isFlattened
	return v
}
