package compiler

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*DisjunctionToType)(nil)

// DisjunctionToType transforms disjunction into a struct, mapping disjunction branches to
// an optional and nullable field in that struct.
//
// Example:
//
//		```
//		SomeType: {
//			type: "some-type"
//	 	}
//		SomeOtherType: {
//			type: "other-type"
//	 	}
//		SomeStruct: {
//			foo: string | bool
//		}
//		OtherStruct: {
//			bar: SomeType | SomeOtherType
//		}
//		```
//
// Will become:
//
//		```
//		SomeType: {
//			type: "some-type"
//	 	}
//		SomeOtherType: {
//			type: "other-type"
//	 	}
//		StringOrBool: {
//			string: *string
//			bool: *string
//		}
//		SomeStruct: {
//			foo: StringOrBool
//		}
//		SomeTypeOrSomeOtherType: {
//			SomeType: *SomeType
//			SomeOtherType: *SomeOtherType
//		}
//		OtherStruct: {
//			bar: SomeTypeOrSomeOtherType
//		}
//		```
type DisjunctionToType struct {
}

func (pass *DisjunctionToType) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnDisjunction: pass.processDisjunction,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *DisjunctionToType) processDisjunction(visitor *Visitor, schema *ast.Schema, def ast.Type) (ast.Type, error) {
	disjunction := def.AsDisjunction()

	// Ex: "some concrete value" | "some other value" | string
	if pass.hasOnlySingleTypeScalars(schema, disjunction) {
		resolvedType, _ := schema.Resolve(disjunction.Branches[0])
		scalarKind := resolvedType.AsScalar().ScalarKind

		return ast.NewScalar(scalarKind, ast.Default(def.Default)), nil
	}

	// type | otherType | something (| null)?
	// generate a type with a nullable field for every branch of the disjunction,
	// add it to preprocessor.types, and use it instead.
	newTypeName := pass.disjunctionTypeName(disjunction)

	// if we already generated a new object for this disjunction, let's return
	// a reference to it.
	if visitor.HasNewObject(ast.RefType{ReferredPkg: schema.Package, ReferredType: newTypeName}) {
		ref := ast.NewRef(schema.Package, newTypeName, ast.Hints(def.Hints))
		ref.AddToPassesTrail("DisjunctionToType[disjunction → ref]")
		if def.Nullable || disjunction.Branches.HasNullType() {
			ref.Nullable = true
		}

		return ref, nil
	}

	/*
		TODO: return an error here. Some jennies won't be able to handle
		this type of disjunction.
		if !disjunction.Branches.HasOnlyScalarOrArrayOrMap() || !disjunction.Branches.HasOnlyRefs() {
		}
	*/

	fields := make([]ast.StructField, 0, len(disjunction.Branches))
	for _, branch := range disjunction.Branches {
		// Handled below, by allowing the reference to the disjunction struct
		// to be null.
		if branch.IsNull() {
			continue
		}

		processedBranch := branch
		processedBranch.Nullable = true

		fields = append(fields, ast.NewStructField(ast.TypeName(processedBranch), processedBranch))
	}

	structType := ast.NewStruct(fields...)
	for hint, value := range def.Hints {
		structType.Hints[hint] = value
	}
	switch {
	case disjunction.Branches.HasOnlyScalarOrArrayOrMap():
		structType.Hints[ast.HintDisjunctionOfScalars] = disjunction
	case disjunction.Branches.HasOnlyRefs():
		if len(disjunction.Discriminator) == 0 {
			return ast.Type{}, fmt.Errorf("discriminator not set")
		}
		if len(disjunction.DiscriminatorMapping) == 0 {
			return ast.Type{}, fmt.Errorf("discriminator mapping not set")
		}
		structType.Hints[ast.HintDiscriminatedDisjunctionOfRefs] = disjunction
	default:
		structType.Hints[ast.HintDisjunctionOfScalarsAndRefs] = disjunction
	}

	newObject := ast.NewObject(schema.Package, newTypeName, structType)
	newObject.AddToPassesTrail("DisjunctionToType[created]")

	visitor.RegisterNewObject(newObject)

	ref := ast.NewRef(schema.Package, newTypeName, ast.Hints(def.Hints))
	ref.AddToPassesTrail("DisjunctionToType[disjunction → ref]")
	if def.Nullable || disjunction.Branches.HasNullType() {
		ref.Nullable = true
	}

	return ref, nil
}

func (pass *DisjunctionToType) disjunctionTypeName(def ast.DisjunctionType) string {
	parts := make([]string, 0, len(def.Branches))

	for _, subType := range def.Branches {
		parts = append(parts, ast.TypeName(subType))
	}

	return strings.Join(parts, "Or")
}

func (pass *DisjunctionToType) hasOnlySingleTypeScalars(schema *ast.Schema, disjunction ast.DisjunctionType) bool {
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
