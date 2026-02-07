package openapi2

import (
	"encoding/json"

	"github.com/getkin/kin-openapi/openapi3"
)

type Response struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Ref string `json:"$ref,omitempty" yaml:"$ref,omitempty"`

	Description string             `json:"description,omitempty" yaml:"description,omitempty"`
	Schema      *SchemaRef         `json:"schema,omitempty" yaml:"schema,omitempty"`
	Headers     map[string]*Header `json:"headers,omitempty" yaml:"headers,omitempty"`
	Examples    map[string]any     `json:"examples,omitempty" yaml:"examples,omitempty"`
}

// MarshalJSON returns the JSON encoding of Response.
func (response Response) MarshalJSON() ([]byte, error) {
	if ref := response.Ref; ref != "" {
		return json.Marshal(openapi3.Ref{Ref: ref})
	}

	m := make(map[string]any, 4+len(response.Extensions))
	for k, v := range response.Extensions {
		m[k] = v
	}
	if x := response.Description; x != "" {
		m["description"] = x
	}
	if x := response.Schema; x != nil {
		m["schema"] = x
	}
	if x := response.Headers; len(x) != 0 {
		m["headers"] = x
	}
	if x := response.Examples; len(x) != 0 {
		m["examples"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets Response to a copy of data.
func (response *Response) UnmarshalJSON(data []byte) error {
	type ResponseBis Response
	var x ResponseBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "$ref")
	delete(x.Extensions, "description")
	delete(x.Extensions, "schema")
	delete(x.Extensions, "headers")
	delete(x.Extensions, "examples")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*response = Response(x)
	return nil
}
