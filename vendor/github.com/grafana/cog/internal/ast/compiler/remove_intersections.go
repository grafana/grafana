package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

type RemoveIntersections struct {
	objectsToRemove map[string]ast.Object
	arraysToFix     map[string]ast.Object
}

func (r RemoveIntersections) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	r.objectsToRemove = make(map[string]ast.Object)
	r.arraysToFix = make(map[string]ast.Object)
	visitor := Visitor{
		OnSchema: r.processSchema,
		OnObject: r.processObject,
		OnStruct: r.processStruct,
	}

	return visitor.VisitSchemas(schemas)
}

func (r RemoveIntersections) processSchema(v *Visitor, schema *ast.Schema) (*ast.Schema, error) {
	var foundErr error
	schema.Objects.Iterate(func(key string, value ast.Object) {
		if value.Type.IsRef() {
			obj, err := v.VisitObject(schema, value)
			if err != nil {
				foundErr = err
			}
			schema.Objects.Set(key, obj)
		}
	})

	if foundErr != nil {
		return nil, foundErr
	}

	schema.Objects.Iterate(func(key string, value ast.Object) {
		if value.Type.IsStruct() {
			if _, err := v.VisitStruct(schema, value.Type); err != nil {
				foundErr = err
			}
		}
	})

	if foundErr != nil {
		return nil, foundErr
	}

	for toRemove := range r.objectsToRemove {
		schema.Objects.Remove(toRemove)
	}

	return schema, nil
}

func (r RemoveIntersections) processObject(_ *Visitor, schema *ast.Schema, object ast.Object) (ast.Object, error) {
	ref := object.Type.AsRef()
	locatedObject, ok := schema.LocateObject(ref.ReferredType)
	if !ok {
		return object, nil
	}

	if locatedObject.Type.IsStruct() {
		newObject := object
		newObject.Type = ast.NewStruct(locatedObject.Type.AsStruct().Fields...)
		if object.Type.ImplementsVariant() {
			newObject.Type.Hints[ast.HintImplementsVariant] = object.Type.ImplementedVariant()
		}
		for hint, val := range locatedObject.Type.Hints {
			newObject.Type.Hints[hint] = val
		}

		r.objectsToRemove[locatedObject.Name] = object
		return newObject, nil
	}

	if locatedObject.Type.IsArray() {
		r.objectsToRemove[object.Name] = object
		r.arraysToFix[object.Name] = locatedObject
	}

	// TODO: Check if a reference extends from a Map if necessary

	return object, nil
}

func (r RemoveIntersections) processStruct(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
	str := def.AsStruct()
	for i, field := range str.Fields {
		if field.Type.IsRef() {
			if obj, ok := r.objectsToRemove[field.Type.AsRef().ReferredType]; ok {
				def.AsStruct().Fields[i] = ast.NewStructField(field.Name, ast.NewRef(obj.SelfRef.ReferredPkg, obj.SelfRef.ReferredType), ast.Comments(obj.Comments))
			}
			if obj, ok := r.arraysToFix[field.Type.AsRef().ReferredType]; ok {
				def.AsStruct().Fields[i] = ast.NewStructField(field.Name, ast.NewArray(obj.Type.AsArray().ValueType), ast.Comments(obj.Comments))
			}

			for hint, value := range field.Type.Hints {
				def.AsStruct().Fields[i].Type.Hints[hint] = value
			}
		}
	}

	return def, nil
}
