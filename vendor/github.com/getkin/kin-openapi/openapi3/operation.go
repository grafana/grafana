package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/go-openapi/jsonpointer"
)

// Operation represents "operation" specified by" OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#operation-object
type Operation struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	// Optional tags for documentation.
	Tags []string `json:"tags,omitempty" yaml:"tags,omitempty"`

	// Optional short summary.
	Summary string `json:"summary,omitempty" yaml:"summary,omitempty"`

	// Optional description. Should use CommonMark syntax.
	Description string `json:"description,omitempty" yaml:"description,omitempty"`

	// Optional operation ID.
	OperationID string `json:"operationId,omitempty" yaml:"operationId,omitempty"`

	// Optional parameters.
	Parameters Parameters `json:"parameters,omitempty" yaml:"parameters,omitempty"`

	// Optional body parameter.
	RequestBody *RequestBodyRef `json:"requestBody,omitempty" yaml:"requestBody,omitempty"`

	// Responses.
	Responses *Responses `json:"responses" yaml:"responses"` // Required

	// Optional callbacks
	Callbacks Callbacks `json:"callbacks,omitempty" yaml:"callbacks,omitempty"`

	Deprecated bool `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`

	// Optional security requirements that overrides top-level security.
	Security *SecurityRequirements `json:"security,omitempty" yaml:"security,omitempty"`

	// Optional servers that overrides top-level servers.
	Servers *Servers `json:"servers,omitempty" yaml:"servers,omitempty"`

	ExternalDocs *ExternalDocs `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`
}

var _ jsonpointer.JSONPointable = (*Operation)(nil)

func NewOperation() *Operation {
	return &Operation{}
}

// MarshalJSON returns the JSON encoding of Operation.
func (operation Operation) MarshalJSON() ([]byte, error) {
	x, err := operation.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Operation.
func (operation Operation) MarshalYAML() (any, error) {
	m := make(map[string]any, 12+len(operation.Extensions))
	for k, v := range operation.Extensions {
		m[k] = v
	}
	if x := operation.Tags; len(x) != 0 {
		m["tags"] = x
	}
	if x := operation.Summary; x != "" {
		m["summary"] = x
	}
	if x := operation.Description; x != "" {
		m["description"] = x
	}
	if x := operation.OperationID; x != "" {
		m["operationId"] = x
	}
	if x := operation.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	if x := operation.RequestBody; x != nil {
		m["requestBody"] = x
	}
	m["responses"] = operation.Responses
	if x := operation.Callbacks; len(x) != 0 {
		m["callbacks"] = x
	}
	if x := operation.Deprecated; x {
		m["deprecated"] = x
	}
	if x := operation.Security; x != nil {
		m["security"] = x
	}
	if x := operation.Servers; x != nil {
		m["servers"] = x
	}
	if x := operation.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Operation to a copy of data.
func (operation *Operation) UnmarshalJSON(data []byte) error {
	type OperationBis Operation
	var x OperationBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "tags")
	delete(x.Extensions, "summary")
	delete(x.Extensions, "description")
	delete(x.Extensions, "operationId")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "requestBody")
	delete(x.Extensions, "responses")
	delete(x.Extensions, "callbacks")
	delete(x.Extensions, "deprecated")
	delete(x.Extensions, "security")
	delete(x.Extensions, "servers")
	delete(x.Extensions, "externalDocs")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*operation = Operation(x)
	return nil
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (operation Operation) JSONLookup(token string) (any, error) {
	switch token {
	case "requestBody":
		if operation.RequestBody != nil {
			if operation.RequestBody.Ref != "" {
				return &Ref{Ref: operation.RequestBody.Ref}, nil
			}
			return operation.RequestBody.Value, nil
		}
	case "tags":
		return operation.Tags, nil
	case "summary":
		return operation.Summary, nil
	case "description":
		return operation.Description, nil
	case "operationID":
		return operation.OperationID, nil
	case "parameters":
		return operation.Parameters, nil
	case "responses":
		return operation.Responses, nil
	case "callbacks":
		return operation.Callbacks, nil
	case "deprecated":
		return operation.Deprecated, nil
	case "security":
		return operation.Security, nil
	case "servers":
		return operation.Servers, nil
	case "externalDocs":
		return operation.ExternalDocs, nil
	}

	v, _, err := jsonpointer.GetForToken(operation.Extensions, token)
	return v, err
}

func (operation *Operation) AddParameter(p *Parameter) {
	operation.Parameters = append(operation.Parameters, &ParameterRef{Value: p})
}

func (operation *Operation) AddResponse(status int, response *Response) {
	code := "default"
	if 0 < status && status < 1000 {
		code = strconv.FormatInt(int64(status), 10)
	}
	if operation.Responses == nil {
		operation.Responses = NewResponses()
	}
	operation.Responses.Set(code, &ResponseRef{Value: response})
}

// Validate returns an error if Operation does not comply with the OpenAPI spec.
func (operation *Operation) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := operation.Parameters; v != nil {
		if err := v.Validate(ctx); err != nil {
			return err
		}
	}

	if v := operation.RequestBody; v != nil {
		if err := v.Validate(ctx); err != nil {
			return err
		}
	}

	if v := operation.Responses; v != nil {
		if err := v.Validate(ctx); err != nil {
			return err
		}
	} else {
		return errors.New("value of responses must be an object")
	}

	if v := operation.ExternalDocs; v != nil {
		if err := v.Validate(ctx); err != nil {
			return fmt.Errorf("invalid external docs: %w", err)
		}
	}

	return validateExtensions(ctx, operation.Extensions)
}
