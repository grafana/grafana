package v0alpha1

import (
	"encoding/json"

	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

// Unstructured allows objects that do not have Golang structs registered to be manipulated
// generically.
type Unstructured struct {
	// Object is a JSON compatible map with string, float, int, bool, []interface{},
	// or map[string]interface{} children.
	Object map[string]any
}

// Create an unstructured value from any input
func AsUnstructured(v any) Unstructured {
	out := Unstructured{}
	body, err := json.Marshal(v)
	if err == nil {
		_ = json.Unmarshal(body, &out.Object)
	}
	return out
}

// Produce an API definition that represents map[string]any
func (u Unstructured) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
		},
	}
}

func (u *Unstructured) UnstructuredContent() map[string]interface{} {
	if u.Object == nil {
		return make(map[string]interface{})
	}
	return u.Object
}

func (u *Unstructured) SetUnstructuredContent(content map[string]interface{}) {
	u.Object = content
}

// MarshalJSON ensures that the unstructured object produces proper
// JSON when passed to Go's standard JSON library.
func (u Unstructured) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.Object)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (u *Unstructured) UnmarshalJSON(b []byte) error {
	return json.Unmarshal(b, &u.Object)
}

func (u *Unstructured) DeepCopy() *Unstructured {
	if u == nil {
		return nil
	}
	out := new(Unstructured)
	u.DeepCopyInto(out)
	return out
}

func (u *Unstructured) DeepCopyInto(out *Unstructured) {
	obj := map[string]any{}
	if u.Object != nil {
		jj, err := json.Marshal(u.Object)
		if err == nil {
			_ = json.Unmarshal(jj, &obj)
		}
	}
	out.Object = obj
}
