package v1

import (
	"encoding/json"
	"fmt"

	"github.com/pkg/errors"

	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	URL          string `json:"url,omitempty" yaml:"url,omitempty"`
	Message      string `json:"message,omitempty" yaml:"message,omitempty"`
	Title        string `json:"title,omitempty" yaml:"title,omitempty"`
	SectionTitle string `json:"sectiontitle,omitempty" yaml:"sectiontitle,omitempty"`
}

func NewConfig(jsonData json.RawMessage) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return settings, errors.New("could not find url property in settings")
	}
	if settings.Message == "" {
		settings.Message = `{{ template "teams.default.message" .}}`
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "Teams incoming webhook url",
			PropertyName: "url",
			Required:     true,
			Protected:    true,
		},
		{
			Label:        "Title",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the Teams message.",
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{
			Label:        "Section Title",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Section title for the Teams message. Leave blank for none.",
			PropertyName: "sectiontitle",
		},
		{ // New in 8.0.
			Label:        "Message",
			Element:      schema.ElementTypeTextArea,
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
	},
}
