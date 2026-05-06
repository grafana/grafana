package spec

import (
	"embed"
	"path"
)

//go:embed schemas/*.json schemas/*/*.json
var assets embed.FS

func jsonschemaDraft04JSONBytes() ([]byte, error) {
	return assets.ReadFile(path.Join("schemas", "jsonschema-draft-04.json"))
}

func v2SchemaJSONBytes() ([]byte, error) {
	return assets.ReadFile(path.Join("schemas", "v2", "schema.json"))
}
