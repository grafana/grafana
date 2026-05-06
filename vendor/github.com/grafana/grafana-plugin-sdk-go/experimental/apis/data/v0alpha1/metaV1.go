package v0alpha1

// ObjectMeta is a struct that aims to "look" like a real kubernetes object when
// written to JSON, however it does not require the pile of dependencies
// This is really an internal helper until we decide which dependencies make sense
// to require within the SDK
type ObjectMeta struct {
	// The name is for k8s and description, but not used in the schema
	Name string `json:"name,omitempty"`
	// Changes indicate that *something * changed
	ResourceVersion string `json:"resourceVersion,omitempty"`
	// Timestamp
	CreationTimestamp string `json:"creationTimestamp,omitempty"`
}

type TypeMeta struct {
	Kind       string `json:"kind"`       // "QueryTypeDefinitionList",
	APIVersion string `json:"apiVersion"` // "query.grafana.app/v0alpha1",
}
