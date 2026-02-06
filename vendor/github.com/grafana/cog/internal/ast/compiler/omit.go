package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*Omit)(nil)

// Omit rewrites schemas to omit the configured objects.
type Omit struct {
	Objects []ObjectReference
}

func (pass *Omit) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		schemas[i] = pass.processSchema(schema)
	}

	return schemas, nil
}

func (pass *Omit) processSchema(schema *ast.Schema) *ast.Schema {
	schema.Objects = schema.Objects.Filter(func(_ string, object ast.Object) bool {
		// if any reference matches the current object, we filter it out
		for _, objectRef := range pass.Objects {
			if objectRef.Matches(object) {
				return false
			}
		}

		return true
	})

	return schema
}
