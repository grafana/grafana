package openapi

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/languages"
)

const LanguageRef = "openapi"

type Config struct {
	debug bool

	// Compact controls whether the generated JSON should be pretty printed or
	// not.
	Compact bool `yaml:"compact"`
}

func (config Config) MergeWithGlobal(global languages.Config) Config {
	newConfig := config
	newConfig.debug = global.Debug

	return newConfig
}

type Language struct {
	config Config
}

func New(config Config) *Language {
	return &Language{
		config: config,
	}
}

func (language *Language) Name() string {
	return LanguageRef
}

func (language *Language) Jennies(globalConfig languages.Config) *codejen.JennyList[languages.Context] {
	config := language.config.MergeWithGlobal(globalConfig)
	jenny := codejen.JennyListWithNamer[languages.Context](func(_ languages.Context) string {
		return LanguageRef
	})

	jenny.AppendOneToMany(Schema{Config: config})

	return jenny
}

func (language *Language) CompilerPasses() compiler.Passes {
	return compiler.Passes{
		// should be a superset of the compiler passes defined for jsonschema jennies
		&compiler.DisjunctionWithNullToOptional{},
		&compiler.InferEntrypoint{},
	}
}
