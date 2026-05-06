package java

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
)

type JSONMarshaller struct {
	config        Config
	tmpl          *template.Template
	typeFormatter *typeFormatter
}

func (j JSONMarshaller) genToJSONFunction(t ast.Type) string {
	if !j.config.GenerateJSONMarshaller || !j.config.GenerateBuilders || j.config.SkipRuntime {
		return ""
	}

	j.typeFormatter.packageMapper(fasterXMLPackageName, "core.JsonProcessingException")
	j.typeFormatter.packageMapper(fasterXMLPackageName, "databind.ObjectMapper")
	j.typeFormatter.packageMapper(fasterXMLPackageName, "databind.ObjectWriter")
	if t.IsDisjunctionOfAnyKind() {
		rendered, _ := j.tmpl.Render("marshalling/disjunctions.json_marshall.tmpl", map[string]any{
			"Fields": t.AsStruct().Fields,
		})
		return rendered
	}

	rendered, _ := j.tmpl.Render("marshalling/marshalling.tmpl", map[string]any{})
	return rendered
}

func (j JSONMarshaller) annotation(t ast.Type) string {
	if !j.config.GenerateJSONMarshaller || !j.config.GenerateBuilders || j.config.SkipRuntime {
		return ""
	}

	if t.IsStructGeneratedFromDisjunction() && t.IsStruct() {
		j.typeFormatter.packageMapper(fasterXMLPackageName, "annotation.JsonUnwrapped")
		return "@JsonUnwrapped"
	}

	j.typeFormatter.packageMapper(fasterXMLPackageName, "annotation.JsonProperty")
	return "@JsonProperty(%#v)"
}
