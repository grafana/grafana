package php

import (
	"embed"
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

//go:embed templates/builders/*.tmpl templates/converters/*.tmpl templates/runtime/*.tmpl templates/types/*.tmpl
//nolint:gochecknoglobals
var templatesFS embed.FS

func initTemplates(config Config, apiRefCollector *common.APIReferenceCollector) *template.Template {
	tmpl, err := template.New(
		"php",

		// "dummy"/unimplemented helpers, to be able to parse the templates before jennies are initialized.
		// Jennies will override these with proper dependencies.
		template.Funcs(common.TypeResolvingTemplateHelpers(languages.Context{})),
		template.Funcs(common.TypesTemplateHelpers(languages.Context{})),
		template.Funcs(common.APIRefTemplateHelpers(apiRefCollector)),
		template.Funcs(common.DynamicFilesTemplateHelpers()),

		template.Funcs(templateHelpers(templateDeps{})),
		template.Funcs(formattingTemplateFuncs()),

		// parse templates
		template.ParseFS(templatesFS, "templates"),
		template.ParseDirectories(config.OverridesTemplatesDirectories...),
	)
	if err != nil {
		panic(fmt.Errorf("could not initialize templates: %w", err))
	}

	return tmpl
}

func formattingTemplateFuncs() template.FuncMap {
	return template.FuncMap{
		"formatPath":           formatFieldPath,
		"formatPackageName":    formatPackageName,
		"formatObjectName":     formatObjectName,
		"formatOptionName":     formatOptionName,
		"formatEnumMemberName": formatEnumMemberName,
		"formatArgName":        formatArgName,
		"formatFieldName":      formatFieldName,
		"formatScalar":         formatValue,
		"formatDocsBlock":      formatCommentsBlock,
	}
}

type templateDeps struct {
	config                   Config
	context                  languages.Context
	unmarshalForType         func(typeDef ast.Type, inputVar string) string
	unmarshalDisjunctionFunc func(typeDef ast.Type) string
	convertDisjunctionFunc   func(typeDef ast.Type) string
}

func templateHelpers(deps templateDeps) template.FuncMap {
	typesFormatter := builderTypeFormatter(deps.config, deps.context)
	hinter := &typehints{config: deps.config, context: deps.context, resolveBuilders: false}
	shaper := &shape{context: deps.context}

	funcs := template.FuncMap{
		"fullNamespace":           deps.config.fullNamespace,
		"fullNamespaceRef":        deps.config.fullNamespaceRef,
		"typeHasBuilder":          deps.context.ResolveToBuilder,
		"isDisjunctionOfBuilders": deps.context.IsDisjunctionOfBuilders,

		"formatType": typesFormatter.formatType,
		"formatRawType": func(def ast.Type) string {
			return typesFormatter.doFormatType(def, false)
		},
		"formatRawRef": func(pkg string, ref string) string {
			return typesFormatter.formatRef(ast.NewRef(pkg, ref), false)
		},
		"formatRawTypeNotNullable": func(def ast.Type) string {
			typeDef := def.DeepCopy()
			typeDef.Nullable = false

			return typesFormatter.doFormatType(typeDef, false)
		},
		"formatValue": func(destinationType ast.Type, value any) string {
			if destinationType.IsRef() {
				referredObj, found := deps.context.LocateObjectByRef(destinationType.AsRef())
				if found && referredObj.Type.IsEnum() {
					return typesFormatter.formatEnumValue(referredObj, value)
				}
			}

			if destinationType.IsScalar() && (destinationType.Scalar.ScalarKind == ast.KindFloat32 || destinationType.Scalar.ScalarKind == ast.KindFloat64) {
				return fmt.Sprintf("(float) %s", formatValue(value))
			}

			return formatValue(value)
		},

		"typeHint": func(def ast.Type) string {
			clone := def.DeepCopy()
			clone.Nullable = false

			return hinter.forType(clone, false)
		},
		"typeShape": shaper.typeShape,
		"defaultForType": func(typeDef ast.Type) string {
			return formatValue(defaultValueForType(deps.config, deps.context.Schemas, typeDef, nil))
		},
		"disjunctionCaseForType": func(input string, typeDef ast.Type) string {
			return disjunctionCaseForType(typesFormatter, input, typeDef)
		},

		"factoryClassForPkg": func(pkg string) string {
			return deps.config.builderFactoryClassForPackage(pkg)
		},

		"unmarshalForType":         deps.unmarshalForType,
		"unmarshalDisjunctionFunc": deps.unmarshalDisjunctionFunc,
		"convertDisjunctionFunc":   deps.convertDisjunctionFunc,
	}

	return funcs.MergeWith(common.TypeResolvingTemplateHelpers(deps.context))
}
