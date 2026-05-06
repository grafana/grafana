//go:generate go run github.com/matryer/moq -out executable_schema_mock.go . ExecutableSchema

package graphql

import (
	"context"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"
)

type ExecutableSchema interface {
	Schema() *ast.Schema

	Complexity(ctx context.Context, typeName, fieldName string, childComplexity int, args map[string]any) (int, bool)
	Exec(ctx context.Context) ResponseHandler
}

// CollectFields returns the set of fields from an ast.SelectionSet where all collected fields satisfy at least one of the GraphQL types
// passed through satisfies. Providing an empty slice for satisfies will collect all fields regardless of fragment type conditions.
func CollectFields(reqCtx *OperationContext, selSet ast.SelectionSet, satisfies []string) []CollectedField {
	return collectFields(reqCtx, selSet, satisfies, map[string]bool{})
}

func collectFields(reqCtx *OperationContext, selSet ast.SelectionSet, satisfies []string, visited map[string]bool) []CollectedField {
	groupedFields := make([]CollectedField, 0, len(selSet))

	for _, sel := range selSet {
		switch sel := sel.(type) {
		case *ast.Field:
			if !shouldIncludeNode(sel.Directives, reqCtx.Variables) {
				continue
			}
			f := getOrCreateAndAppendField(&groupedFields, sel.Name, sel.Alias, sel.ObjectDefinition, func() CollectedField {
				return CollectedField{Field: sel}
			})

			f.Selections = append(f.Selections, sel.SelectionSet...)

		case *ast.InlineFragment:
			// To allow simplified "collect all" types behavior, pass an empty list
			// of types that the type condition must satisfy: we will apply the
			// fragment regardless of type condition.
			//
			// When the type condition is not set (... { field }) we will apply the
			// fragment to any satisfying types.
			//
			// We will only NOT apply the fragment when we have at least one type in
			// the list we must satisfy and a type condition to compare them to.
			if len(satisfies) > 0 && sel.TypeCondition != "" && !instanceOf(sel.TypeCondition, satisfies) {
				continue
			}

			if !shouldIncludeNode(sel.Directives, reqCtx.Variables) {
				continue
			}
			shouldDefer, label := deferrable(sel.Directives, reqCtx.Variables)

			for _, childField := range collectFields(reqCtx, sel.SelectionSet, satisfies, visited) {
				f := getOrCreateAndAppendField(
					&groupedFields, childField.Name, childField.Alias, childField.ObjectDefinition,
					func() CollectedField { return childField })
				f.Selections = append(f.Selections, childField.Selections...)
				if shouldDefer {
					f.Deferrable = &Deferrable{
						Label: label,
					}
				}
			}

		case *ast.FragmentSpread:
			fragmentName := sel.Name
			if _, seen := visited[fragmentName]; seen {
				continue
			}
			visited[fragmentName] = true

			fragment := reqCtx.Doc.Fragments.ForName(fragmentName)
			if fragment == nil {
				// should never happen, validator has already run
				panic(fmt.Errorf("missing fragment %s", fragmentName))
			}

			if len(satisfies) > 0 && !instanceOf(fragment.TypeCondition, satisfies) {
				continue
			}

			if !shouldIncludeNode(sel.Directives, reqCtx.Variables) {
				continue
			}
			shouldDefer, label := deferrable(sel.Directives, reqCtx.Variables)

			for _, childField := range collectFields(reqCtx, fragment.SelectionSet, satisfies, visited) {
				f := getOrCreateAndAppendField(&groupedFields,
					childField.Name, childField.Alias, childField.ObjectDefinition,
					func() CollectedField { return childField })
				f.Selections = append(f.Selections, childField.Selections...)
				if shouldDefer {
					f.Deferrable = &Deferrable{Label: label}
				}
			}

		default:
			panic(fmt.Errorf("unsupported %T", sel))
		}
	}

	return groupedFields
}

type CollectedField struct {
	*ast.Field

	Selections ast.SelectionSet
	Deferrable *Deferrable
}

func instanceOf(val string, satisfies []string) bool {
	for _, s := range satisfies {
		if val == s {
			return true
		}
	}
	return false
}

func getOrCreateAndAppendField(c *[]CollectedField, name, alias string, objectDefinition *ast.Definition, creator func() CollectedField) *CollectedField {
	for i, cf := range *c {
		if cf.Name == name && cf.Alias == alias {
			if cf.ObjectDefinition == objectDefinition {
				return &(*c)[i]
			}

			if cf.ObjectDefinition == nil || objectDefinition == nil {
				continue
			}

			if cf.ObjectDefinition.Name == objectDefinition.Name {
				return &(*c)[i]
			}

			for _, ifc := range objectDefinition.Interfaces {
				if ifc == cf.ObjectDefinition.Name {
					return &(*c)[i]
				}
			}
			for _, ifc := range cf.ObjectDefinition.Interfaces {
				if ifc == objectDefinition.Name {
					return &(*c)[i]
				}
			}
		}
	}

	f := creator()

	*c = append(*c, f)
	return &(*c)[len(*c)-1]
}

func shouldIncludeNode(directives ast.DirectiveList, variables map[string]any) bool {
	if len(directives) == 0 {
		return true
	}

	skip, include := false, true

	if d := directives.ForName("skip"); d != nil {
		skip = resolveIfArgument(d, variables)
	}

	if d := directives.ForName("include"); d != nil {
		include = resolveIfArgument(d, variables)
	}

	return !skip && include
}

func deferrable(directives ast.DirectiveList, variables map[string]any) (shouldDefer bool, label string) {
	d := directives.ForName("defer")
	if d == nil {
		return false, ""
	}

	shouldDefer = true

	for _, arg := range d.Arguments {
		switch arg.Name {
		case "if":
			if value, err := arg.Value.Value(variables); err == nil {
				shouldDefer, _ = value.(bool)
			}
		case "label":
			if value, err := arg.Value.Value(variables); err == nil {
				label, _ = value.(string)
			}
		default:
			panic(fmt.Sprintf("defer: argument '%s' not supported", arg.Name))
		}
	}

	return shouldDefer, label
}

func resolveIfArgument(d *ast.Directive, variables map[string]any) bool {
	arg := d.Arguments.ForName("if")
	if arg == nil {
		panic(fmt.Sprintf("%s: argument 'if' not defined", d.Name))
	}
	value, err := arg.Value.Value(variables)
	if err != nil {
		panic(err)
	}
	ret, ok := value.(bool)
	if !ok {
		panic(fmt.Sprintf("%s: argument 'if' is not a boolean", d.Name))
	}
	return ret
}
