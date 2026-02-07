package typescript

import (
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

const LanguageRef = "typescript"

type Config struct {
	// PathPrefix holds an optional prefix for all Typescript file paths generated.
	// If left undefined, `src` is used as a default prefix.
	PathPrefix *string `yaml:"path_prefix"`

	// SkipRuntime disables runtime-related code generation when enabled.
	// Note: builders can NOT be generated with this flag turned on, as they
	// rely on the runtime to function.
	SkipRuntime bool `yaml:"skip_runtime"`

	// SkipIndex disables the generation of `index.ts` files.
	SkipIndex bool `yaml:"skip_index"`

	// OverridesTemplatesDirectories holds a list of directories containing templates
	// defining blocks used to override parts of builders/types/....
	OverridesTemplatesDirectories []string `yaml:"overrides_templates"`

	// ExtraFilesTemplatesDirectories holds a list of directories containing
	// templates describing files to be added to the generated output.
	ExtraFilesTemplatesDirectories []string `yaml:"extra_files_templates"`

	// ExtraFilesTemplatesData holds additional data to be injected into the
	// templates described in ExtraFilesTemplatesDirectories.
	ExtraFilesTemplatesData map[string]string `yaml:"-"`

	// PackagesImportMap associates package names to their import path.
	PackagesImportMap map[string]string `yaml:"packages_import_map"`

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
}

func (config *Config) InterpolateParameters(interpolator func(input string) string) {
	if config.PathPrefix != nil {
		config.PathPrefix = tools.ToPtr(interpolator(*config.PathPrefix))
	}
	config.OverridesTemplatesDirectories = tools.Map(config.OverridesTemplatesDirectories, interpolator)
	config.ExtraFilesTemplatesDirectories = tools.Map(config.ExtraFilesTemplatesDirectories, interpolator)
	for pkg, importPath := range config.PackagesImportMap {
		config.PackagesImportMap[pkg] = interpolator(importPath)
	}
}

func (config *Config) enumFormatter(packageMapper packageMapper) enumFormatter {
	if config.EnumsAsUnionTypes {
		return &enumAsDisjunctionFormatter{}
	}

	return &enumAsTypeFormatter{packageMapper: packageMapper}
}

func (config *Config) pathWithPrefix(pathParts ...string) string {
	return filepath.Join(append([]string{*config.PathPrefix}, pathParts...)...)
}

func (config *Config) applyDefaults() {
	if config.PathPrefix == nil {
		config.PathPrefix = tools.ToPtr("src")
	}
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
	language.config.applyDefaults()

	tmpl := initTemplates(language.config, language.apiRefCollector)

	jenny := codejen.JennyListWithNamer[languages.Context](func(_ languages.Context) string {
		return LanguageRef
	})
	jenny.AppendOneToMany(
		common.If[languages.Context](!language.config.SkipRuntime, Runtime{config: language.config}),

		common.If[languages.Context](globalConfig.Types, RawTypes{config: language.config, tmpl: tmpl}),
		common.If[languages.Context](!language.config.SkipRuntime && globalConfig.Builders, &Builder{
			config:          language.config,
			tmpl:            tmpl,
			apiRefCollector: language.apiRefCollector,
		}),

		common.If[languages.Context](!language.config.SkipIndex, Index{config: language.config, Targets: globalConfig}),

		common.If[languages.Context](globalConfig.APIReference, common.APIReference{
			Collector: language.apiRefCollector,
			Language:  LanguageRef,
			Formatter: apiReferenceFormatter(language.config),
			Tmpl:      tmpl,
		}),

		common.CustomTemplates{
			TemplateDirectories: language.config.ExtraFilesTemplatesDirectories,
			Data: map[string]any{
				"Debug": globalConfig.Debug,
			},
			ExtraData: language.config.ExtraFilesTemplatesData,
		},
	)
	jenny.AddPostprocessors(common.GeneratedCommentHeader(globalConfig))

	return jenny
}

func (language *Language) CompilerPasses() compiler.Passes {
	return compiler.Passes{
		&compiler.RenameNumericEnumValues{},
	}
}

func (language *Language) NullableKinds() languages.NullableConfig {
	return languages.NullableConfig{
		Kinds:              []ast.Kind{ast.KindMap, ast.KindArray, ast.KindRef, ast.KindStruct},
		ProtectArrayAppend: true,
		AnyIsNullable:      true,
	}
}
