package compiler

import (
	"strings"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*InferEntrypoint)(nil)

type InferEntrypoint struct {
}

func (pass *InferEntrypoint) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for _, schema := range schemas {
		if schema.EntryPoint != "" {
			continue
		}

		schema.EntryPoint = pass.inferEntrypoint(schema)
		if schema.EntryPoint != "" {
			schema.EntryPointType = schema.Objects.Get(schema.EntryPoint).SelfRef.AsType()
		}
	}

	return schemas, nil
}

func (pass *InferEntrypoint) inferEntrypoint(schema *ast.Schema) string {
	entrypoint := ""

	schema.Objects.Iterate(func(_ string, object ast.Object) {
		if strings.EqualFold(schema.Package, object.Name) {
			entrypoint = object.Name
		}
	})

	return entrypoint
}
