package xml

import (
	"encoding/base64"
	"fmt"
	"math/big"
	"strconv"

	"github.com/aws/smithy-go/encoding"
)

// Value represents an XML Value type
// XML Value types: Object, Array, Map, String, Number, Boolean.
type Value struct {
	w       writer
	scratch *[]byte

	// xml start element is the associated start element for the Value
	startElement StartElement

	// indicates if the Value represents a flattened shape
	isFlattened bool
}

// newFlattenedValue returns a Value encoder. newFlattenedValue does NOT write the start element tag
func newFlattenedValue(w writer, scratch *[]byte, startElement StartElement) Value {
	return Value{
		w:            w,
		scratch:      scratch,
		startElement: startElement,
	}
}

// newValue writes the start element xml tag and returns a Value
func newValue(w writer, scratch *[]byte, startElement StartElement) Value {
	writeStartElement(w, startElement)
	return Value{w: w, scratch: scratch, startElement: startElement}
}

// writeStartElement takes in a start element and writes it.
// It handles namespace, attributes in start element.
func writeStartElement(w writer, el StartElement) error {
	if el.isZero() {
		return fmt.Errorf("xml start element cannot be nil")
	}

	w.WriteRune(leftAngleBracket)

	if len(el.Name.Space) != 0 {
		escapeString(w, el.Name.Space)
		w.WriteRune(colon)
	}
	escapeString(w, el.Name.Local)
	for _, attr := range el.Attr {
		w.WriteRune(' ')
		writeAttribute(w, &attr)
	}

	w.WriteRune(rightAngleBracket)
	return nil
}

// writeAttribute writes an attribute from a provided Attribute
// For a namespace attribute, the attr.Name.Space must be defined as "xmlns".
// https://www.w3.org/TR/REC-xml-names/#NT-DefaultAttName
func writeAttribute(w writer, attr *Attr) {
	// if local, space both are not empty
	if len(attr.Name.Space) != 0 && len(attr.Name.Local) != 0 {
		escapeString(w, attr.Name.Space)
		w.WriteRune(colon)
	}

	// if prefix is empty, the default `xmlns` space should be used as prefix.
	if len(attr.Name.Local) == 0 {
		attr.Name.Local = attr.Name.Space
	}

	escapeString(w, attr.Name.Local)
	w.WriteRune(equals)
	w.WriteRune(quote)
	escapeString(w, attr.Value)
	w.WriteRune(quote)
}

// writeEndElement takes in a end element and writes it.
func writeEndElement(w writer, el EndElement) error {
	if el.isZero() {
		return fmt.Errorf("xml end element cannot be nil")
	}

	w.WriteRune(leftAngleBracket)
	w.WriteRune(forwardSlash)

	if len(el.Name.Space) != 0 {
		escapeString(w, el.Name.Space)
		w.WriteRune(colon)
	}
	escapeString(w, el.Name.Local)
	w.WriteRune(rightAngleBracket)

	return nil
}

// String encodes v as a XML string.
// It will auto close the parent xml element tag.
func (xv Value) String(v string) {
	escapeString(xv.w, v)
	xv.Close()
}

// Byte encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Byte(v int8) {
	xv.Long(int64(v))
}

// Short encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Short(v int16) {
	xv.Long(int64(v))
}

// Integer encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Integer(v int32) {
	xv.Long(int64(v))
}

// Long encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Long(v int64) {
	*xv.scratch = strconv.AppendInt((*xv.scratch)[:0], v, 10)
	xv.w.Write(*xv.scratch)

	xv.Close()
}

// Float encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Float(v float32) {
	xv.float(float64(v), 32)
	xv.Close()
}

// Double encodes v as a XML number.
// It will auto close the parent xml element tag.
func (xv Value) Double(v float64) {
	xv.float(v, 64)
	xv.Close()
}

func (xv Value) float(v float64, bits int) {
	*xv.scratch = encoding.EncodeFloat((*xv.scratch)[:0], v, bits)
	xv.w.Write(*xv.scratch)
}

// Boolean encodes v as a XML boolean.
// It will auto close the parent xml element tag.
func (xv Value) Boolean(v bool) {
	*xv.scratch = strconv.AppendBool((*xv.scratch)[:0], v)
	xv.w.Write(*xv.scratch)

	xv.Close()
}

