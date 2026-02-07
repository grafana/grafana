package templates

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
	"testing"
	tmpltext "text/template"

	"github.com/stretchr/testify/require"
)

const (
	DefaultMessageTitleEmbed = `{{ template "default.title" . }}`
	DefaultMessageEmbed      = `{{ template "default.message" . }}`
	DefaultMessageColor      = `{{ if eq .Status "firing" }}#D63232{{ else }}#36a64f{{ end }}`
)

var DefaultTemplateString = `
{{ define "__subject" }}[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ if gt (.Alerts.Resolved | len) 0 }}, RESOLVED:{{ .Alerts.Resolved | len }}{{ end }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}{{ end }}

{{ define "__text_values_list" }}{{ if len .Values }}{{ $first := true }}{{ range $refID, $value := .Values -}}
{{ if $first }}{{ $first = false }}{{ else }}, {{ end }}{{ $refID }}={{ $value }}{{ end -}}
{{ else }}[no value]{{ end }}{{ end }}

{{ define "__text_alert_list" }}{{ range . }}
Value: {{ template "__text_values_list" . }}
Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}Annotations:
{{ range .Annotations.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}{{ if gt (len .GeneratorURL) 0 }}Source: {{ .GeneratorURL }}
{{ end }}{{ if gt (len .SilenceURL) 0 }}Silence: {{ .SilenceURL }}
{{ end }}{{ if gt (len .DashboardURL) 0 }}Dashboard: {{ .DashboardURL }}
{{ end }}{{ if gt (len .PanelURL) 0 }}Panel: {{ .PanelURL }}
{{ end }}{{ end }}{{ end }}

{{ define "default.title" }}{{ template "__subject" . }}{{ end }}

{{ define "default.message" }}{{ if gt (len .Alerts.Firing) 0 }}**Firing**
{{ template "__text_alert_list" .Alerts.Firing }}{{ if gt (len .Alerts.Resolved) 0 }}

{{ end }}{{ end }}{{ if gt (len .Alerts.Resolved) 0 }}**Resolved**
{{ template "__text_alert_list" .Alerts.Resolved }}{{ end }}{{ end }}

{{ define "slack.default.footer" }}Grafana{{ if .AppVersion }} v{{ .AppVersion }}{{ end }}{{ end }}

{{ define "__teams_text_alert_list" }}{{ range . }}
Value: {{ template "__text_values_list" . }}
Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}
Annotations:
{{ range .Annotations.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}
{{ if gt (len .GeneratorURL) 0 }}Source: [{{ .GeneratorURL }}]({{ .GeneratorURL }})

{{ end }}{{ if gt (len .SilenceURL) 0 }}Silence: [{{ .SilenceURL }}]({{ .SilenceURL }})

{{ end }}{{ if gt (len .DashboardURL) 0 }}Dashboard: [{{ .DashboardURL }}]({{ .DashboardURL }})

{{ end }}{{ if gt (len .PanelURL) 0 }}Panel: [{{ .PanelURL }}]({{ .PanelURL }})

{{ end }}
{{ end }}{{ end }}


{{ define "teams.default.message" }}{{ if gt (len .Alerts.Firing) 0 }}**Firing**
{{ template "__teams_text_alert_list" .Alerts.Firing }}{{ if gt (len .Alerts.Resolved) 0 }}

{{ end }}{{ end }}{{ if gt (len .Alerts.Resolved) 0 }}**Resolved**
{{ template "__teams_text_alert_list" .Alerts.Resolved }}{{ end }}{{ end }}

{{ define "jira.default.summary" }}{{ template "__subject" . }}{{ end }}
{{- define "jira.default.description" -}}
{{- if gt (len .Alerts.Firing) 0 -}}
# Alerts Firing:
{{ template "__text_alert_list_markdown" .Alerts.Firing }}
{{- end -}}
{{- if gt (len .Alerts.Resolved) 0 -}}
# Alerts Resolved:
{{- template "__text_alert_list_markdown" .Alerts.Resolved -}}
{{- end -}}
{{- end -}}

{{- define "jira.default.priority" -}}
{{- $priority := "" }}
{{- range .Alerts.Firing -}}
    {{- $severity := index .Labels "severity" -}}
    {{- if (eq $severity "critical") -}}
        {{- $priority = "High" -}}
    {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
        {{- $priority = "Medium" -}}
    {{- else if (and (eq $severity "info") (eq $priority "")) -}}
        {{- $priority = "Low" -}}
    {{- end -}}
{{- end -}}
{{- if eq $priority "" -}}
    {{- range .Alerts.Resolved -}}
        {{- $severity := index .Labels "severity" -}}
        {{- if (eq $severity "critical") -}}
            {{- $priority = "High" -}}
        {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
            {{- $priority = "Medium" -}}
        {{- else if (and (eq $severity "info") (eq $priority "")) -}}
            {{- $priority = "Low" -}}
        {{- end -}}
    {{- end -}}
{{- end -}}
{{- $priority -}}
{{- end -}}

{{- define "webhook.default.payload.state" -}}{{ if eq .Status "resolved" }}ok{{ else }}alerting{{ end }}{{ end }}
{{ define "webhook.default.payload" -}}
  {{ coll.Dict 
  "receiver" .Receiver
  "status" .Status
  "alerts" .Alerts
  "groupLabels" .GroupLabels
  "commonLabels" .CommonLabels
  "commonAnnotations" .CommonAnnotations
  "externalURL" .ExternalURL
  "version" "1"
  "orgId"  (index .Alerts 0).OrgID
  "truncatedAlerts"  .TruncatedAlerts
  "groupKey" .GroupKey
  "state"  (tmpl.Exec "webhook.default.payload.state" . )
  "title" (tmpl.Exec "default.title" . )
  "message" (tmpl.Exec "default.message" . )
  | data.ToJSONPretty " "}}
{{- end }}
`

