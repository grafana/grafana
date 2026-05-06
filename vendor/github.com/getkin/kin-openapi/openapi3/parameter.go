package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"

	"github.com/go-openapi/jsonpointer"
)

// Parameters is specified by OpenAPI/Swagger 3.0 standard.
type Parameters []*ParameterRef

var _ jsonpointer.JSONPointable = (*Parameters)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (p Parameters) JSONLookup(token string) (any, error) {
	index, err := strconv.Atoi(token)
	if err != nil {
		return nil, err
	}
	if index < 0 || index >= len(p) {
		return nil, fmt.Errorf("index %d out of bounds of array of length %d", index, len(p))
	}

	ref := p[index]
	if ref != nil && ref.Ref != "" {
		return &Ref{Ref: ref.Ref}, nil
	}
	return ref.Value, nil
}

func NewParameters() Parameters {
	return make(Parameters, 0, 4)
}

func (parameters Parameters) GetByInAndName(in string, name string) *Parameter {
	for _, item := range parameters {
		if v := item.Value; v != nil {
			if v.Name == name && v.In == in {
				return v
			}
		}
	}
	return nil
}

// Validate returns an error if Parameters does not comply with the OpenAPI spec.
func (parameters Parameters) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	dupes := make(map[string]struct{})
	for _, parameterRef := range parameters {
		if v := parameterRef.Value; v != nil {
			key := v.In + ":" + v.Name
			if _, ok := dupes[key]; ok {
				return fmt.Errorf("more than one %q parameter has name %q", v.In, v.Name)
			}
			dupes[key] = struct{}{}
		}

		if err := parameterRef.Validate(ctx); err != nil {
			return err
		}
	}
	return nil
}

