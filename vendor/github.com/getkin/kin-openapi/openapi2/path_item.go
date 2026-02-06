package openapi2

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
)

type PathItem struct {
	Extensions map[string]any `json:"-" yaml:"-"`

	Ref string `json:"$ref,omitempty" yaml:"$ref,omitempty"`

	Delete     *Operation `json:"delete,omitempty" yaml:"delete,omitempty"`
	Get        *Operation `json:"get,omitempty" yaml:"get,omitempty"`
	Head       *Operation `json:"head,omitempty" yaml:"head,omitempty"`
	Options    *Operation `json:"options,omitempty" yaml:"options,omitempty"`
	Patch      *Operation `json:"patch,omitempty" yaml:"patch,omitempty"`
	Post       *Operation `json:"post,omitempty" yaml:"post,omitempty"`
	Put        *Operation `json:"put,omitempty" yaml:"put,omitempty"`
	Parameters Parameters `json:"parameters,omitempty" yaml:"parameters,omitempty"`
}

// MarshalJSON returns the JSON encoding of PathItem.
func (pathItem PathItem) MarshalJSON() ([]byte, error) {
	if ref := pathItem.Ref; ref != "" {
		return json.Marshal(openapi3.Ref{Ref: ref})
	}

	m := make(map[string]any, 8+len(pathItem.Extensions))
	for k, v := range pathItem.Extensions {
		m[k] = v
	}
	if x := pathItem.Delete; x != nil {
		m["delete"] = x
	}
	if x := pathItem.Get; x != nil {
		m["get"] = x
	}
	if x := pathItem.Head; x != nil {
		m["head"] = x
	}
	if x := pathItem.Options; x != nil {
		m["options"] = x
	}
	if x := pathItem.Patch; x != nil {
		m["patch"] = x
	}
	if x := pathItem.Post; x != nil {
		m["post"] = x
	}
	if x := pathItem.Put; x != nil {
		m["put"] = x
	}
	if x := pathItem.Parameters; len(x) != 0 {
		m["parameters"] = x
	}
	return json.Marshal(m)
}

// UnmarshalJSON sets PathItem to a copy of data.
func (pathItem *PathItem) UnmarshalJSON(data []byte) error {
	type PathItemBis PathItem
	var x PathItemBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "$ref")
	delete(x.Extensions, "delete")
	delete(x.Extensions, "get")
	delete(x.Extensions, "head")
	delete(x.Extensions, "options")
	delete(x.Extensions, "patch")
	delete(x.Extensions, "post")
	delete(x.Extensions, "put")
	delete(x.Extensions, "parameters")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*pathItem = PathItem(x)
	return nil
}

func (pathItem *PathItem) Operations() map[string]*Operation {
	operations := make(map[string]*Operation)
	if v := pathItem.Delete; v != nil {
		operations[http.MethodDelete] = v
	}
	if v := pathItem.Get; v != nil {
		operations[http.MethodGet] = v
	}
	if v := pathItem.Head; v != nil {
		operations[http.MethodHead] = v
	}
	if v := pathItem.Options; v != nil {
		operations[http.MethodOptions] = v
	}
	if v := pathItem.Patch; v != nil {
		operations[http.MethodPatch] = v
	}
	if v := pathItem.Post; v != nil {
		operations[http.MethodPost] = v
	}
	if v := pathItem.Put; v != nil {
		operations[http.MethodPut] = v
	}
	return operations
}

func (pathItem *PathItem) GetOperation(method string) *Operation {
	switch method {
	case http.MethodDelete:
		return pathItem.Delete
	case http.MethodGet:
		return pathItem.Get
	case http.MethodHead:
		return pathItem.Head
	case http.MethodOptions:
		return pathItem.Options
	case http.MethodPatch:
		return pathItem.Patch
	case http.MethodPost:
		return pathItem.Post
	case http.MethodPut:
		return pathItem.Put
	default:
		panic(fmt.Errorf("unsupported HTTP method %q", method))
	}
}

func (pathItem *PathItem) SetOperation(method string, operation *Operation) {
	switch method {
	case http.MethodDelete:
		pathItem.Delete = operation
	case http.MethodGet:
		pathItem.Get = operation
	case http.MethodHead:
		pathItem.Head = operation
	case http.MethodOptions:
		pathItem.Options = operation
	case http.MethodPatch:
		pathItem.Patch = operation
	case http.MethodPost:
		pathItem.Post = operation
	case http.MethodPut:
		pathItem.Put = operation
	default:
		panic(fmt.Errorf("unsupported HTTP method %q", method))
	}
}
