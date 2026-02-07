package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*DisjunctionInferMapping)(nil)

// DisjunctionInferMapping infers the discriminator field and mapping used to
// describe a disjunction of references.
// See https://swagger.io/docs/specification/data-models/inheritance-and-polymorphism/
type DisjunctionInferMapping struct {
	schemas ast.Schemas
}

func (pass *DisjunctionInferMapping) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	pass.schemas = schemas
	visitor := &Visitor{
		OnDisjunction: pass.processDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *DisjunctionInferMapping) processDisjunction(_ *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	var err error

	if !def.Disjunction.Branches.HasOnlyRefs() {
		return def, nil
	}

	def.Disjunction, err = pass.ensureDiscriminator(schema, def)
	if err != nil {
		def.AddToPassesTrail(fmt.Sprintf("DisjunctionInferMapping[no_mapping_found:%s]", err.Error()))
		return def, nil
	}

	return def, nil
}

func (pass *DisjunctionInferMapping) ensureDiscriminator(schema *ast.Schema, def ast.Type) (*ast.DisjunctionType, error) {
	var ok bool
	disjunction := def.Disjunction

	// discriminator-related data was set during parsing: nothing to do.
	if disjunction.Discriminator != "" && len(disjunction.DiscriminatorMapping) != 0 {
		return disjunction, nil
	}

	if disjunction.Discriminator == "" {
		disjunction.Discriminator, ok = pass.inferDiscriminatorField(schema, disjunction)
		if ok {
			def.AddToPassesTrail("DisjunctionInferMapping[discriminator inferred]")
		}
	}

	if len(disjunction.DiscriminatorMapping) == 0 {
		mapping, err := pass.buildDiscriminatorMapping(schema, disjunction)
		if err != nil {
			return disjunction, err
		}

		disjunction.DiscriminatorMapping = mapping
		def.AddToPassesTrail("DisjunctionInferMapping[mapping inferred]")
	}

	return disjunction, nil
}

// inferDiscriminatorField tries to identify a field that might be used
// as a way to distinguish between the types in the disjunction branches.
// Such a field must:
//   - exist in all structs referred by the disjunction
//   - have a concrete, scalar value
//
// Note: this function assumes a disjunction of references to structs.
func (pass *DisjunctionInferMapping) inferDiscriminatorField(schema *ast.Schema, def *ast.DisjunctionType) (string, bool) {
	fieldName := ""
	// map[typeName][fieldName]value
	candidates := make(map[string]map[string]any)

	// Identify candidates from each branch
	for _, branch := range def.Branches {
		referredType, found := schema.Resolve(branch)
		if !found {
			continue
		}

		if !referredType.IsStruct() {
			continue
		}

		typeName := branch.AsRef().ReferredType
		structType := referredType.AsStruct()
		candidates[typeName] = make(map[string]any)

		for _, field := range structType.Fields {
			if !(field.Type.IsConcreteScalar() && field.Type.AsScalar().ScalarKind == ast.KindString) && !field.Type.IsConstantRef() {
				continue
			}

			switch field.Type.Kind {
			case ast.KindScalar:
				candidates[typeName][field.Name] = field.Type.AsScalar().Value
			case ast.KindConstantRef:
				candidates[typeName][field.Name] = field.Type.AsConstantRef().ReferenceValue // TODO: Check if its a string
			}
		}
	}

	// At this point, if a discriminator exists, it will be listed under the candidates
	// of any type in our map.
	// We need to check if all other types have a similar field.
	someType := def.Branches[0].AsRef().ReferredType
	allTypes := make([]string, 0, len(candidates))

	for typeName := range candidates {
		allTypes = append(allTypes, typeName)
	}

	for candidateFieldName := range candidates[someType] {
		existsInAllBranches := true
		for _, branchTypeName := range allTypes {
			if _, ok := candidates[branchTypeName][candidateFieldName]; !ok {
				existsInAllBranches = false
				break
			}
		}

		if existsInAllBranches {
			fieldName = candidateFieldName
			break
		}
	}

	return fieldName, fieldName != ""
}

func (pass *DisjunctionInferMapping) buildDiscriminatorMapping(schema *ast.Schema, def *ast.DisjunctionType) (map[string]string, error) {
	mapping := make(map[string]string, len(def.Branches))
	if def.Discriminator == "" {
		return nil, fmt.Errorf("could not identify discriminator field")
	}

	for _, branch := range def.Branches {
		referredType, found := schema.Resolve(branch)
		if !found {
			return nil, fmt.Errorf("could not resolve reference '%s'", branch.AsRef().String())
		}

		structType := referredType.AsStruct()

		field, found := structType.FieldByName(def.Discriminator)
		if !found {
			return nil, fmt.Errorf("discriminator field '%s' not found", def.Discriminator)
		}

		// trust, but verify: we need the field to be an actual scalar with a concrete value?
		if !(field.Type.IsScalar() && field.Type.AsScalar().IsConcrete()) && !field.Type.IsConstantRef() {
			return nil, fmt.Errorf("discriminator field '%s' is not a scalar or constant reference", field.Name)
		}

		typeName := branch.AsRef().ReferredType

		switch field.Type.Kind {
		case ast.KindScalar:
			mapping[field.Type.AsScalar().Value.(string)] = typeName
		case ast.KindConstantRef:
			mapping[field.Type.AsConstantRef().ReferenceValue.(string)] = typeName
		default:
			return nil, fmt.Errorf("discriminator field '%s' is not concrete", field.Name)
		}
	}

	return mapping, nil
}
