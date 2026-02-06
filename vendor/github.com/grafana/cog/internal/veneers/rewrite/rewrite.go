package rewrite

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
	"github.com/grafana/cog/internal/veneers/builder"
	"github.com/grafana/cog/internal/veneers/option"
)

const AllLanguages = "all"

type Config struct {
	Debug bool
}

type LanguageRules struct {
	Language     string
	BuilderRules []builder.RewriteRule
	OptionRules  []option.RewriteRule
}

type Rewriter struct {
	config Config

	// Rules applied to `Builder` objects, grouped by language
	builderRules map[string][]builder.RewriteRule
	// Rules applied to `Option` objects, grouped by language
	optionRules map[string][]option.RewriteRule
}

func NewRewrite(languageRules []LanguageRules, config Config) *Rewriter {
	builderRules := make(map[string][]builder.RewriteRule)
	optionRules := make(map[string][]option.RewriteRule)

	for _, languageConfig := range languageRules {
		builderRules[languageConfig.Language] = append(builderRules[languageConfig.Language], languageConfig.BuilderRules...)
		optionRules[languageConfig.Language] = append(optionRules[languageConfig.Language], languageConfig.OptionRules...)
	}

	return &Rewriter{
		config:       config,
		builderRules: builderRules,
		optionRules:  optionRules,
	}
}

func (engine *Rewriter) ApplyTo(schemas ast.Schemas, builders []ast.Builder, language string) ([]ast.Builder, error) {
	var err error
	// TODO: should we deepCopy the builders instead?
	newBuilders := make([]ast.Builder, 0, len(builders))
	newBuilders = append(newBuilders, builders...)

	// start by applying veneers common to all languages, then
	// apply language-specific ones.
	for _, l := range []string{AllLanguages, language} {
		newBuilders, err = engine.applyBuilderRules(schemas, newBuilders, engine.builderRules[l])
		if err != nil {
			return nil, err
		}

		newBuilders = engine.applyOptionRules(schemas, newBuilders, engine.optionRules[l])
	}

	// and optionally, apply "debug" veneers
	if engine.config.Debug {
		newBuilders, err = engine.applyBuilderRules(schemas, newBuilders, engine.debugBuilderRules())
		if err != nil {
			return nil, err
		}

		newBuilders = engine.applyOptionRules(schemas, newBuilders, engine.debugOptionRules())
	}

	return newBuilders, nil
}

func (engine *Rewriter) applyBuilderRules(schemas ast.Schemas, builders []ast.Builder, rules []builder.RewriteRule) ([]ast.Builder, error) {
	var err error

	for _, rule := range rules {
		builders, err = rule(schemas, builders)
		if err != nil {
			return nil, err
		}
	}

	return builders, nil
}

func (engine *Rewriter) applyOptionRules(schemas ast.Schemas, builders []ast.Builder, rules []option.RewriteRule) []ast.Builder {
	for _, rule := range rules {
		for i, b := range builders {
			processedOptions := make([]ast.Option, 0, len(b.Options))

			for _, opt := range b.Options {
				if !rule.Selector(b, opt) {
					processedOptions = append(processedOptions, opt)
					continue
				}

				processedOptions = append(processedOptions, rule.Action(schemas, b, opt)...)
			}

			builders[i].Options = processedOptions
		}
	}

	return tools.Filter(builders, func(builder ast.Builder) bool {
		// "no options" means that the builder was dismissed.
		return len(builder.Options) != 0
	})
}

func (engine *Rewriter) debugBuilderRules() []builder.RewriteRule {
	return []builder.RewriteRule{
		builder.VeneerTrailAsComments(builder.EveryBuilder()),
	}
}

func (engine *Rewriter) debugOptionRules() []option.RewriteRule {
	return []option.RewriteRule{
		option.VeneerTrailAsComments(option.EveryOption()),
	}
}
