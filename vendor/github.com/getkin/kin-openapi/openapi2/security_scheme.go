package openapi2

import (
	"encoding/json"

	"github.com/getkin/kin-openapi/openapi3"
)

type SecurityRequirements []map[string][]string

type SecurityScheme struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Ref string `json:"$ref,omitempty" yaml:"$ref,omitempty"`

	Description      string            `json:"description,omitempty" yaml:"description,omitempty"`
	Type             string            `json:"type,omitempty" yaml:"type,omitempty"`
	In               string            `json:"in,omitempty" yaml:"in,omitempty"`
	Name             string            `json:"name,omitempty" yaml:"name,omitempty"`
	Flow             string            `json:"flow,omitempty" yaml:"flow,omitempty"`
	AuthorizationURL string            `json:"authorizationUrl,omitempty" yaml:"authorizationUrl,omitempty"`
	TokenURL         string            `json:"tokenUrl,omitempty" yaml:"tokenUrl,omitempty"`
	Scopes           map[string]string `json:"scopes,omitempty" yaml:"scopes,omitempty"`
	Tags             openapi3.Tags     `json:"tags,omitempty" yaml:"tags,omitempty"`
}

// MarshalJSON returns the JSON encoding of SecurityScheme.
func (securityScheme SecurityScheme) MarshalJSON() ([]byte, error) {
	if ref := securityScheme.Ref; ref != "" {
		return json.Marshal(openapi3.Ref{Ref: ref})
	}

	m := make(map[string]any, 10+len(securityScheme.Extensions))
	for k, v := range securityScheme.Extensions {
		m[k] = v
	}
	if x := securityScheme.Description; x != "" {
		m["description"] = x
	}
	if x := securityScheme.Type; x != "" {
		m["type"] = x
	}
	if x := securityScheme.In; x != "" {
		m["in"] = x
	}
	if x := securityScheme.Name; x != "" {
		m["name"] = x
	}
	if x := securityScheme.Flow; x != "" {
		m["flow"] = x
	}
	if x := securityScheme.AuthorizationURL; x != "" {
		m["authorizationUrl"] = x
	}
	if x := securityScheme.TokenURL; x != "" {
		m["tokenUrl"] = x
	}
	if x := securityScheme.Scopes; len(x) != 0 {
		m["scopes"] = x
	}
	if x := securityScheme.Tags; len(x) != 0 {
		m["tags"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets SecurityScheme to a copy of data.
func (securityScheme *SecurityScheme) UnmarshalJSON(data []byte) error {
	type SecuritySchemeBis SecurityScheme
	var x SecuritySchemeBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "$ref")
	delete(x.Extensions, "description")
	delete(x.Extensions, "type")
	delete(x.Extensions, "in")
	delete(x.Extensions, "name")
	delete(x.Extensions, "flow")
	delete(x.Extensions, "authorizationUrl")
	delete(x.Extensions, "tokenUrl")
	delete(x.Extensions, "scopes")
	delete(x.Extensions, "tags")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*securityScheme = SecurityScheme(x)
	return nil
}
