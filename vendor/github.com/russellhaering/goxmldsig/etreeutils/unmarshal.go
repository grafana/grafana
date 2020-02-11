package etreeutils

import (
	"encoding/xml"

	"github.com/beevik/etree"
)

// NSUnmarshalElement unmarshals the passed etree Element into the value pointed to by
// v using encoding/xml in the context of the passed NSContext. If v implements
// ElementKeeper, SetUnderlyingElement will be called on v with a reference to el.
func NSUnmarshalElement(ctx NSContext, el *etree.Element, v interface{}) error {
	detatched, err := NSDetatch(ctx, el)
	if err != nil {
		return err
	}

	doc := etree.NewDocument()
	doc.AddChild(detatched)
	data, err := doc.WriteToBytes()
	if err != nil {
		return err
	}

	err = xml.Unmarshal(data, v)
	if err != nil {
		return err
	}

	switch v := v.(type) {
	case ElementKeeper:
		v.SetUnderlyingElement(el)
	}

	return nil
}

// ElementKeeper should be implemented by types which will be passed to
// UnmarshalElement, but wish to keep a reference
type ElementKeeper interface {
	SetUnderlyingElement(*etree.Element)
	UnderlyingElement() *etree.Element
}
