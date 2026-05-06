package xml

import (
	"encoding/xml"
	"fmt"
	"strings"
)

// NodeDecoder is a XML decoder wrapper that is responsible to decoding
// a single XML Node element and it's nested member elements. This wrapper decoder
// takes in the start element of the top level node being decoded.
type NodeDecoder struct {
	Decoder *xml.Decoder
	StartEl xml.StartElement
}

// WrapNodeDecoder returns an initialized XMLNodeDecoder
func WrapNodeDecoder(decoder *xml.Decoder, startEl xml.StartElement) NodeDecoder {
	return NodeDecoder{
		Decoder: decoder,
		StartEl: startEl,
	}
}

// Token on a Node Decoder returns a xml StartElement. It returns a boolean that indicates the
// a token is the node decoder's end node token; and an error which indicates any error
// that occurred while retrieving the start element
func (d NodeDecoder) Token() (t xml.StartElement, done bool, err error) {
	for {
		token, e := d.Decoder.Token()
		if e != nil {
			return t, done, e
		}

		// check if we reach end of the node being decoded
		if el, ok := token.(xml.EndElement); ok {
			return t, el == d.StartEl.End(), err
		}

		if t, ok := token.(xml.StartElement); ok {
			return restoreAttrNamespaces(t), false, err
		}

		// skip token if it is a comment or preamble or empty space value due to indentation
		// or if it's a value and is not expected
	}
}

// restoreAttrNamespaces update XML attributes to restore the short namespaces found within
// the raw XML document.
func restoreAttrNamespaces(node xml.StartElement) xml.StartElement {
	if len(node.Attr) == 0 {
		return node
	}

	// Generate a mapping of XML namespace values to their short names.
	ns := map[string]string{}
	for _, a := range node.Attr {
		if a.Name.Space == "xmlns" {
			ns[a.Value] = a.Name.Local
			break
		}
	}

	for i, a := range node.Attr {
		if a.Name.Space == "xmlns" {
			continue
		}
		// By default, xml.Decoder will fully resolve these namespaces. So if you had <foo xmlns:bar=baz bar:bin=hi/>
		// then by default the second attribute would have the `Name.Space` resolved to `baz`. But we need it to
		// continue to resolve as `bar` so we can easily identify it later on.
		if v, ok := ns[node.Attr[i].Name.Space]; ok {
			node.Attr[i].Name.Space = v
		}
	}
	return node
}

// GetElement looks for the given tag name at the current level, and returns the element if found, and
// skipping over non-matching elements. Returns an error if the node is not found, or if an error occurs while walking
// the document.
func (d NodeDecoder) GetElement(name string) (t xml.StartElement, err error) {
	for {
		token, done, err := d.Token()
		if err != nil {
			return t, err
		}
		if done {
			return t, fmt.Errorf("%s node not found", name)
		}
		switch {
		case strings.EqualFold(name, token.Name.Local):
			return token, nil
		default:
			err = d.Decoder.Skip()
			if err != nil {
				return t, err
			}
		}
	}
}

// Value provides an abstraction to retrieve char data value within an xml element.
// The method will return an error if it encounters a nested xml element instead of char data.
// This method should only be used to retrieve simple type or blob shape values as []byte.
func (d NodeDecoder) Value() (c []byte, err error) {
	t, e := d.Decoder.Token()
	if e != nil {
		return c, e
	}

	endElement := d.StartEl.End()

	switch ev := t.(type) {
	case xml.CharData:
		c = ev.Copy()
	case xml.EndElement: // end tag or self-closing
		if ev == endElement {
			return []byte{}, err
		}
		return c, fmt.Errorf("expected value for %v element, got %T type %v instead", d.StartEl.Name.Local, t, t)
	default:
		return c, fmt.Errorf("expected value for %v element, got %T type %v instead", d.StartEl.Name.Local, t, t)
	}

	t, e = d.Decoder.Token()
	if e != nil {
		return c, e
	}

	if ev, ok := t.(xml.EndElement); ok {
		if ev == endElement {
			return c, err
		}
	}

	return c, fmt.Errorf("expected end element %v, got %T type %v instead", endElement, t, t)
}

// FetchRootElement takes in a decoder and returns the first start element within the xml body.
// This function is useful in fetching the start element of an XML response and ignore the
// comments and preamble
func FetchRootElement(decoder *xml.Decoder) (startElement xml.StartElement, err error) {
	for {
		t, e := decoder.Token()
		if e != nil {
			return startElement, e
		}

		if startElement, ok := t.(xml.StartElement); ok {
			return startElement, err
		}
	}
}
