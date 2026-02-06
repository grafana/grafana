package golang

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type validationMethods struct {
	tmpl            *template.Template
	packageMapper   func(string) string
	apiRefCollector *common.APIReferenceCollector
}

func newValidationMethods(tmpl *template.Template, packageMapper func(string) string, apiRefCollector *common.APIReferenceCollector) validationMethods {
	return validationMethods{
		tmpl:            tmpl,
		packageMapper:   packageMapper,
		apiRefCollector: apiRefCollector,
	}
}

func (jenny validationMethods) generateForObject(buffer *strings.Builder, context languages.Context, object ast.Object, imports *common.DirectImportMap) error {
	if !object.Type.IsStruct() {
		return nil
	}

	var resolvesToConstraints func(typeDef ast.Type) bool
	resolvesToConstraints = func(typeDef ast.Type) bool {
		if typeDef.IsAny() {
			return false
		}

		if typeDef.IsComposableSlot() {
			return true
		}

		if typeDef.IsRef() {
			return context.ResolveRefs(typeDef).IsStruct()
		}

		if typeDef.IsScalar() {
			return len(typeDef.AsScalar().Constraints) != 0
		}

		if typeDef.IsDisjunction() {
			for _, branch := range typeDef.AsDisjunction().Branches {
				if resolvesToConstraints(branch) {
					return true
				}
			}
		}

		if typeDef.IsIntersection() {
			for _, branch := range typeDef.AsIntersection().Branches {
				if resolvesToConstraints(branch) {
					return true
				}
			}
		}

		if typeDef.IsStruct() {
			for _, field := range typeDef.AsStruct().Fields {
				if resolvesToConstraints(field.Type) {
					return true
				}
			}
		}

		if typeDef.IsMap() {
			return resolvesToConstraints(typeDef.AsMap().ValueType)
		}

		if typeDef.IsArray() {
			return resolvesToConstraints(typeDef.AsArray().ValueType)
		}

		if typeDef.IsConstantRef() {
			obj, _ := context.LocateObject(typeDef.AsConstantRef().ReferredPkg, typeDef.AsConstantRef().ReferredType)
			return obj.Type.IsEnum()
		}

		return false
	}

	jenny.apiRefCollector.ObjectMethod(object, common.MethodReference{
		Name: "Validate",
		Comments: []string{
			fmt.Sprintf("Validate checks all the validation constraints that may be defined on `%s` fields for violations and returns them.", formatObjectName(object.Name)),
		},
		Return: "error",
	})

	tmpl := jenny.tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(template.FuncMap{
			"resolvesToConstraints": resolvesToConstraints,
			"importPkg":             jenny.packageMapper,
			"importStdPkg": func(pkg string) string {
				return imports.Add(pkg, pkg)
			},
		})

	rendered, err := tmpl.Render("types/struct_validation_method.tmpl", map[string]any{
		"def": object,
	})
	if err != nil {
		return err
	}
	buffer.WriteString(rendered)

	return nil
}