// Base64EncodeBytes writes v as a base64 value in XML string.
// It will auto close the parent xml element tag.
func (xv Value) Base64EncodeBytes(v []byte) {
	encodeByteSlice(xv.w, (*xv.scratch)[:0], v)
	xv.Close()
}

// BigInteger encodes v big.Int as XML value.
// It will auto close the parent xml element tag.
func (xv Value) BigInteger(v *big.Int) {
	xv.w.Write([]byte(v.Text(10)))
	xv.Close()
}

// BigDecimal encodes v big.Float as XML value.
// It will auto close the parent xml element tag.
func (xv Value) BigDecimal(v *big.Float) {
	if i, accuracy := v.Int64(); accuracy == big.Exact {
		xv.Long(i)
		return
	}

	xv.w.Write([]byte(v.Text('e', -1)))
	xv.Close()
}

// Write writes v directly to the xml document
// if escapeXMLText is set to true, write will escape text.
// It will auto close the parent xml element tag.
func (xv Value) Write(v []byte, escapeXMLText bool) {
	// escape and write xml text
	if escapeXMLText {
		escapeText(xv.w, v)
	} else {
		// write xml directly
		xv.w.Write(v)
	}

	xv.Close()
}

// MemberElement does member element encoding. It returns a Value.
// Member Element method should be used for all shapes except flattened shapes.
//
// A call to MemberElement will write nested element tags directly using the
// provided start element. The value returned by MemberElement should be closed.
func (xv Value) MemberElement(element StartElement) Value {
	return newValue(xv.w, xv.scratch, element)
}

// FlattenedElement returns flattened element encoding. It returns a Value.
// This method should be used for flattened shapes.
//
// Unlike MemberElement, flattened element will NOT write element tags
// directly for the associated start element.
//
// The value returned by the FlattenedElement does not need to be closed.
func (xv Value) FlattenedElement(element StartElement) Value {
	v := newFlattenedValue(xv.w, xv.scratch, element)
	v.isFlattened = true
	return v
}

// Array returns an array encoder. By default, the members of array are
// wrapped with `<member>` element tag.
// If value is marked as flattened, the start element is used to wrap the members instead of
// the `<member>` element.
func (xv Value) Array() *Array {
	return newArray(xv.w, xv.scratch, arrayMemberWrapper, xv.startElement, xv.isFlattened)
}

/*
ArrayWithCustomName returns an array encoder.

It takes named start element as an argument, the named start element will used to wrap xml array entries.
for eg, `<someList><customName>entry1</customName></someList>`
Here `customName` named start element will be wrapped on each array member.
*/
func (xv Value) ArrayWithCustomName(element StartElement) *Array {
	return newArray(xv.w, xv.scratch, element, xv.startElement, xv.isFlattened)
}

/*
Map returns a map encoder. By default, the map entries are
wrapped with `<entry>` element tag.

If value is marked as flattened, the start element is used to wrap the entry instead of
the `<member>` element.
*/
func (xv Value) Map() *Map {
	// flattened map
	if xv.isFlattened {
		return newFlattenedMap(xv.w, xv.scratch, xv.startElement)
	}

	// un-flattened map
	return newMap(xv.w, xv.scratch)
}

// encodeByteSlice is modified copy of json encoder's encodeByteSlice.
// It is used to base64 encode a byte slice.
func encodeByteSlice(w writer, scratch []byte, v []byte) {
	if v == nil {
		return
	}

	encodedLen := base64.StdEncoding.EncodedLen(len(v))
	if encodedLen <= len(scratch) {
		// If the encoded bytes fit in e.scratch, avoid an extra
		// allocation and use the cheaper Encoding.Encode.
		dst := scratch[:encodedLen]
		base64.StdEncoding.Encode(dst, v)
		w.Write(dst)
	} else if encodedLen <= 1024 {
		// The encoded bytes are short enough to allocate for, and
		// Encoding.Encode is still cheaper.
		dst := make([]byte, encodedLen)
		base64.StdEncoding.Encode(dst, v)
		w.Write(dst)
	} else {
		// The encoded bytes are too long to cheaply allocate, and
		// Encoding.Encode is no longer noticeably cheaper.
		enc := base64.NewEncoder(base64.StdEncoding, w)
		enc.Write(v)
		enc.Close()
	}
}

// IsFlattened returns true if value is for flattened shape.
func (xv Value) IsFlattened() bool {
	return xv.isFlattened
}

// Close closes the value.
func (xv Value) Close() {
	writeEndElement(xv.w, xv.startElement.End())
}
