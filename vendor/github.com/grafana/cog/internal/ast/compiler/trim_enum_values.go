package compiler

import (
	"strings"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*TrimEnumValues)(nil)

// TrimEnumValues removes leading and trailing spaces from string values.
// It could happen when they add them by mistake in jsonschema/openapi when they define the enums
type TrimEnumValues struct {
}

func (t TrimEnumValues) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := Visitor{
		OnEnum: t.processEnum,
	}

	return visitor.VisitSchemas(schemas)
}

func (t TrimEnumValues) processEnum(_ *Visitor, _ *ast.Schema, def ast.Type) (ast.Type, error) {
	for i, value := range def.AsEnum().Values {
		if stringType, ok := value.Value.(string); ok {
			def.AsEnum().Values[i].Value = strings.TrimSpace(stringType)
		}
	}

	return def, nil
}
