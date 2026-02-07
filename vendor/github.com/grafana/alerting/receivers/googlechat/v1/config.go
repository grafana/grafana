package v1

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	URL             string `json:"url,omitempty" yaml:"url,omitempty"`
	Title           string `json:"title,omitempty" yaml:"title,omitempty"`
	Message         string `json:"message,omitempty" yaml:"message,omitempty"`
	HideOpenButton  bool   `json:"hide_open_button,omitempty" yaml:"hide_open_button,omitempty"`
	HideVersionInfo bool   `json:"hide_version_info,omitempty" yaml:"hide_version_info,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	settings.URL = decryptFn("url", settings.URL)
	if settings.URL == "" {
		return Config{}, errors.New("could not find url property in settings")
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
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
			Placeholder:  "Google Chat incoming webhook url",
			PropertyName: "url",
			Required:     true,
			Secure:       true,
			Protected:    true,
		},
		{
			Label:        "Title",
			Description:  "Templated title of the message",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Placeholder:  templates.DefaultMessageTitleEmbed,
			PropertyName: "title",
		},
		{
			Label:        "Message",
			Element:      schema.ElementTypeTextArea,
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
		{
			Label:        "HideOpenButton",
			Description:  "Hide open URL button",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "hide_open_button",
		},
		{
			Label:        "HideVersionInfo",
			Description:  "Hide version info",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "hide_version_info",
		},
	},
}
