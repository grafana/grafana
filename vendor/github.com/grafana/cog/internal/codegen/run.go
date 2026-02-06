package codegen

import (
	"context"
	"fmt"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/languages"
)

func (pipeline *Pipeline) Run(ctx context.Context) (*codejen.FS, error) {
	// Here begins the code generation setup
	targetsByLanguage, err := pipeline.OutputLanguages()
	if err != nil {
		return nil, err
	}

	pipeline.reporter("Parsing inputs...")
	schemas, err := pipeline.LoadSchemas(ctx)
	if err != nil {
		return nil, err
	}

	generatedFS := codejen.NewFS()
	for language, target := range targetsByLanguage {
		pipeline.reporter(fmt.Sprintf("Running '%s' jennies...", language))

		languageOutputDir, err := pipeline.languageOutputDir(pipeline.currentDirectory, language)
		if err != nil {
			return nil, err
		}

		jenniesInput, err := pipeline.ContextForLanguage(target, schemas)
		if err != nil {
			return nil, err
		}

		// prepare the jennies
		languageJennies := target.Jennies(pipeline.jenniesConfig())
		languageJennies.AddPostprocessors(common.PathPrefixer(languageOutputDir))

		// then delegate the codegen to the jennies
		if err := runJenny(languageJennies, jenniesInput, generatedFS); err != nil {
			return nil, err
		}
	}

	if pipeline.Output.RepositoryTemplates != "" {
		repoTemplatesJenny, err := repositoryTemplatesJenny(pipeline)
		if err != nil {
			return nil, err
		}

		jennyInput := common.BuildOptions{
			Languages: targetsByLanguage.AsLanguageRefs(),
		}

		if err := runJenny(repoTemplatesJenny, jennyInput, generatedFS); err != nil {
			return nil, err
		}
	}

	return generatedFS, nil
}

func (pipeline *Pipeline) ContextForLanguage(language languages.Language, schemas ast.Schemas) (languages.Context, error) {
	var err error
	jenniesInput := languages.Context{
		Schemas: schemas,
	}

	// apply  language-specific compiler passes
	compilerPasses := language.CompilerPasses().Concat(pipeline.finalPasses())
	jenniesInput.Schemas, err = compilerPasses.Process(jenniesInput.Schemas)
	if err != nil {
		return languages.Context{}, err
	}

	if !pipeline.Output.Builders {
		return jenniesInput, nil
	}

	// from schemas, derive builders
	jenniesInput.Builders = (&ast.BuilderGenerator{}).FromAST(jenniesInput.Schemas)

	// apply veneers to builders
	veneersRewriter, err := pipeline.veneers()
	if err != nil {
		return languages.Context{}, err
	}

	jenniesInput.Builders, err = veneersRewriter.ApplyTo(jenniesInput.Schemas, jenniesInput.Builders, language.Name())
	if err != nil {
		return languages.Context{}, err
	}

	// with the veneers applied, generate "nil-checks" for assignments
	jenniesInput, err = languages.GenerateBuilderNilChecks(language, jenniesInput)
	if err != nil {
		return languages.Context{}, err
	}

	converterConfig, err := pipeline.readConverterConfig()
	if err != nil {
		return languages.Context{}, err
	}

	jenniesInput.ConverterConfig = *converterConfig

	return jenniesInput, nil
}
