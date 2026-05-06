package v0alpha1

import (
	"fmt"
)

// QueryTypeDefinition is a kubernetes shaped object that represents a single query definition
type QueryTypeDefinition struct {
	ObjectMeta `json:"metadata,omitempty"`

	Spec QueryTypeDefinitionSpec `json:"spec,omitempty"`
}

// QueryTypeDefinitionList is a kubernetes shaped object that represents a list of query types
// For simple data sources, there may be only a single query type, however when multiple types
// exist they must be clearly specified with distinct discriminator field+value pairs
type QueryTypeDefinitionList struct {
	TypeMeta   `json:",inline"`
	ObjectMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items"`
}

type QueryTypeDefinitionSpec struct {
	// Multiple schemas can be defined using discriminators
	Discriminators []DiscriminatorFieldValue `json:"discriminators,omitempty"`

	// Describe whe the query type is for
	Description string `json:"description,omitempty"`

	// The query schema represents the properties that can be sent to the API
	// In many cases, this may be the same properties that are saved in a dashboard
	// In the case where the save model is different, we must also specify a save model
	Schema JSONSchema `json:"schema"`

	// Examples (include a wrapper) ideally a template!
	Examples []QueryExample `json:"examples"`

	// Changelog defines the changed from the previous version
	// All changes in the same version *must* be backwards compatible
	// Only notable changes will be shown here, for the full version history see git!
	Changelog []string `json:"changelog,omitempty"`
}

type QueryExample struct {
	// Version identifier or empty if only one exists
	Name string `json:"name,omitempty"`

	// Optionally explain why the example is interesting
	Description string `json:"description,omitempty"`

	// An example value saved that can be saved in a dashboard
	SaveModel Unstructured `json:"saveModel,omitempty"`
}

type DiscriminatorFieldValue struct {
	// DiscriminatorField is the field used to link behavior to this specific
	// query type.  It is typically "queryType", but can be another field if necessary
	Field string `json:"field"`

	// The discriminator value
	Value string `json:"value"`
}

// using any since this will often be enumerations
func NewDiscriminators(keyvals ...any) []DiscriminatorFieldValue {
	if len(keyvals)%2 != 0 {
		panic("values must be even")
	}
	dis := []DiscriminatorFieldValue{}
	for i := 0; i < len(keyvals); i += 2 {
		dis = append(dis, DiscriminatorFieldValue{
			Field: fmt.Sprintf("%v", keyvals[i]),
			Value: fmt.Sprintf("%v", keyvals[i+1]),
		})
	}
	return dis
}
