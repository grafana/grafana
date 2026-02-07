package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/go-openapi/jsonpointer"
)

type (
	Callbacks       map[string]*CallbackRef
	Examples        map[string]*ExampleRef
	Headers         map[string]*HeaderRef
	Links           map[string]*LinkRef
	ParametersMap   map[string]*ParameterRef
	RequestBodies   map[string]*RequestBodyRef
	ResponseBodies  map[string]*ResponseRef
	Schemas         map[string]*SchemaRef
	SecuritySchemes map[string]*SecuritySchemeRef
)

// Components is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
type Components struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Schemas         Schemas         `json:"schemas,omitempty" yaml:"schemas,omitempty"`
	Parameters      ParametersMap   `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Headers         Headers         `json:"headers,omitempty" yaml:"headers,omitempty"`
	RequestBodies   RequestBodies   `json:"requestBodies,omitempty" yaml:"requestBodies,omitempty"`
	Responses       ResponseBodies  `json:"responses,omitempty" yaml:"responses,omitempty"`
	SecuritySchemes SecuritySchemes `json:"securitySchemes,omitempty" yaml:"securitySchemes,omitempty"`
	Examples        Examples        `json:"examples,omitempty" yaml:"examples,omitempty"`
	Links           Links           `json:"links,omitempty" yaml:"links,omitempty"`
	Callbacks       Callbacks       `json:"callbacks,omitempty" yaml:"callbacks,omitempty"`
}

func NewComponents() Components {
	return Components{}
}

// MarshalJSON returns the JSON encoding of Components.
func (components Components) MarshalJSON() ([]byte, error) {
	x, err := components.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Components.
func (components Components) MarshalYAML() (any, error) {
	m := make(map[string]any, 9+len(components.Extensions))
	for k, v := range components.Extensions {
		m[k] = v
	}
	if x := components.Schemas; len(x) != 0 {
		m["schemas"] = x
	}
	if x := components.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	if x := components.Headers; len(x) != 0 {
		m["headers"] = x
	}
	if x := components.RequestBodies; len(x) != 0 {
		m["requestBodies"] = x
	}
	if x := components.Responses; len(x) != 0 {
		m["responses"] = x
	}
	if x := components.SecuritySchemes; len(x) != 0 {
		m["securitySchemes"] = x
	}
	if x := components.Examples; len(x) != 0 {
		m["examples"] = x
	}
	if x := components.Links; len(x) != 0 {
		m["links"] = x
	}
	if x := components.Callbacks; len(x) != 0 {
		m["callbacks"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Components to a copy of data.
func (components *Components) UnmarshalJSON(data []byte) error {
	type ComponentsBis Components
	var x ComponentsBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "schemas")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "headers")
	delete(x.Extensions, "requestBodies")
	delete(x.Extensions, "responses")
	delete(x.Extensions, "securitySchemes")
	delete(x.Extensions, "examples")
	delete(x.Extensions, "links")
	delete(x.Extensions, "callbacks")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*components = Components(x)
	return nil
}

// Validate returns an error if Components does not comply with the OpenAPI spec.
func (components *Components) Validate(ctx context.Context, opts ...ValidationOption) (err error) {
	ctx = WithValidationOptions(ctx, opts...)

	schemas := make([]string, 0, len(components.Schemas))
	for name := range components.Schemas {
		schemas = append(schemas, name)
	}
	sort.Strings(schemas)
	for _, k := range schemas {
		v := components.Schemas[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("schema %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("schema %q: %w", k, err)
		}
	}

	parameters := make([]string, 0, len(components.Parameters))
	for name := range components.Parameters {
		parameters = append(parameters, name)
	}
	sort.Strings(parameters)
	for _, k := range parameters {
		v := components.Parameters[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("parameter %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("parameter %q: %w", k, err)
		}
	}

	requestBodies := make([]string, 0, len(components.RequestBodies))
	for name := range components.RequestBodies {
		requestBodies = append(requestBodies, name)
	}
	sort.Strings(requestBodies)
	for _, k := range requestBodies {
		v := components.RequestBodies[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("request body %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("request body %q: %w", k, err)
		}
	}

	responses := make([]string, 0, len(components.Responses))
	for name := range components.Responses {
		responses = append(responses, name)
	}
	sort.Strings(responses)
	for _, k := range responses {
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("response %q: %w", k, err)
		}
		v := components.Responses[k]
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("response %q: %w", k, err)
		}
	}

	headers := make([]string, 0, len(components.Headers))
	for name := range components.Headers {
		headers = append(headers, name)
	}
	sort.Strings(headers)
	for _, k := range headers {
		v := components.Headers[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("header %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("header %q: %w", k, err)
		}
	}

	securitySchemes := make([]string, 0, len(components.SecuritySchemes))
	for name := range components.SecuritySchemes {
		securitySchemes = append(securitySchemes, name)
	}
	sort.Strings(securitySchemes)
	for _, k := range securitySchemes {
		v := components.SecuritySchemes[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("security scheme %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("security scheme %q: %w", k, err)
		}
	}

	examples := make([]string, 0, len(components.Examples))
	for name := range components.Examples {
		examples = append(examples, name)
	}
	sort.Strings(examples)
	for _, k := range examples {
		v := components.Examples[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("example %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("example %q: %w", k, err)
		}
	}

	links := make([]string, 0, len(components.Links))
	for name := range components.Links {
		links = append(links, name)
	}
	sort.Strings(links)
	for _, k := range links {
		v := components.Links[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("link %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("link %q: %w", k, err)
		}
	}

	callbacks := make([]string, 0, len(components.Callbacks))
	for name := range components.Callbacks {
		callbacks = append(callbacks, name)
	}
	sort.Strings(callbacks)
	for _, k := range callbacks {
		v := components.Callbacks[k]
		if err = ValidateIdentifier(k); err != nil {
			return fmt.Errorf("callback %q: %w", k, err)
		}
		if err = v.Validate(ctx); err != nil {
			return fmt.Errorf("callback %q: %w", k, err)
		}
	}

	return validateExtensions(ctx, components.Extensions)
}

var _ jsonpointer.JSONPointable = (*Schemas)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Schemas) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no schema %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*ParametersMap)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m ParametersMap) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no parameter %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Headers)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Headers) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no header %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*RequestBodyRef)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m RequestBodies) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no request body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*ResponseRef)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m ResponseBodies) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no response body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*SecuritySchemes)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m SecuritySchemes) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no security scheme body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Examples)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Examples) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no example body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Links)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Links) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no link body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}

var _ jsonpointer.JSONPointable = (*Callbacks)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (m Callbacks) JSONLookup(token string) (any, error) {
	if v, ok := m[token]; !ok || v == nil {
		return nil, fmt.Errorf("no callback body %q", token)
	} else if ref := v.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	} else {
		return v.Value, nil
	}
}
