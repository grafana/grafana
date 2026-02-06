package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*PrefixEnumValues)(nil)

// PrefixEnumValues prefixes enum members with the name of the enum object in
// which they are defined.
//
// Example:
//
//	```
//	VariableRefresh enum(Never: "never", Always: "always")
//	```
//
// Will become:
//
//	```
//	VariableRefresh enum(VariableRefreshNever: "never", VariableRefreshAlways: "always")
//	```
type PrefixEnumValues struct {
}

func (pass *PrefixEnumValues) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		schemas[i] = pass.processSchema(schema)
	}

	return schemas, nil
}

func (pass *PrefixEnumValues) processSchema(schema *ast.Schema) *ast.Schema {
	schema.Objects = schema.Objects.Map(func(_ string, object ast.Object) ast.Object {
		if !object.Type.IsEnum() {
			return object
		}

		object.Type = pass.processEnum(object.Name, object.Type)
		object.AddToPassesTrail("PrefixEnumValues")

		return object
	})

	return schema
}

func (pass *PrefixEnumValues) processEnum(parentName string, def ast.Type) ast.Type {
	values := make([]ast.EnumValue, 0, len(def.AsEnum().Values))
	for _, val := range def.AsEnum().Values {
		values = append(values, ast.EnumValue{
			Type:  val.Type,
			Name:  tools.UpperCamelCase(parentName) + pass.enumMemberNameFromValue(val),
			Value: val.Value,
		})
	}

	def.Enum.Values = values

	return def
}

func (pass *PrefixEnumValues) enumMemberNameFromValue(member ast.EnumValue) string {
	if member.Type.Scalar.ScalarKind == ast.KindString && (member.Value == nil || member.Value.(string) == "") {
		return "None"
	}

	if member.Type.Scalar.ScalarKind != ast.KindInt64 {
		return tools.UpperCamelCase(member.Name)
	}

	if member.Name[0] == '-' {
		return tools.UpperCamelCase(fmt.Sprintf("negative%s", member.Name[1:]))
	}

	return tools.UpperCamelCase(member.Name)
}
