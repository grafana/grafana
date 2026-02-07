package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*UndiscriminatedDisjunctionToAny)(nil)

// UndiscriminatedDisjunctionToAny turns any undiscriminated disjunction into
// the `any` type.
// Disjunctions of scalars are not impacted, disjunctions having a configured
// discriminator field and mapping are not impacted (see DisjunctionInferMapping).
// Note: this pass _should_ run after DisjunctionInferMapping.
type UndiscriminatedDisjunctionToAny struct {
}

func (pass *UndiscriminatedDisjunctionToAny) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnDisjunction: pass.processDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *UndiscriminatedDisjunctionToAny) processDisjunction(_ *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	disjunction := def.AsDisjunction()

	// Ex: "some concrete value" | "some other value" | string
	if pass.hasOnlySingleTypeScalars(schema, disjunction) {
		return def, nil
	}

	if disjunction.Branches.HasOnlyScalarOrArrayOrMap() {
		return def, nil
	}

	if disjunction.Branches.HasOnlyRefs() {
		if len(disjunction.Discriminator) == 0 || len(disjunction.DiscriminatorMapping) == 0 {
			return ast.Any(ast.Trail("UndiscriminatedDisjunctionToAny")), nil
		}
	}

	return def, nil
}

func (pass *UndiscriminatedDisjunctionToAny) hasOnlySingleTypeScalars(schema *ast.Schema, disjunction ast.DisjunctionType) bool {
	branches := disjunction.Branches

	if len(branches) == 0 {
		return false
	}

	firstBranchType, found := schema.Resolve(branches[0])
	if !found {
		return false
	}

	if !firstBranchType.IsScalar() {
		return false
	}

	scalarKind := firstBranchType.AsScalar().ScalarKind
	for _, t := range branches {
		resolvedType, found := schema.Resolve(t)
		if !found {
			return false
		}

		if !resolvedType.IsScalar() {
			return false
		}

		if resolvedType.AsScalar().ScalarKind != scalarKind {
			return false
		}
	}

	return true
}
