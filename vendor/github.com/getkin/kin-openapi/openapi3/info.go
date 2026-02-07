package openapi3

import (
	"context"
	"encoding/json"
	"errors"
)

// Info is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#info-object
type Info struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Title          string   `json:"title" yaml:"title"` // Required
	Description    string   `json:"description,omitempty" yaml:"description,omitempty"`
	TermsOfService string   `json:"termsOfService,omitempty" yaml:"termsOfService,omitempty"`
	Contact        *Contact `json:"contact,omitempty" yaml:"contact,omitempty"`
	License        *License `json:"license,omitempty" yaml:"license,omitempty"`
	Version        string   `json:"version" yaml:"version"` // Required
}

// MarshalJSON returns the JSON encoding of Info.
func (info Info) MarshalJSON() ([]byte, error) {
	x, err := info.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Info.
func (info *Info) MarshalYAML() (any, error) {
	if info == nil {
		return nil, nil
	}
	m := make(map[string]any, 6+len(info.Extensions))
	for k, v := range info.Extensions {
		m[k] = v
	}
	m["title"] = info.Title
	if x := info.Description; x != "" {
		m["description"] = x
	}
	if x := info.TermsOfService; x != "" {
		m["termsOfService"] = x
	}
	if x := info.Contact; x != nil {
		m["contact"] = x
	}
	if x := info.License; x != nil {
		m["license"] = x
	}
	m["version"] = info.Version
	return m, nil
}

// UnmarshalJSON sets Info to a copy of data.
func (info *Info) UnmarshalJSON(data []byte) error {
	type InfoBis Info
	var x InfoBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "title")
	delete(x.Extensions, "description")
	delete(x.Extensions, "termsOfService")
	delete(x.Extensions, "contact")
	delete(x.Extensions, "license")
	delete(x.Extensions, "version")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*info = Info(x)
	return nil
}

// Validate returns an error if Info does not comply with the OpenAPI spec.
func (info *Info) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if contact := info.Contact; contact != nil {
		if err := contact.Validate(ctx); err != nil {
			return err
		}
	}

	if license := info.License; license != nil {
		if err := license.Validate(ctx); err != nil {
			return err
		}
	}

	if info.Version == "" {
		return errors.New("value of version must be a non-empty string")
	}

	if info.Title == "" {
		return errors.New("value of title must be a non-empty string")
	}

	return validateExtensions(ctx, info.Extensions)
}
