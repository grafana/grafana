package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*SchemaSetIdentifier)(nil)

// SchemaSetIdentifier overwrites the Metadata.Identifier field of a schema.
type SchemaSetIdentifier struct {
	Package    string // we don't have a "clear" identifier, so we use the package to identify a schema.
	Identifier string
}

func (pass *SchemaSetIdentifier) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for _, schema := range schemas {
		if schema.Package != pass.Package {
			continue
		}

		schema.Metadata.Identifier = pass.Identifier
	}

	return schemas, nil
}
