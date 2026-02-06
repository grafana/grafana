package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
)

// Encoding is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#encoding-object
type Encoding struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	ContentType   string  `json:"contentType,omitempty" yaml:"contentType,omitempty"`
	Headers       Headers `json:"headers,omitempty" yaml:"headers,omitempty"`
	Style         string  `json:"style,omitempty" yaml:"style,omitempty"`
	Explode       *bool   `json:"explode,omitempty" yaml:"explode,omitempty"`
	AllowReserved bool    `json:"allowReserved,omitempty" yaml:"allowReserved,omitempty"`
}

func NewEncoding() *Encoding {
	return &Encoding{}
}

func (encoding *Encoding) WithHeader(name string, header *Header) *Encoding {
	return encoding.WithHeaderRef(name, &HeaderRef{
		Value: header,
	})
}

func (encoding *Encoding) WithHeaderRef(name string, ref *HeaderRef) *Encoding {
	headers := encoding.Headers
	if headers == nil {
		headers = make(map[string]*HeaderRef)
		encoding.Headers = headers
	}
	headers[name] = ref
	return encoding
}

// MarshalJSON returns the JSON encoding of Encoding.
func (encoding Encoding) MarshalJSON() ([]byte, error) {
	x, err := encoding.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Encoding.
func (encoding Encoding) MarshalYAML() (any, error) {
	m := make(map[string]any, 5+len(encoding.Extensions))
	for k, v := range encoding.Extensions {
		m[k] = v
	}
	if x := encoding.ContentType; x != "" {
		m["contentType"] = x
	}
	if x := encoding.Headers; len(x) != 0 {
		m["headers"] = x
	}
	if x := encoding.Style; x != "" {
		m["style"] = x
	}
	if x := encoding.Explode; x != nil {
		m["explode"] = x
	}
	if x := encoding.AllowReserved; x {
		m["allowReserved"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Encoding to a copy of data.
func (encoding *Encoding) UnmarshalJSON(data []byte) error {
	type EncodingBis Encoding
	var x EncodingBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "contentType")
	delete(x.Extensions, "headers")
	delete(x.Extensions, "style")
	delete(x.Extensions, "explode")
	delete(x.Extensions, "allowReserved")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*encoding = Encoding(x)
	return nil
}

// SerializationMethod returns a serialization method of request body.
// When serialization method is not defined the method returns the default serialization method.
func (encoding *Encoding) SerializationMethod() *SerializationMethod {
	sm := &SerializationMethod{Style: SerializationForm, Explode: true}
	if encoding != nil {
		if encoding.Style != "" {
			sm.Style = encoding.Style
		}
		if encoding.Explode != nil {
			sm.Explode = *encoding.Explode
		}
	}
	return sm
}

// Validate returns an error if Encoding does not comply with the OpenAPI spec.
func (encoding *Encoding) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if encoding == nil {
		return nil
	}

	headers := make([]string, 0, len(encoding.Headers))
	for k := range encoding.Headers {
		headers = append(headers, k)
	}
	sort.Strings(headers)
	for _, k := range headers {
		v := encoding.Headers[k]
		if err := ValidateIdentifier(k); err != nil {
			return nil
		}
		if err := v.Validate(ctx); err != nil {
			return nil
		}
	}

	// Validate a media types's serialization method.
	sm := encoding.SerializationMethod()
	switch {
	case sm.Style == SerializationForm && sm.Explode,
		sm.Style == SerializationForm && !sm.Explode,
		sm.Style == SerializationSpaceDelimited && sm.Explode,
		sm.Style == SerializationSpaceDelimited && !sm.Explode,
		sm.Style == SerializationPipeDelimited && sm.Explode,
		sm.Style == SerializationPipeDelimited && !sm.Explode,
		sm.Style == SerializationDeepObject && sm.Explode:
	default:
		return fmt.Errorf("serialization method with style=%q and explode=%v is not supported by media type", sm.Style, sm.Explode)
	}

	return validateExtensions(ctx, encoding.Extensions)
}
