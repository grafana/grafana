package languages

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
)

type Language interface {
	Name() string
	Jennies(config Config) *codejen.JennyList[Context]
	CompilerPasses() compiler.Passes
}

type NullableConfig struct {
	Kinds              []ast.Kind
	ProtectArrayAppend bool
	AnyIsNullable      bool
}

type NullableKindsProvider interface {
	NullableKinds() NullableConfig
}

func (nullableConfig NullableConfig) TypeIsNullable(typeDef ast.Type) bool {
	return typeDef.Nullable ||
		(typeDef.IsAny() && nullableConfig.AnyIsNullable) ||
		typeDef.IsAnyOf(nullableConfig.Kinds...)
}

type Languages map[string]Language

func (languages Languages) AsLanguageRefs() []string {
	result := make([]string, 0, len(languages))
	for language := range languages {
		result = append(result, language)
	}
	return result
}
