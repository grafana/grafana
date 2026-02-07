package openapi3

const originKey = "__origin__"

// Origin contains the origin of a collection.
// Key is the location of the collection itself.
// Fields is a map of the location of each field in the collection.
type Origin struct {
	Key    *Location           `json:"key,omitempty" yaml:"key,omitempty"`
	Fields map[string]Location `json:"fields,omitempty" yaml:"fields,omitempty"`
}

// Location is a struct that contains the location of a field.
type Location struct {
	Line   int `json:"line,omitempty" yaml:"line,omitempty"`
	Column int `json:"column,omitempty" yaml:"column,omitempty"`
}
