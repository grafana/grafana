package compiler

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/orderedmap"
)

var _ Pass = (*Unspec)(nil)

// Unspec removes the Kubernetes-style envelope added by kindsys.
//
// Objects named "spec" will be renamed, using the package as new name.
type Unspec struct {
}

func (pass *Unspec) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		schemas[i] = pass.processSchema(schema)
	}

	return schemas, nil
}

func (pass *Unspec) processSchema(schema *ast.Schema) *ast.Schema {
	schema.Objects = schema.Objects.Filter(func(_ string, object ast.Object) bool {
		return !strings.EqualFold(object.Name, "metadata")
	})

	originalObjects := schema.Objects
	schema.Objects = orderedmap.New[string, ast.Object]()

	originalObjects.Iterate(func(name string, object ast.Object) {
		if strings.EqualFold(object.Name, "spec") && object.Type.IsStruct() {
			object.Name = schema.Package
			if schema.Metadata.Identifier != "" {
				object.Name = schema.Metadata.Identifier
			}

			object.SelfRef.ReferredType = object.Name
			object.AddToPassesTrail(fmt.Sprintf("Unspec[%s → %s]", name, object.Name))
		}

		schema.AddObject(object)
	})

	return schema
}
