package common

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

func TypeResolvingTemplateHelpers(context languages.Context) template.FuncMap {
	return template.FuncMap{
		"resolvesToScalar": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsScalar()
		},
		"resolvesToArray": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsArray()
		},
		"resolvesToMap": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsMap()
		},
		"resolvesToEnum": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsEnum()
		},
		"resolvesToStruct": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsStruct()
		},
		"resolvesToDisjunction": func(typeDef ast.Type) bool {
			return context.ResolveRefs(typeDef).IsDisjunction()
		},
		"resolvesToBuilder": context.ResolveToBuilder,
		"resolveRefs":       context.ResolveRefs,
		"resolvesToComposableSlot": func(typeDef ast.Type) bool {
			_, found := context.ResolveToComposableSlot(typeDef)
			return found
		},
	}
}

func TypesTemplateHelpers(context languages.Context) template.FuncMap {
	return template.FuncMap{
		"schemaHasObject": func(schema *ast.Schema, name string) bool {
			return schema.HasObject(name)
		},
		"objectExists": func(pkg string, name string) bool {
			_, ok := context.Schemas.LocateObject(pkg, name)
			return ok
		},
	}
}

func APIRefTemplateHelpers(apiRefCollector *APIReferenceCollector) template.FuncMap {
	return template.FuncMap{
		"apiDeclareFunction": func(data map[string]any) string {
			apiRefCollector.RegisterFunction(maybeGet[string](data, "pkg"), FunctionReference{
				Name:      maybeGet[string](data, "name"),
				Comments:  maybeGet[[]string](data, "comments"),
				Arguments: tools.Map(maybeGet[[]map[string]any](data, "arguments"), dataToArgumentRef),
				Return:    maybeGet[string](data, "return"),
			})

			return ""
		},
		"apiDeclareMethod": func(data map[string]any) string {
			apiRefCollector.ObjectMethod(maybeGet[ast.Object](data, "object"), MethodReference{
				Name:      maybeGet[string](data, "name"),
				Comments:  maybeGet[[]string](data, "comments"),
				Arguments: tools.Map(maybeGet[[]map[string]any](data, "arguments"), dataToArgumentRef),
				Return:    maybeGet[string](data, "return"),
				Static:    false,
			})

			return ""
		},
	}
}

func dataToArgumentRef(data map[string]any) ArgumentReference {
	return ArgumentReference{
		Name:     maybeGet[string](data, "name"),
		Type:     maybeGet[string](data, "type"),
		Comments: maybeGet[[]string](data, "comments"),
	}
}

func maybeGet[T any](data map[string]any, key string) T {
	var result T
	if data[key] == nil {
		return result
	}

	return data[key].(T)
}
