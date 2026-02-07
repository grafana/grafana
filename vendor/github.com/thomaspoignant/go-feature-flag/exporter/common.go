package exporter

import (
	"bytes"
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"text/template"
	"time"
)

const DefaultCsvTemplate = "{{ .Kind}};{{ .ContextKind}};{{ .UserKey}};{{ .CreationDate}};{{ .Key}};{{ .Variation}};" +
	"{{ .Value}};{{ .Default}};{{ .Source}}\n"
const DefaultFilenameTemplate = "flag-variation-{{ .Hostname}}-{{ .Timestamp}}.{{ .Format}}"

// ParseTemplate is parsing the template given by the config or use the default template
func ParseTemplate(name string, templateToParse string, defaultTemplate string) *template.Template {
	if templateToParse == "" {
		templateToParse = defaultTemplate
	}
	t, err := template.New(name).Parse(templateToParse)
	if err != nil {
		t, _ = template.New(name).Parse(defaultTemplate)
	}
	return t
}

// ComputeFilename is computing the filename to use for the export file
func ComputeFilename(template *template.Template, format string) (string, error) {
	hostname, _ := os.Hostname()
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	format = strings.ToLower(format)

	var buf bytes.Buffer
	err := template.Execute(&buf, struct {
		Hostname  string
		Timestamp string
		Format    string
	}{
		Hostname:  hostname,
		Timestamp: timestamp,
		Format:    format,
	})
	return buf.String(), err
}

func FormatEventInCSV(csvTemplate *template.Template, event FeatureEvent) ([]byte, error) {
	var buf bytes.Buffer
	err := csvTemplate.Execute(&buf, event)
	return buf.Bytes(), err
}

func FormatEventInJSON(event FeatureEvent) ([]byte, error) {
	b, err := json.Marshal(event)
	b = append(b, []byte("\n")...)
	return b, err
}
