package openapi2

import (
	"encoding/json"
	"sort"

	"github.com/getkin/kin-openapi/openapi3"
)

type Parameters []*Parameter

var _ sort.Interface = Parameters{}

func (ps Parameters) Len() int      { return len(ps) }
func (ps Parameters) Swap(i, j int) { ps[i], ps[j] = ps[j], ps[i] }
func (ps Parameters) Less(i, j int) bool {
	if ps[i].Name != ps[j].Name {
		return ps[i].Name < ps[j].Name
	}
	if ps[i].In != ps[j].In {
		return ps[i].In < ps[j].In
	}
	return ps[i].Ref < ps[j].Ref
}

type Parameter struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Ref string `json:"$ref,omitempty" yaml:"$ref,omitempty"`

	In               string          `json:"in,omitempty" yaml:"in,omitempty"`
	Name             string          `json:"name,omitempty" yaml:"name,omitempty"`
	Description      string          `json:"description,omitempty" yaml:"description,omitempty"`
	CollectionFormat string          `json:"collectionFormat,omitempty" yaml:"collectionFormat,omitempty"`
	Type             *openapi3.Types `json:"type,omitempty" yaml:"type,omitempty"`
	Format           string          `json:"format,omitempty" yaml:"format,omitempty"`
	Pattern          string          `json:"pattern,omitempty" yaml:"pattern,omitempty"`
	AllowEmptyValue  bool            `json:"allowEmptyValue,omitempty" yaml:"allowEmptyValue,omitempty"`
	Required         bool            `json:"required,omitempty" yaml:"required,omitempty"`
	UniqueItems      bool            `json:"uniqueItems,omitempty" yaml:"uniqueItems,omitempty"`
	ExclusiveMin     bool            `json:"exclusiveMinimum,omitempty" yaml:"exclusiveMinimum,omitempty"`
	ExclusiveMax     bool            `json:"exclusiveMaximum,omitempty" yaml:"exclusiveMaximum,omitempty"`
	Schema           *SchemaRef      `json:"schema,omitempty" yaml:"schema,omitempty"`
	Items            *SchemaRef      `json:"items,omitempty" yaml:"items,omitempty"`
	Enum             []any           `json:"enum,omitempty" yaml:"enum,omitempty"`
	MultipleOf       *float64        `json:"multipleOf,omitempty" yaml:"multipleOf,omitempty"`
	Minimum          *float64        `json:"minimum,omitempty" yaml:"minimum,omitempty"`
	Maximum          *float64        `json:"maximum,omitempty" yaml:"maximum,omitempty"`
	MaxLength        *uint64         `json:"maxLength,omitempty" yaml:"maxLength,omitempty"`
	MaxItems         *uint64         `json:"maxItems,omitempty" yaml:"maxItems,omitempty"`
	MinLength        uint64          `json:"minLength,omitempty" yaml:"minLength,omitempty"`
	MinItems         uint64          `json:"minItems,omitempty" yaml:"minItems,omitempty"`
	Default          any             `json:"default,omitempty" yaml:"default,omitempty"`
}

// MarshalJSON returns the JSON encoding of Parameter.
func (parameter Parameter) MarshalJSON() ([]byte, error) {
	if ref := parameter.Ref; ref != "" {
		return json.Marshal(openapi3.Ref{Ref: ref})
	}

	m := make(map[string]any, 24+len(parameter.Extensions))
	for k, v := range parameter.Extensions {
		m[k] = v
	}

	if x := parameter.In; x != "" {
		m["in"] = x
	}
	if x := parameter.Name; x != "" {
		m["name"] = x
	}
	if x := parameter.Description; x != "" {
		m["description"] = x
	}
	if x := parameter.CollectionFormat; x != "" {
		m["collectionFormat"] = x
	}
	if x := parameter.Type; x != nil {
		m["type"] = x
	}
	if x := parameter.Format; x != "" {
		m["format"] = x
	}
	if x := parameter.Pattern; x != "" {
		m["pattern"] = x
	}
	if x := parameter.AllowEmptyValue; x {
		m["allowEmptyValue"] = x
	}
	if x := parameter.Required; x {
		m["required"] = x
	}
	if x := parameter.UniqueItems; x {
		m["uniqueItems"] = x
	}
	if x := parameter.ExclusiveMin; x {
		m["exclusiveMinimum"] = x
	}
	if x := parameter.ExclusiveMax; x {
		m["exclusiveMaximum"] = x
	}
	if x := parameter.Schema; x != nil {
		m["schema"] = x
	}
	if x := parameter.Items; x != nil {
		m["items"] = x
	}
	if x := parameter.Enum; x != nil {
		m["enum"] = x
	}
	if x := parameter.MultipleOf; x != nil {
		m["multipleOf"] = x
	}
	if x := parameter.Minimum; x != nil {
		m["minimum"] = x
	}
	if x := parameter.Maximum; x != nil {
		m["maximum"] = x
	}
	if x := parameter.MaxLength; x != nil {
		m["maxLength"] = x
	}
	if x := parameter.MaxItems; x != nil {
		m["maxItems"] = x
	}
	if x := parameter.MinLength; x != 0 {
		m["minLength"] = x
	}
	if x := parameter.MinItems; x != 0 {
		m["minItems"] = x
	}
	if x := parameter.Default; x != nil {
		m["default"] = x
	}

	return json.Marshal(m)
}

// UnmarshalJSON sets Parameter to a copy of data.
func (parameter *Parameter) UnmarshalJSON(data []byte) error {
	type ParameterBis Parameter
	var x ParameterBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "$ref")

	delete(x.Extensions, "in")
	delete(x.Extensions, "name")
	delete(x.Extensions, "description")
	delete(x.Extensions, "collectionFormat")
	delete(x.Extensions, "type")
	delete(x.Extensions, "format")
	delete(x.Extensions, "pattern")
	delete(x.Extensions, "allowEmptyValue")
	delete(x.Extensions, "required")
	delete(x.Extensions, "uniqueItems")
	delete(x.Extensions, "exclusiveMinimum")
	delete(x.Extensions, "exclusiveMaximum")
	delete(x.Extensions, "schema")
	delete(x.Extensions, "items")
	delete(x.Extensions, "enum")
	delete(x.Extensions, "multipleOf")
	delete(x.Extensions, "minimum")
	delete(x.Extensions, "maximum")
	delete(x.Extensions, "maxLength")
	delete(x.Extensions, "maxItems")
	delete(x.Extensions, "minLength")
	delete(x.Extensions, "minItems")
	delete(x.Extensions, "default")

	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}

	*parameter = Parameter(x)
	return nil
}
