package openapi

import (
	"errors"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/cog/internal/ast"
)

func schemaComments(schema *openapi3.Schema) []string {
	lines := strings.Split(schema.Description, "\n")
	filtered := make([]string, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}

		filtered = append(filtered, line)
	}

	return filtered
}

func getEnumType(t string) (ast.Type, error) {
	switch t {
	case openapi3.TypeString:
		return ast.String(), nil
	case openapi3.TypeNumber:
		return ast.NewScalar(ast.KindInt32), nil
	case openapi3.TypeInteger:
		return ast.NewScalar(ast.KindInt64), nil
	default:
		return ast.Type{}, errors.New("only strings/numbers are supported")
	}
}

func getConstraints(schema *openapi3.Schema) []ast.TypeConstraint {
	constraints := make([]ast.TypeConstraint, 0)

	if schema.MinLength > 0 {
		constraints = append(constraints, ast.TypeConstraint{
			Op:   ast.MinLengthOp,
			Args: []any{schema.MinLength},
		})
	}
	if schema.MaxLength != nil {
		constraints = append(constraints, ast.TypeConstraint{
			Op:   ast.MaxLengthOp,
			Args: []any{*schema.MaxLength},
		})
	}

	if schema.MultipleOf != nil {
		constraints = append(constraints, ast.TypeConstraint{
			Op:   ast.MultipleOfOp,
			Args: getArgs(schema.MultipleOf, schema.Type.Slice()[0]),
		})
	}

	if schema.Min != nil {
		op := ast.GreaterThanEqualOp
		if schema.ExclusiveMin {
			op = ast.GreaterThanOp
		}
		constraints = append(constraints, ast.TypeConstraint{
			Op:   op,
			Args: getArgs(schema.Min, schema.Type.Slice()[0]),
		})
	}

	if schema.Max != nil {
		op := ast.LessThanEqualOp
		if schema.ExclusiveMax {
			op = ast.LessThanOp
		}
		constraints = append(constraints, ast.TypeConstraint{
			Op:   op,
			Args: getArgs(schema.Max, schema.Type.Slice()[0]),
		})
	}

	return constraints
}

func getArgs(v *float64, t string) []any {
	args := []any{*v}
	if t == openapi3.TypeInteger {
		args = []any{int64(*v)}
	}
	return args
}

func isRef(ref string) bool {
	return ref != "" && strings.ContainsAny(ref, "#")
}
