package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*DataqueryIdentification)(nil)

type DataqueryIdentification struct {
}

func (pass *DataqueryIdentification) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	commonDataquery, found := ast.Schemas(schemas).LocateObject("common", "DataQuery")
	if !found {
		return schemas, nil
	}

	newSchemas := make([]*ast.Schema, 0, len(schemas))

	for _, schema := range schemas {
		newSchemas = append(newSchemas, pass.processSchema(schema, commonDataquery))
	}

	return newSchemas, nil
}

func (pass *DataqueryIdentification) processSchema(schema *ast.Schema, commonDataquery ast.Object) *ast.Schema {
	var variantObjects []string
	schema.Objects = schema.Objects.Map(func(_ string, object ast.Object) ast.Object {
		if object.SelfRef.String() == commonDataquery.SelfRef.String() {
			return object
		}

		obj, implementsVariant := pass.processObject(object, commonDataquery)

		if implementsVariant {
			variantObjects = append(variantObjects, obj.Name)
		}

		return obj
	})

	if len(variantObjects) != 0 {
		schema.Metadata.Kind = ast.SchemaKindComposable
		schema.Metadata.Variant = ast.SchemaVariantDataQuery
	}

	if schema.EntryPoint == "" && len(variantObjects) == 1 {
		schema.EntryPoint = variantObjects[0]
		schema.EntryPointType = schema.Objects.Get(variantObjects[0]).SelfRef.AsType()
	}

	return schema
}

func (pass *DataqueryIdentification) processObject(object ast.Object, commonDataquery ast.Object) (ast.Object, bool) {
	if !object.Type.IsStruct() {
		return object, false
	}

	typeDef := object.Type

	// this object is already identified as a variant: nothing to do.
	if typeDef.ImplementsVariant() {
		return object, true
	}

	if !pass.structsIntersect(typeDef, commonDataquery.Type) {
		return object, false
	}

	object.Type.Hints[ast.HintImplementsVariant] = string(ast.SchemaVariantDataQuery)
	object.AddToPassesTrail("DataqueryIdentification[hint.ImplementsVariant=VariantDataQuery]")

	return object, true
}

func (pass *DataqueryIdentification) structsIntersect(def ast.Type, base ast.Type) bool {
	structDef := def.AsStruct()

	for _, baseField := range base.AsStruct().Fields {
		// ginormous assumption here: if we find fields with the same name, then we assume their types
		// to be identical too.
		if _, found := structDef.FieldByName(baseField.Name); !found {
			return false
		}
	}

	return true
}
