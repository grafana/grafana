package utils

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// GetModuleForObjectTypeRelation returns the module for the given object type and relation in that type.
//
// Parameters:
// - typeDef: A pointer to an openfgav1.TypeDefinition object which contains metadata about the type.
// - relation: A string representing the relation whose module is to be retrieved.
//
// Returns:
// - A string representing the module for the given object type and relation.
// - An error if the relation does not exist.
func GetModuleForObjectTypeRelation(typeDef *openfgav1.TypeDefinition, relation string) (string, error) {
	relations := typeDef.GetRelations()
	_, exists := relations[relation]

	if !exists {
		return "", fmt.Errorf("relation %s does not exist in type %s", relation, typeDef.GetType()) //nolint:goerr113
	}

	relationsMetadata := typeDef.GetMetadata().GetRelations()
	relationMetadata, exists := relationsMetadata[relation]
	if !exists || relationMetadata.GetModule() == "" {
		return typeDef.GetMetadata().GetModule(), nil
	}

	return relationMetadata.GetModule(), nil
}

// IsRelationAssignable returns true if the relation is assignable, as in the relation definition has a key "this" or
// any of its children have a key "this".
func IsRelationAssignable(relDef *openfgav1.Userset) bool { //nolint:cyclop
	switch rel := relDef.GetUserset().(type) {
	case *openfgav1.Userset_This:
		return true
	case *openfgav1.Userset_Union:
		for _, child := range rel.Union.GetChild() {
			if IsRelationAssignable(child) {
				return true
			}
		}
	case *openfgav1.Userset_Intersection:
		for _, child := range rel.Intersection.GetChild() {
			if IsRelationAssignable(child) {
				return true
			}
		}
	case *openfgav1.Userset_Difference:
		if IsRelationAssignable(rel.Difference.GetBase()) || IsRelationAssignable(rel.Difference.GetSubtract()) {
			return true
		}
	}

	// ComputedUserset and TupleToUserset are not assignable
	return false
}
