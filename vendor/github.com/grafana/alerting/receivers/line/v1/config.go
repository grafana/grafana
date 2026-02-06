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
	Token       string `json:"token,omitempty" yaml:"token,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.Token = decryptFn("token", settings.Token)
	if settings.Token == "" {
		return Config{}, errors.New("could not find token in settings")
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Description == "" {
		settings.Description = templates.DefaultMessageEmbed
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	TypeAlias: "line",
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "Token",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "LINE notify token key",
			PropertyName: "token",
			Required:     true,
			Secure:       true,
		},
		{ // New in 9.3
			Label:        "Title",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the message",
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{ // New in 9.3
			Label:        "Description",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated description of the message",
			PropertyName: "description",
			Placeholder:  templates.DefaultMessageEmbed,
		},
	},
}
