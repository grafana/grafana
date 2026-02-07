package openapi2

import (
	"encoding/json"

	"github.com/getkin/kin-openapi/openapi3"
)

type Operation struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Summary      string                 `json:"summary,omitempty" yaml:"summary,omitempty"`
	Description  string                 `json:"description,omitempty" yaml:"description,omitempty"`
	Deprecated   bool                   `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	ExternalDocs *openapi3.ExternalDocs `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`
	Tags         []string               `json:"tags,omitempty" yaml:"tags,omitempty"`
	OperationID  string                 `json:"operationId,omitempty" yaml:"operationId,omitempty"`
	Parameters   Parameters             `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Responses    map[string]*Response   `json:"responses" yaml:"responses"`
	Consumes     []string               `json:"consumes,omitempty" yaml:"consumes,omitempty"`
	Produces     []string               `json:"produces,omitempty" yaml:"produces,omitempty"`
	Schemes      []string               `json:"schemes,omitempty" yaml:"schemes,omitempty"`
	Security     *SecurityRequirements  `json:"security,omitempty" yaml:"security,omitempty"`
}

// MarshalJSON returns the JSON encoding of Operation.
func (operation Operation) MarshalJSON() ([]byte, error) {
	m := make(map[string]any, 12+len(operation.Extensions))
	for k, v := range operation.Extensions {
		m[k] = v
	}
	if x := operation.Summary; x != "" {
		m["summary"] = x
	}
	if x := operation.Description; x != "" {
		m["description"] = x
	}
	if x := operation.Deprecated; x {
		m["deprecated"] = x
	}
	if x := operation.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}
	if x := operation.Tags; len(x) != 0 {
		m["tags"] = x
	}
	if x := operation.OperationID; x != "" {
		m["operationId"] = x
	}
	if x := operation.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	m["responses"] = operation.Responses
	if x := operation.Consumes; len(x) != 0 {
		m["consumes"] = x
	}
	if x := operation.Produces; len(x) != 0 {
		m["produces"] = x
	}
	if x := operation.Schemes; len(x) != 0 {
		m["schemes"] = x
	}
	if x := operation.Security; x != nil {
		m["security"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets Operation to a copy of data.
func (operation *Operation) UnmarshalJSON(data []byte) error {
	type OperationBis Operation
	var x OperationBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "summary")
	delete(x.Extensions, "description")
	delete(x.Extensions, "deprecated")
	delete(x.Extensions, "externalDocs")
	delete(x.Extensions, "tags")
	delete(x.Extensions, "operationId")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "responses")
	delete(x.Extensions, "consumes")
	delete(x.Extensions, "produces")
	delete(x.Extensions, "schemes")
	delete(x.Extensions, "security")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*operation = Operation(x)
	return nil
}
