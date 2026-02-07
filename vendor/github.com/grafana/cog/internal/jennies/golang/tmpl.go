package golang

import (
	"embed"
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

//go:embed templates/runtime/*.tmpl templates/builders/*.tmpl templates/converters/*.tmpl templates/types/*.tmpl
//nolint:gochecknoglobals
var templatesFS embed.FS

func initTemplates(config Config, apiRefCollector *common.APIReferenceCollector) *template.Template {
	tmpl, err := template.New(
		"golang",

		// placeholder functions, will be overridden by jennies
		template.Funcs(common.TypeResolvingTemplateHelpers(languages.Context{})),
		template.Funcs(common.TypesTemplateHelpers(languages.Context{})),
		template.Funcs(common.APIRefTemplateHelpers(apiRefCollector)),
		template.Funcs(formattingTemplateFuncs(config)),
		template.Funcs(template.FuncMap{
			"formatPath": func(_ ast.Path) string {
				panic("formatPath() needs to be overridden by a jenny")
			},
			"formatPathForRange": func(_ ast.Path) string {
				panic("formatPathForRange() needs to be overridden by a jenny")
			},
			"formatType": func(_ ast.Type) string {
				panic("formatType() needs to be overridden by a jenny")
			},
			"formatTypeNoBuilder": func(_ ast.Type) string {
				panic("formatType() needs to be overridden by a jenny")
			},
			"formatRawRef": func(_ ast.Type) string {
				panic("formatRawRef() needs to be overridden by a jenny")
			},
			"importStdPkg": func(_ string) string {
				panic("importStdPkg() needs to be overridden by a jenny")
			},
			"importPkg": func(_ string) string {
				panic("importPkg() needs to be overridden by a jenny")
			},
			"emptyValueForGuard": func(_ ast.Type) string {
				panic("emptyValueForGuard() needs to be overridden by a jenny")
			},
			"typeHasBuilder": func(_ ast.Type) bool {
				panic("typeHasBuilder() needs to be overridden by a jenny")
			},
			"typeHasEqualityFunc": func(_ ast.Type) bool {
				panic("typeHasEqualityFunc() needs to be overridden by a jenny")
			},
			"resolvesToArrayOfScalars": func(typeDef ast.Type) bool {
				panic("resolvesToArrayOfScalars() needs to be overridden by a jenny")
			},
			"resolvesToMapOfScalars": func(typeDef ast.Type) bool {
				panic("resolvesToMapOfScalars() needs to be overridden by a jenny")
			},
			"resolvesToConstraints": func(_ ast.Type) string {
				panic("resolvesToConstraints() needs to be overridden by a jenny")
			},
			"formatValue": func(destinationType ast.Type, value any) string {
				panic("formatValue() needs to be overridden by a jenny")
			},
		}),
		template.Funcs(template.FuncMap{
			"maybeAsPointer": func(intoType ast.Type, variableName string) string {
				if intoType.Nullable && !intoType.IsAnyOf(ast.KindArray, ast.KindMap, ast.KindComposableSlot) {
					return "&" + variableName
				}

				return variableName
			},
			"maybeDereference": func(typeDef ast.Type) string {
				if typeDef.Nullable && !typeDef.IsAnyOf(ast.KindArray, ast.KindMap, ast.KindComposableSlot) {
					return "*"
				}

				return ""
			},
			"isNullableNonArray": func(typeDef ast.Type) bool {
				return typeDef.Nullable && !typeDef.IsArray()
			},
		}),

		// parse templates
		template.ParseFS(templatesFS, "templates"),
		template.ParseDirectories(config.OverridesTemplatesDirectories...),
	)
	if err != nil {
		panic(fmt.Errorf("could not initialize templates: %w", err))
	}

	return tmpl
}

func formattingTemplateFuncs(config Config) template.FuncMap {
	return template.FuncMap{
		"formatPackageName":  formatPackageName,
		"formatObjectName":   formatObjectName,
		"formatFieldName":    formatFieldName,
		"formatArgName":      formatArgName,
		"formatVarName":      formatVarName,
		"formatFunctionName": formatFunctionName,
		"formatScalar":       formatScalar,
		"formatAny": func() string {
			if config.AnyAsInterface {
				return "interface{}"
			}

			return "any"
		},
	}
}
