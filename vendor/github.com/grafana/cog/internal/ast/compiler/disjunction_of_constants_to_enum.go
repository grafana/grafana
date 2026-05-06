package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*DisjunctionOfConstantsToEnum)(nil)

type DisjunctionOfConstantsToEnum struct {
	schemas ast.Schemas
}

func (pass *DisjunctionOfConstantsToEnum) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	pass.schemas = schemas

	visitor := &Visitor{
		OnDisjunction: pass.processDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *DisjunctionOfConstantsToEnum) processDisjunction(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
	if len(def.Disjunction.Branches) < 2 {
		return def, nil
	}

	var scalarKindCandidate *ast.ScalarKind
	isScalarValidEnumMember := func(scalar ast.ScalarType) bool {
		accepted := scalar.ScalarKind == ast.KindString || scalar.IsNumeric()
		if !accepted {
			return false
		}

		if scalarKindCandidate == nil {
			scalarKindCandidate = &scalar.ScalarKind
		}

		return *scalarKindCandidate == scalar.ScalarKind
	}

	valueToString := func(val any) string {
		if str, ok := val.(string); ok {
			return str
		}

		return fmt.Sprintf("%v", val)
	}

	var identifiedMembers []ast.EnumValue
	var resolvesToConcreteScalarsOnly func(typeDef ast.Type) bool
	resolvesToConcreteScalarsOnly = func(typeDef ast.Type) bool {
		resolved := pass.schemas.ResolveToType(typeDef)

		if resolved.IsConcreteScalar() {
			if isScalarValidEnumMember(*resolved.Scalar) {
				identifiedMembers = append(identifiedMembers, ast.EnumValue{
					Type:  ast.NewScalar(*scalarKindCandidate),
					Name:  valueToString(resolved.Scalar.Value),
					Value: resolved.Scalar.Value,
				})
				return true
			}

			return false
		}

		if resolved.IsDisjunction() {
			for _, branch := range resolved.Disjunction.Branches {
				if !resolvesToConcreteScalarsOnly(branch) {
					return false
				}
			}

			return true
		}

		if resolved.IsEnum() {
			for _, member := range resolved.Enum.Values {
				if !isScalarValidEnumMember(*member.Type.Scalar) {
					return false
				}

				identifiedMembers = append(identifiedMembers, member)
			}

			return true
		}

		return false
	}

	if !resolvesToConcreteScalarsOnly(def) {
		return def, nil
	}

	typeOpts := []ast.TypeOption{
		ast.Default(def.Default),
		ast.Trail("DisjunctionOfConstantsToEnum"),
	}
	if def.Nullable {
		typeOpts = append(typeOpts, ast.Nullable())
	}

	return ast.NewEnum(identifiedMembers, typeOpts...), nil
}
