package cog

import (
	"context"
	"fmt"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/codegen"
	"github.com/grafana/cog/internal/jennies/golang"
	"github.com/grafana/cog/internal/jennies/openapi"
	"github.com/grafana/cog/internal/jennies/typescript"
	"github.com/grafana/cog/internal/simplecue"
)

// SchemaToTypesPipeline represents a simplified codegen.Pipeline, meant to
// take a single input schema and generates types for it in a single output
// language.
type SchemaToTypesPipeline struct {
	debug       bool
	input       *codegen.Input
	finalPasses compiler.Passes
	output      *codegen.OutputLanguage
}

// TypesFromSchema generates types from a single input schema and a single
// output language.
func TypesFromSchema() *SchemaToTypesPipeline {
	return &SchemaToTypesPipeline{}
}

// Debug controls whether debug mode is enabled or not.
// When enabled, more information is included in the generated output,
// such as an audit trail of applied transformations.
func (pipeline *SchemaToTypesPipeline) Debug(enabled bool) *SchemaToTypesPipeline {
	pipeline.debug = enabled
	return pipeline
}

// Run executes the codegen pipeline and returns the files generated as a result.
func (pipeline *SchemaToTypesPipeline) Run(ctx context.Context) (codejen.Files, error) {
	// At least a tiny bit of validation
	if pipeline.input == nil {
		return nil, fmt.Errorf("no input configured")
	}
	if pipeline.output == nil {
		return nil, fmt.Errorf("no output configured")
	}

	codegenPipeline, err := codegen.NewPipeline()
	if err != nil {
		return nil, err
	}

	codegenPipeline.Inputs = []*codegen.Input{pipeline.input}
	codegenPipeline.Transforms = codegen.Transforms{
		FinalPasses: pipeline.finalPasses,
	}
	codegenPipeline.Output = codegen.Output{
		Types:     true,
		Languages: []*codegen.OutputLanguage{pipeline.output},
	}

	generatedFS, err := codegenPipeline.Run(ctx)
	if err != nil {
		return nil, err
	}

	return generatedFS.AsFiles(), nil
}

/**********
 * Inputs *
 **********/

type CUEOption func(*codegen.CueInput)

// ForceEnvelope decorates the parsed cue Value with an envelope whose
// name is given. This is useful for dataqueries for example, where the
// schema doesn't define any suitable top-level object.
func ForceEnvelope(envelopeName string) CUEOption {
	return func(input *codegen.CueInput) {
		input.ForcedEnvelope = envelopeName
	}
}

// NameFunc specifies the naming strategy used for objects and references.
// It is called with the value passed to the top level method or function and
// the path to the entity being parsed.
func NameFunc(nameFunc simplecue.NameFunc) CUEOption {
	return func(input *codegen.CueInput) {
		input.NameFunc = nameFunc
	}
}

// CUEImports allows referencing additional libraries/modules.
func CUEImports(importsMap map[string]string) CUEOption {
	return func(input *codegen.CueInput) {
		for importPkg, pkgPath := range importsMap {
			input.CueImports = append(input.CueImports, fmt.Sprintf("%s:%s", pkgPath, importPkg))
		}
	}
}

// PreserveExternalReferences disables the inlining of external references.
// This should be used in conjunction with "imports maps" on output languages
// to properly handle external references.
func PreserveExternalReferences() CUEOption {
	return func(input *codegen.CueInput) {
		input.InlineExternalReference = false
	}
}

// CUEModule sets the pipeline's input to the given cue module.
func (pipeline *SchemaToTypesPipeline) CUEModule(modulePath string, opts ...CUEOption) *SchemaToTypesPipeline {
	cueInput := &codegen.CueInput{
		Entrypoint: modulePath,
		// this simplified pipeline is meant to produce a self-sufficient output,
		// so inlining external references by default makes sense.
		InlineExternalReference: true,
	}

	for _, opt := range opts {
		opt(cueInput)
	}

	pipeline.input = &codegen.Input{Cue: cueInput}

	return pipeline
}

