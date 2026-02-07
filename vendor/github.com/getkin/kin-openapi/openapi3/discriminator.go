package openapi3

import (
	"context"
	"encoding/json"
)

// Discriminator is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#discriminator-object
type Discriminator struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	PropertyName string    `json:"propertyName" yaml:"propertyName"` // required
	Mapping      StringMap `json:"mapping,omitempty" yaml:"mapping,omitempty"`
}

// MarshalJSON returns the JSON encoding of Discriminator.
func (discriminator Discriminator) MarshalJSON() ([]byte, error) {
	x, err := discriminator.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Discriminator.
func (discriminator Discriminator) MarshalYAML() (any, error) {
	m := make(map[string]any, 2+len(discriminator.Extensions))
	for k, v := range discriminator.Extensions {
		m[k] = v
	}
	m["propertyName"] = discriminator.PropertyName
	if x := discriminator.Mapping; len(x) != 0 {
		m["mapping"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Discriminator to a copy of data.
func (discriminator *Discriminator) UnmarshalJSON(data []byte) error {
	type DiscriminatorBis Discriminator
	var x DiscriminatorBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "propertyName")
	delete(x.Extensions, "mapping")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*discriminator = Discriminator(x)
	return nil
}

// Validate returns an error if Discriminator does not comply with the OpenAPI spec.
func (discriminator *Discriminator) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	return validateExtensions(ctx, discriminator.Extensions)
}
