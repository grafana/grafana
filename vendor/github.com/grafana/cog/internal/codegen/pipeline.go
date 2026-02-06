package codegen

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/jennies/golang"
	"github.com/grafana/cog/internal/jennies/java"
	"github.com/grafana/cog/internal/jennies/jsonschema"
	"github.com/grafana/cog/internal/jennies/openapi"
	"github.com/grafana/cog/internal/jennies/php"
	"github.com/grafana/cog/internal/jennies/python"
	"github.com/grafana/cog/internal/jennies/typescript"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/veneers/rewrite"
	cogyaml "github.com/grafana/cog/internal/yaml"
	"gopkg.in/yaml.v3"
)

type ParametersInterpolator func(input string) string

type ProgressReporter func(msg string)

type PipelineOption func(pipeline *Pipeline)

func PipelineFromFile(file string, opts ...PipelineOption) (*Pipeline, error) {
	var err error
	if !filepath.IsAbs(file) {
		file, err = filepath.Abs(file)
		if err != nil {
			return nil, err
		}
	}

	currentDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}

	fileHandle, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer func() { _ = fileHandle.Close() }()

	decoder := yaml.NewDecoder(fileHandle)
	decoder.KnownFields(true)

	pipeline, err := NewPipeline()
	if err != nil {
		return nil, err
	}
	pipeline.Parameters = map[string]string{
		"__config_dir":  filepath.Dir(file),
		"__current_dir": currentDir,
	}
	if err := decoder.Decode(pipeline); err != nil {
		return nil, err
	}

	for _, opt := range opts {
		opt(pipeline)
	}

	return pipeline, nil
}

type Pipeline struct {
	Debug bool `yaml:"debug"`

	Inputs     []*Input   `yaml:"inputs"`
	Transforms Transforms `yaml:"transformations"`
	Output     Output     `yaml:"output"`

	Parameters map[string]string `yaml:"parameters"`

	currentDirectory string
	reporter         ProgressReporter
	veneersRewriter  *rewrite.Rewriter
	converterConfig  *languages.ConverterConfig
}

func NewPipeline() (*Pipeline, error) {
	currentDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}

	return &Pipeline{
		reporter:         func(msg string) {},
		currentDirectory: currentDir,
		Parameters: map[string]string{
			"__config_dir":  currentDir,
			"__current_dir": currentDir,
		},
	}, nil
}

func (pipeline *Pipeline) interpolateParameters() {
	for _, input := range pipeline.Inputs {
		// An error can only happen with the input isn't descriptive.
		// This case should have already been handled before
		// interpolateParameters() is called.
		_ = input.InterpolateParameters(pipeline.interpolate)
	}

	pipeline.Transforms.interpolateParameters(pipeline.interpolate)
	pipeline.Output.interpolateParameters(pipeline.interpolate)
}

func (pipeline *Pipeline) interpolate(input string) string {
	interpolated := input

	for key, value := range pipeline.Parameters {
		interpolated = strings.ReplaceAll(interpolated, "%"+key+"%", value)
	}

	return interpolated
}

func (pipeline *Pipeline) jenniesConfig() languages.Config {
	return languages.Config{
		Debug:        pipeline.Debug,
		Types:        pipeline.Output.Types,
		Builders:     pipeline.Output.Builders,
		Converters:   pipeline.Output.Converters,
		APIReference: pipeline.Output.APIReference,
	}
}

func (pipeline *Pipeline) commonPasses() (compiler.Passes, error) {
	if pipeline.Transforms.CommonPasses != nil {
		return pipeline.Transforms.CommonPasses, nil
	}

	return cogyaml.NewCompilerLoader().PassesFrom(pipeline.Transforms.CommonPassesFiles)
}

func (pipeline *Pipeline) finalPasses() compiler.Passes {
	return pipeline.Transforms.FinalPasses
}

