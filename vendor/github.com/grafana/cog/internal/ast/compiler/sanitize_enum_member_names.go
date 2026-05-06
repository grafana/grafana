package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*SanitizeEnumMemberNames)(nil)

type SanitizeEnumMemberNames struct {
}

func (pass *SanitizeEnumMemberNames) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnEnum: pass.processEnum,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *SanitizeEnumMemberNames) processEnum(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
	def.Enum.Values = tools.Map(def.Enum.Values, pass.sanitizeEnumMember)

	return def, nil
}

func (pass *SanitizeEnumMemberNames) sanitizeEnumMember(member ast.EnumValue) ast.EnumValue {
	if member.Type.Scalar.ScalarKind == ast.KindString && member.Name == "" && member.Value.(string) == "" {
		member.Name = "None"
	}

	if member.Name[0] == '-' {
		member.Name = tools.UpperCamelCase(fmt.Sprintf("negative%s", member.Name[1:]))
	}
	if member.Name[0] == '+' {
		member.Name = tools.UpperCamelCase(fmt.Sprintf("positive%s", member.Name[1:]))
	}

	return member
}
