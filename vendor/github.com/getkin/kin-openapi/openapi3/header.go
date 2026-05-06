package openapi3

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-openapi/jsonpointer"
)

// Header is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#header-object
type Header struct {
	Parameter
}

var _ jsonpointer.JSONPointable = (*Header)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (header Header) JSONLookup(token string) (any, error) {
	return header.Parameter.JSONLookup(token)
}

// MarshalJSON returns the JSON encoding of Header.
func (header Header) MarshalJSON() ([]byte, error) {
	return header.Parameter.MarshalJSON()
}

// UnmarshalJSON sets Header to a copy of data.
func (header *Header) UnmarshalJSON(data []byte) error {
	return header.Parameter.UnmarshalJSON(data)
}

// MarshalYAML returns the JSON encoding of Header.
func (header Header) MarshalYAML() (any, error) {
	return header.Parameter, nil
}

// SerializationMethod returns a header's serialization method.
func (header *Header) SerializationMethod() (*SerializationMethod, error) {
	style := header.Style
	if style == "" {
		style = SerializationSimple
	}
	explode := false
	if header.Explode != nil {
		explode = *header.Explode
	}
	return &SerializationMethod{Style: style, Explode: explode}, nil
}

// Validate returns an error if Header does not comply with the OpenAPI spec.
func (header *Header) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if header.Name != "" {
		return errors.New("header 'name' MUST NOT be specified, it is given in the corresponding headers map")
	}
	if header.In != "" {
		return errors.New("header 'in' MUST NOT be specified, it is implicitly in header")
	}

	// Validate a parameter's serialization method.
	sm, err := header.SerializationMethod()
	if err != nil {
		return err
	}
	if smSupported := false ||
		sm.Style == SerializationSimple && !sm.Explode ||
		sm.Style == SerializationSimple && sm.Explode; !smSupported {
		e := fmt.Errorf("serialization method with style=%q and explode=%v is not supported by a header parameter", sm.Style, sm.Explode)
		return fmt.Errorf("header schema is invalid: %w", e)
	}

	if (header.Schema == nil) == (len(header.Content) == 0) {
		e := fmt.Errorf("parameter must contain exactly one of content and schema: %v", header)
		return fmt.Errorf("header schema is invalid: %w", e)
	}
	if schema := header.Schema; schema != nil {
		if err := schema.Validate(ctx); err != nil {
			return fmt.Errorf("header schema is invalid: %w", err)
		}
	}

	if content := header.Content; content != nil {
		e := errors.New("parameter content must only contain one entry")
		if len(content) > 1 {
			return fmt.Errorf("header content is invalid: %w", e)
		}

		if err := content.Validate(ctx); err != nil {
			return fmt.Errorf("header content is invalid: %w", err)
		}
	}
	return nil
}

// UnmarshalJSON sets Headers to a copy of data.
func (headers *Headers) UnmarshalJSON(data []byte) (err error) {
	*headers, _, err = unmarshalStringMapP[HeaderRef](data)
	return
}
