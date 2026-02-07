package json

import (
	"bytes"
)

// Object represents the encoding of a JSON Object type
type Object struct {
	w          *bytes.Buffer
	writeComma bool
	scratch    *[]byte
}

func newObject(w *bytes.Buffer, scratch *[]byte) *Object {
	w.WriteRune(leftBrace)
	return &Object{w: w, scratch: scratch}
}

func (o *Object) writeKey(key string) {
	escapeStringBytes(o.w, []byte(key))
	o.w.WriteRune(colon)
}

// Key adds the given named key to the JSON object.
// Returns a Value encoder that should be used to encode
// a JSON value type.
func (o *Object) Key(name string) Value {
	if o.writeComma {
		o.w.WriteRune(comma)
	} else {
		o.writeComma = true
	}
	o.writeKey(name)
	return newValue(o.w, o.scratch)
}

// Close encodes the end of the JSON Object
func (o *Object) Close() {
	o.w.WriteRune(rightBrace)
}
