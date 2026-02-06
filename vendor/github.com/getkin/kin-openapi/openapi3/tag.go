package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
)

// Tags is specified by OpenAPI/Swagger 3.0 standard.
type Tags []*Tag

func (tags Tags) Get(name string) *Tag {
	for _, tag := range tags {
		if tag.Name == name {
			return tag
		}
	}
	return nil
}

// Validate returns an error if Tags does not comply with the OpenAPI spec.
func (tags Tags) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	for _, v := range tags {
		if err := v.Validate(ctx); err != nil {
			return err
		}
	}
	return nil
}

// Tag is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#tag-object
type Tag struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Name         string        `json:"name,omitempty" yaml:"name,omitempty"`
	Description  string        `json:"description,omitempty" yaml:"description,omitempty"`
	ExternalDocs *ExternalDocs `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`
}

// MarshalJSON returns the JSON encoding of Tag.
func (t Tag) MarshalJSON() ([]byte, error) {
	x, err := t.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Tag.
func (t Tag) MarshalYAML() (any, error) {
	m := make(map[string]any, 3+len(t.Extensions))
	for k, v := range t.Extensions {
		m[k] = v
	}
	if x := t.Name; x != "" {
		m["name"] = x
	}
	if x := t.Description; x != "" {
		m["description"] = x
	}
	if x := t.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Tag to a copy of data.
func (t *Tag) UnmarshalJSON(data []byte) error {
	type TagBis Tag
	var x TagBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "name")
	delete(x.Extensions, "description")
	delete(x.Extensions, "externalDocs")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*t = Tag(x)
	return nil
}

// Validate returns an error if Tag does not comply with the OpenAPI spec.
func (t *Tag) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := t.ExternalDocs; v != nil {
		if err := v.Validate(ctx); err != nil {
			return fmt.Errorf("invalid external docs: %w", err)
		}
	}

	return validateExtensions(ctx, t.Extensions)
}
