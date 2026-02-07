package languages

import (
	"sort"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

//nolint:musttag
type Context struct {
	Schemas         ast.Schemas
	Builders        ast.Builders
	ConverterConfig ConverterConfig
}

func (context *Context) LocateObject(pkg string, name string) (ast.Object, bool) {
	return context.Schemas.LocateObject(pkg, name)
}

func (context *Context) LocateObjectByRef(ref ast.RefType) (ast.Object, bool) {
	return context.Schemas.LocateObjectByRef(ref)
}

func (context *Context) ResolveToBuilder(def ast.Type) bool {
	if def.IsArray() {
		return context.ResolveToBuilder(def.AsArray().ValueType)
	}

	if def.IsMap() {
		return context.ResolveToBuilder(def.AsMap().ValueType)
	}

	if def.IsDisjunction() {
		for _, branch := range def.AsDisjunction().Branches {
			if found := context.ResolveToBuilder(branch); found {
				return true
			}
		}

		return false
	}

	if !def.IsRef() {
		return false
	}

	resolvedRef := context.ResolveRefs(def)
	if resolvedRef.IsDisjunction() {
		return context.ResolveToBuilder(resolvedRef)
	}

	return len(context.Builders.LocateAllByRef(def.AsRef())) != 0
}

func (context *Context) IsDisjunctionOfBuilders(def ast.Type) bool {
	if !def.IsDisjunction() {
		return false
	}

	for _, branch := range def.AsDisjunction().Branches {
		if !context.ResolveToBuilder(branch) {
			return false
		}
	}

	return true
}

func (context *Context) IsArrayOfKinds(def ast.Type, kinds ...ast.Kind) bool {
	def = context.ResolveRefs(def)
	if !def.IsArray() {
		return false
	}

	valueType := context.ResolveRefs(def.AsArray().ValueType)
	if valueType.IsArray() {
		return context.IsArrayOfKinds(valueType, kinds...)
	}

	return valueType.IsAnyOf(kinds...)
}

func (context *Context) IsMapOfKinds(def ast.Type, kinds ...ast.Kind) bool {
	def = context.ResolveRefs(def)
	if !def.IsMap() {
		return false
	}

	valueType := context.ResolveRefs(def.AsMap().ValueType)
	if valueType.IsMap() {
		return context.IsMapOfKinds(valueType, kinds...)
	}

	return valueType.IsAnyOf(kinds...)
}

func (context *Context) ResolveToComposableSlot(def ast.Type) (ast.Type, bool) {
	if def.IsComposableSlot() {
		return def, true
	}

	if def.IsArray() {
		return context.ResolveToComposableSlot(def.AsArray().ValueType)
	}

	if def.IsRef() {
		referredObj, found := context.LocateObject(def.AsRef().ReferredPkg, def.AsRef().ReferredType)
		if !found {
			return ast.Type{}, false
		}

		return context.ResolveToComposableSlot(referredObj.Type)
	}

	return ast.Type{}, false
}

func (context *Context) ResolveToStruct(def ast.Type) bool {
	if def.IsStruct() {
		return true
	}

	if !def.IsRef() {
		return false
	}

	referredObj, found := context.LocateObject(def.AsRef().ReferredPkg, def.AsRef().ReferredType)
	if !found {
		return false
	}

	return context.ResolveToStruct(referredObj.Type)
}

func (context *Context) ResolveRefs(def ast.Type) ast.Type {
	if !def.IsRef() {
		return def
	}

	referredObj, found := context.LocateObject(def.AsRef().ReferredPkg, def.AsRef().ReferredType)
	if !found {
		return def
	}

	return context.ResolveRefs(referredObj.Type)
}

func (context *Context) BuildersForType(typeDef ast.Type) ast.Builders {
	var candidateBuilders ast.Builders

	var search func(def ast.Type)
	search = func(def ast.Type) {
		if def.IsArray() {
			search(def.AsArray().ValueType)
			return
		}
		if def.IsMap() {
			search(def.AsMap().ValueType)
			return
		}

		if def.IsDisjunction() {
			for _, branch := range def.AsDisjunction().Branches {
				search(branch)
			}

			return
		}

		if !def.IsRef() {
			return
		}

		candidateBuilders = append(candidateBuilders, context.Builders.LocateAllByRef(def.AsRef())...)
	}

	search(typeDef)

	return candidateBuilders
}

func (context Context) PackagesForVariant(variant string) []string {
	return tools.Map(context.SchemasForVariant(variant), func(schema *ast.Schema) string {
		return schema.Package
	})
}

func (context Context) SchemasForVariant(variant string) []*ast.Schema {
	schemas := tools.Filter(context.Schemas, func(schema *ast.Schema) bool {
		return schema.Metadata.Kind == ast.SchemaKindComposable && string(schema.Metadata.Variant) == variant && schema.Metadata.Identifier != ""
	})

	sort.Slice(schemas, func(i int, j int) bool {
		return schemas[i].Package < schemas[j].Package
	})

	return schemas
}
