package languages

import (
	"github.com/grafana/cog/internal/ast"
)

func GenerateBuilderNilChecks(language Language, context Context) (Context, error) {
	var err error
	nullableKinds := NullableConfig{
		Kinds:              nil,
		ProtectArrayAppend: false,
		AnyIsNullable:      true,
	}
	if nilTypesProvider, ok := language.(NullableKindsProvider); ok {
		nullableKinds = nilTypesProvider.NullableKinds()
	}

	// Allows us to keep track of the checks already performed for the current scope (constructor or option)
	// When a check is generated, the path being checked is stored in this map.
	// Changes in scope must reset this map.
	checks := make(map[string]struct{})

	nilChecksVisitor := ast.BuilderVisitor{
		OnConstructor: func(visitor *ast.BuilderVisitor, schemas ast.Schemas, builder ast.Builder, constructor ast.Constructor) (ast.Constructor, error) {
			checks = make(map[string]struct{})

			return visitor.TraverseConstructor(schemas, builder, constructor)
		},
		OnOption: func(visitor *ast.BuilderVisitor, schemas ast.Schemas, builder ast.Builder, option ast.Option) (ast.Option, error) {
			checks = make(map[string]struct{})

			return visitor.TraverseOption(schemas, builder, option)
		},
		OnAssignment: func(_ *ast.BuilderVisitor, _ ast.Schemas, b ast.Builder, assignment ast.Assignment) (ast.Assignment, error) {
			for i, chunk := range assignment.Path {
				protectArrayAppend := nullableKinds.ProtectArrayAppend && assignment.Method == ast.AppendAssignment
				if i == len(assignment.Path)-1 && !protectArrayAppend {
					continue
				}

				if nullableKinds.TypeIsNullable(chunk.Type) {
					subPath := assignment.Path[:i+1]
					valueType := subPath.Last().Type
					if subPath.Last().TypeHint != nil {
						valueType = *subPath.Last().TypeHint
					}

					// this path already has a nil check: nothing to do.
					if _, found := checks[subPath.String()]; found {
						continue
					}

					assignment.NilChecks = append(assignment.NilChecks, ast.AssignmentNilCheck{
						Path:           subPath,
						EmptyValueType: valueType,
					})
					checks[subPath.String()] = struct{}{}
				}
			}

			return assignment, nil
		},
	}
	context.Builders, err = nilChecksVisitor.Visit(context.Schemas, context.Builders)
	if err != nil {
		return context, err
	}

	return context, nil
}
