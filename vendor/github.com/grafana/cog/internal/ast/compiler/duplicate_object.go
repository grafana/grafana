package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*DuplicateObject)(nil)

// DuplicateObject duplicates the source object. The duplicate is created under
// a different name, possibly in a different package.
//
// Note: if the source object isn't found, this pass does nothing.
type DuplicateObject struct {
	Object     ObjectReference
	As         ObjectReference
	OmitFields []string

	schemas ast.Schemas
}

func (pass *DuplicateObject) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	pass.schemas = schemas

	visitor := &Visitor{
		OnSchema: pass.processSchema,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *DuplicateObject) processSchema(visitor *Visitor, schema *ast.Schema) (*ast.Schema, error) {
	if schema.Package != pass.As.Package {
		return schema, nil
	}

	sourceObj, found := pass.schemas.LocateObjectByRef(pass.Object.AsRef())
	if !found {
		return schema, nil
	}

	duplicate := sourceObj.DeepCopy()
	duplicate.Name = pass.As.Object
	duplicate.SelfRef.ReferredPkg = pass.As.Package
	duplicate.SelfRef.ReferredType = pass.As.Object
	duplicate.AddToPassesTrail(fmt.Sprintf("DuplicateObject[source=%s]", sourceObj.SelfRef.String()))

	if !duplicate.Type.IsStruct() || len(pass.OmitFields) == 0 {
		visitor.RegisterNewObject(duplicate)
		return schema, nil
	}

	duplicate.Type.Struct.Fields = tools.Filter(duplicate.Type.Struct.Fields, func(field ast.StructField) bool {
		return !tools.StringInListEqualFold(field.Name, pass.OmitFields)
	})
	visitor.RegisterNewObject(duplicate)

	return schema, nil
}
