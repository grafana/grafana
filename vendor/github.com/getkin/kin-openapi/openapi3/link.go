package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// Link is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#link-object
type Link struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	OperationRef string         `json:"operationRef,omitempty" yaml:"operationRef,omitempty"`
	OperationID  string         `json:"operationId,omitempty" yaml:"operationId,omitempty"`
	Description  string         `json:"description,omitempty" yaml:"description,omitempty"`
	Parameters   map[string]any `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Server       *Server        `json:"server,omitempty" yaml:"server,omitempty"`
	RequestBody  any            `json:"requestBody,omitempty" yaml:"requestBody,omitempty"`
}

// MarshalJSON returns the JSON encoding of Link.
func (link Link) MarshalJSON() ([]byte, error) {
	x, err := link.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Link.
func (link Link) MarshalYAML() (any, error) {
	m := make(map[string]any, 6+len(link.Extensions))
	for k, v := range link.Extensions {
		m[k] = v
	}

	if x := link.OperationRef; x != "" {
		m["operationRef"] = x
	}
	if x := link.OperationID; x != "" {
		m["operationId"] = x
	}
	if x := link.Description; x != "" {
		m["description"] = x
	}
	if x := link.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	if x := link.Server; x != nil {
		m["server"] = x
	}
	if x := link.RequestBody; x != nil {
		m["requestBody"] = x
	}

	return m, nil
}

// UnmarshalJSON sets Link to a copy of data.
func (link *Link) UnmarshalJSON(data []byte) error {
	type LinkBis Link
	var x LinkBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "operationRef")
	delete(x.Extensions, "operationId")
	delete(x.Extensions, "description")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "server")
	delete(x.Extensions, "requestBody")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*link = Link(x)
	return nil
}

// Validate returns an error if Link does not comply with the OpenAPI spec.
func (link *Link) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if link.OperationID == "" && link.OperationRef == "" {
		return errors.New("missing operationId or operationRef on link")
	}
	if link.OperationID != "" && link.OperationRef != "" {
		return fmt.Errorf("operationId %q and operationRef %q are mutually exclusive", link.OperationID, link.OperationRef)
	}

	return validateExtensions(ctx, link.Extensions)
}

// UnmarshalJSON sets Links to a copy of data.
func (links *Links) UnmarshalJSON(data []byte) (err error) {
	*links, _, err = unmarshalStringMapP[LinkRef](data)
	return
}