// Parameter is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#parameter-object
type Parameter struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Name            string     `json:"name,omitempty" yaml:"name,omitempty"`
	In              string     `json:"in,omitempty" yaml:"in,omitempty"`
	Description     string     `json:"description,omitempty" yaml:"description,omitempty"`
	Style           string     `json:"style,omitempty" yaml:"style,omitempty"`
	Explode         *bool      `json:"explode,omitempty" yaml:"explode,omitempty"`
	AllowEmptyValue bool       `json:"allowEmptyValue,omitempty" yaml:"allowEmptyValue,omitempty"`
	AllowReserved   bool       `json:"allowReserved,omitempty" yaml:"allowReserved,omitempty"`
	Deprecated      bool       `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	Required        bool       `json:"required,omitempty" yaml:"required,omitempty"`
	Schema          *SchemaRef `json:"schema,omitempty" yaml:"schema,omitempty"`
	Example         any        `json:"example,omitempty" yaml:"example,omitempty"`
	Examples        Examples   `json:"examples,omitempty" yaml:"examples,omitempty"`
	Content         Content    `json:"content,omitempty" yaml:"content,omitempty"`
}

var _ jsonpointer.JSONPointable = (*Parameter)(nil)

const (
	ParameterInPath   = "path"
	ParameterInQuery  = "query"
	ParameterInHeader = "header"
	ParameterInCookie = "cookie"
)

func NewPathParameter(name string) *Parameter {
	return &Parameter{
		Name:     name,
		In:       ParameterInPath,
		Required: true,
	}
}

func NewQueryParameter(name string) *Parameter {
	return &Parameter{
		Name: name,
		In:   ParameterInQuery,
	}
}

func NewHeaderParameter(name string) *Parameter {
	return &Parameter{
		Name: name,
		In:   ParameterInHeader,
	}
}

func NewCookieParameter(name string) *Parameter {
	return &Parameter{
		Name: name,
		In:   ParameterInCookie,
	}
}

func (parameter *Parameter) WithDescription(value string) *Parameter {
	parameter.Description = value
	return parameter
}

func (parameter *Parameter) WithRequired(value bool) *Parameter {
	parameter.Required = value
	return parameter
}

func (parameter *Parameter) WithSchema(value *Schema) *Parameter {
	if value == nil {
		parameter.Schema = nil
	} else {
		parameter.Schema = &SchemaRef{
			Value: value,
		}
	}
	return parameter
}

// MarshalJSON returns the JSON encoding of Parameter.
func (parameter Parameter) MarshalJSON() ([]byte, error) {
	x, err := parameter.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Parameter.
func (parameter Parameter) MarshalYAML() (any, error) {
	m := make(map[string]any, 13+len(parameter.Extensions))
	for k, v := range parameter.Extensions {
		m[k] = v
	}

	if x := parameter.Name; x != "" {
		m["name"] = x
	}
	if x := parameter.In; x != "" {
		m["in"] = x
	}
	if x := parameter.Description; x != "" {
		m["description"] = x
	}
	if x := parameter.Style; x != "" {
		m["style"] = x
	}
	if x := parameter.Explode; x != nil {
		m["explode"] = x
	}
	if x := parameter.AllowEmptyValue; x {
		m["allowEmptyValue"] = x
	}
	if x := parameter.AllowReserved; x {
		m["allowReserved"] = x
	}
	if x := parameter.Deprecated; x {
		m["deprecated"] = x
	}
	if x := parameter.Required; x {
		m["required"] = x
	}
	if x := parameter.Schema; x != nil {
		m["schema"] = x
	}
	if x := parameter.Example; x != nil {
		m["example"] = x
	}
	if x := parameter.Examples; len(x) != 0 {
		m["examples"] = x
	}
	if x := parameter.Content; len(x) != 0 {
		m["content"] = x
	}

	return m, nil
}

// UnmarshalJSON sets Parameter to a copy of data.
func (parameter *Parameter) UnmarshalJSON(data []byte) error {
	type ParameterBis Parameter
	var x ParameterBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "name")
	delete(x.Extensions, "in")
	delete(x.Extensions, "description")
	delete(x.Extensions, "style")
	delete(x.Extensions, "explode")
	delete(x.Extensions, "allowEmptyValue")
	delete(x.Extensions, "allowReserved")
	delete(x.Extensions, "deprecated")
	delete(x.Extensions, "required")
	delete(x.Extensions, "schema")
	delete(x.Extensions, "example")
	delete(x.Extensions, "examples")
	delete(x.Extensions, "content")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}

	*parameter = Parameter(x)
	return nil
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (parameter Parameter) JSONLookup(token string) (any, error) {
	switch token {
	case "schema":
		if parameter.Schema != nil {
			if parameter.Schema.Ref != "" {
				return &Ref{Ref: parameter.Schema.Ref}, nil
			}
			return parameter.Schema.Value, nil
		}
	case "name":
		return parameter.Name, nil
	case "in":
		return parameter.In, nil
	case "description":
		return parameter.Description, nil
	case "style":
		return parameter.Style, nil
	case "explode":
		return parameter.Explode, nil
	case "allowEmptyValue":
		return parameter.AllowEmptyValue, nil
	case "allowReserved":
		return parameter.AllowReserved, nil
	case "deprecated":
		return parameter.Deprecated, nil
	case "required":
		return parameter.Required, nil
	case "example":
		return parameter.Example, nil
	case "examples":
		return parameter.Examples, nil
	case "content":
		return parameter.Content, nil
	}

	v, _, err := jsonpointer.GetForToken(parameter.Extensions, token)
	return v, err
}

// SerializationMethod returns a parameter's serialization method.
// When a parameter's serialization method is not defined the method returns
// the default serialization method corresponding to a parameter's location.
func (parameter *Parameter) SerializationMethod() (*SerializationMethod, error) {
	switch parameter.In {
	case ParameterInPath, ParameterInHeader:
		style := parameter.Style
		if style == "" {
			style = SerializationSimple
		}
		explode := false
		if parameter.Explode != nil {
			explode = *parameter.Explode
		}
		return &SerializationMethod{Style: style, Explode: explode}, nil
	case ParameterInQuery, ParameterInCookie:
		style := parameter.Style
		if style == "" {
			style = SerializationForm
		}
		explode := true
		if parameter.Explode != nil {
			explode = *parameter.Explode
		}
		return &SerializationMethod{Style: style, Explode: explode}, nil
	default:
		return nil, fmt.Errorf("unexpected parameter's 'in': %q", parameter.In)
	}
}

// Validate returns an error if Parameter does not comply with the OpenAPI spec.
func (parameter *Parameter) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if parameter.Name == "" {
		return errors.New("parameter name can't be blank")
	}
	in := parameter.In
	switch in {
	case
		ParameterInPath,
		ParameterInQuery,
		ParameterInHeader,
		ParameterInCookie:
	default:
		return fmt.Errorf("parameter can't have 'in' value %q", parameter.In)
	}

	if in == ParameterInPath && !parameter.Required {
		return fmt.Errorf("path parameter %q must be required", parameter.Name)
	}

	// Validate a parameter's serialization method.
	sm, err := parameter.SerializationMethod()
	if err != nil {
		return err
	}
	var smSupported bool
	switch {
	case parameter.In == ParameterInPath && sm.Style == SerializationSimple && !sm.Explode,
		parameter.In == ParameterInPath && sm.Style == SerializationSimple && sm.Explode,
		parameter.In == ParameterInPath && sm.Style == SerializationLabel && !sm.Explode,
		parameter.In == ParameterInPath && sm.Style == SerializationLabel && sm.Explode,
		parameter.In == ParameterInPath && sm.Style == SerializationMatrix && !sm.Explode,
		parameter.In == ParameterInPath && sm.Style == SerializationMatrix && sm.Explode,

		parameter.In == ParameterInQuery && sm.Style == SerializationForm && sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationForm && !sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationSpaceDelimited && sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationSpaceDelimited && !sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationPipeDelimited && sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationPipeDelimited && !sm.Explode,
		parameter.In == ParameterInQuery && sm.Style == SerializationDeepObject && sm.Explode,

		parameter.In == ParameterInHeader && sm.Style == SerializationSimple && !sm.Explode,
		parameter.In == ParameterInHeader && sm.Style == SerializationSimple && sm.Explode,

		parameter.In == ParameterInCookie && sm.Style == SerializationForm && !sm.Explode,
		parameter.In == ParameterInCookie && sm.Style == SerializationForm && sm.Explode:
		smSupported = true
	}
	if !smSupported {
		e := fmt.Errorf("serialization method with style=%q and explode=%v is not supported by a %s parameter", sm.Style, sm.Explode, in)
		return fmt.Errorf("parameter %q schema is invalid: %w", parameter.Name, e)
	}

	if (parameter.Schema == nil) == (len(parameter.Content) == 0) {
		e := errors.New("parameter must contain exactly one of content and schema")
		return fmt.Errorf("parameter %q schema is invalid: %w", parameter.Name, e)
	}

	if content := parameter.Content; content != nil {
		e := errors.New("parameter content must only contain one entry")
		if len(content) > 1 {
			return fmt.Errorf("parameter %q content is invalid: %w", parameter.Name, e)
		}

		if err := content.Validate(ctx); err != nil {
			return fmt.Errorf("parameter %q content is invalid: %w", parameter.Name, err)
		}
	}

	if schema := parameter.Schema; schema != nil {
		if err := schema.Validate(ctx); err != nil {
			return fmt.Errorf("parameter %q schema is invalid: %w", parameter.Name, err)
		}
		if parameter.Example != nil && parameter.Examples != nil {
			return fmt.Errorf("parameter %q example and examples are mutually exclusive", parameter.Name)
		}

		if vo := getValidationOptions(ctx); vo.examplesValidationDisabled {
			return nil
		}
		if example := parameter.Example; example != nil {
			if err := validateExampleValue(ctx, example, schema.Value); err != nil {
				return fmt.Errorf("invalid example: %w", err)
			}
		} else if examples := parameter.Examples; examples != nil {
			names := make([]string, 0, len(examples))
			for name := range examples {
				names = append(names, name)
			}
			sort.Strings(names)
			for _, k := range names {
				v := examples[k]
				if err := v.Validate(ctx); err != nil {
					return fmt.Errorf("%s: %w", k, err)
				}
				if err := validateExampleValue(ctx, v.Value.Value, schema.Value); err != nil {
					return fmt.Errorf("%s: %w", k, err)
				}
			}
		}
	}

	return validateExtensions(ctx, parameter.Extensions)
}

// UnmarshalJSON sets ParametersMap to a copy of data.
func (parametersMap *ParametersMap) UnmarshalJSON(data []byte) (err error) {
	*parametersMap, _, err = unmarshalStringMapP[ParameterRef](data)
	return
}
