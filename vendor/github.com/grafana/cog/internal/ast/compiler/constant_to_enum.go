package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*ConstantToEnum)(nil)

// ConstantToEnum turns `string` constants into an enum definition with a
// single member.
// This is useful to "future-proof" a schema where a type can have a single
// value for now but is expected to allow more in the future.
type ConstantToEnum struct {
	Objects ObjectReferences
}

func (pass *ConstantToEnum) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *ConstantToEnum) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !pass.Objects.Matches(object) {
		return object, nil
	}

	if !object.Type.IsConcreteScalar() || object.Type.Scalar.ScalarKind != ast.KindString {
		return object, nil
	}

	object.Type = ast.NewEnum([]ast.EnumValue{
		{
			Type:  ast.String(),
			Name:  object.Type.Scalar.Value.(string),
			Value: object.Type.Scalar.Value.(string),
		},
	})
	object.AddToPassesTrail("ConstantToEnum")

	return object, nil
}
