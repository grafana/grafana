package compiler

import (
	"strings"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*CleanupK8ResourceNames)(nil)

type CleanupK8ResourceNames struct {
	PrefixToRemove string
}

func (pass *CleanupK8ResourceNames) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := Visitor{
		OnObject:      pass.parseObject,
		OnRef:         pass.parseReference,
		OnConstantRef: pass.parseConstantReference,
		OnStructField: pass.parseField,
		OnDisjunction: pass.parseDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *CleanupK8ResourceNames) parseObject(visitor *Visitor, schema *ast.Schema, object ast.Object) (ast.Object, error) {
	newObject := object
	newObject.Name = pass.cleanupName(object.Name)
	newObject.SelfRef = ast.NewRef(newObject.SelfRef.ReferredPkg, pass.cleanupName(newObject.SelfRef.ReferredType)).AsRef()

	if !newObject.Type.IsStruct() {
		return newObject, nil
	}

	for i, f := range object.Type.AsStruct().Fields {
		t, err := visitor.VisitType(schema, f.Type)
		if err != nil {
			return ast.Object{}, err
		}
		newObject.Type.AsStruct().Fields[i].Type = t
	}

	return newObject, nil
}

func (pass *CleanupK8ResourceNames) parseReference(visitor *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	refType := pass.cleanupName(def.AsRef().ReferredType)
	return ast.NewRef(def.AsRef().ReferredPkg, refType), nil
}

func (pass *CleanupK8ResourceNames) parseConstantReference(visitor *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	refType := pass.cleanupName(def.AsConstantRef().ReferredType)
	return ast.NewConstantReferenceType(def.AsConstantRef().ReferredPkg, refType, def.AsConstantRef().ReferenceValue), nil
}

func (pass *CleanupK8ResourceNames) parseField(visitor *Visitor, schema *ast.Schema, field ast.StructField) (ast.StructField, error) {
	field.Name = pass.cleanupName(field.Name)
	return field, nil
}

func (pass *CleanupK8ResourceNames) parseDisjunction(visitor *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	for i, b := range def.AsDisjunction().Branches {
		t, err := visitor.VisitType(schema, b)
		if err != nil {
			return ast.Type{}, err
		}
		def.AsDisjunction().Branches[i] = t
	}

	return def, nil
}

func (pass *CleanupK8ResourceNames) cleanupName(s string) string {
	elements := strings.Split(s, ".")
	lastElement := elements[len(elements)-1]
	lastElement = strings.TrimPrefix(lastElement, pass.PrefixToRemove)
	return lastElement
}
