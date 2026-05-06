package openapi3

import (
	"context"
	"encoding/json"
)

// XML is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#xml-object
type XML struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Name      string `json:"name,omitempty" yaml:"name,omitempty"`
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Prefix    string `json:"prefix,omitempty" yaml:"prefix,omitempty"`
	Attribute bool   `json:"attribute,omitempty" yaml:"attribute,omitempty"`
	Wrapped   bool   `json:"wrapped,omitempty" yaml:"wrapped,omitempty"`
}

// MarshalJSON returns the JSON encoding of XML.
func (xml XML) MarshalJSON() ([]byte, error) {
	x, err := xml.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of XML.
func (xml XML) MarshalYAML() (any, error) {
	m := make(map[string]any, 5+len(xml.Extensions))
	for k, v := range xml.Extensions {
		m[k] = v
	}
	if x := xml.Name; x != "" {
		m["name"] = x
	}
	if x := xml.Namespace; x != "" {
		m["namespace"] = x
	}
	if x := xml.Prefix; x != "" {
		m["prefix"] = x
	}
	if x := xml.Attribute; x {
		m["attribute"] = x
	}
	if x := xml.Wrapped; x {
		m["wrapped"] = x
	}
	return m, nil
}

// UnmarshalJSON sets XML to a copy of data.
func (xml *XML) UnmarshalJSON(data []byte) error {
	type XMLBis XML
	var x XMLBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "name")
	delete(x.Extensions, "namespace")
	delete(x.Extensions, "prefix")
	delete(x.Extensions, "attribute")
	delete(x.Extensions, "wrapped")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*xml = XML(x)
	return nil
}

// Validate returns an error if XML does not comply with the OpenAPI spec.
func (xml *XML) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	return validateExtensions(ctx, xml.Extensions)
}
