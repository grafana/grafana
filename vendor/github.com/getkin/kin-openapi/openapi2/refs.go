package openapi2

import (
	"encoding/json"
	"net/url"
	"sort"
	"strings"

	"github.com/go-openapi/jsonpointer"
	"github.com/perimeterx/marshmallow"
)

// SchemaRef represents either a Schema or a $ref to a Schema.
// When serializing and both fields are set, Ref is preferred over Value.
type SchemaRef struct {
	// Extensions only captures fields starting with 'x-' as no other fields
	// are allowed by the openapi spec.
	Extensions map[string]any

	Ref   string
	Value *Schema
	extra []string

	refPath *url.URL
}

var _ jsonpointer.JSONPointable = (*SchemaRef)(nil)

func (x *SchemaRef) isEmpty() bool { return x == nil || x.Ref == "" && x.Value == nil }

// RefString returns the $ref value.
func (x *SchemaRef) RefString() string { return x.Ref }

// CollectionName returns the JSON string used for a collection of these components.
func (x *SchemaRef) CollectionName() string { return "schemas" }

// RefPath returns the path of the $ref relative to the root document.
func (x *SchemaRef) RefPath() *url.URL { return copyURI(x.refPath) }

func (x *SchemaRef) setRefPath(u *url.URL) {
	// Once the refPath is set don't override. References can be loaded
	// multiple times not all with access to the correct path info.
	if x.refPath != nil {
		return
	}

	x.refPath = copyURI(u)
}

// MarshalYAML returns the YAML encoding of SchemaRef.
func (x SchemaRef) MarshalYAML() (any, error) {
	if ref := x.Ref; ref != "" {
		return &Ref{Ref: ref}, nil
	}
	return x.Value.MarshalYAML()
}

// MarshalJSON returns the JSON encoding of SchemaRef.
func (x SchemaRef) MarshalJSON() ([]byte, error) {
	y, err := x.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(y)
}

// UnmarshalJSON sets SchemaRef to a copy of data.
func (x *SchemaRef) UnmarshalJSON(data []byte) error {
	var refOnly Ref
	if extra, err := marshmallow.Unmarshal(data, &refOnly, marshmallow.WithExcludeKnownFieldsFromMap(true)); err == nil && refOnly.Ref != "" {
		x.Ref = refOnly.Ref
		if len(extra) != 0 {
			x.extra = make([]string, 0, len(extra))
			for key := range extra {
				x.extra = append(x.extra, key)
			}
			sort.Strings(x.extra)
			for k := range extra {
				if !strings.HasPrefix(k, "x-") {
					delete(extra, k)
				}
			}
			if len(extra) != 0 {
				x.Extensions = extra
			}
		}
		return nil
	}
	return json.Unmarshal(data, &x.Value)
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (x *SchemaRef) JSONLookup(token string) (any, error) {
	if token == "$ref" {
		return x.Ref, nil
	}

	if v, ok := x.Extensions[token]; ok {
		return v, nil
	}

	ptr, _, err := jsonpointer.GetForToken(x.Value, token)
	return ptr, err
}
