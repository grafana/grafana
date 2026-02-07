package compiler

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*AnonymousEnumToExplicitType)(nil)

// AnonymousEnumToExplicitType turns "anonymous enums" into a named
// object.
//
// Example:
//
//	```
//	Panel struct {
//		Type enum(Foo, Bar, Baz)
//	}
//	```
//
// Will become:
//
//	```
//	Panel struct {
//		Type PanelType
//	}
//
//	PanelType enum(Foo, Bar, Baz)
//	```
//
// Note: this compiler pass looks for anonymous enums in structs and arrays only.
type AnonymousEnumToExplicitType struct {
	newObjects     []ast.Object
	currentPackage string
}

func (pass *AnonymousEnumToExplicitType) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		newSchema, err := pass.processSchema(schema)
		if err != nil {
			return nil, err
		}

		schemas[i] = newSchema
	}

	return schemas, nil
}

func (pass *AnonymousEnumToExplicitType) processSchema(schema *ast.Schema) (*ast.Schema, error) {
	pass.newObjects = nil
	pass.currentPackage = schema.Package

	schema.Objects = schema.Objects.Map(func(_ string, object ast.Object) ast.Object {
		return pass.processObject(object)
	})

	schema.AddObjects(pass.newObjects...)

	return schema, nil
}

func (pass *AnonymousEnumToExplicitType) processObject(object ast.Object) ast.Object {
	if object.Type.IsEnum() {
		return object
	}

	object.Type = pass.processType(object.SelfRef.ReferredPkg, object.Name, tools.UpperCamelCase(object.Name)+"Enum", object.Type)

	return object
}

func (pass *AnonymousEnumToExplicitType) processType(pkg string, currentObjectName string, suggestedEnumName string, def ast.Type) ast.Type {
	if def.IsArray() {
		return pass.processArray(pkg, currentObjectName, suggestedEnumName, def)
	}

	if def.IsMap() {
		return pass.processMap(pkg, currentObjectName, suggestedEnumName, def)
	}

	if def.IsStruct() {
		return pass.processStruct(pkg, currentObjectName, def)
	}

	if def.IsEnum() {
		return pass.processAnonymousEnum(pkg, suggestedEnumName, def)
	}

	if def.IsDisjunction() {
		return pass.processDisjunction(pkg, currentObjectName, suggestedEnumName, def)
	}

	if def.IsIntersection() {
		return pass.processIntersection(pkg, currentObjectName, suggestedEnumName, def)
	}

	return def
}

func (pass *AnonymousEnumToExplicitType) processArray(pkg string, currentObjectName string, suggestedEnumName string, def ast.Type) ast.Type {
	def.Array.ValueType = pass.processType(pkg, currentObjectName, suggestedEnumName, def.Array.ValueType)

	return def
}

func (pass *AnonymousEnumToExplicitType) processMap(pkg string, currentObjectName string, suggestedEnumName string, def ast.Type) ast.Type {
	def.Map.IndexType = pass.processType(pkg, currentObjectName, suggestedEnumName, def.Map.IndexType)
	def.Map.ValueType = pass.processType(pkg, currentObjectName, suggestedEnumName, def.Map.ValueType)

	return def
}

func (pass *AnonymousEnumToExplicitType) processDisjunction(pkg string, currentObjectName string, suggestedEnumName string, def ast.Type) ast.Type {
	def.Disjunction.Branches = tools.Map(def.Disjunction.Branches, func(branch ast.Type) ast.Type {
		return pass.processType(pkg, currentObjectName, suggestedEnumName, branch)
	})

	return def
}

func (pass *AnonymousEnumToExplicitType) processIntersection(pkg string, currentObjectName string, suggestedEnumName string, def ast.Type) ast.Type {
	def.Intersection.Branches = tools.Map(def.Intersection.Branches, func(branch ast.Type) ast.Type {
		return pass.processType(pkg, currentObjectName, suggestedEnumName, branch)
	})

	return def
}

func (pass *AnonymousEnumToExplicitType) processStruct(pkg string, parentName string, def ast.Type) ast.Type {
	for i, field := range def.Struct.Fields {
		newField := field
		newField.Type = pass.processType(pkg, parentName, tools.UpperCamelCase(parentName)+tools.UpperCamelCase(field.Name), field.Type)

		def.Struct.Fields[i] = newField
	}

	return def
}

func (pass *AnonymousEnumToExplicitType) processAnonymousEnum(pkg string, parentName string, def ast.Type) ast.Type {
	enum := def.AsEnum()
	enumTypeName := tools.UpperCamelCase(parentName)

	values := make([]ast.EnumValue, 0, len(enum.Values))
	for _, val := range enum.Values {
		values = append(values, ast.EnumValue{
			Type:  val.Type,
			Name:  tools.UpperCamelCase(val.Name),
			Value: val.Value,
		})
	}

	newObject := ast.NewObject(pkg, enumTypeName, ast.NewEnum(values))
	newObject.AddToPassesTrail("AnonymousEnumToExplicitType")

	pass.newObjects = append(pass.newObjects, newObject)

	typeOpts := []ast.TypeOption{
		ast.Trail("AnonymousEnumToExplicitType"),
		ast.Default(def.Default),
	}
	if def.Nullable {
		typeOpts = append(typeOpts, ast.Nullable())
	}

	return ast.NewRef(pass.currentPackage, enumTypeName, typeOpts...)
}
