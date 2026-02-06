// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copied and modified from Go 1.14 stdlib's encoding/xml

package xml

// A Name represents an XML name (Local) annotated
// with a name space identifier (Space).
// In tokens returned by Decoder.Token, the Space identifier
// is given as a canonical URL, not the short prefix used
// in the document being parsed.
type Name struct {
	Space, Local string
}

// An Attr represents an attribute in an XML element (Name=Value).
type Attr struct {
	Name  Name
	Value string
}

/*
NewAttribute returns a pointer to an attribute.
It takes in a local name aka attribute name, and value
representing the attribute value.
*/
func NewAttribute(local, value string) Attr {
	return Attr{
		Name: Name{
			Local: local,
		},
		Value: value,
	}
}

/*
NewNamespaceAttribute returns a pointer to an attribute.
It takes in a local name aka attribute name, and value
representing the attribute value.

NewNamespaceAttribute appends `xmlns:` in front of namespace
prefix.

For creating a name space attribute representing
`xmlns:prefix="http://example.com`, the breakdown would be:
local = "prefix"
value = "http://example.com"
*/
func NewNamespaceAttribute(local, value string) Attr {
	attr := NewAttribute(local, value)

	// default name space identifier
	attr.Name.Space = "xmlns"
	return attr
}

// A StartElement represents an XML start element.
type StartElement struct {
	Name Name
	Attr []Attr
}

// Copy creates a new copy of StartElement.
func (e StartElement) Copy() StartElement {
	attrs := make([]Attr, len(e.Attr))
	copy(attrs, e.Attr)
	e.Attr = attrs
	return e
}

// End returns the corresponding XML end element.
func (e StartElement) End() EndElement {
	return EndElement{e.Name}
}

// returns true if start element local name is empty
func (e StartElement) isZero() bool {
	return len(e.Name.Local) == 0
}

// An EndElement represents an XML end element.
type EndElement struct {
	Name Name
}

// returns true if end element local name is empty
func (e EndElement) isZero() bool {
	return len(e.Name.Local) == 0
}
