package golang

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type JSONMarshalling struct {
	tmpl            *template.Template
	config          Config
	imports         *common.DirectImportMap
	packageMapper   func(string) string
	typeFormatter   *typeFormatter
	apiRefCollector *common.APIReferenceCollector
}

func newJSONMarshalling(config Config, tmpl *template.Template, imports *common.DirectImportMap, packageMapper func(string) string, typeFormatter *typeFormatter, apiRefCollector *common.APIReferenceCollector) JSONMarshalling {
	return JSONMarshalling{
		config: config,
		tmpl: tmpl.Funcs(template.FuncMap{
			"formatType": typeFormatter.formatType,
			"importStdPkg": func(pkg string) string {
				return imports.Add(pkg, pkg)
			},
		}),
		imports:         imports,
		packageMapper:   packageMapper,
		typeFormatter:   typeFormatter,
		apiRefCollector: apiRefCollector,
	}
}

func (jenny JSONMarshalling) generateForObject(buffer *strings.Builder, context languages.Context, object ast.Object) error {
	if !jenny.config.GenerateJSONMarshaller {
		return nil
	}

	if jenny.objectNeedsCustomMarshal(object) {
		jsonMarshal, err := jenny.renderCustomMarshal(object)
		if err != nil {
			return err
		}
		buffer.WriteString(jsonMarshal)
		buffer.WriteString("\n")
	}

	if jenny.objectNeedsCustomUnmarshal(context, object) {
		jsonUnmarshal, err := jenny.renderCustomUnmarshal(context, object)
		if err != nil {
			return err
		}
		buffer.WriteString(jsonUnmarshal)
		buffer.WriteString("\n")
	}

	return nil
}

func (jenny JSONMarshalling) objectNeedsCustomMarshal(obj ast.Object) bool {
	// the only case for which we need a custom marshaller is for structs
	// that are generated from a disjunction by the `DisjunctionToType` compiler pass.

	return obj.Type.IsDisjunctionOfAnyKind()
}

func (jenny JSONMarshalling) renderCustomMarshal(obj ast.Object) (string, error) {
	jenny.apiRefCollector.ObjectMethod(obj, common.MethodReference{
		Name: "MarshalJSON",
		Comments: []string{
			fmt.Sprintf("MarshalJSON implements a custom JSON marshalling logic to encode `%s` as JSON.", formatObjectName(obj.Name)),
		},
		Return: "([]byte, error)",
	})

	// There are only two types of disjunctions we support:
	//  * undiscriminated: string | bool | ..., where all the disjunction branches are scalars (or an array)
	//  * discriminated: SomeStruct | SomeOtherStruct, where all the disjunction branches are references to
	// 	  structs and these structs have a common "discriminator" field.
	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalars) {
		return jenny.tmpl.Render("types/disjunction_of_scalars.json_marshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDiscriminatedDisjunctionOfRefs) {
		return jenny.tmpl.Render("types/disjunction_of_refs.json_marshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalarsAndRefs) {
		return jenny.tmpl.Render("types/disjunction_of_scalars_and_refs.json_marshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	return "", fmt.Errorf("could not determine how to render custom marshal")
}

func (jenny JSONMarshalling) objectNeedsCustomUnmarshal(context languages.Context, obj ast.Object) bool {
	// an object needs a custom unmarshal if:
	// - it is a struct that was generated from a disjunction by the `DisjunctionToType` compiler pass.
	// - it is a struct and one or more of its fields is a KindComposableSlot, or an array of KindComposableSlot

	if !obj.Type.IsStruct() {
		return false
	}

	// is there a custom unmarshal template block?
	if jenny.tmpl.Exists(template.CustomObjectUnmarshalBlock(obj)) {
		return true
	}

	// is it a struct generated from a disjunction?
	if obj.Type.IsDisjunctionOfAnyKind() {
		return true
	}

	// is there a KindComposableSlot field somewhere?
	for _, field := range obj.Type.AsStruct().Fields {
		if _, ok := context.ResolveToComposableSlot(field.Type); ok {
			return true
		}
	}

	return false
}

func (jenny JSONMarshalling) renderCustomUnmarshal(context languages.Context, obj ast.Object) (string, error) {
	jenny.apiRefCollector.ObjectMethod(obj, common.MethodReference{
		Name: "UnmarshalJSON",
		Arguments: []common.ArgumentReference{
			{Name: "raw", Type: "[]byte"},
		},
		Comments: []string{
			fmt.Sprintf("UnmarshalJSON implements a custom JSON unmarshalling logic to decode `%s` from JSON.", formatObjectName(obj.Name)),
		},
		Return: "error",
	})

	customUnmarshalTmpl := template.CustomObjectUnmarshalBlock(obj)
	if jenny.tmpl.Exists(customUnmarshalTmpl) {
		return jenny.tmpl.Render(customUnmarshalTmpl, map[string]any{
			"Object": obj,
		})
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalars) {
		return jenny.tmpl.Render("types/disjunction_of_scalars.json_unmarshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDiscriminatedDisjunctionOfRefs) {
		return jenny.tmpl.Render("types/disjunction_of_refs.json_unmarshal.tmpl", map[string]any{
			"def":  obj,
			"hint": obj.Type.Hints[ast.HintDiscriminatedDisjunctionOfRefs],
		})
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalarsAndRefs) {
		return jenny.tmpl.Render("types/disjunction_of_scalars_and_refs.json_unmarshal.tmpl", map[string]any{
			"def": obj,
		})
	}

	return jenny.renderCustomComposableSlotUnmarshal(context, obj)
}

func (jenny JSONMarshalling) renderCustomComposableSlotUnmarshal(context languages.Context, obj ast.Object) (string, error) {
	var buffer strings.Builder
	fields := obj.Type.AsStruct().Fields

	// unmarshal "normal" fields (ie: with no composable slot)
	for _, field := range fields {
		if _, ok := context.ResolveToComposableSlot(field.Type); ok {
			continue
		}

		jenny.imports.Add("fmt", "fmt")
		buffer.WriteString(fmt.Sprintf(`
	if fields["%[1]s"] != nil {
		if err := json.Unmarshal(fields["%[1]s"], &resource.%[2]s); err != nil {
			return fmt.Errorf("error decoding field '%[1]s': %%w", err)
		}
	}
`, field.Name, formatFieldName(field.Name)))
	}

	// unmarshal "composable slot" fields
	for _, field := range fields {
		composableSlotType, resolved := context.ResolveToComposableSlot(field.Type)
		if !resolved {
			continue
		}

		variant := string(composableSlotType.AsComposableSlot().Variant)
		unmarshalVariantBlock := template.VariantFieldUnmarshalBlock(variant)
		if !jenny.tmpl.Exists(unmarshalVariantBlock) {
			return "", fmt.Errorf("can not generate custom unmarshal function for composable slot with variant '%s': template block %s not found", variant, unmarshalVariantBlock)
		}

		if err := jenny.tmpl.RenderInBuffer(&buffer, unmarshalVariantBlock, map[string]any{
			"Object": obj,
			"Field":  field,
		}); err != nil {
			return "", err
		}
	}

	jenny.imports.Add("json", "encoding/json")

	return fmt.Sprintf(`// UnmarshalJSON implements a custom JSON unmarshalling logic to decode %[1]s from JSON.
func (resource *%[1]s) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}
	fields := make(map[string]json.RawMessage)
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	%[2]s
	return nil
}
`, formatObjectName(obj.Name), buffer.String()), nil
}
