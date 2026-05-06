package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*SchemaSetEntrypoint)(nil)

type SchemaSetEntrypoint struct {
	Package    string // we don't have a "clear" identifier, so we use the package to identify a schema.
	EntryPoint string
}

func (pass *SchemaSetEntrypoint) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for _, schema := range schemas {
		if schema.Package != pass.Package {
			continue
		}

		schema.EntryPoint = pass.EntryPoint
		schema.EntryPointType = ast.NewRef(schema.Package, pass.EntryPoint)
	}

	return schemas, nil
}
