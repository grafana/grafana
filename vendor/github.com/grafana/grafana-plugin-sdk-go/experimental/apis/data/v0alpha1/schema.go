package v0alpha1

import (
	"encoding/json"

	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// The k8s compatible jsonschema version
const draft04 = "https://json-schema.org/draft-04/schema#"

type JSONSchema struct {
	Spec *spec.Schema
}

func (s JSONSchema) MarshalJSON() ([]byte, error) {
	if s.Spec == nil {
		return []byte("{}"), nil
	}
	body, err := s.Spec.MarshalJSON()
	if err == nil {
		// The internal format puts $schema last!
		// this moves $schema first
		cpy := map[string]any{}
		err := json.Unmarshal(body, &cpy)
		if err == nil {
			return json.Marshal(cpy)
		}
	}
	return body, err
}

func (s *JSONSchema) UnmarshalJSON(data []byte) error {
	s.Spec = &spec.Schema{}
	return s.Spec.UnmarshalJSON(data)
}

func (s JSONSchema) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{Schema: spec.Schema{
		SchemaProps: spec.SchemaProps{
			Ref:                  spec.MustCreateRef(draft04),
			Type:                 []string{"object"},
			AdditionalProperties: &spec.SchemaOrBool{Allows: true},
		},
	}}
}

func (s *JSONSchema) DeepCopy() *JSONSchema {
	if s == nil {
		return nil
	}
	out := &JSONSchema{}
	if s.Spec != nil {
		out.Spec = &spec.Schema{}
		jj, err := json.Marshal(s.Spec)
		if err == nil {
			_ = json.Unmarshal(jj, out.Spec)
		}
	}
	return out
}

func (s *JSONSchema) DeepCopyInto(out *JSONSchema) {
	if s.Spec == nil {
		out.Spec = nil
		return
	}
	out.Spec = s.DeepCopy().Spec
}
