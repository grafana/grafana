package golang

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type strictJSONUnmarshal struct {
	tmpl            *template.Template
	config          Config
	imports         *common.DirectImportMap
	packageMapper   func(string) string
	typeFormatter   *typeFormatter
	apiRefCollector *common.APIReferenceCollector
}

func newStrictJSONUnmarshal(config Config, tmpl *template.Template, imports *common.DirectImportMap, packageMapper func(string) string, typeFormatter *typeFormatter, apiRefCollector *common.APIReferenceCollector) strictJSONUnmarshal {
	return strictJSONUnmarshal{
		config: config,
		tmpl: tmpl.Funcs(template.FuncMap{
			"formatType": typeFormatter.formatType,
			"importStdPkg": func(pkg string) string {
				return imports.Add(pkg, pkg)
			},
			"importPkg": packageMapper,
		}),
		imports:         imports,
		packageMapper:   packageMapper,
		typeFormatter:   typeFormatter,
		apiRefCollector: apiRefCollector,
	}
}

func (jenny strictJSONUnmarshal) generateForObject(buffer *strings.Builder, context languages.Context, object ast.Object) error {
	if !jenny.config.GenerateJSONMarshaller || !jenny.config.GenerateStrictUnmarshaller {
		return nil
	}

	if !jenny.objectNeedsUnmarshal(object) {
		return nil
	}

	jsonUnmarshal, err := jenny.renderUnmarshal(context, object)
	if err != nil {
		return err
	}

	buffer.WriteString(jsonUnmarshal)
	buffer.WriteString("\n")

	return nil
}

func (jenny strictJSONUnmarshal) objectNeedsUnmarshal(obj ast.Object) bool {
	return obj.Type.IsStruct()
}

func (jenny strictJSONUnmarshal) renderUnmarshal(context languages.Context, obj ast.Object) (string, error) {
	jenny.apiRefCollector.ObjectMethod(obj, common.MethodReference{
		Name: "UnmarshalJSONStrict",
		Arguments: []common.ArgumentReference{
			{Name: "raw", Type: "[]byte"},
		},
		Comments: []string{
			fmt.Sprintf("UnmarshalJSONStrict implements a custom JSON unmarshalling logic to decode `%s` from JSON.", formatObjectName(obj.Name)),
			"Note: the unmarshalling done by this function is strict. It will fail over required fields being absent from the input, fields having an incorrect type, unexpected fields being present, …",
		},
		Return: "error",
	})

	tmpl := jenny.tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(template.FuncMap{
			"resolvesToArrayOfScalars": func(typeDef ast.Type) bool {
				return context.IsArrayOfKinds(typeDef, ast.KindScalar, ast.KindEnum)
			},
			"resolvesToMapOfScalars": func(typeDef ast.Type) bool {
				return context.IsMapOfKinds(typeDef, ast.KindScalar, ast.KindEnum)
			},
			"formatRawRef": func(pkg string, ref string) string {
				return jenny.typeFormatter.formatRef(ast.NewRef(pkg, ref), false)
			},
		})

	customUnmarshalTmpl := template.CustomObjectStrictUnmarshalBlock(obj)
	if tmpl.Exists(customUnmarshalTmpl) {
		return tmpl.Render(customUnmarshalTmpl, map[string]any{
			"Object": obj,
		})
	}

	if obj.Type.IsDisjunctionOfScalars() {
		return jenny.tmpl.Render("types/disjunction_of_scalars.strict.json_unmarshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	if obj.Type.IsDisjunctionOfRefs() {
		return jenny.tmpl.Render("types/disjunction_of_refs.strict.json_unmarshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	if obj.Type.IsDisjunctionOfAnyKind() {
		return jenny.tmpl.Render("types/disjunction_of_scalars_and_refs.strict.json_unmarshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	// struct
	return jenny.tmpl.Render("types/struct.strict.json_unmarshal.tmpl", map[string]any{
		"def": obj,
	})
}