// TemplateForTestsString is the template used for unit tests and integration tests.
// We have it separate from above default template because any tiny change in the template
// will require updating almost all channel tests (15+ files) and it's very time consuming.
const TemplateForTestsString = `
{{ define "__subject" }}[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .GroupLabels.SortedPairs.Values | join " " }} {{ if gt (len .CommonLabels) (len .GroupLabels) }}({{ with .CommonLabels.Remove .GroupLabels.Names }}{{ .Values | join " " }}{{ end }}){{ end }}{{ end }}

{{ define "__text_values_list" }}{{ $len := len .Values }}{{ if $len }}{{ $first := gt $len 1 }}{{ range $refID, $value := .Values -}}
{{ $refID }}={{ $value }}{{ if $first }}, {{ end }}{{ $first = false }}{{ end -}}
{{ else }}[no value]{{ end }}{{ end }}

{{ define "__text_alert_list" }}{{ range . }}
Value: {{ template "__text_values_list" . }}
Labels:
{{ range .Labels.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}Annotations:
{{ range .Annotations.SortedPairs }} - {{ .Name }} = {{ .Value }}
{{ end }}{{ if gt (len .GeneratorURL) 0 }}Source: {{ .GeneratorURL }}
{{ end }}{{ if gt (len .SilenceURL) 0 }}Silence: {{ .SilenceURL }}
{{ end }}{{ if gt (len .DashboardURL) 0 }}Dashboard: {{ .DashboardURL }}
{{ end }}{{ if gt (len .PanelURL) 0 }}Panel: {{ .PanelURL }}
{{ end }}{{ end }}{{ end }}

{{ define "default.title" }}{{ template "__subject" . }}{{ end }}

{{ define "default.message" }}{{ if gt (len .Alerts.Firing) 0 }}**Firing**
{{ template "__text_alert_list" .Alerts.Firing }}{{ if gt (len .Alerts.Resolved) 0 }}

{{ end }}{{ end }}{{ if gt (len .Alerts.Resolved) 0 }}**Resolved**
{{ template "__text_alert_list" .Alerts.Resolved }}{{ end }}{{ end }}

{{ define "slack.default.footer" }}Grafana{{ if .AppVersion }} v{{ .AppVersion }}{{ end }}{{ end }}

{{ define "teams.default.message" }}{{ template "default.message" . }}{{ end }}

{{ define "jira.default.summary" }}{{ template "__subject" . }}{{ end }}

{{- define "jira.default.description" -}}
{{- if gt (len .Alerts.Firing) 0 -}}
# Alerts Firing:
{{ template "__text_alert_list_markdown" .Alerts.Firing }}
{{- end -}}
{{- if gt (len .Alerts.Resolved) 0 -}}
# Alerts Resolved:
{{- template "__text_alert_list_markdown" .Alerts.Resolved -}}
{{- end -}}
{{- end -}}

{{- define "jira.default.priority" -}}
{{- $priority := "" }}
{{- range .Alerts.Firing -}}
    {{- $severity := index .Labels "severity" -}}
    {{- if (eq $severity "critical") -}}
        {{- $priority = "High" -}}
    {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
        {{- $priority = "Medium" -}}
    {{- else if (and (eq $severity "info") (eq $priority "")) -}}
        {{- $priority = "Low" -}}
    {{- end -}}
{{- end -}}
{{- if eq $priority "" -}}
    {{- range .Alerts.Resolved -}}
        {{- $severity := index .Labels "severity" -}}
        {{- if (eq $severity "critical") -}}
            {{- $priority = "High" -}}
        {{- else if (and (eq $severity "warning") (ne $priority "High")) -}}
            {{- $priority = "Medium" -}}
        {{- else if (and (eq $severity "info") (eq $priority "")) -}}
            {{- $priority = "Low" -}}
        {{- end -}}
    {{- end -}}
{{- end -}}
{{- $priority -}}
{{- end -}}
`

