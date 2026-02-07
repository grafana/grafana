package compiler

import (
	"fmt"
	"strconv"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*RenameNumericEnumValues)(nil)

// RenameNumericEnumValues turns any numeric enum member name to an alphanumeric name.
//
// Example:
//
//	```
//	Position enum(0: 0, 1: 1, 2: 2)
//	```
//
// Will become:
//
//	```
//	Position enum(N0: 0, N1: 1, N2: 2)
//	```
type RenameNumericEnumValues struct {
}

func (pass *RenameNumericEnumValues) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		schemas[i] = pass.processSchema(schema)
	}

	return schemas, nil
}

func (pass *RenameNumericEnumValues) processSchema(schema *ast.Schema) *ast.Schema {
	schema.Objects = schema.Objects.Map(func(_ string, object ast.Object) ast.Object {
		if !object.Type.IsEnum() {
			return object
		}

		newType, changed := pass.processEnum(object.Type)
		object.Type = newType

		if changed {
			object.AddToPassesTrail("RenameNumericEnumValues")
		}

		return object
	})

	return schema
}

func (pass *RenameNumericEnumValues) processEnum(def ast.Type) (ast.Type, bool) {
	changed := false

	for i, val := range def.AsEnum().Values {
		if _, err := strconv.Atoi(val.Name); err != nil {
			continue
		}

		def.Enum.Values[i].Name = pass.enumMemberNameFromValue(val)
		changed = true
	}

	return def, changed
}

func (pass *RenameNumericEnumValues) enumMemberNameFromValue(member ast.EnumValue) string {
	if member.Name[0] == '-' {
		return tools.UpperCamelCase(fmt.Sprintf("negative%s", member.Name[1:]))
	}

	return "N" + tools.UpperCamelCase(member.Name)
}
