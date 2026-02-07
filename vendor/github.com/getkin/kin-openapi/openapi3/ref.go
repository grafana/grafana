package openapi3

//go:generate go run refsgenerator.go

// Ref is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#reference-object
type Ref struct {
	Ref    string  `json:"$ref" yaml:"$ref"`
	Origin *Origin `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`
}