func ForTests(t *testing.T) *Template {
	tmpl, err := fromContent(append(defaultTemplatesPerKind(GrafanaKind), TemplateForTestsString), defaultOptionsPerKind(GrafanaKind, "grafana")...)
	require.NoError(t, err)
	externalURL, err := url.Parse("http://test.com")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL
	return &Template{
		Template: tmpl,
		limits:   DefaultLimits,
	}
}

var DefaultTemplateName = "__default__"

var DefaultTemplatesToOmit = []string{
	"email.default.html",
	"email.default.subject",
}

// DefaultTemplate returns a new Template with all default templates parsed.
func DefaultTemplate(omitTemplates []string) (TemplateDefinition, error) {
	// We cannot simply append the text of each default file together as there can be (and are) duplicate template
	// names. Duplicate templates should override when parsed from separate files but will fail to parse if both are in
	// the same file.
	// So, instead we allow tmpltext to combine the templates and then convert it to a string afterwards.
	// The underlying template is not accessible, so we capture it via template.Option.

	// Call fromContent without any user-provided templates to get the combined default template.
	tmpl, err := fromContent(defaultTemplatesPerKind(GrafanaKind), defaultOptionsPerKind(GrafanaKind, "grafana")...)
	if err != nil {
		return TemplateDefinition{}, err
	}

	var combinedTemplate strings.Builder
	txt, err := tmpl.Text()
	if err != nil {
		return TemplateDefinition{}, err
	}
	tmpls := txt.Templates()
	// Sort for a consistent order.
	slices.SortFunc(tmpls, func(a, b *tmpltext.Template) int {
		return strings.Compare(a.Name(), b.Name())
	})

	// Recreate the "define" blocks for all templates. Would be nice to have a more direct way to do this.
	for _, tmpl := range tmpls {
		name := tmpl.Name()
		if name == "" || slices.Contains(omitTemplates, name) {
			continue
		}
		def := tmpl.Root.String()
		if tmpl.Name() == "__text_values_list" {
			// Temporary fix for https://github.com/golang/go/commit/6fea4094242fe4e7be8bd7ec0b55df9f6df3f025.
			// TODO: Can remove with GO v1.24.
			def = strings.Replace(def, "$first := false", "$first = false", 1)
		}
		combinedTemplate.WriteString(fmt.Sprintf("{{ define \"%s\" }}%s{{ end }}\n\n", tmpl.Name(), def))
	}
	return TemplateDefinition{
		Name:     DefaultTemplateName,
		Template: combinedTemplate.String(),
		Kind:     GrafanaKind,
	}, nil
}
