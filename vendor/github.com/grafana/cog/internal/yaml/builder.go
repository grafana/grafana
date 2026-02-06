package yaml

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
	"github.com/grafana/cog/internal/veneers"
	"github.com/grafana/cog/internal/veneers/builder"
)

/******************************************************************************
 * Rules
 *****************************************************************************/

type BuilderRule struct {
	Omit                     *BuilderSelector          `yaml:"omit"`
	Rename                   *RenameBuilder            `yaml:"rename"`
	MergeInto                *MergeInto                `yaml:"merge_into"`
	ComposeBuilders          *ComposeBuilders          `yaml:"compose"`
	Properties               *Properties               `yaml:"properties"`
	Duplicate                *Duplicate                `yaml:"duplicate"`
	Initialize               *Initialize               `yaml:"initialize"`
	PromoteOptsToConstructor *PromoteOptsToConstructor `yaml:"promote_options_to_constructor"`
	AddOption                *AddOption                `yaml:"add_option"`
	AddFactory               *AddFactory               `yaml:"add_factory"`
}

func (rule BuilderRule) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	if rule.Omit != nil {
		selector, err := rule.Omit.AsSelector(pkg)
		if err != nil {
			return nil, err
		}

		return builder.Omit(selector), nil
	}

	if rule.Rename != nil {
		return rule.Rename.AsRewriteRule(pkg)
	}

	if rule.MergeInto != nil {
		return rule.MergeInto.AsRewriteRule(pkg)
	}

	if rule.ComposeBuilders != nil {
		return rule.ComposeBuilders.AsRewriteRule(pkg)
	}

	if rule.Properties != nil {
		return rule.Properties.AsRewriteRule(pkg)
	}

	if rule.Duplicate != nil {
		return rule.Duplicate.AsRewriteRule(pkg)
	}

	if rule.Initialize != nil {
		return rule.Initialize.AsRewriteRule(pkg)
	}

	if rule.PromoteOptsToConstructor != nil {
		return rule.PromoteOptsToConstructor.AsRewriteRule(pkg)
	}

	if rule.AddOption != nil {
		return rule.AddOption.AsRewriteRule(pkg)
	}

	if rule.AddFactory != nil {
		return rule.AddFactory.AsRewriteRule(pkg)
	}

	return nil, fmt.Errorf("empty rule")
}

type RenameBuilder struct {
	BuilderSelector `yaml:",inline"`

	As string `yaml:"as"`
}

func (rule RenameBuilder) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.Rename(selector, rule.As), nil
}

type MergeInto struct {
	Destination    string            `yaml:"destination"`
	Source         string            `yaml:"source"`
	UnderPath      string            `yaml:"under_path"`
	ExcludeOptions []string          `yaml:"exclude_options"`
	RenameOptions  map[string]string `yaml:"rename_options"`
}

func (rule MergeInto) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	return builder.MergeInto(
		builder.ByName(pkg, rule.Destination),
		rule.Source,
		rule.UnderPath,
		rule.ExcludeOptions,
		rule.RenameOptions,
	), nil
}

type ComposeBuilders struct {
	BuilderSelector `yaml:",inline"`

	SourceBuilderName        string            `yaml:"source_builder_name"`
	PluginDiscriminatorField string            `yaml:"plugin_discriminator_field"`
	ExcludeOptions           []string          `yaml:"exclude_options"`
	CompositionMap           map[string]string `yaml:"composition_map"`
	ComposedBuilderName      string            `yaml:"composed_builder_name"`
	PreserveOriginalBuilders bool              `yaml:"preserve_original_builders"`
	RenameOptions            map[string]string `yaml:"rename_options"`
}

func (rule ComposeBuilders) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.ComposeBuilders(
		selector,
		builder.CompositionConfig{
			SourceBuilderName:        rule.SourceBuilderName,
			PluginDiscriminatorField: rule.PluginDiscriminatorField,
			ExcludeOptions:           rule.ExcludeOptions,
			CompositionMap:           rule.CompositionMap,
			ComposedBuilderName:      rule.ComposedBuilderName,
			PreserveOriginalBuilders: rule.PreserveOriginalBuilders,
			RenameOptions:            rule.RenameOptions,
		},
	), nil
}

type Properties struct {
	BuilderSelector `yaml:",inline"`
	Set             []ast.StructField `yaml:"set"`
}

func (rule Properties) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.Properties(
		selector,
		rule.Set,
	), nil
}

type Duplicate struct {
	BuilderSelector `yaml:",inline"`
	As              string   `yaml:"as"`
	ExcludeOptions  []string `yaml:"exclude_options"`
}

func (rule Duplicate) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.Duplicate(
		selector,
		rule.As,
		rule.ExcludeOptions,
	), nil
}

type Initialization struct {
	Property string `yaml:"property"`
	Value    any    `yaml:"value"`
}

type Initialize struct {
	BuilderSelector `yaml:",inline"`
	Set             []Initialization `yaml:"set"`
}

func (rule Initialize) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.Initialize(
		selector,
		tools.Map(rule.Set, func(init Initialization) builder.Initialization {
			return builder.Initialization{PropertyPath: init.Property, Value: init.Value}
		}),
	), nil
}

type PromoteOptsToConstructor struct {
	BuilderSelector `yaml:",inline"`
	Options         []string `yaml:"options"`
}

func (rule PromoteOptsToConstructor) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.PromoteOptionsToConstructor(selector, rule.Options), nil
}

type AddOption struct {
	BuilderSelector `yaml:",inline"`
	Option          veneers.Option `yaml:"option"`
}

func (rule AddOption) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.AddOption(selector, rule.Option), nil
}

type AddFactory struct {
	BuilderSelector `yaml:",inline"`
	Factory         ast.BuilderFactory `yaml:"factory"`
}

func (rule AddFactory) AsRewriteRule(pkg string) (builder.RewriteRule, error) {
	selector, err := rule.AsSelector(pkg)
	if err != nil {
		return nil, err
	}

	return builder.AddFactory(selector, rule.Factory), nil
}

/******************************************************************************
 * Selectors
 *****************************************************************************/

type BuilderSelector struct {
	ByObject *string `yaml:"by_object"`
	ByName   *string `yaml:"by_name"`

	ByVariant *string `yaml:"by_variant"`

	GeneratedFromDisjunction *bool `yaml:"generated_from_disjunction"` // noop?
}

func (selector BuilderSelector) AsSelector(pkg string) (builder.Selector, error) {
	if selector.ByObject != nil {
		return builder.ByObjectName(pkg, *selector.ByObject), nil
	}

	if selector.ByName != nil {
		return builder.ByName(pkg, *selector.ByName), nil
	}

	if selector.ByVariant != nil {
		return builder.ByVariant(ast.SchemaVariant(*selector.ByVariant)), nil
	}

	if selector.GeneratedFromDisjunction != nil {
		return builder.StructGeneratedFromDisjunction(), nil
	}

	return nil, fmt.Errorf("empty selector")
}
