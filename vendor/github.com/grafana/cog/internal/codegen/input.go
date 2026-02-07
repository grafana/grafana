package codegen

import (
	"context"
	"fmt"

	"github.com/expr-lang/expr"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/semver"
	"github.com/grafana/cog/internal/tools"
	cogyaml "github.com/grafana/cog/internal/yaml"
)

type interpolable interface {
	interpolateParameters(interpolator ParametersInterpolator)
}

type transformable interface {
	commonPasses() (compiler.Passes, error)
}

type schemaLoader interface {
	LoadSchemas(ctx context.Context) (ast.Schemas, error)
}

// InputBase provides common options and behavior, meant to be re-used across
// all input types.
type InputBase struct {
	// AllowedObjects is a list of object names that will be allowed when
	// parsing the input schema.
	// Note: if AllowedObjects is empty, no filter is applied.
	AllowedObjects []string `yaml:"allowed_objects"`

	// Transforms holds a list of paths to files containing compiler passes
	// to apply to the input.
	Transforms []string `yaml:"transformations"`

	// Metadata to add to the schema, this can be used to set Kind and Variant
	Metadata *ast.SchemaMeta `yaml:"metadata"`
}

func (input *InputBase) schemaMetadata() ast.SchemaMeta {
	if input.Metadata != nil {
		return *input.Metadata
	}

	return ast.SchemaMeta{}
}

func (input *InputBase) commonPasses() (compiler.Passes, error) {
	return cogyaml.NewCompilerLoader().PassesFrom(input.Transforms)
}

func (input *InputBase) interpolateParameters(interpolator ParametersInterpolator) {
	input.AllowedObjects = tools.Map(input.AllowedObjects, interpolator)
	input.Transforms = tools.Map(input.Transforms, interpolator)
}

func (input *InputBase) filterSchema(schema *ast.Schema) (ast.Schemas, error) {
	if len(input.AllowedObjects) == 0 {
		return ast.Schemas{schema}, nil
	}

	filterPass := compiler.FilterSchemas{
		AllowedObjects: tools.Map(input.AllowedObjects, func(objectName string) compiler.ObjectReference {
			return compiler.ObjectReference{Package: schema.Package, Object: objectName}
		}),
	}

	return filterPass.Process(ast.Schemas{schema})
}

type Input struct {
	If string `yaml:"if"`

	JSONSchema *JSONSchemaInput `yaml:"jsonschema"`
	OpenAPI    *OpenAPIInput    `yaml:"openapi"`

	KindRegistry      *KindRegistryInput `yaml:"kind_registry"`
	KindsysCore       *CueInput          `yaml:"kindsys_core"`
	KindsysComposable *CueInput          `yaml:"kindsys_composable"`
	Cue               *CueInput          `yaml:"cue"`
}

func (input *Input) InterpolateParameters(interpolator ParametersInterpolator) error {
	input.If = interpolator(input.If)

	loader, err := input.loader()
	if err != nil {
		return err
	}

	if interpolableLoader, ok := loader.(interpolable); ok {
		interpolableLoader.interpolateParameters(interpolator)
	}

	return nil
}

func (input *Input) loader() (schemaLoader, error) {
	if input.JSONSchema != nil {
		return input.JSONSchema, nil
	}
	if input.OpenAPI != nil {
		return input.OpenAPI, nil
	}
	if input.KindRegistry != nil {
		return input.KindRegistry, nil
	}
	if input.KindsysCore != nil {
		return &genericCueLoader{CueInput: input.KindsysCore, loader: kindsysCoreLoader}, nil
	}
	if input.KindsysComposable != nil {
		return &genericCueLoader{CueInput: input.KindsysComposable, loader: kindsysComposableLoader}, nil
	}
	if input.Cue != nil {
		return &genericCueLoader{CueInput: input.Cue, loader: cueLoader}, nil
	}

	return nil, fmt.Errorf("empty input")
}

func (input *Input) shouldLoadSchemas() (bool, error) {
	if input.If == "" {
		return true, nil
	}

	env := map[string]any{
		"sprintf": fmt.Sprintf,
		"semver":  semver.ParseTolerant,
	}

	program, err := expr.Compile(input.If, expr.Env(env))
	if err != nil {
		return false, err
	}

	output, err := expr.Run(program, env)
	if err != nil {
		return false, err
	}

	if _, ok := output.(bool); !ok {
		return false, fmt.Errorf("expected expression to evaluate to a boolean, got %T", output)
	}

	return output.(bool), nil
}

func (input *Input) LoadSchemas(ctx context.Context) (ast.Schemas, error) {
	var err error

	shouldLoad, err := input.shouldLoadSchemas()
	if err != nil {
		return nil, err
	}
	if !shouldLoad {
		return nil, nil
	}

	loader, err := input.loader()
	if err != nil {
		return nil, err
	}

	schemas, err := loader.LoadSchemas(ctx)
	if err != nil {
		return nil, err
	}

	if transformableLoader, ok := loader.(transformable); ok {
		passes, err := transformableLoader.commonPasses()
		if err != nil {
			return nil, err
		}

		return passes.Process(schemas)
	}

	return schemas, nil
}
