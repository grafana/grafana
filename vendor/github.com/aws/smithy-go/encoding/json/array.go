package json

import (
	"bytes"
)

// Array represents the encoding of a JSON Array
type Array struct {
	w          *bytes.Buffer
	writeComma bool
	scratch    *[]byte
}

func newArray(w *bytes.Buffer, scratch *[]byte) *Array {
	w.WriteRune(leftBracket)
	return &Array{w: w, scratch: scratch}
}

// Value adds a new element to the JSON Array.
// Returns a Value type that is used to encode
// the array element.
func (a *Array) Value() Value {
	if a.writeComma {
		a.w.WriteRune(comma)
	} else {
		a.writeComma = true
	}

	return newValue(a.w, a.scratch)
}

// Close encodes the end of the JSON Array
func (a *Array) Close() {
	a.w.WriteRune(rightBracket)
}
