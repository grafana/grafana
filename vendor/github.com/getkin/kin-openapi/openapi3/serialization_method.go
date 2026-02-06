package openapi3

const (
	SerializationSimple         = "simple"
	SerializationLabel          = "label"
	SerializationMatrix         = "matrix"
	SerializationForm           = "form"
	SerializationSpaceDelimited = "spaceDelimited"
	SerializationPipeDelimited  = "pipeDelimited"
	SerializationDeepObject     = "deepObject"
)

// SerializationMethod describes a serialization method of HTTP request's parameters and body.
type SerializationMethod struct {
	Style   string
	Explode bool
}
