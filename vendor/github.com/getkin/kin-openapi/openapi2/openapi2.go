package openapi2

import (
	"encoding/json"

	"github.com/getkin/kin-openapi/openapi3"
)

// T is the root of an OpenAPI v2 document
type T struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Swagger             string                     `json:"swagger" yaml:"swagger"` // required
	Info                openapi3.Info              `json:"info" yaml:"info"`       // required
	ExternalDocs        *openapi3.ExternalDocs     `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`
	Schemes             []string                   `json:"schemes,omitempty" yaml:"schemes,omitempty"`
	Consumes            []string                   `json:"consumes,omitempty" yaml:"consumes,omitempty"`
	Produces            []string                   `json:"produces,omitempty" yaml:"produces,omitempty"`
	Host                string                     `json:"host,omitempty" yaml:"host,omitempty"`
	BasePath            string                     `json:"basePath,omitempty" yaml:"basePath,omitempty"`
	Paths               map[string]*PathItem       `json:"paths,omitempty" yaml:"paths,omitempty"`
	Definitions         map[string]*SchemaRef      `json:"definitions,omitempty" yaml:"definitions,omitempty"`
	Parameters          map[string]*Parameter      `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Responses           map[string]*Response       `json:"responses,omitempty" yaml:"responses,omitempty"`
	SecurityDefinitions map[string]*SecurityScheme `json:"securityDefinitions,omitempty" yaml:"securityDefinitions,omitempty"`
	Security            SecurityRequirements       `json:"security,omitempty" yaml:"security,omitempty"`
	Tags                openapi3.Tags              `json:"tags,omitempty" yaml:"tags,omitempty"`
}

// MarshalJSON returns the JSON encoding of T.
func (doc T) MarshalJSON() ([]byte, error) {
	m := make(map[string]any, 15+len(doc.Extensions))
	for k, v := range doc.Extensions {
		m[k] = v
	}
	m["swagger"] = doc.Swagger
	m["info"] = doc.Info
	if x := doc.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}
	if x := doc.Schemes; len(x) != 0 {
		m["schemes"] = x
	}
	if x := doc.Consumes; len(x) != 0 {
		m["consumes"] = x
	}
	if x := doc.Produces; len(x) != 0 {
		m["produces"] = x
	}
	if x := doc.Host; x != "" {
		m["host"] = x
	}
	if x := doc.BasePath; x != "" {
		m["basePath"] = x
	}
	if x := doc.Paths; len(x) != 0 {
		m["paths"] = x
	}
	if x := doc.Definitions; len(x) != 0 {
		m["definitions"] = x
	}
	if x := doc.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	if x := doc.Responses; len(x) != 0 {
		m["responses"] = x
	}
	if x := doc.SecurityDefinitions; len(x) != 0 {
		m["securityDefinitions"] = x
	}
	if x := doc.Security; len(x) != 0 {
		m["security"] = x
	}
	if x := doc.Tags; len(x) != 0 {
		m["tags"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets T to a copy of data.
func (doc *T) UnmarshalJSON(data []byte) error {
	type TBis T
	var x TBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "swagger")
	delete(x.Extensions, "info")
	delete(x.Extensions, "externalDocs")
	delete(x.Extensions, "schemes")
	delete(x.Extensions, "consumes")
	delete(x.Extensions, "produces")
	delete(x.Extensions, "host")
	delete(x.Extensions, "basePath")
	delete(x.Extensions, "paths")
	delete(x.Extensions, "definitions")
	delete(x.Extensions, "parameters")
	delete(x.Extensions, "responses")
	delete(x.Extensions, "securityDefinitions")
	delete(x.Extensions, "security")
	delete(x.Extensions, "tags")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*doc = T(x)
	return nil
}

func (doc *T) AddOperation(path string, method string, operation *Operation) {
	if doc.Paths == nil {
		doc.Paths = make(map[string]*PathItem)
	}
	pathItem := doc.Paths[path]
	if pathItem == nil {
		pathItem = &PathItem{}
		doc.Paths[path] = pathItem
	}
	pathItem.SetOperation(method, operation)
}