// CUEValue sets the pipeline's input to the given cue value.
func (pipeline *SchemaToTypesPipeline) CUEValue(pkgName string, value cue.Value, opts ...CUEOption) *SchemaToTypesPipeline {
	cueInput := &codegen.CueInput{
		Package: pkgName,
		Value:   &value,
		// this simplified pipeline is meant to produce a self-sufficient output,
		// so inlining external references by default makes sense.
		InlineExternalReference: true,
	}

	for _, opt := range opts {
		opt(cueInput)
	}

	pipeline.input = &codegen.Input{Cue: cueInput}

	return pipeline
}

/*******************
 * Transformations *
 *******************/

// AppendCommentToObjects adds the given comment to every object definition.
func AppendCommentToObjects(comment string) compiler.Pass {
	return &compiler.AppendCommentObjects{
		Comment: comment,
	}
}

// PrefixObjectsNames adds the given prefix to every object's name.
func PrefixObjectsNames(prefix string) compiler.Pass {
	return &compiler.PrefixObjectNames{
		Prefix: prefix,
	}
}

// SchemaTransformations adds the given transformations to the set of
// transformations that will be applied to the input schema.
func (pipeline *SchemaToTypesPipeline) SchemaTransformations(passes ...compiler.Pass) *SchemaToTypesPipeline {
	pipeline.finalPasses = append(pipeline.finalPasses, passes...)

	return pipeline
}

/***********
 * Outputs *
 ***********/

// GoConfig defines a set of configuration options specific to Go outputs.
type GoConfig struct {
	// GenerateEqual controls the generation of `Equal()` methods on types.
	GenerateEqual bool

	// AnyAsInterface instructs cog to emit `interface{}` instead of `any`.
	AnyAsInterface bool

	// CustomTemplates accepts a list of directories where are the custom templates
	CustomTemplatesDirectories []string
}

// Golang sets the output to Golang types.
func (pipeline *SchemaToTypesPipeline) Golang(config GoConfig) *SchemaToTypesPipeline {
	pipeline.output = &codegen.OutputLanguage{
		Go: &golang.Config{
			SkipRuntime:                   true,
			GenerateJSONMarshaller:        true,
			OverridesTemplatesDirectories: config.CustomTemplatesDirectories,

			GenerateEqual:  config.GenerateEqual,
			AnyAsInterface: config.AnyAsInterface,
		},
	}
	return pipeline
}

// TypescriptConfig defines a set of configuration options specific to Go outputs.
type TypescriptConfig struct {
	// ImportsMap associates package names to their import path.
	ImportsMap map[string]string

	// EnumsAsUnionTypes generates enums as a union of values instead of using
	// an actual `enum` declaration.
	// If EnumsAsUnionTypes is false, an enum will be generated as:
	// ```ts
	// enum Direction {
	//   Up = "up",
	//   Down = "down",
	//   Left = "left",
	//   Right = "right",
	// }
	// ```
	// If EnumsAsUnionTypes is true, the same enum will be generated as:
	// ```ts
	// type Direction = "up" | "down" | "left" | "right";
	// ```
	EnumsAsUnionTypes bool `yaml:"enums_as_union_types"`

	// CustomTemplates accepts a list of directories where are the custom templates
	CustomTemplatesDirectories []string
}

// Typescript sets the output to Typescript types.
func (pipeline *SchemaToTypesPipeline) Typescript(config TypescriptConfig) *SchemaToTypesPipeline {
	pipeline.output = &codegen.OutputLanguage{
		Typescript: &typescript.Config{
			SkipRuntime:                   true,
			SkipIndex:                     true,
			PackagesImportMap:             config.ImportsMap,
			EnumsAsUnionTypes:             config.EnumsAsUnionTypes,
			OverridesTemplatesDirectories: config.CustomTemplatesDirectories,
		},
	}
	return pipeline
}

// OpenAPIGenerationConfig defines a set of configuration options specific to OpenAPI outputs.
type OpenAPIGenerationConfig struct {
	// Compact controls whether the generated JSON should be pretty printed or
	// not.
	Compact bool `yaml:"compact"`
}

// GenerateOpenAPI sets the output to OpenAPI types.
func (pipeline *SchemaToTypesPipeline) GenerateOpenAPI(config OpenAPIGenerationConfig) *SchemaToTypesPipeline {
	pipeline.output = &codegen.OutputLanguage{
		OpenAPI: &openapi.Config{
			Compact: config.Compact,
		},
	}
	return pipeline
}
