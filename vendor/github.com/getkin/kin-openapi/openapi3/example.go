package openapi3

import (
	"context"
	"encoding/json"
	"errors"
)

// Example is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#example-object
type Example struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Summary       string `json:"summary,omitempty" yaml:"summary,omitempty"`
	Description   string `json:"description,omitempty" yaml:"description,omitempty"`
	Value         any    `json:"value,omitempty" yaml:"value,omitempty"`
	ExternalValue string `json:"externalValue,omitempty" yaml:"externalValue,omitempty"`
}

func NewExample(value any) *Example {
	return &Example{Value: value}
}

// MarshalJSON returns the JSON encoding of Example.
func (example Example) MarshalJSON() ([]byte, error) {
	x, err := example.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Example.
func (example Example) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(example.Extensions))
	for k, v := range example.Extensions {
		m[k] = v
	}
	if x := example.Summary; x != "" {
		m["summary"] = x
	}
	if x := example.Description; x != "" {
		m["description"] = x
	}
	if x := example.Value; x != nil {
		m["value"] = x
	}
	if x := example.ExternalValue; x != "" {
		m["externalValue"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Example to a copy of data.
func (example *Example) UnmarshalJSON(data []byte) error {
	type ExampleBis Example
	var x ExampleBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "summary")
	delete(x.Extensions, "description")
	delete(x.Extensions, "value")
	delete(x.Extensions, "externalValue")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*example = Example(x)
	return nil
}

// Validate returns an error if Example does not comply with the OpenAPI spec.
func (example *Example) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if example.Value != nil && example.ExternalValue != "" {
		return errors.New("value and externalValue are mutually exclusive")
	}
	if example.Value == nil && example.ExternalValue == "" {
		return errors.New("no value or externalValue field")
	}

	return validateExtensions(ctx, example.Extensions)
}

// UnmarshalJSON sets Examples to a copy of data.
func (examples *Examples) UnmarshalJSON(data []byte) (err error) {
	*examples, _, err = unmarshalStringMapP[ExampleRef](data)
	return
}
