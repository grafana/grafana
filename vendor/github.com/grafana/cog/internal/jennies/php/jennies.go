package php

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

const LanguageRef = "php"

type Config struct {
	debug bool

	converters bool

	NamespaceRoot string `yaml:"namespace_root"`

	// GenerateJSONMarshaller controls the generation of `fromArray()` and
	// `jsonSerialize()` methods on types.
	GenerateJSONMarshaller bool `yaml:"generate_json_marshaller"`

	// OverridesTemplatesDirectories holds a list of directories containing templates
	// defining blocks used to override parts of builders/types/....
	OverridesTemplatesDirectories []string `yaml:"overrides_templates"`

	// ExtraFilesTemplatesDirectories holds a list of directories containing
	// templates describing files to be added to the generated output.
	ExtraFilesTemplatesDirectories []string `yaml:"extra_files_templates"`

	// ExtraFilesTemplatesData holds additional data to be injected into the
	// templates described in ExtraFilesTemplatesDirectories.
	ExtraFilesTemplatesData map[string]string `yaml:"-"`

	// BuilderFactoriesClassMap allows to choose the name of the class that
	// will be generated to hold "builder factories".
	// By default, this class name is equal to the package name in which
	// factories are defined.
	// BuilderFactoriesClassMap associates these package names with a class
	// name.
	BuilderFactoriesClassMap map[string]string `yaml:"builder_factories_class_map"`
}

func (config *Config) InterpolateParameters(interpolator func(input string) string) {
	config.NamespaceRoot = interpolator(config.NamespaceRoot)
	config.OverridesTemplatesDirectories = tools.Map(config.OverridesTemplatesDirectories, interpolator)
	config.ExtraFilesTemplatesDirectories = tools.Map(config.ExtraFilesTemplatesDirectories, interpolator)
}

func (config Config) builderFactoryClassForPackage(pkg string) string {
	if config.BuilderFactoriesClassMap != nil && config.BuilderFactoriesClassMap[pkg] != "" {
		return config.BuilderFactoriesClassMap[pkg]
	}

	return pkg
}

func (config Config) fullNamespace(typeName string) string {
	return config.NamespaceRoot + "\\" + typeName
}

func (config Config) fullNamespaceRef(typeName string) string {
	return "\\" + config.fullNamespace(typeName)
}

func (config Config) MergeWithGlobal(global languages.Config) Config {
	newConfig := config
	newConfig.debug = global.Debug
	newConfig.converters = global.Converters

	return newConfig
}

type Language struct {
	config          Config
	apiRefCollector *common.APIReferenceCollector
}

func New(config Config) *Language {
	return &Language{
		config:          config,
		apiRefCollector: common.NewAPIReferenceCollector(),
	}
}

func (language *Language) Name() string {
	return LanguageRef
}

func (language *Language) Jennies(globalConfig languages.Config) *codejen.JennyList[languages.Context] {
	config := language.config.MergeWithGlobal(globalConfig)

	tmpl := initTemplates(config, language.apiRefCollector)
	rawTypesJenny := RawTypes{config: config, tmpl: tmpl, apiRefCollector: language.apiRefCollector}

	jenny := codejen.JennyListWithNamer(func(_ languages.Context) string {
		return LanguageRef
	})
	jenny.AppendOneToMany(
		Runtime{config: config, tmpl: tmpl},
		common.If(globalConfig.Types, rawTypesJenny),
		common.If(globalConfig.Builders, &Builder{config: config, tmpl: tmpl, apiRefCollector: language.apiRefCollector}),
		common.If(globalConfig.Builders, &Factory{config: config, tmpl: tmpl, apiRefCollector: language.apiRefCollector}),
		common.If(globalConfig.Builders && globalConfig.Converters, &Converter{config: config, tmpl: tmpl, nullableConfig: language.NullableKinds()}),

		common.If(globalConfig.APIReference, common.APIReference{
			Collector: language.apiRefCollector,
			Language:  LanguageRef,
			Formatter: apiReferenceFormatter(tmpl, config),
			Tmpl:      tmpl,
		}),

		common.DynamicFiles{
			Tmpl: tmpl,
			Data: map[string]any{
				"Config": map[string]any{
					"Converters": config.converters,
				},
			},
			FuncsProvider: func(context languages.Context) template.FuncMap {
				return template.FuncMap{
					"unmarshalDisjunctionFunc": func(typeDef ast.Type) string {
						return rawTypesJenny.unmarshalDisjunctionFunc(context, typeDef.AsDisjunction())
					},
					"convertDisjunctionFunc": func(typeDef ast.Type) string {
						return rawTypesJenny.convertDisjunctionFunc(typeDef.AsDisjunction())
					},
				}
			},
		},

		common.CustomTemplates{
			TemplateDirectories: config.ExtraFilesTemplatesDirectories,
			Data: map[string]any{
				"Debug":         config.debug,
				"NamespaceRoot": config.NamespaceRoot,
			},
			ExtraData: config.ExtraFilesTemplatesData,
			TmplFuncs: formattingTemplateFuncs(),
		},
	)
	jenny.AddPostprocessors(common.GeneratedCommentHeader(globalConfig))

	return jenny
}

func (language *Language) CompilerPasses() compiler.Passes {
	return compiler.Passes{
		&compiler.AnonymousStructsToNamed{},
		&compiler.NotRequiredFieldAsNullableType{},
		&compiler.DisjunctionWithNullToOptional{},
		&compiler.DisjunctionOfConstantsToEnum{},
		&compiler.AnonymousEnumToExplicitType{},
		&compiler.SanitizeEnumMemberNames{},
		&compiler.FlattenDisjunctions{},
		&compiler.DisjunctionInferMapping{},
		&compiler.UndiscriminatedDisjunctionToAny{},
		&compiler.InlineObjectsWithTypes{
			InlineTypes: []ast.Kind{ast.KindScalar, ast.KindArray, ast.KindMap, ast.KindDisjunction},
		},
	}
}

func (language *Language) NullableKinds() languages.NullableConfig {
	return languages.NullableConfig{
		ProtectArrayAppend: true,
		AnyIsNullable:      true,
	}
}
