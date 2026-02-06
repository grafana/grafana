package php

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type shape struct {
	context languages.Context
}

func (generator *shape) typeShape(def ast.Type) string {
	switch {
	case def.IsArray():
		return generator.arrayShape(def)
	case def.IsMap():
		return generator.mapShape(def)
	case def.IsScalar():
		return scalarHint(def)
	case def.IsRef():
		return generator.refShape(def)
	case def.IsComposableSlot():
		return generator.composableSlotShape(def)
	case def.IsDisjunction():
		return generator.disjunctionShape(def)
	case def.IsStruct():
		return generator.structShape(def)
	case def.IsEnum():
		return generator.enumShape(def)
	case def.IsConstantRef():
		return generator.constantRefShape(def)
	}

	return ""
}

func (generator *shape) arrayShape(def ast.Type) string {
	valueType := generator.typeShape(def.Array.ValueType)

	return fmt.Sprintf("array<%s>", valueType)
}

func (generator *shape) mapShape(def ast.Type) string {
	indexType := generator.typeShape(def.Map.IndexType)
	valueType := generator.typeShape(def.Map.ValueType)

	return fmt.Sprintf("array<%s, %s>", indexType, valueType)
}

func (generator *shape) enumShape(def ast.Type) string {
	return generator.typeShape(def.Enum.Values[0].Type)
}

func (generator *shape) refShape(def ast.Type) string {
	referredObj, found := generator.context.LocateObjectByRef(def.AsRef())
	if !found {
		return "mixed"
	}

	// to break off any potential infinite recursion
	if referredObj.Type.IsStruct() {
		return "mixed"
	}

	return generator.typeShape(referredObj.Type)
}

func (generator *shape) composableSlotShape(_ ast.Type) string {
	return "mixed" // TODO?
}

func (generator *shape) disjunctionShape(def ast.Type) string {
	branches := tools.Map(def.Disjunction.Branches, func(branch ast.Type) string {
		return generator.typeShape(branch)
	})

	return strings.Join(branches, "|")
}

func (generator *shape) structShape(def ast.Type) string {
	fields := make([]string, 0, len(def.Struct.Fields))
	for _, field := range def.Struct.Fields {
		fields = append(fields, fmt.Sprintf("%s?: %s", field.Name, generator.typeShape(field.Type)))
	}

	return fmt.Sprintf("array{%s}", strings.Join(fields, ", "))
}

func (generator *shape) constantRefShape(def ast.Type) string {
	return formatValue(def.AsConstantRef().ReferenceValue)
}
