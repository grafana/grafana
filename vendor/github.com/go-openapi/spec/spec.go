// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"
)

//go:generate curl -L --progress -o ./schemas/v2/schema.json http://swagger.io/v2/schema.json
//go:generate curl -L --progress  -o ./schemas/jsonschema-draft-04.json http://json-schema.org/draft-04/schema
//go:generate go-bindata -pkg=spec -prefix=./schemas -ignore=.*\.md ./schemas/...
//go:generate perl -pi -e s,Json,JSON,g bindata.go

const (
	// SwaggerSchemaURL the url for the swagger 2.0 schema to validate specs
	SwaggerSchemaURL = "http://swagger.io/v2/schema.json#"
	// JSONSchemaURL the url for the json schema
	JSONSchemaURL = "http://json-schema.org/draft-04/schema#"
)

// MustLoadJSONSchemaDraft04 panics when Swagger20Schema returns an error
func MustLoadJSONSchemaDraft04() *Schema {
	d, e := JSONSchemaDraft04()
	if e != nil {
		panic(e)
	}
	return d
}

// JSONSchemaDraft04 loads the json schema document for json schema draft04
func JSONSchemaDraft04() (*Schema, error) {
	b, err := jsonschemaDraft04JSONBytes()
	if err != nil {
		return nil, err
	}

	schema := new(Schema)
	if err := json.Unmarshal(b, schema); err != nil {
		return nil, err
	}
	return schema, nil
}

// MustLoadSwagger20Schema panics when Swagger20Schema returns an error
func MustLoadSwagger20Schema() *Schema {
	d, e := Swagger20Schema()
	if e != nil {
		panic(e)
	}
	return d
}

// Swagger20Schema loads the swagger 2.0 schema from the embedded assets
func Swagger20Schema() (*Schema, error) {

	b, err := v2SchemaJSONBytes()
	if err != nil {
		return nil, err
	}

	schema := new(Schema)
	if err := json.Unmarshal(b, schema); err != nil {
		return nil, err
	}
	return schema, nil
}