func (pipeline *Pipeline) veneers() (*rewrite.Rewriter, error) {
	if pipeline.veneersRewriter != nil {
		return pipeline.veneersRewriter, nil
	}

	var veneerFiles []string
	for _, dir := range pipeline.Transforms.VeneersDirectories {
		globPattern := filepath.Join(dir, "*.yaml")
		matches, err := filepath.Glob(globPattern)
		if err != nil {
			return nil, err
		}

		veneerFiles = append(veneerFiles, matches...)
	}

	rewriter, err := cogyaml.NewVeneersLoader().RewriterFrom(veneerFiles, rewrite.Config{
		Debug: pipeline.Debug,
	})
	if err != nil {
		return nil, err
	}

	pipeline.veneersRewriter = rewriter

	return pipeline.veneersRewriter, nil
}

func (pipeline *Pipeline) readConverterConfig() (*languages.ConverterConfig, error) {
	if pipeline.converterConfig != nil {
		return pipeline.converterConfig, nil
	}

	cfg, err := cogyaml.NewConverterConfigReader().ReadConverterConfig(pipeline.Transforms.ConverterConfig)
	if err != nil {
		return nil, err
	}

	runtimeConfig := make([]languages.RuntimeConfig, len(cfg.Runtime))
	for i, rm := range cfg.Runtime {
		runtimeConfig[i] = languages.RuntimeConfig{
			Package:            rm.Package,
			Name:               rm.Name,
			NameFunc:           rm.NameFunc,
			DiscriminatorField: rm.DiscriminatorField,
		}
	}

	pipeline.converterConfig = &languages.ConverterConfig{
		RuntimeConfig: runtimeConfig,
	}
	return pipeline.converterConfig, err
}

func (pipeline *Pipeline) outputDir(relativeToDir string) (string, error) {
	if !filepath.IsAbs(pipeline.Output.Directory) {
		return pipeline.Output.Directory, nil
	}

	return filepath.Rel(relativeToDir, pipeline.Output.Directory)
}

func (pipeline *Pipeline) languageOutputDir(relativeToDir string, language string) (string, error) {
	outputDir, err := pipeline.outputDir(relativeToDir)
	if err != nil {
		return "", err
	}

	return strings.ReplaceAll(outputDir, "%l", language), nil
}

// LoadSchemas parses the schemas described by the pipeline and  applies common
// // transformations.
// Note: input-specific transformations are applied.
func (pipeline *Pipeline) LoadSchemas(ctx context.Context) (ast.Schemas, error) {
	var allSchemas ast.Schemas
	var err error

	// Parse inputs
	for _, input := range pipeline.Inputs {
		schemas, err := input.LoadSchemas(ctx)
		if err != nil {
			return nil, err
		}

		allSchemas = append(allSchemas, schemas...)
	}

	if allSchemas == nil {
		return nil, nil
	}

	allSchemas, err = allSchemas.Consolidate()
	if err != nil {
		return nil, err
	}

	// Apply common and final compiler passes
	commonPasses, err := pipeline.commonPasses()
	if err != nil {
		return nil, err
	}

	return commonPasses.Process(allSchemas)
}

func (pipeline *Pipeline) OutputLanguages() (languages.Languages, error) {
	outputs := make(languages.Languages)

	for _, output := range pipeline.Output.Languages {
		switch {
		case output.Go != nil:
			outputs[golang.LanguageRef] = golang.New(*output.Go)
		case output.Java != nil:
			outputs[java.LanguageRef] = java.New(*output.Java)
		case output.JSONSchema != nil:
			outputs[jsonschema.LanguageRef] = jsonschema.New(*output.JSONSchema)
		case output.OpenAPI != nil:
			outputs[openapi.LanguageRef] = openapi.New(*output.OpenAPI)
		case output.PHP != nil:
			outputs[php.LanguageRef] = php.New(*output.PHP)
		case output.Python != nil:
			outputs[python.LanguageRef] = python.New(*output.Python)
		case output.Typescript != nil:
			outputs[typescript.LanguageRef] = typescript.New(*output.Typescript)
		default:
			return nil, fmt.Errorf("empty language configuration")
		}
	}

	return outputs, nil
}
