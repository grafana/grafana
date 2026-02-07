package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*DisjunctionWithNullToOptional)(nil)

// DisjunctionWithNullToOptional simplifies disjunctions with two branches, where one is `null`. For those,
// it transforms `type | null` into `*type` (optional, nullable reference to `type`).
//
// Example:
//
//	```
//	MaybeString: string | null
//	```
//
// Will become:
//
//	```
//	MaybeString?: string
//	```
type DisjunctionWithNullToOptional struct {
}

func (pass *DisjunctionWithNullToOptional) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnDisjunction: pass.processDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *DisjunctionWithNullToOptional) processDisjunction(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
	disjunction := def.AsDisjunction()

	if len(disjunction.Branches) != 2 || !disjunction.Branches.HasNullType() {
		return def, nil
	}

	// type | null
	finalType := disjunction.Branches.NonNullTypes()[0]
	finalType.Nullable = true
	finalType.AddToPassesTrail(fmt.Sprintf("DisjunctionWithNullToOptional[%[1]s|null → %[1]s?]", ast.TypeName(finalType)))

	return finalType, nil
}
