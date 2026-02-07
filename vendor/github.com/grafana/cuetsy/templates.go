package cuetsy

import (
	"strings"
	"text/template"
)

// Generate a typescript type declaration. Inputs:
// .maturity	Optional. Maturity level, applied in doc comment
// .export		Whether to export the declaration
// .name		  The name of the typescript type
// .tokens		Slice of token strings
var typeCode = tmpl("type", `
{{if .maturity -}}
/**
 * {{.maturity}}
 */
{{end -}}
{{if .export}}export {{end -}}
type {{.name}} = {{ Join .tokens " | "}};
{{- if .default }}

{{if .export}}export {{end -}}
const default{{.name}}: {{.name}} = {{.default}};{{end}}`)

// Generate a typescript enum declaration. Inputs:
// .maturity	Optional. Maturity level, applied in doc comment
// .export		Whether to export the declaration
// .name		  The name of the typescript enum
// .pairs		  Slice of {K: string, V: string}
var enumCode = tmpl("enum", `
{{if .maturity -}}
/**
 * {{.maturity}}
 */
{{end -}}
{{if .export}}export {{end -}}
enum {{.name}} {
  {{- range .pairs}}
  {{.K}} = {{.V}},{{end}}
}
{{- if .default }}

{{if .export}}export {{end -}}
const default{{.name}}: {{.name}} = {{.name}}.{{.default}};{{end}}`)

// Generate a typescript interface declaration. Inputs:
// .maturity	Optional. Maturity level, applied in doc comment
// .name		The name of the typescript enum.
// .pairs		Slice of {K: string, V: string}
// .extends		Slice of other interface names to extend
// .defaults	Whether to generate a default const
var interfaceCode = tmpl("interface", `
{{if .maturity -}}
/**
 * {{.maturity}}
 */
{{end -}}
{{if .export}}export {{end -}}
interface {{.name}}{{if ne (len .extends) 0}} extends {{ Join .extends ", "}}{{end}} {
  {{- range .pairs}}
  {{.K}}: {{.V}};{{end}}
}{{- if .defaults }}

{{if .export}}export {{end -}}
const default{{.name}}: {{.name}} = {
  {{- range .pairs}}{{if .Default}}
  {{StripQ .K}}: {{.Default}},{{end}}{{end}}
};{{end}}`)

var nestedStructCode = tmpl("nestedstruct", `{
{{- range .pairs}}
{{ range $.level}}  {{end}}  {{.K}}: {{.V}};{{end}}
{{ range $.level}}  {{end}}}`)

func tmpl(name, data string) *template.Template {
	t := template.New(name)
	t.Funcs(template.FuncMap{
		"Join": strings.Join,
		"StripQ": func(s string) string {
			return strings.TrimSuffix(s, "?")
		},
	})
	t = template.Must(t.Parse(data))
	return t
}
