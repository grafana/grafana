package codegen

import (
	"context"
	"io"
	"os"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jsonschema"
)

type JSONSchemaInput struct {
	InputBase `yaml:",inline"`

	// Path to a JSONSchema file.
	Path string `yaml:"path"`

	// URL to a JSONSchema file.
	URL string `yaml:"url"`

	// Package name to use for the input schema. If empty, it will be guessed
	// from the input file name.
	Package string `yaml:"package"`
}

func (input *JSONSchemaInput) interpolateParameters(interpolator ParametersInterpolator) {
	input.InputBase.interpolateParameters(interpolator)

	input.Path = interpolator(input.Path)
	input.URL = interpolator(input.URL)
	input.Package = interpolator(input.Package)
}

func (input *JSONSchemaInput) schemaReader(ctx context.Context) (io.ReadCloser, error) {
	if input.Path != "" {
		return os.Open(input.Path)
	}

	return loadURL(ctx, input.URL)
}

func (input *JSONSchemaInput) packageName() string {
	if input.Package != "" {
		return input.Package
	}

	return guessPackageFromFilename(input.Path)
}

func (input *JSONSchemaInput) LoadSchemas(ctx context.Context) (ast.Schemas, error) {
	schemaReader, err := input.schemaReader(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = schemaReader.Close() }()

	schema, err := jsonschema.GenerateAST(schemaReader, jsonschema.Config{
		Package:        input.packageName(),
		SchemaMetadata: input.schemaMetadata(),
		SchemaPath:     input.Path,
	})
	if err != nil {
		return nil, err
	}

	return input.filterSchema(schema)
}
