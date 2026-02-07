package compiler

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*FilterSchemas)(nil)

// FilterSchemas filters a schema to only include the allowed objects and their
// dependencies.
type FilterSchemas struct {
	AllowedObjects []ObjectReference
}

func (pass *FilterSchemas) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	allowList := pass.buildAllowList(schemas, pass.AllowedObjects)

	return tools.Map(schemas, func(schema *ast.Schema) *ast.Schema {
		return pass.processSchema(schema, allowList)
	}), nil
}

func (pass *FilterSchemas) processSchema(schema *ast.Schema, allowList *orderedmap.Map[string, struct{}]) *ast.Schema {
	schema.Objects = schema.Objects.Filter(func(_ string, object ast.Object) bool {
		return allowList.Has(object.SelfRef.String())
	})

	return schema
}

// buildAllowList returns the set of objects that should be included in the
// processed schemas. This set is built by recursively exploring the
// "entrypoint objects" and any object they might reference, each of these
// references contributing to the allow list.
func (pass *FilterSchemas) buildAllowList(schemas ast.Schemas, entrypoints []ObjectReference) *orderedmap.Map[string, struct{}] {
	allowList := orderedmap.New[string, struct{}]()
	rootObjects := orderedmap.New[string, ast.Object]()

	for _, allowedObj := range entrypoints {
		obj, found := schemas.LocateObject(allowedObj.Package, allowedObj.Object)
		if !found {
			continue
		}

		rootObjects.Set(obj.SelfRef.String(), obj)
	}

	visitor := &Visitor{
		OnRef: func(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
			referredObj, found := schemas.LocateObject(def.Ref.ReferredPkg, def.Ref.ReferredType)
			if !found {
				return def, nil
			}

			rootObjects.Set(def.Ref.String(), referredObj)

			return def, nil
		},
	}

	for {
		if rootObjects.Len() == 0 {
			break
		}

		objects := rootObjects
		rootObjects = orderedmap.New[string, ast.Object]()

		objects.Iterate(func(key string, object ast.Object) {
			if allowList.Has(object.SelfRef.String()) {
				return
			}

			allowList.Set(key, struct{}{})

			schema, found := schemas.Locate(object.SelfRef.ReferredPkg)
			if !found {
				return
			}

			_, _ = visitor.VisitType(schema, object.Type)
		})
	}

	return allowList
}
