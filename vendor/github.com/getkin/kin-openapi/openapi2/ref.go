package openapi2

//go:generate go run refsgenerator.go

// Ref is specified by OpenAPI/Swagger 2.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/2.0.md#reference-object
type Ref struct {
	Ref string `json:"$ref" yaml:"$ref"`
}
