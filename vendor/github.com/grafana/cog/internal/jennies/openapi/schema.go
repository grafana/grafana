package openapi

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/jsonschema"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/orderedmap"
)

type Schema struct {
	Config Config
}

func (jenny Schema) JennyName() string {
	return "OpenAPI"
}

func (jenny Schema) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0, len(context.Schemas))

	for _, schema := range context.Schemas {
		output, err := jenny.generateSchema(context, schema)
		if err != nil {
			return nil, err
		}

		files = append(files, *codejen.NewFile(schema.Package+".openapi.json", output, jenny))
	}

	return files, nil
}

func (jenny Schema) generateSchema(context languages.Context, schema *ast.Schema) ([]byte, error) {
	jsonschemaJenny := jsonschema.Schema{
		Config: jsonschema.Config{
			Debug:   jenny.Config.debug,
			Compact: jenny.Config.Compact,
		},
		ReferenceFormatter: func(ref ast.RefType) string {
			return fmt.Sprintf("#/components/schemas/%s", ref.ReferredType)
		},
		OpenAPI3Compatible: true,
	}

	jsonSchema := jsonschemaJenny.GenerateSchema(context, schema)

	info := orderedmap.New[string, any]()
	info.Set("title", schema.Package)
	info.Set("version", "0.0.0")
	info.Set("x-schema-identifier", schema.Metadata.Identifier)
	info.Set("x-schema-kind", schema.Metadata.Kind)
	if schema.Metadata.Variant != "" {
		info.Set("x-schema-variant", schema.Metadata.Variant)
	}

	openapiSchema := orderedmap.New[string, any]()
	openapiSchema.Set("openapi", "3.0.0")
	openapiSchema.Set("info", info)
	openapiSchema.Set("paths", map[string]any{})
	openapiSchema.Set("components", map[string]any{
		"schemas": jsonSchema.Get("definitions"),
	})

	return jenny.toJSON(openapiSchema)
}

func (jenny Schema) toJSON(input any) ([]byte, error) {
	if !jenny.Config.Compact {
		return json.MarshalIndent(input, "", "  ")
	}

	return json.Marshal(input)
}
