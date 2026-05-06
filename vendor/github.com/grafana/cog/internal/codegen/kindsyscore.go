package codegen

import (
	"cuelang.org/go/cue"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/simplecue"
)

func kindsysCoreLoader(input CueInput) (ast.Schemas, error) {
	schemaRootValue, libraries, err := input.schemaRootValue("kind")
	if err != nil {
		return nil, err
	}

	kindIdentifier, err := inferCoreKindIdentifier(schemaRootValue)
	if err != nil {
		return nil, err
	}

	schema, err := simplecue.GenerateAST(schemaFromThemaLineage(schemaRootValue), simplecue.Config{
		Package: input.packageName(),
		SchemaMetadata: ast.SchemaMeta{
			Kind:       ast.SchemaKindCore,
			Identifier: kindIdentifier,
		},
		Libraries: libraries,
	})
	if err != nil {
		return nil, err
	}

	return input.filterSchema(schema)
}

func inferCoreKindIdentifier(kindRoot cue.Value) (string, error) {
	return kindRoot.LookupPath(cue.ParsePath("name")).String()
}

func schemaFromThemaLineage(kindRoot cue.Value) cue.Value {
	return kindRoot.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))
}
