package php

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/ast/compiler"
	"github.com/grafana/cog/internal/languages"
)

var _ compiler.Pass = (*AddTypehintsComments)(nil)

type AddTypehintsComments struct {
	config Config
	hinter *typehints
}

func (pass *AddTypehintsComments) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	pass.hinter = &typehints{
		config:  pass.config,
		context: languages.Context{Schemas: schemas},
	}

	visitor := &compiler.Visitor{
		OnStructField: pass.processStructField,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *AddTypehintsComments) processStructField(_ *compiler.Visitor, _ *ast.Schema, field ast.StructField) (ast.StructField, error) {
	if !pass.hinter.requiresHint(field.Type) {
		return field, nil
	}

	hint := pass.hinter.varAnnotationForType(field.Type)
	if hint != "" {
		field.Comments = append(field.Comments, hint)
	}

	return field, nil
}
